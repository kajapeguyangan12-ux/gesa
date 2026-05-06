const fs = require("fs");
const path = require("path");
const { createHash } = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");

const DEFAULT_BUCKET = process.env.SUPABASE_REPORT_ATTACHMENTS_BUCKET || "report-attachments";
const DEFAULT_INPUT_FILE = "legacy-photo-urls.txt";
const DEFAULT_PREFIX = "petugas-photos/";
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_TIMEOUT_MS = 120000;

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
  const includeExisting = argv.includes("--include-existing");
  const inputArg = argv.find((entry) => entry.startsWith("--input="));
  const bucketArg = argv.find((entry) => entry.startsWith("--bucket="));
  const prefixArg = argv.find((entry) => entry.startsWith("--prefix="));
  const limitArg = argv.find((entry) => entry.startsWith("--limit="));
  const offsetArg = argv.find((entry) => entry.startsWith("--offset="));
  const concurrencyArg = argv.find((entry) => entry.startsWith("--concurrency="));
  const summaryFileArg = argv.find((entry) => entry.startsWith("--summary-file="));
  const manifestFileArg = argv.find((entry) => entry.startsWith("--manifest-file="));

  const limit = limitArg ? Number.parseInt(limitArg.slice("--limit=".length), 10) : null;
  const offset = offsetArg ? Number.parseInt(offsetArg.slice("--offset=".length), 10) : 0;
  const concurrency = concurrencyArg
    ? Number.parseInt(concurrencyArg.slice("--concurrency=".length), 10)
    : DEFAULT_CONCURRENCY;

  return {
    dryRun,
    includeExisting,
    inputFile: inputArg ? inputArg.slice("--input=".length).trim() : DEFAULT_INPUT_FILE,
    bucket: bucketArg ? bucketArg.slice("--bucket=".length).trim() : DEFAULT_BUCKET,
    prefix: prefixArg ? prefixArg.slice("--prefix=".length).trim() : DEFAULT_PREFIX,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    limit: Number.isFinite(limit) && limit > 0 ? limit : null,
    concurrency: Number.isFinite(concurrency) && concurrency > 0 ? concurrency : DEFAULT_CONCURRENCY,
    summaryFile: summaryFileArg ? summaryFileArg.slice("--summary-file=".length).trim() : "",
    manifestFile: manifestFileArg ? manifestFileArg.slice("--manifest-file=".length).trim() : "",
  };
}

function isFirebaseStorageUrl(value) {
  return typeof value === "string" && value.includes("firebasestorage.googleapis.com");
}

function sanitizePathPart(value) {
  return String(value || "")
    .trim()
    .replace(/[<>:"\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_");
}

function isLikelyImagePath(value) {
  return /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(value);
}

function normalizePrefix(value) {
  const trimmed = String(value || "").trim().replace(/^\/+/, "");
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function parseFirebaseStorageUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const marker = "/o/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return null;

    const objectPath = decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
    const fileName = objectPath.split("/").filter(Boolean).pop() || "";

    return {
      objectPath,
      fileName,
      bucketHost: parsed.host,
    };
  } catch {
    return null;
  }
}

function resolveDestinationPath(entry, prefix, index) {
  const normalizedPrefix = normalizePrefix(prefix);
  const parsed = parseFirebaseStorageUrl(entry.url);

  if (entry.destinationPath) {
    return entry.destinationPath.replace(/^\/+/, "");
  }

  if (parsed?.objectPath) {
    if (!normalizedPrefix) return parsed.objectPath;
    const objectPath = parsed.objectPath.replace(/^\/+/, "");
    if (objectPath.startsWith(normalizedPrefix)) return objectPath;
    return `${normalizedPrefix}${objectPath.split("/").filter(Boolean).pop() || `file-${index + 1}`}`;
  }

  const fallbackName = sanitizePathPart(entry.fileName || `legacy-photo-${index + 1}`);
  return `${normalizedPrefix}${fallbackName}`;
}

function dedupeByUrl(entries) {
  const seen = new Set();
  const deduped = [];

  for (const entry of entries) {
    const key = entry.url.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }

  return deduped;
}

function readInputEntries(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".json") {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Input JSON harus berupa array.");
    }

    return parsed
      .map((item, index) => {
        if (typeof item === "string") {
          return { url: item.trim(), sourceIndex: index };
        }
        if (!item || typeof item !== "object") {
          return null;
        }
        const url = typeof item.url === "string" ? item.url.trim() : "";
        if (!url) return null;
        return {
          ...item,
          url,
          sourceIndex: index,
        };
      })
      .filter(Boolean);
  }

  return raw
    .split(/\r?\n/)
    .map((line, index) => ({ url: line.trim(), sourceIndex: index }))
    .filter((entry) => entry.url && !entry.url.startsWith("#"));
}

