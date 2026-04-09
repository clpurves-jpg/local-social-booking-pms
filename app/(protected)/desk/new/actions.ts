'use server';

import { redirect } from 'next/navigation';
import { createHash, randomUUID } from 'crypto';
import { requireRole } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

type PaymentOption = 'unpaid' | 'pay_at_property' | 'paid_cash' | 'comp';
type BookingSource = 'website' | 'phone' | 'walk_in' | 'admin';

function goBackWithMessage(message: string): never {
  redirect(`/desk/new?message=${encodeURIComponent(message)}`);
}

function goBackWithError(message: string): never {
  redirect(`/desk/new?error=${encodeURIComponent(message)}`);
}

function normalizeText(value: FormDataEntryValue | null) {
  return String(value || '').trim();
}

function normalizeMoney(value: FormDataEntryValue | null) {
  const parsed = Number(String(value || '').trim());
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function nightsBetween(checkInDate: string, checkOutDate: string) {
  const start = new Date(`${checkInDate}T12:00:00`);
  const end = new Date(`${checkOutDate}T12:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function buildConfirmationCode() {
  const raw = createHash('sha256')
    .update(`${randomUUID()}-${Date.now()}`)
    .digest('hex')
    .slice(0, 6)
    .toUpperCase();

  return `REL-${raw}`;
}

function buildWalkInPlaceholderEmail() {
  return 'walkin@riversendstay.com';
}

export async function createDeskBooking(formData: FormData) {
  await requireRole(['desk', 'admin']);

  const supabase = getSupabaseAdmin();
  const vehiclePlate = String(formData.get('vehicle_plate') || '').trim();
  const guestFirstName = normalizeText(formData.get('guest_first_name'));
  const guestLastName = normalizeText(formData.get('guest_last_name'));
  const guestEmailInput = normalizeText(formData.get('guest_email'));
  const guestPhone = normalizeText(formData.get('guest_phone'));
  const inventoryId = normalizeText(formData.get('inventory_id'));
  const checkInDate = normalizeText(formData.get('check_in_date'));
  const checkOutDate = normalizeText(formData.get('check_out_date'));
  const nightlyRate = normalizeMoney(formData.get('nightly_rate'));
  const paymentOption = normalizeText(formData.get('payment_option')) as PaymentOption;
  const source = normalizeText(formData.get('source')) as BookingSource;
  const specialRequests = normalizeText(formData.get('special_requests'));
  const internalNotes = normalizeText(formData.get('internal_notes'));
  const checkInNow = formData.get('check_in_now') === 'on';

  if (!guestFirstName) goBackWithError('First name is required.');
  if (!guestLastName) goBackWithError('Last name is required.');
  if (!inventoryId) goBackWithError('Room is required.');
  if (!checkInDate || !checkOutDate) goBackWithError('Check-in and check-out dates are required.');
  if (nightlyRate <= 0) goBackWithError('Nightly rate must be greater than zero.');

  const nights = nightsBetween(checkInDate, checkOutDate);
  if (nights <= 0) goBackWithError('Check-out must be after check-in.');

  if (!['unpaid', 'pay_at_property', 'paid_cash', 'comp'].includes(paymentOption)) {
    goBackWithError('Choose a valid payment option.');
  }

  if (!['website', 'phone', 'walk_in', 'admin'].includes(source)) {
    goBackWithError('Choose a valid booking source.');
  }

 const nowIso = new Date().toISOString();

const { data: conflictingBookings, error: conflictError } = await supabase
  .from('bookings')
  .select('id, confirmation_code, status, hold_expires_at')
  .eq('inventory_id', inventoryId)
  .not('status', 'in', '("cancelled","refunded","no_show","checked_out")')
  .lt('check_in_date', checkOutDate)
  .gt('check_out_date', checkInDate);

  if (conflictError) {
  console.error('createDeskBooking conflict error:', conflictError);
  goBackWithError('Failed to check room availability.');
}

const activeConflicts = (conflictingBookings ?? []).filter((booking) => {
  if (booking.status !== 'hold') return true;

  if (!booking.hold_expires_at) return true;

  return booking.hold_expires_at > nowIso;
});

if (activeConflicts.length > 0) {
  goBackWithError('This room is already booked for those dates.');
}

  const grossAmount = Number((nightlyRate * nights).toFixed(2));

  let paymentStatus: 'unpaid' | 'pay_at_property' | 'paid' = 'unpaid';
  let balanceDue = grossAmount;
  let extraNotes = internalNotes;

  if (paymentOption === 'pay_at_property') {
    paymentStatus = 'pay_at_property';
    balanceDue = grossAmount;
  }

  if (paymentOption === 'paid_cash') {
    paymentStatus = 'paid';
    balanceDue = 0;
    extraNotes = [internalNotes, 'Paid cash at desk.'].filter(Boolean).join('\n');
  }

  if (paymentOption === 'comp') {
    paymentStatus = 'paid';
    balanceDue = 0;
    extraNotes = [internalNotes, 'Comp booking.'].filter(Boolean).join('\n');
  }

  const status = checkInNow ? 'checked_in' : 'confirmed';
  const checkedInAt = checkInNow ? new Date().toISOString() : null;

  let confirmationCode = buildConfirmationCode();

  for (let attempt = 0; attempt < 3; attempt++) {
   const guestEmail = guestEmailInput || buildWalkInPlaceholderEmail();
   
    const { data: insertedBooking, error: insertError } = await supabase
      .from('bookings')
      .insert({
        confirmation_code: confirmationCode,
        guest_first_name: guestFirstName,
        guest_last_name: guestLastName,
        guest_email: guestEmail,
        guest_phone: guestPhone || null,
        vehicle_plate: vehiclePlate || null,
        inventory_id: inventoryId,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        nights,
        status,
        source,
        displayed_flat_rate: nightlyRate,
        gross_amount: grossAmount,
        payment_status: paymentStatus,
        balance_due: balanceDue,
        checked_in_at: checkedInAt,
        checked_out_at: null,
        special_requests: specialRequests || null,
        internal_notes: extraNotes || null,
        hold_expires_at: null,
      })
      .select('id, confirmation_code')
      .single();

    if (!insertError && insertedBooking) {
      if (checkInNow) {
        const { error: roomStatusError } = await supabase
          .from('inventory_units')
          .update({ room_status: 'inspected' })
          .eq('id', inventoryId);

        if (roomStatusError) {
          console.error('createDeskBooking room status error:', roomStatusError);
        }
      }

      redirect(
        `/desk/bookings/${insertedBooking.id}?message=${encodeURIComponent(
          checkInNow
            ? `Booking created and guest checked in. Confirmation #${insertedBooking.confirmation_code}`
            : `Booking created successfully. Confirmation #${insertedBooking.confirmation_code}`
        )}`
      );
    }

    if (insertError?.code === '23505') {
      confirmationCode = buildConfirmationCode();
      continue;
    }

    console.error('createDeskBooking insert error:', insertError);
    goBackWithError(`Failed to create booking: ${insertError?.message || 'Unknown error'}`);
  }

  goBackWithError('Failed to generate a unique confirmation code. Try again.');
}