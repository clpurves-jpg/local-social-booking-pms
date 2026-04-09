'use server';

import Stripe from 'stripe';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

type BookingCheckInRow = {
  id: string;
  payment_status: string | null;
  balance_due: number | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
};

type BookingCheckOutRow = {
  id: string;
  inventory_id: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
};

type BookingPaidCashRow = {
  id: string;
  checked_out_at: string | null;
  payment_status: string | null;
  balance_due: number | null;
};

type BookingCancelRow = {
  id: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  status: string | null;
};

type BookingRefundRow = {
  id: string;
  gross_amount: number | null;
  refunded_amount: number | null;
  payment_status: string | null;
  stripe_payment_intent_id: string | null;
  checked_out_at: string | null;
};

type InventoryUnitStatus = 'clean' | 'dirty' | 'inspected';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-02-24.acacia',
    })
  : null;

function isPaidInFull(paymentStatus: string | null, balanceDue: number | null) {
  if (paymentStatus === 'paid') return true;
  return Number(balanceDue ?? 0) <= 0;
}

function nightsBetween(checkInDate: string, checkOutDate: string) {
  const start = new Date(`${checkInDate}T12:00:00`);
  const end = new Date(`${checkOutDate}T12:00:00`);
  const diffMs = end.getTime() - start.getTime();
  return Math.round(diffMs / 86400000);
}

function dollarsToCents(amount: number) {
  return Math.round(amount * 100);
}

function goBookingsWithMessage(message: string): never {
  redirect(`/desk/bookings?message=${encodeURIComponent(message)}`);
}

function goBookingsWithError(message: string): never {
  redirect(`/desk/bookings?error=${encodeURIComponent(message)}`);
}

function goBookingDetailsWithMessage(bookingId: string, message: string): never {
  redirect(`/desk/bookings/${bookingId}?message=${encodeURIComponent(message)}`);
}

function goBookingDetailsWithError(bookingId: string, message: string): never {
  redirect(`/desk/bookings/${bookingId}?error=${encodeURIComponent(message)}`);
}

function goRoomsWithMessage(message: string): never {
  redirect(`/desk/rooms?message=${encodeURIComponent(message)}`);
}

function goRoomsWithError(message: string): never {
  redirect(`/desk/rooms?error=${encodeURIComponent(message)}`);
}

async function loadCheckInBooking(bookingId: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('bookings')
    .select('id, payment_status, balance_due, checked_in_at, checked_out_at')
    .eq('id', bookingId)
    .single();

  if (error || !data) {
    console.error('loadCheckInBooking error:', error);
    goBookingsWithError('Failed to load booking.');
  }

  return {
    supabase,
    booking: data as BookingCheckInRow,
  };
}
async function updateRoomStatus(unitId: string, status: 'clean' | 'dirty' | 'inspected') {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('inventory_units')
    .update({
      room_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', unitId);

  if (error) {
    throw new Error(`Failed to update room status: ${error.message}`);
  }
}

export async function checkInBooking(bookingId: string) {
  await requireRole(['desk', 'admin']);

  const { supabase, booking } = await loadCheckInBooking(bookingId);

  if (booking.checked_out_at) {
    goBookingsWithError('Booking is already checked out.');
  }

  if (booking.checked_in_at) {
    goBookingsWithError('Booking is already checked in.');
  }

  const paidInFull = isPaidInFull(booking.payment_status, booking.balance_due);

  if (!paidInFull) {
    goBookingsWithError('Payment is not complete. Use Override Check-In if needed.');
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      checked_in_at: new Date().toISOString(),
      status: 'checked_in',
    })
    .eq('id', bookingId);

  if (updateError) {
    console.error('checkInBooking update error:', updateError);
    goBookingsWithError(`Failed to check in booking: ${updateError.message}`);
  }

  revalidatePath('/desk');
  revalidatePath('/desk/bookings');
  revalidatePath('/desk/rooms');
  revalidatePath('/admin/calendar');

  goBookingsWithMessage('Guest checked in successfully.');
}

export async function overrideCheckInBooking(bookingId: string) {
  await requireRole(['desk', 'admin']);

  const { supabase, booking } = await loadCheckInBooking(bookingId);

  if (booking.checked_out_at) {
    goBookingsWithError('Booking is already checked out.');
  }

  if (booking.checked_in_at) {
    goBookingsWithError('Booking is already checked in.');
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      checked_in_at: new Date().toISOString(),
      status: 'checked_in',
    })
    .eq('id', bookingId);

  if (updateError) {
    console.error('overrideCheckInBooking update error:', updateError);
    goBookingsWithError(`Failed to override check in: ${updateError.message}`);
  }

  revalidatePath('/desk');
  revalidatePath('/desk/bookings');
  revalidatePath('/desk/rooms');
  revalidatePath('/admin/calendar');

  goBookingsWithMessage('Guest checked in with payment override.');
}

