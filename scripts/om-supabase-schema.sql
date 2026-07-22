create table if not exists public.om_reports (
  id uuid primary key default gen_random_uuid(),
  fb_doc_id text unique not null,
  title text not null,
  description text,
  report_type text,
  location text,
  reporter_uid text,
  reporter_name text,
  reporter_role text,
  status text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  fb_doc_id text unique not null,
  title text not null,
  message text,
  category text,
  source text,
  report_id text,
  target_roles jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists om_reports_reporter_idx on public.om_reports (reporter_uid, created_at desc);
create index if not exists om_reports_status_idx on public.om_reports (status, created_at desc);
create index if not exists app_notifications_source_idx on public.app_notifications (source, created_at desc);

-- Satu modul ECM & History: satu panel/smart meter untuk setiap grup APJ.
create table if not exists public.om_ecm_panels (
  id uuid primary key default gen_random_uuid(),
  fb_doc_id text unique not null,
  group_id text unique not null,
  group_name text not null,
  panel_name text not null,
  smart_meter_serial text,
  mqtt_topic text,
  status text not null default 'belum-terhubung',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.om_ecm_readings (
  id uuid primary key default gen_random_uuid(),
  fb_doc_id text unique not null,
  panel_id text not null references public.om_ecm_panels (fb_doc_id) on delete cascade,
  group_id text not null,
  sampled_at timestamptz not null,
  interval_start timestamptz not null,
  voltage numeric,
  current_ampere numeric,
  power_kw numeric,
  energy_kwh numeric,
  power_factor numeric,
  frequency_hz numeric,
  status text not null default 'normal',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (panel_id, interval_start)
);

create table if not exists public.om_asset_history (
  id uuid primary key default gen_random_uuid(),
  fb_doc_id text unique not null,
  group_id text not null,
  asset_type text not null check (asset_type in ('panel', 'lampu')),
  asset_id text not null,
  event_type text not null,
  description text,
  source text not null default 'O&M',
  raw_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists om_ecm_readings_group_time_idx on public.om_ecm_readings (group_id, sampled_at desc);
create index if not exists om_asset_history_group_time_idx on public.om_asset_history (group_id, occurred_at desc);

alter table public.om_ecm_panels enable row level security;
alter table public.om_ecm_readings enable row level security;
alter table public.om_asset_history enable row level security;

notify pgrst, 'reload schema';
