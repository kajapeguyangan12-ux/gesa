/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const DEFAULT_BUCKET =
  process.env.SUPABASE_TASK_ATTACHMENTS_BUCKET ||
  process.env.SUPABASE_REPORT_ATTACHMENTS_BUCKET ||
  "task-attachments";

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
    const encodedObjectPath = parsed.pathname.slice(markerIndex + marker.length);
    const decodedPath = decodeURIComponent(encodedObjectPath);
    return decodedPath.startsWith("tasks/") ? decodedPath : null;
  } catch {
    return null;
  }
}

function retargetUrl(url, supabaseUrl, bucket) {
  const objectPath = extractFirebaseObjectPath(url);
  if (!objectPath) return url;
  return buildPublicUrl(supabaseUrl, bucket, objectPath);
}

function clonePayload(payload) {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? { ...payload } : {};
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

  const { data, error } = await supabase
    .from("tasks")
    .select("fb_doc_id, kmz_file_url, kmz_file_url_2, raw_payload")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to read tasks: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  const updates = [];

  for (const row of rows) {
    const rawPayload = clonePayload(row.raw_payload);
    let changed = false;

    const nextKmz1 = retargetUrl(row.kmz_file_url, supabaseUrl, DEFAULT_BUCKET);
    const nextKmz2 = retargetUrl(row.kmz_file_url_2, supabaseUrl, DEFAULT_BUCKET);
    const nextPayloadKmz1 = retargetUrl(rawPayload.kmzFileUrl, supabaseUrl, DEFAULT_BUCKET);
    const nextPayloadKmz2 = retargetUrl(rawPayload.kmzFileUrl2, supabaseUrl, DEFAULT_BUCKET);
    const nextPayloadExcel = retargetUrl(rawPayload.excelFileUrl, supabaseUrl, DEFAULT_BUCKET);
    const nextPayloadKmzSnake = retargetUrl(rawPayload.kmz_file_url, supabaseUrl, DEFAULT_BUCKET);
    const nextPayloadKmz2Snake = retargetUrl(rawPayload.kmz_file_url2, supabaseUrl, DEFAULT_BUCKET);
    const nextPayloadExcelSnake = retargetUrl(rawPayload.excel_file_url, supabaseUrl, DEFAULT_BUCKET);

    if (nextKmz1 !== row.kmz_file_url) changed = true;
    if (nextKmz2 !== row.kmz_file_url_2) changed = true;
    if (nextPayloadKmz1 !== rawPayload.kmzFileUrl) changed = true;
    if (nextPayloadKmz2 !== rawPayload.kmzFileUrl2) changed = true;
    if (nextPayloadExcel !== rawPayload.excelFileUrl) changed = true;
    if (nextPayloadKmzSnake !== rawPayload.kmz_file_url) changed = true;
    if (nextPayloadKmz2Snake !== rawPayload.kmz_file_url2) changed = true;
    if (nextPayloadExcelSnake !== rawPayload.excel_file_url) changed = true;

    if (!changed) continue;

    if (typeof rawPayload.kmzFileUrl === "string") rawPayload.kmzFileUrl = nextPayloadKmz1;
    if (typeof rawPayload.kmzFileUrl2 === "string") rawPayload.kmzFileUrl2 = nextPayloadKmz2;
    if (typeof rawPayload.excelFileUrl === "string") rawPayload.excelFileUrl = nextPayloadExcel;
    if (typeof rawPayload.kmz_file_url === "string") rawPayload.kmz_file_url = nextPayloadKmzSnake;
    if (typeof rawPayload.kmz_file_url2 === "string") rawPayload.kmz_file_url2 = nextPayloadKmz2Snake;
    if (typeof rawPayload.excel_file_url === "string") rawPayload.excel_file_url = nextPayloadExcelSnake;

    updates.push({
      fb_doc_id: row.fb_doc_id,
      kmz_file_url: nextKmz1,
      kmz_file_url_2: nextKmz2,
      raw_payload: rawPayload,
      updated_at: new Date().toISOString(),
    });
  }

  console.log(
    JSON.stringify(
      {
        bucket: DEFAULT_BUCKET,
        totalRows: rows.length,
        rowsToUpdate: updates.length,
        dryRun,
      },
      null,
      2
    )
  );

  if (dryRun || updates.length === 0) {
    return;
  }

  for (let index = 0; index < updates.length; index += 1) {
    const update = updates[index];
    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        kmz_file_url: update.kmz_file_url,
        kmz_file_url_2: update.kmz_file_url_2,
        raw_payload: update.raw_payload,
        updated_at: update.updated_at,
      })
      .eq("fb_doc_id", update.fb_doc_id);

    if (updateError) {
      throw new Error(`Failed to update task ${update.fb_doc_id}: ${updateError.message}`);
    }

    if ((index + 1) % 50 === 0) {
      console.log(`Updated ${index + 1}/${updates.length} task URL row(s)...`);
    }
  }
}

main().catch((error) => {
  console.error("Task attachment URL retarget failed:", error);
  process.exit(1);
});
