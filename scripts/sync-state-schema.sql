create table if not exists public.sync_state (
  collection_key text primary key,
  last_synced_at timestamptz,
  last_run_at timestamptz,
  last_mode text,
  status text,
  message text,
  total_rows integer default 0,
  updated_at timestamptz default now()
);
