create table if not exists public.mst_gudang_material (
  fb_doc_id text primary key,
  kode_barang text not null,
  nama_barang text not null,
  kategori text not null check (kategori in ('TIANG', 'LAMPU', 'ARM', 'KABEL')),
  -- Inventaris perusahaan dicatat per unit; setiap baris selalu mewakili satu barang.
  stok_tersedia integer not null default 1 check (stok_tersedia = 1),
  stok_minimum integer not null default 0,
  lokasi_gudang text not null default 'Gudang Utama',
  foto_label text null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists mst_gudang_material_kode_barang_idx
  on public.mst_gudang_material (kode_barang);

create unique index if not exists mst_gudang_material_nomor_seri_idx
  on public.mst_gudang_material ((lower(raw_payload ->> 'nomorSeri')))
  where coalesce(raw_payload ->> 'nomorSeri', '') <> '';

do $$
begin
  alter table public.mst_gudang_material
    drop constraint if exists mst_gudang_material_kategori_check;
  alter table public.mst_gudang_material
    add constraint mst_gudang_material_kategori_check
    check (kategori in ('TIANG', 'LAMPU', 'ARM', 'KABEL'));
end $$;

-- Menyamakan data lama dengan model satu baris = satu unit.
update public.mst_gudang_material
set stok_tersedia = 1,
    stok_minimum = 0,
    raw_payload = jsonb_set(
      jsonb_set(raw_payload, '{stokTersedia}', '1'::jsonb, true),
      '{stokMinimum}', '0'::jsonb, true
    ),
    updated_at = now()
where stok_tersedia <> 1 or stok_minimum <> 0;

create table if not exists public.log_inventory_trxs (
  fb_doc_id text primary key,
  material_id text not null references public.mst_gudang_material (fb_doc_id) on delete cascade,
  material_name text not null,
  tipe_transaksi text not null check (tipe_transaksi in ('MASUK', 'KELUAR', 'MUTASI', 'RETUR', 'BOOKED')),
  jumlah integer not null default 0,
  id_referensi text null,
  source_module text not null default 'Gudang',
  status text not null default 'Posted',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists log_inventory_trxs_material_id_idx
  on public.log_inventory_trxs (material_id);

create table if not exists public.gudang_material_requests (
  fb_doc_id text primary key,
  material_id text not null,
  material_name text not null,
  quantity integer not null default 1,
  request_type text not null check (request_type in ('Pengajuan Barang', 'Peminjaman BMD')),
  requester_id text not null,
  requester_name text not null,
  note text null,
  status text not null default 'Diajukan' check (status in ('Diajukan', 'Diproses', 'Disetujui', 'Dikeluarkan', 'Selesai', 'Ditolak')),
  location_hint text null,
  source_report_id text null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gudang_material_requests_requester_id_idx
  on public.gudang_material_requests (requester_id);

alter table public.gudang_material_requests
  add column if not exists source_report_id text null;

create index if not exists gudang_material_requests_source_report_id_idx
  on public.gudang_material_requests (source_report_id);

do $$
begin
  alter table public.gudang_material_requests
    drop constraint if exists gudang_material_requests_status_check;
  alter table public.gudang_material_requests
    add constraint gudang_material_requests_status_check
    check (status in ('Diajukan', 'Diproses', 'Disetujui', 'Dikeluarkan', 'Selesai', 'Ditolak'));
end $$;

create table if not exists public.bmd_assets (
  fb_doc_id text primary key,
  nomor_register text not null,
  nama_aset text not null,
  kategori text not null,
  kondisi text not null default 'Baik' check (kondisi in ('Baik', 'Rusak Ringan', 'Rusak Berat')),
  status_keberadaan text not null default 'Di Gudang' check (status_keberadaan in ('Di Gudang', 'Dipinjam', 'Dihapuskan')),
  lokasi text not null default 'Rak BMD A-01',
  peminjam text null default '-',
  estimasi_kembali text null default '-',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bmd_assets_nomor_register_idx
  on public.bmd_assets (nomor_register);

notify pgrst, 'reload schema';
