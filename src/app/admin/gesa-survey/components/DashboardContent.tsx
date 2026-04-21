"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { collection, doc, getDoc, getDocs, query, setDoc, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { clearCachedData, fetchWithCache } from "@/utils/firestoreCache";
import { useAuth } from "@/hooks/useAuth";

interface DashboardContentProps {
  setActiveMenu: (menu: string) => void;
  isSuperAdmin: boolean;
  activeKabupaten?: string | null;
  isActive?: boolean;
}

type SurveyStatus = "menunggu" | "diverifikasi" | "tervalidasi" | "ditolak";

interface SurveyReportRow {
  id: string;
  taskId?: string;
  status: string;
  title?: string;
  type: string;
  surveyorName?: string;
  verifiedBy?: string;
  verifiedAt?: TimestampLike;
  updatedAt?: TimestampLike;
  kabupaten?: string;
  kecamatan?: string;
  jenisLampu?: string;
  jumlahLampu?: number;
}

type TimestampLike =
  | { toDate?: () => Date; seconds?: number }
  | Date
  | string
  | number
  | null
  | undefined;

interface ReportSummary {
  totalData: number;
  totalTitik: number;
  totalLampu: number;
  totalMenunggu: number;
  totalDiverifikasi: number;
  totalTervalidasi: number;
  totalDitolak: number;
  totalSurveyor: number;
}

interface KecamatanSummary extends ReportSummary {
  kecamatan: string;
}

interface LampTypeSummaryRow {
  lampType: string;
  surveyCount: number;
  lampCount: number;
  percentage: number;
}

interface DashboardReportState {
  loading: boolean;
  error: string;
  allRows: SurveyReportRow[];
  allRowsRaw: SurveyReportRow[];
  totalUniqueSurveyors: number;
  propose: ReportSummary;
  existing: ReportSummary;
  praExisting: ReportSummary;
  praExistingByKecamatan: KecamatanSummary[];
}

const emptySummary: ReportSummary = {
  totalData: 0,
  totalTitik: 0,
  totalLampu: 0,
  totalMenunggu: 0,
  totalDiverifikasi: 0,
  totalTervalidasi: 0,
  totalDitolak: 0,
  totalSurveyor: 0,
};

const initialReportState: DashboardReportState = {
  loading: false,
  error: "",
  allRows: [],
  allRowsRaw: [],
  totalUniqueSurveyors: 0,
  propose: emptySummary,
  existing: emptySummary,
  praExisting: emptySummary,
  praExistingByKecamatan: [],
};
const DASHBOARD_REPORT_CACHE_TTL_MS = 5 * 60 * 1000;
const DASHBOARD_SUMMARY_CACHE_TTL_MS = 10 * 60 * 1000;
const DASHBOARD_SUMMARY_REFRESH_INTERVAL_MS = 30000;

interface DashboardSummaryDocument {
  totalUniqueSurveyors?: number;
  propose?: Partial<ReportSummary>;
  existing?: Partial<ReportSummary>;
  praExisting?: Partial<ReportSummary>;
  praExistingByKecamatan?: Array<Partial<KecamatanSummary> & { kecamatan?: string }>;
}

interface GesaSurveyDashboardBundle {
  generatedAt?: string;
  totalUniqueSurveyors?: number;
  propose?: Partial<ReportSummary>;
  existing?: Partial<ReportSummary>;
  praExisting?: Partial<ReportSummary>;
  praExistingByKecamatan?: Array<Partial<KecamatanSummary> & { kecamatan?: string }>;
  allRows?: SurveyReportRow[];
}

type DashboardBundleSource = "supabase" | "firestore";

interface TaskExportRecord {
  id: string;
  title: string;
  status: string;
  type: string;
  surveyorName: string;
  createdByAdminName: string;
  createdByAdminEmail: string;
  createdAt?: TimestampLike;
}

