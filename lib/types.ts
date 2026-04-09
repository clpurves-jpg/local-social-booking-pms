export type BookingStatus = 'hold' | 'confirmed' | 'cancelled' | 'refunded' | 'checked_in' | 'checked_out' | 'no_show';
export type InventoryTypeCode = 'room' | 'rv_spot';

export interface Room {
  id: string;
  name: string;
  slug: string;
  inventory_type_code: InventoryTypeCode;
  room_number: string | null;
  room_type: string;
  description: string | null;
  max_guests: number;
  bed_summary: string | null;
  flat_rate_display: number;
  base_rate: number;
  active: boolean;
  sort_order: number;
  cover_image_url?: string | null;
}

export interface Booking {
  id: string;
  confirmation_code: string;
  guest_first_name: string;
  guest_last_name: string;
  guest_email: string;
  guest_phone: string | null;
  inventory_id: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  status: BookingStatus;
  source: string;
  hold_expires_at: string | null;
  gross_amount: number;
  displayed_flat_rate: number;
  created_at: string;
  inventory_name?: string;
}

export interface BookingLineItem {
  id?: string;
  booking_id?: string;
  line_type: 'room_subtotal' | 'local_tax' | 'state_tax' | 'cc_percent_fee' | 'cc_fixed_fee' | 'gross_total' | 'net_after_processing' | 'discount' | 'manual_adjustment';
  label: string;
  amount: number;
  display_to_guest: boolean;
  sort_order: number;
}
