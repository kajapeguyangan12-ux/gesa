/* eslint-disable @typescript-eslint/no-require-imports */
/*
 * Audit helper: public.user_admin <-> Supabase Auth users
 *
 * Purpose:
 * - Detect rows in `user_admin` that no longer have a matching auth user
 * - Detect auth users that do not have a matching `user_admin` row
 *
 * Usage:
 *   node scripts/audit-user-admin-auth-sync.js
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

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return normalizeString(value).toLowerCase();
}

async function listAllAuthUsers(supabase) {
  const users = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }

    const pageUsers = Array.isArray(data?.users) ? data.users : [];
    users.push(...pageUsers);

    if (pageUsers.length < perPage) break;
    page += 1;
  }

  return users;
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFile(path.resolve(process.cwd(), ".env.migration.local"));

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
    .select("fb_doc_id, uid, name, username, email, role, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load ${userAdminTable}: ${error.message}`);
  }

  const authUsers = await listAllAuthUsers(supabase);
  const authById = new Map();
  const authByEmail = new Map();

  for (const user of authUsers) {
    const id = normalizeString(user.id);
    const email = normalizeEmail(user.email);
    if (id) authById.set(id, user);
    if (email) authByEmail.set(email, user);
  }

  const profileOrphans = [];
  const matchedAuthIds = new Set();

  for (const row of rows || []) {
    const uid = normalizeString(row.uid);
    const fbDocId = normalizeString(row.fb_doc_id);
    const email = normalizeEmail(row.email);
    const profileKey = uid || fbDocId || email || "(unknown)";

    const matchedAuthUser =
      (uid && authById.get(uid)) ||
      (fbDocId && authById.get(fbDocId)) ||
      (email && authByEmail.get(email)) ||
      null;

    if (!matchedAuthUser) {
      profileOrphans.push({
        id: profileKey,
        email,
        username: normalizeString(row.username),
        role: normalizeString(row.role),
      });
      continue;
    }

    matchedAuthIds.add(normalizeString(matchedAuthUser.id));
  }

  const authOrphans = authUsers
    .filter((user) => !matchedAuthIds.has(normalizeString(user.id)))
    .map((user) => ({
      id: normalizeString(user.id),
      email: normalizeEmail(user.email),
      lastSignInAt: normalizeString(user.last_sign_in_at),
      createdAt: normalizeString(user.created_at),
    }));

  console.log("Summary");
  console.log(`- user_admin rows: ${Array.isArray(rows) ? rows.length : 0}`);
  console.log(`- auth users: ${authUsers.length}`);
  console.log(`- profile orphans: ${profileOrphans.length}`);
  console.log(`- auth orphans: ${authOrphans.length}`);

  if (profileOrphans.length > 0) {
    console.log("");
    console.log("Profile orphans");
    for (const item of profileOrphans.slice(0, 20)) {
      console.log(`- ${item.id} | ${item.email || "-"} | ${item.username || "-"} | ${item.role || "-"}`);
    }
    if (profileOrphans.length > 20) {
      console.log(`- ...and ${profileOrphans.length - 20} more`);
    }
  }

  if (authOrphans.length > 0) {
    console.log("");
    console.log("Auth orphans");
    for (const item of authOrphans.slice(0, 20)) {
      console.log(`- ${item.id} | ${item.email || "-"} | created ${item.createdAt || "-"}`);
    }
    if (authOrphans.length > 20) {
      console.log(`- ...and ${authOrphans.length - 20} more`);
    }
  }

  if (profileOrphans.length > 0 || authOrphans.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
