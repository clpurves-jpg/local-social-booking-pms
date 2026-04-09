import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { BookingLineItem, Room } from './types';

export const TAX_LOCAL = 0.07;
export const TAX_STATE = 0.015;
export const CC_PERCENT = 0.029;
export const CC_FIXED = 0.3;

export function getNightCount(checkIn: string, checkOut: string) {
  return Math.max(1, differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn)));
}

export function buildLineItems(room: Pick<Room, 'base_rate' | 'flat_rate_display'>, checkIn: string, checkOut: string): {
  nights: number;
  displayTotal: number;
  grossAmount: number;
  items: BookingLineItem[];
} {
  const nights = getNightCount(checkIn, checkOut);
  const roomSubtotal = round(room.base_rate * nights);
  const localTax = round(roomSubtotal * TAX_LOCAL);
  const stateTax = round(roomSubtotal * TAX_STATE);
  const grossAmount = round(roomSubtotal + localTax + stateTax);
  const ccPercentFee = round(grossAmount * CC_PERCENT);
  const ccFixedFee = round(CC_FIXED);
  const net = round(grossAmount - ccPercentFee - ccFixedFee);
  const displayTotal = round(room.flat_rate_display * nights);

  const items: BookingLineItem[] = [
    { line_type: 'room_subtotal', label: 'Room subtotal', amount: roomSubtotal, display_to_guest: false, sort_order: 1 },
    { line_type: 'local_tax', label: 'Local tax 7%', amount: localTax, display_to_guest: false, sort_order: 2 },
    { line_type: 'state_tax', label: 'State tax 1.5%', amount: stateTax, display_to_guest: false, sort_order: 3 },
    { line_type: 'gross_total', label: 'Gross total', amount: grossAmount, display_to_guest: false, sort_order: 4 },
    { line_type: 'cc_percent_fee', label: 'Card processing 2.9%', amount: ccPercentFee, display_to_guest: false, sort_order: 5 },
    { line_type: 'cc_fixed_fee', label: 'Card processing fixed fee', amount: ccFixedFee, display_to_guest: false, sort_order: 6 },
    { line_type: 'net_after_processing', label: 'Net after processing', amount: net, display_to_guest: false, sort_order: 7 }
  ];

  return { nights, displayTotal, grossAmount, items };
}

export function round(n: number) {
  return Math.round(n * 100) / 100;
}

export function overlaps(startA: string, endA: string, startB: string, endB: string) {
  return startA < endB && endA > startB;
}
