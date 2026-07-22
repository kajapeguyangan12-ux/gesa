"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { fetchWithCache } from "@/utils/firestoreCache";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Image from "next/image";
import { KABUPATEN_OPTIONS } from "@/utils/constants";
import LampDistanceAnalysis from "@/components/kemerataan/LampDistanceAnalysis";

interface GridCell {
  value: string;
}

interface ReportOption {
  id: string;
  label: string;
  data: any;
  meta?: {
    primary: string;
    secondary: string;
    watt: string;
    poleHeight: string;
    voltage?: string;
    title?: string;
    location?: string;
    officer?: string;
    date?: string;
    time?: string;
    status?: string;
    source?: string;
    kabupaten?: string;
  };
}

interface CachedReportEntry {
  id: string;
  data: any;
}

type JenisJalan = "arterial" | "kolektor" | "lokal" | "lingkungan" | "";
type KabupatenOption = { id: string; name: string; description: string };
type LoadDirection = "top" | "middle" | "bottom";
type LoadMode = "2" | "3" | "group";
type LampPlacementMode = "sejajar" | "zigzag" | "berhadapan";
type LampSide = "left" | "right";
type GroupLoadConfig = {
  uid: string;
  index: number;
  row: number;
  width: string;
  reportId?: string | null;
  label?: string | null;
  data?: any | null;
  layer?: Map<string, GridCell>;
  dimming?: number;
  open?: boolean;
};
const TITIK_API_COL_INDEX = 2;

const normalizeKabupatenList = (value: any): string[] => {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => String(v).trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
};

