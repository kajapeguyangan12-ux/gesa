# Env Runtime Vs Legacy

Dokumen ini menjelaskan mana konfigurasi yang dipakai flow aktif aplikasi, dan mana yang hanya disimpan untuk legacy/migrasi.

## Runtime Aktif

Flow aktif aplikasi admin saat ini menggunakan Supabase.

Variabel runtime utama:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Dipakai oleh:

- `src/lib/supabaseAdmin.ts`
- `src/lib/supabaseBrowser.ts`
- `src/contexts/AuthContext.tsx`
- route API aktif di `src/app/api/*`

Aturan:

- endpoint baru harus pakai Supabase
- auth aktif harus tetap Supabase
- storage/upload aktif harus tetap Supabase

## Legacy Aman Didiamkan

Variabel Firebase di `.env.local` boleh tetap ada, tetapi tidak boleh dijadikan dasar flow aktif:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

File legacy terkait:

- `src/lib/firebase.ts`
- `src/lib/firebaseAdmin.ts`
- `src/lib/createSuperAdmin.ts`
- `src/services/_archived/surveyService.firebase-legacy.ts`
- `src/app/admin/gesa-survey/page-old-backup.tsx`

Status:

- disimpan: ya
- dipakai flow produksi: tidak
- dihapus sekarang: tidak perlu

## Env Migrasi

`.env.migration.local` hanya untuk pekerjaan migrasi/sync/manual.

Contoh variabel:

- `FIREBASE_SERVICE_ACCOUNT_PATH`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_TASKS_TABLE`
- `MIGRATION_BATCH_SIZE`
- `SYNC_STATE_BACKEND`
- `SUPABASE_SYNC_STATE_TABLE`
- `INCREMENTAL_SYNC`
- `SYNC_MODE`

Aturan:

- jangan dipakai sebagai runtime normal aplikasi
- jangan diasumsikan aktif di production

## Script Legacy

Script berikut boleh disimpan, tetapi jangan dijalankan sebagai flow operasional normal:

- `scripts/sync-firebase-to-supabase-once.js`
- `scripts/sync-firebase-to-supabase-scheduler.js`
- `scripts/cloud-run-sync-server.js`
- `scripts/deploy-cloud-sync.ps1`
- `scripts/register-supabase-sync-task.ps1`
- `scripts/unregister-supabase-sync-task.ps1`

Script migrasi/copy/audit lain di `scripts/` dianggap manual tool, bukan bagian runtime aplikasi.

## Prinsip Tim

- jangan tambah import baru dari `firebase/*`
- jangan tambah import baru dari `firebase-admin/*`
- jangan buat fallback aktif ke Firebase
- kalau ada bug produksi, perbaiki di jalur Supabase, bukan menghidupkan lagi flow Firebase

## Ringkasan

- Supabase = aktif
- Firebase = legacy/cadangan
- Env migrasi = manual only
- Script sync Firebase = jangan dijalankan rutin
