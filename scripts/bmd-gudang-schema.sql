create table if not exists public.mst_gudang_material (
  fb_doc_id text primary key,
  kode_barang text not null,
  nama_barang text not null,
  kategori text not null check (kategori in ('TIANG', 'LAMPU', 'ARM')),
  stok_tersedia integer not null default 0,
  stok_minimum integer not null default 0,
  lokasi_gudang text not null default 'Gudang Utama',
  foto_label text null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists mst_gudang_material_kode_barang_idx
  on public.mst_gudang_material (kode_barang);

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
  status text not null default 'Diajukan' check (status in ('Diajukan', 'Diproses', 'Disetujui', 'Ditolak')),
  location_hint text null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gudang_material_requests_requester_id_idx
  on public.gudang_material_requests (requester_id);

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
