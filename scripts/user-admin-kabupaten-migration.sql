alter table if exists public.user_admin
  add column if not exists kabupaten text;

update public.user_admin
set kabupaten = 'tabanan'
where (kabupaten is null or btrim(kabupaten) = '')
  and coalesce(role, '') <> 'super-admin';

update public.user_admin
set kabupaten = null
where role = 'super-admin';

create index if not exists user_admin_kabupaten_idx
  on public.user_admin (kabupaten);
