# Firebase -> Supabase Migration

Mode di repo ini tetap `read-only migration`:
- script hanya `read` dari Firebase Firestore
- script hanya `upsert` ke Supabase
- data asli di Firebase tidak diubah dan tidak dihapus
- sync incremental bisa menyimpan state di Supabase, jadi aman untuk Cloud Run

## 1. Install dependency

```bash
npm install firebase-admin @supabase/supabase-js
```

## 2. Siapkan kredensial

Untuk lokal, paling sederhana pakai file:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
MIGRATION_BATCH_SIZE=500
```

Untuk Cloud Run, lebih baik jangan pakai file. Pakai salah satu:
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `FIREBASE_SERVICE_ACCOUNT_BASE64`

Script migrasi sekarang mendukung tiga sumber service account:
1. `FIREBASE_SERVICE_ACCOUNT_JSON`
2. `FIREBASE_SERVICE_ACCOUNT_BASE64`
3. `FIREBASE_SERVICE_ACCOUNT_PATH`

## 3. Siapkan tabel sync state

Kalau mau sync incremental berjalan di cloud, buat tabel ini dulu di Supabase SQL Editor:

File SQL:
- [sync-state-schema.sql](/c:/Kerja/gesa/gesa-main/scripts/sync-state-schema.sql)

Isinya:

```sql
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
```

## 4. Jalankan migrasi / sync lokal

Aktifkan incremental sync di `.env.migration.local`:

```env
SYNC_STATE_BACKEND=supabase
SUPABASE_SYNC_STATE_TABLE=sync_state
INCREMENTAL_SYNC=true
SYNC_MODE=incremental
```

Dry run:

```bash
npm run migrate:supabase:tasks:dry-run
```

Migrasi nyata:

```bash
npm run migrate:supabase:tasks
```

Sync incremental sekali jalan:

```bash
npm run sync:supabase:once
```

Sync khusus halaman kerja survey:

```bash
npm run sync:supabase:once:survey-work
```

Sync khusus dashboard/backoffice:

```bash
npm run sync:supabase:once:backoffice
```

Default collection yang ikut sync:
- `tasks`
- `reports`
- `survey-existing`
- `survey-apj-propose`
- `survey-pra-existing`
- `user-admin`

Override collection:

```powershell
$env:SYNC_COLLECTIONS="tasks,reports,survey-pra-existing"
npm run sync:supabase:once
```

## 4a. Scheduled task Windows lokal

Kalau Anda menjalankan sync dari Windows Task Scheduler, sekarang task bisa dibedakan per profile.

Task 5 menit untuk halaman kerja survey:

```powershell
$env:SYNC_TASK_NAME="GesaSupabaseSyncSurvey5m"
$env:SYNC_PROFILE="survey-work"
$env:SYNC_INTERVAL_MINUTES="5"
$env:SYNC_MODE="incremental"
$env:INCREMENTAL_SYNC="true"
npm run sync:supabase:register-task
```

Task 15 menit untuk dashboard/backoffice:

```powershell
$env:SYNC_TASK_NAME="GesaSupabaseSyncBackoffice15m"
$env:SYNC_PROFILE="backoffice"
$env:SYNC_INTERVAL_MINUTES="15"
$env:SYNC_MODE="incremental"
$env:INCREMENTAL_SYNC="true"
npm run sync:supabase:register-task
```

Hapus task:

```powershell
$env:SYNC_TASK_NAME="GesaSupabaseSyncSurvey5m"
npm run sync:supabase:unregister-task
```

## 5. Aktifkan mode cloud yang benar

Untuk deployment cloud, pakai env ini:

```env
SYNC_STATE_BACKEND=supabase
SUPABASE_SYNC_STATE_TABLE=sync_state
INCREMENTAL_SYNC=true
SYNC_COLLECTIONS=tasks,reports,survey-existing,survey-apj-propose,survey-pra-existing,user-admin
MIGRATION_BATCH_SIZE=500
```

Dengan ini:
- run pertama akan full sync
- run berikutnya hanya ambil dokumen yang berubah sejak `last_synced_at`
- state sync tidak lagi bergantung ke `.sync-state.json`

## 6. Deploy ke Cloud Run

Repo ini sudah disiapkan untuk Cloud Run:
- image: [Dockerfile.sync](/c:/Kerja/gesa/gesa-main/Dockerfile.sync)
- HTTP server trigger: [cloud-run-sync-server.js](/c:/Kerja/gesa/gesa-main/scripts/cloud-run-sync-server.js)

Health check:
- `GET /healthz`

Trigger sync:
- `POST /sync`

Build image:

```bash
gcloud builds submit --tag gcr.io/YOUR_GCP_PROJECT/gesa-supabase-sync -f Dockerfile.sync .
```

Deploy service:

```bash
gcloud run deploy gesa-supabase-sync ^
  --image gcr.io/YOUR_GCP_PROJECT/gesa-supabase-sync ^
  --platform managed ^
  --region asia-southeast1 ^
  --no-allow-unauthenticated ^
  --set-env-vars SYNC_STATE_BACKEND=supabase,SUPABASE_SYNC_STATE_TABLE=sync_state,INCREMENTAL_SYNC=true,SYNC_COLLECTIONS=tasks,reports,survey-existing,survey-apj-propose,survey-pra-existing,user-admin,MIGRATION_BATCH_SIZE=500 ^
  --set-env-vars SUPABASE_URL=https://YOUR_PROJECT.supabase.co ^
  --set-env-vars SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY ^
  --set-env-vars FIREBASE_SERVICE_ACCOUNT_BASE64=BASE64_SERVICE_ACCOUNT_JSON ^
  --set-env-vars SYNC_ENDPOINT_TOKEN=YOUR_LONG_RANDOM_TOKEN
