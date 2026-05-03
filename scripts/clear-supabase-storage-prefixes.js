const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const DEFAULT_BUCKET = process.env.SUPABASE_REPORT_ATTACHMENTS_BUCKET || "report-attachments";
const DEFAULT_PREFIXES = [
  "survey-apj-propose/",
  "survey-existing/",
  "survey-pra-existing/",
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

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run");
  const prefixesArg = argv.find((entry) => entry.startsWith("--prefixes="));
  const bucketArg = argv.find((entry) => entry.startsWith("--bucket="));
  const limitArg = argv.find((entry) => entry.startsWith("--limit="));
  const pageSizeArg = argv.find((entry) => entry.startsWith("--page-size="));

  const prefixes = prefixesArg
    ? prefixesArg
        .slice("--prefixes=".length)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : DEFAULT_PREFIXES;

  const bucket = bucketArg ? bucketArg.slice("--bucket=".length).trim() : DEFAULT_BUCKET;
  const limit = limitArg ? Number.parseInt(limitArg.slice("--limit=".length), 10) : null;
  const pageSize = pageSizeArg ? Number.parseInt(pageSizeArg.slice("--page-size=".length), 10) : 100;

  return {
    dryRun,
    prefixes,
    bucket,
    limit: Number.isFinite(limit) && limit > 0 ? limit : null,
    pageSize: Number.isFinite(pageSize) ? Math.min(1000, Math.max(1, pageSize)) : 100,
  };
}

async function listObjectsForPrefix(supabase, bucket, prefix, limit, pageSize) {
  const collected = [];
  let offset = 0;

  while (true) {
    const requestLimit = limit ? Math.min(pageSize, Math.max(limit - collected.length, 0)) : pageSize;
    if (requestLimit <= 0) break;

    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: requestLimit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw new Error(error.message);
    }

    const rows = Array.isArray(data) ? data : [];
    for (const item of rows) {
      if (!item?.name) continue;
      collected.push({
        path: `${prefix}${item.name}`,
        name: item.name,
        metadata: item.metadata || {},
      });
      if (limit && collected.length >= limit) {
        break;
      }
    }

    if (rows.length < requestLimit) break;
    if (limit && collected.length >= limit) break;
    offset += rows.length;
  }

  return collected;
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

  const manifest = [];
  const allPaths = [];
  let bytesTotal = 0;

  for (const prefix of options.prefixes) {
    console.log(`Listing Supabase Storage prefix: ${prefix}`);
    const rows = await listObjectsForPrefix(
      supabase,
      options.bucket,
      prefix,
      options.limit ? Math.max(options.limit - allPaths.length, 0) : null,
      options.pageSize
    );

    for (const row of rows) {
      const size = Number.parseInt(String(row.metadata?.size || "0"), 10) || 0;
      bytesTotal += size;
      allPaths.push(row.path);
      manifest.push({
        bucket: options.bucket,
        path: row.path,
        size,
        status: options.dryRun ? "dry-run" : "pending-delete",
      });
    }

    if (options.limit && allPaths.length >= options.limit) {
      break;
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun: options.dryRun,
        bucket: options.bucket,
        prefixes: options.prefixes,
        selectedCount: allPaths.length,
        bytesTotal,
      },
      null,
      2
    )
  );

  if (!options.dryRun && allPaths.length > 0) {
    for (let index = 0; index < allPaths.length; index += 100) {
      const chunk = allPaths.slice(index, index + 100);
      const { error } = await supabase.storage.from(options.bucket).remove(chunk);
      if (error) {
        throw new Error(error.message);
      }
      console.log(`Deleted ${Math.min(index + chunk.length, allPaths.length)}/${allPaths.length} objects...`);
    }

    for (const item of manifest) {
      item.status = "deleted";
    }
  }

  const manifestPath = path.resolve(
    process.cwd(),
    `supabase-storage-clear-manifest-${Date.now()}.json`
  );
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(
    JSON.stringify(
      {
        dryRun: options.dryRun,
        bucket: options.bucket,
        prefixes: options.prefixes,
        deletedCount: options.dryRun ? 0 : allPaths.length,
        selectedCount: allPaths.length,
        bytesTotal,
        manifestPath,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
