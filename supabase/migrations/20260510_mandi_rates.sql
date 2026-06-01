-- Create mandi_rates table
create table if not exists public.mandi_rates (
    id uuid default gen_random_uuid() primary key,
    crop_name text not null,
    market text not null,
    state text not null,
    price numeric not null,
    trend text default 'stable',
    updated_at timestamp with time zone default now(),
    unique(crop_name, market, state)
);

-- Enable RLS
alter table public.mandi_rates enable row level security;

-- Create policy to allow public read
create policy "Allow public read access"
on public.mandi_rates for select
using (true);
