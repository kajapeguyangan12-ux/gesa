import { getDownloadURL, ref, uploadString } from "firebase/storage";
import { storage } from "@/lib/firebase";

export const ADMIN_BUNDLE_VERSION = 1;

export interface AdminBundleMeta {
  version: number;
  generatedAt: string;
  generatedBy: string;
  source: "storage-bundle";
}

export interface AdminReportsBundleItem {
  id: string;
  title: string;
  date: string;
  dateDisplay?: string;
  time: string;
  timeDisplay?: string;
  location: string;
  officer: string;
  watt: string;
  meter: string;
  voltage: string;
  kabupaten?: string;
  modifiedBy?: string;
  status?: string;
  createdAt?: unknown;
}

export interface AdminReportsBundle extends AdminBundleMeta {
  reports: AdminReportsBundleItem[];
}

export interface DashboardBundleReportSummary {
  totalData: number;
  totalTitik: number;
  totalLampu: number;
  totalMenunggu: number;
  totalDiverifikasi: number;
  totalTervalidasi: number;
  totalDitolak: number;
  totalSurveyor: number;
}

export interface DashboardBundleKecamatanSummary extends DashboardBundleReportSummary {
  kecamatan: string;
}

export interface DashboardBundleRow {
  id: string;
  taskId?: string;
  status: string;
  title?: string;
  type: string;
  surveyorName?: string;
  verifiedBy?: string;
  verifiedAt?: unknown;
  kabupaten?: string;
  kecamatan?: string;
  jumlahLampu?: number;
  desa?: string;
  createdAt?: unknown;
  category?: string;
}

export interface GesaSurveyDashboardBundle extends AdminBundleMeta {
  kabupatenScope: string;
  totalUniqueSurveyors: number;
  propose: DashboardBundleReportSummary;
  existing: DashboardBundleReportSummary;
  praExisting: DashboardBundleReportSummary;
  praExistingByKecamatan: DashboardBundleKecamatanSummary[];
  allRows: DashboardBundleRow[];
}

function normalizeScope(scope?: string | null) {
  const normalized = (scope || "all").trim().toLowerCase();
  return normalized.replace(/[^a-z0-9-]+/g, "-") || "all";
}

export function getAdminReportsBundlePath() {
  return "admin-bundles/reports/latest.json";
}

export function getGesaSurveyDashboardBundlePath(activeKabupaten?: string | null) {
  return `admin-bundles/gesa-survey/${normalizeScope(activeKabupaten)}.json`;
}

export async function readJsonBundle<T>(path: string): Promise<T | null> {
  if (!storage) return null;

  try {
    const response = await fetch(`/api/proxy-storage-json?path=${encodeURIComponent(path)}`, { cache: "no-store" });
    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch bundle ${path} via proxy: ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "storage/object-not-found") {
      return null;
    }

    try {
      const downloadUrl = await getDownloadURL(ref(storage, path));
      const response = await fetch(downloadUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to fetch bundle ${path}: ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (fallbackError) {
      const fallbackCode =
        typeof fallbackError === "object" && fallbackError && "code" in fallbackError ? String(fallbackError.code) : "";
      if (fallbackCode === "storage/object-not-found") {
        return null;
      }

      console.error(`Failed to read JSON bundle at ${path}:`, fallbackError);
    }

    return null;
  }
}

export async function writeJsonBundle(path: string, payload: unknown): Promise<void> {
  if (!storage) {
    throw new Error("Firebase Storage belum siap di browser.");
  }

  await uploadString(
    ref(storage, path),
    JSON.stringify(payload),
    "raw",
    { contentType: "application/json; charset=utf-8" }
  );
}
