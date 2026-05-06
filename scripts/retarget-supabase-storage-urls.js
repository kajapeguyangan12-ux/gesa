const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const DEFAULT_BUCKET_BY_PREFIX = {
  "tasks/": process.env.SUPABASE_TASK_ATTACHMENTS_BUCKET || process.env.SUPABASE_REPORT_ATTACHMENTS_BUCKET || "task-attachments",
  "reports/": process.env.SUPABASE_REPORT_ATTACHMENTS_BUCKET || "report-attachments",
  "survey-apj-propose/": process.env.SUPABASE_REPORT_ATTACHMENTS_BUCKET || "report-attachments",
  "survey-existing/": process.env.SUPABASE_REPORT_ATTACHMENTS_BUCKET || "report-attachments",
  "survey-pra-existing/": process.env.SUPABASE_REPORT_ATTACHMENTS_BUCKET || "report-attachments",
};

const TABLE_CONFIGS = {
  reports: {
    table: "reports",
    idColumn: "fb_doc_id",
    selectColumns: ["fb_doc_id", "grid_data", "raw_payload"],
    updateColumns: ["grid_data", "raw_payload"],
  },
  "survey-existing": {
    table: "survey_existing",
    idColumn: "fb_doc_id",
    selectColumns: ["fb_doc_id", "kmz_file_url", "foto_tiang_arm", "foto_titik_actual", "raw_payload"],
    updateColumns: ["kmz_file_url", "foto_tiang_arm", "foto_titik_actual", "raw_payload"],
  },
  "survey-apj-propose": {
    table: "survey_apj_propose",
    idColumn: "fb_doc_id",
    selectColumns: ["fb_doc_id", "kmz_file_url", "foto_titik_actual", "foto_kemerataan", "raw_payload"],
    updateColumns: ["kmz_file_url", "foto_titik_actual", "foto_kemerataan", "raw_payload"],
  },
  "survey-pra-existing": {
    table: "survey_pra_existing",
    idColumn: "fb_doc_id",
    selectColumns: ["fb_doc_id", "kmz_file_url", "foto_aktual", "raw_payload"],
    updateColumns: ["kmz_file_url", "foto_aktual", "raw_payload"],
  },
};

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
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run");
  const tablesArg = argv.find((entry) => entry.startsWith("--tables="));
  const limitArg = argv.find((entry) => entry.startsWith("--limit="));
  const offsetArg = argv.find((entry) => entry.startsWith("--offset="));
  const summaryFileArg = argv.find((entry) => entry.startsWith("--summary-file="));

  const tables = tablesArg
    ? tablesArg
        .slice("--tables=".length)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : ["reports", "survey-existing", "survey-apj-propose", "survey-pra-existing"];

  const limit = limitArg ? Number.parseInt(limitArg.slice("--limit=".length), 10) : 250;
  const offset = offsetArg ? Number.parseInt(offsetArg.slice("--offset=".length), 10) : 0;

  return {
    dryRun,
    tables,
    limit: Number.isFinite(limit) && limit > 0 ? limit : 250,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    summaryFile: summaryFileArg ? summaryFileArg.slice("--summary-file=".length).trim() : "",
  };
}

function buildPublicUrl(supabaseUrl, bucket, objectPath) {
  const encodedSegments = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedSegments}`;
}

function extractFirebaseObjectPath(url) {
  if (typeof url !== "string" || !url.includes("firebasestorage.googleapis.com")) {
    return null;
  }
  try {
    const parsed = new URL(url);
    const marker = "/o/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

function resolveBucketForObjectPath(objectPath) {
  for (const [prefix, bucket] of Object.entries(DEFAULT_BUCKET_BY_PREFIX)) {
    if (objectPath.startsWith(prefix)) {
      return bucket;
    }
  }
  return process.env.SUPABASE_REPORT_ATTACHMENTS_BUCKET || "report-attachments";
}

function retargetValue(value, supabaseUrl, stats) {
  if (typeof value === "string") {
    const objectPath = extractFirebaseObjectPath(value);
    if (!objectPath) return value;
    const bucket = resolveBucketForObjectPath(objectPath);
    if (!bucket) return value;
    stats.urlChanges += 1;
    return buildPublicUrl(supabaseUrl, bucket, objectPath);
  }

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const updated = retargetValue(item, supabaseUrl, stats);
      if (updated !== item) changed = true;
      return updated;
    });
    return changed ? next : value;
  }

  if (value && typeof value === "object") {
    let changed = false;
    const next = {};
    for (const [key, entryValue] of Object.entries(value)) {
      const updated = retargetValue(entryValue, supabaseUrl, stats);
      next[key] = updated;
      if (updated !== entryValue) changed = true;
    }
    return changed ? next : value;
  }

  return value;
}

async function loadRows(supabase, config, offset, limit) {
  const selectClause = config.selectColumns.join(", ");
  const { data, error } = await supabase
    .from(config.table)
    .select(selectClause)
    .order(config.idColumn, { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to load ${config.table}: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
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

  const tableKeys = options.tables.filter((tableKey) => TABLE_CONFIGS[tableKey]);
  if (tableKeys.length === 0) {
    throw new Error("No valid table keys provided.");
  }

  const summary = {
    dryRun: options.dryRun,
    offset: options.offset,
    limit: options.limit,
    tables: tableKeys,
    batchSpan: options.limit,
    selectedCount: 0,
    updatedCount: 0,
    unchangedCount: 0,
    failedCount: 0,
    byTable: {},
    completedAt: new Date().toISOString(),
  };

  for (const tableKey of tableKeys) {
    const config = TABLE_CONFIGS[tableKey];
    const rows = await loadRows(supabase, config, options.offset, options.limit);
    summary.selectedCount += rows.length;
    summary.byTable[tableKey] = {
      selectedCount: rows.length,
      updatedCount: 0,
      unchangedCount: 0,
      failedCount: 0,
      urlChanges: 0,
    };

    for (const row of rows) {
      const stats = { urlChanges: 0 };
      const payload = {};
      let changed = false;

      for (const column of config.updateColumns) {
        const currentValue = row[column];
        const updatedValue = retargetValue(currentValue, supabaseUrl, stats);
        payload[column] = updatedValue;
        if (updatedValue !== currentValue) changed = true;
      }

      if (!changed) {
        summary.unchangedCount += 1;
        summary.byTable[tableKey].unchangedCount += 1;
        continue;
      }

      summary.updatedCount += 1;
      summary.byTable[tableKey].updatedCount += 1;
      summary.byTable[tableKey].urlChanges += stats.urlChanges;

      if (options.dryRun) {
        continue;
      }

      const { error: updateError } = await supabase
        .from(config.table)
        .update(payload)
        .eq(config.idColumn, row[config.idColumn]);

      if (updateError) {
        summary.failedCount += 1;
        summary.byTable[tableKey].failedCount += 1;
        throw new Error(`Failed to update ${config.table}.${row[config.idColumn]}: ${updateError.message}`);
      }
    }
  }

  summary.maxTableSelectedCount = Object.values(summary.byTable).reduce((highest, entry) => {
    const selectedCount = typeof entry.selectedCount === "number" ? entry.selectedCount : 0;
    return Math.max(highest, selectedCount);
  }, 0);

  if (options.summaryFile) {
    fs.writeFileSync(path.resolve(process.cwd(), options.summaryFile), JSON.stringify(summary, null, 2));
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("Supabase storage URL retarget failed:", error);
  process.exit(1);
});
