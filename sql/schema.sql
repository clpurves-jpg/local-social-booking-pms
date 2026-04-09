create extension if not exists pgcrypto;

create table if not exists inventory_units (
  id uuid primary key default gen_random_uuid(),
  inventory_type_code text not null default 'room' check (inventory_type_code in ('room', 'rv_spot')),
  name text not null,
  slug text not null unique,
  room_number text,
  room_type text not null,
  description text,
  max_guests int not null default 2,
  bed_summary text,
  flat_rate_display numeric(10,2) not null,
  base_rate numeric(10,2) not null,
  active boolean not null default true,
  sort_order int not null default 100,
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists room_images (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references inventory_units(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order int not null default 100,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  confirmation_code text not null unique,
  guest_first_name text not null,
  guest_last_name text not null,
  guest_email text not null,
  guest_phone text,
  inventory_id uuid not null references inventory_units(id),
  check_in_date date not null,
  check_out_date date not null,
  nights int not null,
  status text not null check (status in ('hold','confirmed','cancelled','refunded','checked_in','checked_out','no_show')),
  source text not null default 'website',
  hold_expires_at timestamptz,
  displayed_flat_rate numeric(10,2) not null,
  gross_amount numeric(10,2) not null,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists booking_line_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  line_type text not null,
  label text not null,
  amount numeric(10,2) not null,
  display_to_guest boolean not null default false,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  provider text not null,
  provider_payment_intent_id text,
  provider_checkout_session_id text,
  amount_authorized numeric(10,2) not null default 0,
  amount_captured numeric(10,2) not null default 0,
  currency text not null default 'USD',
  status text not null,
  fee_amount numeric(10,2),
  net_amount numeric(10,2),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists inventory_blocks (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references inventory_units(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists rate_rules (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid references inventory_units(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  nightly_rate numeric(10,2) not null,
  min_stay int not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_bookings_inventory_dates on bookings(inventory_id, check_in_date, check_out_date);
create index if not exists idx_blocks_inventory_dates on inventory_blocks(inventory_id, start_date, end_date);