function resolveTimestamp(value: TimestampLike) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "object") {
    if ("toDate" in value && typeof value.toDate === "function") {
      const parsed = value.toDate();
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if ("seconds" in value && typeof value.seconds === "number") {
      const parsed = new Date(value.seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value: TimestampLike) {
  const date = resolveTimestamp(value);
  if (!date) return "-";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeLampCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function buildSummary(rows: SurveyReportRow[]): ReportSummary {
  const surveyors = new Set<string>();

  return rows.reduce<ReportSummary>((summary, row) => {
    if (row.surveyorName) {
      surveyors.add(row.surveyorName.trim().toLowerCase());
    }

    const status = row.status?.toLowerCase() as SurveyStatus;

    summary.totalData += 1;
    summary.totalTitik += 1;
    summary.totalLampu += row.jumlahLampu ?? 0;

    if (status === "menunggu") summary.totalMenunggu += 1;
    if (status === "diverifikasi") summary.totalDiverifikasi += 1;
    if (status === "tervalidasi") summary.totalTervalidasi += 1;
    if (status === "ditolak") summary.totalDitolak += 1;

    summary.totalSurveyor = surveyors.size;
    return summary;
  }, { ...emptySummary });
}

function buildKecamatanSummary(rows: SurveyReportRow[]) {
  const grouped = new Map<string, SurveyReportRow[]>();

  rows.forEach((row) => {
    const key = row.kecamatan?.trim() || "Tanpa Kecamatan";
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)?.push(row);
  });

  return Array.from(grouped.entries())
    .map(([kecamatan, items]) => ({
      kecamatan,
      ...buildSummary(items),
    }))
    .sort((a, b) => b.totalData - a.totalData || a.kecamatan.localeCompare(b.kecamatan));
}

function mergeSummary(partial?: Partial<ReportSummary>): ReportSummary {
  return {
    ...emptySummary,
    ...partial,
  };
}

function normalizeLampTypeLabel(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  const lower = normalized.toLowerCase();

  if (lower.includes("mercury")) return "Mercury";
  if (lower.includes("led")) return "LED";
  if (lower.includes("son") || lower.includes("sodium") || lower.includes("hps")) return "SON-T / Sodium";
  if (lower === "tl" || lower.includes("fluorescent")) return "TL / Fluorescent";
  if (lower.includes("cfl") || lower === "pl" || lower.includes("compact fluorescent")) return "CFL / PL";
  if (lower.includes("halogen")) return "Halogen";

  return normalized
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function buildLampTypeSummary(rows: SurveyReportRow[]): LampTypeSummaryRow[] {
  const grouped = new Map<string, { surveyCount: number; lampCount: number }>();

  for (const row of rows) {
    const lampType = normalizeLampTypeLabel(row.jenisLampu);
    if (!lampType) continue;
    const current = grouped.get(lampType) || { surveyCount: 0, lampCount: 0 };
    current.surveyCount += 1;
    current.lampCount += row.jumlahLampu ?? 0;
    grouped.set(lampType, current);
  }

  const totalLampCount = Array.from(grouped.values()).reduce((sum, item) => sum + item.lampCount, 0);

  return Array.from(grouped.entries())
    .map(([lampType, item]) => ({
      lampType,
      surveyCount: item.surveyCount,
      lampCount: item.lampCount,
      percentage: totalLampCount > 0 ? (item.lampCount / totalLampCount) * 100 : 0,
    }))
    .sort((left, right) => right.lampCount - left.lampCount || right.surveyCount - left.surveyCount || left.lampType.localeCompare(right.lampType));
}

function normalizeKecamatanSummaryRow(
  row: Partial<KecamatanSummary> & { kecamatan?: string }
): KecamatanSummary {
  return {
    kecamatan: row.kecamatan?.trim() || "Tanpa Kecamatan",
    ...mergeSummary(row),
  };
}

function mapBundleToReportState(bundle: GesaSurveyDashboardBundle): DashboardReportState {
  return {
    loading: false,
    error: "",
    allRows: Array.isArray(bundle.allRows) ? (bundle.allRows as SurveyReportRow[]) : [],
    allRowsRaw: Array.isArray(bundle.allRows) ? (bundle.allRows as SurveyReportRow[]) : [],
    totalUniqueSurveyors: typeof bundle.totalUniqueSurveyors === "number" ? bundle.totalUniqueSurveyors : 0,
    propose: mergeSummary(bundle.propose),
    existing: mergeSummary(bundle.existing),
    praExisting: mergeSummary(bundle.praExisting),
    praExistingByKecamatan: Array.isArray(bundle.praExistingByKecamatan)
      ? bundle.praExistingByKecamatan.map(normalizeKecamatanSummaryRow)
      : [],
  };
}

async function fetchDashboardSummary(activeKabupaten?: string | null) {
  const summaryDocId = `gesa-survey_${activeKabupaten || "all"}_super`;
  return await fetchWithCache<DashboardSummaryDocument | null>(
    `dashboard_summary_${summaryDocId}`,
    async () => {
      const snapshot = await getDoc(doc(db, "dashboard-summaries", summaryDocId));
      return snapshot.exists() ? (snapshot.data() as DashboardSummaryDocument) : null;
    },
    DASHBOARD_SUMMARY_CACHE_TTL_MS
  );
}

async function fetchCollectionRows(collectionName: string, activeKabupaten?: string | null) {
  return await fetchWithCache<SurveyReportRow[]>(
    `dashboard_rows_${collectionName}_${activeKabupaten || "all"}`,
    async () => {
      const surveysRef = collection(db, collectionName);
      const snapshot = activeKabupaten
        ? await getDocs(query(surveysRef, where("kabupaten", "==", activeKabupaten), orderBy("createdAt", "desc")))
        : await getDocs(query(surveysRef, orderBy("createdAt", "desc")));

      return snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          taskId: typeof data.taskId === "string" ? data.taskId : "",
          status: typeof data.status === "string" ? data.status : "",
          title: typeof data.title === "string" ? data.title : "",
          type: collectionName.replace("survey-", ""),
          surveyorName: typeof data.surveyorName === "string" ? data.surveyorName : "",
          verifiedBy:
            typeof data.verifiedBy === "string"
              ? data.verifiedBy
              : "",
          verifiedAt: data.verifiedAt,
          kabupaten: typeof data.kabupaten === "string" ? data.kabupaten : "",
          kecamatan: typeof data.kecamatan === "string" ? data.kecamatan : "",
          jumlahLampu: normalizeLampCount(data.jumlahLampu),
          desa: typeof data.desa === "string" ? data.desa : "",
          createdAt: data.createdAt,
          category: collectionName,
        };
      });
    },
    120_000
  );
}

async function fetchTaskExportRecords() {
  return await fetchWithCache<TaskExportRecord[]>(
    "dashboard_task_export_records_v1",
    async () => {
      try {
        const response = await fetch("/api/admin/tasks-export", { cache: "no-store" });
        if (response.ok) {
          const payload = (await response.json()) as { tasks?: TaskExportRecord[] };
          if (Array.isArray(payload.tasks)) return payload.tasks;
        }
      } catch (error) {
        console.error("Supabase task export fetch failed, fallback to Firestore:", error);
      }

      const tasksRef = collection(db, "tasks");
      const snapshot = await getDocs(query(tasksRef, orderBy("createdAt", "desc")));

      return snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          title: typeof data.title === "string" ? data.title : "Tanpa Judul",
          status: typeof data.status === "string" ? data.status : "-",
          type: typeof data.type === "string" ? data.type : "-",
          surveyorName: typeof data.surveyorName === "string" ? data.surveyorName : "-",
          createdByAdminName: typeof data.createdByAdminName === "string" ? data.createdByAdminName : "Admin",
          createdByAdminEmail: typeof data.createdByAdminEmail === "string" ? data.createdByAdminEmail : "-",
          createdAt: data.createdAt,
        } satisfies TaskExportRecord;
      });
    },
    5 * 60 * 1000
  );
}

interface VerifierSummaryRow {
  verifierName: string;
  totalData: number;
  totalTitik: number;
  totalLampu: number;
  existingCount: number;
  proposeCount: number;
  praExistingCount: number;
  firstVerifiedAt: Date | null;
  lastVerifiedAt: Date | null;
}

interface DailyVerificationSummaryRow {
  dateKey: string;
  dateLabel: string;
  totalVerifikasi: number;
  totalTitik: number;
  totalLampu: number;
  existingCount: number;
  proposeCount: number;
  praExistingCount: number;
  firstVerifiedAt: Date | null;
  lastVerifiedAt: Date | null;
}

function buildVerifierSummary(rows: SurveyReportRow[]) {
  const grouped = new Map<string, VerifierSummaryRow>();

  rows.forEach((row) => {
    const status = row.status?.toLowerCase();
    const verifiedDate = resolveTimestamp(row.verifiedAt);
    if (status !== "diverifikasi" || !verifiedDate) return;

    const verifierName = row.verifiedBy?.trim() || "Admin";
    const current =
      grouped.get(verifierName) ||
      ({
        verifierName,
        totalData: 0,
        totalTitik: 0,
        totalLampu: 0,
        existingCount: 0,
        proposeCount: 0,
        praExistingCount: 0,
        firstVerifiedAt: null,
        lastVerifiedAt: null,
      } satisfies VerifierSummaryRow);

    current.totalData += 1;
    current.totalTitik += 1;
    current.totalLampu += row.jumlahLampu ?? 0;

    if (row.type === "existing") current.existingCount += 1;
    if (row.type === "apj-propose") current.proposeCount += 1;
    if (row.type === "pra-existing") current.praExistingCount += 1;

    if (!current.firstVerifiedAt || verifiedDate < current.firstVerifiedAt) {
      current.firstVerifiedAt = verifiedDate;
    }
    if (!current.lastVerifiedAt || verifiedDate > current.lastVerifiedAt) {
      current.lastVerifiedAt = verifiedDate;
    }

    grouped.set(verifierName, current);
  });

  return Array.from(grouped.values()).sort(
    (a, b) =>
      b.totalData - a.totalData ||
      (b.lastVerifiedAt?.getTime() || 0) - (a.lastVerifiedAt?.getTime() || 0) ||
      a.verifierName.localeCompare(b.verifierName)
  );
}

