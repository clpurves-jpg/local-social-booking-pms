import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase'
import { overlaps } from '@/lib/pricing';

export async function POST(request: NextRequest) {
  const { booking_id, inventory_id, check_in_date, check_out_date } = await request.json();
  const supabase = getSupabaseAdmin();
  const [{ data: others }, { data: blocks }] = await Promise.all([
    supabase.from('bookings').select('id,inventory_id,check_in_date,check_out_date,status').eq('inventory_id', inventory_id).neq('id', booking_id).in('status', ['hold', 'confirmed', 'checked_in']),
    supabase.from('inventory_blocks').select('inventory_id,start_date,end_date').eq('inventory_id', inventory_id)
  ]);

  const hasConflict = (others ?? []).some((b: any) => overlaps(check_in_date, check_out_date, b.check_in_date, b.check_out_date)) || (blocks ?? []).some((blk: any) => overlaps(check_in_date, check_out_date, blk.start_date, blk.end_date));
  if (hasConflict) return NextResponse.json({ error: 'Conflict.' }, { status: 409 });

  const { error } = await supabase.from('bookings').update({ inventory_id, check_in_date, check_out_date }).eq('id', booking_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
