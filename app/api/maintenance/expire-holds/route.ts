import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const HOLD_WINDOW_MS = 15 * 60 * 1000;

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return true;
  }

  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date();
    const nowIso = now.toISOString();
    const cutoffIso = new Date(now.getTime() - HOLD_WINDOW_MS).toISOString();

    const { data: expiredHolds, error: expiredHoldsError } = await supabase
      .from('bookings')
      .select('id')
      .eq('status', 'hold')
      .lt('hold_expires_at', nowIso);

    if (expiredHoldsError) {
      return NextResponse.json(
        {
          error: 'Failed to load expired holds.',
          details: expiredHoldsError.message,
        },
        { status: 500 }
      );
    }

    let cancelledHolds = 0;

    if ((expiredHolds ?? []).length > 0) {
      const expiredHoldIds = expiredHolds.map((row: { id: string }) => row.id);

      const { error: cancelError } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          updated_at: nowIso,
        })
        .in('id', expiredHoldIds);

      if (cancelError) {
        return NextResponse.json(
          {
            error: 'Failed to cancel expired holds.',
            details: cancelError.message,
          },
          { status: 500 }
        );
      }

      cancelledHolds = expiredHoldIds.length;
    }

    const { data: expiredBlocks, error: expiredBlocksLookupError } = await supabase
      .from('inventory_blocks')
      .select('id')
      .eq('reason', 'checkout_hold')
      .lt('created_at', cutoffIso);

    if (expiredBlocksLookupError) {
      return NextResponse.json(
        {
          error: 'Failed to load expired checkout blocks.',
          details: expiredBlocksLookupError.message,
        },
        { status: 500 }
      );
    }

    let deletedBlocks = 0;

    if ((expiredBlocks ?? []).length > 0) {
      const expiredBlockIds = expiredBlocks.map((row: { id: string }) => row.id);

      const { error: deleteBlocksError } = await supabase
        .from('inventory_blocks')
        .delete()
        .in('id', expiredBlockIds);

      if (deleteBlocksError) {
        return NextResponse.json(
          {
            error: 'Failed to delete expired checkout blocks.',
            details: deleteBlocksError.message,
          },
          { status: 500 }
        );
      }

      deletedBlocks = expiredBlockIds.length;
    }

    return NextResponse.json({
      ok: true,
      cancelled_holds: cancelledHolds,
      deleted_checkout_blocks: deletedBlocks,
      ran_at: nowIso,
    });
  } catch (error) {
    console.error('Expire holds maintenance failed:', error);

    return NextResponse.json(
      {
        error: 'Expire holds maintenance failed.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}