function UniformityAnalysisContent() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super-admin";
  const kabupatenOptions: KabupatenOption[] = [...KABUPATEN_OPTIONS];

  const allowedKabupatenIds = useMemo(() => {
    if (!user) return kabupatenOptions.map((k) => k.id);
    if (isAdmin) return kabupatenOptions.map((k) => k.id);
    const raw =
      (user as any)?.kabupaten_allowed ??
      (user as any)?.kabupatenAllowed ??
      (user as any)?.kabupaten ??
      (user as any)?.kabupaten_id;
    const normalized = normalizeKabupatenList(raw);
    return normalized.length > 0 ? normalized : kabupatenOptions.map((k) => k.id);
  }, [user, isAdmin, kabupatenOptions]);

  const availableKabupaten = useMemo(
    () => kabupatenOptions.filter((k) => allowedKabupatenIds.includes(k.id)),
    [kabupatenOptions, allowedKabupatenIds]
  );

  const [activeKabupaten, setActiveKabupaten] = useState<string | null>(null);
  const [pendingKabupaten, setPendingKabupaten] = useState<string | null>(null);
  const [showKabupatenPicker, setShowKabupatenPicker] = useState(false);
  const [showKabupatenConfirm, setShowKabupatenConfirm] = useState(false);
  const useKabupatenFilter = false; // khusus kemerataan: gunakan data report tanpa wajib pilih kabupaten

  const [jenisJalan, setJenisJalan] = useState<JenisJalan>("");
  const [jarakTiang, setJarakTiang] = useState("");
  const [lebarJalan, setLebarJalan] = useState("");
  const [lebarJalanTop, setLebarJalanTop] = useState("");
  const [lebarJalanMiddle, setLebarJalanMiddle] = useState("");
  const [lebarJalanBottom, setLebarJalanBottom] = useState("");
  const [loadMode, setLoadMode] = useState<LoadMode>("3");
  const [placementMode, setPlacementMode] = useState<LampPlacementMode>("sejajar");
  const [groupLoadCount, setGroupLoadCount] = useState("4");
  const [groupDefaultWidth, setGroupDefaultWidth] = useState("");
  const [groupLoads, setGroupLoads] = useState<GroupLoadConfig[]>([]);
  const [middleUpRows, setMiddleUpRows] = useState("");
  const [middleDownRows, setMiddleDownRows] = useState("");
  const [gridData, setGridData] = useState<Map<string, GridCell>>(new Map());
  const [topGridData, setTopGridData] = useState<Map<string, GridCell>>(new Map());
  const [middleGridData, setMiddleGridData] = useState<Map<string, GridCell>>(new Map());
  const [bottomGridData, setBottomGridData] = useState<Map<string, GridCell>>(new Map());
  const [rows, setRows] = useState(0);
  const [cols, setCols] = useState(0);
  const [isGridReady, setIsGridReady] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<"full" | "avg-only">("full");
  const [dimmingTop, setDimmingTop] = useState(100);
  const [dimmingMiddle, setDimmingMiddle] = useState(100);
  const [dimmingBottom, setDimmingBottom] = useState(100);
  const [showSidebar, setShowSidebar] = useState(true);
  const [reportsList, setReportsList] = useState<ReportOption[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [showTopList, setShowTopList] = useState(false);
  const [showMiddleList, setShowMiddleList] = useState(false);
  const [showBottomList, setShowBottomList] = useState(false);
  const [selectedReportTopId, setSelectedReportTopId] = useState<string | null>(null);
  const [selectedReportTopData, setSelectedReportTopData] = useState<any | null>(null);
  const [selectedReportTopLabel, setSelectedReportTopLabel] = useState<string | null>(null);
  const [lastLoadedTopId, setLastLoadedTopId] = useState<string | null>(null);
  const [selectedReportMiddleId, setSelectedReportMiddleId] = useState<string | null>(null);
  const [selectedReportMiddleData, setSelectedReportMiddleData] = useState<any | null>(null);
  const [selectedReportMiddleLabel, setSelectedReportMiddleLabel] = useState<string | null>(null);
  const [lastLoadedMiddleId, setLastLoadedMiddleId] = useState<string | null>(null);
  const [selectedReportBottomId, setSelectedReportBottomId] = useState<string | null>(null);
  const [selectedReportBottomData, setSelectedReportBottomData] = useState<any | null>(null);
  const [selectedReportBottomLabel, setSelectedReportBottomLabel] = useState<string | null>(null);
  const [lastLoadedBottomId, setLastLoadedBottomId] = useState<string | null>(null);

  const getKabupatenStorageKey = useCallback(() => {
    if (!user?.uid) return "gesa_kabupaten_active";
    return `gesa_kabupaten_active_${user.uid}`;
  }, [user?.uid]);

  const applyKabupatenSelection = useCallback((kabupatenId: string) => {
    setActiveKabupaten(kabupatenId);
    const key = getKabupatenStorageKey();
    if (key) localStorage.setItem(key, kabupatenId);
  }, [getKabupatenStorageKey]);

  useEffect(() => {
    if (!user) return;
    if (!useKabupatenFilter) {
      setActiveKabupaten(null);
      setShowKabupatenPicker(false);
      return;
    }
    const key = getKabupatenStorageKey();
    const stored = key ? localStorage.getItem(key) : null;
    const allowedIds = availableKabupaten.map((k) => k.id);
    if (stored && allowedIds.includes(stored)) {
      setActiveKabupaten(stored);
      setShowKabupatenPicker(false);
      return;
    }
    if (availableKabupaten.length === 1) {
      applyKabupatenSelection(availableKabupaten[0].id);
      setShowKabupatenPicker(false);
      return;
    }
    setActiveKabupaten(null);
    setShowKabupatenPicker(true);
  }, [user, availableKabupaten, getKabupatenStorageKey, applyKabupatenSelection]);

  useEffect(() => {
    if (!activeKabupaten) return;
    setReportsList([]);
    setSelectedReportTopId(null);
    setSelectedReportTopData(null);
    setSelectedReportTopLabel(null);
    setSelectedReportMiddleId(null);
    setSelectedReportMiddleData(null);
    setSelectedReportMiddleLabel(null);
    setSelectedReportBottomId(null);
    setSelectedReportBottomData(null);
    setSelectedReportBottomLabel(null);
    setLastLoadedTopId(null);
    setLastLoadedMiddleId(null);
    setLastLoadedBottomId(null);
    setShowTopList(false);
    setShowMiddleList(false);
    setShowBottomList(false);
  }, [activeKabupaten]);

  const clearLoadedGridData = useCallback((options?: { resetGroupReports?: boolean }) => {
    setGridData(new Map());
    setTopGridData(new Map());
    setMiddleGridData(new Map());
    setBottomGridData(new Map());
    setSelectedReportTopId(null);
    setSelectedReportTopData(null);
    setSelectedReportTopLabel(null);
    setSelectedReportMiddleId(null);
    setSelectedReportMiddleData(null);
    setSelectedReportMiddleLabel(null);
    setSelectedReportBottomId(null);
    setSelectedReportBottomData(null);
    setSelectedReportBottomLabel(null);
    setLastLoadedTopId(null);
    setLastLoadedMiddleId(null);
    setLastLoadedBottomId(null);
    setShowTopList(false);
    setShowMiddleList(false);
    setShowBottomList(false);
    setGroupLoads((current) =>
      current.map((item) => ({
        ...item,
        reportId: options?.resetGroupReports ? null : item.reportId,
        label: options?.resetGroupReports ? null : item.label,
        data: options?.resetGroupReports ? null : item.data,
        layer: new Map<string, GridCell>(),
        open: false,
      }))
    );
  }, []);

  // Jenis jalan options
  const jenisJalanOptions = [
    {
      id: "arterial",
      name: "Arteri",
      icon: "🛣️",
      description: "Jalan utama dengan lalu lintas tinggi",
    },
    {
      id: "kolektor",
      name: "Kolektor",
      icon: "🛣️",
      description: "Jalan penghubung dengan lalu lintas sedang",
    },
    {
      id: "lokal",
      name: "Lokal",
      icon: "🏘️",
      description: "Jalan lokal dengan lalu lintas rendah",
    },
    {
      id: "lingkungan",
      name: "Lingkungan",
      icon: "🌳",
      description: "Jalan lingkungan dengan lalu lintas sangat rendah",
    },
  ];

  // Calculate statistics
  const calculateStats = useCallback(() => {
    const parseWidth = (value: string) => {
      const parsed = parseFloat(value);
      return isFinite(parsed) && parsed > 0 ? parsed : 0;
    };
    const fallbackWidth = parseWidth(lebarJalan);
    const topCols = Math.max(0, Math.min(cols, Math.ceil(parseWidth(lebarJalanTop) || fallbackWidth)));
    const middleCols = Math.max(0, Math.min(cols, Math.ceil(parseWidth(lebarJalanMiddle) || fallbackWidth)));
    const bottomCols = Math.max(0, Math.min(cols, Math.ceil(parseWidth(lebarJalanBottom) || fallbackWidth)));
    const middleRow = (() => {
      const upValue = Math.ceil(parseFloat(middleUpRows));
      if (isFinite(upValue) && upValue > 0) return Math.max(0, Math.min(rows - 1, upValue - 1));
      return Math.max(0, Math.min(rows - 1, Math.floor((rows - 1) / 2)));
    })();
    const splitRow = Math.ceil(rows / 2);
    const getActiveColsForRow = (row: number) => {
      if (!isGridReady || rows <= 0 || cols <= 0) return 0;
      if (loadMode === "group") {
        const nearest = groupLoads.reduce<GroupLoadConfig | null>((best, item) => {
          if (!best) return item;
          return Math.abs((item.row || 1) - 1 - row) < Math.abs((best.row || 1) - 1 - row) ? item : best;
        }, null);
        const width = nearest ? parseWidth(nearest.width) || parseWidth(groupDefaultWidth) : parseWidth(groupDefaultWidth);
        return Math.max(0, Math.min(cols, Math.ceil(width)));
      }
      if (loadMode === "3") {
        const topMiddleBoundary = Math.ceil((0 + middleRow) / 2);
        const middleBottomBoundary = Math.floor((middleRow + (rows - 1)) / 2);
        if (row < topMiddleBoundary) return topCols;
        if (row <= middleBottomBoundary) return middleCols;
        return bottomCols;
      }
      return row < splitRow ? topCols : bottomCols;
    };

    const values: number[] = [];
    let activeCellCount = 0;
    let measuredCount = 0;
    let minCell: { row: number; col: number } | null = null;
    let minValue = Number.POSITIVE_INFINITY;
    for (let row = 0; row < rows; row++) {
      const activeCols = getActiveColsForRow(row);
      for (let col = 0; col < activeCols; col++) {
        activeCellCount += 1;
        const cell = gridData.get(`${row}-${col}`);
        if (!cell || cell.value.trim() === "") continue;
        const raw = parseFloat(cell.value);
        const val = !isNaN(raw) && isFinite(raw) ? raw : 0;
        if (val > 0) {
          values.push(val);
          measuredCount += 1;
          if (val < minValue) {
            minValue = val;
            minCell = { row, col };
          }
        }
      }
    }

    if (values.length === 0) {
      return { min: 0, max: 0, avg: 0, uniformity: 0, count: activeCellCount, measuredCount: 0, minRow: 0, minCol: 0 };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const uniformity = min > 0 ? (avg / min) : 0;

    return { min, max, avg, uniformity, count: activeCellCount, measuredCount, minRow: minCell ? minCell.row + 1 : 0, minCol: minCell ? minCell.col + 1 : 0 };
  }, [gridData, rows, cols, isGridReady, loadMode, middleUpRows, lebarJalan, lebarJalanTop, lebarJalanMiddle, lebarJalanBottom, groupDefaultWidth, groupLoads]);

  const stats = useMemo(() => calculateStats(), [calculateStats]);

  const ROAD_STANDARDS: Record<string, { avgMin: number; ratioMax: number }> = {
    arterial: { avgMin: 17, ratioMax: 3.99 },
    kolektor: { avgMin: 12, ratioMax: 5.99 },
    lokal: { avgMin: 9, ratioMax: 6.99 },
    lingkungan: { avgMin: 6, ratioMax: 6.99 },
  };

  const activeStandard = jenisJalan ? ROAD_STANDARDS[jenisJalan] : null;
  const ratioActual = stats.min > 0 ? stats.avg / stats.min : 0;
  const avgOk = activeStandard ? stats.avg >= activeStandard.avgMin : false;
  const ratioOk = activeStandard ? ratioActual <= activeStandard.ratioMax : false;
  const overallOk = analysisMode === "avg-only" ? avgOk : (avgOk && ratioOk);

  const TARGET_AVG_BY_ROAD: Record<JenisJalan, number> = {
    arterial: 13,
    kolektor: 9,
    lokal: 7,
    lingkungan: 4,
    "": 0,
  };
  const dimmingOptions = [100, 90, 80, 70, 60, 50];

  const parsePositiveInt = (value: string) => {
    const n = Math.ceil(parseFloat(value));
    return isFinite(n) && n > 0 ? n : 0;
  };

  const parsePositiveFloat = (value: string) => {
    const n = parseFloat(value);
    return isFinite(n) && n > 0 ? n : 0;
  };

  const computeRowsForMode = (jarakValue: number, upValue: number, downValue: number) => {
    if (loadMode === "3" && upValue > 0 && downValue > 0) {
      return upValue + downValue;
    }
    const baseRows = Math.ceil(jarakValue);
    if (loadMode === "3") {
      return baseRows === 35 ? 70 : baseRows;
    }
    return baseRows;
  };

  const getRoadWidthForLoad = (direction: "top" | "middle" | "bottom") => {
    const fallback = parsePositiveFloat(lebarJalan);
    if (direction === "top") return parsePositiveFloat(lebarJalanTop) || fallback;
    if (direction === "middle") return parsePositiveFloat(lebarJalanMiddle) || fallback;
    return parsePositiveFloat(lebarJalanBottom) || fallback;
  };

  const getRoadColsForLoad = (direction: "top" | "middle" | "bottom") => {
    return Math.ceil(getRoadWidthForLoad(direction));
  };

  const getEffectiveRoadWidth = () => {
    if (loadMode === "group") {
      const widths = groupLoads.length > 0
        ? groupLoads.map((item) => parsePositiveFloat(item.width) || parsePositiveFloat(groupDefaultWidth))
        : [parsePositiveFloat(groupDefaultWidth)];
      return Math.max(...widths, 0);
    }
    const widths = [getRoadWidthForLoad("top"), getRoadWidthForLoad("bottom")];
    if (loadMode === "3") widths.push(getRoadWidthForLoad("middle"));
    return Math.max(...widths, 0);
  };

  const isRoadWidthReady = () => {
    if (loadMode === "group") {
      const count = parsePositiveInt(groupLoadCount);
      if (count < 2) return false;
      if (groupLoads.length > 0) {
        return groupLoads.every((item) => (parsePositiveFloat(item.width) || parsePositiveFloat(groupDefaultWidth)) > 0);
      }
      return parsePositiveFloat(groupDefaultWidth) > 0;
    }
    const topReady = getRoadWidthForLoad("top") > 0;
    const bottomReady = getRoadWidthForLoad("bottom") > 0;
    const middleReady = loadMode === "2" || getRoadWidthForLoad("middle") > 0;
    return topReady && bottomReady && middleReady;
  };

  const createGroupLoads = (count: number, rowsCount: number, defaultWidth: string) => {
    const safeCount = Math.max(2, Math.min(30, count));
    return Array.from({ length: safeCount }, (_, index) => {
      const row = safeCount === 1 ? 1 : Math.round((index * Math.max(0, rowsCount - 1)) / (safeCount - 1)) + 1;
      const existing = groupLoads[index];
      return {
        uid: existing?.uid || `group-${index + 1}`,
        index,
        row,
        width: existing?.width || defaultWidth,
        reportId: existing?.reportId || null,
        label: existing?.label || null,
        data: existing?.data || null,
        layer: existing?.layer || new Map<string, GridCell>(),
        dimming: existing?.dimming ?? 100,
        open: existing?.open || false,
      };
    });
  };

  // Generate grid based on dimensions
  const handleGenerateGrid = useCallback(() => {
    const jarakValue = parseFloat(jarakTiang);
    const lebarValue = getEffectiveRoadWidth();
    const upValue = parsePositiveInt(middleUpRows);
    const downValue = parsePositiveInt(middleDownRows);

    if (!jenisJalan) {
      alert("Pilih jenis jalan terlebih dahulu!");
      return;
    }

    if (!isFinite(jarakValue) || jarakValue <= 0 || !isRoadWidthReady() || lebarValue <= 0) {
      alert("Masukkan jarak tiang dan lebar jalan setiap load yang valid!");
      return;
    }

    // Lebar jalan terbesar = columns total. Setiap load tetap dibatasi oleh lebar jalannya sendiri.
    // Jarak tiang = rows (vertical/ke bawah)
    const newRows = computeRowsForMode(jarakValue, upValue, downValue);
    const newCols = Math.ceil(lebarValue);

    setRows(newRows);
    setCols(newCols);
    setGridData(new Map());
    setTopGridData(new Map());
    setMiddleGridData(new Map());
    setBottomGridData(new Map());
    if (loadMode === "group") {
      setGroupLoads(createGroupLoads(parsePositiveInt(groupLoadCount), newRows, groupDefaultWidth));
    } else {
      setGroupLoads([]);
    }
    setIsGridReady(true);
    // Autoload reports list so petugas can pick immediately
    try {
      fetchReportsList();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Autofetch reports failed:", e);
    }
  }, [jenisJalan, jarakTiang, lebarJalan, lebarJalanTop, lebarJalanMiddle, lebarJalanBottom, loadMode, groupLoadCount, groupDefaultWidth, groupLoads, middleUpRows, middleDownRows, activeKabupaten]);

  const getCellKey = (row: number, col: number) => `${row}-${col}`;

  const handleCellChange = useCallback((row: number, col: number, value: string) => {
    const cellKey = getCellKey(row, col);
    setGridData(prev => {
      const newMap = new Map(prev);
      if (value.trim() === "") {
        newMap.delete(cellKey);
      } else {
        newMap.set(cellKey, { value });
      }
      return newMap;
    });
  }, []);

  const handleLoadDataFromTop = useCallback(() => {
    (async () => {
      // Prioritize selected report for Load Data Pertama
      if (selectedReportTopData) {
        if (selectedReportTopId && lastLoadedTopId === selectedReportTopId) return;
        const ok = applyReportToGrid(selectedReportTopData, "top", selectedReportTopId || undefined);
        if (ok) return;
      }

      // Fallback: fetch latest report from cache-first store
      try {
        const cacheKey = `kemerataan_report_latest_v2_${activeKabupaten || "all"}`;
        const entry = await fetchCachedSingleReport(cacheKey, "desc");

        if (entry) {
          const ok = applyReportToGrid(entry.data, "top", entry.id);
          if (ok) return;
        }
      } catch (err) {
        console.error("Error fetching reports:", err);
      }
      alert("Tidak ada data untuk di-load!");
    })();
  }, [selectedReportTopData, selectedReportTopId, lastLoadedTopId, activeKabupaten, fetchCachedSingleReport]);

  const handleLoadDataFromBottom = useCallback(() => {
    (async () => {
      // Prioritize selected report for Load Data Kedua
      if (selectedReportBottomData) {
        if (selectedReportBottomId && lastLoadedBottomId === selectedReportBottomId) return;
        const ok = applyReportToGrid(selectedReportBottomData, "bottom", selectedReportBottomId || undefined);
        if (ok) return;
      }

      // Fallback: fetch oldest report from cache-first store
      try {
        const cacheKey = `kemerataan_report_oldest_v2_${activeKabupaten || "all"}`;
        const entry = await fetchCachedSingleReport(cacheKey, "asc");

        if (entry) {
          const ok = applyReportToGrid(entry.data, "bottom", entry.id);
          if (ok) return;
        }
      } catch (err) {
        console.error("Error fetching reports:", err);
      }
      alert("Tidak ada data untuk di-load!");
    })();
  }, [selectedReportBottomData, selectedReportBottomId, lastLoadedBottomId, activeKabupaten, fetchCachedSingleReport]);

  const handleLoadDataFromMiddle = useCallback(() => {
    (async () => {
      if (selectedReportMiddleData) {
        if (selectedReportMiddleId && lastLoadedMiddleId === selectedReportMiddleId) return;
        const ok = applyReportToGrid(selectedReportMiddleData, "middle", selectedReportMiddleId || undefined);
        if (ok) return;
      }

      try {
        const cacheKey = `kemerataan_report_middle_v2_${activeKabupaten || "all"}`;
        const entry = await fetchCachedSingleReport(cacheKey, "desc");

        if (entry) {
          const ok = applyReportToGrid(entry.data, "middle", entry.id);
          if (ok) return;
        }
      } catch (err) {
        console.error("Error fetching reports:", err);
      }
      alert("Tidak ada data untuk di-load!");
    })();
  }, [selectedReportMiddleData, selectedReportMiddleId, lastLoadedMiddleId, activeKabupaten, fetchCachedSingleReport]);

  const deriveReportMeta = (data: any) => {
    if (!data) {
      return {
        primary: "(untitled)",
        secondary: "",
        watt: "",
        poleHeight: "",
      };
    }

    const name =
      data.reporterName ||
      data.nama_pelapor ||
      data.name ||
      data.user ||
      data.reporter ||
      data.petugas ||
      data.userName ||
      data.displayName ||
      data.modifiedBy ||
      data.createdBy;
    const lokasi =
      data.projectLocation ||
      data.location ||
      data.lokasi ||
      data.place ||
      data.lokasiJalan ||
      data.namaJalan ||
      data.alamat;
    const title =
      data.projectTitle ||
      data.title ||
      data.judul ||
      data.name ||
      data.nama ||
      data.namaLampu;
    const lamp = data.lamp || data.lampu || data.spesifikasi || data.spec || {};
    const wattRaw =
      data.watt || data.power || data.potency || data.wattage || data.lamp_watt ||
      data.daya || data.daya_lampu || data.dayaLampu || data.lamp_power || data.lampPower ||
      lamp.watt || lamp.power || lamp.daya || lamp.daya_lampu || lamp.wattage;
    const poleRaw =
      data.meter || data.tinggiMeter || data.tinggiTiangMeter ||
      data.poleHeight || data.tinggi_tiang || data.height || data.pole_height || data.ketinggian || data.tinggi || data.tinggiTiang ||
      lamp.poleHeight || lamp.tinggi || lamp.height || lamp.tinggi_tiang || lamp.ketinggian;
    const watt = wattRaw ? `${String(wattRaw).replace(/\s*[Ww]\s*$/, "")}W` : "";
    const poleHeight = poleRaw ? `${String(poleRaw).replace(/\s*[Mm]\s*$/, "")}m` : "";
    const primary = [watt, poleHeight].filter(Boolean).join(" • ") || title || data.note || "(untitled)";
    const secondary = [name ? `oleh ${name}` : "", lokasi ? String(lokasi) : ""].filter(Boolean).join(" • ");

    return {
      primary,
      secondary,
      watt,
      poleHeight,
    };
  };

  const deriveReportLabel = (data: any) => {
    const meta = deriveReportMetaSafe(data);
    return meta.secondary ? `${meta.primary} - ${meta.secondary}` : meta.primary;
  };

  const deriveReportMetaSafe = (data: any) => {
    if (!data) {
      return {
        primary: "(untitled)",
        secondary: "",
        watt: "",
        poleHeight: "",
        voltage: "",
        title: "",
        location: "",
        officer: "",
        date: "",
        time: "",
        status: "",
        source: "",
        kabupaten: "",
      };
    }

    const raw = data.rawPayload || {};
    const merged = { ...raw, ...data };
    const lamp = merged.lamp || merged.lampu || merged.spesifikasi || merged.spec || {};
    const officer =
      merged.officer ||
      merged.reporterName ||
      merged.createdByName ||
      merged.nama_pelapor ||
      merged.petugas ||
      merged.userName ||
      merged.displayName ||
      merged.modifiedBy ||
      merged.createdBy ||
      merged.user ||
      merged.reporter ||
      "";
    const location =
      merged.projectLocation ||
      merged.location ||
      merged.lokasi ||
      merged.place ||
      merged.lokasiJalan ||
      merged.namaJalan ||
      merged.alamat ||
      merged.alamatJalan ||
      "";
    const title =
      merged.projectTitle ||
      merged.title ||
      merged.judul ||
      merged.nama ||
      merged.namaLampu ||
      merged.lampName ||
      merged.name ||
      "";
    const wattRaw =
      merged.watt || merged.power || merged.potency || merged.wattage || merged.lamp_watt ||
      merged.daya || merged.daya_lampu || merged.dayaLampu || merged.lamp_power || merged.lampPower ||
      lamp.watt || lamp.power || lamp.daya || lamp.daya_lampu || lamp.wattage;
    const poleRaw =
      merged.meter || merged.tinggiMeter || merged.tinggiTiangMeter ||
      merged.poleHeight || merged.tinggi_tiang || merged.tinggi_tiang_m || merged.height || merged.pole_height || merged.ketinggian || merged.tinggi || merged.tinggiTiang ||
      lamp.poleHeight || lamp.tinggi || lamp.height || lamp.tinggi_tiang || lamp.ketinggian;
    const voltageRaw =
      merged.voltage || merged.tegangan || merged.teganganAwal || merged.initialVoltage || merged.volt || merged.lamp_voltage ||
      lamp.voltage;
    const watt = wattRaw ? `${String(wattRaw).replace(/\s*[Ww]\s*$/, "")}W` : "";
    const poleHeight = poleRaw ? `${String(poleRaw).replace(/\s*[Mm]\s*$/, "")}m` : "";
    const voltage = voltageRaw ? `${String(voltageRaw).replace(/\s*[Vv]\s*$/, "")}V` : "";
    const primary = [watt, poleHeight].filter(Boolean).join(" • ") || title || merged.note || "(untitled)";
    const secondary = [officer ? `oleh ${officer}` : "", location ? String(location) : ""].filter(Boolean).join(" • ");

    return {
      primary,
      secondary,
      watt,
      poleHeight,
      voltage,
      title: title ? String(title) : "",
      location: location ? String(location) : "",
      officer: officer ? String(officer) : "",
      date: merged.dateDisplay || merged.date || "",
      time: merged.timeDisplay || merged.time || "",
      status: merged.status || "",
      source: merged.source || "",
      kabupaten: merged.kabupaten || "",
    };
  };

  function buildReportsParams(sortDirection: "asc" | "desc", maxItems: number) {
    const params = new URLSearchParams({
      limit: String(maxItems),
      includeData: "1",
      sort: sortDirection,
    });
    if (useKabupatenFilter && activeKabupaten) {
      params.set("kabupaten", activeKabupaten);
    }
    return params;
  }

  async function fetchCachedReportList() {
    const cacheKey = `kemerataan_reports_list_v2_${activeKabupaten || "all"}`;
    return fetchWithCache<ReportOption[]>(
      cacheKey,
      async () => {
        const response = await fetch(`/api/admin/reports?${buildReportsParams("desc", 100).toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          let message = "Gagal memuat daftar report dari Supabase.";
          try {
            const payload = (await response.json()) as { error?: string };
            if (typeof payload.error === "string" && payload.error.trim()) {
              message = payload.error.trim();
            }
          } catch {
            // Keep fallback message.
          }
          throw new Error(message);
        }
        const payload = (await response.json()) as { reports?: Array<Record<string, unknown>> };
        return (Array.isArray(payload.reports) ? payload.reports : []).map((data) => {
          const meta = deriveReportMetaSafe(data);
          return {
            id: typeof data.id === "string" ? data.id : "",
            label: deriveReportLabel(data),
            meta,
            data,
          };
        });
      },
      15 * 60_000
    );
  }

  async function fetchCachedSingleReport(cacheKey: string, sortDirection: "asc" | "desc") {
    return fetchWithCache<CachedReportEntry | null>(
      cacheKey,
      async () => {
        const response = await fetch(`/api/admin/reports?${buildReportsParams(sortDirection, 1).toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          let message = "Gagal memuat report dari Supabase.";
          try {
            const payload = (await response.json()) as { error?: string };
            if (typeof payload.error === "string" && payload.error.trim()) {
              message = payload.error.trim();
            }
          } catch {
            // Keep fallback message.
          }
          throw new Error(message);
        }
        const payload = (await response.json()) as { reports?: Array<Record<string, unknown>> };
        const firstReport = Array.isArray(payload.reports) ? payload.reports[0] : null;
        if (!firstReport || typeof firstReport.id !== "string") {
          return null;
        }
        return {
          id: firstReport.id,
          data: firstReport,
        };
      },
      15 * 60_000
    );
  }

  const sanitizeLux = (val: number): number => {
    if (!isFinite(val) || isNaN(val)) return 0;
    if (val < 0) return 0;
    // Guard against timestamps/IDs accidentally parsed as lux
    if (val > 200) return 0;
    return val;
  };

  const extractNumericFromCell = (val: any): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === "number") return sanitizeLux(val);
    if (typeof val === "string") {
      const n = parseFloat(val.replace(/[^0-9.+-eE]/g, ""));
      return sanitizeLux(isNaN(n) ? 0 : n);
    }
    if (typeof val === "object") {
      const candidates = ["lux", "LUX", "value", "valor", "reading", "illuminance", "v", "val", "measurement", "nilai"];
      for (const k of candidates) {
        if (k in val) {
          return extractNumericFromCell((val as any)[k]);
        }
      }
    }
    return 0;
  };

  const getTitikApiColForLayerCols = (layerCols: number, side: LampSide) => {
    const safeCols = Math.max(1, layerCols);
    if (side === "right") {
      return Math.max(0, Math.min(safeCols - 1, safeCols - 1 - TITIK_API_COL_INDEX));
    }
    return Math.max(0, Math.min(safeCols - 1, safeCols > TITIK_API_COL_INDEX ? TITIK_API_COL_INDEX : safeCols - 1));
  };

  const getLampSideForLoad = (direction: LoadDirection): LampSide => {
    if (placementMode !== "zigzag") return "left";
    if (direction === "middle") return "right";
    if (direction === "bottom" && loadMode === "2") return "right";
    return "left";
  };

  const getLampSidesForPlacement = (side: LampSide): LampSide[] => {
    if (placementMode === "berhadapan") return ["left", "right"];
    return [side];
  };

  const mirrorColsForLampSide = (grid: any[][], side: LampSide) => {
    if (!Array.isArray(grid)) return grid;
    return grid.map((row) => {
      if (!Array.isArray(row) || row.length < 3) return row;
      const next = row.slice();
      const fireCol = getTitikApiColForLayerCols(row.length, side);
      if (side === "right") {
        for (let offset = 1; fireCol + offset < next.length; offset++) {
          const sourceCol = fireCol - offset;
          if (sourceCol < 0) break;
          next[fireCol + offset] = row[sourceCol] ?? next[fireCol + offset];
        }
      } else {
        for (let offset = 1; fireCol - offset >= 0; offset++) {
          const sourceCol = fireCol + offset;
          if (sourceCol >= row.length) break;
          next[fireCol - offset] = row[sourceCol] ?? next[fireCol - offset];
        }
      }
      return next;
    });
  };

  const normalizeReportGrid = (reportData: any, direction: "top" | "bottom" | "middle") => {
    if (!reportData) return null;
    let gd = reportData.gridData;
    if (typeof gd === "string") {
      try { gd = JSON.parse(gd); } catch (e) { console.warn("Failed to parse gridData", e); }
    }
    if (Array.isArray(gd)) {
      const normalized = gd.map((row: any) => Array.isArray(row) ? row.map((cell: any) => extractNumericFromCell(cell)) : []);
      return normalized;
    }
    // Support new grid payload format: { rows, cols, cells: [{ row, col, value, tipeApi, ... }] }
    if (gd && typeof gd === "object") {
      const rowsCount = Math.max(0, parseInt(String(gd.rows ?? 0), 10) || 0);
      const colsCount = Math.max(0, parseInt(String(gd.cols ?? 0), 10) || 0);
      if (rowsCount === 0 || colsCount === 0) return null;
      const grid: number[][] = Array.from({ length: rowsCount }, () => Array.from({ length: colsCount }, () => 0));
      const cells = Array.isArray(gd.cells) ? gd.cells : [];
      for (const cell of cells) {
        if (!cell) continue;
        const r = typeof cell.row === "number" ? cell.row : parseInt(String(cell.row ?? ""), 10);
        const c = typeof cell.col === "number" ? cell.col : parseInt(String(cell.col ?? ""), 10);
        if (!isFinite(r) || !isFinite(c)) continue;
        if (r < 0 || c < 0 || r >= rowsCount || c >= colsCount) continue;
        grid[r][c] = extractNumericFromCell(cell);
      }
      return grid;
    }
    return null;
  };

  const alignGridToSize = (incoming: number[][], rowsCount: number, colsCount: number, direction: "top" | "bottom", side: LampSide) => {
    const aligned: number[][] = Array.from({ length: rowsCount }, () => Array.from({ length: colsCount }, () => 0));
    if (!incoming || incoming.length === 0) return aligned;
    const rowsIn = incoming.length;
    const fireCol = getTitikApiColForLayerCols(colsCount, side);
    for (let r = 0; r < rowsIn; r++) {
      const rowArr = incoming[r];
      if (!Array.isArray(rowArr)) continue;
      const targetRow = direction === "bottom" ? (rowsCount - 1 - r) : r;
      if (targetRow < 0 || targetRow >= rowsCount) continue;
      for (let c = 0; c < Math.min(rowArr.length, colsCount); c++) {
        const targetCol = side === "right" ? fireCol - c : fireCol + c;
        if (targetCol < 0 || targetCol >= colsCount) break;
        aligned[targetRow][targetCol] = extractNumericFromCell(rowArr[c]);
      }
    }
    return aligned;
  };

  const alignGridMiddleMirror = (incoming: number[][], rowsCount: number, colsCount: number, centerRow: number, side: LampSide) => {
    const aligned: number[][] = Array.from({ length: rowsCount }, () => Array.from({ length: colsCount }, () => 0));
    if (!incoming || incoming.length === 0) return aligned;
    const rowsIn = incoming.length;
    const fireCol = getTitikApiColForLayerCols(colsCount, side);
    for (let r = 0; r < rowsIn; r++) {
      const rowArr = incoming[r];
      if (!Array.isArray(rowArr)) continue;
      const targetDown = centerRow + r;
      const targetUp = centerRow - r;
      if (targetDown >= 0 && targetDown < rowsCount) {
        for (let c = 0; c < Math.min(rowArr.length, colsCount); c++) {
          const targetCol = side === "right" ? fireCol - c : fireCol + c;
          if (targetCol < 0 || targetCol >= colsCount) break;
          aligned[targetDown][targetCol] = extractNumericFromCell(rowArr[c]);
        }
      }
      if (r !== 0 && targetUp >= 0 && targetUp < rowsCount) {
        for (let c = 0; c < Math.min(rowArr.length, colsCount); c++) {
          const targetCol = side === "right" ? fireCol - c : fireCol + c;
          if (targetCol < 0 || targetCol >= colsCount) break;
          aligned[targetUp][targetCol] = extractNumericFromCell(rowArr[c]);
        }
      }
    }
    return aligned;
  };

  const mergeMapWithGrid = (prevMap: Map<string, GridCell>, incoming: number[][], rowsCount: number, colsCount: number) => {
    const nextMap = new Map<string, GridCell>();
    for (let r = 0; r < rowsCount; r++) {
      for (let c = 0; c < colsCount; c++) {
        const key = getCellKey(r, c);
        const currentVal = parseFloat(prevMap.get(key)?.value || "0");
        const safeCurrent = sanitizeLux(isNaN(currentVal) ? 0 : currentVal);
        const incomingVal = extractNumericFromCell(incoming?.[r]?.[c]);
        let nextVal = 0;
        if (safeCurrent > 0 && incomingVal > 0) nextVal = safeCurrent + incomingVal;
        else if (safeCurrent > 0) nextVal = safeCurrent;
        else if (incomingVal > 0) nextVal = incomingVal;
        if (nextVal > 0) nextMap.set(key, { value: String(nextVal) });
      }
    }
    return nextMap;
  };

  const gridArrayToMap = (incoming: number[][], rowsCount: number, colsCount: number) => {
    const nextMap = new Map<string, GridCell>();
    for (let r = 0; r < rowsCount; r++) {
      for (let c = 0; c < colsCount; c++) {
        const val = extractNumericFromCell(incoming?.[r]?.[c]);
        if (val > 0) nextMap.set(getCellKey(r, c), { value: String(val) });
      }
    }
    return nextMap;
  };

  const combineLayerMaps = (
    topLayer: Map<string, GridCell>,
    middleLayer: Map<string, GridCell>,
    bottomLayer: Map<string, GridCell>,
    rowsCount: number,
    colsCount: number
  ) => {
    const nextMap = new Map<string, GridCell>();
    if (rowsCount <= 0 || colsCount <= 0) return nextMap;
    const topFactor = isFinite(dimmingTop) ? dimmingTop / 100 : 1;
    const middleFactor = isFinite(dimmingMiddle) ? dimmingMiddle / 100 : 1;
    const bottomFactor = isFinite(dimmingBottom) ? dimmingBottom / 100 : 1;
    for (let r = 0; r < rowsCount; r++) {
      for (let c = 0; c < colsCount; c++) {
        const key = getCellKey(r, c);
        let sum = 0;
        const topVal = parseFloat(topLayer.get(key)?.value || "0");
        if (isFinite(topVal) && !isNaN(topVal) && topVal > 0) sum += topVal * topFactor;

        if (loadMode === "3") {
          const middleVal = parseFloat(middleLayer.get(key)?.value || "0");
          if (isFinite(middleVal) && !isNaN(middleVal) && middleVal > 0) sum += middleVal * middleFactor;
        }

        const bottomVal = parseFloat(bottomLayer.get(key)?.value || "0");
        if (isFinite(bottomVal) && !isNaN(bottomVal) && bottomVal > 0) sum += bottomVal * bottomFactor;
        if (sum > 0) nextMap.set(key, { value: String(sum) });
      }
    }
    return nextMap;
  };

  const sumLayerMaps = (layers: Map<string, GridCell>[], rowsCount: number, colsCount: number) => {
    const nextMap = new Map<string, GridCell>();
    for (let r = 0; r < rowsCount; r++) {
      for (let c = 0; c < colsCount; c++) {
        const key = getCellKey(r, c);
        const sum = layers.reduce((total, layer) => {
          const raw = parseFloat(layer.get(key)?.value || "0");
          return total + (isFinite(raw) && !isNaN(raw) && raw > 0 ? raw : 0);
        }, 0);
        if (sum > 0) nextMap.set(key, { value: String(sum) });
      }
    }
    return nextMap;
  };

  const combineGroupLayerMaps = (loads: GroupLoadConfig[], rowsCount: number, colsCount: number) => {
    const nextMap = new Map<string, GridCell>();
    if (rowsCount <= 0 || colsCount <= 0) return nextMap;
    for (let r = 0; r < rowsCount; r++) {
      for (let c = 0; c < colsCount; c++) {
        const key = getCellKey(r, c);
        let sum = 0;
        for (const load of loads) {
          const raw = parseFloat(load.layer?.get(key)?.value || "0");
          const factor = isFinite(load.dimming || 100) ? (load.dimming || 100) / 100 : 1;
          if (isFinite(raw) && !isNaN(raw) && raw > 0) sum += raw * factor;
        }
        if (sum > 0) nextMap.set(key, { value: String(sum) });
      }
    }
    return nextMap;
  };

  const mirrorMapCols1And2To4And5 = (map: Map<string, GridCell>, rowsCount: number, colsCount: number) => {
    if (colsCount < 5) return map;
    const next = new Map(map);
    for (let r = 0; r < rowsCount; r++) {
      const col1Key = getCellKey(r, 0);
      const col2Key = getCellKey(r, 1);
      const col4Key = getCellKey(r, 3);
      const col5Key = getCellKey(r, 4);
      const col1Val = next.get(col1Key)?.value || "0";
      const col2Val = next.get(col2Key)?.value || "0";
      if (col2Val !== "0") next.set(col4Key, { value: col2Val });
      if (col1Val !== "0") next.set(col5Key, { value: col1Val });
    }
    return next;
  };

  const applyReportToGrid = (reportData: any, direction: "top" | "bottom" | "middle", reportId?: string) => {
    const incoming = normalizeReportGrid(reportData, direction);
    if (!incoming) return false;
    const layerCols = Math.max(1, Math.min(cols, getRoadColsForLoad(direction) || cols));
    const side = getLampSideForLoad(direction);
    const nextLayer = sumLayerMaps(
      getLampSidesForPlacement(side).map((lampSide) => {
        let aligned: number[][] = [];
        if (direction === "top") {
          aligned = alignGridToSize(incoming, rows, layerCols, "top", lampSide);
        } else if (direction === "bottom") {
          aligned = alignGridToSize(incoming, rows, layerCols, "bottom", lampSide);
        } else {
          const upValue = parsePositiveInt(middleUpRows);
          const middleStart = upValue > 0
            ? Math.max(0, Math.min(rows - 1, upValue - 1))
            : Math.max(0, Math.min(rows - 1, Math.floor((rows - 1) / 2)));
          aligned = alignGridMiddleMirror(incoming, rows, layerCols, middleStart, lampSide);
        }
        return gridArrayToMap(mirrorColsForLampSide(aligned, lampSide), rows, layerCols);
      }),
      rows,
      layerCols
    );
    let nextTop = topGridData;
    let nextMiddle = middleGridData;
    let nextBottom = bottomGridData;
    if (direction === "top") nextTop = nextLayer;
    if (direction === "middle") nextMiddle = nextLayer;
    if (direction === "bottom") nextBottom = nextLayer;
    setTopGridData(nextTop);
    setMiddleGridData(nextMiddle);
    setBottomGridData(nextBottom);
    setGridData(combineLayerMaps(nextTop, nextMiddle, nextBottom, rows, cols));
    if (direction === "top" && reportId) setLastLoadedTopId(reportId);
    if (direction === "middle" && reportId) setLastLoadedMiddleId(reportId);
    if (direction === "bottom" && reportId) setLastLoadedBottomId(reportId);
    return true;
  };

  const getLampSideForGroupIndex = (index: number): LampSide => {
    if (placementMode !== "zigzag") return "left";
    return index % 2 === 0 ? "left" : "right";
  };

  const applyReportToGroupLoad = (loadIndex: number, report: ReportOption) => {
    const targetLoad = groupLoads[loadIndex];
    if (!targetLoad) return false;
    const incoming = normalizeReportGrid(report.data, "middle");
    if (!incoming) return false;
    const layerCols = Math.max(1, Math.min(cols, Math.ceil(parsePositiveFloat(targetLoad.width) || parsePositiveFloat(groupDefaultWidth) || cols)));
    const side = getLampSideForGroupIndex(loadIndex);
    const centerRow = Math.max(0, Math.min(rows - 1, (targetLoad.row || 1) - 1));
    const nextLayer = sumLayerMaps(
      getLampSidesForPlacement(side).map((lampSide) => {
        const aligned = alignGridMiddleMirror(incoming, rows, layerCols, centerRow, lampSide);
        return gridArrayToMap(mirrorColsForLampSide(aligned, lampSide), rows, layerCols);
      }),
      rows,
      layerCols
    );
    const nextLoads = groupLoads.map((item, index) =>
      index === loadIndex
        ? {
            ...item,
            reportId: report.id,
            label: report.label,
            data: report.data,
            layer: nextLayer,
            open: false,
          }
        : item
    );
    setGroupLoads(nextLoads);
    setGridData(combineGroupLayerMaps(nextLoads, rows, cols));
    return true;
  };

  const fetchReportsList = async () => {
    try {
      setReportsLoading(true);
      const list = await fetchCachedReportList();
      setReportsList(list);
      if (list.length === 0) alert("Tidak ada report tersedia");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error fetching reports list:", err);
      alert("Gagal memuat daftar report");
    } finally {
      setReportsLoading(false);
    }
  };

  const handleSelectReportTop = (report: ReportOption) => {
    // select report for Load Data Pertama
    setSelectedReportTopId(report.id);
    setSelectedReportTopData(report.data);
    setSelectedReportTopLabel(report.label);
    applyReportToGrid(report.data, "top", report.id);
  };

  const handleSelectReportMiddle = (report: ReportOption) => {
    // select report for Load Data Ketiga (Tengah)
    setSelectedReportMiddleId(report.id);
    setSelectedReportMiddleData(report.data);
    setSelectedReportMiddleLabel(report.label);
    applyReportToGrid(report.data, "middle", report.id);
  };

  const handleSelectReportBottom = (report: ReportOption) => {
    // select report for Load Data Kedua
    setSelectedReportBottomId(report.id);
    setSelectedReportBottomData(report.data);
    setSelectedReportBottomLabel(report.label);
    applyReportToGrid(report.data, "bottom", report.id);
  };

  const handleReset = useCallback(() => {
    setJenisJalan("");
    setJarakTiang("");
    setLebarJalan("");
    setLebarJalanTop("");
    setLebarJalanMiddle("");
    setLebarJalanBottom("");
    setLoadMode("3");
    setPlacementMode("sejajar");
    setMiddleUpRows("");
    setMiddleDownRows("");
    setGridData(new Map());
    setTopGridData(new Map());
    setMiddleGridData(new Map());
    setBottomGridData(new Map());
    setRows(0);
    setCols(0);
    setIsGridReady(false);
    setLastLoadedTopId(null);
    setLastLoadedMiddleId(null);
    setLastLoadedBottomId(null);
    setDimmingTop(100);
    setDimmingMiddle(100);
    setDimmingBottom(100);
  }, []);

  useEffect(() => {
    if (!isGridReady) {
      setGridData(new Map());
      return;
    }
    if (loadMode === "group") {
      setGridData(combineGroupLayerMaps(groupLoads, rows, cols));
      return;
    }
    setGridData(combineLayerMaps(topGridData, middleGridData, bottomGridData, rows, cols));
  }, [isGridReady, rows, cols, loadMode, groupLoads, topGridData, middleGridData, bottomGridData, dimmingTop, dimmingMiddle, dimmingBottom]);

  const formatLuxNumber = (num: number, preferDecimal: boolean) => {
    if (!isFinite(num) || isNaN(num)) return "0";
    if (!preferDecimal && Number.isInteger(num)) return String(num);
    const rounded = Math.round(num * 10) / 10;
    return rounded.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  };

  const formatCell = (cell: any) => {
    if (cell === null || cell === undefined) return "0";
    if (typeof cell === "number") {
      return formatLuxNumber(cell, !Number.isInteger(cell));
    }
    if (typeof cell === "string") {
      const num = parseFloat(cell.replace(",", "."));
      if (!isNaN(num) && isFinite(num)) {
        const preferDecimal = cell.includes(",") || cell.includes(".") || !Number.isInteger(num);
        return formatLuxNumber(num, preferDecimal);
      }
      return String(cell);
    }
    if (typeof cell === "object") {
      if ("value" in cell) {
        const v = cell.value;
        if (v === null || v === undefined) return "0";
        if (typeof v === "object") return JSON.stringify(v);
        return formatCell(v);
      }
      try { return JSON.stringify(cell); } catch (e) { return "[object]"; }
    }
    return String(cell);
  };

  const getRowMaxLux = (rowIndex: number) => {
    if (rowIndex < 0 || rowIndex >= rows) return 0;
    let maxVal = 0;
    for (let c = 0; c < cols; c++) {
      const key = getCellKey(rowIndex, c);
      const raw = parseFloat(gridData.get(key)?.value || "0");
      const v = isNaN(raw) ? 0 : raw;
      if (v > maxVal) maxVal = v;
    }
    return maxVal;
  };

  const getMiddleRowIndex = () => {
    const upValue = parsePositiveInt(middleUpRows);
    if (upValue > 0) return Math.max(0, Math.min(rows - 1, upValue - 1));
    return Math.max(0, Math.min(rows - 1, Math.floor((rows - 1) / 2)));
  };

  const targetAvg = jenisJalan ? TARGET_AVG_BY_ROAD[jenisJalan] : 0;
  const presetAvgNow = stats.avg;
  const buildPreset = (label: string, rowIndex: number) => {
    const eMaxNow = getRowMaxLux(rowIndex);
    const eMaxLimit = presetAvgNow > 0 ? (targetAvg / presetAvgNow) * eMaxNow : 0;
    return { label, rowIndex: rowIndex + 1, eMaxNow, eMaxLimit };
  };

  const presetRows = useMemo(() => {
    if (!isGridReady) return [];
    if (loadMode === "group") {
      return groupLoads
        .filter((item) => item.layer && item.layer.size > 0)
        .map((item, index) => {
          const side = placementMode === "berhadapan" ? "Berhadapan" : getLampSideForGroupIndex(index) === "left" ? "Kiri" : "Kanan";
          return buildPreset(`G${index + 1} (${side})`, Math.max(0, Math.min(rows - 1, (item.row || 1) - 1)));
        });
    }
    const presets = [
      buildPreset("Lampu 1", 0),
      buildPreset("Lampu 2", rows - 1),
    ];
    if (loadMode === "3") {
      presets.splice(1, 0, buildPreset("Lampu 3", getMiddleRowIndex()));
    }
    return presets;
  }, [isGridReady, rows, cols, gridData, jenisJalan, loadMode, placementMode, middleUpRows, groupLoads]);

  const getTitikApiColForLoad = (direction: "top" | "middle" | "bottom") => {
    const layerCols = Math.max(1, Math.min(cols, getRoadColsForLoad(direction) || cols));
    const side = getLampSideForLoad(direction);
    return Math.max(0, Math.min(cols - 1, getTitikApiColForLayerCols(layerCols, side)));
  };

  const getTitikApiColsForPlacement = (layerCols: number, side: LampSide) => {
    const uniqueCols = new Set<number>();
    getLampSidesForPlacement(side).forEach((lampSide) => {
      uniqueCols.add(Math.max(0, Math.min(cols - 1, getTitikApiColForLayerCols(layerCols, lampSide))));
    });
    return Array.from(uniqueCols);
  };

  const titikApiCells = useMemo(() => {
    if (!isGridReady) return new Set<string>();
    const positions: Array<{ row: number; col: number; label: string }> = [];
    if (loadMode === "group") {
      groupLoads.forEach((item, index) => {
        if (!item.layer || item.layer.size === 0) return;
        const layerCols = Math.max(1, Math.min(cols, Math.ceil(parsePositiveFloat(item.width) || parsePositiveFloat(groupDefaultWidth) || cols)));
        const row = Math.max(0, Math.min(rows - 1, (item.row || 1) - 1));
        getTitikApiColsForPlacement(layerCols, getLampSideForGroupIndex(index)).forEach((col) => {
          positions.push({ row, col, label: `Titik Api G${index + 1}` });
        });
      });
    } else {
    if (topGridData.size > 0) {
      const layerCols = Math.max(1, Math.min(cols, getRoadColsForLoad("top") || cols));
      getTitikApiColsForPlacement(layerCols, getLampSideForLoad("top")).forEach((col) => {
        positions.push({ row: 0, col, label: "Titik Api Lampu 1" });
      });
    }
    if (loadMode === "3" && middleGridData.size > 0) {
      const layerCols = Math.max(1, Math.min(cols, getRoadColsForLoad("middle") || cols));
      getTitikApiColsForPlacement(layerCols, getLampSideForLoad("middle")).forEach((col) => {
        positions.push({ row: getMiddleRowIndex(), col, label: "Titik Api Lampu 3" });
      });
    }
    if (bottomGridData.size > 0) {
      const layerCols = Math.max(1, Math.min(cols, getRoadColsForLoad("bottom") || cols));
      getTitikApiColsForPlacement(layerCols, getLampSideForLoad("bottom")).forEach((col) => {
        positions.push({ row: Math.max(0, rows - 1), col, label: "Titik Api Lampu 2" });
      });
    }
    }
    const set = new Set<string>();
    positions.forEach((p) => {
      if (p.row >= 0 && p.row < rows && p.col >= 0 && p.col < cols) {
        set.add(`${p.row}-${p.col}`);
      }
    });
    return set;
  }, [isGridReady, rows, cols, loadMode, placementMode, middleUpRows, middleDownRows, topGridData, middleGridData, bottomGridData, lebarJalan, lebarJalanTop, lebarJalanMiddle, lebarJalanBottom, groupDefaultWidth, groupLoads]);

  const getTitikApiLabel = useCallback((row: number, col: number) => {
    if (loadMode === "group") {
      const found = groupLoads.find((item, index) => {
        if (!item.layer || item.layer.size === 0) return false;
        const layerCols = Math.max(1, Math.min(cols, Math.ceil(parsePositiveFloat(item.width) || parsePositiveFloat(groupDefaultWidth) || cols)));
        const fireCols = getTitikApiColsForPlacement(layerCols, getLampSideForGroupIndex(index));
        return row === Math.max(0, Math.min(rows - 1, (item.row || 1) - 1)) && fireCols.includes(col);
      });
      return found ? `Titik Api G${found.index + 1}` : null;
    }
    if (topGridData.size > 0) {
      const layerCols = Math.max(1, Math.min(cols, getRoadColsForLoad("top") || cols));
      if (row === 0 && getTitikApiColsForPlacement(layerCols, getLampSideForLoad("top")).includes(col)) return "Titik Api Lampu 1";
    }
    if (bottomGridData.size > 0) {
      const layerCols = Math.max(1, Math.min(cols, getRoadColsForLoad("bottom") || cols));
      if (row === Math.max(0, rows - 1) && getTitikApiColsForPlacement(layerCols, getLampSideForLoad("bottom")).includes(col)) return "Titik Api Lampu 2";
    }
    if (loadMode === "3" && middleGridData.size > 0) {
      const layerCols = Math.max(1, Math.min(cols, getRoadColsForLoad("middle") || cols));
      if (row === getMiddleRowIndex() && getTitikApiColsForPlacement(layerCols, getLampSideForLoad("middle")).includes(col)) return "Titik Api Lampu 3";
    }
    return null;
  }, [rows, cols, loadMode, placementMode, middleUpRows, middleDownRows, topGridData, middleGridData, bottomGridData, lebarJalan, lebarJalanTop, lebarJalanMiddle, lebarJalanBottom, groupDefaultWidth, groupLoads]);

  const getActiveRoadColsForRow = useCallback((row: number) => {
    if (!isGridReady || rows <= 0 || cols <= 0) return 0;
    if (loadMode === "group") {
      const nearest = groupLoads.reduce<GroupLoadConfig | null>((best, item) => {
        if (!best) return item;
        return Math.abs((item.row || 1) - 1 - row) < Math.abs((best.row || 1) - 1 - row) ? item : best;
      }, null);
      const width = nearest ? parsePositiveFloat(nearest.width) || parsePositiveFloat(groupDefaultWidth) : parsePositiveFloat(groupDefaultWidth);
      return Math.max(0, Math.min(cols, Math.ceil(width)));
    }
    if (loadMode === "3") {
      const middleRow = getMiddleRowIndex();
      const topMiddleBoundary = Math.ceil((0 + middleRow) / 2);
      const middleBottomBoundary = Math.floor((middleRow + (rows - 1)) / 2);
      if (row < topMiddleBoundary) return Math.max(0, Math.min(cols, getRoadColsForLoad("top")));
      if (row <= middleBottomBoundary) return Math.max(0, Math.min(cols, getRoadColsForLoad("middle")));
      return Math.max(0, Math.min(cols, getRoadColsForLoad("bottom")));
    }
    const splitRow = Math.ceil(rows / 2);
    return row < splitRow ? Math.max(0, Math.min(cols, getRoadColsForLoad("top"))) : Math.max(0, Math.min(cols, getRoadColsForLoad("bottom")));
  }, [isGridReady, rows, cols, loadMode, middleUpRows, middleDownRows, lebarJalan, lebarJalanTop, lebarJalanMiddle, lebarJalanBottom, groupDefaultWidth, groupLoads]);

  const activeKabupatenName = useMemo(
    () => kabupatenOptions.find((k) => k.id === activeKabupaten)?.name ?? "-",
    [kabupatenOptions, activeKabupaten]
  );
  const isKabupatenReady = !useKabupatenFilter || Boolean(activeKabupaten);
  const compactGrid = rows >= 200 || (loadMode === "group" && groupLoads.length >= 12);

  const pendingKabupatenName = useMemo(
    () => kabupatenOptions.find((k) => k.id === pendingKabupaten)?.name ?? "-",
    [kabupatenOptions, pendingKabupaten]
  );

  const handleKabupatenPick = useCallback((kabupatenId: string) => {
    if (kabupatenId === activeKabupaten) {
      setShowKabupatenPicker(false);
      return;
    }
    setPendingKabupaten(kabupatenId);
    setShowKabupatenConfirm(true);
  }, [activeKabupaten]);

  const handleKabupatenConfirm = useCallback(() => {
    if (!pendingKabupaten) return;
    applyKabupatenSelection(pendingKabupaten);
    setShowKabupatenConfirm(false);
    setShowKabupatenPicker(false);
    setPendingKabupaten(null);
  }, [pendingKabupaten, applyKabupatenSelection]);

  const handleKabupatenCancel = useCallback(() => {
    setShowKabupatenConfirm(false);
    setPendingKabupaten(null);
  }, []);

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-red-50 to-red-100" style={{ contain: 'layout style' }}>
      {/* Header - Professional & Modern */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-md border-b-2 border-red-200" style={{ contain: 'layout style paint' }}>
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Left Section: Logo & Title */}
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <button
                onClick={() => router.push(isAdmin ? "/admin/module-selection" : "/module-selection")}
                className="w-10 h-10 flex items-center justify-center text-white bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-xl shadow-md transition-all active:scale-95 flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-12 h-12 flex-shrink-0 bg-gradient-to-br from-red-100 to-red-50 rounded-xl p-2 shadow-sm">
                  <Image
                    src="/BDG1.png"
                    alt="Logo"
                    fill
                    className="object-contain p-1"
                  />
                </div>
                
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text">
                    Analisis Kemerataan Cahaya
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-600 font-medium">
                    Perhitungan Uniformity Ratio
                  </p>
                  {useKabupatenFilter && user && (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                        Kabupaten aktif: {activeKabupatenName}
                      </span>
                      <button
                        onClick={() => {
                          setPendingKabupaten(null);
                          setShowKabupatenPicker(true);
                        }}
                        className="text-[11px] font-semibold text-gray-700 hover:text-red-700 border border-gray-200 hover:border-red-200 bg-white px-2 py-0.5 rounded-full transition-all"
                      >
                        Ganti kabupaten
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="sm:hidden w-10 h-10 flex items-center justify-center text-red-600 bg-red-50 hover:bg-red-100 rounded-xl shadow-sm transition-all active:scale-95"
              aria-label="Toggle Sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Right Section: User Info */}
            {user && (
              <div className="hidden sm:flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl shadow-sm flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-md">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="text-sm font-bold text-gray-800">{user.displayName}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {showSidebar && (
        <div
          className="sm:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Main Content */}
      <main className="relative flex gap-4 px-4 sm:px-6 py-4">
        {/* Left Sidebar - Fixed with own scroll */}
        <aside
          className={`w-80 max-w-[90vw] flex-shrink-0 space-y-4 transition-all duration-300 ease-in-out
            fixed sm:sticky top-0 sm:top-20 left-0 h-screen sm:h-[calc(100vh-6rem)] z-50 sm:z-auto
            overflow-y-auto bg-gradient-to-br from-gray-50 via-red-50 to-red-100 sm:bg-transparent
            ${showSidebar ? "translate-x-0" : "-translate-x-full sm:translate-x-0"}`}
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="sm:hidden px-4 pt-4">
            <button
              onClick={() => setShowSidebar(false)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-xl transition-all active:scale-95 border border-gray-200 shadow-sm"
            >
              <span>Tutup Panel</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Setup Card */}
          <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-200">
            <h2 className="text-base font-bold text-gray-900 mb-4">Pilih jenis jalan dan span untuk memulai analisis</h2>
          
          {/* Jenis Jalan Selection */}
          <div className="mb-5">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-3">
              <span className="text-orange-500">#</span>
              Pilih Jenis Jalan
            </label>
            <div className="space-y-2">
              {jenisJalanOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setJenisJalan(option.id as JenisJalan)}
                  className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                    jenisJalan === option.id
                      ? "border-orange-400 bg-orange-50 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{option.icon}</span>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 text-sm">{option.name}</p>
                      <p className="text-xs text-gray-600">{option.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Statistik Grid */}
          <div className="bg-red-50 rounded-lg p-4 border border-red-200 mb-5">
            <p className="text-sm font-bold text-red-900 mb-3">Statistik Grid:</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-red-700">L-Min:</span>
                <span className="font-bold text-gray-900">{stats.min.toFixed(2)}</span>
              </div>
              {stats.minRow > 0 && stats.minCol > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-red-700">Posisi L-Min:</span>
                  <span className="font-bold text-gray-900">Baris {stats.minRow}, Kolom {stats.minCol}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-red-700">L-Max:</span>
                <span className="font-bold text-gray-900">{stats.max.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-700">L-Avg:</span>
                <span className="font-bold text-gray-900">{stats.avg.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-700">Uniformity Ratio:</span>
                <span className="font-bold text-gray-900">{stats.uniformity.toFixed(3)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-red-200">
                <span className="text-red-700">Data dihitung:</span>
                <span className="font-bold text-gray-900">{stats.count} sel</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-700">Terisi:</span>
                <span className="font-bold text-gray-900">{stats.measuredCount} sel</span>
              </div>
            </div>
          </div>
          {/* Preset Titik Api */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-5">
            <p className="text-sm font-bold text-blue-900 mb-3">Preset Titik Api:</p>
            <div className="text-xs text-blue-700 mb-2">
              Target jalan: {targetAvg.toFixed(1)} lux
            </div>
            {presetRows.length === 0 ? (
              <div className="text-xs text-gray-500">Belum ada data.</div>
            ) : (
              <div className="space-y-2 text-sm">
                {presetRows.map((p) => (
                  <div key={p.label} className="bg-white rounded-md border border-blue-100 p-2">
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-800">{p.label}</span>
                      <span className="text-xs text-gray-500">Baris {p.rowIndex}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-gray-600">Emax sekarang:</span>
                      <span className="font-bold text-gray-900">{formatLuxNumber(p.eMaxNow, true)} lux</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Batas bawah (preset):</span>
                      <span className="font-bold text-blue-700">{formatLuxNumber(p.eMaxLimit, true)} lux</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Analisis Data */}
          <div className="mb-5">
            <button
              onClick={() => setShowAnalysis(true)}
              disabled={!isGridReady}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all shadow-sm active:scale-95 text-sm flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0V9a2 2 0 012-2h2a2 2 0 012 2v8m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v12a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analisis Data
            </button>
          </div>

          {/* Ukuran Grid */}
          <div className="mb-5">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-3">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Ukuran Jarak Tiang Dan Lebar Jalan
            </label>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-1.5">Mode Load Data</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (loadMode !== "2") clearLoadedGridData({ resetGroupReports: true });
                      setLoadMode("2");
                      setMiddleUpRows("");
                      setMiddleDownRows("");
                    }}
                    className={`px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${loadMode === "2" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                  >
                    2 Load
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (loadMode !== "3") clearLoadedGridData({ resetGroupReports: true });
                      setLoadMode("3");
                    }}
                    className={`px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${loadMode === "3" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                  >
                    3 Load
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (loadMode !== "group") clearLoadedGridData({ resetGroupReports: true });
                      setLoadMode("group");
                    }}
                    className={`px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${loadMode === "group" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                  >
                    Grup
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-1.5">Pola Penempatan Lampu</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (placementMode !== "sejajar") clearLoadedGridData({ resetGroupReports: true });
                      setPlacementMode("sejajar");
                    }}
                    className={`px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${placementMode === "sejajar" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                  >
                    Sejajar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (placementMode !== "zigzag") clearLoadedGridData({ resetGroupReports: true });
                      setPlacementMode("zigzag");
                    }}
                    className={`px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${placementMode === "zigzag" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                  >
                    Zigzag
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (placementMode !== "berhadapan") clearLoadedGridData({ resetGroupReports: true });
                      setPlacementMode("berhadapan");
                    }}
                    className={`px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${placementMode === "berhadapan" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                  >
                    Berhadapan
                  </button>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                  Sejajar: semua di satu sisi. Zigzag: bergantian kiri-kanan. Berhadapan: tiap load dihitung dari kiri dan kanan pada baris yang sama.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-1.5">Jarak Tiang</label>
                <input
                  type="number"
                  placeholder="Masukkan jarak"
                  value={jarakTiang}
                  onChange={(e) => {
                    if (gridData.size > 0 || groupLoads.some((item) => item.layer && item.layer.size > 0)) {
                      clearLoadedGridData({ resetGroupReports: true });
                    }
                    setJarakTiang(e.target.value);
                  }}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-sm font-semibold text-gray-900 placeholder:text-gray-500 bg-white"
                />
              </div>
              {loadMode === "group" && (
                <div className="rounded-xl border border-green-200 bg-green-50/50 p-3">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-green-700">Grup Lampu</div>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-800 mb-1.5">Jumlah Lampu</label>
                      <input
                        type="number"
                        min={2}
                        max={30}
                        placeholder="Contoh: 5"
                        value={groupLoadCount}
                        onChange={(e) => {
                          if (groupLoads.some((item) => item.layer && item.layer.size > 0)) clearLoadedGridData({ resetGroupReports: true });
                          setGroupLoadCount(e.target.value);
                        }}
                        className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-sm font-semibold text-gray-900 placeholder:text-gray-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-800 mb-1.5">Lebar Jalan Default Grup</label>
                      <input
                        type="number"
                        placeholder="Contoh: 8"
                        value={groupDefaultWidth}
                        onChange={(e) => {
                          if (groupLoads.some((item) => item.layer && item.layer.size > 0)) clearLoadedGridData({ resetGroupReports: true });
                          setGroupDefaultWidth(e.target.value);
                        }}
                        className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-sm font-semibold text-gray-900 placeholder:text-gray-500 bg-white"
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-green-800">
                    Posisi lampu dibuat merata dari baris 1 sampai baris terakhir. Zigzag akan bergantian kiri-kanan.
                  </p>
                </div>
              )}
              {loadMode !== "group" && (
              <div className="rounded-xl border border-green-200 bg-green-50/50 p-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-green-700">Lebar Jalan Per Load</div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-800 mb-1.5">Lebar Jalan Lampu 1 / Atas</label>
                    <input
                      type="number"
                      placeholder="Contoh: 5"
                      value={lebarJalanTop}
                      onChange={(e) => setLebarJalanTop(e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-sm font-semibold text-gray-900 placeholder:text-gray-500 bg-white"
                    />
                  </div>
                  {loadMode === "3" && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-800 mb-1.5">Lebar Jalan Lampu 3 / Tengah</label>
                      <input
                        type="number"
                        placeholder="Contoh: 7"
                        value={lebarJalanMiddle}
                        onChange={(e) => setLebarJalanMiddle(e.target.value)}
                        className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-sm font-semibold text-gray-900 placeholder:text-gray-500 bg-white"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-gray-800 mb-1.5">Lebar Jalan Lampu 2 / Bawah</label>
                    <input
                      type="number"
                      placeholder="Contoh: 6"
                      value={lebarJalanBottom}
                      onChange={(e) => setLebarJalanBottom(e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-sm font-semibold text-gray-900 placeholder:text-gray-500 bg-white"
                    />
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-green-800">
                  Grid memakai lebar terbesar sebagai kanvas. Mode 3 membagi lebar berdasarkan zona tengah antar lampu: L1 untuk setengah atas, L3 untuk area tengah, L2 untuk setengah bawah.
                </p>
              </div>
              )}
              {loadMode === "3" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-800 mb-1.5">Jarak Gawang Satu (baris, opsional)</label>
                    <input
                      type="number"
                      placeholder="Contoh: 34"
                      value={middleUpRows}
                      onChange={(e) => setMiddleUpRows(e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-sm font-semibold text-gray-900 placeholder:text-gray-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-800 mb-1.5">Jarak Gawang Dua (baris, opsional)</label>
                    <input
                      type="number"
                      placeholder="Contoh: 40"
                      value={middleDownRows}
                      onChange={(e) => setMiddleDownRows(e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-sm font-semibold text-gray-900 placeholder:text-gray-500 bg-white"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Posisi middle akan berada di baris ke-{parsePositiveInt(middleUpRows) || Math.floor((computeRowsForMode(parseFloat(jarakTiang) || 0, parsePositiveInt(middleUpRows), parsePositiveInt(middleDownRows)) + 1) / 2)} (dihitung dari atas).
                  </p>
                </>
              )}
            </div>
            {jarakTiang && isRoadWidthReady() && (
              <div className="mt-3 p-3 bg-green-100 rounded-lg border-2 border-green-400">
                <p className="text-sm text-green-900 font-bold">
                  {loadMode === "group"
                    ? `Jarak Tiang ${jarakTiang} | Grup ${parsePositiveInt(groupLoadCount)} lampu | Lebar default ${groupDefaultWidth} m`
                    : `Jarak Tiang ${jarakTiang} | Lebar: L1 ${getRoadWidthForLoad("top")} m${loadMode === "3" ? `, L3 ${getRoadWidthForLoad("middle")} m` : ""}, L2 ${getRoadWidthForLoad("bottom")} m`}
                </p>
                <p className="text-sm text-green-800 font-semibold mt-1">
                  Kanvas total: {computeRowsForMode(parseFloat(jarakTiang) || 0, parsePositiveInt(middleUpRows), parsePositiveInt(middleDownRows))} baris x {Math.ceil(getEffectiveRoadWidth())} kolom
                </p>
              </div>
            )}
          </div>

          {/* Action Button */}
          <button
            onClick={handleGenerateGrid}
            disabled={!jenisJalan || !jarakTiang || !isRoadWidthReady()}
            className="w-full py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all shadow-sm active:scale-95 text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {isGridReady ? "Terapkan" : "Terapkan"}
          </button>
        </div>

        {/* Load Data Section */}
        {isGridReady && (
          <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-200">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-3">
              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
              Load Data
            </label>
            {!isKabupatenReady && (
              <div className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                Pilih kabupaten terlebih dahulu agar data tidak tercampur.
              </div>
            )}
            <div className="space-y-2">
              {loadMode === "group" && (
                <div className="space-y-2">
                  {groupLoads.map((item, index) => {
                    const side = getLampSideForGroupIndex(index);
                    return (
                      <div key={item.uid} className="overflow-hidden rounded-lg border-2 border-green-200">
                        <button
                          type="button"
                          onClick={() => setGroupLoads((current) => current.map((load, loadIndex) => loadIndex === index ? { ...load, open: !load.open } : load))}
                          className="flex w-full items-center justify-between bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-green-50"
                        >
                          <span>G{index + 1} - Baris {item.row} - {side === "left" ? "Kiri" : "Kanan"}</span>
                          <span className="text-xs text-gray-500">{item.label || "Belum pilih"}</span>
                        </button>
                        {item.open && (
                          <div className="border-t border-green-200 bg-white">
                            <div className="grid grid-cols-2 gap-2 p-3">
                              <label className="block">
                                <span className="text-[11px] font-semibold text-gray-700">Baris</span>
                                <input
                                  type="number"
                                  value={item.row}
                                  onChange={(e) => setGroupLoads((current) => {
                                    const nextLoads = current.map((load, loadIndex) => loadIndex === index ? { ...load, row: parsePositiveInt(e.target.value) || 1, reportId: null, label: null, data: null, layer: new Map<string, GridCell>() } : load);
                                    setGridData(combineGroupLayerMaps(nextLoads, rows, cols));
                                    return nextLoads;
                                  })}
                                  className="mt-1 w-full rounded-lg border-2 border-gray-200 px-2 py-2 text-sm font-semibold"
                                />
                              </label>
                              <label className="block">
                                <span className="text-[11px] font-semibold text-gray-700">Lebar</span>
                                <input
                                  type="number"
                                  value={item.width}
                                  onChange={(e) => setGroupLoads((current) => {
                                    const nextLoads = current.map((load, loadIndex) => loadIndex === index ? { ...load, width: e.target.value, reportId: null, label: null, data: null, layer: new Map<string, GridCell>() } : load);
                                    setGridData(combineGroupLayerMaps(nextLoads, rows, cols));
                                    return nextLoads;
                                  })}
                                  className="mt-1 w-full rounded-lg border-2 border-gray-200 px-2 py-2 text-sm font-semibold"
                                />
                              </label>
                              <label className="block">
                                <span className="text-[11px] font-semibold text-gray-700">Dimming</span>
                                <select
                                  value={item.dimming ?? 100}
                                  onChange={(e) => {
                                    const nextDimming = parseInt(e.target.value, 10) || 100;
                                    setGroupLoads((current) => {
                                      const nextLoads = current.map((load, loadIndex) => loadIndex === index ? { ...load, dimming: nextDimming } : load);
                                      setGridData(combineGroupLayerMaps(nextLoads, rows, cols));
                                      return nextLoads;
                                    });
                                  }}
                                  className="mt-1 w-full rounded-lg border-2 border-gray-200 px-2 py-2 text-sm font-semibold"
                                >
                                  {dimmingOptions.map((p) => (
                                    <option key={`group-${index}-dim-${p}`} value={p}>{p}%</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                            <div className="max-h-44 overflow-auto">
                              {reportsList.map((report) => (
                                <button
                                  key={`group-${index}-${report.id}`}
                                  type="button"
                                  onClick={() => applyReportToGroupLoad(index, report)}
                                  className={`w-full border-t border-gray-100 px-3 py-2 text-left transition-all ${item.reportId === report.id ? "bg-green-50" : "hover:bg-gray-50"}`}
                                >
                                  <div className="text-sm font-semibold text-gray-800">{report.meta?.primary || report.label}</div>
                                  <div className="text-xs text-gray-500">{report.meta?.secondary || ""}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {loadMode !== "group" && (
              <>
              <div className="border-2 border-red-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowTopList((v) => !v)}
                  disabled={!isKabupatenReady}
                  className="w-full px-3 py-2.5 bg-white hover:bg-red-50 text-gray-700 text-sm font-medium transition-all flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <span>Load Data Pertama (Atas ke Bawah)</span>
                  </div>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${showTopList ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showTopList && (
                  <div className="bg-white border-t border-red-200">
                    <div className="px-3 py-2 text-xs text-gray-500">{reportsList.length} data tersedia</div>
                    <div className="max-h-40 overflow-auto">
                      {reportsList.map((r) => {
                        return (
                          <button
                            key={`top-${r.id}`}
                            onClick={() => handleSelectReportTop(r)}
                            className={`w-full text-left px-3 py-2 border-t border-gray-100 transition-all ${selectedReportTopId === r.id ? "bg-red-50" : "hover:bg-gray-50"}`}
                          >
                            <div className="text-sm font-semibold text-gray-800">{r.meta?.primary || r.label}</div>
                            {(r.meta?.watt || r.meta?.poleHeight) && (
                              <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold">
                                {r.meta?.watt && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">{r.meta.watt}</span>}
                                {r.meta?.poleHeight && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">Tiang {r.meta.poleHeight}</span>}
                                {r.meta?.voltage && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">{r.meta.voltage}</span>}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 mt-1">{r.meta?.secondary || ""}</div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                              {r.meta?.title && <span>{r.meta.title}</span>}
                              {r.meta?.date && <span>{r.meta.date}</span>}
                              {r.meta?.time && <span>{r.meta.time}</span>}
                              {r.meta?.kabupaten && <span>{r.meta.kabupaten}</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="p-3 border-t border-gray-100 flex gap-2">
                      <button
                        onClick={handleLoadDataFromTop}
                        disabled={!isKabupatenReady}
                        className="flex-1 px-3 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Terapkan
                      </button>
                      <button
                        onClick={fetchReportsList}
                        disabled={reportsLoading || !isKabupatenReady}
                        className="px-3 py-2 text-sm font-semibold bg-white border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Muat Ulang
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {loadMode === "3" && (
                <div className="border-2 border-green-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowMiddleList((v) => !v)}
                    disabled={!isKabupatenReady}
                    className="w-full px-3 py-2.5 bg-white hover:bg-green-50 text-gray-700 text-sm font-medium transition-all flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Load Data Ketiga (Tengah)</span>
                    </div>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${showMiddleList ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showMiddleList && (
                    <div className="bg-white border-t border-green-200">
                      <div className="px-3 py-2 text-xs text-gray-500">{reportsList.length} data tersedia</div>
                      <div className="max-h-40 overflow-auto">
                        {reportsList.map((r) => {
                          return (
                            <button
                              key={`middle-${r.id}`}
                              onClick={() => handleSelectReportMiddle(r)}
                              className={`w-full text-left px-3 py-2 border-t border-gray-100 transition-all ${selectedReportMiddleId === r.id ? "bg-green-50" : "hover:bg-gray-50"}`}
                            >
                              <div className="text-sm font-semibold text-gray-800">{r.meta?.primary || r.label}</div>
                              {(r.meta?.watt || r.meta?.poleHeight) && (
                                <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold">
                                  {r.meta?.watt && <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">{r.meta.watt}</span>}
                                  {r.meta?.poleHeight && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">Tiang {r.meta.poleHeight}</span>}
                                  {r.meta?.voltage && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">{r.meta.voltage}</span>}
                                </div>
                              )}
                              <div className="text-xs text-gray-500 mt-1">{r.meta?.secondary || ""}</div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                                {r.meta?.title && <span>{r.meta.title}</span>}
                                {r.meta?.date && <span>{r.meta.date}</span>}
                                {r.meta?.time && <span>{r.meta.time}</span>}
                                {r.meta?.kabupaten && <span>{r.meta.kabupaten}</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="p-3 border-t border-gray-100 flex gap-2">
                        <button
                          onClick={handleLoadDataFromMiddle}
                          disabled={!isKabupatenReady}
                          className="flex-1 px-3 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Terapkan
                        </button>
                        <button
                          onClick={fetchReportsList}
                          disabled={reportsLoading || !isKabupatenReady}
                          className="px-3 py-2 text-sm font-semibold bg-white border border-green-200 text-green-700 rounded-lg hover:bg-green-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Muat Ulang
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="border-2 border-green-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowBottomList((v) => !v)}
                  disabled={!isKabupatenReady}
                  className="w-full px-3 py-2.5 bg-white hover:bg-green-50 text-gray-700 text-sm font-medium transition-all flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    <span>Load Data Kedua (Bawah ke Atas)</span>
                  </div>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${showBottomList ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                {showBottomList && (
                  <div className="bg-white border-t border-green-200">
                    <div className="px-3 py-2 text-xs text-gray-500">{reportsList.length} data tersedia</div>
                    <div className="max-h-40 overflow-auto">
                      {reportsList.map((r) => {
                        return (
                          <button
                            key={`bottom-${r.id}`}
                            onClick={() => handleSelectReportBottom(r)}
                            className={`w-full text-left px-3 py-2 border-t border-gray-100 transition-all ${selectedReportBottomId === r.id ? "bg-green-50" : "hover:bg-gray-50"}`}
                          >
                            <div className="text-sm font-semibold text-gray-800">{r.meta?.primary || r.label}</div>
                            {(r.meta?.watt || r.meta?.poleHeight) && (
                              <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold">
                                {r.meta?.watt && <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">{r.meta.watt}</span>}
                                {r.meta?.poleHeight && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">Tiang {r.meta.poleHeight}</span>}
                                {r.meta?.voltage && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">{r.meta.voltage}</span>}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 mt-1">{r.meta?.secondary || ""}</div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                              {r.meta?.title && <span>{r.meta.title}</span>}
                              {r.meta?.date && <span>{r.meta.date}</span>}
                              {r.meta?.time && <span>{r.meta.time}</span>}
                              {r.meta?.kabupaten && <span>{r.meta.kabupaten}</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="p-3 border-t border-gray-100 flex gap-2">
                      <button
                        onClick={handleLoadDataFromBottom}
                        disabled={!isKabupatenReady}
                        className="flex-1 px-3 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Terapkan
                      </button>
                      <button
                        onClick={fetchReportsList}
                        disabled={reportsLoading || !isKabupatenReady}
                        className="px-3 py-2 text-sm font-semibold bg-white border border-green-200 text-green-700 rounded-lg hover:bg-green-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Muat Ulang
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </>
              )}
              {/* Muat daftar report dan pilih ? untuk petugas */}
              <div className="mt-2">
                <button
                  onClick={fetchReportsList}
                  disabled={!isGridReady || reportsLoading || !isKabupatenReady}
                  className="w-full px-3 py-2.5 bg-white hover:bg-green-50 text-gray-700 text-sm font-medium rounded-lg border-2 border-gray-200 hover:border-green-300 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h4v11H3zM10 3h4v18h-4zM17 7h4v14h-4z" />
                  </svg>
                  <span>Muat Daftar Report</span>
                </button>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-700">Report Pertama:</span>
                    <span className="flex-1 truncate text-gray-600">{selectedReportTopLabel || "Belum dipilih"}</span>
                    {selectedReportTopId && (
                      <button
                        onClick={() => {
                          setSelectedReportTopId(null);
                          setSelectedReportTopData(null);
                          setSelectedReportTopLabel(null);
                          setLastLoadedTopId(null);
                        }}
                        className="px-2 py-0.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {loadMode === "3" && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-gray-700">Report Ketiga:</span>
                      <span className="flex-1 truncate text-gray-600">{selectedReportMiddleLabel || "Belum dipilih"}</span>
                      {selectedReportMiddleId && (
                        <button
                          onClick={() => {
                            setSelectedReportMiddleId(null);
                            setSelectedReportMiddleData(null);
                            setSelectedReportMiddleLabel(null);
                            setLastLoadedMiddleId(null);
                          }}
                          className="px-2 py-0.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-700">Report Kedua:</span>
                    <span className="flex-1 truncate text-gray-600">{selectedReportBottomLabel || "Belum dipilih"}</span>
                    {selectedReportBottomId && (
                      <button
                        onClick={() => {
                          setSelectedReportBottomId(null);
                          setSelectedReportBottomData(null);
                          setSelectedReportBottomLabel(null);
                          setLastLoadedBottomId(null);
                        }}
                        className="px-2 py-0.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {reportsList.length > 0 && null}
              </div>
            </div>
          </div>
        )}
      </aside>

        {/* Main Grid Area */}
        <div className="flex-1 min-w-0">
          {isGridReady ? (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 h-full">
              {/* Grid Header */}
              <div className="px-6 py-5 border-b-2 border-gray-200 bg-gradient-to-r from-red-500 to-red-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        Kemerataan Sinar - {jenisJalanOptions.find(j => j.id === jenisJalan)?.name || ""}
                      </h3>
                      <p className="text-sm text-red-100 flex items-center gap-1.5 mt-0.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Analisis Kemerataan
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {loadMode !== "group" && (
                    <div className="flex items-center gap-2 bg-white/20 rounded-lg px-2 py-1.5">
                      <span className="text-xs font-semibold text-white">Dimming</span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-semibold text-white">Lampu 1</span>
                          <select
                            value={dimmingTop}
                            onChange={(e) => setDimmingTop(parseInt(e.target.value, 10) || 100)}
                            className="bg-white text-gray-900 text-xs font-bold rounded-md px-2 py-1 outline-none"
                          >
                            {dimmingOptions.map((p) => (
                              <option key={`top-${p}`} value={p}>{p}%</option>
                            ))}
                          </select>
                        </div>
                        {loadMode === "3" && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-semibold text-white">Lampu 3</span>
                            <select
                              value={dimmingMiddle}
                              onChange={(e) => setDimmingMiddle(parseInt(e.target.value, 10) || 100)}
                              className="bg-white text-gray-900 text-xs font-bold rounded-md px-2 py-1 outline-none"
                            >
                              {dimmingOptions.map((p) => (
                                <option key={`mid-${p}`} value={p}>{p}%</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-semibold text-white">Lampu 2</span>
                          <select
                            value={dimmingBottom}
                            onChange={(e) => setDimmingBottom(parseInt(e.target.value, 10) || 100)}
                            className="bg-white text-gray-900 text-xs font-bold rounded-md px-2 py-1 outline-none"
                          >
                            {dimmingOptions.map((p) => (
                              <option key={`bot-${p}`} value={p}>{p}%</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    )}
                    <button
                      onClick={handleReset}
                      className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-semibold text-sm rounded-lg transition-all flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {/* Grid Content */}
              <div className="p-6 overflow-x-auto">
                <div className="inline-block min-w-full">
                  <div
                    className="grid gap-2 p-4 bg-gradient-to-br from-gray-50 to-red-50 rounded-xl shadow-inner"
                    style={{
                      gridTemplateColumns: `${compactGrid ? 58 : 80}px repeat(${cols}, minmax(${compactGrid ? 46 : 70}px, 1fr))`,
                      contain: 'layout style paint'
                    }}
                  >
                    {/* Top-left corner label */}
                    <div className="bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-xs font-bold text-white p-3 rounded-lg shadow-md">
                      <div className="text-center leading-tight">
                        <div>Jarak</div>
                        <div>Tiang (m)</div>
                      </div>
                    </div>
                    
                    {/* Column Headers */}
                    {Array.from({ length: cols }, (_, i) => {
                      const isTitikApiColumn = i === TITIK_API_COL_INDEX;
                      return (
                      <div key={`header-${i}`} className={`${isTitikApiColumn ? "bg-red-700 ring-4 ring-red-300 text-white scale-[1.03]" : "bg-gradient-to-b from-red-500 to-red-600 text-white"} flex items-center justify-center font-bold text-sm p-3 rounded-lg shadow-md`}>
                        {i + 1}
                      </div>
                      );
                    })}

                    {/* Grid Rows */}
                    {Array.from({ length: rows }, (_, row) => (
                      <div key={`row-${row}`} className="contents">
                        {/* Row Header */}
                        <div className="bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center font-bold text-sm text-white p-3 rounded-lg shadow-md">
                          {row + 1}
                        </div>
                        
                        {/* Row Cells - Read Only */}
                        {Array.from({ length: cols }, (_, col) => {
                          const cellKey = getCellKey(row, col);
                          const isOutsideRoad = col >= getActiveRoadColsForRow(row);
                          const cellData = gridData.get(cellKey);
                          const value = cellData?.value || "0";
                          const numValue = parseFloat(value);
                          const dimmedValue = isNaN(numValue) ? 0 : numValue;
                          
                          // Color coding based on value (similar to measurement grid)
                          let cellColor = isOutsideRoad ? "bg-slate-100 text-slate-300 border-dashed opacity-60" : "bg-white text-gray-500"; // Default empty
                          if (!isOutsideRoad && dimmedValue > 0) {
                            if (dimmedValue >= 50) cellColor = "bg-red-400 text-white shadow-sm";
                            else if (dimmedValue >= 40) cellColor = "bg-orange-400 text-white";
                            else if (dimmedValue >= 30) cellColor = "bg-yellow-300 text-gray-900";
                            else if (dimmedValue >= 20) cellColor = "bg-yellow-200 text-gray-800";
                            else if (dimmedValue >= 10) cellColor = "bg-yellow-100 text-gray-700";
                            else if (dimmedValue >= 5) cellColor = "bg-orange-50 text-gray-600";
                            else cellColor = "bg-white text-gray-500";
                          }
                          
                          const cellKeyStr = `${row}-${col}`;
                          const isTitikApiCell = titikApiCells.has(cellKeyStr);
                          const titikApiLabel = isTitikApiCell ? getTitikApiLabel(row, col) : null;
                          if (isTitikApiCell && !isOutsideRoad) {
                            cellColor = "bg-red-600 text-white shadow-lg ring-4 ring-red-200";
                          }
                          return (
                            <div
                              key={cellKey}
                              className={`relative ${compactGrid ? "h-9 px-1 text-[11px]" : "h-14 px-2 text-sm"} flex items-center justify-center border-2 border-gray-200 rounded-lg font-bold transition-all ${cellColor}`}
                              style={{ contain: 'layout style paint' }}
                              title={isOutsideRoad ? `Row ${row + 1}, Col ${col + 1}: luar lebar jalan, tidak dihitung` : `Row ${row + 1}, Col ${col + 1}: ${formatLuxNumber(dimmedValue, !Number.isInteger(dimmedValue))}`}
                            >
                              {isOutsideRoad ? (
                                <span className="text-[10px] font-semibold uppercase tracking-wide">Luar Jalan</span>
                              ) : titikApiLabel ? (
                                <span className="absolute top-1 right-1 bg-white/90 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
                                  {titikApiLabel}
                                </span>
                              ) : null}
                              {!isOutsideRoad ? formatLuxNumber(dimmedValue, !Number.isInteger(dimmedValue)) : null}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg border-2 border-dashed border-gray-300 h-full flex items-center justify-center p-12">
              <div className="text-center">
                <svg className="w-20 h-20 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7H4V5zM10 5a1 1 0 011-1h4a1 1 0 011 1v7h-6V5zM16 5a1 1 0 011-1h4a1 1 0 011 1v7h-6V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM10 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3zM16 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                </svg>
                <h3 className="text-xl font-bold text-gray-400 mb-2">Belum Ada Grid</h3>
                <p className="text-sm text-gray-500 max-w-md">
                  Pilih jenis jalan dan masukkan ukuran grid pada panel kiri, kemudian klik tombol <span className="font-semibold text-green-600">"Terapkan"</span> untuk memulai analisis
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
    {showKabupatenPicker && useKabupatenFilter && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="p-5 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-900">Pilih Kabupaten</h3>
            <p className="text-sm text-gray-600">Pilih lokasi kerja agar data terfokus dan tidak tercampur.</p>
          </div>
          <div className="p-5">
            {availableKabupaten.length === 0 ? (
              <div className="text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                Tidak ada kabupaten yang bisa diakses. Hubungi admin untuk membuka akses.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableKabupaten.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => handleKabupatenPick(k.id)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      activeKabupaten === k.id
                        ? "border-red-400 bg-red-50 shadow-sm"
                        : "border-gray-200 hover:border-red-300 hover:bg-red-50/40"
                    }`}
                  >
                    <div className="text-base font-bold text-gray-900">{k.name}</div>
                    <div className="text-xs text-gray-600 mt-1">{k.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="p-4 border-t border-gray-200 flex items-center justify-end gap-2">
            {activeKabupaten && (
              <button
                onClick={() => setShowKabupatenPicker(false)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50"
              >
                Batal
              </button>
            )}
          </div>
        </div>
      </div>
    )}
    {showKabupatenConfirm && pendingKabupaten && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="p-5 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">Konfirmasi Kabupaten</h3>
            <p className="text-sm text-gray-600">
              Kamu akan bekerja di: <span className="font-semibold text-gray-900">{pendingKabupatenName}</span>
            </p>
          </div>
          <div className="p-5 flex items-center justify-end gap-2">
            <button
              onClick={handleKabupatenCancel}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              onClick={handleKabupatenConfirm}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold"
            >
              Mulai
            </button>
          </div>
        </div>
      </div>
    )}
    {showAnalysis && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="p-5 border-b border-gray-200 flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Evaluasi Standar Jalan {jenisJalanOptions.find(j => j.id === jenisJalan)?.name || "-"}</h3>
              <p className="text-sm text-gray-600">Analisis kesesuaian dengan standar pencahayaan</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">Mode</span>
              <select
                value={analysisMode}
                onChange={(e) => setAnalysisMode((e.target.value as "full" | "avg-only") || "full")}
                className="text-xs font-semibold border border-gray-300 rounded-lg px-2 py-1 bg-white text-gray-900"
              >
                <option value="full">2 Parameter (Avg + Rasio)</option>
                <option value="avg-only">Hanya L-avg</option>
              </select>
            </div>
            <button
              onClick={() => setShowAnalysis(false)}
              className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div className={`p-4 rounded-xl border ${overallOk ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${overallOk ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={overallOk ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
                  </svg>
                </div>
                <div>
                  <div className={`text-lg font-bold ${overallOk ? "text-green-700" : "text-red-700"}`}>
                    {overallOk ? "MEMENUHI STANDAR" : "TIDAK MEMENUHI STANDAR"}
                  </div>
                  <div className="text-sm text-gray-600">
                    {jenisJalanOptions.find(j => j.id === jenisJalan)?.name || "-"} - {jenisJalanOptions.find(j => j.id === jenisJalan)?.description || ""}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border bg-green-50 border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold text-gray-900">Pencahayaan Rata-rata (L-avg)</span>
                </div>
                <div className="text-sm text-gray-600">Nilai Aktual: <span className="font-bold text-gray-900">{stats.avg.toFixed(2)} lux</span></div>
                <div className="text-sm text-gray-600">Standar Minimum: <span className="font-bold text-gray-900">{activeStandard?.avgMin ?? 0} lux</span></div>
                <div className={`mt-2 text-sm font-bold ${avgOk ? "text-green-700" : "text-red-700"}`}>Status: {avgOk ? "OK" : "NOT OK"}</div>
                <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-2">
                  Kriteria: L-avg di atas {activeStandard?.avgMin ?? 0} lux = OK, di bawah = NOT OK
                </div>
              </div>

              <div className={`p-4 rounded-xl border ${analysisMode === "avg-only" ? "bg-gray-50 border-gray-200 opacity-70" : "bg-green-50 border-green-200"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold text-gray-900">Rasio Kemerataan</span>
                </div>
                <div className="text-sm text-gray-600">Nilai Aktual: <span className="font-bold text-gray-900">{ratioActual.toFixed(2)}</span></div>
                <div className="text-sm text-gray-600">Batas Maksimum: <span className="font-bold text-gray-900">{activeStandard?.ratioMax ?? 0}</span></div>
                <div className={`mt-2 text-sm font-bold ${analysisMode === "avg-only" ? "text-gray-600" : (ratioOk ? "text-green-700" : "text-red-700")}`}>
                  Status: {analysisMode === "avg-only" ? "DIABAIKAN" : (ratioOk ? "OK" : "NOT OK")}
                </div>
                <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-2">
                  Kriteria: Rasio di bawah atau sama dengan {activeStandard?.ratioMax ?? 0} = OK, di atas = NOT OK
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold text-gray-900">Detail Statistik Pencahayaan</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                  <div className="text-xs text-gray-500">L-Min</div>
                  <div className="text-lg font-bold text-blue-600">{stats.min.toFixed(2)} lux</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                  <div className="text-xs text-gray-500">L-Max</div>
                  <div className="text-lg font-bold text-green-600">{stats.max.toFixed(2)} lux</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                  <div className="text-xs text-gray-500">L-Avg</div>
                  <div className="text-lg font-bold text-amber-600">{stats.avg.toFixed(2)} lux</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                  <div className="text-xs text-gray-500">Total Data</div>
                  <div className="text-lg font-bold text-gray-900">{stats.count} sel</div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 bg-blue-50">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="font-semibold text-gray-900">Preset Titik Api</span>
              </div>
              <div className="text-xs text-blue-700 mb-2">
                Target jalan: {targetAvg.toFixed(1)} lux
              </div>
              {presetRows.length === 0 ? (
                <div className="text-xs text-gray-500">Belum ada data.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {presetRows.map((p) => (
                    <div key={p.label} className="bg-white rounded-lg border border-blue-100 p-3">
                      <div className="flex justify-between">
                        <span className="font-semibold text-gray-800">{p.label}</span>
                        <span className="text-xs text-gray-500">Baris {p.rowIndex}</span>
                      </div>
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-gray-600">Emax sekarang:</span>
                        <span className="font-bold text-gray-900">{formatLuxNumber(p.eMaxNow, true)} lux</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Batas bawah (preset):</span>
                        <span className="font-bold text-blue-700">{formatLuxNumber(p.eMaxLimit, true)} lux</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-gray-200 flex items-center justify-end">
            <button
              onClick={() => setShowAnalysis(false)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export function KemeratanCahayaContent() {
  const [activeModuleTab, setActiveModuleTab] = useState<"uniformity" | "distance">("uniformity");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-[70] border-b border-red-200 bg-white/95 px-4 py-2 shadow-sm backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-[1920px] items-center gap-2 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveModuleTab("uniformity")}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-black transition ${activeModuleTab === "uniformity" ? "bg-red-600 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
          >
            Analisis Kemerataan
          </button>
          <button
            type="button"
            onClick={() => setActiveModuleTab("distance")}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-black transition ${activeModuleTab === "distance" ? "bg-red-600 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
          >
            Analisa Jarak Lampu
          </button>
        </div>
      </div>
      {activeModuleTab === "uniformity" ? <UniformityAnalysisContent /> : <LampDistanceAnalysis />}
    </div>
  );
}

function KemeratanCahayaPage() {
  return (
    <ProtectedRoute>
      <KemeratanCahayaContent />
    </ProtectedRoute>
  );
}

export default KemeratanCahayaPage;





