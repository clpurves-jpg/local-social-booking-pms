import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { overlaps } from '@/lib/pricing';

const schema = z.object({
  booking_id: z.string().uuid(),
});

const HOLD_WINDOW_MS = 15 * 60 * 1000;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable.');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-02-24.acacia',
});

function getBaseUrl() {
  return (
    process.env.BOOKING_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://book.riversendstay.com'
  );
}

function isExpiredHold(holdExpiresAt: string | null | undefined, now: Date) {
  if (!holdExpiresAt) return false;
  return new Date(holdExpiresAt).getTime() < now.getTime();
}

function isExpiredCheckoutHold(createdAt: string | null | undefined, now: Date) {
  if (!createdAt) return true;
  const created = new Date(createdAt);
  return now.getTime() - created.getTime() > HOLD_WINDOW_MS;
}

async function cleanupExpiredHoldsAndBlocks(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: expiredHolds, error: expiredHoldsError } = await supabase
    .from('bookings')
    .select('id')
    .eq('status', 'hold')
    .lt('hold_expires_at', nowIso);

  if (expiredHoldsError) {
    throw new Error(`Failed cleaning expired holds: ${expiredHoldsError.message}`);
  }

  if ((expiredHolds ?? []).length > 0) {
    const expiredHoldIds = expiredHolds.map((row: { id: string }) => row.id);

    const { error: cancelExpiredHoldsError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        updated_at: nowIso,
      })
      .in('id', expiredHoldIds);

    if (cancelExpiredHoldsError) {
      throw new Error(
        `Failed cancelling expired holds: ${cancelExpiredHoldsError.message}`
      );
    }
  }

  const cutoffIso = new Date(now.getTime() - HOLD_WINDOW_MS).toISOString();

  const { error: deleteExpiredBlocksError } = await supabase
    .from('inventory_blocks')
    .delete()
    .eq('reason', 'checkout_hold')
    .lt('created_at', cutoffIso);

  if (deleteExpiredBlocksError) {
    throw new Error(
      `Failed deleting expired checkout holds: ${deleteExpiredBlocksError.message}`
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    const supabase = getSupabaseAdmin();
    const now = new Date();

    await cleanupExpiredHoldsAndBlocks(supabase);

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        confirmation_code,
        guest_first_name,
        guest_last_name,
        guest_email,
        inventory_id,
        check_in_date,
        check_out_date,
        nights,
        status,
        source,
        hold_expires_at,
        displayed_flat_rate,
        pet_count,
        pet_fee,
        gross_amount,
        inventory_units (
          id,
          name,
          room_type
        )
      `)
      .eq('id', body.booking_id)
      .single();

    if (bookingError) {
      return NextResponse.json(
        { error: 'Failed to load booking.', details: bookingError.message },
        { status: 500 }
      );
    }

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking hold not found.' },
        { status: 404 }
      );
    }

    if (booking.status !== 'hold') {
      return NextResponse.json(
        { error: 'This booking is no longer in hold status.' },
        { status: 409 }
      );
    }

    if (isExpiredHold(booking.hold_expires_at, now)) {
      await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      return NextResponse.json(
        { error: 'This booking hold has expired. Please start again.' },
        { status: 409 }
      );
    }

    const [
      { data: conflictingBookings, error: conflictingBookingsError },
      { data: conflictingBlocks, error: conflictingBlocksError },
    ] = await Promise.all([
      supabase
        .from('bookings')
        .select(
          'id,inventory_id,check_in_date,check_out_date,status,hold_expires_at'
        )
        .eq('inventory_id', booking.inventory_id)
        .neq('id', booking.id)
        .in('status', ['hold', 'confirmed', 'checked_in']),

      supabase
        .from('inventory_blocks')
        .select('id,inventory_id,start_date,end_date,reason,created_at')
        .eq('inventory_id', booking.inventory_id),
    ]);

    if (conflictingBookingsError) {
      return NextResponse.json(
        {
          error: 'Failed to re-check booking conflicts.',
          details: conflictingBookingsError.message,
        },
        { status: 500 }
      );
    }

    if (conflictingBlocksError) {
      return NextResponse.json(
        {
          error: 'Failed to re-check inventory blocks.',
          details: conflictingBlocksError.message,
        },
        { status: 500 }
      );
    }

    const bookingConflict = (conflictingBookings ?? []).some((other: any) => {
      if (other.status === 'hold' && isExpiredHold(other.hold_expires_at, now)) {
        return false;
      }

      return overlaps(
        booking.check_in_date,
        booking.check_out_date,
        other.check_in_date,
        other.check_out_date
      );
    });

    if (bookingConflict) {
      return NextResponse.json(
        { error: 'This room is no longer available for those dates.' },
        { status: 409 }
      );
    }

    const activeBlocks = (conflictingBlocks ?? []).filter((block: any) => {
      if (block.reason !== 'checkout_hold') {
        return true;
      }

      return !isExpiredCheckoutHold(block.created_at, now);
    });

    const blockConflict = activeBlocks.some((block: any) => {
      return overlaps(
        booking.check_in_date,
        booking.check_out_date,
        block.start_date,
        block.end_date
      );
    });

    if (blockConflict) {
      return NextResponse.json(
        { error: 'This room is temporarily unavailable. Please search again.' },
        { status: 409 }
      );
    }

    const refreshedHoldExpiresAt = new Date(
      now.getTime() + HOLD_WINDOW_MS
    ).toISOString();

    const { error: updateHoldError } = await supabase
      .from('bookings')
      .update({
        hold_expires_at: refreshedHoldExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id)
      .eq('status', 'hold');

    if (updateHoldError) {
      return NextResponse.json(
        {
          error: 'Failed to refresh booking hold.',
          details: updateHoldError.message,
        },
        { status: 500 }
      );
    }

    const { data: refreshedBooking, error: refreshedBookingError } = await supabase
      .from('bookings')
      .select('id,status,hold_expires_at')
      .eq('id', booking.id)
      .single();

    if (refreshedBookingError || !refreshedBooking) {
      return NextResponse.json(
        { error: 'Failed to re-check refreshed booking hold.' },
        { status: 500 }
      );
    }

    if (
      refreshedBooking.status !== 'hold' ||
      isExpiredHold(refreshedBooking.hold_expires_at, new Date())
    ) {
      return NextResponse.json(
        { error: 'This booking hold is no longer valid. Please start again.' },
        { status: 409 }
      );
    }

    const { data: existingOwnBlocks, error: existingOwnBlocksError } = await supabase
      .from('inventory_blocks')
      .select('id,created_at')
      .eq('inventory_id', booking.inventory_id)
      .eq('reason', 'checkout_hold')
      .eq('start_date', booking.check_in_date)
      .eq('end_date', booking.check_out_date);

    if (existingOwnBlocksError) {
      return NextResponse.json(
        {
          error: 'Failed to verify checkout hold block.',
          details: existingOwnBlocksError.message,
        },
        { status: 500 }
      );
    }

    const activeOwnBlocks = (existingOwnBlocks ?? []).filter((block: any) => {
      return !isExpiredCheckoutHold(block.created_at, new Date());
    });

    if (activeOwnBlocks.length > 0) {
      return NextResponse.json(
        { error: 'A checkout session is already active for this room. Please wait a moment and try again.' },
        { status: 409 }
      );
    }

    const { error: blockInsertError } = await supabase.from('inventory_blocks').insert({
      inventory_id: booking.inventory_id,
      start_date: booking.check_in_date,
      end_date: booking.check_out_date,
      reason: 'checkout_hold',
    });

    if (blockInsertError) {
      return NextResponse.json(
        {
          error: 'Failed to create checkout hold block.',
          details: blockInsertError.message,
        },
        { status: 500 }
      );
    }

    const baseUrl = getBaseUrl();
    const room = Array.isArray(booking.inventory_units)
      ? booking.inventory_units[0]
      : booking.inventory_units;

    const roomName = room?.name || 'Room';
    const guestName =
      [booking.guest_first_name, booking.guest_last_name].filter(Boolean).join(' ') ||
      'Guest';

    const amountCents = Math.round(Number(booking.gross_amount ?? 0) * 100);
    const petCount = Number((booking as any).pet_count ?? 0);
const petFee = Number((booking as any).pet_fee ?? 0);
const lodgingSubtotal =
  Number(booking.gross_amount ?? 0) - petFee;

    if (!amountCents || amountCents < 50) {
      return NextResponse.json(
        { error: 'Invalid booking total for checkout.' },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_creation: 'always',
      customer_email: booking.guest_email,
      success_url: `${baseUrl}/book/confirmation?booking_id=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/book?booking_id=${booking.id}&cancelled=1`,
      metadata: {
        booking_id: booking.id,
        confirmation_code: booking.confirmation_code ?? '',
        inventory_id: booking.inventory_id,
        source: booking.source ?? '',
      },
      payment_intent_data: {
  setup_future_usage: 'off_session', // ✅ THIS IS THE FIX
  metadata: {
    booking_id: booking.id,
    confirmation_code: booking.confirmation_code ?? '',
    inventory_id: booking.inventory_id,
    source: booking.source ?? '',
  },
},
      line_items: [
  {
    quantity: 1,
    price_data: {
      currency: 'usd',
      unit_amount: Math.round(lodgingSubtotal * 100),
      product_data: {
        name: `${roomName} stay`,
        description: `${booking.check_in_date} to ${booking.check_out_date} · ${booking.nights} night(s) · ${guestName}`,
      },
    },
  },

  ...(petFee > 0
    ? [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(petFee * 100),
            product_data: {
              name: `Pet fee`,
              description: `${petCount} pet${petCount === 1 ? '' : 's'} ($10 each)`,
            },
          },
        },
      ]
    : []),
],
    });

    return NextResponse.json({
      url: session.url,
      session_id: session.id,
    });
  } catch (error) {
    console.error('Create checkout session failed:', error);

    return NextResponse.json(
      {
        error: 'Could not create checkout session.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 400 }
    );
  }
}