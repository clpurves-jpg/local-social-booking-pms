import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '../../../../lib/supabase';
import { overlaps } from '@/lib/pricing';

const PET_FEE_PER_PET = 10;

const schema = z.object({
  room_id: z.string().uuid(),
  check_in: z.string().min(10),
  check_out: z.string().min(10),
  guest_email: z.string().email(),
  guest_name: z.string().min(2),
  guest_phone: z.string().nullable().optional(),
  pet_count: z.number().int().min(0).max(10).optional(),
});

const HOLD_WINDOW_MS = 15 * 60 * 1000;

/**
 * Optional override for testing:
 * - leave blank / undefined to use real Supabase pricing
 * - set to "1" in env if you intentionally want the whole booking to total $1
 */
const testBookingTotalDollars = Number(
  process.env.BOOKING_TEST_TOTAL_DOLLARS ?? ''
);

function isValidDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function splitGuestName(fullName: string) {
  const cleaned = fullName.trim().replace(/\s+/g, ' ');
  const parts = cleaned.split(' ').filter(Boolean);

  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function nightsBetween(checkIn: string, checkOut: string) {
  const start = new Date(`${checkIn}T00:00:00.000Z`);
  const end = new Date(`${checkOut}T00:00:00.000Z`);
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

function makeConfirmationCode() {
  const part = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `REL-${part}`;
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

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function cleanupExpiredHoldsAndBlocks(
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
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
    const petCount = body.pet_count ?? 0;

    if (!isValidDateString(body.check_in) || !isValidDateString(body.check_out)) {
      return NextResponse.json(
        { error: 'Invalid dates supplied.' },
        { status: 400 }
      );
    }

    if (body.check_out <= body.check_in) {
      return NextResponse.json(
        { error: 'Check-out must be after check-in.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const now = new Date();
    const holdExpiresAt = new Date(now.getTime() + HOLD_WINDOW_MS).toISOString();

    await cleanupExpiredHoldsAndBlocks(supabase);

    const { data: room, error: roomError } = await supabase
      .from('inventory_units')
      .select(
        'id,name,inventory_type_code,active,nightly_rate,flat_rate_display,base_rate,max_guests'
      )
      .eq('id', body.room_id)
      .maybeSingle();

    if (roomError) {
      return NextResponse.json(
        { error: 'Failed to load room.', details: roomError.message },
        { status: 500 }
      );
    }

    if (
      !room ||
      !room.active ||
      !['room', 'rv_spot'].includes(String(room.inventory_type_code))
    ) {
      return NextResponse.json(
        { error: 'Selected unit is not available.' },
        { status: 404 }
      );
    }

    const [
      { data: conflictingBookings, error: bookingsError },
      { data: conflictingBlocks, error: blocksError },
    ] = await Promise.all([
      supabase
        .from('bookings')
        .select(
          'id,inventory_id,check_in_date,check_out_date,status,hold_expires_at'
        )
        .eq('inventory_id', body.room_id)
        .in('status', ['hold', 'confirmed', 'checked_in']),

      supabase
        .from('inventory_blocks')
        .select('inventory_id,start_date,end_date,reason,created_at')
        .eq('inventory_id', body.room_id),
    ]);

    if (bookingsError) {
      return NextResponse.json(
        {
          error: 'Failed to validate unit availability.',
          details: bookingsError.message,
        },
        { status: 500 }
      );
    }

    if (blocksError) {
      return NextResponse.json(
        {
          error: 'Failed to validate unit blocks.',
          details: blocksError.message,
        },
        { status: 500 }
      );
    }

    const bookingConflict = (conflictingBookings ?? []).some((booking: any) => {
      if (booking.status === 'hold' && isExpiredHold(booking.hold_expires_at, now)) {
        return false;
      }

      return overlaps(
        body.check_in,
        body.check_out,
        booking.check_in_date,
        booking.check_out_date
      );
    });

    if (bookingConflict) {
      return NextResponse.json(
        { error: 'That unit is no longer available for those dates.' },
        { status: 409 }
      );
    }

    const blockConflict = (conflictingBlocks ?? []).some((block: any) => {
      if (block.reason === 'checkout_hold' && isExpiredCheckoutHold(block.created_at, now)) {
        return false;
      }

      return overlaps(
        body.check_in,
        body.check_out,
        block.start_date,
        block.end_date
      );
    });

    if (blockConflict) {
      return NextResponse.json(
        { error: 'That unit is temporarily unavailable for those dates.' },
        { status: 409 }
      );
    }

    const { firstName, lastName } = splitGuestName(body.guest_name);
    const nights = nightsBetween(body.check_in, body.check_out);

    const nightlyRate =
      asNumber((room as any).nightly_rate) ??
      asNumber((room as any).flat_rate_display) ??
      asNumber((room as any).base_rate);

    if (!nightlyRate || nightlyRate <= 0) {
      return NextResponse.json(
        { error: 'This unit does not have a valid nightly rate configured.' },
        { status: 400 }
      );
    }

    const lodgingSubtotal = Number((nightlyRate * nights).toFixed(2));
const petFee = Number((petCount * PET_FEE_PER_PET).toFixed(2));
const realGrossAmount = Number((lodgingSubtotal + petFee).toFixed(2));

const useTestOverride =
  Number.isFinite(testBookingTotalDollars) && testBookingTotalDollars > 0;

const grossAmount = useTestOverride
  ? Number(testBookingTotalDollars.toFixed(2))
  : realGrossAmount;

    const insertPayload = {
  confirmation_code: makeConfirmationCode(),
  guest_first_name: firstName,
  guest_last_name: lastName,
  guest_email: body.guest_email.trim().toLowerCase(),
  guest_phone: body.guest_phone?.trim() || null,
  inventory_id: body.room_id,
  check_in_date: body.check_in,
  check_out_date: body.check_out,
  nights,
  status: 'hold',
  hold_expires_at: holdExpiresAt,
  displayed_flat_rate: nightlyRate,
  pet_count: petCount,
  pet_fee: petFee,
  gross_amount: grossAmount,
  internal_notes: useTestOverride
    ? `Public booking hold created before Stripe checkout. TEST override total $${grossAmount.toFixed(
        2
      )}. Real calculated total would be $${realGrossAmount.toFixed(
        2
      )}, including pet fee $${petFee.toFixed(2)}.`
    : `Public booking hold created before Stripe checkout using real inventory pricing. Pet fee: $${petFee.toFixed(
        2
      )}.`,
};

    const { data: booking, error: insertError } = await supabase
      .from('bookings')
      .insert(insertPayload)
      .select('*')
      .single();

    if (insertError) {
      return NextResponse.json(
        {
          error: 'Failed to create booking hold.',
          details: insertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      booking,
      hold: booking,
      id: booking.id,
      
        pricing: {
  nightly_rate: nightlyRate,
  nights,
  lodging_subtotal: lodgingSubtotal,
  pet_count: petCount,
  pet_fee: petFee,
  real_gross_amount: realGrossAmount,
  charged_gross_amount: grossAmount,
  test_override_active: useTestOverride,
},
  });

  } catch (error) {
    console.error('Booking hold failed:', error);

    return NextResponse.json(
      {
        error: 'Invalid booking hold request.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 400 }
    );
  }
}