export async function checkOutBooking(bookingId: string) {
  await requireRole(['desk', 'admin']);

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('bookings')
    .select('id, inventory_id, checked_in_at, checked_out_at')
    .eq('id', bookingId)
    .single();

  if (error || !data) {
    console.error('checkOutBooking load error:', error);
    goBookingsWithError('Failed to load booking.');
  }

  const booking = data as BookingCheckOutRow;

  if (!booking.checked_in_at) {
    goBookingsWithError('Guest must be checked in before check out.');
  }

  if (booking.checked_out_at) {
    goBookingsWithError('Booking is already checked out.');
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      checked_out_at: new Date().toISOString(),
      status: 'checked_out',
    })
    .eq('id', bookingId);

  if (updateError) {
    console.error('checkOutBooking update error:', updateError);
    goBookingsWithError(`Failed to check out booking: ${updateError.message}`);
  }

  if (booking.inventory_id) {
    try {
      await updateRoomStatus(booking.inventory_id, 'dirty');
    } catch (roomError) {
      console.error('checkOutBooking room status error:', roomError);
      goBookingsWithError('Guest checked out, but room status failed to update.');
    }
  }

  revalidatePath('/desk');
  revalidatePath('/desk/bookings');
  revalidatePath('/desk/rooms');
  revalidatePath('/desk/housekeeping');
  revalidatePath('/admin/calendar');

  goBookingsWithMessage('Guest checked out successfully. Room marked dirty.');
}

export async function markBookingPaidCash(bookingId: string) {
  await requireRole(['desk', 'admin']);

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('bookings')
    .select('id, checked_out_at, payment_status, balance_due')
    .eq('id', bookingId)
    .single();

  if (error || !data) {
    console.error('markBookingPaidCash load error:', error);
    goBookingsWithError('Failed to load booking.');
  }

  const booking = data as BookingPaidCashRow;

  if (booking.checked_out_at) {
    goBookingsWithError('Cannot mark a checked-out booking as paid.');
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      payment_status: 'paid',
      balance_due: 0,
    })
    .eq('id', bookingId);

  if (updateError) {
    console.error('markBookingPaidCash update error:', updateError);
    goBookingsWithError(`Failed to mark booking paid cash: ${updateError.message}`);
  }

  revalidatePath('/desk');
  revalidatePath('/desk/bookings');
  revalidatePath('/admin/calendar');

  goBookingsWithMessage('Booking marked paid cash.');
}

export async function cancelBooking(bookingId: string) {
  await requireRole(['desk', 'admin']);

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('bookings')
    .select('id, checked_in_at, checked_out_at, status')
    .eq('id', bookingId)
    .single();

  if (error || !data) {
    console.error('cancelBooking load error:', error);
    goBookingsWithError('Failed to load booking.');
  }

  const booking = data as BookingCancelRow;

  if (booking.checked_in_at || booking.checked_out_at) {
    goBookingsWithError('Checked-in or completed bookings cannot be cancelled here.');
  }

  if (booking.status === 'cancelled') {
    goBookingsWithMessage('Booking already cancelled.');
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
    })
    .eq('id', bookingId);

  if (updateError) {
    console.error('cancelBooking update error:', updateError);
    goBookingsWithError(`Failed to cancel booking: ${updateError.message}`);
  }

  revalidatePath('/desk');
  revalidatePath('/desk/bookings');
  revalidatePath('/admin/calendar');

  goBookingsWithMessage('Booking cancelled.');
}

