const fs = require("fs");
const path = require("path");
const { createHash } = require("node:crypto");
const XLSX = require("xlsx");
const { createClient } = require("@supabase/supabase-js");

const DEFAULT_BUCKET = process.env.SUPABASE_REPORT_ATTACHMENTS_BUCKET || "report-attachments";
const DEFAULT_PREFIX = "petugas-photos/";
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_CONCURRENCY = 4;
const PHOTO_URL_COLUMN = "photoUrl";

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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
  const inPlace = argv.includes("--in-place");
  const inputArg = argv.find((entry) => entry.startsWith("--input="));
  const outputArg = argv.find((entry) => entry.startsWith("--output="));
  const sheetArg = argv.find((entry) => entry.startsWith("--sheet="));
  const bucketArg = argv.find((entry) => entry.startsWith("--bucket="));
  const prefixArg = argv.find((entry) => entry.startsWith("--prefix="));
  const concurrencyArg = argv.find((entry) => entry.startsWith("--concurrency="));
  const summaryFileArg = argv.find((entry) => entry.startsWith("--summary-file="));
  const manifestFileArg = argv.find((entry) => entry.startsWith("--manifest-file="));

  return {
    dryRun,
    includeExisting,
    inPlace,
    inputFile: inputArg ? inputArg.slice("--input=".length).trim() : "",
    outputFile: outputArg ? outputArg.slice("--output=".length).trim() : "",
    sheetName: sheetArg ? sheetArg.slice("--sheet=".length).trim() : "foto_links",
    bucket: bucketArg ? bucketArg.slice("--bucket=".length).trim() : DEFAULT_BUCKET,
    prefix: normalizePrefix(prefixArg ? prefixArg.slice("--prefix=".length).trim() : DEFAULT_PREFIX),
    concurrency: parsePositiveInteger(concurrencyArg ? concurrencyArg.slice("--concurrency=".length) : "", DEFAULT_CONCURRENCY),
    summaryFile: summaryFileArg ? summaryFileArg.slice("--summary-file=".length).trim() : "",
    manifestFile: manifestFileArg ? manifestFileArg.slice("--manifest-file=".length).trim() : "",
  };
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePrefix(value) {
  const trimmed = String(value || "").trim().replace(/^\/+/, "");
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function ensureInputFile(value) {
  if (!value) {
    throw new Error("Usage: node scripts/retarget-report-excel-photo-urls.js --input=/path/to/file.xlsx [--dry-run]");
  }

  const resolved = path.resolve(process.cwd(), value);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Input file not found: ${resolved}`);
  }
  return resolved;
}

function buildOutputPath(inputPath, explicitOutputPath, inPlace) {
  if (inPlace) return inputPath;
  if (explicitOutputPath) return path.resolve(process.cwd(), explicitOutputPath);

  const extension = path.extname(inputPath);
  const baseName = path.basename(inputPath, extension);
  return path.join(path.dirname(inputPath), `${baseName}-supabase${extension || ".xlsx"}`);
}

function isFirebaseStorageUrl(value) {
  return typeof value === "string" && value.includes("firebasestorage.googleapis.com");
}

function parseFirebaseStorageUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const marker = "/o/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return null;

    const objectPath = decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length)).replace(/^\/+/, "");
    const fileName = objectPath.split("/").filter(Boolean).pop() || "";

    return {
      objectPath,
      fileName,
    };
  } catch {
    return null;
  }
}

function buildPublicUrl(supabaseUrl, bucket, objectPath) {
  const encodedSegments = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedSegments}`;
}

function resolveDestinationPath(firebaseObjectPath, prefix, fallbackFileName) {
  const normalizedObjectPath = String(firebaseObjectPath || "").replace(/^\/+/, "");
  if (normalizedObjectPath) {
    if (!prefix) return normalizedObjectPath;
    if (normalizedObjectPath.startsWith(prefix)) return normalizedObjectPath;
    return `${prefix}${normalizedObjectPath.split("/").filter(Boolean).pop() || fallbackFileName}`;
  }
  return `${prefix}${fallbackFileName}`;
}

function isLikelyImagePath(value) {
  return /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(value);
}

async function withTimeout(promise, timeoutMs, label) {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
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
  const response = await fetch(url, { method: "GET", redirect: "follow" });
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

function getColumnIndexFromHeaderRow(worksheet) {
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  if (rows.length === 0) {
    throw new Error("Sheet kosong.");
  }

  const headerRow = rows[0].map((value) => String(value || "").trim());
  const photoUrlIndex = headerRow.findIndex((value) => value === PHOTO_URL_COLUMN);
  if (photoUrlIndex === -1) {
    throw new Error(`Kolom '${PHOTO_URL_COLUMN}' tidak ditemukan.`);
  }

  return {
    photoUrlIndex,
    headerRow,
    rowCount: rows.length,
  };
}

function collectPhotoRows(worksheet, sheetName) {
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  const { photoUrlIndex } = getColumnIndexFromHeaderRow(worksheet);
  const entries = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const photoUrl = String(row[photoUrlIndex] || "").trim();
    if (!photoUrl || !isFirebaseStorageUrl(photoUrl)) continue;
    entries.push({
      sheetName,
      excelRowNumber: rowIndex + 1,
      photoUrl,
    });
  }

  return {
    rows,
    photoUrlIndex,
    entries,
  };
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFile(path.resolve(process.cwd(), ".env.migration.local"));

  const options = parseArgs(process.argv.slice(2));
  const inputPath = ensureInputFile(options.inputFile);
  const outputPath = buildOutputPath(inputPath, options.outputFile, options.inPlace);

  const workbook = XLSX.readFile(inputPath);
  const worksheet = workbook.Sheets[options.sheetName];
  if (!worksheet) {
    throw new Error(`Sheet '${options.sheetName}' tidak ditemukan.`);
  }

  const { rows, photoUrlIndex, entries } = collectPhotoRows(worksheet, options.sheetName);
  const uniqueSourceUrls = Array.from(new Set(entries.map((entry) => entry.photoUrl)));

  const summary = {
    dryRun: options.dryRun,
    includeExisting: options.includeExisting,
    inputFile: inputPath,
    outputFile: outputPath,
    sheetName: options.sheetName,
    bucket: options.bucket,
    prefix: options.prefix,
    totalPhotoRows: entries.length,
    uniqueSourceUrls: uniqueSourceUrls.length,
    copiedCount: 0,
    skippedExistingCount: 0,
    failedCount: 0,
    rewrittenRowCount: 0,
    completedAt: new Date().toISOString(),
  };

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const manifest = [];
  const urlMap = new Map();

  const results = await runWithConcurrency(uniqueSourceUrls, options.concurrency, async (sourceUrl, index) => {
    const parsed = parseFirebaseStorageUrl(sourceUrl);
    const fallbackFileName = parsed?.fileName || `photo-${index + 1}.bin`;
    const destinationPath = resolveDestinationPath(parsed?.objectPath || "", options.prefix, fallbackFileName);
    const publicUrl = buildPublicUrl(supabaseUrl, options.bucket, destinationPath);
    const manifestEntry = {
      sourceUrl,
      sourceObjectPath: parsed?.objectPath || "",
      destinationBucket: options.bucket,
      destinationPath,
      publicUrl,
      status: "",
    };

    try {
      if (!parsed?.objectPath) {
        throw new Error("unable to parse firebase object path");
      }

      if (!isLikelyImagePath(destinationPath)) {
        throw new Error("destination path is not a supported image path");
      }

      if (options.dryRun) {
        manifestEntry.status = "dry-run";
        urlMap.set(sourceUrl, publicUrl);
        return manifestEntry;
      }

      if (!options.includeExisting) {
        const exists = await checkObjectExists(supabase, options.bucket, destinationPath);
        if (exists) {
          manifestEntry.status = "skipped-existing";
          summary.skippedExistingCount += 1;
          urlMap.set(sourceUrl, publicUrl);
          return manifestEntry;
        }
      }

      const downloaded = await withTimeout(
        downloadPublicUrl(sourceUrl),
        DEFAULT_TIMEOUT_MS,
        `download ${sourceUrl}`
      );
      const sha256 = createHash("sha256").update(downloaded.bytes).digest("hex");
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
          summary.skippedExistingCount += 1;
          urlMap.set(sourceUrl, publicUrl);
          return manifestEntry;
        }
        throw new Error(error.message);
      }

      manifestEntry.status = options.includeExisting ? "uploaded-upsert" : "uploaded";
      manifestEntry.sha256 = sha256;
      manifestEntry.contentType = downloaded.contentType;
      manifestEntry.contentLength = downloaded.contentLength;
      summary.copiedCount += 1;
      urlMap.set(sourceUrl, publicUrl);
      return manifestEntry;
    } catch (error) {
      manifestEntry.status = "failed";
      manifestEntry.error = error instanceof Error ? error.message : String(error);
      summary.failedCount += 1;
      return manifestEntry;
    }
  });

  manifest.push(...results);

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const currentUrl = String(rows[rowIndex][photoUrlIndex] || "").trim();
    const mappedUrl = urlMap.get(currentUrl);
    if (!mappedUrl || mappedUrl === currentUrl) continue;
    rows[rowIndex][photoUrlIndex] = mappedUrl;
    summary.rewrittenRowCount += 1;
  }

  const nextWorksheet = XLSX.utils.aoa_to_sheet(rows);
  workbook.Sheets[options.sheetName] = nextWorksheet;
  const sheetIndex = workbook.SheetNames.indexOf(options.sheetName);
  if (sheetIndex >= 0) {
    workbook.Sheets[workbook.SheetNames[sheetIndex]] = nextWorksheet;
  }

  if (!options.dryRun) {
    XLSX.writeFile(workbook, outputPath);
  }

  const timestamp = Date.now();
  const manifestPath = path.resolve(
    process.cwd(),
    options.manifestFile || `excel-photo-url-retarget-manifest-${timestamp}.json`
  );
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  summary.manifestPath = manifestPath;

  if (options.summaryFile) {
    fs.writeFileSync(path.resolve(process.cwd(), options.summaryFile), JSON.stringify(summary, null, 2));
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("Excel photo URL retarget failed:", error);
  process.exit(1);
});
