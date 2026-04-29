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