function buildPublicUrl(supabaseUrl, bucket, objectPath) {
  const encodedSegments = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedSegments}`;
}

async function withTimeout(promise, timeoutMs, label) {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function checkObjectExists(supabase, bucket, objectPath) {
  const folder = objectPath.includes("/") ? objectPath.slice(0, objectPath.lastIndexOf("/") + 1) : "";
  const fileName = objectPath.split("/").pop();
  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    limit: 1000,
    offset: 0,
    search: fileName,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (Array.isArray(data) ? data : []).some((item) => item?.name === fileName);
}

async function downloadPublicUrl(url) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`download failed with status ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const arrayBuffer = await response.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);

  return {
    bytes,
    contentType,
    contentLength: Number(response.headers.get("content-length") || bytes.length),
  };
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function consume() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => consume());
  await Promise.all(workers);
  return results;
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFile(path.resolve(process.cwd(), ".env.migration.local"));

  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(process.cwd(), options.inputFile);
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rawEntries = dedupeByUrl(readInputEntries(inputPath)).filter((entry) => isFirebaseStorageUrl(entry.url));
  const selectedEntries = options.limit
    ? rawEntries.slice(options.offset, options.offset + options.limit)
    : rawEntries.slice(options.offset);

  const manifest = [];
  const counters = {
    uploadedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    dryRunCount: 0,
  };

  console.log(
    JSON.stringify(
      {
        dryRun: options.dryRun,
        inputFile: inputPath,
        bucket: options.bucket,
        prefix: normalizePrefix(options.prefix),
        totalInputCount: rawEntries.length,
        offset: options.offset,
        selectedCount: selectedEntries.length,
        concurrency: options.concurrency,
      },
      null,
      2
    )
  );

  const results = await runWithConcurrency(selectedEntries, options.concurrency, async (entry, index) => {
    const parsed = parseFirebaseStorageUrl(entry.url);
    const destinationPath = resolveDestinationPath(entry, options.prefix, options.offset + index);
    const publicUrl = buildPublicUrl(supabaseUrl, options.bucket, destinationPath);
    const manifestEntry = {
      sourceIndex: entry.sourceIndex,
      sourceUrl: entry.url,
      sourceObjectPath: parsed?.objectPath || "",
      destinationBucket: options.bucket,
      destinationPath,
      publicUrl,
      status: "",
    };

    try {
      if (!isLikelyImagePath(destinationPath)) {
        throw new Error("destination path is not a supported image path");
      }

      if (!options.includeExisting) {
        const exists = await checkObjectExists(supabase, options.bucket, destinationPath);
        if (exists) {
          manifestEntry.status = "skipped-existing";
          counters.skippedCount += 1;
          return manifestEntry;
        }
      }

      if (options.dryRun) {
        manifestEntry.status = "dry-run";
        counters.dryRunCount += 1;
        return manifestEntry;
      }

      const downloaded = await withTimeout(
        downloadPublicUrl(entry.url),
        DEFAULT_TIMEOUT_MS,
        `download ${entry.url}`
      );
      const hash = createHash("sha256").update(downloaded.bytes).digest("hex");

      const { error } = await withTimeout(
        supabase.storage.from(options.bucket).upload(destinationPath, downloaded.bytes, {
          contentType: downloaded.contentType,
          upsert: options.includeExisting,
        }),
        DEFAULT_TIMEOUT_MS,
        `upload ${destinationPath}`
      );

      if (error) {
        const isConflict = /already exists/i.test(error.message);
        if (isConflict && !options.includeExisting) {
          manifestEntry.status = "skipped-existing";
          counters.skippedCount += 1;
          return manifestEntry;
        }
        throw new Error(error.message);
      }

      manifestEntry.status = options.includeExisting ? "uploaded-upsert" : "uploaded";
      manifestEntry.contentType = downloaded.contentType;
      manifestEntry.contentLength = downloaded.contentLength;
      manifestEntry.sha256 = hash;
      counters.uploadedCount += 1;
      return manifestEntry;
    } catch (error) {
      manifestEntry.status = "failed";
      manifestEntry.error = error instanceof Error ? error.message : String(error);
      counters.failedCount += 1;
      return manifestEntry;
    }
  });

  for (const entry of results) {
    manifest.push(entry);
  }

  const timestamp = Date.now();
  const manifestPath = path.resolve(
    process.cwd(),
    options.manifestFile || `legacy-public-photo-copy-manifest-${timestamp}.json`
  );
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const summary = {
    dryRun: options.dryRun,
    includeExisting: options.includeExisting,
    inputFile: inputPath,
    bucket: options.bucket,
    prefix: normalizePrefix(options.prefix),
    totalInputCount: rawEntries.length,
    offset: options.offset,
    selectedCount: selectedEntries.length,
    uploadedCount: counters.uploadedCount,
    skippedCount: counters.skippedCount,
    failedCount: counters.failedCount,
    dryRunCount: counters.dryRunCount,
    manifestPath,
    completedAt: new Date().toISOString(),
  };

  if (options.summaryFile) {
    fs.writeFileSync(path.resolve(process.cwd(), options.summaryFile), JSON.stringify(summary, null, 2));
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("Legacy public photo URL -> Supabase copy failed:", error);
  process.exit(1);
});
