const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const DEFAULT_PROGRESS_FILE = "supabase-storage-webp-progress.json";
const CONVERTER_SCRIPT = path.resolve(process.cwd(), "scripts/convert-supabase-storage-images-to-webp.js");

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run");
  const keepOriginal = argv.includes("--keep-original");
  const resetProgress = argv.includes("--reset-progress");
  const noResume = argv.includes("--no-resume");
  const prefixesArg = argv.find((entry) => entry.startsWith("--prefixes="));
  const bucketArg = argv.find((entry) => entry.startsWith("--bucket="));
  const batchSizeArg = argv.find((entry) => entry.startsWith("--batch-size="));
  const startOffsetArg = argv.find((entry) => entry.startsWith("--start-offset="));
  const maxBatchesArg = argv.find((entry) => entry.startsWith("--max-batches="));
  const qualityArg = argv.find((entry) => entry.startsWith("--quality="));
  const concurrencyArg = argv.find((entry) => entry.startsWith("--concurrency="));
  const progressFileArg = argv.find((entry) => entry.startsWith("--progress-file="));

  const prefixes = prefixesArg
    ? prefixesArg
        .slice("--prefixes=".length)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : ["survey-apj-propose/", "survey-existing/", "survey-pra-existing/"];

  const bucket = bucketArg ? bucketArg.slice("--bucket=".length).trim() : "";
  const batchSize = batchSizeArg ? Number.parseInt(batchSizeArg.slice("--batch-size=".length), 10) : 250;
  const startOffset = startOffsetArg ? Number.parseInt(startOffsetArg.slice("--start-offset=".length), 10) : 0;
  const maxBatches = maxBatchesArg ? Number.parseInt(maxBatchesArg.slice("--max-batches=".length), 10) : null;
  const quality = qualityArg ? Number.parseInt(qualityArg.slice("--quality=".length), 10) : 85;
  const concurrency = concurrencyArg ? Number.parseInt(concurrencyArg.slice("--concurrency=".length), 10) : 4;
  const progressFile = progressFileArg
    ? progressFileArg.slice("--progress-file=".length).trim()
    : DEFAULT_PROGRESS_FILE;

  return {
    dryRun,
    keepOriginal,
    resetProgress,
    resume: !noResume,
    prefixes,
    bucket,
    batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 250,
    startOffset: Number.isFinite(startOffset) && startOffset > 0 ? startOffset : 0,
    maxBatches: Number.isFinite(maxBatches) && maxBatches > 0 ? maxBatches : null,
    quality: Number.isFinite(quality) ? Math.min(100, Math.max(1, quality)) : 85,
    concurrency: Number.isFinite(concurrency) ? Math.min(32, Math.max(1, concurrency)) : 4,
    progressFile,
  };
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function buildSummaryFilePath(batchOffset) {
  return path.resolve(process.cwd(), `supabase-storage-webp-summary-${Date.now()}-${batchOffset}.json`);
}

function buildConverterArgs(options, offset, summaryFile) {
  const args = [
    CONVERTER_SCRIPT,
    `--limit=${options.batchSize}`,
    `--offset=${offset}`,
    `--quality=${options.quality}`,
    `--concurrency=${options.concurrency}`,
    `--prefixes=${options.prefixes.join(",")}`,
    `--summary-file=${summaryFile}`,
  ];
  if (options.bucket) args.push(`--bucket=${options.bucket}`);
  if (options.dryRun) args.push("--dry-run");
  if (options.keepOriginal) args.push("--keep-original");
  return args;
}

function runBatch(options, offset) {
  const summaryFile = buildSummaryFilePath(offset);
  const args = buildConverterArgs(options, offset, summaryFile);
  console.log(`[batch] offset=${offset} batchSize=${options.batchSize} concurrency=${options.concurrency} dryRun=${options.dryRun}`);

  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Batch failed at offset ${offset} with exit code ${result.status}`);
  }

  const summary = readJsonIfExists(summaryFile);
  if (!summary) {
    throw new Error(`Batch summary not found: ${summaryFile}`);
  }

  return { summary, summaryFile };
}

function createInitialProgress(options, startOffset) {
  return {
    kind: "supabase-storage-webp-progress",
    updatedAt: new Date().toISOString(),
    dryRun: options.dryRun,
    keepOriginal: options.keepOriginal,
    prefixes: options.prefixes,
    bucket: options.bucket,
    batchSize: options.batchSize,
    quality: options.quality,
    concurrency: options.concurrency,
    nextOffset: startOffset,
    completedBatches: 0,
    history: [],
    totals: {
      convertedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      bytesBefore: 0,
      bytesAfter: 0,
      estimatedSavedBytes: 0,
    },
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const progressPath = path.resolve(process.cwd(), options.progressFile);

  if (options.resetProgress && fs.existsSync(progressPath)) {
    fs.unlinkSync(progressPath);
  }

  const existingProgress = options.resume ? readJsonIfExists(progressPath) : null;
  const progress =
    existingProgress && Array.isArray(existingProgress.history)
      ? existingProgress
      : createInitialProgress(options, options.startOffset);

  if (!existingProgress) {
    writeJson(progressPath, progress);
  }

  let offset = Number.isFinite(progress.nextOffset) ? progress.nextOffset : options.startOffset;
  let completedThisRun = 0;

  while (true) {
    if (options.maxBatches && completedThisRun >= options.maxBatches) break;

    const { summary, summaryFile } = runBatch(options, offset);
    completedThisRun += 1;

    progress.updatedAt = new Date().toISOString();
    progress.dryRun = options.dryRun;
    progress.keepOriginal = options.keepOriginal;
    progress.prefixes = options.prefixes;
    progress.bucket = options.bucket;
    progress.batchSize = options.batchSize;
    progress.quality = options.quality;
    progress.concurrency = options.concurrency;
    progress.completedBatches += 1;
    progress.nextOffset = offset + summary.selectedCount;
    progress.lastSummaryFile = summaryFile;
    progress.history.push({
      offset,
      selectedCount: summary.selectedCount,
      convertedCount: summary.convertedCount,
      skippedCount: summary.skippedCount,
      failedCount: summary.failedCount,
      bytesBefore: summary.bytesBefore,
      bytesAfter: summary.bytesAfter,
      estimatedSavedBytes: summary.estimatedSavedBytes,
      manifestPath: summary.manifestPath,
      summaryFile,
      completedAt: summary.completedAt,
    });
    progress.totals.convertedCount += summary.convertedCount;
    progress.totals.skippedCount += summary.skippedCount;
    progress.totals.failedCount += summary.failedCount;
    progress.totals.bytesBefore += summary.bytesBefore;
    progress.totals.bytesAfter += summary.bytesAfter;
    progress.totals.estimatedSavedBytes += summary.estimatedSavedBytes;

    writeJson(progressPath, progress);

    console.log(
      JSON.stringify(
        {
          progressFile: progressPath,
          completedBatches: progress.completedBatches,
          nextOffset: progress.nextOffset,
          selectedCount: summary.selectedCount,
          convertedCount: summary.convertedCount,
          skippedCount: summary.skippedCount,
          failedCount: summary.failedCount,
        },
        null,
        2
      )
    );

    if (summary.selectedCount === 0 || summary.selectedCount < options.batchSize) break;
    offset = progress.nextOffset;
  }

  console.log(
    JSON.stringify(
      {
        message: "Batch runner completed",
        progressFile: progressPath,
        nextOffset: progress.nextOffset,
        completedBatches: progress.completedBatches,
        totals: progress.totals,
      },
      null,
      2
    )
  );
}

main();
