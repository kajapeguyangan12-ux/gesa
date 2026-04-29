"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { KABUPATEN_OPTIONS } from "@/utils/constants";
import { PRA_EXISTING_TABANAN_DATA } from "@/app/survey-pra-existing/location-data";
import type { TaskNavigationInfo } from "@/utils/taskNavigation";
import { formatPanelUpdatedAt, getReadableDataSourceLabel } from "@/utils/panelDataSource";
import { fetchAdminSurveyRows, type AdminSurveyRow } from "./supabaseSurveyClient";

function toApiSurveyType(type: string) {
  if (type === "existing" || type === "propose" || type === "pra-existing") return type;
  return "existing";
}

// Define props type inline
interface MapComponentProps {
  latitude: number;
  longitude: number;
  accuracy?: number;
  title: string;
  kmzFileUrl?: string;
  onTaskNavigationInfoChange?: (info: TaskNavigationInfo | null) => void;
}

interface EditSelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  optionLabelMap?: Record<string, string>;
  disabled?: boolean;
}

// Dynamic import for Map
const DynamicDetailMap = dynamic<MapComponentProps>(
  () => import("@/app/admin/gesa-survey/components/SurveyDetailMap"),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-64 lg:h-96 bg-gray-100 rounded-xl flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Memuat peta...</p>
        </div>
      </div>
    )
  }
);

function EditSelectField({ label, value, onChange, options, optionLabelMap, disabled }: EditSelectFieldProps) {
  return (
    <>
      <label className="block text-sm font-semibold text-gray-900 mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm lg:text-base text-gray-900 disabled:bg-gray-100"
      >
        <option value="">Pilih</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabelMap?.[option] || option}
          </option>
        ))}
      </select>
    </>
  );
}

interface Survey {
  id: string;
  title: string;
  type: string;
  status: string;
  surveyorName: string;
  surveyorEmail?: string;
  createdAt: { toDate?: () => Date; seconds?: number } | Date | string | number | null;
  latitude: number;
  longitude: number;
  accuracy?: number;
  originalLatitude?: number;
  originalLongitude?: number;
  adminLatitude?: number;
  adminLongitude?: number;
  finalLatitude?: number;
  finalLongitude?: number;
  hasAdminCoordinateOverride?: boolean;
  
  // Survey Existing fields
  lokasiJalan?: string;
  namaJalan?: string;
  namaGang?: string;
  jenisExisting?: string;
  keteranganTiang?: string;
  kepemilikan?: string;
  jenisTitik?: string;
  palet?: string;
  lumina?: string;
  metodeUkur?: string;
  tinggiMedian?: string;
  lebarMedian?: string;
  medianDisplay?: string;
  lebarJalan1?: string;
  lebarJalan2?: string;
  lebarJalanDisplay?: string;
  lebarTrotoar?: string;
  lamnyaBerdekatan?: string;
  tinggiAPM?: string;
  tinggiARM?: string;
  tinggiArm?: string;
  keterangan?: string;
  lebarBahuBertiang?: string;
  lebarTrotoarBertiang?: string;
  lainnyaBertiang?: string;
  
  // APJ Propose specific fields
  statusIDTitik?: string;
  idTitik?: string;
  dayaLampu?: string;
  dataTiang?: string;
  dataRuas?: string;
  subRuas?: string;
  median?: string;
  lebarJalan?: string;
  jarakAntarTiang?: string;

  // Pra Existing fields
  jenisLampu?: string;
  jumlahLampu?: string;
  kondisi?: string;
  jenisTiang?: string;
  fotoAktual?: string;
  fotoKemerataan?: string;
  kabupaten?: string;
  kabupatenName?: string;
  kecamatan?: string;
  desa?: string;
  banjar?: string;
  kepemilikanTiang?: string;
  kepemilikanDisplay?: string;
  tipeTiangPLN?: string;
  fungsiLampu?: string;
  garduStatus?: string;
  kodeGardu?: string;
  taskId?: string;
  taskTitle?: string;
  kmzFileUrl?: string;
  
  // Photos
  fotoTiangAPM?: string;
  fotoTitikActual?: string;
  photoUrl?: string;
  
  // Metadata
  jenis?: string;
  zona?: string;
  kategori?: string;
  editedBy?: string;
  updatedAt?: { toDate?: () => Date; seconds?: number } | Date | string | number | null;
}

const PRA_EXISTING_KEPEMILIKAN_OPTIONS = ["PLN", "Lainnya"];
const PRA_EXISTING_TIPE_TANGAN_PLN_OPTIONS = [
  "Tiang Tegangan Menengah (3 Kabel)",
  "Tiang Tegangan Rendah (Kabel 1)",
  "Tiang Trafo",
];
const PRA_EXISTING_JENIS_TIANG_OPTIONS = ["Beton", "Besi", "Kayu"];
const PRA_EXISTING_JENIS_LAMPU_OPTIONS = ["LED", "Mercury", "Panel Surya", "Kap"];
const PRA_EXISTING_JUMLAH_LAMPU_OPTIONS = ["0", "1", "2", "3", "4"];
const PRA_EXISTING_FUNGSI_LAMPU_OPTIONS = [
  "Alat Penerangan Jalan (APJ)",
  "Fasilitas Sosial (contoh : Rumah Ibadah, Bale Banjar,)",
  "Fasilitas Umum (contoh: Perumahan, Lapangan, Parkir)",
];

function buildPraExistingOwnershipDisplay(kepemilikanTiang: string, tipeTiangPLN: string) {
  return kepemilikanTiang === "PLN" && tipeTiangPLN ? `PLN - ${tipeTiangPLN}` : kepemilikanTiang;
}

async function readApiError(response: Response, fallbackMessage: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // Ignore JSON parse failures and use fallback message.
  }
  return fallbackMessage;
}

async function handleConflictAndReload(response: Response, reload: () => Promise<void>, fallbackMessage: string) {
  const message = await readApiError(response, fallbackMessage);
  if (response.status === 409) {
    await reload();
    alert(`Data ini baru saja diproses admin lain. Daftar akan dimuat ulang.\n\n${message}`);
    return true;
  }
  throw new Error(message);
}

const LIVE_REFRESH_INTERVAL_MS = 5000;
const TAB_DATA_FETCH_LIMIT = 10000;

