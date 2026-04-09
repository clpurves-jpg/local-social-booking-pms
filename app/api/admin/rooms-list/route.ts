import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const BOOKABLE_TYPES = ['room', 'rv', 'rv_spot'];

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('inventory_units')
      .select(
        'id,name,nightly_rate,image_url,description,active,max_guests,inventory_type_code,flat_rate_display,base_rate'
      )
      .in('inventory_type_code', BOOKABLE_TYPES)
      .order('inventory_type_code', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to load inventory.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ rooms: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to load inventory.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}