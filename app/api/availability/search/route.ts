import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { overlaps } from '@/lib/pricing';

const schema = z.object({
  check_in: z.string().min(10),
  check_out: z.string().min(10),
  guests: z.number().int().min(1),
});

const HOLD_WINDOW_MS = 15 * 60 * 1000;
const BOOKABLE_TYPES = ['room', 'rv', 'rv_spot'];

function isValidDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
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

    await cleanupExpiredHoldsAndBlocks(supabase);

    const [
      { data: units, error: unitsError },
      { data: bookings, error: bookingsError },
      { data: blocks, error: blocksError },
    ] = await Promise.all([
      supabase
        .from('inventory_units')
        .select(
          'id,name,slug,inventory_type_code,room_number,room_type,description,max_guests,bed_summary,flat_rate_display,base_rate,nightly_rate,active,sort_order,cover_image_url,image_url'
        )
        .eq('active', true)
        .in('inventory_type_code', BOOKABLE_TYPES)
        .gte('max_guests', body.guests)
        .order('inventory_type_code')
        .order('sort_order'),

      supabase
        .from('bookings')
        .select(
          'id,inventory_id,check_in_date,check_out_date,status,hold_expires_at'
        )
        .in('status', ['hold', 'confirmed', 'checked_in']),

      supabase
        .from('inventory_blocks')
        .select('inventory_id,start_date,end_date,reason,created_at'),
    ]);

    if (unitsError) {
      return NextResponse.json(
        { error: 'Failed to load inventory.', details: unitsError.message },
        { status: 500 }
      );
    }

    if (bookingsError) {
      return NextResponse.json(
        { error: 'Failed to load bookings.', details: bookingsError.message },
        { status: 500 }
      );
    }

    if (blocksError) {
      return NextResponse.json(
        { error: 'Failed to load inventory blocks.', details: blocksError.message },
        { status: 500 }
      );
    }

    const available = (units ?? []).filter((unit: any) => {
      const hasBookingConflict = (bookings ?? []).some((booking: any) => {
        if (booking.inventory_id !== unit.id) return false;

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

      if (hasBookingConflict) {
        return false;
      }

      const hasBlockConflict = (blocks ?? []).some((block: any) => {
        if (block.inventory_id !== unit.id) return false;

        if (
          block.reason === 'checkout_hold' &&
          isExpiredCheckoutHold(block.created_at, now)
        ) {
          return false;
        }

        return overlaps(
          body.check_in,
          body.check_out,
          block.start_date,
          block.end_date
        );
      });

      return !hasBlockConflict;
    });

    return NextResponse.json({ rooms: available });
  } catch (error) {
    console.error('Availability search failed:', error);

    return NextResponse.json(
      {
        error: 'Invalid availability request.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 400 }
    );
  }
}