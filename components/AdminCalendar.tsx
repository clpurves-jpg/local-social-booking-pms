'use client';

import { addDays, format, parseISO } from 'date-fns';
import { DndContext, DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useMemo, useState } from 'react';
import type { Booking, Room } from '@/lib/types';
import { cn } from '@/lib/utils';

interface CalendarBooking extends Booking {
  inventory_name: string;
}

function DraggableChip({ booking, startIndex, span }: { booking: CalendarBooking; startIndex: number; span: number }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: booking.id, data: { booking } });
  const style = {
    transform: CSS.Translate.toString(transform),
    gridColumn: `${startIndex + 2} / span ${Math.max(1, span)}`
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style} className={cn('booking-chip', booking.status)} {...listeners} {...attributes}>
      <strong>{booking.guest_first_name} {booking.guest_last_name}</strong>
      <div>{booking.confirmation_code}</div>
      <div>{format(parseISO(booking.check_in_date), 'MMM d')}–{format(parseISO(booking.check_out_date), 'MMM d')}</div>
    </div>
  );
}

function DropCell({ roomId, date }: { roomId: string; date: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${roomId}|${date}` });
  return <div ref={setNodeRef} className="calendar-dropzone" style={{ background: isOver ? '#f5f7ff' : undefined }} />;
}

export function AdminCalendar({ rooms, bookings }: { rooms: Room[]; bookings: CalendarBooking[] }) {
  const [items, setItems] = useState(bookings);
  const startDate = useMemo(() => new Date(), []);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(startDate, i)), [startDate]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  async function onDragEnd(event: DragEndEvent) {
    const activeBooking = event.active.data.current?.booking as CalendarBooking | undefined;
    if (!activeBooking || !event.over) return;
    const [roomId, date] = String(event.over.id).split('|');
    const nightSpan = Math.max(1, Math.round((new Date(activeBooking.check_out_date).getTime() - new Date(activeBooking.check_in_date).getTime()) / 86400000));
    const nextCheckIn = date;
    const nextCheckOut = format(addDays(parseISO(date), nightSpan), 'yyyy-MM-dd');

    const res = await fetch('/api/admin/reassign-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: activeBooking.id, inventory_id: roomId, check_in_date: nextCheckIn, check_out_date: nextCheckOut })
    });

    if (!res.ok) {
      alert('That move was blocked because of overlap or a maintenance block.');
      return;
    }

    setItems((current) => current.map((item) => item.id === activeBooking.id ? { ...item, inventory_id: roomId, inventory_name: rooms.find((r) => r.id === roomId)?.name || item.inventory_name, check_in_date: nextCheckIn, check_out_date: nextCheckOut } : item));
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="calendar-shell card section-gap">
        <div className="card-pad">
          <div className="inline" style={{ justifyContent: 'space-between' }}>
            <div>
              <h2 className="heading-md">Drag-and-drop operations calendar</h2>
              <div className="text-muted">Drag a reservation to another room/date cell. The API rejects overlaps automatically.</div>
            </div>
          </div>
        </div>
        <div className="calendar-grid">
          <div className="calendar-header">
            <div className="calendar-room"><strong>Inventory</strong></div>
            {days.map((day) => (
              <div key={day.toISOString()}>
                <strong>{format(day, 'EEE')}</strong>
                <div className="calendar-date">{format(day, 'MMM d')}</div>
              </div>
            ))}
          </div>
          {rooms.map((room) => {
            const roomBookings = items.filter((b) => b.inventory_id === room.id && b.status !== 'cancelled');
            return (
              <div key={room.id} className="calendar-row" style={{ position: 'relative' }}>
                <div className="calendar-room">
                  <strong>{room.name}</strong>
                  <div className="small text-muted">{room.room_type}</div>
                </div>
                {days.map((day) => (
                  <DropCell key={day.toISOString()} roomId={room.id} date={format(day, 'yyyy-MM-dd')} />
                ))}
                {roomBookings.map((booking) => {
                  const startIndex = Math.max(0, Math.floor((new Date(booking.check_in_date).getTime() - startDate.getTime()) / 86400000));
                  const span = Math.max(1, Math.floor((new Date(booking.check_out_date).getTime() - new Date(booking.check_in_date).getTime()) / 86400000));
                  if (startIndex > 13 || startIndex + span < 0) return null;
                  return <DraggableChip key={booking.id} booking={booking} startIndex={startIndex} span={span} />;
                })}
              </div>
            );
          })}
        </div>
      </div>
    </DndContext>
  );
}
