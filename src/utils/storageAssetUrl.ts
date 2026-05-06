const SUPABASE_PUBLIC_MARKER = "/storage/v1/object/public/";
const SUPABASE_BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") || "";
const DEFAULT_REPORT_BUCKET = "report-attachments";
const DEFAULT_TASK_BUCKET = "task-attachments";

function extractFirebaseObjectPath(url: string) {
  if (!url.includes("firebasestorage.googleapis.com")) return "";

  try {
    const parsed = new URL(url);
    const marker = "/o/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return "";
    return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length)).replace(/^\/+/, "");
  } catch {
    return "";
  }
}

function decodeLegacyAssetUrl(url: string) {
  if (!url.startsWith("/api/storage/asset?")) return url;

  try {
    const parsed = new URL(url, "http://localhost");
    return parsed.searchParams.get("url")?.trim() || "";
  } catch {
    const match = url.match(/[?&]url=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }
}

function resolveBucketForObjectPath(objectPath: string) {
  if (objectPath.startsWith("tasks/")) {
    return DEFAULT_TASK_BUCKET;
  }

  return DEFAULT_REPORT_BUCKET;
}

function buildSupabasePublicUrl(objectPath: string) {
  if (!SUPABASE_BASE_URL) return objectPath;
  const normalizedPath = objectPath.replace(/^\/+/, "");
  const encodedPath = normalizedPath.split("/").map(encodeURIComponent).join("/");
  const bucket = resolveBucketForObjectPath(normalizedPath);
  return `${SUPABASE_BASE_URL}${SUPABASE_PUBLIC_MARKER}${encodeURIComponent(bucket)}/${encodedPath}`;
}

export function toStorageAssetUrl(url?: string | null) {
  if (!url) return "";
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;

  const normalizedUrl = decodeLegacyAssetUrl(url.trim());
  if (!normalizedUrl) return "";
  if (/^https?:\/\//i.test(normalizedUrl)) {
    const firebaseObjectPath = extractFirebaseObjectPath(normalizedUrl);
    if (!firebaseObjectPath) return normalizedUrl;

    // Legacy public report-grid photos were uploaded under petugas-photos/
    // and can now be served directly from Supabase once migrated.
    if (firebaseObjectPath.startsWith("petugas-photos/")) {
      return buildSupabasePublicUrl(firebaseObjectPath);
    }

    return normalizedUrl;
  }

  return buildSupabasePublicUrl(normalizedUrl);
}

export function openStorageAssetUrl(url?: string | null) {
  const target = toStorageAssetUrl(url);
  if (!target || typeof window === "undefined") return;
  window.open(target, "_blank", "noopener,noreferrer");
}
