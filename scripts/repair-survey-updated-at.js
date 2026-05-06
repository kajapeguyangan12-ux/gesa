const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const TABLES = [
  "survey_existing",
  "survey_apj_propose",
  "survey_pra_existing",
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

function normalizeTimestamp(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object" && value && "seconds" in value) {
    const seconds = Number(value.seconds);
    return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null;
  }
  return null;
}

function chooseRestoredUpdatedAt(row) {
  const rawPayload = row.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload : {};
  return (
    normalizeTimestamp(rawPayload.updatedAt) ||
    normalizeTimestamp(row.verified_at) ||
    normalizeTimestamp(rawPayload.verifiedAt) ||
    normalizeTimestamp(rawPayload.validatedAt) ||
    normalizeTimestamp(rawPayload.rejectedAt) ||
    normalizeTimestamp(row.created_at)
  );
}

async function fetchAllRows(supabase, table) {
  const rows = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("fb_doc_id, updated_at, created_at, verified_at, raw_payload")
      .order("fb_doc_id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Failed to load ${table}: ${error.message}`);
    }

    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);

    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFile(path.resolve(process.cwd(), ".env.migration.local"));

  const dryRun = process.argv.includes("--dry-run");
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const summary = {
    dryRun,
    tables: {},
    totalRows: 0,
    totalRepairs: 0,
    totalSkipped: 0,
  };

  for (const table of TABLES) {
    const rows = await fetchAllRows(supabase, table);
    const tableSummary = {
      totalRows: rows.length,
      repairs: 0,
      skipped: 0,
      samples: [],
    };

    for (const row of rows) {
      const currentUpdatedAt = normalizeTimestamp(row.updated_at);
      const restoredUpdatedAt = chooseRestoredUpdatedAt(row);

      if (!restoredUpdatedAt || restoredUpdatedAt === currentUpdatedAt) {
        tableSummary.skipped += 1;
        continue;
      }

      tableSummary.repairs += 1;
      if (tableSummary.samples.length < 5) {
        tableSummary.samples.push({
          id: row.fb_doc_id,
          currentUpdatedAt,
          restoredUpdatedAt,
        });
      }

      if (!dryRun) {
        const { error } = await supabase
          .from(table)
          .update({ updated_at: restoredUpdatedAt })
          .eq("fb_doc_id", row.fb_doc_id);

        if (error) {
          throw new Error(`Failed to repair ${table}.${row.fb_doc_id}: ${error.message}`);
        }
      }
    }

    summary.tables[table] = tableSummary;
    summary.totalRows += tableSummary.totalRows;
    summary.totalRepairs += tableSummary.repairs;
    summary.totalSkipped += tableSummary.skipped;
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("Repair survey updated_at failed:", error);
  process.exit(1);
});
