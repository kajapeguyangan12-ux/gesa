const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const DEFAULT_OUTPUT_FILE = "legacy-public-photo-urls.json";
const FIREBASE_HOST_MARKER = "firebasestorage.googleapis.com";
const LEGACY_PREFIX = "petugas-photos/";

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
  const outputArg = argv.find((entry) => entry.startsWith("--output="));
  return {
    outputFile: outputArg ? outputArg.slice("--output=".length).trim() : DEFAULT_OUTPUT_FILE,
  };
}

function extractFirebaseObjectPath(url) {
  if (typeof url !== "string" || !url.includes(FIREBASE_HOST_MARKER)) return null;
  try {
    const parsed = new URL(url);
    const marker = "/o/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length)).replace(/^\/+/, "");
  } catch {
    return null;
  }
}

function visitValue(value, collector, context) {
  if (typeof value === "string") {
    const objectPath = extractFirebaseObjectPath(value);
    if (objectPath && objectPath.startsWith(LEGACY_PREFIX)) {
      collector.push({
        url: value,
        source: context.source,
        reportId: context.reportId,
        objectPath,
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => visitValue(item, collector, context));
    return;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((nested) => visitValue(nested, collector, context));
  }
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFile(path.resolve(process.cwd(), ".env.migration.local"));

  const options = parseArgs(process.argv.slice(2));
  const outputPath = path.resolve(process.cwd(), options.outputFile);
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("reports")
    .select("fb_doc_id, grid_data, raw_payload")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to read reports: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  const found = [];

  for (const row of rows) {
    visitValue(row.grid_data, found, {
      source: "grid_data",
      reportId: row.fb_doc_id || "",
    });
    visitValue(row.raw_payload, found, {
      source: "raw_payload",
      reportId: row.fb_doc_id || "",
    });
  }

  const deduped = [];
  const seen = new Set();
  for (const entry of found) {
    if (seen.has(entry.url)) continue;
    seen.add(entry.url);
    deduped.push(entry);
  }

  fs.writeFileSync(outputPath, JSON.stringify(deduped, null, 2));
  console.log(
    JSON.stringify(
      {
        reportsScanned: rows.length,
        foundCount: found.length,
        uniqueUrlCount: deduped.length,
        outputFile: outputPath,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Export legacy public photo URLs failed:", error);
  process.exit(1);
});
