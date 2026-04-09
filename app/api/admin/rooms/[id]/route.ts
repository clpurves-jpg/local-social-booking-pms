import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  nightly_rate: z.coerce.number().min(0).nullable().optional(),
  image_url: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
});

const BOOKABLE_TYPES = ['room', 'rv', 'rv_spot'];

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = schema.parse(await request.json());
    const supabase = getSupabaseAdmin();

   const normalizedNightlyRate =
  body.nightly_rate === null || Number.isNaN(body.nightly_rate)
    ? null
    : body.nightly_rate;

const payload = {
  name: body.name.trim(),
  nightly_rate: normalizedNightlyRate,
  flat_rate_display: normalizedNightlyRate,
  base_rate: normalizedNightlyRate,
  image_url: body.image_url?.trim() ? body.image_url.trim() : null,
  description: body.description?.trim() ? body.description.trim() : null,
  updated_at: new Date().toISOString(),
};

    const { data, error } = await supabase
      .from('inventory_units')
      .update(payload)
      .eq('id', id)
      .in('inventory_type_code', BOOKABLE_TYPES)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update inventory item.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ room: data });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Invalid inventory update request.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 400 }
    );
  }
}