export async function markRoomDirty(unitId: string) {
  await requireRole(['desk', 'admin']);

  try {
    await updateRoomStatus(unitId, 'dirty');
  } catch (error) {
    console.error('markRoomDirty error:', error);
    goRoomsWithError('Failed to mark room dirty.');
  }

  revalidatePath('/desk');
  revalidatePath('/desk/rooms');
  goRoomsWithMessage('Room marked dirty.');
}

export async function markRoomClean(unitId: string) {
  await requireRole(['desk', 'admin']);

  try {
    await updateRoomStatus(unitId, 'clean');
  } catch (error) {
    console.error('markRoomClean error:', error);
    goRoomsWithError('Failed to mark room clean.');
  }

  revalidatePath('/desk');
  revalidatePath('/desk/rooms');
  goRoomsWithMessage('Room marked clean.');
}

export async function markRoomInspected(unitId: string) {
  await requireRole(['desk', 'admin']);

  try {
    await updateRoomStatus(unitId, 'inspected');
  } catch (error) {
    console.error('markRoomInspected error:', error);
    goRoomsWithError('Failed to mark room inspected.');
  }

  revalidatePath('/desk');
  revalidatePath('/desk/rooms');
  goRoomsWithMessage('Room marked inspected.');
}

export async function updateBookingDetails(bookingId: string, formData: FormData) {
  await requireRole(['desk', 'admin']);

  const supabase = getSupabaseAdmin();

  const guestFirstName = String(formData.get('guest_first_name') || '').trim();
  const guestLastName = String(formData.get('guest_last_name') || '').trim();
  const guestEmail = String(formData.get('guest_email') || '').trim();
  const guestPhone = String(formData.get('guest_phone') || '').trim();
  const inventoryId = String(formData.get('inventory_id') || '').trim();
  const checkInDate = String(formData.get('check_in_date') || '').trim();
  const checkOutDate = String(formData.get('check_out_date') || '').trim();
  const specialRequests = String(formData.get('special_requests') || '').trim();
  const internalNotes = String(formData.get('internal_notes') || '').trim();

  if (!guestFirstName) {
    goBookingDetailsWithError(bookingId, 'First name is required.');
  }

  if (!guestLastName) {
    goBookingDetailsWithError(bookingId, 'Last name is required.');
  }

  if (!guestEmail) {
    goBookingDetailsWithError(bookingId, 'Email is required.');
  }

  if (!inventoryId) {
    goBookingDetailsWithError(bookingId, 'Room assignment is required.');
  }

  if (!checkInDate || !checkOutDate) {
    goBookingDetailsWithError(bookingId, 'Check-in and check-out dates are required.');
  }

  const nights = nightsBetween(checkInDate, checkOutDate);

  if (nights <= 0) {
    goBookingDetailsWithError(bookingId, 'Check-out must be after check-in.');
  }

  const { data: existingBooking, error: existingBookingError } = await supabase
    .from('bookings')
    .select('id, status, checked_in_at, checked_out_at')
    .eq('id', bookingId)
    .single();

  if (existingBookingError || !existingBooking) {
    console.error('updateBookingDetails existing booking error:', existingBookingError);
    goBookingDetailsWithError(bookingId, 'Failed to load booking.');
  }

  const { data: conflictingBookings, error: conflictError } = await supabase
    .from('bookings')
    .select('id, confirmation_code')
    .eq('inventory_id', inventoryId)
    .neq('id', bookingId)
    .neq('status', 'cancelled')
    .lt('check_in_date', checkOutDate)
    .gt('check_out_date', checkInDate);

  if (conflictError) {
    console.error('updateBookingDetails conflict error:', conflictError);
    goBookingDetailsWithError(bookingId, 'Failed to check room availability.');
  }

  if ((conflictingBookings ?? []).length > 0) {
    goBookingDetailsWithError(
      bookingId,
      'Selected room is already booked for those dates.'
    );
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      guest_first_name: guestFirstName,
      guest_last_name: guestLastName,
      guest_email: guestEmail,
      guest_phone: guestPhone || null,
      inventory_id: inventoryId,
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
      nights,
      special_requests: specialRequests || null,
      internal_notes: internalNotes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId);

  if (updateError) {
    console.error('updateBookingDetails update error:', updateError);
    goBookingDetailsWithError(
      bookingId,
      `Failed to update booking: ${updateError.message}`
    );
  }

  revalidatePath('/desk');
  revalidatePath('/desk/bookings');
  revalidatePath(`/desk/bookings/${bookingId}`);
  revalidatePath('/desk/rooms');
  revalidatePath('/admin/calendar');

  goBookingDetailsWithMessage(bookingId, 'Booking details updated successfully.');
}

