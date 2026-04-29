const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { createClient } = require("@supabase/supabase-js");

const DEFAULT_BUCKET = process.env.SUPABASE_REPORT_ATTACHMENTS_BUCKET || "report-attachments";
const DEFAULT_PREFIXES = [
  "reports/",
  "survey-apj-propose/",
  "survey-existing/",
  "survey-pra-existing/",
];

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
  const dryRun = argv.includes("--dry-run");
  const includeExisting = argv.includes("--include-existing");
  const prefixesArg = argv.find((entry) => entry.startsWith("--prefixes="));
  const bucketArg = argv.find((entry) => entry.startsWith("--bucket="));
  const limitArg = argv.find((entry) => entry.startsWith("--limit="));
  const offsetArg = argv.find((entry) => entry.startsWith("--offset="));

  const prefixes = prefixesArg
    ? prefixesArg
        .slice("--prefixes=".length)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : DEFAULT_PREFIXES;

  const bucket = bucketArg ? bucketArg.slice("--bucket=".length).trim() : DEFAULT_BUCKET;
  const limit = limitArg ? Number.parseInt(limitArg.slice("--limit=".length), 10) : null;
  const offset = offsetArg ? Number.parseInt(offsetArg.slice("--offset=".length), 10) : 0;

  return {
    dryRun,
    includeExisting,
    prefixes,
    bucket,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    limit: Number.isFinite(limit) && limit > 0 ? limit : null,
  };
}

function publicUrlFor(supabaseUrl, bucket, objectPath) {
  const encodedSegments = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedSegments}`;
}

async function listFilesForPrefixes(bucket, prefixes) {
  const allFiles = [];
  for (const prefix of prefixes) {
    console.log(`Listing Firebase Storage prefix: ${prefix}`);
    const [files] = await bucket.getFiles({ prefix });
    for (const file of files) {
      if (!file.name || file.name.endsWith("/")) continue;
      allFiles.push(file);
    }
  }

  const byName = new Map();
  for (const file of allFiles) {
    byName.set(file.name, file);
  }
  return Array.from(byName.values()).sort((left, right) => left.name.localeCompare(right.name));
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFile(path.resolve(process.cwd(), ".env.migration.local"));

  const options = parseArgs(process.argv.slice(2));
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

  const files = await listFilesForPrefixes(firebaseBucket, options.prefixes);
  const selectedFiles = options.limit
    ? files.slice(options.offset, options.offset + options.limit)
    : files.slice(options.offset);

  console.log(
    JSON.stringify(
      {
        dryRun: options.dryRun,
        bucket: options.bucket,
        firebaseBucket: firebaseBucketName,
        prefixes: options.prefixes,
        totalMatched: files.length,
        offset: options.offset,
        selectedCount: selectedFiles.length,
      },
      null,
      2
    )
  );

  if (selectedFiles.length === 0) {
    await admin.app().delete();
    return;
  }

  const manifest = [];
  let uploadedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const file of selectedFiles) {
    const destinationPath = file.name;
    const publicUrl = publicUrlFor(supabaseUrl, options.bucket, destinationPath);
    const metadata = file.metadata || {};
    const contentType = metadata.contentType || "application/octet-stream";
    const size = Number.parseInt(metadata.size || "0", 10) || 0;

    if (options.dryRun) {
      manifest.push({
        sourcePath: file.name,
        destinationBucket: options.bucket,
        destinationPath,
        publicUrl,
        contentType,
        size,
        status: "dry-run",
      });
      continue;
    }

    try {
      const [buffer] = await file.download();
      const { error } = await supabase.storage.from(options.bucket).upload(destinationPath, buffer, {
        contentType,
        upsert: options.includeExisting,
      });

      if (error) {
        const isConflict = error.message.toLowerCase().includes("already exists");
        if (isConflict && !options.includeExisting) {
          skippedCount += 1;
          manifest.push({
            sourcePath: file.name,
            destinationBucket: options.bucket,
            destinationPath,
            publicUrl,
            contentType,
            size,
            status: "skipped-existing",
          });
          continue;
        }
        throw new Error(error.message);
      }

      uploadedCount += 1;
      manifest.push({
        sourcePath: file.name,
        destinationBucket: options.bucket,
        destinationPath,
        publicUrl,
        contentType,
        size,
        status: options.includeExisting ? "uploaded-upsert" : "uploaded",
      });
    } catch (error) {
      failedCount += 1;
      manifest.push({
        sourcePath: file.name,
        destinationBucket: options.bucket,
        destinationPath,
        publicUrl,
        contentType,
        size,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
      console.warn(`Failed to copy ${file.name}: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (uploadedCount % 25 === 0) {
      console.log(`Uploaded ${uploadedCount}/${selectedFiles.length} files...`);
    }
  }

  const manifestPath = path.resolve(
    process.cwd(),
    `firebase-storage-to-supabase-manifest-${Date.now()}.json`
  );
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(
    JSON.stringify(
      {
        dryRun: options.dryRun,
        uploadedCount,
        skippedCount,
        failedCount,
        offset: options.offset,
        selectedCount: selectedFiles.length,
        manifestPath,
      },
      null,
      2
    )
  );

  await admin.app().delete();
}

main().catch(async (error) => {
  console.error("Firebase Storage -> Supabase Storage copy failed:", error);
  try {
    await admin.app().delete();
  } catch {}
  process.exit(1);
});
