import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

type Booking = {
  id: string;
  confirmation_code: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  inventory_id: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  gross_amount: number | null;
  payment_status: string | null;
  status: string | null;
};

type Room = {
  id: string;
  name: string | null;
  room_number: string | null;
};

function guestName(b: Booking) {
  const name = [b.guest_first_name, b.guest_last_name].filter(Boolean).join(' ');
  return name || b.guest_email || 'Guest';
}

function escapeCsv(value: unknown) {
  const str = String(value ?? '');
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  const supabase = getSupabaseAdmin();

  const [{ data: bookings, error: bookingsError }, { data: rooms, error: roomsError }] =
    await Promise.all([
      supabase
        .from('bookings')
        .select(
          `
            id,
            confirmation_code,
            guest_first_name,
            guest_last_name,
            guest_email,
            guest_phone,
            inventory_id,
            check_in_date,
            check_out_date,
            gross_amount,
            payment_status,
            status
          `
        )
        .not('status', 'in', '("cancelled","no_show")')
        .order('check_in_date', { ascending: true }),

      supabase
        .from('inventory_units')
        .select('id,name,room_number')
        .eq('active', true)
        .eq('inventory_type_code', 'room'),
    ]);

  if (bookingsError) {
    return NextResponse.json(
      { error: `Failed to load bookings: ${bookingsError.message}` },
      { status: 500 }
    );
  }

  if (roomsError) {
    return NextResponse.json(
      { error: `Failed to load rooms: ${roomsError.message}` },
      { status: 500 }
    );
  }

  const allBookings = (bookings ?? []) as Booking[];
  const allRooms = (rooms ?? []) as Room[];

  const headers = [
    'Confirmation',
    'Guest',
    'Phone',
    'Room',
    'Check In',
    'Check Out',
    'Status',
    'Payment Status',
    'Gross Total',
    'Room Revenue',
    'Local Tax 7%',
    'State Tax 1.5%',
    'Total Tax 8.5%',
    'Card Fee 2.9% + 0.30',
    'Net Deposit',
    'Net Revenue',
  ];

  let totalGross = 0;
  let totalRoomRevenue = 0;
  let totalLocalTax = 0;
  let totalStateTax = 0;
  let totalTax = 0;
  let totalCardFee = 0;
  let totalNetDeposit = 0;
  let totalNetRevenue = 0;

  const rows = allBookings.map((booking) => {
    const gross = Number(booking.gross_amount ?? 0);
    const roomRevenue = gross / 1.085;
    const localTax = roomRevenue * 0.07;
    const stateTax = roomRevenue * 0.015;
    const taxTotal = localTax + stateTax;
    const cardFee = gross * 0.029 + 0.3;
    const netDeposit = gross - cardFee;
    const netRevenue = roomRevenue - cardFee;

    totalGross += gross;
    totalRoomRevenue += roomRevenue;
    totalLocalTax += localTax;
    totalStateTax += stateTax;
    totalTax += taxTotal;
    totalCardFee += cardFee;
    totalNetDeposit += netDeposit;
    totalNetRevenue += netRevenue;

    const room = allRooms.find((r) => r.id === booking.inventory_id);

    return [
      booking.confirmation_code ?? '',
      guestName(booking),
      booking.guest_phone ?? '',
      `${room?.name ?? 'Room'}${room?.room_number ? ` · ${room.room_number}` : ''}`,
      booking.check_in_date ?? '',
      booking.check_out_date ?? '',
      booking.status ?? '',
      booking.payment_status ?? '',
      gross.toFixed(2),
      roomRevenue.toFixed(2),
      localTax.toFixed(2),
      stateTax.toFixed(2),
      taxTotal.toFixed(2),
      cardFee.toFixed(2),
      netDeposit.toFixed(2),
      netRevenue.toFixed(2),
    ];
  });

  rows.push([
    'TOTALS',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    totalGross.toFixed(2),
    totalRoomRevenue.toFixed(2),
    totalLocalTax.toFixed(2),
    totalStateTax.toFixed(2),
    totalTax.toFixed(2),
    totalCardFee.toFixed(2),
    totalNetDeposit.toFixed(2),
    totalNetRevenue.toFixed(2),
  ]);

  const csv = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\n');

  const filename = `reports-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}