function isDocumentVisible() {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

export default function ValidasiSurvey({
  activeKabupaten,
  isActive = true,
}: {
  activeKabupaten?: string | null;
  isActive?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"existing" | "propose" | "pra-existing">("existing");
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    existing: 0,
    propose: 0,
    praExisting: 0,
  });
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [dataSource, setDataSource] = useState<string>("Belum ada");
  const [fetchError, setFetchError] = useState("");
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [selectedTaskNavigationInfo, setSelectedTaskNavigationInfo] = useState<TaskNavigationInfo | null>(null);
  const getDisplayLatitude = (survey: Survey): number => {
    if (typeof survey.finalLatitude === "number" && Number.isFinite(survey.finalLatitude)) return survey.finalLatitude;
    if (typeof survey.adminLatitude === "number" && Number.isFinite(survey.adminLatitude)) return survey.adminLatitude;
    return survey.latitude;
  };
  const getDisplayLongitude = (survey: Survey): number => {
    if (typeof survey.finalLongitude === "number" && Number.isFinite(survey.finalLongitude)) return survey.finalLongitude;
    if (typeof survey.adminLongitude === "number" && Number.isFinite(survey.adminLongitude)) return survey.adminLongitude;
    return survey.longitude;
  };
  const hasDisplayedAdminCoordinate = (survey: Survey) => {
    if (survey.type !== "pra-existing") return false;
    if (!Number.isFinite(survey.adminLatitude) || !Number.isFinite(survey.adminLongitude)) return false;

    const displayLatitude = getDisplayLatitude(survey);
    const displayLongitude = getDisplayLongitude(survey);

    return (
      Math.abs(displayLatitude - Number(survey.adminLatitude)) <= 0.0000001 &&
      Math.abs(displayLongitude - Number(survey.adminLongitude)) <= 0.0000001
    );
  };
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDetailMap, setShowDetailMap] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Survey | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingSurveyId, setDeletingSurveyId] = useState<string | null>(null);
  
  // Filter states
  const [filterStatus, setFilterStatus] = useState<string>("Menunggu");
  const [filterJenisExisting, setFilterJenisExisting] = useState<string>("Semua Jenis");
  const [filterSort, setFilterSort] = useState<string>("Terbaru");
  const [filterSurveyor, setFilterSurveyor] = useState<string>("Semua Petugas");
  const [filterKecamatan, setFilterKecamatan] = useState<string>("Semua Kecamatan");
  const [filterDesa, setFilterDesa] = useState<string>("Semua Desa");
  
  // Additional filters for existing and propose tabs
  const [filterExistingSurveyor, setFilterExistingSurveyor] = useState<string>("Semua Petugas");
  const [filterExistingJudul, setFilterExistingJudul] = useState<string>("Semua Judul");
  const [filterProposeSurveyor, setFilterProposeSurveyor] = useState<string>("Semua Petugas");
  const [filterProposeJudul, setFilterProposeJudul] = useState<string>("Semua Judul");
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showAll, setShowAll] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const latestSurveyFingerprintRef = useRef("");
  const latestSurveyChangeRef = useRef("");
  const getCurrentUser = () => {
    const storedUser = localStorage.getItem("gesa_user");
    return storedUser ? JSON.parse(storedUser) : null;
  };

  const mapSupabaseSurvey = (survey: AdminSurveyRow) => survey as Survey;
  const targetStatuses = useMemo(() => new Set(["menunggu"]), []);

  const mergeSurveyDelta = (current: Survey[], deltaRows: Survey[]) => {
    const byId = new Map(current.map((survey) => [survey.id, survey]));

    for (const row of deltaRows) {
      if (targetStatuses.has((row.status || "").toLowerCase())) {
        byId.set(row.id, row);
      } else {
        byId.delete(row.id);
      }
    }

    return Array.from(byId.values()).sort((left, right) => {
      const leftTime = getTimestampValue(left.updatedAt ?? left.createdAt);
      const rightTime = getTimestampValue(right.updatedAt ?? right.createdAt);
      return rightTime - leftTime;
    });
  };

  const matchesExactPraExistingDuplicate = (targetSurvey: Survey, candidate: Survey) => {
    return (
      targetSurvey.type === "pra-existing" &&
      candidate.type === "pra-existing" &&
      candidate.taskId === targetSurvey.taskId &&
      candidate.surveyorName === targetSurvey.surveyorName &&
      candidate.title === targetSurvey.title &&
      candidate.latitude === targetSurvey.latitude &&
      candidate.longitude === targetSurvey.longitude
    );
  };

  const removeSurveyFromWorkingSet = (
    targetSurvey: Survey,
    mode: "single" | "exact-pra-existing-group" = "single"
  ) => {
    const surveysToRemove = surveys.filter((item) =>
      mode === "exact-pra-existing-group"
        ? item.id === targetSurvey.id || matchesExactPraExistingDuplicate(targetSurvey, item)
        : item.id === targetSurvey.id
    );

    setSurveys((current) =>
      current.filter((item) =>
        mode === "exact-pra-existing-group"
          ? !(item.id === targetSurvey.id || matchesExactPraExistingDuplicate(targetSurvey, item))
          : item.id !== targetSurvey.id
      )
    );

    setStats((current) => {
      if (surveysToRemove.length === 0) return current;

      const removedExisting = surveysToRemove.filter((item) => item.type === "existing").length;
      const removedPropose = surveysToRemove.filter((item) => item.type === "propose").length;
      const removedPraExisting = surveysToRemove.filter((item) => item.type === "pra-existing").length;

      return {
        total: Math.max(0, current.total - surveysToRemove.length),
        existing: Math.max(0, current.existing - removedExisting),
        propose: Math.max(0, current.propose - removedPropose),
        praExisting: Math.max(0, current.praExisting - removedPraExisting),
      };
    });
    setSelectedSurvey((current) => (current?.id === targetSurvey.id ? null : current));
    setShowDetailModal((current) => (selectedSurvey?.id === targetSurvey.id ? false : current));
  };

  const fetchStatistics = async (forceRefresh = false, syncFingerprint = true) => {
    try {
      if (forceRefresh) {
        setStatsLoading(true);
      }
      setFetchError("");
      const payload = await fetchAdminSurveyRows({
        activeKabupaten,
        adminId: null,
        statuses: ["menunggu"],
        summaryOnly: true,
      });

      setStats(payload.counts);
      setStatsLoaded(true);
      setDataSource(payload.source);
      if (syncFingerprint) {
        latestSurveyFingerprintRef.current = buildSurveyFingerprint(payload.counts, payload.lastDataChangeAt);
        latestSurveyChangeRef.current = payload.lastDataChangeAt || payload.generatedAt || latestSurveyChangeRef.current;
      }
      setLastUpdatedAt(
        payload.lastDataChangeAt
          ? new Date(payload.lastDataChangeAt)
          : payload.generatedAt
            ? new Date(payload.generatedAt)
            : new Date()
      );
      return payload;
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : "Gagal memuat statistik verifikasi.");
      setDataSource("Belum ada");
      setLastUpdatedAt(null);
      return null;
    } finally {
      if (forceRefresh) {
        setStatsLoading(false);
      }
    }
  };

  const buildSurveyFingerprint = (
    counts: { total: number; existing: number; propose: number; praExisting: number },
    lastDataChangeAt?: string
  ) => {
    return [
      counts.total,
      counts.existing,
      counts.propose,
      counts.praExisting,
      lastDataChangeAt || "",
      activeKabupaten || "all",
    ].join("|");
  };

  const fetchSurveys = async (forceRefresh = false, resetPage = true, backgroundRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else if (!backgroundRefresh && surveys.length === 0) {
        setLoading(true);
      }
      setFetchError("");
      const payload = await fetchAdminSurveyRows({
        activeKabupaten,
        adminId: null,
        statuses: ["menunggu"],
        type: activeTab,
        limit: TAB_DATA_FETCH_LIMIT,
      });
      setSurveys(payload.rows.map(mapSupabaseSurvey));
      latestSurveyFingerprintRef.current = buildSurveyFingerprint(payload.counts, payload.lastDataChangeAt);
      latestSurveyChangeRef.current = payload.lastDataChangeAt || payload.generatedAt || latestSurveyChangeRef.current;
      if (resetPage) {
        setCurrentPage(1);
      }
      setHasNextPage(false);
      setDataSource(payload.source);
      setLastUpdatedAt(
        payload.lastDataChangeAt
          ? new Date(payload.lastDataChangeAt)
          : payload.generatedAt
            ? new Date(payload.generatedAt)
            : new Date()
      );
    } catch (error) {
      console.error("Error fetching surveys:", error);
      setFetchError(error instanceof Error ? error.message : "Gagal memuat data verifikasi.");
      setDataSource("Belum ada");
      setLastUpdatedAt(null);
    } finally {
      if (!backgroundRefresh) {
        setLoading(false);
      }
      setRefreshing(false);
    }
  };

  const fetchSurveyDelta = async (changedSince: string) => {
    const payload = await fetchAdminSurveyRows({
      activeKabupaten,
      adminId: null,
      statuses: ["menunggu"],
      type: activeTab,
      limit: TAB_DATA_FETCH_LIMIT,
      changedSince,
    });

    const deltaRows = payload.rows.map(mapSupabaseSurvey);
    setSurveys((current) => mergeSurveyDelta(current, deltaRows));
    latestSurveyFingerprintRef.current = buildSurveyFingerprint(payload.counts, payload.lastDataChangeAt);
    latestSurveyChangeRef.current = payload.lastDataChangeAt || payload.generatedAt || latestSurveyChangeRef.current;
    setStats(payload.counts);
    setStatsLoaded(true);
    setDataSource(payload.source);
    setLastUpdatedAt(
      payload.lastDataChangeAt
        ? new Date(payload.lastDataChangeAt)
        : payload.generatedAt
          ? new Date(payload.generatedAt)
          : new Date()
    );
  };

  const clearCurrentTabCaches = () => undefined;

  useEffect(() => {
    setCurrentPage(1);
    setShowAll(false);
    setStatsLoaded(false);
    latestSurveyFingerprintRef.current = "";
    latestSurveyChangeRef.current = "";
    setStats({
      total: 0,
      existing: 0,
      propose: 0,
      praExisting: 0,
    });
  }, [activeKabupaten, itemsPerPage]);

  useEffect(() => {
    void Promise.all([fetchStatistics(), fetchSurveys()]);
  }, [activeKabupaten, activeTab]);

  useEffect(() => {
    if (!isActive) return;

    const intervalId = window.setInterval(() => {
      if (!isDocumentVisible()) return;
      void (async () => {
        const payload = await fetchStatistics(false, false);
        if (!payload) return;

        const nextFingerprint = buildSurveyFingerprint(payload.counts, payload.lastDataChangeAt);
        if (nextFingerprint !== latestSurveyFingerprintRef.current) {
          if (latestSurveyChangeRef.current) {
            await fetchSurveyDelta(latestSurveyChangeRef.current);
          } else {
            await fetchSurveys(false, false, true);
          }
        }
      })();
    }, LIVE_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [isActive, activeKabupaten, activeTab]);

  useEffect(() => {
    if (!isActive) return;

    const refreshOnForeground = () => {
      if (!isDocumentVisible()) return;
      void Promise.all([fetchStatistics(true), fetchSurveys(true, false)]);
    };

    window.addEventListener("focus", refreshOnForeground);
    document.addEventListener("visibilitychange", refreshOnForeground);

    return () => {
      window.removeEventListener("focus", refreshOnForeground);
      document.removeEventListener("visibilitychange", refreshOnForeground);
    };
  }, [isActive, activeKabupaten, activeTab]);

  const currentTabSurveys = useMemo(
    () => surveys.filter((survey) => survey.type === activeTab),
    [surveys, activeTab]
  );

  // Filter and sort surveys
  const filteredSurveys = currentTabSurveys.filter(survey => {
    // Filter by status
    if (filterStatus !== "Semua Status") {
      const statusLower = filterStatus.toLowerCase();
      if (survey.status !== statusLower) return false;
    }
    
    // Filter by jenis existing (only for existing tab)
    if (activeTab === "existing" && filterJenisExisting !== "Semua Jenis") {
      if (survey.jenisExisting !== filterJenisExisting) return false;
    }

    // Filter by surveyor (only for pra-existing tab)
    if (activeTab === "pra-existing" && filterSurveyor !== "Semua Petugas") {
      if (survey.surveyorName !== filterSurveyor) return false;
    }

    // Filter by kecamatan (only for pra-existing tab)
    if (activeTab === "pra-existing" && filterKecamatan !== "Semua Kecamatan") {
      if (survey.kecamatan !== filterKecamatan) return false;
    }

    // Filter by desa (only for pra-existing tab)
    if (activeTab === "pra-existing" && filterDesa !== "Semua Desa") {
      if (survey.desa !== filterDesa) return false;
    }

    // Filter by surveyor (only for existing tab)
    if (activeTab === "existing" && filterExistingSurveyor !== "Semua Petugas") {
      if (survey.surveyorName !== filterExistingSurveyor) return false;
    }

    if (activeTab === "existing" && filterExistingJudul !== "Semua Judul") {
      const surveyTitle = survey.title || survey.lokasiJalan || "";
      if (surveyTitle !== filterExistingJudul) return false;
    }

    if (activeTab === "propose" && filterProposeSurveyor !== "Semua Petugas") {
      if (survey.surveyorName !== filterProposeSurveyor) return false;
    }

    if (activeTab === "propose" && filterProposeJudul !== "Semua Judul") {
      if ((survey.title || "") !== filterProposeJudul) return false;
    }
    
    return true;
  }).sort((a, b) => {
    const timestampA = getTimestampValue(a.createdAt);
    const timestampB = getTimestampValue(b.createdAt);
    return filterSort === "Terlama" ? timestampA - timestampB : timestampB - timestampA;
  });

  const displayedStats = useMemo(() => {
    if (!statsLoaded) {
      return {
        total: null,
        existing: null,
        propose: null,
        praExisting: null,
      };
    }

    return {
      total: stats.total,
      existing: stats.existing,
      propose: stats.propose,
      praExisting: stats.praExisting,
    };
  }, [statsLoaded, stats.existing, stats.praExisting, stats.propose, stats.total]);

  // Pagination logic
  const totalItems = filteredSurveys.length;
  const totalPages = showAll ? 1 : Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startIndex = filteredSurveys.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endIndex = filteredSurveys.length === 0 ? 0 : Math.min(startIndex + (showAll ? filteredSurveys.length : itemsPerPage) - 1, totalItems);
  const paginatedSurveys = showAll
    ? filteredSurveys
    : filteredSurveys.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterSurveyor, filterKecamatan, filterDesa, activeTab, filterExistingSurveyor, filterExistingJudul, filterProposeSurveyor, filterProposeJudul]);

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    setCurrentPage(page);
  };

  // Handle items per page change
  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
    setShowAll(false);
  };

  // Pagination controls component
  const PaginationControls = () => {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-gray-50 border-t">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            <span>Menampilkan {startIndex}-{endIndex} dari {statsLoaded ? totalItems : "?"} data</span>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Tampilkan:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <div className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded">
            Hal {currentPage} / {totalPages}
          </div>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  // Get unique surveyors from pra-existing surveys
  const surveyorOptions = useMemo(() => {
    const uniqueSurveyors = [...new Set(currentTabSurveys.map(s => s.surveyorName).filter(Boolean))];
    return ["Semua Petugas", ...uniqueSurveyors.sort()];
  }, [currentTabSurveys]);

  // Get unique kecamatans from pra-existing surveys
  const kecamatanOptions = useMemo(() => {
    const uniqueKecamatans = [...new Set(currentTabSurveys.map(s => s.kecamatan).filter(Boolean))];
    return ["Semua Kecamatan", ...uniqueKecamatans.sort()];
  }, [currentTabSurveys]);

  // Get unique desas based on selected kecamatan
  const desaOptions = useMemo(() => {
    if (filterKecamatan === "Semua Kecamatan") {
      const uniqueDesas = [...new Set(currentTabSurveys.map(s => s.desa).filter(Boolean))];
      return ["Semua Desa", ...uniqueDesas.sort()];
    } else {
      const filtered = currentTabSurveys.filter(s => s.kecamatan === filterKecamatan);
      const uniqueDesas = [...new Set(filtered.map(s => s.desa).filter(Boolean))];
      return ["Semua Desa", ...uniqueDesas.sort()];
    }
  }, [currentTabSurveys, filterKecamatan]);
  
  // Get unique surveyors from existing surveys
  const existingSurveyorOptions = useMemo(() => {
    const uniqueSurveyors = [...new Set(currentTabSurveys.map(s => s.surveyorName).filter(Boolean))];
    return ["Semua Petugas", ...uniqueSurveyors.sort()];
  }, [currentTabSurveys]);

  // Get unique juduls from existing surveys
  const existingJudulOptions = useMemo(() => {
    const uniqueJuduls = [...new Set(currentTabSurveys.map(s => s.title || s.lokasiJalan).filter(Boolean))];
    return ["Semua Judul", ...uniqueJuduls.sort()];
  }, [currentTabSurveys]);

  // Get unique surveyors from propose surveys
  const proposeSurveyorOptions = useMemo(() => {
    const uniqueSurveyors = [...new Set(currentTabSurveys.map(s => s.surveyorName).filter(Boolean))];
    return ["Semua Petugas", ...uniqueSurveyors.sort()];
  }, [currentTabSurveys]);

  // Get unique juduls from propose surveys
  const proposeJudulOptions = useMemo(() => {
    const uniqueJuduls = [...new Set(currentTabSurveys.map(s => s.title).filter(Boolean))];
    return ["Semua Judul", ...uniqueJuduls.sort()];
  }, [currentTabSurveys]);
  
  const totalSurveys = displayedStats.total;
  const totalExisting = displayedStats.existing;
  const totalPropose = displayedStats.propose;
  const totalPraExisting = displayedStats.praExisting;
  const diverifikasiCount = displayedStats.total;
  const kabupatenOptionMap = useMemo(
    () => Object.fromEntries(KABUPATEN_OPTIONS.map((item) => [item.id, item.name])),
    []
  );
  const editPraExistingKabupaten = editFormData?.kabupaten || "";
  const editPraExistingDistrictOptions = useMemo(
    () =>
      editFormData?.type === "pra-existing" && editPraExistingKabupaten === "tabanan"
        ? Object.keys(PRA_EXISTING_TABANAN_DATA)
        : [],
    [editFormData?.type, editPraExistingKabupaten]
  );
  const editPraExistingDesaOptions = useMemo(
    () =>
      editFormData?.type === "pra-existing" && editFormData.kecamatan
        ? Object.keys(PRA_EXISTING_TABANAN_DATA[editFormData.kecamatan] || {})
        : [],
    [editFormData?.type, editFormData?.kecamatan]
  );
  const editPraExistingBanjarOptions = useMemo(
    () =>
      editFormData?.type === "pra-existing" && editFormData.kecamatan && editFormData.desa
        ? PRA_EXISTING_TABANAN_DATA[editFormData.kecamatan]?.[editFormData.desa] || []
        : [],
    [editFormData?.type, editFormData?.kecamatan, editFormData?.desa]
  );

  const handlePraExistingKabupatenChange = (value: string) => {
    if (!editFormData) return;

    setEditFormData({
      ...editFormData,
      kabupaten: value,
      kabupatenName: kabupatenOptionMap[value] || value,
      kecamatan: value === "tabanan" ? editFormData.kecamatan || "" : "",
      desa: value === "tabanan" ? editFormData.desa || "" : "",
      banjar: value === "tabanan" ? editFormData.banjar || "" : "",
    });
  };

  const handlePraExistingKecamatanChange = (value: string) => {
    if (!editFormData) return;

    setEditFormData({
      ...editFormData,
      kecamatan: value,
      desa: "",
      banjar: "",
    });
  };

  const handlePraExistingDesaChange = (value: string) => {
    if (!editFormData) return;

    setEditFormData({
      ...editFormData,
      desa: value,
      banjar: "",
    });
  };

  const handlePraExistingKepemilikanChange = (value: string) => {
    if (!editFormData) return;

    const tipeTiangPLN = value === "PLN" ? editFormData.tipeTiangPLN || "" : "";
    const kepemilikanDisplay = buildPraExistingOwnershipDisplay(value, tipeTiangPLN);

    setEditFormData({
      ...editFormData,
      kepemilikanTiang: value,
      kepemilikanDisplay,
      keteranganTiang: kepemilikanDisplay,
      tipeTiangPLN,
    });
  };

  const handlePraExistingTipeTiangPLNChange = (value: string) => {
    if (!editFormData) return;

    const kepemilikanDisplay = buildPraExistingOwnershipDisplay(editFormData.kepemilikanTiang || "", value);

    setEditFormData({
      ...editFormData,
      tipeTiangPLN: value,
      kepemilikanDisplay,
      keteranganTiang: kepemilikanDisplay,
    });
  };

  const handleViewDetail = (survey: Survey) => {
    setSelectedSurvey(survey);
    setSelectedTaskNavigationInfo(null);
    setShowDetailMap(false);
    setShowDetailModal(true);
  };

  const handleEdit = (survey: Survey) => {
    setEditFormData({
      ...survey,
      originalLatitude: Number.isFinite(survey.originalLatitude) ? survey.originalLatitude : survey.latitude,
      originalLongitude: Number.isFinite(survey.originalLongitude) ? survey.originalLongitude : survey.longitude,
      adminLatitude: Number.isFinite(survey.adminLatitude) ? survey.adminLatitude : survey.latitude,
      adminLongitude: Number.isFinite(survey.adminLongitude) ? survey.adminLongitude : survey.longitude,
      hasAdminCoordinateOverride: survey.hasAdminCoordinateOverride || false,
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editFormData) return;
    
    try {
      setIsSaving(true);
      const normalizedAdminLatitude = Number(editFormData.adminLatitude);
      const normalizedAdminLongitude = Number(editFormData.adminLongitude);
      const hasValidAdminCoords =
        Number.isFinite(normalizedAdminLatitude) && Number.isFinite(normalizedAdminLongitude);
      const originalLatitude =
        Number.isFinite(editFormData.originalLatitude) ? editFormData.originalLatitude : editFormData.latitude;
      const originalLongitude =
        Number.isFinite(editFormData.originalLongitude) ? editFormData.originalLongitude : editFormData.longitude;
      const normalizedOriginalLatitude = Number(originalLatitude);
      const normalizedOriginalLongitude = Number(originalLongitude);
      const normalizedPraExistingKabupatenName =
        editFormData.type === "pra-existing"
          ? kabupatenOptionMap[editFormData.kabupaten || ""] || editFormData.kabupatenName || editFormData.kabupaten || ""
          : editFormData.kabupatenName;
      const normalizedPraExistingOwnership =
        editFormData.type === "pra-existing"
          ? buildPraExistingOwnershipDisplay(editFormData.kepemilikanTiang || "", editFormData.tipeTiangPLN || "")
          : editFormData.kepemilikanDisplay;
      
      // Get current user from localStorage
      const storedUser = localStorage.getItem('gesa_user');
      const currentUser = storedUser ? JSON.parse(storedUser) : null;
      const editedByName = currentUser?.name || currentUser?.email || 'Admin';
      const updatedAtValue = new Date();
      
      const response = await fetch(`/api/admin/surveys/${toApiSurveyType(editFormData.type)}/${editFormData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editFormData,
          ...(editFormData.type === "pra-existing"
            ? {
                kabupatenName: normalizedPraExistingKabupatenName,
                kepemilikanDisplay: normalizedPraExistingOwnership,
                keteranganTiang: normalizedPraExistingOwnership,
              }
            : {}),
          originalLatitude,
          originalLongitude,
          adminLatitude: hasValidAdminCoords ? normalizedAdminLatitude : null,
          adminLongitude: hasValidAdminCoords ? normalizedAdminLongitude : null,
          hasAdminCoordinateOverride:
            editFormData.type === "pra-existing" &&
            hasValidAdminCoords &&
            (Math.abs(normalizedAdminLatitude - normalizedOriginalLatitude) > 0.0000001 ||
              Math.abs(normalizedAdminLongitude - normalizedOriginalLongitude) > 0.0000001),
          editedBy: editedByName,
          updatedAt: updatedAtValue.toISOString(),
          expectedStatus: editFormData.status,
          expectedUpdatedAt: editFormData.updatedAt ?? null,
          preserveCurrentStatus: true,
        }),
      });
      if (!response.ok) {
        if (
          await handleConflictAndReload(
            response,
            () => Promise.all([fetchStatistics(true), fetchSurveys(true, false)]).then(() => undefined),
            "Gagal memperbarui survey di Supabase."
          )
        ) {
          setShowEditModal(false);
          setEditFormData(null);
          return;
        }
      }

      const savedSurvey = {
        ...editFormData,
        editedBy: editedByName,
        updatedAt: updatedAtValue,
      } satisfies Survey;

      setSurveys((current) =>
        current.map((survey) => (survey.id === editFormData.id ? { ...survey, ...savedSurvey } : survey))
      );
      if (selectedSurvey?.id === editFormData.id) {
        setSelectedSurvey((current) => (current ? { ...current, ...savedSurvey } : current));
      }
      setShowEditModal(false);
      setEditFormData(null);
      
      alert('Data berhasil diperbarui!');
    } catch (error) {
      console.error('Error updating survey:', error);
      alert('Gagal memperbarui data: ' + error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidasi = async (survey: Survey) => {
    if (!confirm('Apakah Anda yakin ingin memverifikasi survey ini? Survey akan dipindahkan ke Validasi Data.')) return;
    
    try {
      const storedUser = localStorage.getItem('gesa_user');
      const currentUser = storedUser ? JSON.parse(storedUser) : null;
      const normalizedAdminLatitude = Number(survey.adminLatitude);
      const normalizedAdminLongitude = Number(survey.adminLongitude);
      const shouldUseAdminCoordinate =
        survey.type === "pra-existing" &&
        Number.isFinite(normalizedAdminLatitude) &&
        Number.isFinite(normalizedAdminLongitude);
      
      const response = await fetch(`/api/admin/surveys/${toApiSurveyType(survey.type)}/${survey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "diverifikasi",
          ...(shouldUseAdminCoordinate
            ? {
                originalLatitude: Number.isFinite(survey.originalLatitude) ? survey.originalLatitude : survey.latitude,
                originalLongitude: Number.isFinite(survey.originalLongitude) ? survey.originalLongitude : survey.longitude,
                latitude: normalizedAdminLatitude,
                longitude: normalizedAdminLongitude,
                finalLatitude: normalizedAdminLatitude,
                finalLongitude: normalizedAdminLongitude,
                coordinateSource: "admin",
                coordinateValidatedAt: new Date().toISOString(),
              }
            : survey.type === "pra-existing"
              ? {
                  finalLatitude: survey.latitude,
                  finalLongitude: survey.longitude,
                  coordinateSource: "petugas",
                }
              : {}),
          verifiedBy: currentUser?.name || currentUser?.email || 'Admin',
          verifiedAt: new Date().toISOString(),
          expectedStatus: survey.status,
          expectedUpdatedAt: survey.updatedAt ?? null,
        }),
      });
      if (!response.ok) {
        if (
          await handleConflictAndReload(
            response,
            () => Promise.all([fetchStatistics(true), fetchSurveys(true, false)]).then(() => undefined),
            "Gagal memverifikasi survey di Supabase."
          )
        ) {
          setShowDetailModal(false);
          setSelectedSurvey(null);
          return;
        }
      }

      removeSurveyFromWorkingSet(
        survey,
        survey.type === "pra-existing" ? "exact-pra-existing-group" : "single"
      );
      setShowDetailModal(false);
      setSelectedSurvey(null);
      
      alert('Survey berhasil diverifikasi! Survey dipindahkan ke Data Survey Valid.');
    } catch (error) {
      console.error('Error verifying survey:', error);
      alert('Gagal memverifikasi survey: ' + error);
    }
  };

  const handleDeleteSurvey = async (survey: Survey) => {
    if (!confirm("Apakah Anda yakin ingin menghapus survey ini? Data akan dihapus PERMANEN dan tidak bisa dikembalikan.")) {
      return;
    }

    try {
      setDeletingSurveyId(survey.id);
      
      const response = await fetch(`/api/admin/surveys/${toApiSurveyType(survey.type)}/${survey.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Gagal menghapus survey di Supabase.");
      }

      removeSurveyFromWorkingSet(survey);
      
      alert("Survey berhasil dihapus permanen!");
    } catch (error) {
      console.error("Error deleting survey:", error);
      alert("Gagal menghapus survey. Silakan coba lagi.");
    } finally {
      setDeletingSurveyId(null);
    }
  };

  const handleTolak = async (survey: Survey) => {
    const alasan = prompt('Masukkan alasan penolakan:');
    if (!alasan) return;
    
    try {
      const storedUser = localStorage.getItem('gesa_user');
      const currentUser = storedUser ? JSON.parse(storedUser) : null;
      
      const response = await fetch(`/api/admin/surveys/${toApiSurveyType(survey.type)}/${survey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "ditolak",
          rejectedBy: currentUser?.name || currentUser?.email || 'Admin',
          rejectedAt: new Date().toISOString(),
          rejectionReason: alasan,
          expectedStatus: survey.status,
          expectedUpdatedAt: survey.updatedAt ?? null,
        }),
      });
      if (!response.ok) {
        if (
          await handleConflictAndReload(
            response,
            () => Promise.all([fetchStatistics(true), fetchSurveys(true, false)]).then(() => undefined),
            "Gagal menolak survey di Supabase."
          )
        ) {
          setShowDetailModal(false);
          setSelectedSurvey(null);
          return;
        }
      }

      removeSurveyFromWorkingSet(
        survey,
        survey.type === "pra-existing" ? "exact-pra-existing-group" : "single"
      );
      setShowDetailModal(false);
      setSelectedSurvey(null);
      
      alert('Survey berhasil ditolak!');
    } catch (error) {
      console.error('Error rejecting survey:', error);
      alert('Gagal menolak survey: ' + error);
    }
  };

  const formatDate = (timestamp: Survey["createdAt"] | Survey["updatedAt"]) => {
    if (!timestamp) return "N/A";
    try {
      const date =
        typeof timestamp === "object" && timestamp !== null && "toDate" in timestamp && typeof timestamp.toDate === "function"
          ? timestamp.toDate()
          : timestamp instanceof Date
          ? timestamp
          : typeof timestamp === "string" || typeof timestamp === "number"
          ? new Date(timestamp)
          : null;
      if (!date || Number.isNaN(date.getTime())) return "N/A";
      return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return "N/A";
    }
  };

  function getTimestampValue(timestamp: Survey["createdAt"]) {
    if (!timestamp) return 0;
    if (typeof timestamp === "object" && timestamp !== null && "seconds" in timestamp && typeof timestamp.seconds === "number") {
      return timestamp.seconds;
    }
    if (typeof timestamp === "object" && timestamp !== null && "toDate" in timestamp && typeof timestamp.toDate === "function") {
      return timestamp.toDate().getTime() / 1000;
    }
    if (typeof timestamp !== "string" && typeof timestamp !== "number" && !(timestamp instanceof Date)) {
      return 0;
    }
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime() / 1000;
  }

  return (
    <>
      {/* Verifikasi Content */}
      <div className="mb-6 bg-white rounded-2xl shadow-sm p-4 lg:p-6 border border-gray-100">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
              Verifikasi
            </h2>
            <p className="text-sm text-gray-600">
              Data survey dari petugas yang menunggu verifikasi awal. Setelah diverifikasi, data akan pindah ke Validasi Data.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void fetchStatistics(true)}
              disabled={statsLoading}
              className="px-4 py-2 rounded-xl bg-slate-700 text-white font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {statsLoading ? "Menghitung..." : "Hitung Statistik"}
            </button>
            <button
              onClick={() => {
                void Promise.all([fetchStatistics(true), fetchSurveys(true, false)]);
              }}
              disabled={loading || refreshing}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {refreshing ? "Memuat ulang..." : "Refresh Data"}
            </button>
          </div>
        </div>
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Sumber Data Panel</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{getReadableDataSourceLabel(dataSource)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Update Terakhir</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{formatPanelUpdatedAt(lastUpdatedAt)}</div>
          </div>
        </div>

        {fetchError && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Gagal memuat data verifikasi: {fetchError}
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
            <p className="text-sm font-medium text-blue-900 mb-1">Total Survey</p>
            <h3 className="text-4xl font-bold text-blue-600">{totalSurveys ?? "-"}</h3>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
            <p className="text-sm font-medium text-orange-900 mb-1">Total Survey Existing</p>
            <h3 className="text-4xl font-bold text-orange-600">{totalExisting ?? "-"}</h3>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
            <p className="text-sm font-medium text-purple-900 mb-1">Total Survey APJ Propose</p>
            <h3 className="text-4xl font-bold text-purple-600">{totalPropose ?? "-"}</h3>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
            <p className="text-sm font-medium text-emerald-900 mb-1">Total Survey Pra Existing</p>
            <h3 className="text-4xl font-bold text-emerald-600">{totalPraExisting ?? "-"}</h3>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
            <p className="text-sm font-medium text-green-900 mb-1">Menunggu Verifikasi</p>
            <h3 className="text-4xl font-bold text-green-600">{diverifikasiCount ?? "-"}</h3>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-200">
          <button 
            onClick={() => setActiveTab("existing")}
            className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all ${
              activeTab === "existing"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <span className="text-xl">📁</span>
            Survey Existing
          </button>
          <button 
            onClick={() => setActiveTab("propose")}
            className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all ${
              activeTab === "propose"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <span className="text-xl">💡</span>
            Survey APJ Propose
          </button>
          <button 
            onClick={() => setActiveTab("pra-existing")}
            className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all ${
              activeTab === "pra-existing"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <span className="text-xl">🧾</span>
            Survey Pra Existing
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 lg:p-6 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-black">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filter:
              </div>
              <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs font-medium text-blue-700">
                Data halaman dan statistik ditampilkan dari Supabase.
              </div>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Menunggu</option>
              </select>
              {activeTab === "existing" && (
                <>
                  <select 
                    value={filterJenisExisting}
                    onChange={(e) => setFilterJenisExisting(e.target.value)}
                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Semua Jenis</option>
                    <option>Murni</option>
                    <option>Tidak Murni</option>
                  </select>
                  <select 
                    value={filterExistingSurveyor}
                    onChange={(e) => setFilterExistingSurveyor(e.target.value)}
                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {existingSurveyorOptions.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <select 
                    value={filterExistingJudul}
                    onChange={(e) => setFilterExistingJudul(e.target.value)}
                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {existingJudulOptions.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {activeTab === "pra-existing" && (
                <>
                  <select 
                    value={filterSurveyor}
                    onChange={(e) => setFilterSurveyor(e.target.value)}
                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {surveyorOptions.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <select 
                    value={filterKecamatan}
                    onChange={(e) => {
                      setFilterKecamatan(e.target.value);
                      setFilterDesa("Semua Desa"); // Reset desa when kecamatan changes
                    }}
                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {kecamatanOptions.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <select 
                    value={filterDesa}
                    onChange={(e) => setFilterDesa(e.target.value)}
                    disabled={filterKecamatan === "Semua Kecamatan"}
                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    {desaOptions.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {activeTab === "propose" && (
                <>
                  <select 
                    value={filterProposeSurveyor}
                    onChange={(e) => setFilterProposeSurveyor(e.target.value)}
                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {proposeSurveyorOptions.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <select 
                    value={filterProposeJudul}
                    onChange={(e) => setFilterProposeJudul(e.target.value)}
                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {proposeJudulOptions.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </>
              )}<select 
                value={filterSort}
                onChange={(e) => setFilterSort(e.target.value)}
                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Terbaru</option>
                <option>Terlama</option>
              </select>
            </div>
            <div className="flex items-center gap-2 text-sm text-black">
              <span>Tampilkan:</span>
              <select
                value={showAll ? "all" : itemsPerPage}
                onChange={(e) => {
                  if (e.target.value === "all") {
                    setShowAll(true);
                    setCurrentPage(1);
                  } else {
                    setShowAll(false);
                    handleItemsPerPageChange(Number(e.target.value));
                  }
                }}
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-medium text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={100}>100</option>
                <option value="all">Semua</option>
              </select>
              <span>per halaman</span>
              <span className="ml-4 font-medium">Menampilkan {startIndex}-{endIndex} dari {totalItems} data</span>
            </div>
          </div>
        </div>

        {/* Survey List */}
        <div className="p-4 lg:p-6">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                activeTab === "existing" ? "bg-blue-100" : activeTab === "propose" ? "bg-yellow-100" : "bg-emerald-100"
              }`}>
                <span className="text-xl">
                  {activeTab === "existing" ? "📁" : activeTab === "propose" ? "💡" : "🧾"}
                </span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">
                  {activeTab === "existing" ? "Survey Existing" : activeTab === "propose" ? "Survey APJ Propose" : "Survey Pra Existing"}
                </h3>
                <p className="text-xs text-gray-600">
                  {activeTab === "existing" 
                    ? "Survey Existing dan infrastruktur pendukung" 
                    : activeTab === "propose"
                    ? "Survey area baru untuk pengembangan"
                    : "Survey pra existing sederhana"}
                </p>
              </div>
            </div>
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${
              activeTab === "existing" 
                ? "bg-blue-100 text-blue-700" 
                : activeTab === "propose"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-emerald-100 text-emerald-700"
            }`}>
              {totalItems} Survey (Hal {currentPage})
            </span>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">Memuat data survey...</p>
            </div>
          ) : filteredSurveys.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-4xl">{activeTab === "existing" ? "📁" : activeTab === "propose" ? "💡" : "🧾"}</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Survey</h4>
              <p className="text-sm text-gray-600 text-center max-w-md">
                Belum ada data survey {activeTab === "existing" ? "existing" : activeTab === "propose" ? "APJ propose" : "pra existing"} yang perlu diverifikasi.
              </p>
            </div>
          ) : (
            <>
              {/* Survey Cards */}
              <div className="space-y-4">
                {paginatedSurveys.map((survey) => (
                <div key={survey.id} className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Photo */}
                    <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {(survey.fotoTiangAPM || survey.fotoTitikActual || survey.photoUrl || survey.fotoAktual) ? (
                        <img 
                          src={survey.fotoTiangAPM || survey.fotoTitikActual || survey.photoUrl || survey.fotoAktual} 
                          alt={survey.title} 
                          className="w-full h-full object-cover rounded-lg"
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"%3E%3Crect fill="%23e5e7eb" width="80" height="80"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-size="14" fill="%239ca3af"%3ENo Image%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      ) : (
                        <span className="text-gray-400 text-xs font-medium">No Foto</span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-gray-900 mb-1">{survey.title}</h4>
                          <div className="flex flex-wrap gap-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${
                              survey.status === "menunggu" 
                                ? "bg-yellow-100 text-yellow-700"
                                : survey.status === "diverifikasi"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}>
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                              </svg>
                              {survey.status.charAt(0).toUpperCase() + survey.status.slice(1)}
                            </span>
                            {survey.editedBy && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                                Sudah diedit: {survey.editedBy}{survey.updatedAt ? ` • ${formatDate(survey.updatedAt)}` : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>{survey.surveyorName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{formatDate(survey.createdAt)}</span>
                        </div>
                        <div className="flex items-start gap-2 text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <div className="leading-tight">
                            <div className="font-medium text-gray-700">
                              {getDisplayLatitude(survey).toFixed(7)}, {getDisplayLongitude(survey).toFixed(7)}
                            </div>
                            {hasDisplayedAdminCoordinate(survey) ? (
                              <div className="mt-1 text-[11px] font-semibold text-emerald-700">
                                Final admin
                                {Number.isFinite(survey.originalLatitude) && Number.isFinite(survey.originalLongitude)
                                  ? ` • Petugas ${survey.originalLatitude?.toFixed(7)}, ${survey.originalLongitude?.toFixed(7)}`
                                  : ""}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-gray-600">
                          Kepemilikan: {survey.kepemilikan} • Jenis: {survey.jenis} • Tinggi ARM: {survey.tinggiArm}
                        </p>
                        {survey.jenisExisting && (
                          <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                            survey.jenisExisting === "Murni" 
                              ? "bg-purple-600 text-white" 
                              : "bg-orange-600 text-white"
                          }`}>
                            {survey.jenisExisting}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button 
                          onClick={() => handleViewDetail(survey)}
                          className="p-2 hover:bg-blue-100 rounded-lg transition-all" 
                          title="Lihat Detail"
                        >
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button 
                          onClick={() => handleEdit(survey)}
                          className="p-2 hover:bg-blue-100 rounded-lg transition-all" 
                          title="Edit"
                        >
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button 
                          onClick={() => handleDeleteSurvey(survey)}
                          disabled={deletingSurveyId === survey.id}
                          className="p-2 hover:bg-red-100 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                          title="Hapus"
                        >
                          {deletingSurveyId === survey.id ? (
                            <div className="w-5 h-5 animate-spin rounded-full border-2 border-red-600 border-t-transparent"></div>
                          ) : (
                            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                        {survey.status === "menunggu" && (
                          <>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleValidasi(survey);
                              }}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Verifikasi
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTolak(survey);
                              }}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Tolak
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              </div>
              
              {/* Pagination Controls */}
              <PaginationControls />
            </>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedSurvey && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 lg:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl lg:rounded-3xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-y-auto my-4">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-4 lg:p-6 rounded-t-2xl lg:rounded-t-3xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    selectedSurvey.type === "existing" ? "bg-blue-100" : "bg-yellow-100"
                  }`}>
                    <span className="text-2xl lg:text-3xl">{selectedSurvey.type === "existing" ? "📁" : "💡"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg lg:text-2xl font-bold text-gray-900 mb-1 break-words">
                      {selectedSurvey.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs lg:text-sm text-gray-600">
                      <span className={`px-2 lg:px-3 py-1 lg:py-1.5 rounded-full font-medium ${
                        selectedSurvey.status === "menunggu" 
                          ? "bg-yellow-100 text-yellow-700"
                          : selectedSurvey.status === "diverifikasi"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {selectedSurvey.status.charAt(0).toUpperCase() + selectedSurvey.status.slice(1)}
                      </span>
                      <span>•</span>
                      <span>{formatDate(selectedSurvey.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setShowDetailMap(false);
                    setSelectedTaskNavigationInfo(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-all flex-shrink-0"
                  title="Tutup"
                >
                  <svg className="w-5 h-5 lg:w-6 lg:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
              {/* Map Section */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-blue-200">
                <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-3 lg:mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Lokasi Survey
                </h3>
                {!showDetailMap ? (
                  <div className="rounded-xl border border-dashed border-blue-200 bg-white/70 px-4 py-6 text-center">
                    <p className="text-sm text-gray-600">
                      Peta belum dimuat untuk menghemat loading. Klik tombol di bawah jika perlu melihat lokasi.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowDetailMap(true)}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-700"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894l6-3a1 1 0 01.894 0l6 3a1 1 0 01.553.894v10.764a1 1 0 01-.553.894L9 20zm0 0v-8" />
                      </svg>
                      Tampilkan Peta
                    </button>
                  </div>
                ) : (
                  <DynamicDetailMap 
                    latitude={getDisplayLatitude(selectedSurvey)} 
                    longitude={getDisplayLongitude(selectedSurvey)}
                    accuracy={selectedSurvey.accuracy || 0}
                    title={selectedSurvey.title}
                    kmzFileUrl={selectedSurvey.type === "pra-existing" ? selectedSurvey.kmzFileUrl : undefined}
                    onTaskNavigationInfoChange={setSelectedTaskNavigationInfo}
                  />
                )}
                <div className="mt-3 lg:mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3 text-xs lg:text-sm">
                  <div className="bg-white/70 backdrop-blur px-3 lg:px-4 py-2 lg:py-3 rounded-lg border border-blue-200">
                    <p className="text-gray-600 mb-1">Latitude</p>
                    <p className="font-mono font-bold text-gray-900">{getDisplayLatitude(selectedSurvey).toFixed(7)}</p>
                  </div>
                  <div className="bg-white/70 backdrop-blur px-3 lg:px-4 py-2 lg:py-3 rounded-lg border border-blue-200">
                    <p className="text-gray-600 mb-1">Longitude</p>
                    <p className="font-mono font-bold text-gray-900">{getDisplayLongitude(selectedSurvey).toFixed(7)}</p>
                  </div>
                  {selectedSurvey.type === "pra-existing" && Number.isFinite(selectedSurvey.adminLatitude) && Number.isFinite(selectedSurvey.adminLongitude) && (
                    <div className="bg-emerald-50 px-3 lg:px-4 py-2 lg:py-3 rounded-lg border border-emerald-200 sm:col-span-2">
                      <p className="text-emerald-700 mb-1">Koordinat Final Admin</p>
                      <p className="font-mono font-bold text-emerald-900">
                        {selectedSurvey.adminLatitude?.toFixed(7)}, {selectedSurvey.adminLongitude?.toFixed(7)}
                      </p>
                    </div>
                  )}
                </div>
                {selectedSurvey.type === "pra-existing" && selectedSurvey.kmzFileUrl ? (
                  <div
                    className={`mt-3 rounded-lg border px-3 py-3 ${
                      selectedTaskNavigationInfo?.geometryType === "polygon"
                        ? selectedTaskNavigationInfo.isInsidePolygon
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-amber-200 bg-amber-50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedTaskNavigationInfo?.geometryType === "polygon"
                        ? selectedTaskNavigationInfo.isInsidePolygon
                          ? (selectedTaskNavigationInfo.distanceToTargetMeters ?? Number.POSITIVE_INFINITY) <= 20
                            ? "Titik berada di dalam polygon, tetapi sangat dekat batas area"
                            : "Titik berada di dalam polygon tugas"
                          : "Titik berada di luar polygon tugas"
                        : "Polygon tugas dimuat untuk pengecekan area"}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {selectedTaskNavigationInfo?.taskName
                        ? `Area tugas: ${selectedTaskNavigationInfo.taskName}.`
                        : selectedSurvey.taskTitle
                        ? `Tugas: ${selectedSurvey.taskTitle}.`
                        : "Polygon ditampilkan sesuai tugas survey pra-existing ini."}
                      {selectedTaskNavigationInfo?.geometryType === "polygon" &&
                      selectedTaskNavigationInfo.distanceToTargetMeters !== null
                        ? selectedTaskNavigationInfo.isInsidePolygon
                          ? ` Jarak titik ke tepi polygon sekitar ${Math.round(selectedTaskNavigationInfo.distanceToTargetMeters)} meter.`
                          : ` Jarak ke tepi area sekitar ${Math.round(selectedTaskNavigationInfo.distanceToTargetMeters)} meter.`
                        : ""}
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Koordinat Comparison */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-blue-200">
                <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  Perbandingan Koordinat
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Koordinat Petugas (Awal)
                    </h4>
                    <div className="space-y-1">
                      <p className="font-mono text-sm text-gray-900">
                        <span className="text-gray-600">Lat:</span> {(selectedSurvey.originalLatitude ?? selectedSurvey.latitude).toFixed(7)}
                      </p>
                      <p className="font-mono text-sm text-gray-900">
                        <span className="text-gray-600">Lng:</span> {(selectedSurvey.originalLongitude ?? selectedSurvey.longitude).toFixed(7)}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">GPS saat survey pertama kali</p>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Koordinat Admin (Final)
                    </h4>
                    <div className="space-y-1">
                      <p className="font-mono text-sm text-gray-900">
                        <span className="text-gray-600">Lat:</span> {(selectedSurvey.adminLatitude ?? selectedSurvey.latitude).toFixed(7)}
                      </p>
                      <p className="font-mono text-sm text-gray-900">
                        <span className="text-gray-600">Lng:</span> {(selectedSurvey.adminLongitude ?? selectedSurvey.longitude).toFixed(7)}
                      </p>
                      <p className="text-xs text-blue-600 mt-2 font-semibold">
                        {selectedSurvey.hasAdminCoordinateOverride ? "⚠️ Digunakan di maps" : "Sama dengan petugas"}
                      </p>
                    </div>
                  </div>
                </div>
                {selectedSurvey.hasAdminCoordinateOverride && (
                  <div className="mt-3 p-3 bg-blue-100 rounded-lg border border-blue-300">
                    <p className="text-xs text-blue-800">
                      <strong>Info:</strong> Koordinat admin yang digunakan di maps karena ada perbaikan posisi dari petugas.
                    </p>
                  </div>
                )}
              </div>

              {/* Photos Section */}
              {(selectedSurvey.fotoTiangAPM || selectedSurvey.fotoTitikActual || selectedSurvey.photoUrl || selectedSurvey.fotoAktual) && (
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-purple-200">
                  <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-3 lg:mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 lg:w-6 lg:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Dokumentasi Foto
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                    {selectedSurvey.fotoTiangAPM && (
                      <div className="space-y-2">
                        <p className="text-xs lg:text-sm font-semibold text-gray-700">Foto Tiang APM</p>
                        <img 
                          src={selectedSurvey.fotoTiangAPM} 
                          alt="Tiang APM" 
                          className="w-full h-48 lg:h-64 object-cover rounded-lg border-2 border-white shadow-lg hover:scale-105 transition-transform cursor-pointer"
                          onClick={() => window.open(selectedSurvey.fotoTiangAPM, '_blank')}
                        />
                      </div>
                    )}
                    {selectedSurvey.fotoTitikActual && (
                      <div className="space-y-2">
                        <p className="text-xs lg:text-sm font-semibold text-gray-700">Foto Titik Actual</p>
                        <img 
                          src={selectedSurvey.fotoTitikActual} 
                          alt="Titik Actual" 
                          className="w-full h-48 lg:h-64 object-cover rounded-lg border-2 border-white shadow-lg hover:scale-105 transition-transform cursor-pointer"
                          onClick={() => window.open(selectedSurvey.fotoTitikActual, '_blank')}
                        />
                      </div>
                    )}
                    {selectedSurvey.fotoKemerataan && (
                      <div className="space-y-2">
                        <p className="text-xs lg:text-sm font-semibold text-gray-700">Foto Kemerataan</p>
                        <img 
                          src={selectedSurvey.fotoKemerataan} 
                          alt="Kemerataan" 
                          className="w-full h-48 lg:h-64 object-cover rounded-lg border-2 border-white shadow-lg hover:scale-105 transition-transform cursor-pointer"
                          onClick={() => window.open(selectedSurvey.fotoKemerataan, '_blank')}
                        />
                      </div>
                    )}
                    {selectedSurvey.fotoAktual && (
                      <div className="space-y-2">
                        <p className="text-xs lg:text-sm font-semibold text-gray-700">Foto Aktual</p>
                        <img 
                          src={selectedSurvey.fotoAktual} 
                          alt="Foto Aktual" 
                          className="w-full h-48 lg:h-64 object-cover rounded-lg border-2 border-white shadow-lg hover:scale-105 transition-transform cursor-pointer"
                          onClick={() => window.open(selectedSurvey.fotoAktual, '_blank')}
                        />
                      </div>
                    )}
                    {selectedSurvey.photoUrl && !selectedSurvey.fotoTiangAPM && (
                      <div className="space-y-2">
                        <p className="text-xs lg:text-sm font-semibold text-gray-700">Foto Survey</p>
                        <img 
                          src={selectedSurvey.photoUrl} 
                          alt="Survey" 
                          className="w-full h-48 lg:h-64 object-cover rounded-lg border-2 border-white shadow-lg hover:scale-105 transition-transform cursor-pointer"
                          onClick={() => window.open(selectedSurvey.photoUrl, '_blank')}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Survey Information */}
              <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-gray-200">
                <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-3 lg:mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 lg:w-6 lg:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Informasi Survey
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                  {/* 1. Surveyor Info - Always first */}
                  <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">Surveyor</p>
                    <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.surveyorName}</p>
                    {selectedSurvey.surveyorEmail && (
                      <p className="text-xs text-gray-500 mt-1">{selectedSurvey.surveyorEmail}</p>
                    )}
                  </div>

                  {/* 2. Nama Jalan */}
                  {selectedSurvey.namaJalan && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Nama Jalan</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.namaJalan}</p>
                    </div>
                  )}

                  {/* For Survey Existing - show after Nama Jalan */}
                  {selectedSurvey.lokasiJalan && selectedSurvey.type === "existing" && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Lokasi Jalan</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.lokasiJalan}</p>
                    </div>
                  )}

                  {selectedSurvey.namaGang && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Nama Gang</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.namaGang}</p>
                    </div>
                  )}

                  {/* 3. Status ID Titik - For APJ Propose */}
                  {selectedSurvey.statusIDTitik && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Status ID Titik</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.statusIDTitik}</p>
                    </div>
                  )}

                  {/* 4. ID Titik (if ada) */}
                  {selectedSurvey.idTitik && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">ID Titik</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.idTitik}</p>
                    </div>
                  )}

                  {/* 5. Daya Lampu */}
                  {selectedSurvey.dayaLampu && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Daya Lampu</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.dayaLampu}</p>
                    </div>
                  )}

                  {/* 6. Data Tiang */}
                  {selectedSurvey.dataTiang && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Data Tiang</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.dataTiang}</p>
                    </div>
                  )}

                  {selectedSurvey.type === "pra-existing" && selectedSurvey.jenisLampu && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Jenis Lampu</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.jenisLampu}</p>
                    </div>
                  )}

                  {selectedSurvey.type === "pra-existing" && selectedSurvey.jumlahLampu && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Jumlah Lampu</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.jumlahLampu}</p>
                    </div>
                  )}

                  {selectedSurvey.type === "pra-existing" && selectedSurvey.jenisTiang && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Jenis Tiang</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.jenisTiang}</p>
                    </div>
                  )}

                  {selectedSurvey.type === "pra-existing" && selectedSurvey.kabupaten && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Kabupaten</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.kabupatenName || selectedSurvey.kabupaten}</p>
                    </div>
                  )}

                  {selectedSurvey.type === "pra-existing" && selectedSurvey.kecamatan && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Kecamatan</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.kecamatan}</p>
                    </div>
                  )}

                  {selectedSurvey.type === "pra-existing" && selectedSurvey.desa && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Desa</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.desa}</p>
                    </div>
                  )}

                  {selectedSurvey.type === "pra-existing" && selectedSurvey.banjar && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Banjar</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.banjar}</p>
                    </div>
                  )}

                  {selectedSurvey.type === "pra-existing" && (selectedSurvey.kepemilikanDisplay || selectedSurvey.kepemilikanTiang || selectedSurvey.keteranganTiang) && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Kepemilikan Tiang</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.kepemilikanDisplay || selectedSurvey.kepemilikanTiang || selectedSurvey.keteranganTiang}</p>
                    </div>
                  )}

                  {selectedSurvey.type === "pra-existing" && selectedSurvey.tipeTiangPLN && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Tipe Tiang PLN</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.tipeTiangPLN}</p>
                    </div>
                  )}

                  {selectedSurvey.type === "pra-existing" && selectedSurvey.dayaLampu && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Daya Lampu</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.dayaLampu}</p>
                    </div>
                  )}

                  {selectedSurvey.type === "pra-existing" && selectedSurvey.fungsiLampu && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Fungsi Lampu</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.fungsiLampu}</p>
                    </div>
                  )}

                  {selectedSurvey.type === "pra-existing" && selectedSurvey.garduStatus && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Gardu</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.garduStatus}</p>
                    </div>
                  )}

                  {selectedSurvey.type === "pra-existing" && selectedSurvey.kodeGardu && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Kode Gardu</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.kodeGardu}</p>
                    </div>
                  )}

                  {/* For Survey Existing - Kepemilikan/Keterangan Tiang */}
                  {(selectedSurvey.keteranganTiang || selectedSurvey.kepemilikan) && selectedSurvey.type === "existing" && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Kepemilikan Tiang</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">
                        {selectedSurvey.keteranganTiang || selectedSurvey.kepemilikan}
                      </p>
                    </div>
                  )}

                  {/* 7. Data Ruas */}
                  {selectedSurvey.dataRuas && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Data Ruas</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.dataRuas}</p>
                    </div>
                  )}

                  {/* 8. Sub Ruas */}
                  {selectedSurvey.subRuas && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Sub Ruas</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.subRuas}</p>
                    </div>
                  )}

                  {/* 9. Median */}
                  {selectedSurvey.median && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Median</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">
                        {selectedSurvey.median}
                        {selectedSurvey.tinggiMedian && selectedSurvey.lebarMedian && 
                          ` (T: ${selectedSurvey.tinggiMedian}m, L: ${selectedSurvey.lebarMedian}m)`
                        }
                      </p>
                    </div>
                  )}

                  {/* Survey Existing - Median Display */}
                  {selectedSurvey.medianDisplay && selectedSurvey.type === "existing" && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Median Jalan</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.medianDisplay}</p>
                    </div>
                  )}

                  {/* Survey Existing - Lebar Jalan Display */}
                  {selectedSurvey.lebarJalanDisplay && selectedSurvey.type === "existing" && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Lebar Jalan</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.lebarJalanDisplay}</p>
                    </div>
                  )}

                  {/* 10. Jarak Antar Tiang */}
                  {selectedSurvey.jarakAntarTiang && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Jarak Antar Tiang</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.jarakAntarTiang}m</p>
                    </div>
                  )}

                  {/* 12. Lebar Bahu Bertiang */}
                  {selectedSurvey.lebarBahuBertiang && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Lebar Bahu Bertiang</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.lebarBahuBertiang}m</p>
                    </div>
                  )}

                  {/* 13. Lebar Trotoar Bertiang */}
                  {selectedSurvey.lebarTrotoarBertiang && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Lebar Trotoar Bertiang</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.lebarTrotoarBertiang}m</p>
                    </div>
                  )}

                  {/* Survey Existing - Lebar Trotoar */}
                  {selectedSurvey.lebarTrotoar && selectedSurvey.type === "existing" && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Lebar Trotoar</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.lebarTrotoar}</p>
                    </div>
                  )}

                  {/* 14. Lainnya Bertiang (if exists) */}
                  {selectedSurvey.lainnyaBertiang && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Lainnya Bertiang</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.lainnyaBertiang}m</p>
                    </div>
                  )}

                  {/* Survey Existing specific fields */}
                  {selectedSurvey.jenisExisting && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Jenis Existing</p>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          selectedSurvey.jenisExisting === "Murni" 
                            ? "bg-purple-600 text-white" 
                            : "bg-orange-600 text-white"
                        }`}>
                          {selectedSurvey.jenisExisting}
                        </span>
                      </div>
                    </div>
                  )}

                  {(selectedSurvey.jenisTitik || selectedSurvey.jenis) && selectedSurvey.type === "existing" && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Jenis Titik</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">
                        {selectedSurvey.jenisTitik || selectedSurvey.jenis}
                      </p>
                    </div>
                  )}

                  {selectedSurvey.palet && selectedSurvey.palet !== "N/A" && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Palet/Trafo</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.palet}</p>
                    </div>
                  )}

                  {selectedSurvey.lumina && selectedSurvey.lumina !== "N/A" && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Lumina/Lampu</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.lumina}</p>
                    </div>
                  )}

                  {(selectedSurvey.tinggiARM || selectedSurvey.tinggiArm) && selectedSurvey.tinggiARM !== "N/A" && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Tinggi ARM</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">
                        {selectedSurvey.tinggiARM || selectedSurvey.tinggiArm}
                      </p>
                    </div>
                  )}

                  {selectedSurvey.tinggiAPM && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Tinggi APM</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.tinggiAPM}</p>
                    </div>
                  )}

                  {selectedSurvey.metodeUkur && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Metode Ukur</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.metodeUkur}</p>
                    </div>
                  )}
                </div>

                {/* Additional Notes */}
                {selectedSurvey.keterangan && (
                  <div className="mt-3 lg:mt-4 bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-600 mb-2">Keterangan Tambahan</p>
                    <p className="text-sm lg:text-base text-gray-900 whitespace-pre-wrap">{selectedSurvey.keterangan}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 lg:p-6 rounded-b-2xl lg:rounded-b-3xl">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 lg:gap-3">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 lg:px-6 py-2.5 lg:py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg lg:rounded-xl transition-all text-sm lg:text-base"
                >
                  Tutup
                </button>
                {selectedSurvey.status === "menunggu" && (
                  <>
                    <button 
                      onClick={() => handleTolak(selectedSurvey)}
                      className="px-4 lg:px-6 py-2.5 lg:py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg lg:rounded-xl transition-all flex items-center justify-center gap-2 text-sm lg:text-base"
                    >
                      <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Tolak
                    </button>
                    <button 
                      onClick={() => handleValidasi(selectedSurvey)}
                      className="px-4 lg:px-6 py-2.5 lg:py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg lg:rounded-xl transition-all flex items-center justify-center gap-2 text-sm lg:text-base"
                    >
                      <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Verifikasi
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editFormData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 lg:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl lg:rounded-3xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-y-auto my-4">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 lg:p-6 rounded-t-2xl lg:rounded-t-3xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 lg:w-14 lg:h-14 bg-white/20 backdrop-blur rounded-xl lg:rounded-2xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 lg:w-8 lg:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg lg:text-2xl font-bold mb-1">Edit Survey</h2>
                    <p className="text-sm text-white/90">{editFormData.title}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-all flex-shrink-0"
                  title="Tutup"
                >
                  <svg className="w-5 h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
              {/* Info Surveyor (Read Only) */}
              <div className="bg-gradient-to-br from-gray-50 to-slate-100 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-gray-300">
                <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 lg:w-6 lg:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Informasi Surveyor
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                  <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">Nama Surveyor</p>
                    <p className="font-semibold text-sm lg:text-base text-gray-900">{editFormData.surveyorName}</p>
                  </div>
                  <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">Status Survey</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      editFormData.status === "menunggu" 
                        ? "bg-yellow-100 text-yellow-700"
                        : editFormData.status === "diverifikasi"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {editFormData.status.charAt(0).toUpperCase() + editFormData.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>

              {editFormData.type !== "pra-existing" && (
                <>
              {/* Informasi Lokasi */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-blue-200">
                <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Informasi Lokasi
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Lokasi Jalan</label>
                    <input
                      type="text"
                      value={editFormData.lokasiJalan || ''}
                      onChange={(e) => setEditFormData({...editFormData, lokasiJalan: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Contoh: Jl. Raya"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Nama Jalan</label>
                    <input
                      type="text"
                      value={editFormData.namaJalan || ''}
                      onChange={(e) => setEditFormData({...editFormData, namaJalan: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Nama jalan"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Nama Gang</label>
                    <input
                      type="text"
                      value={editFormData.namaGang || ''}
                      onChange={(e) => setEditFormData({...editFormData, namaGang: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Nama gang (opsional)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Jenis Existing</label>
                    <select
                      value={editFormData.jenisExisting || ''}
                      onChange={(e) => setEditFormData({...editFormData, jenisExisting: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                    >
                      <option value="">Pilih Jenis</option>
                      <option value="Murni">Murni</option>
                      <option value="Tidak Murni">Tidak Murni</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Koordinat GPS</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.0000001"
                        value={editFormData.latitude || ''}
                        onChange={(e) => setEditFormData({...editFormData, latitude: parseFloat(e.target.value)})}
                        className="w-1/2 px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                        placeholder="Latitude"
                      />
                      <input
                        type="number"
                        step="0.0000001"
                        value={editFormData.longitude || ''}
                        onChange={(e) => setEditFormData({...editFormData, longitude: parseFloat(e.target.value)})}
                        className="w-1/2 px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                        placeholder="Longitude"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Informasi Tiang */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-green-200">
                <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 lg:w-6 lg:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Informasi Tiang & Teknis
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Kepemilikan Tiang</label>
                    <select
                      value={editFormData.keteranganTiang || editFormData.kepemilikan || ''}
                      onChange={(e) => setEditFormData({...editFormData, keteranganTiang: e.target.value, kepemilikan: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                    >
                      <option value="">Pilih kepemilikan</option>
                      <option value="PLN - Tiang TR">PLN - Tiang TR</option>
                      <option value="PLN - Tiang TM">PLN - Tiang TM</option>
                      <option value="PEMDA">PEMDA</option>
                      <option value="Swasta">Swasta</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Jenis Titik</label>
                    <select
                      value={editFormData.jenisTitik || editFormData.jenis || ''}
                      onChange={(e) => setEditFormData({...editFormData, jenisTitik: e.target.value, jenis: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                    >
                      <option value="">Pilih jenis titik</option>
                      <option value="Besi">Besi</option>
                      <option value="Beton">Beton</option>
                      <option value="Kayu">Kayu</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Palet/Trafo</label>
                    <input
                      type="text"
                      value={editFormData.palet || ''}
                      onChange={(e) => setEditFormData({...editFormData, palet: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Palet/Trafo"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Lumina/Lampu</label>
                    <input
                      type="text"
                      value={editFormData.lumina || ''}
                      onChange={(e) => setEditFormData({...editFormData, lumina: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Lumina/Lampu"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Tinggi APM</label>
                    <input
                      type="text"
                      value={editFormData.tinggiAPM || ''}
                      onChange={(e) => setEditFormData({...editFormData, tinggiAPM: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Tinggi APM"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Tinggi ARM</label>
                    <input
                      type="text"
                      value={editFormData.tinggiARM || editFormData.tinggiArm || ''}
                      onChange={(e) => setEditFormData({...editFormData, tinggiARM: e.target.value, tinggiArm: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Tinggi ARM"
                    />
                  </div>
                </div>
              </div>

              {/* Informasi Jalan */}
              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-yellow-200">
                <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 lg:w-6 lg:h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Dimensi Jalan
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Lebar Jalan 1</label>
                    <input
                      type="text"
                      value={editFormData.lebarJalan1 || ''}
                      onChange={(e) => setEditFormData({...editFormData, lebarJalan1: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Lebar jalan 1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Lebar Jalan 2</label>
                    <input
                      type="text"
                      value={editFormData.lebarJalan2 || ''}
                      onChange={(e) => setEditFormData({...editFormData, lebarJalan2: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Lebar jalan 2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Lebar Trotoar</label>
                    <input
                      type="text"
                      value={editFormData.lebarTrotoar || ''}
                      onChange={(e) => setEditFormData({...editFormData, lebarTrotoar: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Lebar trotoar"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Tinggi Median</label>
                    <input
                      type="text"
                      value={editFormData.tinggiMedian || ''}
                      onChange={(e) => setEditFormData({...editFormData, tinggiMedian: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Tinggi median"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Lebar Median</label>
                    <input
                      type="text"
                      value={editFormData.lebarMedian || ''}
                      onChange={(e) => setEditFormData({...editFormData, lebarMedian: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Lebar median"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Metode Ukur</label>
                    <input
                      type="text"
                      value={editFormData.metodeUkur || ''}
                      onChange={(e) => setEditFormData({...editFormData, metodeUkur: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Metode ukur"
                    />
                  </div>
                </div>
              </div>

              {/* Keterangan Tambahan */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-purple-200">
                <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 lg:w-6 lg:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  Keterangan Tambahan
                </h3>
                <textarea
                  value={editFormData.keterangan || ''}
                  onChange={(e) => setEditFormData({...editFormData, keterangan: e.target.value})}
                  rows={4}
                  className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900 resize-none"
                  placeholder="Tambahkan catatan atau keterangan tambahan..."
                />
              </div>
                </>
              )}

              {editFormData.type === "pra-existing" && (
                <>
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-emerald-200">
                    <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 lg:w-6 lg:h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Informasi Pra Existing
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                      <div>
                        <EditSelectField
                          label="Kabupaten"
                          value={editFormData.kabupaten || ""}
                          onChange={handlePraExistingKabupatenChange}
                          options={KABUPATEN_OPTIONS.map((item) => item.id)}
                          optionLabelMap={kabupatenOptionMap}
                        />
                      </div>
                      <div>
                        <EditSelectField
                          label="Kecamatan"
                          value={editFormData.kecamatan || ""}
                          onChange={handlePraExistingKecamatanChange}
                          options={editPraExistingDistrictOptions}
                          disabled={(editFormData.kabupaten || "") !== "tabanan"}
                        />
                      </div>
                      <div>
                        <EditSelectField
                          label="Desa"
                          value={editFormData.desa || ""}
                          onChange={handlePraExistingDesaChange}
                          options={editPraExistingDesaOptions}
                          disabled={!editFormData.kecamatan}
                        />
                      </div>
                      <div>
                        <EditSelectField
                          label="Banjar"
                          value={editFormData.banjar || ""}
                          onChange={(value) => setEditFormData({ ...editFormData, banjar: value })}
                          options={editPraExistingBanjarOptions}
                          disabled={!editFormData.desa}
                        />
                      </div>
                      <div>
                        <EditSelectField
                          label="Kepemilikan Tiang"
                          value={editFormData.kepemilikanTiang || ""}
                          onChange={handlePraExistingKepemilikanChange}
                          options={PRA_EXISTING_KEPEMILIKAN_OPTIONS}
                        />
                      </div>
                      <div>
                        <EditSelectField
                          label="Tipe Tiang PLN"
                          value={editFormData.tipeTiangPLN || ""}
                          onChange={handlePraExistingTipeTiangPLNChange}
                          options={PRA_EXISTING_TIPE_TANGAN_PLN_OPTIONS}
                          disabled={editFormData.kepemilikanTiang !== "PLN"}
                        />
                      </div>
                      <div>
                        <EditSelectField
                          label="Jenis Tiang"
                          value={editFormData.jenisTiang || ""}
                          onChange={(value) => setEditFormData({ ...editFormData, jenisTiang: value })}
                          options={PRA_EXISTING_JENIS_TIANG_OPTIONS}
                        />
                      </div>
                      <div>
                        <EditSelectField
                          label="Jenis Lampu"
                          value={editFormData.jenisLampu || ""}
                          onChange={(value) => setEditFormData({ ...editFormData, jenisLampu: value })}
                          options={PRA_EXISTING_JENIS_LAMPU_OPTIONS}
                        />
                      </div>
                      <div>
                        <EditSelectField
                          label="Jumlah Lampu"
                          value={editFormData.jumlahLampu || ""}
                          onChange={(value) => setEditFormData({ ...editFormData, jumlahLampu: value })}
                          options={PRA_EXISTING_JUMLAH_LAMPU_OPTIONS}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">Daya Lampu</label>
                        <input
                          type="text"
                          value={editFormData.dayaLampu || ''}
                          onChange={(e) => setEditFormData({...editFormData, dayaLampu: e.target.value})}
                          className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                          placeholder="30 / 60 / 80"
                        />
                      </div>
                      <div>
                        <EditSelectField
                          label="Fungsi Lampu"
                          value={editFormData.fungsiLampu || ""}
                          onChange={(value) => setEditFormData({ ...editFormData, fungsiLampu: value })}
                          options={PRA_EXISTING_FUNGSI_LAMPU_OPTIONS}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">Gardu</label>
                        <input
                          type="text"
                          value={editFormData.garduStatus || ''}
                          onChange={(e) => setEditFormData({...editFormData, garduStatus: e.target.value})}
                          className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                          placeholder="Ada / Tidak Ada"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">Kode Gardu</label>
                        <input
                          type="text"
                          value={editFormData.kodeGardu || ''}
                          onChange={(e) => setEditFormData({...editFormData, kodeGardu: e.target.value})}
                          className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                          placeholder="Kode Gardu"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">Koordinat GPS</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.0000001"
                            value={editFormData.latitude || ''}
                            onChange={(e) => setEditFormData({...editFormData, latitude: parseFloat(e.target.value)})}
                            className="w-1/2 px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                            placeholder="Latitude"
                          />
                          <input
                            type="number"
                            step="0.0000001"
                            value={editFormData.longitude || ''}
                            onChange={(e) => setEditFormData({...editFormData, longitude: parseFloat(e.target.value)})}
                            className="w-1/2 px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                            placeholder="Longitude"
                          />
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-emerald-900 mb-2">Koordinat Final Admin</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <input
                            type="number"
                            step="0.0000001"
                            value={editFormData.adminLatitude ?? ""}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                adminLatitude: e.target.value === "" ? undefined : parseFloat(e.target.value),
                              })
                            }
                            className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                            placeholder="Latitude final admin"
                          />
                          <input
                            type="number"
                            step="0.0000001"
                            value={editFormData.adminLongitude ?? ""}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                adminLongitude: e.target.value === "" ? undefined : parseFloat(e.target.value),
                              })
                            }
                            className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                            placeholder="Longitude final admin"
                          />
                        </div>
                        <p className="mt-2 text-xs text-emerald-700">
                          Koordinat ini menjadi acuan map setelah tombol Verifikasi dijalankan admin.
                        </p>
                        <p className="mt-1 text-xs text-gray-600">
                          Koordinat petugas awal: {(editFormData.originalLatitude ?? editFormData.latitude).toFixed(7)}, {(editFormData.originalLongitude ?? editFormData.longitude).toFixed(7)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-purple-200">
                    <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 lg:w-6 lg:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      Keterangan Tambahan
                    </h3>
                    <textarea
                      value={editFormData.keterangan || ''}
                      onChange={(e) => setEditFormData({...editFormData, keterangan: e.target.value})}
                      rows={4}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm lg:text-base text-gray-900 resize-none"
                      placeholder="Tambahkan catatan atau keterangan tambahan..."
                    />
                  </div>
                </>
              )}

              {/* URL Foto (Read Only) */}
              {(editFormData.fotoTiangAPM || editFormData.fotoTitikActual || editFormData.fotoAktual) && (
                <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-gray-200">
                  <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 lg:w-6 lg:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Foto Survey (Tidak bisa diedit)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {editFormData.fotoTiangAPM && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">Foto Tiang APM</p>
                        <img 
                          src={editFormData.fotoTiangAPM} 
                          alt="Tiang APM" 
                          className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
                        />
                      </div>
                    )}
                    {editFormData.fotoTitikActual && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">Foto Titik Actual</p>
                        <img 
                          src={editFormData.fotoTitikActual} 
                          alt="Titik Actual" 
                          className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
                        />
                      </div>
                    )}
                    {editFormData.fotoAktual && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">Foto Aktual Pra Existing</p>
                        <img 
                          src={editFormData.fotoAktual} 
                          alt="Foto Aktual Pra Existing" 
                          className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 lg:p-6 rounded-b-2xl lg:rounded-b-3xl">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 lg:gap-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  disabled={isSaving}
                  className="px-4 lg:px-6 py-2.5 lg:py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg lg:rounded-xl transition-all text-sm lg:text-base disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="px-4 lg:px-6 py-2.5 lg:py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg lg:rounded-xl transition-all flex items-center justify-center gap-2 text-sm lg:text-base disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Simpan Perubahan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


