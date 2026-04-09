'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '../../lib/auth';
import { getSupabaseAdmin } from '../../lib/supabase';

export async function updateInventoryUnit(formData: FormData) {
  await requireRole(['admin']);

  const supabase = getSupabaseAdmin();

  const id = String(formData.get('id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const roomType = String(formData.get('room_type') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim();
  const nightlyRateRaw = String(formData.get('nightly_rate') ?? '').trim();
  const sortOrderRaw = String(formData.get('sort_order') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const imageUrl = String(formData.get('image_url') ?? '').trim();
  const isActiveRaw = String(formData.get('is_active') ?? '').trim();

  if (!id) {
    throw new Error('Missing room id.');
  }

  if (!name) {
    throw new Error('Room name is required.');
  }

  const nightlyRate =
    nightlyRateRaw === '' ? 0 : Number.parseFloat(nightlyRateRaw);

  if (Number.isNaN(nightlyRate) || nightlyRate < 0) {
    throw new Error('Nightly rate must be a valid number.');
  }

  const sortOrder =
    sortOrderRaw === '' ? null : Number.parseInt(sortOrderRaw, 10);

  if (sortOrderRaw !== '' && (sortOrder === null || Number.isNaN(sortOrder))) {
    throw new Error('Sort order must be a whole number.');
  }

  const isActive = isActiveRaw === 'true';

  const { data: existingRow, error: loadError } = await supabase
    .from('inventory_units')
    .select('*')
    .eq('id', id)
    .single();

  if (loadError || !existingRow) {
    throw new Error(
      `Failed to load room before update: ${loadError?.message ?? 'Room not found.'}`
    );
  }

  const updatePayload: Record<string, any> = {};

  if ('name' in existingRow) {
    updatePayload.name = name;
  }

  if ('room_type' in existingRow) {
    updatePayload.room_type = roomType || null;
  }

  if ('slug' in existingRow) {
    updatePayload.slug = slug || null;
  }

  if ('nightly_rate' in existingRow) {
  updatePayload.nightly_rate = nightlyRate;
}

if ('flat_rate_display' in existingRow) {
  updatePayload.flat_rate_display = nightlyRate;
}

if ('base_rate' in existingRow) {
  updatePayload.base_rate = nightlyRate;
}

if ('price' in existingRow) {
  updatePayload.price = nightlyRate;
}

  if ('sort_order' in existingRow) {
    updatePayload.sort_order = sortOrder;
  }

  if ('description' in existingRow) {
    updatePayload.description = description || null;
  }

  if ('image_url' in existingRow) {
    updatePayload.image_url = imageUrl || null;
  }

  if ('is_active' in existingRow) {
    updatePayload.is_active = isActive;
  } else if ('active' in existingRow) {
    updatePayload.active = isActive;
  } else if ('enabled' in existingRow) {
    updatePayload.enabled = isActive;
  }

  if ('updated_at' in existingRow) {
    updatePayload.updated_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from('inventory_units')
    .update(updatePayload)
    .eq('id', id);

  if (updateError) {
    throw new Error(`Failed to update room: ${updateError.message}`);
  }

  revalidatePath('/admin/rooms');
  revalidatePath('/desk/rooms');
  revalidatePath('/desk/housekeeping');
  revalidatePath('/book');
}
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function refundBookingAction(formData: FormData) {
  await requireRole(['admin']);

  const supabase = getSupabaseAdmin();

  const bookingId = String(formData.get('booking_id') || '');
  const refundAmountRaw = formData.get('refund_amount');

  if (!bookingId) {
    throw new Error('Missing booking id');
  }

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('*')
    .eq('booking_id', bookingId)
    .single();

  if (paymentError || !payment) {
    throw new Error('Payment not found');
  }

  if (!payment.provider_payment_intent_id) {
    throw new Error('No payment intent found');
  }

  const refundAmount = refundAmountRaw
    ? Math.round(Number(refundAmountRaw) * 100)
    : null;

  await stripe.refunds.create({
    payment_intent: payment.provider_payment_intent_id,
    amount: refundAmount || undefined,
  });

  await supabase
    .from('payments')
    .update({ status: 'refunded' })
    .eq('id', payment.id);

  await supabase
    .from('bookings')
    .update({
      status: 'refunded',
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId);

  revalidatePath('/admin/bookings');
  revalidatePath('/admin/reports');
}
export async function cancelBookingAction(formData: FormData) {
  await requireRole(['admin']);

  const supabase = getSupabaseAdmin();

  const bookingId = String(formData.get('booking_id') || '').trim();

  if (!bookingId) {
    throw new Error('Missing booking id');
  }

  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId);

  if (error) {
    throw new Error(`Failed to cancel booking: ${error.message}`);
  }

  revalidatePath('/admin/bookings');
  revalidatePath('/admin/reports');
  revalidatePath('/admin/reports/taxes');
  revalidatePath('/desk/bookings');
}