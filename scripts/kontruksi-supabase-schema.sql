create table if not exists public.kontruksi_design_uploads (
  id uuid primary key default gen_random_uuid(),
  fb_doc_id text unique not null,
  file_name text,
  sheet_name text,
  uploaded_by_id text,
  uploaded_by_name text,
  zones jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kontruksi_design_tasks (
  id uuid primary key default gen_random_uuid(),
  fb_doc_id text unique not null,
  assignee_id text,
  assignee_name text,
  design_upload_id text,
  zones jsonb not null default '[]'::jsonb,
  status text,
  created_by_id text,
  created_by_name text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kontruksi_submissions (
  id uuid primary key default gen_random_uuid(),
  fb_doc_id text unique not null,
  source_task_id text,
  submitted_by_id text,
  submitted_by_name text,
  nama_titik text,
  id_titik text,
  zona text,
  stage text,
  status text,
  latitude double precision,
  longitude double precision,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kontruksi_valid (
  id uuid primary key default gen_random_uuid(),
  fb_doc_id text unique not null,
  source_submission_id text,
  source_task_id text,
  submitted_by_id text,
  submitted_by_name text,
  nama_titik text,
  id_titik text,
  zona text,
  stage text,
  status text,
  latitude double precision,
  longitude double precision,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz,
  updated_at timestamptz not null default now(),
  validated_at timestamptz not null default now()
);

create table if not exists public.kontruksi_rejected (
  id uuid primary key default gen_random_uuid(),
  fb_doc_id text unique not null,
  source_submission_id text,
  source_task_id text,
  submitted_by_id text,
  submitted_by_name text,
  nama_titik text,
  id_titik text,
  zona text,
  stage text,
  status text,
  reject_reason text,
  rejected_by_id text,
  rejected_by_name text,
  latitude double precision,
  longitude double precision,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz,
  updated_at timestamptz not null default now(),
  rejected_at timestamptz not null default now()
);

create index if not exists kontruksi_design_tasks_assignee_idx on public.kontruksi_design_tasks (assignee_id, created_at desc);
create index if not exists kontruksi_submissions_owner_idx on public.kontruksi_submissions (submitted_by_id, created_at desc);
create index if not exists kontruksi_valid_owner_idx on public.kontruksi_valid (submitted_by_id, validated_at desc);
create index if not exists kontruksi_valid_updated_idx on public.kontruksi_valid (updated_at desc);
