const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const DEFAULT_PROGRESS_FILE = "firebase-storage-to-supabase-progress.json";
const COPY_SCRIPT = path.resolve(process.cwd(), "scripts/copy-firebase-storage-to-supabase.js");

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run");
  const includeExisting = argv.includes("--include-existing");
  const resetProgress = argv.includes("--reset-progress");
  const noResume = argv.includes("--no-resume");
  const prefixesArg = argv.find((entry) => entry.startsWith("--prefixes="));
  const bucketArg = argv.find((entry) => entry.startsWith("--bucket="));
  const batchSizeArg = argv.find((entry) => entry.startsWith("--batch-size="));
  const startOffsetArg = argv.find((entry) => entry.startsWith("--start-offset="));
  const maxBatchesArg = argv.find((entry) => entry.startsWith("--max-batches="));
  const progressFileArg = argv.find((entry) => entry.startsWith("--progress-file="));

  const prefixes = prefixesArg
    ? prefixesArg
        .slice("--prefixes=".length)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : ["reports/", "survey-apj-propose/", "survey-existing/", "survey-pra-existing/"];

  const bucket = bucketArg ? bucketArg.slice("--bucket=".length).trim() : "";
  const batchSize = batchSizeArg ? Number.parseInt(batchSizeArg.slice("--batch-size=".length), 10) : 500;
  const startOffset = startOffsetArg ? Number.parseInt(startOffsetArg.slice("--start-offset=".length), 10) : 0;
  const maxBatches = maxBatchesArg ? Number.parseInt(maxBatchesArg.slice("--max-batches=".length), 10) : null;
  const progressFile = progressFileArg
    ? progressFileArg.slice("--progress-file=".length).trim()
    : DEFAULT_PROGRESS_FILE;

  return {
    dryRun,
    includeExisting,
    resetProgress,
    resume: !noResume,
    prefixes,
    bucket,
    batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 500,
    startOffset: Number.isFinite(startOffset) && startOffset > 0 ? startOffset : 0,
    maxBatches: Number.isFinite(maxBatches) && maxBatches > 0 ? maxBatches : null,
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
  return path.resolve(
    process.cwd(),
    `firebase-storage-to-supabase-summary-${Date.now()}-${batchOffset}.json`
  );
}

function buildCopyArgs(options, offset, summaryFile) {
  const args = [
    COPY_SCRIPT,
    `--limit=${options.batchSize}`,
    `--offset=${offset}`,
    `--prefixes=${options.prefixes.join(",")}`,
    `--summary-file=${summaryFile}`,
  ];
  if (options.bucket) args.push(`--bucket=${options.bucket}`);
  if (options.dryRun) args.push("--dry-run");
  if (options.includeExisting) args.push("--include-existing");
  return args;
}

function runBatch(options, offset) {
  const summaryFile = buildSummaryFilePath(offset);
  const args = buildCopyArgs(options, offset, summaryFile);
  console.log(`[batch] offset=${offset} batchSize=${options.batchSize} dryRun=${options.dryRun}`);

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
    kind: "firebase-storage-to-supabase-progress",
    updatedAt: new Date().toISOString(),
    dryRun: options.dryRun,
    includeExisting: options.includeExisting,
    prefixes: options.prefixes,
    bucket: options.bucket,
    batchSize: options.batchSize,
    nextOffset: startOffset,
    completedBatches: 0,
    history: [],
    totals: {
      uploadedCount: 0,
      skippedCount: 0,
      failedCount: 0,
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
    progress.includeExisting = options.includeExisting;
    progress.prefixes = options.prefixes;
    progress.bucket = options.bucket;
    progress.batchSize = options.batchSize;
    progress.completedBatches += 1;
    progress.nextOffset = offset + summary.selectedCount;
    progress.totalMatched = summary.totalMatched;
    progress.lastSummaryFile = summaryFile;
    progress.history.push({
      offset,
      selectedCount: summary.selectedCount,
      uploadedCount: summary.uploadedCount,
      skippedCount: summary.skippedCount,
      failedCount: summary.failedCount,
      manifestPath: summary.manifestPath,
      summaryFile,
      completedAt: summary.completedAt,
    });
    progress.totals.uploadedCount += summary.uploadedCount;
    progress.totals.skippedCount += summary.skippedCount;
    progress.totals.failedCount += summary.failedCount;

    writeJson(progressPath, progress);

    console.log(
      JSON.stringify(
        {
          progressFile: progressPath,
          completedBatches: progress.completedBatches,
          nextOffset: progress.nextOffset,
          selectedCount: summary.selectedCount,
          uploadedCount: summary.uploadedCount,
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
        totalMatched: progress.totalMatched || null,
      },
      null,
      2
    )
  );
}

main();
