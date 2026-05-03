const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { createClient } = require("@supabase/supabase-js");

const DEFAULT_BUCKET = process.env.SUPABASE_REPORT_ATTACHMENTS_BUCKET || "report-attachments";
const DEFAULT_PREFIXES = [
  "survey-apj-propose/",
  "survey-existing/",
  "survey-pra-existing/",
];
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

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run");
  const keepOriginal = argv.includes("--keep-original");
  const prefixesArg = argv.find((entry) => entry.startsWith("--prefixes="));
  const bucketArg = argv.find((entry) => entry.startsWith("--bucket="));
  const limitArg = argv.find((entry) => entry.startsWith("--limit="));
  const offsetArg = argv.find((entry) => entry.startsWith("--offset="));
  const pageSizeArg = argv.find((entry) => entry.startsWith("--page-size="));
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

  const bucket = bucketArg ? bucketArg.slice("--bucket=".length).trim() : DEFAULT_BUCKET;
  const limit = limitArg ? Number.parseInt(limitArg.slice("--limit=".length), 10) : null;
  const offset = offsetArg ? Number.parseInt(offsetArg.slice("--offset=".length), 10) : 0;
  const pageSize = pageSizeArg ? Number.parseInt(pageSizeArg.slice("--page-size=".length), 10) : 100;
  const quality = qualityArg ? Number.parseInt(qualityArg.slice("--quality=".length), 10) : 85;
  const concurrency = concurrencyArg ? Number.parseInt(concurrencyArg.slice("--concurrency=".length), 10) : 4;

  return {
    dryRun,
    keepOriginal,
    prefixes,
    bucket,
    limit: Number.isFinite(limit) && limit > 0 ? limit : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: Number.isFinite(pageSize) ? Math.min(1000, Math.max(1, pageSize)) : 100,
    quality: Number.isFinite(quality) ? Math.min(100, Math.max(1, quality)) : 85,
    concurrency: Number.isFinite(concurrency) ? Math.min(32, Math.max(1, concurrency)) : 4,
    summaryFile: summaryFileArg ? summaryFileArg.slice("--summary-file=".length).trim() : "",
  };
}

async function listObjectsForPrefix(supabase, bucket, prefix, limit, pageSize) {
  const collected = [];
  let offset = 0;

  while (true) {
    const requestLimit = limit ? Math.min(pageSize, Math.max(limit - collected.length, 0)) : pageSize;
    if (requestLimit <= 0) break;

    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: requestLimit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw new Error(error.message);
    }

    const rows = Array.isArray(data) ? data : [];
    for (const item of rows) {
      if (!item?.name) continue;
      collected.push({
        path: `${prefix}${item.name}`,
        name: item.name,
        metadata: item.metadata || {},
      });
      if (limit && collected.length >= limit) {
        break;
      }
    }

    if (rows.length < requestLimit) break;
    if (limit && collected.length >= limit) break;
    offset += rows.length;
  }

  return collected;
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

async function downloadObject(supabase, bucket, objectPath) {
  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error) {
    throw new Error(error.message);
  }
  return Buffer.from(await data.arrayBuffer());
}

async function processObject(item, options, supabase) {
  const sourcePath = item.path;
  const sourceContentType = String(item.metadata?.mimetype || item.metadata?.contentType || "").toLowerCase();
  const sourceSize = Number.parseInt(String(item.metadata?.size || "0"), 10) || 0;
  const destinationPath = buildDestinationPath(sourcePath, options.keepOriginal);

  if (!SUPPORTED_IMAGE_TYPES.has(sourceContentType)) {
    return {
      sourcePath,
      destinationPath,
      sourceContentType,
      sourceSize,
      status: "skipped-unsupported-type",
      counters: { converted: 0, skipped: 1, failed: 0, bytesBefore: 0, bytesAfter: 0 },
    };
  }

  if (!options.keepOriginal && sourceContentType === "image/webp") {
    return {
      sourcePath,
      destinationPath,
      sourceContentType,
      sourceSize,
      status: "skipped-already-webp",
      counters: { converted: 0, skipped: 1, failed: 0, bytesBefore: 0, bytesAfter: 0 },
    };
  }

  try {
    const inputBuffer = await downloadObject(supabase, options.bucket, sourcePath);
    const outputBuffer = await sharp(inputBuffer).rotate().webp({ quality: options.quality }).toBuffer();
    const outputSize = outputBuffer.byteLength;
    const savedBytes = sourceSize - outputSize;

    if (!options.dryRun) {
      const { error } = await supabase.storage.from(options.bucket).upload(destinationPath, outputBuffer, {
        contentType: "image/webp",
        upsert: true,
      });
      if (error) {
        throw new Error(error.message);
      }
    }

    return {
      sourcePath,
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
      sourcePath,
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
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const allObjects = [];
  const targetCount = options.limit ? options.offset + options.limit : null;
  for (const prefix of options.prefixes) {
    console.log(`Listing Supabase Storage prefix: ${prefix}`);
    const rows = await listObjectsForPrefix(
      supabase,
      options.bucket,
      prefix,
      targetCount ? Math.max(targetCount - allObjects.length, 0) : null,
      options.pageSize
    );
    allObjects.push(...rows);
    if (targetCount && allObjects.length >= targetCount) break;
  }

  const selectedObjects = options.limit
    ? allObjects.slice(options.offset, options.offset + options.limit)
    : allObjects.slice(options.offset);
  const runStartedAt = new Date().toISOString();
  const runInfo = {
    dryRun: options.dryRun,
    keepOriginal: options.keepOriginal,
    bucket: options.bucket,
    prefixes: options.prefixes,
    quality: options.quality,
    concurrency: options.concurrency,
    totalMatched: allObjects.length,
    offset: options.offset,
    limit: options.limit,
    selectedCount: selectedObjects.length,
    runStartedAt,
  };
  console.log(JSON.stringify(runInfo, null, 2));

  if (selectedObjects.length === 0) {
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
    return;
  }

  const manifest = [];
  let convertedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let bytesBefore = 0;
  let bytesAfter = 0;
  let processedCount = 0;

  for (let index = 0; index < selectedObjects.length; index += options.concurrency) {
    const chunk = selectedObjects.slice(index, index + options.concurrency);
    const results = await Promise.all(chunk.map((item) => processObject(item, options, supabase)));

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

    if (processedCount % 25 === 0 || processedCount === selectedObjects.length) {
      console.log(
        `Processed ${processedCount}/${selectedObjects.length} objects ` +
          `(converted: ${convertedCount}, skipped: ${skippedCount}, failed: ${failedCount})`
      );
    }
  }

  const manifestPath = path.resolve(
    process.cwd(),
    `supabase-storage-webp-manifest-${Date.now()}.json`
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
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
