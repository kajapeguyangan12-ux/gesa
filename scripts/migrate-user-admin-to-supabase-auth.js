/*
 * Migration helper: Supabase table user_admin -> Supabase Auth users
 *
 * Purpose:
 * - Creates auth.users accounts for legacy rows already stored in `user_admin`
 * - Reuses the plaintext password currently stored in legacy data
 * - Never deletes data
 *
 * Usage:
 *   node scripts/migrate-user-admin-to-supabase-auth.js
 *   node scripts/migrate-user-admin-to-supabase-auth.js --dry-run
 */

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

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isDuplicateAuthError(message) {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("already been registered") ||
    normalized.includes("already registered") ||
    normalized.includes("user already registered") ||
    normalized.includes("duplicate key") ||
    normalized.includes("already exists")
  );
}

async function listAllAuthUsersByEmail(supabase) {
  const emailMap = new Map();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }

    const users = Array.isArray(data?.users) ? data.users : [];
    for (const user of users) {
      const email = normalizeEmail(user.email);
      if (email) {
        emailMap.set(email, user);
      }
    }

    if (users.length < perPage) break;
    page += 1;
  }

  return emailMap;
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFile(path.resolve(process.cwd(), ".env.migration.local"));

  const dryRun = process.argv.includes("--dry-run");
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const userAdminTable = process.env.SUPABASE_USER_ADMIN_TABLE || "user_admin";

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: rows, error } = await supabase
    .from(userAdminTable)
    .select("fb_doc_id, uid, name, username, email, password, role, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load ${userAdminTable}: ${error.message}`);
  }

  const existingAuthUsersByEmail = await listAllAuthUsersByEmail(supabase);
  const summary = {
    total: Array.isArray(rows) ? rows.length : 0,
    created: 0,
    skippedExisting: 0,
    skippedMissingEmail: 0,
    skippedMissingPassword: 0,
    failed: 0,
  };
  const failures = [];
  const previewLimit = 20;
  const preview = [];

  console.log(
    `${dryRun ? "[dry-run] " : ""}Loaded ${summary.total} user_admin rows and ${existingAuthUsersByEmail.size} auth users.`
  );

  for (const row of rows || []) {
    const email = normalizeEmail(row.email);
    const password = normalizeString(row.password);
    const username = normalizeString(row.username);
    const name = normalizeString(row.name);
    const role = normalizeString(row.role);
    const legacyId = normalizeString(row.uid) || normalizeString(row.fb_doc_id) || email;

    if (!email) {
      summary.skippedMissingEmail += 1;
      if (preview.length < previewLimit) preview.push(`SKIP missing email: ${legacyId}`);
      continue;
    }

    if (!password) {
      summary.skippedMissingPassword += 1;
      if (preview.length < previewLimit) preview.push(`SKIP missing password: ${email}`);
      continue;
    }

    if (existingAuthUsersByEmail.has(email)) {
      summary.skippedExisting += 1;
      if (preview.length < previewLimit) preview.push(`SKIP already exists in auth: ${email}`);
      continue;
    }

    if (dryRun) {
      summary.created += 1;
      if (preview.length < previewLimit) {
        preview.push(`PLAN create auth user: ${email} (${role || "no-role"})`);
      }
      continue;
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        username,
        role,
        legacy_uid: normalizeString(row.uid),
        legacy_fb_doc_id: normalizeString(row.fb_doc_id),
      },
    });

    if (createError) {
      if (isDuplicateAuthError(createError.message)) {
        summary.skippedExisting += 1;
        if (preview.length < previewLimit) preview.push(`SKIP duplicate during create: ${email}`);
        continue;
      }

      summary.failed += 1;
      failures.push(`FAIL create auth user ${email}: ${createError.message}`);
      continue;
    }

    existingAuthUsersByEmail.set(email, created.user);
    summary.created += 1;
    if (preview.length < previewLimit) preview.push(`OK created auth user: ${email}`);
  }

  console.log("");
  if (preview.length > 0) {
    console.log("Preview");
    for (const line of preview) {
      console.log(`- ${line}`);
    }
    if (summary.total > preview.length) {
      console.log(`- ...and ${summary.total - preview.length} more rows processed`);
    }
    console.log("");
  }
  console.log("Summary");
  console.log(`- total rows: ${summary.total}`);
  console.log(`- created: ${summary.created}`);
  console.log(`- skipped existing: ${summary.skippedExisting}`);
  console.log(`- skipped missing email: ${summary.skippedMissingEmail}`);
  console.log(`- skipped missing password: ${summary.skippedMissingPassword}`);
  console.log(`- failed: ${summary.failed}`);

  if (failures.length > 0) {
    console.log("");
    console.log("Failures");
    for (const line of failures.slice(0, 20)) {
      console.log(`- ${line}`);
    }
    if (failures.length > 20) {
      console.log(`- ...and ${failures.length - 20} more failures`);
    }
  }

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
