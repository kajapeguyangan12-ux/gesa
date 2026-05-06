const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const DEFAULT_PROGRESS_FILE = "supabase-storage-url-retarget-progress.json";
const RETARGET_SCRIPT = path.resolve(process.cwd(), "scripts/retarget-supabase-storage-urls.js");

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run");
  const resetProgress = argv.includes("--reset-progress");
  const noResume = argv.includes("--no-resume");
  const tablesArg = argv.find((entry) => entry.startsWith("--tables="));
  const batchSizeArg = argv.find((entry) => entry.startsWith("--batch-size="));
  const startOffsetArg = argv.find((entry) => entry.startsWith("--start-offset="));
  const maxBatchesArg = argv.find((entry) => entry.startsWith("--max-batches="));
  const progressFileArg = argv.find((entry) => entry.startsWith("--progress-file="));

  const tables = tablesArg
    ? tablesArg.slice("--tables=".length).split(",").map((item) => item.trim()).filter(Boolean)
    : ["reports", "survey-existing", "survey-apj-propose", "survey-pra-existing"];
  const batchSize = batchSizeArg ? Number.parseInt(batchSizeArg.slice("--batch-size=".length), 10) : 250;
  const startOffset = startOffsetArg ? Number.parseInt(startOffsetArg.slice("--start-offset=".length), 10) : 0;
  const maxBatches = maxBatchesArg ? Number.parseInt(maxBatchesArg.slice("--max-batches=".length), 10) : null;
  const progressFile = progressFileArg ? progressFileArg.slice("--progress-file=".length).trim() : DEFAULT_PROGRESS_FILE;

  return {
    dryRun,
    resetProgress,
    resume: !noResume,
    tables,
    batchSize: Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 250,
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
  return path.resolve(process.cwd(), `supabase-storage-url-retarget-summary-${Date.now()}-${batchOffset}.json`);
}

function runBatch(options, offset) {
  const summaryFile = buildSummaryFilePath(offset);
  const args = [
    RETARGET_SCRIPT,
    `--limit=${options.batchSize}`,
    `--offset=${offset}`,
    `--tables=${options.tables.join(",")}`,
    `--summary-file=${summaryFile}`,
  ];
  if (options.dryRun) args.push("--dry-run");

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
    kind: "supabase-storage-url-retarget-progress",
    updatedAt: new Date().toISOString(),
    dryRun: options.dryRun,
    tables: options.tables,
    batchSize: options.batchSize,
    nextOffset: startOffset,
    completedBatches: 0,
    history: [],
    totals: {
      selectedCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
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
    progress.tables = options.tables;
    progress.batchSize = options.batchSize;
    progress.completedBatches += 1;
    const nextBatchSpan =
      typeof summary.batchSpan === "number" && summary.batchSpan > 0
        ? summary.batchSpan
        : options.batchSize;
    progress.nextOffset = offset + nextBatchSpan;
    progress.lastSummaryFile = summaryFile;
    progress.history.push({
      offset,
      selectedCount: summary.selectedCount,
      updatedCount: summary.updatedCount,
      unchangedCount: summary.unchangedCount,
      failedCount: summary.failedCount,
      byTable: summary.byTable,
      summaryFile,
      completedAt: summary.completedAt,
    });
    progress.totals.selectedCount += summary.selectedCount;
    progress.totals.updatedCount += summary.updatedCount;
    progress.totals.unchangedCount += summary.unchangedCount;
    progress.totals.failedCount += summary.failedCount;

    writeJson(progressPath, progress);

    console.log(JSON.stringify({
      progressFile: progressPath,
      completedBatches: progress.completedBatches,
      nextOffset: progress.nextOffset,
      selectedCount: summary.selectedCount,
      updatedCount: summary.updatedCount,
      unchangedCount: summary.unchangedCount,
      failedCount: summary.failedCount,
    }, null, 2));

    const maxTableSelectedCount =
      typeof summary.maxTableSelectedCount === "number" ? summary.maxTableSelectedCount : 0;
    if (maxTableSelectedCount === 0 || maxTableSelectedCount < options.batchSize) break;
    offset = progress.nextOffset;
  }

  console.log(JSON.stringify({
    message: "Batch runner completed",
    progressFile: progressPath,
    nextOffset: progress.nextOffset,
    completedBatches: progress.completedBatches,
    totals: progress.totals,
  }, null, 2));
}

main();
