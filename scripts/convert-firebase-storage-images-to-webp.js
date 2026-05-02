const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const sharp = require("sharp");

const DEFAULT_PREFIXES = ["survey-pra-existing/"];
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

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
    const parsed = JSON.parse(inlineJson);
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  }

  const serviceAccountPath = path.resolve(
    process.cwd(),
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./serviceAccountKey.json"
  );
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Firebase service account file not found: ${serviceAccountPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  if (parsed.private_key) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  return parsed;
}

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run");
  const keepOriginal = argv.includes("--keep-original");
  const prefixesArg = argv.find((entry) => entry.startsWith("--prefixes="));
  const limitArg = argv.find((entry) => entry.startsWith("--limit="));
  const offsetArg = argv.find((entry) => entry.startsWith("--offset="));
  const qualityArg = argv.find((entry) => entry.startsWith("--quality="));
  const concurrencyArg = argv.find((entry) => entry.startsWith("--concurrency="));
  const summaryFileArg = argv.find((entry) => entry.startsWith("--summary-file="));

  const prefixes = prefixesArg
    ? prefixesArg
        .slice("--prefixes=".length)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : DEFAULT_PREFIXES;

  const limit = limitArg ? Number.parseInt(limitArg.slice("--limit=".length), 10) : null;
  const offset = offsetArg ? Number.parseInt(offsetArg.slice("--offset=".length), 10) : 0;
  const quality = qualityArg ? Number.parseInt(qualityArg.slice("--quality=".length), 10) : 85;
  const concurrency = concurrencyArg
    ? Number.parseInt(concurrencyArg.slice("--concurrency=".length), 10)
    : 4;

  return {
    dryRun,
    keepOriginal,
    prefixes,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    limit: Number.isFinite(limit) && limit > 0 ? limit : null,
    quality: Number.isFinite(quality) ? Math.min(100, Math.max(1, quality)) : 85,
    concurrency: Number.isFinite(concurrency) ? Math.min(32, Math.max(1, concurrency)) : 4,
    summaryFile: summaryFileArg ? summaryFileArg.slice("--summary-file=".length).trim() : "",
  };
}

