import { BookingForm } from '@/components/BookingForm';
import { SectionCard } from '@/components/SectionCard';
import { getSupabaseAdmin } from "../../lib/supabase";
export const dynamic = 'force-dynamic';

const BOOKABLE_TYPES = ['room', 'rv', 'rv_spot'];

export default async function BookPage() {
  const supabase = getSupabaseAdmin();

  const { data: rooms, error } = await supabase
    .from('inventory_units')
    .select(
      'id,name,slug,inventory_type_code,room_number,room_type,description,max_guests,bed_summary,flat_rate_display,base_rate,nightly_rate,active,sort_order,cover_image_url,image_url'
    )
    .eq('active', true)
    .in('inventory_type_code', BOOKABLE_TYPES)
    .order('inventory_type_code')
    .order('sort_order');

  if (error) {
    console.error('Failed to load inventory for booking page:', error);
  }

  return (
    <div>
      <SectionCard
        title="Book your stay"
        subtitle="Flat guest pricing only. Taxes and fees are included in the rate shown."
      >
        <BookingForm rooms={(rooms ?? []) as any} />
      </SectionCard>
    </div>
  );
}