export async function refundBooking(bookingId: string, formData: FormData) {
  await requireRole(['desk', 'admin']);

  if (!stripe) {
    goBookingDetailsWithError(bookingId, 'Stripe is not configured on the server.');
  }

  const refundType = String(formData.get('refund_type') || 'full').trim();
  const refundReason = String(formData.get('refund_reason') || 'requested_by_customer').trim();
  const refundAmountRaw = String(formData.get('refund_amount') || '').trim();

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, gross_amount, refunded_amount, payment_status, stripe_payment_intent_id, checked_out_at'
    )
    .eq('id', bookingId)
    .single();

  if (error || !data) {
    console.error('refundBooking load error:', error);
    goBookingDetailsWithError(bookingId, 'Failed to load booking for refund.');
  }

  const booking = data as BookingRefundRow;

  if (!booking.stripe_payment_intent_id) {
    goBookingDetailsWithError(
      bookingId,
      'No Stripe payment intent is stored for this booking.'
    );
  }

  if (booking.payment_status === 'refunded') {
    goBookingDetailsWithError(bookingId, 'This booking is already fully refunded.');
  }

  const grossAmount = Number(booking.gross_amount ?? 0);
  const alreadyRefunded = Number(booking.refunded_amount ?? 0);
  const refundableAmount = grossAmount - alreadyRefunded;

  if (refundableAmount <= 0) {
    goBookingDetailsWithError(bookingId, 'There is no remaining refundable amount.');
  }

  let refundAmount = refundableAmount;

  if (refundType === 'partial') {
    refundAmount = Number(refundAmountRaw);

    if (!refundAmount || Number.isNaN(refundAmount) || refundAmount <= 0) {
      goBookingDetailsWithError(bookingId, 'Enter a valid partial refund amount.');
    }

    if (refundAmount > refundableAmount) {
      goBookingDetailsWithError(
        bookingId,
        `Partial refund cannot exceed ${refundableAmount.toFixed(2)}.`
      );
    }
  }

  try {
    const refund = await stripe.refunds.create({
      payment_intent: booking.stripe_payment_intent_id,
      amount: dollarsToCents(refundAmount),
      reason:
        refundReason === 'duplicate' ||
        refundReason === 'fraudulent' ||
        refundReason === 'requested_by_customer'
          ? refundReason
          : undefined,
      metadata: {
        booking_id: bookingId,
      },
    });

    const newRefundedAmount = Number((alreadyRefunded + refundAmount).toFixed(2));
    const fullyRefunded = newRefundedAmount >= grossAmount;

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        refunded_amount: newRefundedAmount,
        stripe_last_refund_id: refund.id,
        stripe_last_refund_status: refund.status,
        stripe_last_refund_reason: refund.reason ?? refundReason,
        refunded_at: new Date().toISOString(),
        payment_status: fullyRefunded ? 'refunded' : 'partial',
        balance_due: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('refundBooking update error:', updateError);
      goBookingDetailsWithError(
        bookingId,
        `Stripe refund succeeded, but booking update failed: ${updateError.message}`
      );
    }

    revalidatePath('/desk');
    revalidatePath('/desk/bookings');
    revalidatePath(`/desk/bookings/${bookingId}`);
    revalidatePath('/admin/calendar');

    goBookingDetailsWithMessage(
      bookingId,
      fullyRefunded
        ? 'Full refund completed successfully.'
        : 'Partial refund completed successfully.'
    );
  } catch (stripeError: any) {
    console.error('refundBooking stripe error:', stripeError);
    goBookingDetailsWithError(
      bookingId,
      stripeError?.message || 'Stripe refund failed.'
    );
  }
}

