import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

type StorageTarget = {
  bucket: string;
  path: string;
};

function extractTargetsFromString(value: string, targets: Map<string, StorageTarget>) {
  if (!value.includes("/storage/v1/object/public/")) return;

  try {
    const parsed = new URL(value);
    const marker = "/storage/v1/object/public/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return;

    const remainder = parsed.pathname.slice(markerIndex + marker.length);
    const [bucketSegment, ...pathSegments] = remainder.split("/");
    if (!bucketSegment || pathSegments.length === 0) return;

    const bucket = decodeURIComponent(bucketSegment);
    const objectPath = pathSegments.map((segment) => decodeURIComponent(segment)).join("/");
    if (!bucket || !objectPath) return;

    targets.set(`${bucket}:${objectPath}`, {
      bucket,
      path: objectPath,
    });
  } catch {
    return;
  }
}

function collectStorageTargets(value: unknown, targets: Map<string, StorageTarget>) {
  if (typeof value === "string") {
    extractTargetsFromString(value, targets);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStorageTargets(item, targets);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const nestedValue of Object.values(value)) {
      collectStorageTargets(nestedValue, targets);
    }
  }
}

export function listSupabaseStorageTargets(...values: unknown[]) {
  const targets = new Map<string, StorageTarget>();
  for (const value of values) {
    collectStorageTargets(value, targets);
  }
  return Array.from(targets.values());
}

export async function cleanupSupabaseStorageObjects(...values: unknown[]) {
  const targets = listSupabaseStorageTargets(...values);
  if (targets.length === 0) {
    return { deletedCount: 0, targets: [] as StorageTarget[] };
  }

  const grouped = new Map<string, string[]>();
  for (const target of targets) {
    const paths = grouped.get(target.bucket) || [];
    paths.push(target.path);
    grouped.set(target.bucket, paths);
  }

  const supabase = getSupabaseAdminClient();
  for (const [bucket, paths] of grouped.entries()) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) {
      throw new Error(`Gagal menghapus file storage di bucket '${bucket}': ${error.message}`);
    }
  }

  return {
    deletedCount: targets.length,
    targets,
  };
}
