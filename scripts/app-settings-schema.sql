create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists app_settings_updated_at_idx
  on public.app_settings (updated_at desc);