async function listFilesForPrefixes(bucket, prefixes, options = {}) {
  const targetCount =
    typeof options.targetCount === "number" && Number.isFinite(options.targetCount) && options.targetCount > 0
      ? options.targetCount
      : null;
  const allFiles = [];
  for (const prefix of prefixes) {
    console.log(`Listing Firebase Storage prefix: ${prefix}`);
    let pageToken = undefined;

    while (true) {
      const [files, nextQuery] = await bucket.getFiles({
        autoPaginate: false,
        maxResults: 250,
        pageToken,
        prefix,
      });

      for (const file of files) {
        if (!file.name || file.name.endsWith("/")) continue;
        allFiles.push(file);
        if (targetCount && allFiles.length >= targetCount) {
          break;
        }
      }

      if (targetCount && allFiles.length >= targetCount) {
        break;
      }

      pageToken = nextQuery?.pageToken;
      if (!pageToken) {
        break;
      }
    }

    if (targetCount && allFiles.length >= targetCount) {
      break;
    }
  }

  const byName = new Map();
  for (const file of allFiles) {
    byName.set(file.name, file);
  }
  return Array.from(byName.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function buildDestinationPath(sourcePath, keepOriginal) {
  if (keepOriginal) {
    if (sourcePath.toLowerCase().endsWith(".webp")) {
      return sourcePath;
    }
    return sourcePath.replace(/\.(jpg|jpeg|png)$/i, "") + ".webp";
  }

  return sourcePath;
}

async function convertFileToWebp(file, quality) {
  const [inputBuffer] = await file.download();
  const outputBuffer = await sharp(inputBuffer).rotate().webp({ quality }).toBuffer();
  return {
    inputBuffer,
    outputBuffer,
  };
}

async function processFile(file, options, bucket) {
  const metadata = file.metadata || {};
  const sourceContentType = (metadata.contentType || "").toLowerCase();
  const sourceSize = Number.parseInt(metadata.size || "0", 10) || 0;
  const destinationPath = buildDestinationPath(file.name, options.keepOriginal);

  if (!SUPPORTED_IMAGE_TYPES.has(sourceContentType)) {
    return {
      sourcePath: file.name,
      destinationPath,
      sourceContentType,
      sourceSize,
      status: "skipped-unsupported-type",
      counters: { converted: 0, skipped: 1, failed: 0, bytesBefore: 0, bytesAfter: 0 },
    };
  }

  if (!options.keepOriginal && sourceContentType === "image/webp") {
    return {
      sourcePath: file.name,
      destinationPath,
      sourceContentType,
      sourceSize,
      status: "skipped-already-webp",
      counters: { converted: 0, skipped: 1, failed: 0, bytesBefore: 0, bytesAfter: 0 },
    };
  }

  try {
    const { outputBuffer } = await convertFileToWebp(file, options.quality);
    const outputSize = outputBuffer.byteLength;
    const savedBytes = sourceSize - outputSize;
    const customMetadata = { ...(metadata.metadata || {}) };
    const destinationFile = bucket.file(destinationPath);

    if (!options.dryRun) {
      await destinationFile.save(outputBuffer, {
        resumable: false,
        metadata: {
          cacheControl: metadata.cacheControl,
          contentDisposition: metadata.contentDisposition,
          contentEncoding: metadata.contentEncoding,
          contentLanguage: metadata.contentLanguage,
          contentType: "image/webp",
          metadata: customMetadata,
        },
      });
    }

    return {
      sourcePath: file.name,
      destinationPath,
      sourceContentType,
      destinationContentType: "image/webp",
      sourceSize,
      outputSize,
      savedBytes,
      status: options.dryRun ? "dry-run" : options.keepOriginal ? "converted-copy" : "converted-in-place",
      counters: {
        converted: 1,
        skipped: 0,
        failed: 0,
        bytesBefore: sourceSize,
        bytesAfter: outputSize,
      },
    };
  } catch (error) {
    return {
      sourcePath: file.name,
      destinationPath,
      sourceContentType,
      sourceSize,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      counters: { converted: 0, skipped: 0, failed: 1, bytesBefore: 0, bytesAfter: 0 },
    };
  }
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFile(path.resolve(process.cwd(), ".env.migration.local"));

  const options = parseArgs(process.argv.slice(2));
  const firebaseBucketName = requireEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  const serviceAccount = resolveFirebaseServiceAccount();

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: firebaseBucketName,
  });

  const bucket = admin.storage().bucket(firebaseBucketName);
  const files = await listFilesForPrefixes(bucket, options.prefixes, {
    targetCount: options.limit ? options.offset + options.limit : null,
  });
  const selectedFiles = options.limit
    ? files.slice(options.offset, options.offset + options.limit)
    : files.slice(options.offset);
  const runStartedAt = new Date().toISOString();

  const runInfo = {
    dryRun: options.dryRun,
    keepOriginal: options.keepOriginal,
    quality: options.quality,
    concurrency: options.concurrency,
    firebaseBucket: firebaseBucketName,
    prefixes: options.prefixes,
    totalMatched: files.length,
    offset: options.offset,
    limit: options.limit,
    selectedCount: selectedFiles.length,
    runStartedAt,
  };
  console.log(JSON.stringify(runInfo, null, 2));

  if (selectedFiles.length === 0) {
    const emptySummary = {
      ...runInfo,
      convertedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      bytesBefore: 0,
      bytesAfter: 0,
      estimatedSavedBytes: 0,
      manifestPath: "",
      completedAt: new Date().toISOString(),
    };
    if (options.summaryFile) {
      fs.writeFileSync(path.resolve(process.cwd(), options.summaryFile), JSON.stringify(emptySummary, null, 2));
    }
    console.log(JSON.stringify(emptySummary, null, 2));
    await admin.app().delete();
    return;
  }

  const manifest = [];
  let convertedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let bytesBefore = 0;
  let bytesAfter = 0;
  let processedCount = 0;

  for (let index = 0; index < selectedFiles.length; index += options.concurrency) {
    const chunk = selectedFiles.slice(index, index + options.concurrency);
    const results = await Promise.all(chunk.map((file) => processFile(file, options, bucket)));

    for (const result of results) {
      processedCount += 1;
      convertedCount += result.counters.converted;
      skippedCount += result.counters.skipped;
      failedCount += result.counters.failed;
      bytesBefore += result.counters.bytesBefore;
      bytesAfter += result.counters.bytesAfter;
      manifest.push({
        sourcePath: result.sourcePath,
        destinationPath: result.destinationPath,
        sourceContentType: result.sourceContentType,
        destinationContentType: result.destinationContentType,
        sourceSize: result.sourceSize,
        outputSize: result.outputSize,
        savedBytes: result.savedBytes,
        status: result.status,
        error: result.error,
      });

      if (result.status === "failed") {
        console.warn(`Failed to convert ${result.sourcePath}: ${result.error}`);
      }
    }

    if (processedCount % 25 === 0 || processedCount === selectedFiles.length) {
      console.log(
        `Processed ${processedCount}/${selectedFiles.length} files ` +
          `(converted: ${convertedCount}, skipped: ${skippedCount}, failed: ${failedCount})`
      );
    }
  }

  const manifestPath = path.resolve(
    process.cwd(),
    `firebase-storage-webp-manifest-${Date.now()}.json`
  );
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const summary = {
    ...runInfo,
    convertedCount,
    skippedCount,
    failedCount,
    bytesBefore,
    bytesAfter,
    estimatedSavedBytes: Math.max(0, bytesBefore - bytesAfter),
    manifestPath,
    completedAt: new Date().toISOString(),
  };

  if (options.summaryFile) {
    fs.writeFileSync(path.resolve(process.cwd(), options.summaryFile), JSON.stringify(summary, null, 2));
  }

  console.log(JSON.stringify(summary, null, 2));

  await admin.app().delete();
}

main().catch(async (error) => {
  console.error(error);
  if (admin.apps.length > 0) {
    await admin.app().delete();
  }
  process.exitCode = 1;
});
