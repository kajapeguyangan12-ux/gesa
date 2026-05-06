const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { createClient } = require("@supabase/supabase-js");

const DEFAULT_BUCKET = process.env.SUPABASE_REPORT_ATTACHMENTS_BUCKET || "report-attachments";
const DEFAULT_PREFIX = "survey-pra-existing/";
const DEFAULT_BATCH_SIZE = 500;
const DEFAULT_PROGRESS_FILE = "survey-pra-existing-missing-photo-copy-progress.json";
const DOWNLOAD_TIMEOUT_MS = 120000;
const METADATA_TIMEOUT_MS = 30000;
const UPLOAD_TIMEOUT_MS = 120000;

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

  const serviceAccountPath = path.resolve(
    process.cwd(),
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./serviceAccountKey.json"
  );
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Firebase service account file not found: ${serviceAccountPath}`);
  }

  return JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
}

function parseArgs(argv) {
  const resetProgress = argv.includes("--reset-progress");
  const dryRun = argv.includes("--dry-run");
  const batchSizeArg = argv.find((entry) => entry.startsWith("--batch-size="));
  const bucketArg = argv.find((entry) => entry.startsWith("--bucket="));
  const prefixArg = argv.find((entry) => entry.startsWith("--prefix="));
  const progressFileArg = argv.find((entry) => entry.startsWith("--progress-file="));

  const batchSize = batchSizeArg
    ? Number.parseInt(batchSizeArg.slice("--batch-size=".length), 10)
    : DEFAULT_BATCH_SIZE;

  return {
    resetProgress,
    dryRun,
    batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : DEFAULT_BATCH_SIZE,
    bucket: bucketArg ? bucketArg.slice("--bucket=".length).trim() : DEFAULT_BUCKET,
    prefix: prefixArg ? prefixArg.slice("--prefix=".length).trim() : DEFAULT_PREFIX,
    progressFile: progressFileArg
      ? progressFileArg.slice("--progress-file=".length).trim()
      : DEFAULT_PROGRESS_FILE,
  };
}

function isPhotoPath(filePath) {
  return /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(filePath);
}

async function listFirebasePhotoPaths(bucket, prefix) {
  const paths = [];
  let pageToken = undefined;

  while (true) {
    const [files, nextQuery] = await bucket.getFiles({
      autoPaginate: false,
      maxResults: 1000,
      pageToken,
      prefix,
    });

    for (const file of files) {
      if (!file.name || file.name.endsWith("/")) continue;
      if (!isPhotoPath(file.name)) continue;
      paths.push(file.name);
    }

    pageToken = nextQuery?.pageToken;
    if (!pageToken) break;
  }

  return paths.sort();
}

async function listSupabasePhotoPaths(client, bucket, prefix) {
  const paths = [];
  let offset = 0;

  while (true) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw new Error(error.message);
    }

    const items = Array.isArray(data) ? data : [];
    for (const item of items) {
      if (!item?.id || !item?.name) continue;
      const objectPath = `${prefix}${item.name}`;
      if (isPhotoPath(objectPath)) {
        paths.push(objectPath);
      }
    }

    if (items.length < 1000) break;
    offset += items.length;
  }

  return paths.sort();
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFile(path.resolve(process.cwd(), ".env.migration.local"));

  const options = parseArgs(process.argv.slice(2));
  const progressPath = path.resolve(process.cwd(), options.progressFile);

  if (options.resetProgress && fs.existsSync(progressPath)) {
    fs.unlinkSync(progressPath);
  }

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const firebaseBucketName = requireEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  const serviceAccount = resolveFirebaseServiceAccount();

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: firebaseBucketName,
  });

  const firebaseBucket = admin.storage().bucket(firebaseBucketName);
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const firebasePaths = await listFirebasePhotoPaths(firebaseBucket, options.prefix);
  const supabasePaths = await listSupabasePhotoPaths(supabase, options.bucket, options.prefix);
  const supabaseSet = new Set(supabasePaths);
  const missingPaths = firebasePaths.filter((objectPath) => !supabaseSet.has(objectPath));

  const initialProgress = {
    kind: "survey-pra-existing-missing-photo-copy-progress",
    dryRun: options.dryRun,
    bucket: options.bucket,
    prefix: options.prefix,
    batchSize: options.batchSize,
    firebaseCount: firebasePaths.length,
    supabaseCountBefore: supabasePaths.length,
    missingCountBefore: missingPaths.length,
    nextIndex: 0,
    completedBatches: 0,
    totals: {
      uploadedCount: 0,
      failedCount: 0,
    },
    history: [],
    updatedAt: new Date().toISOString(),
  };

  const progress = readJsonIfExists(progressPath) || initialProgress;
  writeJson(progressPath, progress);

  console.log(
    JSON.stringify(
      {
        phase: "before-copy",
        bucket: options.bucket,
        prefix: options.prefix,
        firebaseCount: firebasePaths.length,
        supabaseCountBefore: supabasePaths.length,
        missingCountBefore: missingPaths.length,
        batchSize: options.batchSize,
        progressFile: progressPath,
      },
      null,
      2
    )
  );

  while (progress.nextIndex < missingPaths.length) {
    const batch = missingPaths.slice(progress.nextIndex, progress.nextIndex + options.batchSize);
    let uploadedCount = 0;
    let failedCount = 0;
    const failed = [];

    for (const objectPath of batch) {
      if (options.dryRun) {
        uploadedCount += 1;
        continue;
      }

      try {
        const file = firebaseBucket.file(objectPath);
        const [buffer] = await withTimeout(
          file.download(),
          DOWNLOAD_TIMEOUT_MS,
          `download ${objectPath}`
        );
        const [metadata] = await withTimeout(
          file.getMetadata(),
          METADATA_TIMEOUT_MS,
          `metadata ${objectPath}`
        );
        const { error } = await withTimeout(
          supabase.storage.from(options.bucket).upload(objectPath, buffer, {
            contentType: metadata.contentType || undefined,
            upsert: false,
          }),
          UPLOAD_TIMEOUT_MS,
          `upload ${objectPath}`
        );

        if (error) {
          if (/already exists/i.test(error.message)) {
            uploadedCount += 1;
            continue;
          }
          throw new Error(error.message);
        }

        uploadedCount += 1;
      } catch (error) {
        failedCount += 1;
        failed.push({
          objectPath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    progress.completedBatches += 1;
    progress.nextIndex += batch.length;
    progress.updatedAt = new Date().toISOString();
    progress.totals.uploadedCount += uploadedCount;
    progress.totals.failedCount += failedCount;
    progress.history.push({
      batchNumber: progress.completedBatches,
      startIndex: progress.nextIndex - batch.length,
      selectedCount: batch.length,
      uploadedCount,
      failedCount,
      failed,
      completedAt: new Date().toISOString(),
    });

    writeJson(progressPath, progress);

    console.log(
      JSON.stringify(
        {
          phase: "batch-complete",
          batchNumber: progress.completedBatches,
          nextIndex: progress.nextIndex,
          selectedCount: batch.length,
          uploadedCount,
          failedCount,
        },
        null,
        2
      )
    );
  }

  const supabaseAfter = await listSupabasePhotoPaths(supabase, options.bucket, options.prefix);
  const supabaseAfterSet = new Set(supabaseAfter);
  const stillMissing = firebasePaths.filter((objectPath) => !supabaseAfterSet.has(objectPath));

  const summary = {
    bucket: options.bucket,
    prefix: options.prefix,
    firebaseCount: firebasePaths.length,
    supabaseCountBefore: supabasePaths.length,
    missingCountBefore: missingPaths.length,
    uploadedCount: progress.totals.uploadedCount,
    failedCount: progress.totals.failedCount,
    supabaseCountAfter: supabaseAfter.length,
    stillMissingCount: stillMissing.length,
    completedBatches: progress.completedBatches,
    progressFile: progressPath,
    completedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify({ phase: "completed", ...summary }, null, 2));

  await admin.app().delete();
}

main().catch(async (error) => {
  console.error("Missing-only Firebase Storage -> Supabase Storage copy failed:", error);
  try {
    await admin.app().delete();
  } catch {}
  process.exit(1);
});
