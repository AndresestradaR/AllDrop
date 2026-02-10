-- Import bundles: temporary storage for sections sent from Estrategas IA to MiniShop editor
create table if not exists import_bundles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  sections jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '24 hours')
);

-- Index for cleanup of expired bundles
create index if not exists idx_import_bundles_expires on import_bundles(expires_at);

-- RLS: owner can read/write their own bundles, public can read by ID (for MiniShop to fetch)
alter table import_bundles enable row level security;

create policy "Users can insert their own bundles"
  on import_bundles for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can read their own bundles"
  on import_bundles for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Service role can read any bundle"
  on import_bundles for select
  to service_role
  using (true);

create policy "Anon can read bundles by ID"
  on import_bundles for select
  to anon
  using (true);
