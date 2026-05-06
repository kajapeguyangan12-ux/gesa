/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

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

function classifyUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "empty";
  if (value.includes("firebasestorage.googleapis.com")) return "firebase";
  if (value.includes("/storage/v1/object/public/")) return "supabase";
  return "other";
}

function createCounters() {
  return {
    firebase: 0,
    supabase: 0,
    other: 0,
    empty: 0,
  };
}

function incrementCounter(counter, value) {
  counter[classifyUrl(value)] += 1;
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFile(path.resolve(process.cwd(), ".env.migration.local"));

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("tasks")
    .select("fb_doc_id, kmz_file_url, kmz_file_url_2, raw_payload")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to read tasks: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  const counters = {
    kmz_file_url: createCounters(),
    kmz_file_url_2: createCounters(),
    payload_kmzFileUrl: createCounters(),
    payload_kmzFileUrl2: createCounters(),
    payload_excelFileUrl: createCounters(),
  };
  const sampleFirebaseRows = [];
  let rowsWithAnyFirebase = 0;
  let rowsWithAnySupabase = 0;
  let rowsFullyRetargeted = 0;

  for (const row of rows) {
    const rawPayload =
      row.raw_payload && typeof row.raw_payload === "object" && !Array.isArray(row.raw_payload)
        ? row.raw_payload
        : {};

    const values = {
      kmz_file_url: row.kmz_file_url,
      kmz_file_url_2: row.kmz_file_url_2,
      payload_kmzFileUrl: rawPayload.kmzFileUrl,
      payload_kmzFileUrl2: rawPayload.kmzFileUrl2,
      payload_excelFileUrl: rawPayload.excelFileUrl,
    };

    incrementCounter(counters.kmz_file_url, values.kmz_file_url);
    incrementCounter(counters.kmz_file_url_2, values.kmz_file_url_2);
    incrementCounter(counters.payload_kmzFileUrl, values.payload_kmzFileUrl);
    incrementCounter(counters.payload_kmzFileUrl2, values.payload_kmzFileUrl2);
    incrementCounter(counters.payload_excelFileUrl, values.payload_excelFileUrl);

    const classifications = Object.values(values).map(classifyUrl);
    const hasFirebase = classifications.includes("firebase");
    const hasSupabase = classifications.includes("supabase");
    const fullyRetargeted = classifications.every((entry) => entry === "supabase" || entry === "empty");

    if (hasFirebase) {
      rowsWithAnyFirebase += 1;
      if (sampleFirebaseRows.length < 10) {
        sampleFirebaseRows.push({
          fb_doc_id: row.fb_doc_id,
          kmz_file_url: row.kmz_file_url,
          kmz_file_url_2: row.kmz_file_url_2,
          payload_kmzFileUrl: rawPayload.kmzFileUrl || null,
          payload_kmzFileUrl2: rawPayload.kmzFileUrl2 || null,
          payload_excelFileUrl: rawPayload.excelFileUrl || null,
        });
      }
    }

    if (hasSupabase) {
      rowsWithAnySupabase += 1;
    }

    if (fullyRetargeted) {
      rowsFullyRetargeted += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        totalRows: rows.length,
        rowsWithAnyFirebase,
        rowsWithAnySupabase,
        rowsFullyRetargeted,
        counters,
        sampleFirebaseRows,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Task KMZ URL audit failed:", error);
  process.exit(1);
});