export async function createBookingPaymentLink(bookingId: string) {
  await requireRole(['desk', 'admin']);

  if (!stripe) {
    redirect(`/desk/bookings/${bookingId}?error=Stripe not configured`);
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      confirmation_code,
      guest_email,
      payment_status,
      gross_amount,
      balance_due
    `)
    .eq('id', bookingId)
    .single();

  if (error || !data) {
    redirect(`/desk/bookings/${bookingId}?error=Failed to load booking`);
  }

  if (data.payment_status === 'paid') {
    redirect(`/desk/bookings/${bookingId}?error=Already paid`);
  }

  const amount =
    Number(data.balance_due ?? 0) > 0
      ? Number(data.balance_due)
      : Number(data.gross_amount ?? 0);

  if (!amount || amount <= 0) {
    redirect(`/desk/bookings/${bookingId}?error=No amount to charge`);
  }

  const bookingSiteUrl =
    process.env.BOOKING_SITE_URL || 'https://book.riversendstay.com';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: data.guest_email || undefined,
    client_reference_id: bookingId,
    metadata: {
      booking_id: bookingId,
    },
    payment_intent_data: {
      metadata: {
        booking_id: bookingId,
      },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(amount * 100),
          product_data: {
            name: `Reservation #${data.confirmation_code}`,
          },
        },
      },
    ],
    success_url: `${bookingSiteUrl}/book/confirmation?booking_id=${bookingId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${bookingSiteUrl}/book`,
  });

  await supabase
    .from('bookings')
    .update({
      stripe_last_checkout_session_id: session.id,
      stripe_last_checkout_url: session.url,
      stripe_last_checkout_created_at: new Date().toISOString(),
    })
    .eq('id', bookingId);

  revalidatePath(`/desk/bookings/${bookingId}`);

  redirect(`/desk/bookings/${bookingId}?message=Payment link created`);
}

export async function updateRoomStatusAction(formData: FormData) {
  const supabase = await createClient();

  const inventoryId = String(formData.get('inventory_id') ?? '').trim();
  const roomStatus = String(formData.get('room_status') ?? '').trim().toLowerCase();

  if (!inventoryId) {
    throw new Error('Missing inventory_id.');
  }

  if (!['clean', 'dirty', 'inspected'].includes(roomStatus)) {
    throw new Error('Invalid room status.');
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('You must be signed in.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to verify permissions: ${profileError.message}`);
  }

  if (!profile || !['admin', 'desk'].includes(profile.role)) {
    throw new Error('Unauthorized.');
  }

  // ⭐ THIS IS THE IMPORTANT FIX
  const adminSupabase = getSupabaseAdmin();

  const { error } = await adminSupabase
    .from('inventory_units')
    .update({
      room_status: roomStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', inventoryId);

  if (error) {
    throw new Error(`Update failed: ${error.message}`);
  }

  revalidatePath('/desk');
  revalidatePath('/desk/rooms');
  revalidatePath('/desk/housekeeping');
}