function buildDailyVerificationSummary(rows: SurveyReportRow[]) {
  const grouped = new Map<string, DailyVerificationSummaryRow>();

  rows.forEach((row) => {
    const verifiedDate = resolveTimestamp(row.verifiedAt);
    if (!verifiedDate) return;

    const dateKey = `${verifiedDate.getFullYear()}-${`${verifiedDate.getMonth() + 1}`.padStart(2, "0")}-${`${verifiedDate.getDate()}`.padStart(2, "0")}`;
    const current =
      grouped.get(dateKey) ||
      ({
        dateKey,
        dateLabel: verifiedDate.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }),
        totalVerifikasi: 0,
        totalTitik: 0,
        totalLampu: 0,
        existingCount: 0,
        proposeCount: 0,
        praExistingCount: 0,
        firstVerifiedAt: null,
        lastVerifiedAt: null,
      } satisfies DailyVerificationSummaryRow);

    current.totalVerifikasi += 1;
    current.totalTitik += 1;
    current.totalLampu += row.jumlahLampu ?? 0;

    if (row.type === "existing") current.existingCount += 1;
    if (row.type === "apj-propose") current.proposeCount += 1;
    if (row.type === "pra-existing") current.praExistingCount += 1;

    if (!current.firstVerifiedAt || verifiedDate < current.firstVerifiedAt) {
      current.firstVerifiedAt = verifiedDate;
    }
    if (!current.lastVerifiedAt || verifiedDate > current.lastVerifiedAt) {
      current.lastVerifiedAt = verifiedDate;
    }

    grouped.set(dateKey, current);
  });

  return Array.from(grouped.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

function SummaryMetric({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function PatchSummaryCard({
  title,
  subtitle,
  accentClass,
  summary,
}: {
  title: string;
  subtitle: string;
  accentClass: string;
  summary: ReportSummary;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${accentClass}`}>
          {summary.totalData} data
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryMetric label="Menunggu" value={summary.totalMenunggu} accent="text-amber-600" />
        <SummaryMetric label="Diverifikasi" value={summary.totalDiverifikasi} accent="text-blue-600" />
        <SummaryMetric label="Tervalidasi" value={summary.totalTervalidasi} accent="text-emerald-600" />
        <SummaryMetric label="Ditolak" value={summary.totalDitolak} accent="text-rose-600" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-gray-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Total Titik</p>
          <p className="mt-2 text-xl font-bold text-gray-900">{summary.totalTitik}</p>
        </div>
        <div className="rounded-2xl bg-gray-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Total Lampu</p>
          <p className="mt-2 text-xl font-bold text-gray-900">{summary.totalLampu}</p>
        </div>
        <div className="rounded-2xl bg-gray-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Petugas Aktif</p>
          <p className="mt-2 text-xl font-bold text-gray-900">{summary.totalSurveyor}</p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardContent({
  setActiveMenu,
  isSuperAdmin,
  activeKabupaten,
  isActive = false,
}: DashboardContentProps) {
  const { user } = useAuth();
  const [reportState, setReportState] = useState<DashboardReportState>(initialReportState);
  const [reportsVisible, setReportsVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoaded, setDetailLoaded] = useState(false);
  const [summaryRefreshing, setSummaryRefreshing] = useState(false);
  const [taskExporting, setTaskExporting] = useState(false);
  const [bundleSource, setBundleSource] = useState<DashboardBundleSource>("firestore");
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");
  const [summaryVersion, setSummaryVersion] = useState(0);
  const latestSummaryFingerprintRef = useRef("");
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return formatDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1));
  });
  const [endDate, setEndDate] = useState(() => formatDateInputValue(new Date()));
  const reportCacheKey = useMemo(
    () => `dashboard_reports_${isSuperAdmin ? "super" : user?.uid || "guest"}_${activeKabupaten || "all"}`,
    [activeKabupaten, isSuperAdmin, user?.uid]
  );
  const dashboardSummaryDocId = useMemo(
    () => `gesa-survey_${activeKabupaten || "all"}_super`,
    [activeKabupaten]
  );
  const dashboardApiQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (activeKabupaten) params.set("kabupaten", activeKabupaten);
    if (!isSuperAdmin && user?.uid) params.set("adminId", user.uid);
    return params.toString();
  }, [activeKabupaten, isSuperAdmin, user?.uid]);
  const dashboardSummaryApiQuery = useMemo(() => {
    const params = new URLSearchParams(dashboardApiQuery);
    params.set("compact", "1");
    return params.toString();
  }, [dashboardApiQuery]);

  const persistReportCache = (data: DashboardReportState) => {
    if (isSuperAdmin || typeof window === "undefined") return;

    try {
      window.sessionStorage.setItem(
        reportCacheKey,
        JSON.stringify({
          savedAt: Date.now(),
          data,
        })
      );
    } catch (error) {
      console.warn("Failed to persist dashboard detail cache:", error);
      try {
        window.sessionStorage.removeItem(reportCacheKey);
      } catch {
        // Ignore cleanup errors.
      }
    }
  };

  const buildSummaryFingerprint = (payload: {
    generatedAt?: string;
    lastDataChangeAt?: string;
    totalUniqueSurveyors?: number;
    propose?: Partial<ReportSummary>;
    existing?: Partial<ReportSummary>;
    praExisting?: Partial<ReportSummary>;
  }) => {
    return [
      payload.lastDataChangeAt || payload.generatedAt || "",
      payload.totalUniqueSurveyors ?? 0,
      payload.propose?.totalData ?? 0,
      payload.propose?.totalMenunggu ?? 0,
      payload.propose?.totalDiverifikasi ?? 0,
      payload.propose?.totalTervalidasi ?? 0,
      payload.propose?.totalDitolak ?? 0,
      payload.existing?.totalData ?? 0,
      payload.existing?.totalMenunggu ?? 0,
      payload.existing?.totalDiverifikasi ?? 0,
      payload.existing?.totalTervalidasi ?? 0,
      payload.existing?.totalDitolak ?? 0,
      payload.praExisting?.totalData ?? 0,
      payload.praExisting?.totalMenunggu ?? 0,
      payload.praExisting?.totalDiverifikasi ?? 0,
      payload.praExisting?.totalTervalidasi ?? 0,
      payload.praExisting?.totalDitolak ?? 0,
      activeKabupaten || "all",
      isSuperAdmin ? "super" : user?.uid || "admin",
    ].join("|");
  };

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;

    const hydrateFromSummary = async (background = false) => {
      try {
        try {
          const response = await fetch(`/api/admin/gesa-survey?${dashboardSummaryApiQuery}`, {
            cache: "no-store",
          });
          if (response.ok) {
            const payload = (await response.json()) as {
              generatedAt?: string;
              lastDataChangeAt?: string;
              totalUniqueSurveyors?: number;
              propose?: Partial<ReportSummary>;
              existing?: Partial<ReportSummary>;
              praExisting?: Partial<ReportSummary>;
              praExistingByKecamatan?: Array<Partial<KecamatanSummary> & { kecamatan?: string }>;
            };
            const nextFingerprint = buildSummaryFingerprint(payload);

            if (!cancelled) {
              if (background && nextFingerprint === latestSummaryFingerprintRef.current) {
                return;
              }

              const shouldNotifyDetail = background && latestSummaryFingerprintRef.current !== "" && nextFingerprint !== latestSummaryFingerprintRef.current;
              latestSummaryFingerprintRef.current = nextFingerprint;
              setBundleSource("supabase");
              setLastUpdatedAt(payload.lastDataChangeAt || payload.generatedAt || new Date().toISOString());
              setReportState((current) => ({
                ...current,
                totalUniqueSurveyors:
                  typeof payload.totalUniqueSurveyors === "number"
                    ? payload.totalUniqueSurveyors
                    : current.totalUniqueSurveyors,
                propose: mergeSummary(payload.propose),
                existing: mergeSummary(payload.existing),
                praExisting: mergeSummary(payload.praExisting),
                praExistingByKecamatan: Array.isArray(payload.praExistingByKecamatan)
                  ? payload.praExistingByKecamatan.map(normalizeKecamatanSummaryRow)
                  : current.praExistingByKecamatan,
              }));
              if (shouldNotifyDetail) {
                setSummaryVersion((current) => current + 1);
              }
              return;
            }
          }
        } catch (error) {
          console.error("Supabase dashboard summary fetch failed, fallback to Firestore:", error);
        }

        const summary = await fetchDashboardSummary(activeKabupaten);
        if (!summary || cancelled) return;

        setBundleSource("firestore");
        setLastUpdatedAt(new Date().toISOString());
        setReportState((current) => ({
          ...current,
          totalUniqueSurveyors:
            typeof summary.totalUniqueSurveyors === "number"
              ? summary.totalUniqueSurveyors
              : current.totalUniqueSurveyors,
          propose: mergeSummary(summary.propose),
          existing: mergeSummary(summary.existing),
          praExisting: mergeSummary(summary.praExisting),
          praExistingByKecamatan: Array.isArray(summary.praExistingByKecamatan)
            ? summary.praExistingByKecamatan.map(normalizeKecamatanSummaryRow)
            : current.praExistingByKecamatan,
        }));
      } catch (error) {
        console.error("Failed to load dashboard summary:", error);
      }
    };

    void hydrateFromSummary();

    const intervalId = window.setInterval(() => {
      void hydrateFromSummary(true);
    }, DASHBOARD_SUMMARY_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeKabupaten, dashboardSummaryApiQuery, isSuperAdmin, isActive]);

  useEffect(() => {
    if (!isActive || !detailVisible) return;
    let cancelled = false;

    const loadReports = async (background = false) => {
      try {
        setReportState((current) => ({
          ...current,
          loading: background ? current.loading : current.allRows.length === 0,
          error: "",
        }));

        try {
          const response = await fetch(
            `/api/admin/gesa-survey?${dashboardApiQuery}${dashboardApiQuery ? "&" : ""}includeDetails=1&dashboardDetail=1`,
            { cache: "no-store" }
          );
          if (response.ok) {
            const payload = (await response.json()) as GesaSurveyDashboardBundle & { lastDataChangeAt?: string };
            if (!cancelled) {
              latestSummaryFingerprintRef.current = buildSummaryFingerprint(payload);
              setBundleSource("supabase");
              setLastUpdatedAt(payload.lastDataChangeAt || payload.generatedAt || new Date().toISOString());
              const mappedState = mapBundleToReportState(payload);
              setReportState(mappedState);
              setDetailLoaded(true);
              persistReportCache(mappedState);
              return;
            }
          }

          if (isSuperAdmin) {
            let apiError = "Gagal memuat detail dashboard dari Supabase.";
            try {
              const payload = (await response.json()) as { error?: string };
              if (typeof payload.error === "string" && payload.error.trim()) {
                apiError = payload.error.trim();
              }
            } catch {
              // Keep default message when error payload is not JSON.
            }

            throw new Error(apiError);
          }
        } catch (error) {
          if (isSuperAdmin) {
            throw error;
          }
          console.error("Supabase dashboard detail fetch failed, fallback to Firestore:", error);
        }

        setBundleSource("firestore");
        setLastUpdatedAt(new Date().toISOString());

        let allowedTaskIds: Set<string> | null = null;

        if (!isSuperAdmin) {
          if (!user?.uid) {
            setReportState({
              ...initialReportState,
              loading: false,
            });
            return;
          }

          const taskSnapshot = await getDocs(
            query(collection(db, "tasks"), where("createdByAdminId", "==", user.uid))
          );

          allowedTaskIds = new Set(
            taskSnapshot.docs
              .map((item) => {
                const data = item.data();
                return typeof data?.id === "string" ? data.id : item.id;
              })
              .filter(Boolean)
          );
        }

        const [proposeRows, existingRows, praExistingRows] = await Promise.all([
          fetchCollectionRows("survey-apj-propose", activeKabupaten),
          fetchCollectionRows("survey-existing", activeKabupaten),
          fetchCollectionRows("survey-pra-existing", activeKabupaten),
        ]);

        if (cancelled) return;

        const filterByAdminTask = (rows: SurveyReportRow[]) => {
          if (!allowedTaskIds) return rows;
          return rows.filter((row) => row.taskId && allowedTaskIds?.has(row.taskId));
        };

        const filteredProposeRows = filterByAdminTask(proposeRows);
        const filteredExistingRows = filterByAdminTask(existingRows);
        const filteredPraExistingRows = filterByAdminTask(praExistingRows);

        const rawRows = [...proposeRows, ...existingRows, ...praExistingRows];
        const filteredRows = [...filteredProposeRows, ...filteredExistingRows, ...filteredPraExistingRows];

        setReportState({
          loading: false,
          error: "",
          allRows: filteredRows,
          allRowsRaw: rawRows,
          totalUniqueSurveyors: new Set(
            filteredRows
              .map((row) => row.surveyorName?.trim().toLowerCase())
              .filter((value): value is string => Boolean(value))
          ).size,
          propose: buildSummary(filteredProposeRows),
          existing: buildSummary(filteredExistingRows),
          praExisting: buildSummary(filteredPraExistingRows),
          praExistingByKecamatan: buildKecamatanSummary(filteredPraExistingRows),
        });

        persistReportCache({
          loading: false,
          error: "",
          allRows: filteredRows,
          allRowsRaw: rawRows,
          totalUniqueSurveyors: new Set(
            filteredRows
              .map((row) => row.surveyorName?.trim().toLowerCase())
              .filter((value): value is string => Boolean(value))
          ).size,
          propose: buildSummary(filteredProposeRows),
          existing: buildSummary(filteredExistingRows),
          praExisting: buildSummary(filteredPraExistingRows),
          praExistingByKecamatan: buildKecamatanSummary(filteredPraExistingRows),
        });
      } catch (error) {
        if (cancelled) return;

        setReportState({
          ...initialReportState,
          loading: false,
          error: error instanceof Error ? error.message : "Gagal memuat laporan dashboard.",
        });
      } finally {
        if (!cancelled) {
          setDetailLoaded(true);
        }
      }
    };

    void loadReports();

    return () => {
      cancelled = true;
    };
  }, [activeKabupaten, dashboardApiQuery, detailVisible, isSuperAdmin, reportCacheKey, user?.uid, isActive, summaryVersion]);

  const waitingReviewCount = useMemo(
    () =>
      reportState.propose.totalMenunggu +
      reportState.existing.totalMenunggu +
      reportState.praExisting.totalMenunggu,
    [reportState.existing.totalMenunggu, reportState.praExisting.totalMenunggu, reportState.propose.totalMenunggu]
  );

  const totalSurveyCount = useMemo(
    () =>
      reportState.propose.totalData +
      reportState.existing.totalData +
      reportState.praExisting.totalData,
    [reportState.existing.totalData, reportState.praExisting.totalData, reportState.propose.totalData]
  );

  const praExistingGrandTotal = useMemo(
    () =>
      reportState.praExistingByKecamatan.reduce<KecamatanSummary>(
        (accumulator, row) => ({
          kecamatan: "Total Semua Kecamatan",
          totalData: accumulator.totalData + row.totalData,
          totalTitik: accumulator.totalTitik + row.totalTitik,
          totalLampu: accumulator.totalLampu + row.totalLampu,
          totalMenunggu: accumulator.totalMenunggu + row.totalMenunggu,
          totalDiverifikasi: accumulator.totalDiverifikasi + row.totalDiverifikasi,
          totalTervalidasi: accumulator.totalTervalidasi + row.totalTervalidasi,
          totalDitolak: accumulator.totalDitolak + row.totalDitolak,
          totalSurveyor: accumulator.totalSurveyor + row.totalSurveyor,
        }),
        {
          kecamatan: "Total Semua Kecamatan",
          ...emptySummary,
        }
      ),
    [reportState.praExistingByKecamatan]
  );
  const lampTypeSummaryRows = useMemo(
    () => buildLampTypeSummary(reportState.allRowsRaw.filter((row) => row.type === "pra-existing")),
    [reportState.allRowsRaw]
  );
  const lampTypeGrandTotal = useMemo(
    () =>
      lampTypeSummaryRows.reduce(
        (accumulator, row) => ({
          surveyCount: accumulator.surveyCount + row.surveyCount,
          lampCount: accumulator.lampCount + row.lampCount,
        }),
        { surveyCount: 0, lampCount: 0 }
      ),
    [lampTypeSummaryRows]
  );
  const activeSourceLabel = bundleSource === "supabase" ? "Supabase" : "Firestore";
  const activeTimestamp = lastUpdatedAt;

  const normalizedDateRange = useMemo(() => {
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;
    return {
      start: start && !Number.isNaN(start.getTime()) ? start : null,
      end: end && !Number.isNaN(end.getTime()) ? end : null,
    };
  }, [endDate, startDate]);

  const verifierDetailRows = useMemo(() => {
    return reportState.allRows
      .filter((row) => row.status?.toLowerCase() === "diverifikasi")
      .filter((row) => {
        const verifiedDate = resolveTimestamp(row.verifiedAt);
        if (!verifiedDate) return false;
        if (normalizedDateRange.start && verifiedDate < normalizedDateRange.start) return false;
        if (normalizedDateRange.end && verifiedDate > normalizedDateRange.end) return false;
        return true;
      })
      .sort((a, b) => (resolveTimestamp(b.verifiedAt)?.getTime() || 0) - (resolveTimestamp(a.verifiedAt)?.getTime() || 0));
  }, [normalizedDateRange.end, normalizedDateRange.start, reportState.allRows]);

  const verifierSummaryRows = useMemo(
    () => buildVerifierSummary(verifierDetailRows),
    [verifierDetailRows]
  );

  const adminIdentityKeys = useMemo(
    () =>
      [user?.name, user?.displayName, user?.email, user?.username]
        .map((value) => value?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value)),
    [user?.displayName, user?.email, user?.name, user?.username]
  );

  const adminOwnVerifiedRows = useMemo(() => {
    if (isSuperAdmin || !adminIdentityKeys.length) return [];

    const rawRows = reportState.allRowsRaw ?? [];
    return rawRows
      .filter((row) => row.status?.toLowerCase() === "diverifikasi")
      .filter((row) => {
        const verifiedBy = row.verifiedBy?.trim().toLowerCase();
        return Boolean(verifiedBy && adminIdentityKeys.includes(verifiedBy));
      })
      .sort((a, b) => (resolveTimestamp(b.verifiedAt)?.getTime() || 0) - (resolveTimestamp(a.verifiedAt)?.getTime() || 0));
  }, [adminIdentityKeys, isSuperAdmin, reportState.allRowsRaw]);

  const adminDailyVerificationRows = useMemo(
    () => buildDailyVerificationSummary(adminOwnVerifiedRows),
    [adminOwnVerifiedRows]
  );

  const verifierGrandTotal = useMemo(
    () =>
      verifierSummaryRows.reduce<VerifierSummaryRow>(
        (accumulator, row) => ({
          verifierName: "Total Semua Admin",
          totalData: accumulator.totalData + row.totalData,
          totalTitik: accumulator.totalTitik + row.totalTitik,
          totalLampu: accumulator.totalLampu + row.totalLampu,
          existingCount: accumulator.existingCount + row.existingCount,
          proposeCount: accumulator.proposeCount + row.proposeCount,
          praExistingCount: accumulator.praExistingCount + row.praExistingCount,
          firstVerifiedAt:
            !accumulator.firstVerifiedAt || (row.firstVerifiedAt && row.firstVerifiedAt < accumulator.firstVerifiedAt)
              ? row.firstVerifiedAt
              : accumulator.firstVerifiedAt,
          lastVerifiedAt:
            !accumulator.lastVerifiedAt || (row.lastVerifiedAt && row.lastVerifiedAt > accumulator.lastVerifiedAt)
              ? row.lastVerifiedAt
              : accumulator.lastVerifiedAt,
        }),
        {
          verifierName: "Total Semua Admin",
          totalData: 0,
          totalTitik: 0,
          totalLampu: 0,
          existingCount: 0,
          proposeCount: 0,
          praExistingCount: 0,
          firstVerifiedAt: null,
          lastVerifiedAt: null,
        }
      ),
    [verifierSummaryRows]
  );

  const handleExportVerifierExcel = () => {
    if (!verifierDetailRows.length) return;

    const summaryHeaders = [
      "No",
      "Nama Admin Verifikasi",
      "Total Verifikasi",
      "Jumlah Titik",
      "Jumlah Lampu",
      "Existing",
      "APJ Propose",
      "Pra Existing",
      "Verifikasi Pertama",
      "Verifikasi Terakhir",
    ];

    const summaryRows = verifierSummaryRows.map((row, index) => [
      index + 1,
      row.verifierName,
      row.totalData,
      row.totalTitik,
      row.totalLampu,
      row.existingCount,
      row.proposeCount,
      row.praExistingCount,
      formatDateTime(row.firstVerifiedAt),
      formatDateTime(row.lastVerifiedAt),
    ]);

    summaryRows.push([
      "",
      verifierGrandTotal.verifierName,
      verifierGrandTotal.totalData,
      verifierGrandTotal.totalTitik,
      verifierGrandTotal.totalLampu,
      verifierGrandTotal.existingCount,
      verifierGrandTotal.proposeCount,
      verifierGrandTotal.praExistingCount,
      formatDateTime(verifierGrandTotal.firstVerifiedAt),
      formatDateTime(verifierGrandTotal.lastVerifiedAt),
    ]);

    const detailHeaders = [
      "No",
      "Nama Admin Verifikasi",
      "Tipe Survey",
      "Judul",
      "Surveyor",
      "Kabupaten",
      "Kecamatan",
      "Jumlah Lampu",
      "Tanggal & Jam Verifikasi",
      "Status",
      "ID Survey",
    ];

    const detailRows = verifierDetailRows.map((row, index) => [
      index + 1,
      row.verifiedBy?.trim() || "Admin",
      row.type,
      row.title || "-",
      row.surveyorName || "-",
      row.kabupaten || "-",
      row.kecamatan || "-",
      row.jumlahLampu ?? 0,
      formatDateTime(row.verifiedAt),
      row.status,
      row.id,
    ]);

    const workbook = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
    const detailSheet = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);

    summarySheet["!cols"] = summaryHeaders.map((header, columnIndex) => ({
      wch: Math.min(
        28,
        Math.max(header.length, ...summaryRows.map((row) => String(row[columnIndex] ?? "").length)) + 2
      ),
    }));

    detailSheet["!cols"] = detailHeaders.map((header, columnIndex) => ({
      wch: Math.min(
        32,
        Math.max(header.length, ...detailRows.map((row) => String(row[columnIndex] ?? "").length)) + 2
      ),
    }));

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Rekap Admin");
    XLSX.utils.book_append_sheet(workbook, detailSheet, "Detail Verifikasi");

    const startLabel = startDate || "semua";
    const endLabel = endDate || "semua";
    XLSX.writeFile(workbook, `rekap-admin-verifikasi-${startLabel}-sampai-${endLabel}.xlsx`);
  };

  const handleRefreshSummary = async () => {
    if (!isSuperAdmin || summaryRefreshing) return;

    try {
      setSummaryRefreshing(true);

      const [proposeRows, existingRows, praExistingRows] = await Promise.all([
        fetchCollectionRows("survey-apj-propose", activeKabupaten),
        fetchCollectionRows("survey-existing", activeKabupaten),
        fetchCollectionRows("survey-pra-existing", activeKabupaten),
      ]);

      const allRows = [...proposeRows, ...existingRows, ...praExistingRows];
      const summaryPayload: DashboardSummaryDocument & {
        kabupatenScope: string;
        updatedAt: Date;
        updatedBy: string;
      } = {
        kabupatenScope: activeKabupaten || "all",
        updatedAt: new Date(),
        updatedBy: user?.email || user?.displayName || "super-admin",
        totalUniqueSurveyors: new Set(
          allRows
            .map((row) => row.surveyorName?.trim().toLowerCase())
            .filter((value): value is string => Boolean(value))
        ).size,
        propose: buildSummary(proposeRows),
        existing: buildSummary(existingRows),
        praExisting: buildSummary(praExistingRows),
        praExistingByKecamatan: buildKecamatanSummary(praExistingRows),
      };

      await setDoc(doc(db, "dashboard-summaries", dashboardSummaryDocId), summaryPayload, { merge: true });
      clearCachedData(`dashboard_summary_${dashboardSummaryDocId}`);
      const mappedState: DashboardReportState = {
        loading: false,
        error: "",
        allRows,
        allRowsRaw: allRows,
        totalUniqueSurveyors: summaryPayload.totalUniqueSurveyors || 0,
        propose: mergeSummary(summaryPayload.propose),
        existing: mergeSummary(summaryPayload.existing),
        praExisting: mergeSummary(summaryPayload.praExisting),
        praExistingByKecamatan: (summaryPayload.praExistingByKecamatan || []).map(normalizeKecamatanSummaryRow),
      };
      persistReportCache(mappedState);

      setBundleSource("firestore");
      setLastUpdatedAt(new Date().toISOString());
      setReportState(mappedState);

      alert("Summary dashboard berhasil diperbarui dari Firestore.");
    } catch (error) {
      console.error("Failed to refresh dashboard summary:", error);
      alert("Gagal memperbarui summary dashboard.");
    } finally {
      setSummaryRefreshing(false);
    }
  };

  const handleToggleReports = () => {
    setReportsVisible((current) => {
      const nextVisible = !current;
      if (!nextVisible) {
        setDetailVisible(false);
      }
      return nextVisible;
    });
  };

  const handleLoadDetail = () => {
    if (!isSuperAdmin) return;
    setReportsVisible(true);
    setDetailVisible(true);
  };

  const handleExportTaskExcel = async () => {
    if (!isSuperAdmin) return;
    if (!detailLoaded || !reportState.allRowsRaw.length) {
      alert("Klik 'Muat Detail' terlebih dahulu agar data survey per tugas bisa dihitung tanpa scan besar dari tombol laporan utama.");
      return;
    }

    try {
      setTaskExporting(true);

      const tasks = await fetchTaskExportRecords();
      const surveyCountByTaskId = reportState.allRowsRaw.reduce<Map<string, number>>((accumulator, row) => {
        const taskId = row.taskId?.trim();
        if (!taskId) return accumulator;
        accumulator.set(taskId, (accumulator.get(taskId) || 0) + 1);
        return accumulator;
      }, new Map<string, number>());

      const headers = [
        "No",
        "Judul Tugas",
        "Admin Pembuat",
        "Email Admin",
        "Surveyor",
        "Tipe Tugas",
        "Status Tugas",
        "Jumlah Data Survey Masuk",
        "Tanggal Dibuat",
      ];

      const rows = tasks.map((task, index) => [
        index + 1,
        task.title,
        task.createdByAdminName,
        task.createdByAdminEmail,
        task.surveyorName,
        task.type,
        task.status,
        surveyCountByTaskId.get(task.id) || 0,
        formatDateTime(task.createdAt),
      ]);

      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      sheet["!cols"] = headers.map((header, columnIndex) => ({
        wch: Math.min(
          36,
          Math.max(header.length, ...rows.map((row) => String(row[columnIndex] ?? "").length)) + 2
        ),
      }));

      XLSX.utils.book_append_sheet(workbook, sheet, "Rekap Tugas Admin");
      XLSX.writeFile(workbook, `rekap-tugas-admin-${activeKabupaten || "semua-kabupaten"}.xlsx`);
    } catch (error) {
      console.error("Failed to export task excel:", error);
      alert("Gagal export Excel tugas admin.");
    } finally {
      setTaskExporting(false);
    }
  };

  return (
    <>
      <div className="mb-6 bg-gradient-to-r from-green-600 to-green-700 rounded-2xl shadow-lg p-4 lg:p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl lg:text-2xl font-bold text-white mb-1">Dashboard Survey</h2>
              <p className="text-sm text-green-100">Kelola dan pantau aktivitas survey</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-all border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-2">Distribusi Tugas</h3>
          <p className="text-sm text-gray-600 mb-4">Kelola distribusi tugas survey kepada petugas</p>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-green-600">{totalSurveyCount}</div>
            <button
              onClick={() => setActiveMenu("distribusi-tugas")}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-medium"
            >
              Kelola
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-all border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-2">Verifikasi</h3>
          <p className="text-sm text-gray-600 mb-4">
            {isSuperAdmin
              ? "Review hasil survey tahap awal sebelum masuk ke validasi data."
              : "Review dan verifikasi hasil survey tahap awal."}
          </p>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-blue-600">{waitingReviewCount}</div>
            <button
              onClick={() => setActiveMenu("validasi-survey")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium"
            >
              Kelola
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-all border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-2">Progress Surveyor</h3>
          <p className="text-sm text-gray-600 mb-4">Monitor progress petugas survey</p>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-purple-600">{reportState.totalUniqueSurveyors}</div>
            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all text-sm font-medium">
              Lihat
            </button>
          </div>
        </div>
      </div>

      <section className="mt-8 space-y-6">
          <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-6 text-white shadow-xl">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
                  {isSuperAdmin ? "Laporan Superadmin" : "Laporan Admin"}
                </p>
                <h3 className="mt-2 text-2xl font-bold">Rekap Survey per Patch dan Kecamatan</h3>
                <p className="mt-2 max-w-3xl text-sm text-slate-200">
                  {isSuperAdmin
                    ? "Ringkasan ini menggabungkan seluruh hasil survey berdasarkan patch data dan merinci `pra-existing` per kecamatan agar monitoring verifikasi, validasi, titik, dan lampu lebih cepat."
                    : "Ringkasan ini hanya menampilkan hasil survey yang terhubung ke tugas distribusi buatan admin yang sedang login, agar fokus per kecamatan tidak tercampur admin lain."}
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Sumber Data Dashboard</div>
                    <div className="mt-1 text-base font-bold text-white">{activeSourceLabel}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Update Terakhir</div>
                    <div className="mt-1 text-base font-bold text-white">
                      {activeTimestamp ? new Date(activeTimestamp).toLocaleString("id-ID") : "Belum ada"}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-start gap-3 lg:items-end">
                <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm text-slate-100 backdrop-blur">
                  Kabupaten aktif: <span className="font-bold">{activeKabupaten || "Semua Kabupaten"}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => void handleRefreshSummary()}
                      disabled={summaryRefreshing}
                      className="rounded-xl border border-white/20 bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-300/60"
                    >
                      {summaryRefreshing ? "Refresh Summary..." : "Refresh Summary"}
                    </button>
                  )}
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => void handleExportTaskExcel()}
                      disabled={taskExporting}
                      className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-white/20 disabled:cursor-not-allowed disabled:bg-white/5"
                    >
                      {taskExporting ? "Exporting..." : "Export Tugas Excel"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleToggleReports}
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-all hover:bg-slate-100"
                  >
                    {reportsVisible ? "Sembunyikan Laporan" : "Muat Laporan"}
                  </button>
                  {reportsVisible && (
                    <button
                      type="button"
                      onClick={handleLoadDetail}
                      disabled={detailVisible && reportState.loading}
                      className="rounded-xl border border-white/20 bg-slate-800/60 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:bg-slate-700/40"
                    >
                      {detailVisible
                        ? reportState.loading
                          ? "Memuat Detail..."
                          : detailLoaded
                            ? "Detail Aktif"
                            : "Muat Detail"
                        : detailLoaded
                          ? "Tampilkan Detail"
                          : "Muat Detail"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {!reportsVisible ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-8 text-sm text-gray-600 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  Ringkasan dashboard sedang disembunyikan. Klik `Muat Laporan` untuk menampilkan summary hemat read.
                  Sistem sekarang memprioritaskan Supabase, lalu fallback ke Firestore bila diperlukan.
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Total Survey</div>
                    <div className="mt-1 text-lg font-bold text-gray-900">{totalSurveyCount}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Menunggu</div>
                    <div className="mt-1 text-lg font-bold text-amber-600">{waitingReviewCount}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Patch Pra</div>
                    <div className="mt-1 text-lg font-bold text-emerald-700">{reportState.praExisting.totalData}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Surveyor</div>
                    <div className="mt-1 text-lg font-bold text-purple-700">{reportState.totalUniqueSurveyors}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <PatchSummaryCard
                  title="Patch Propose"
                  subtitle="Ringkasan total hasil survey APJ Propose."
                  accentClass="bg-emerald-50 text-emerald-700"
                  summary={reportState.propose}
                />
                <PatchSummaryCard
                  title="Patch Existing"
                  subtitle="Ringkasan total hasil survey Existing."
                  accentClass="bg-blue-50 text-blue-700"
                  summary={reportState.existing}
                />
                <PatchSummaryCard
                  title="Patch Pra Existing"
                  subtitle="Ringkasan total hasil survey Pra Existing."
                  accentClass="bg-amber-50 text-amber-700"
                  summary={reportState.praExisting}
                />
              </div>

              {!detailVisible ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-8 text-sm text-gray-600 shadow-sm">
                  Summary ringan sudah tampil.
                  Sumber aktif: <span className="font-semibold">{bundleSource === "supabase" ? "Supabase" : "Firestore"}</span>.
                  Klik `Muat Detail` untuk membuka tabel verifikasi dan rincian dashboard.
                </div>
              ) : reportState.loading ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-10 shadow-sm">
                  <div className="flex flex-col items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
                    <p className="mt-4 text-sm font-medium text-gray-600">Memuat detail laporan dashboard...</p>
                  </div>
                </div>
              ) : reportState.error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">
                  Gagal memuat detail laporan: {reportState.error}
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-5 xl:flex-row xl:items-end xl:justify-between">
                      <div>
                        <h4 className="text-xl font-bold text-gray-900">Analisa Jenis Lampu Pra Existing</h4>
                        <p className="mt-1 text-sm text-gray-500">
                          Rekap komposisi jenis lampu yang terdata pada patch `pra-existing`, termasuk total titik dan total lampu per jenis.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Jenis Terdata</p>
                          <p className="mt-2 text-2xl font-bold text-gray-900">{lampTypeSummaryRows.length}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Total Titik</p>
                          <p className="mt-2 text-2xl font-bold text-gray-900">{lampTypeGrandTotal.surveyCount}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Total Lampu</p>
                          <p className="mt-2 text-2xl font-bold text-gray-900">{lampTypeGrandTotal.lampCount}</p>
                        </div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-[820px] w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            {[
                              "Jenis Lampu",
                              "Jumlah Titik",
                              "Jumlah Lampu",
                              "Persentase Lampu",
                            ].map((header) => (
                              <th
                                key={header}
                                className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.18em] text-gray-500"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {lampTypeSummaryRows.length ? (
                            lampTypeSummaryRows.map((row) => (
                              <tr key={row.lampType} className="transition-colors hover:bg-violet-50/40">
                                <td className="px-6 py-4 font-semibold text-gray-900">{row.lampType}</td>
                                <td className="px-6 py-4 text-sm font-semibold text-gray-900">{row.surveyCount}</td>
                                <td className="px-6 py-4 text-sm text-gray-700">{row.lampCount}</td>
                                <td className="px-6 py-4 text-sm text-violet-700">{row.percentage.toFixed(1)}%</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">
                                Jenis lampu belum terdeteksi pada data detail yang dimuat.
                              </td>
                            </tr>
                          )}
                          {lampTypeSummaryRows.length > 0 && (
                            <tr className="bg-slate-900 text-white">
                              <td className="px-6 py-4 font-bold uppercase tracking-[0.12em]">Total Semua Jenis</td>
                              <td className="px-6 py-4 text-sm font-bold">{lampTypeGrandTotal.surveyCount}</td>
                              <td className="px-6 py-4 text-sm font-bold">{lampTypeGrandTotal.lampCount}</td>
                              <td className="px-6 py-4 text-sm font-bold">100%</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-5 xl:flex-row xl:items-end xl:justify-between">
                      <div>
                        <h4 className="text-xl font-bold text-gray-900">Rekap Admin Verifikasi</h4>
                        <p className="mt-1 text-sm text-gray-500">
                          Ringkasan admin yang melakukan verifikasi berdasarkan rentang tanggal yang dipilih, lengkap dengan jumlah titik dan waktu verifikasi.
                          Sumber aktif: {bundleSource === "supabase" ? "Supabase" : "Firestore"}.
                        </p>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <label className="text-sm font-medium text-gray-700">
                          Dari tanggal
                          <input
                            type="date"
                            value={startDate}
                            onChange={(event) => setStartDate(event.target.value)}
                            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                          />
                        </label>
                        <label className="text-sm font-medium text-gray-700">
                          Sampai tanggal
                          <input
                            type="date"
                            value={endDate}
                            onChange={(event) => setEndDate(event.target.value)}
                            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                          />
                        </label>
                        <button
                          onClick={handleExportVerifierExcel}
                          disabled={!verifierDetailRows.length}
                          className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                          Export Excel
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 border-b border-gray-100 px-6 py-5 md:grid-cols-3">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Admin Terdata</p>
                        <p className="mt-2 text-2xl font-bold text-gray-900">{verifierSummaryRows.length}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Total Titik Diverifikasi</p>
                        <p className="mt-2 text-2xl font-bold text-gray-900">{verifierGrandTotal.totalTitik}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Verifikasi Terakhir</p>
                        <p className="mt-2 text-base font-bold text-gray-900">{formatDateTime(verifierGrandTotal.lastVerifiedAt)}</p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-[1180px] w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            {[
                              "Nama Admin",
                              "Total Verifikasi",
                              "Jumlah Titik",
                              "Jumlah Lampu",
                              "Existing",
                              "APJ Propose",
                              "Pra Existing",
                              "Verifikasi Pertama",
                              "Verifikasi Terakhir",
                            ].map((header) => (
                              <th
                                key={header}
                                className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.18em] text-gray-500"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {verifierSummaryRows.length ? (
                            verifierSummaryRows.map((row) => (
                              <tr key={row.verifierName} className="transition-colors hover:bg-green-50/40">
                                <td className="px-6 py-4 font-semibold text-gray-900">{row.verifierName}</td>
                                <td className="px-6 py-4 text-sm font-semibold text-gray-900">{row.totalData}</td>
                                <td className="px-6 py-4 text-sm text-gray-700">{row.totalTitik}</td>
                                <td className="px-6 py-4 text-sm text-gray-700">{row.totalLampu}</td>
                                <td className="px-6 py-4 text-sm text-blue-700">{row.existingCount}</td>
                                <td className="px-6 py-4 text-sm text-emerald-700">{row.proposeCount}</td>
                                <td className="px-6 py-4 text-sm text-amber-700">{row.praExistingCount}</td>
                                <td className="px-6 py-4 text-sm text-gray-700">{formatDateTime(row.firstVerifiedAt)}</td>
                                <td className="px-6 py-4 text-sm text-gray-700">{formatDateTime(row.lastVerifiedAt)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={9} className="px-6 py-8 text-center text-sm text-gray-500">
                                Belum ada data verifikasi pada rentang tanggal ini.
                              </td>
                            </tr>
                          )}
                          {verifierSummaryRows.length > 0 && (
                            <tr className="bg-slate-900 text-white">
                              <td className="px-6 py-4 font-bold uppercase tracking-[0.12em]">{verifierGrandTotal.verifierName}</td>
                              <td className="px-6 py-4 text-sm font-bold">{verifierGrandTotal.totalData}</td>
                              <td className="px-6 py-4 text-sm font-bold">{verifierGrandTotal.totalTitik}</td>
                              <td className="px-6 py-4 text-sm font-bold">{verifierGrandTotal.totalLampu}</td>
                              <td className="px-6 py-4 text-sm font-bold text-blue-200">{verifierGrandTotal.existingCount}</td>
                              <td className="px-6 py-4 text-sm font-bold text-emerald-200">{verifierGrandTotal.proposeCount}</td>
                              <td className="px-6 py-4 text-sm font-bold text-amber-200">{verifierGrandTotal.praExistingCount}</td>
                              <td className="px-6 py-4 text-sm font-bold">{formatDateTime(verifierGrandTotal.firstVerifiedAt)}</td>
                              <td className="px-6 py-4 text-sm font-bold">{formatDateTime(verifierGrandTotal.lastVerifiedAt)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-col gap-2 border-b border-gray-200 px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">Laporan Pra Existing per Kecamatan</h4>
                    <p className="mt-1 text-sm text-gray-500">
                      {isSuperAdmin
                        ? "Rekap data masuk, verifikasi, validasi, lampu, titik, dan jumlah petugas pada setiap kecamatan."
                        : "Rekap kecamatan hanya dari tugas yang admin ini distribusikan sendiri."}
                    </p>
                  </div>
                  <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    {reportState.praExistingByKecamatan.length} kecamatan terdeteksi
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[1180px] w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        {[
                          "Kecamatan",
                          "Total Data Masuk",
                          "Menunggu",
                          "Diverifikasi",
                          "Tervalidasi",
                          "Ditolak",
                          "Jumlah Titik",
                          "Jumlah Lampu",
                          "Jumlah Petugas",
                        ].map((header) => (
                          <th
                            key={header}
                            className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.18em] text-gray-500"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reportState.praExistingByKecamatan.map((row) => (
                        <tr key={row.kecamatan} className="hover:bg-amber-50/40 transition-colors">
                          <td className="px-6 py-4 font-semibold text-gray-900">{row.kecamatan}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">{row.totalData}</td>
                          <td className="px-6 py-4 text-sm text-amber-700">{row.totalMenunggu}</td>
                          <td className="px-6 py-4 text-sm text-blue-700">{row.totalDiverifikasi}</td>
                          <td className="px-6 py-4 text-sm text-emerald-700">{row.totalTervalidasi}</td>
                          <td className="px-6 py-4 text-sm text-rose-700">{row.totalDitolak}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{row.totalTitik}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{row.totalLampu}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{row.totalSurveyor}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-900 text-white">
                        <td className="px-6 py-4 font-bold uppercase tracking-[0.12em]">{praExistingGrandTotal.kecamatan}</td>
                        <td className="px-6 py-4 text-sm font-bold">{praExistingGrandTotal.totalData}</td>
                        <td className="px-6 py-4 text-sm font-bold text-amber-200">{praExistingGrandTotal.totalMenunggu}</td>
                        <td className="px-6 py-4 text-sm font-bold text-blue-200">{praExistingGrandTotal.totalDiverifikasi}</td>
                        <td className="px-6 py-4 text-sm font-bold text-emerald-200">{praExistingGrandTotal.totalTervalidasi}</td>
                        <td className="px-6 py-4 text-sm font-bold text-rose-200">{praExistingGrandTotal.totalDitolak}</td>
                        <td className="px-6 py-4 text-sm font-bold">{praExistingGrandTotal.totalTitik}</td>
                        <td className="px-6 py-4 text-sm font-bold">{praExistingGrandTotal.totalLampu}</td>
                        <td className="px-6 py-4 text-sm font-bold">{praExistingGrandTotal.totalSurveyor}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>
    </>
  );
}
