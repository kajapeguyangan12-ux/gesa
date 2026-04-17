/*
 * Read-only migration helper: Firebase Firestore -> Supabase
 *
 * What this script guarantees:
 * - Reads data from Firebase only
 * - Never updates/deletes Firebase data
 * - Writes mapped rows into Supabase in batches
 *
 * Setup:
 * 1. npm install firebase-admin @supabase/supabase-js
 * 2. Put a Firebase service account JSON locally, outside git.
 * 3. Create `.env.migration.local` in repo root:
 *
 *    FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
 *    SUPABASE_URL=https://xxxx.supabase.co
 *    SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
 *    SUPABASE_TASKS_TABLE=tasks
 *    MIGRATION_BATCH_SIZE=500
 *
 * Usage:
 *    node scripts/migrate-firebase-to-supabase.js tasks
 *    node scripts/migrate-firebase-to-supabase.js tasks --dry-run
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { createClient } = require("@supabase/supabase-js");
const SYNC_STATE_FILE = path.resolve(process.cwd(), process.env.SYNC_STATE_FILE || ".sync-state.json");
const DEFAULT_SYNC_STATE_TABLE = process.env.SUPABASE_SYNC_STATE_TABLE || "sync_state";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function resolveFirebaseServiceAccount() {
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    return JSON.parse(inlineJson);
  }

  const base64Json = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (base64Json) {
    return JSON.parse(Buffer.from(base64Json, "base64").toString("utf8"));
  }

  const serviceAccountPath = requireEnv("FIREBASE_SERVICE_ACCOUNT_PATH");
  const resolvedServiceAccountPath = path.resolve(process.cwd(), serviceAccountPath);
  if (!fs.existsSync(resolvedServiceAccountPath)) {
    throw new Error(`Firebase service account file not found: ${resolvedServiceAccountPath}`);
  }

  return require(resolvedServiceAccountPath);
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function readLocalSyncState() {
  if (!fs.existsSync(SYNC_STATE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SYNC_STATE_FILE, "utf8"));
  } catch (error) {
    console.error("Failed to read sync state file:", error);
    return {};
  }
}

function writeLocalSyncState(state) {
  fs.writeFileSync(SYNC_STATE_FILE, JSON.stringify(state, null, 2));
}

function resolveSyncStateBackend() {
  return (process.env.SYNC_STATE_BACKEND || "file").trim().toLowerCase();
}

async function readSupabaseSyncState(supabase) {
  const { data, error } = await supabase
    .from(DEFAULT_SYNC_STATE_TABLE)
    .select("collection_key,last_synced_at,last_run_at,last_mode,status,message,total_rows,updated_at");

  if (error) {
    throw new Error(`Failed to read Supabase sync state table "${DEFAULT_SYNC_STATE_TABLE}": ${error.message}`);
  }

  const state = {};
  for (const row of data || []) {
    state[row.collection_key] = {
      lastSyncedAt: row.last_synced_at || null,
      lastRunAt: row.last_run_at || null,
      lastMode: row.last_mode || null,
      status: row.status || null,
      message: row.message || "",
      totalRows: typeof row.total_rows === "number" ? row.total_rows : 0,
      updatedAt: row.updated_at || null,
    };
  }

  return state;
}

async function writeSupabaseSyncState(supabase, collectionKey, collectionState) {
  const payload = {
    collection_key: collectionKey,
    last_synced_at: collectionState.lastSyncedAt || null,
    last_run_at: collectionState.lastRunAt || null,
    last_mode: collectionState.lastMode || null,
    status: collectionState.status || null,
    message: collectionState.message || "",
    total_rows: typeof collectionState.totalRows === "number" ? collectionState.totalRows : 0,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from(DEFAULT_SYNC_STATE_TABLE)
    .upsert(payload, { onConflict: "collection_key" });

  if (error) {
    throw new Error(`Failed to write Supabase sync state for "${collectionKey}": ${error.message}`);
  }
}

async function readSyncState(supabase) {
  const backend = resolveSyncStateBackend();
  if (backend === "supabase") {
    return readSupabaseSyncState(supabase);
  }
  return readLocalSyncState();
}

async function writeSyncState(supabase, state, collectionKey) {
  const backend = resolveSyncStateBackend();
  if (backend === "supabase") {
    return writeSupabaseSyncState(supabase, collectionKey, state[collectionKey] || {});
  }
  writeLocalSyncState(state);
}

function normalizeTimestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (typeof value === "object" && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000).toISOString();
  }
  return null;
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return Boolean(value);
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function normalizeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeInteger(value) {
  const numeric = normalizeNumber(value);
  if (numeric === null) return null;
  return Math.round(numeric);
}

function mapTaskDocument(doc) {
  const data = doc.data();

  return {
    fb_doc_id: doc.id,
    title: data.title || null,
    description: data.description || null,
    status: data.status || null,
    type: data.type || null,
    kmz_file_url_2: data.kmz_file_url2 || data.kmzFileUrl2 || null,
    kmz_file_url: data.kmz_file_url || data.kmzFileUrl || null,
    created_by_admin_id: data.createdByAdminId || null,
    created_by_admin_name: data.createdByAdminName || null,
    created_by_admin_email: data.createdByAdminEmail || null,
    surveyor_id: data.surveyorId || null,
    surveyor_name: data.surveyorName || null,
    surveyor_email: data.surveyorEmail || null,
    kabupaten: data.kabupaten || null,
    kecamatan: data.kecamatan || null,
    priority: data.priority || null,
    offline_enabled: toBoolean(data.offlineEnabled, false),
    due_date: normalizeTimestamp(data.dueDate),
    created_at: normalizeTimestamp(data.createdAt),
    updated_at: normalizeTimestamp(data.updatedAt),
    raw_payload: data,
  };
}

function mapReportDocument(doc) {
  const data = doc.data();

  return {
    id: doc.id,
    fb_doc_id: doc.id,
    title: pickString(data.title, data.projectTitle, data.namaLampu),
    project_title: pickString(data.projectTitle, data.title, data.namaLampu),
    project_location: pickString(data.projectLocation, data.location, data.lokasi),
    location: pickString(data.location, data.projectLocation, data.lokasi),
    reporter_name: pickString(data.reporterName, data.officer, data.createdByName),
    officer: pickString(data.officer, data.reporterName, data.createdByName),
    created_by_id: pickString(data.createdById),
    created_by_email: pickString(data.createdByEmail),
    created_by_name: pickString(data.createdByName),
    created_by_role: pickString(data.createdByRole),
    watt: pickString(data.watt),
    meter: pickString(data.meter),
    voltage: pickString(data.voltage),
    date: pickString(data.date),
    time: pickString(data.time),
    status: pickString(data.status),
    source: pickString(data.source),
    kabupaten: pickString(data.kabupaten),
    project_date: normalizeTimestamp(data.projectDate),
    created_at: normalizeTimestamp(data.createdAt),
    grid_data: data.gridData ?? null,
    raw_payload: data,
  };
}

function mapSurveyExistingDocument(doc) {
  const data = doc.data();

  return {
    fb_doc_id: doc.id,
    title: pickString(data.title),
    type: pickString(data.type),
    status: pickString(data.status),
    surveyor_name: pickString(data.surveyorName),
    surveyor_email: pickString(data.surveyorEmail),
    surveyor_uid: pickString(data.surveyorUid),
    task_id: pickString(data.taskId),
    task_title: pickString(data.taskTitle),
    kmz_file_url: pickString(data.kmzFileUrl, data.kmz_file_url),
    kabupaten: pickString(data.kabupaten),
    jenis_existing: pickString(data.jenisExisting),
    lokasi_jalan: pickString(data.lokasiJalan),
    nama_jalan: pickString(data.namaJalan),
    nama_gang: pickString(data.namaGang),
    keterangan_tiang: pickString(data.keteranganTiang),
    jenis_titik: pickString(data.jenisTitik),
    foto_tiang_arm: pickString(data.fotoTiangARM),
    foto_titik_actual: pickString(data.fotoTitikActual),
    latitude: normalizeNumber(data.latitude),
    longitude: normalizeNumber(data.longitude),
    accuracy: normalizeNumber(data.accuracy),
    created_at: normalizeTimestamp(data.createdAt),
    verified_at: normalizeTimestamp(data.verifiedAt),
    updated_at: normalizeTimestamp(data.updatedAt),
    raw_payload: data,
  };
}

function mapSurveyApjProposeDocument(doc) {
  const data = doc.data();

  return {
    fb_doc_id: doc.id,
    title: pickString(data.title),
    type: pickString(data.type),
    status: pickString(data.status),
    surveyor_name: pickString(data.surveyorName),
    surveyor_email: pickString(data.surveyorEmail),
    surveyor_uid: pickString(data.surveyorUid),
    task_id: pickString(data.taskId),
    task_title: pickString(data.taskTitle),
    kmz_file_url: pickString(data.kmzFileUrl, data.kmz_file_url),
    kabupaten: pickString(data.kabupaten),
    status_id_titik: pickString(data.statusIDTitik),
    id_titik: pickString(data.idTitik),
    nama_jalan: pickString(data.namaJalan),
    data_ruas: pickString(data.dataRuas),
    sub_ruas: pickString(data.subRuas),
    daya_lampu: pickString(data.dayaLampu),
    data_tiang: pickString(data.dataTiang),
    foto_titik_actual: pickString(data.fotoTitikActual),
    foto_kemerataan: pickString(data.fotoKemerataan),
    latitude: normalizeNumber(data.latitude),
    longitude: normalizeNumber(data.longitude),
    accuracy: normalizeNumber(data.accuracy),
    created_at: normalizeTimestamp(data.createdAt),
    verified_at: normalizeTimestamp(data.verifiedAt),
    updated_at: normalizeTimestamp(data.updatedAt),
    raw_payload: data,
  };
}

function mapSurveyPraExistingDocument(doc) {
  const data = doc.data();

  return {
    fb_doc_id: doc.id,
    title: pickString(data.title),
    type: pickString(data.type),
    status: pickString(data.status),
    surveyor_name: pickString(data.surveyorName),
    surveyor_email: pickString(data.surveyorEmail),
    surveyor_uid: pickString(data.surveyorUid),
    task_id: pickString(data.taskId),
    task_title: pickString(data.taskTitle),
    kmz_file_url: pickString(data.kmzFileUrl, data.kmz_file_url),
    kabupaten: pickString(data.kabupaten),
    lokasi_jalan: pickString(data.lokasiJalan, data.location, data.lokasi),
    nama_jalan: pickString(data.namaJalan),
    foto_aktual: pickString(data.fotoAktual),
    uploaded_from_offline: toBoolean(data.uploadedFromOffline, false),
    offline_created_at: normalizeTimestamp(data.offlineCreatedAt),
    latitude: normalizeNumber(data.latitude),
    longitude: normalizeNumber(data.longitude),
    accuracy: normalizeNumber(data.accuracy),
    created_at: normalizeTimestamp(data.createdAt),
    verified_at: normalizeTimestamp(data.verifiedAt),
    updated_at: normalizeTimestamp(data.updatedAt),
    raw_payload: data,
  };
}

function mapUserAdminDocument(doc) {
  const data = doc.data();

  return {
    fb_doc_id: doc.id,
    uid: pickString(data.uid),
    name: pickString(data.name),
    username: pickString(data.username),
    email: pickString(data.email),
    password: pickString(data.password),
    role: pickString(data.role),
    phone_number: pickString(data.phoneNumber, data.phone, data.noTelp, data.no_telp),
    created_at: normalizeTimestamp(data.createdAt),
    updated_at: normalizeTimestamp(data.updatedAt),
    raw_payload: data,
  };
}

function mapTrackingSessionDocument(doc) {
  const data = doc.data();

  return {
    fb_doc_id: doc.id,
    user_id: pickString(data.userId),
    user_name: pickString(data.userName),
    user_email: pickString(data.userEmail),
    status: pickString(data.status),
    survey_type: pickString(data.surveyType),
    start_time: normalizeTimestamp(data.startTime),
    end_time: normalizeTimestamp(data.endTime),
    last_update: normalizeTimestamp(data.lastUpdate),
    total_distance: normalizeNumber(data.totalDistance),
    points_count: normalizeInteger(data.pointsCount ?? (Array.isArray(data.path) ? data.path.length : null)),
    duration: normalizeInteger(data.duration),
    path: Array.isArray(data.path) ? data.path : [],
    raw_payload: data,
  };
}

const COLLECTION_HANDLERS = {
  tasks: {
    sourceCollection: "tasks",
    targetTable: process.env.SUPABASE_TASKS_TABLE || "tasks",
    mapDocument: mapTaskDocument,
    cursorFields: ["createdAt", "startedAt", "completedAt"],
  },
  reports: {
    sourceCollection: "reports",
    targetTable: process.env.SUPABASE_REPORTS_TABLE || "reports",
    mapDocument: mapReportDocument,
    cursorFields: ["createdAt", "modifiedAt"],
  },
  "survey-existing": {
    sourceCollection: "survey-existing",
    targetTable: process.env.SUPABASE_SURVEY_EXISTING_TABLE || "survey_existing",
    mapDocument: mapSurveyExistingDocument,
    cursorFields: ["createdAt", "updatedAt", "verifiedAt", "validatedAt", "rejectedAt"],
  },
  "survey-apj-propose": {
    sourceCollection: "survey-apj-propose",
    targetTable: process.env.SUPABASE_SURVEY_APJ_PROPOSE_TABLE || "survey_apj_propose",
    mapDocument: mapSurveyApjProposeDocument,
    cursorFields: ["createdAt", "updatedAt", "verifiedAt", "validatedAt", "rejectedAt"],
  },
  "survey-pra-existing": {
    sourceCollection: "survey-pra-existing",
    targetTable: process.env.SUPABASE_SURVEY_PRA_EXISTING_TABLE || "survey_pra_existing",
    mapDocument: mapSurveyPraExistingDocument,
    cursorFields: ["createdAt", "updatedAt", "verifiedAt", "validatedAt", "rejectedAt"],
  },
  "user-admin": {
    sourceCollection: "User-Admin",
    targetTable: process.env.SUPABASE_USER_ADMIN_TABLE || "user_admin",
    mapDocument: mapUserAdminDocument,
    cursorFields: ["createdAt", "updatedAt"],
  },
  "tracking-sessions": {
    sourceCollection: "tracking-sessions",
    targetTable: process.env.SUPABASE_TRACKING_SESSIONS_TABLE || "tracking_sessions",
    mapDocument: mapTrackingSessionDocument,
    cursorFields: ["startTime", "endTime", "lastUpdate"],
  },
};

async function readDocumentsIncrementally(db, handler, lowerBoundIso, upperBoundIso) {
  const lowerBound = admin.firestore.Timestamp.fromDate(new Date(lowerBoundIso));
  const upperBound = admin.firestore.Timestamp.fromDate(new Date(upperBoundIso));
  const docMap = new Map();

  for (const field of handler.cursorFields || []) {
    try {
      const snapshot = await db
        .collection(handler.sourceCollection)
        .where(field, ">", lowerBound)
        .where(field, "<=", upperBound)
        .orderBy(field, "asc")
        .get();

      snapshot.docs.forEach((doc) => {
        docMap.set(doc.id, doc);
      });
    } catch (error) {
      console.error(`Incremental query failed for ${handler.sourceCollection}.${field}:`, error);
      throw error;
    }
  }

  return Array.from(docMap.values());
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env.migration.local"));

  const collectionKey = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  const incremental = process.argv.includes("--incremental") || process.env.INCREMENTAL_SYNC === "true";

  if (!collectionKey || !COLLECTION_HANDLERS[collectionKey]) {
    console.error("Usage: node scripts/migrate-firebase-to-supabase.js <tasks|reports|survey-existing|survey-apj-propose|survey-pra-existing|user-admin|tracking-sessions> [--dry-run] [--incremental]");
    process.exit(1);
  }

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const batchSize = Math.max(1, parseInt(process.env.MIGRATION_BATCH_SIZE || "500", 10));

  const serviceAccount = resolveFirebaseServiceAccount();
  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  const db = app.firestore();
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const handler = COLLECTION_HANDLERS[collectionKey];
  const syncState = await readSyncState(supabase);
  const collectionState = syncState[collectionKey] || {};
  const syncUpperBoundIso = new Date().toISOString();

  console.log(`[1/4] Reading Firebase collection: ${handler.sourceCollection}`);
  let docs = [];
  let mode = "full";

  if (incremental && collectionState.lastSyncedAt && Array.isArray(handler.cursorFields) && handler.cursorFields.length > 0) {
    mode = "incremental";
    docs = await readDocumentsIncrementally(db, handler, collectionState.lastSyncedAt, syncUpperBoundIso);
    console.log(`Incremental mode from ${collectionState.lastSyncedAt} to ${syncUpperBoundIso}`);
    console.log(`Found ${docs.length} changed documents.`);
  } else {
    const snapshot = await db.collection(handler.sourceCollection).get();
    docs = snapshot.docs;
    console.log(`Found ${docs.length} documents.`);
  }

  if (docs.length === 0) {
    if (incremental) {
      syncState[collectionKey] = {
        ...collectionState,
        lastSyncedAt: syncUpperBoundIso,
        lastRunAt: new Date().toISOString(),
        lastMode: mode,
        status: "ok",
        message: "No changed documents.",
        totalRows: 0,
      };
      await writeSyncState(supabase, syncState, collectionKey);
    }
    console.log("No documents found. Nothing to migrate.");
    await app.delete();
    return;
  }

  console.log(`[2/4] Mapping documents for Supabase table: ${handler.targetTable}`);
  const rows = docs.map(handler.mapDocument);

  if (dryRun) {
    console.log(`[DRY RUN] Prepared ${rows.length} rows. Sample row:`);
    console.log(JSON.stringify(rows[0], null, 2));
    await app.delete();
    return;
  }

  console.log(`[3/4] Inserting into Supabase in batches of ${batchSize}`);
  const batches = chunkArray(rows, batchSize);

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const { error } = await supabase
      .from(handler.targetTable)
      .upsert(batch, { onConflict: "fb_doc_id" });

    if (error) {
      throw new Error(`Supabase insert failed on batch ${index + 1}/${batches.length}: ${error.message}`);
    }

    console.log(`Upserted batch ${index + 1}/${batches.length} (${batch.length} rows).`);
  }

  console.log(`[4/4] Migration complete. ${rows.length} rows upserted into ${handler.targetTable}.`);
  if (incremental) {
    syncState[collectionKey] = {
      ...collectionState,
      lastSyncedAt: syncUpperBoundIso,
      lastRunAt: new Date().toISOString(),
      lastMode: mode,
      status: "ok",
      message: "",
      totalRows: rows.length,
    };
    await writeSyncState(supabase, syncState, collectionKey);
  }
  await app.delete();
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
