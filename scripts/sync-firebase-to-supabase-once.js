/*
 * Run all Firebase -> Supabase sync jobs once.
 *
 * Default collections intentionally exclude GESA Survey operational tables
 * that now write directly to Supabase. You can override via:
 *
 *   SYNC_COLLECTIONS=tasks,reports,survey-existing node scripts/sync-firebase-to-supabase-once.js
 */

const path = require("path");
const { spawn } = require("child_process");

const DEFAULT_COLLECTIONS = [
  "reports",
  "user-admin",
];

const FIREBASE_SURVEY_COLLECTIONS = new Set([
  "survey-existing",
  "survey-apj-propose",
  "survey-pra-existing",
]);

const SYNC_PROFILES = {
  "survey-work-manual": [
    "tasks",
    "tracking-sessions",
  ],
  backoffice: [
    "reports",
    "user-admin",
  ],
  "tracking-manual": [
    "tracking-sessions",
  ],
  full: DEFAULT_COLLECTIONS,
};

function getCollectionsFromProfile(profileName) {
  const normalizedProfile = (profileName || "").trim().toLowerCase();
  return SYNC_PROFILES[normalizedProfile] || null;
}

function getCollections() {
  const raw = process.env.SYNC_COLLECTIONS?.trim();
  const collections = !raw
    ? DEFAULT_COLLECTIONS
    : raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return sanitizeCollections(collections);
}

function allowFirebaseSurveySync() {
  return (process.env.ALLOW_FIREBASE_SURVEY_SYNC || "").trim().toLowerCase() === "true";
}

function sanitizeCollections(collections) {
  if (!Array.isArray(collections) || collections.length === 0) {
    return [];
  }

  if (allowFirebaseSurveySync()) {
    return collections;
  }

  const filtered = collections.filter((name) => !FIREBASE_SURVEY_COLLECTIONS.has(name));
  const blocked = collections.filter((name) => FIREBASE_SURVEY_COLLECTIONS.has(name));
  if (blocked.length > 0) {
    console.warn(
      `[sync] Skipping Firebase survey collection(s): ${blocked.join(
        ", "
      )}. Supabase is the source of truth for admin edits. Set ALLOW_FIREBASE_SURVEY_SYNC=true only for one-off recovery/migration.`
    );
  }
  return filtered;
}

function resolveCollections(explicitCollections) {
  if (Array.isArray(explicitCollections) && explicitCollections.length > 0) {
    return sanitizeCollections(explicitCollections);
  }

  const profileCollections = getCollectionsFromProfile(process.env.SYNC_PROFILE);
  if (profileCollections) {
    return sanitizeCollections(profileCollections);
  }

  return getCollections();
}

function getSyncMode() {
  const raw = (process.env.SYNC_MODE || "").trim().toLowerCase();
  if (raw === "full" || raw === "incremental") return raw;
  return process.env.INCREMENTAL_SYNC === "true" ? "incremental" : "full";
}

function runCollectionSync(collectionName) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, "migrate-firebase-to-supabase.js");
    const syncMode = getSyncMode();
    const args = [scriptPath, collectionName];
    const childEnv = { ...process.env };

    if (syncMode === "incremental") {
      args.push("--incremental");
      childEnv.INCREMENTAL_SYNC = "true";
    } else {
      childEnv.INCREMENTAL_SYNC = "false";
    }

    const child = spawn(process.execPath, args, {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
      env: childEnv,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Sync for ${collectionName} failed with exit code ${code}.`));
    });
  });
}

async function runSyncOnce(collections = resolveCollections()) {
  if (collections.length === 0) {
    console.log("No collections configured for sync.");
    return;
  }

  console.log(`Starting one-time ${getSyncMode()} sync for: ${collections.join(", ")}`);
  const startedAt = Date.now();

  for (const collectionName of collections) {
    console.log(`\n=== Sync ${collectionName} ===`);
    await runCollectionSync(collectionName);
  }

  const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
  console.log(`\nAll sync jobs completed in ${elapsedSeconds}s.`);
}

module.exports = {
  DEFAULT_COLLECTIONS,
  FIREBASE_SURVEY_COLLECTIONS,
  SYNC_PROFILES,
  allowFirebaseSurveySync,
  getCollections,
  getCollectionsFromProfile,
  getSyncMode,
  resolveCollections,
  sanitizeCollections,
  runCollectionSync,
  runSyncOnce,
};

if (require.main === module) {
  runSyncOnce().catch((error) => {
    console.error("One-time sync failed:", error);
    process.exit(1);
  });
}