```

Catatan:
- `SYNC_ENDPOINT_TOKEN` dipakai untuk melindungi endpoint `/sync`
- jika mau lebih ketat, Cloud Scheduler juga bisa pakai OIDC service account; token header tetap boleh dipakai sebagai lapisan tambahan

## 7. Buat Cloud Scheduler 5 menit

Skema yang dipakai sekarang:
- semua collection sync lewat Cloud Run
- Cloud Scheduler memicu `POST /sync?profile=full`
- interval: **setiap 5 menit**

### Opsi A. Manual dengan gcloud

```bash
gcloud scheduler jobs create http gesa-supabase-sync-5m ^
  --location asia-southeast1 ^
  --schedule "*/5 * * * *" ^
  --time-zone "Asia/Singapore" ^
  --uri "https://YOUR_CLOUD_RUN_URL/sync?profile=full" ^
  --http-method POST ^
  --headers "Authorization=Bearer YOUR_LONG_RANDOM_TOKEN"
```

Kalau job sudah ada, pakai:

```bash
gcloud scheduler jobs update http gesa-supabase-sync-5m ^
  --location asia-southeast1 ^
  --schedule "*/5 * * * *" ^
  --time-zone "Asia/Singapore" ^
  --uri "https://YOUR_CLOUD_RUN_URL/sync?profile=full" ^
  --http-method POST ^
  --headers "Authorization=Bearer YOUR_LONG_RANDOM_TOKEN"
```

### Opsi B. Pakai script repo

Repo ini sekarang punya script:
- [deploy-cloud-sync.ps1](/c:/Kerja/gesa/gesa-main/scripts/deploy-cloud-sync.ps1)

Contoh:

```powershell
$env:GCP_PROJECT_ID="YOUR_GCP_PROJECT"
$env:GCP_REGION="asia-southeast1"
$env:SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
$env:FIREBASE_SERVICE_ACCOUNT_BASE64="BASE64_SERVICE_ACCOUNT_JSON"
$env:SYNC_ENDPOINT_TOKEN="YOUR_LONG_RANDOM_TOKEN"

powershell -ExecutionPolicy Bypass -File scripts/deploy-cloud-sync.ps1
```

Dengan arsitektur ini:
1. user tetap input ke Firebase
2. Cloud Scheduler memicu Cloud Run tiap 5 menit
3. Cloud Run menjalankan incremental sync ke Supabase
4. halaman aplikasi baca dari Supabase

## 8. Verifikasi hasil

Cek jumlah data:

```sql
select count(*) from public.tasks;
select count(*) from public.reports;
select count(*) from public.survey_existing;
select count(*) from public.survey_apj_propose;
select count(*) from public.survey_pra_existing;
select count(*) from public.user_admin;
```

Cek state sync:

```sql
select *
from public.sync_state
order by collection_key;
```

## 9. Catatan penting

- `.sync-state.json` masih bisa dipakai untuk lokal kalau `SYNC_STATE_BACKEND=file`
- untuk cloud, gunakan `SYNC_STATE_BACKEND=supabase`
- `tracking-sessions` sebaiknya tetap diaktifkan belakangan setelah schema Supabase-nya benar-benar stabil
- `SUPABASE_SERVICE_ROLE_KEY` dan Firebase service account key yang pernah dibagikan sebaiknya di-rotate
