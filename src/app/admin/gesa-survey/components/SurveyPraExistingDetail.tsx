"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, limit, orderBy, query, where, deleteDoc, doc, startAfter, QueryConstraint, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import dynamic from "next/dynamic";
import * as XLSX from 'xlsx';
import { useAuth } from "@/hooks/useAuth";

const DynamicDetailMap = dynamic(
  () => import("./SurveyDetailMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-64 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Memuat peta...</p>
        </div>
      </div>
    ),
  }
);

interface Survey {
  id: string;
  title: string;
  type: string;
  status: string;
  surveyorName: string;
  surveyorEmail?: string;
  createdAt: TimestampLike;
  verifiedAt: TimestampLike;
  verifiedBy: string;
  validatedAt: TimestampLike;
  validatedBy: string;
  latitude: number;
  longitude: number;
  adminLatitude?: number;
  adminLongitude?: number;
  finalLatitude?: number;
  finalLongitude?: number;
  accuracy?: number;
  kabupaten?: string;
  kabupatenName?: string;
  kecamatan?: string;
  desa?: string;
  banjar?: string;
  namaJalan?: string;
  kepemilikanTiang?: string;
  kepemilikanDisplay?: string;
  tipeTiangPLN?: string;
  jenisLampu?: string;
  jumlahLampu?: string;
  dayaLampu?: string;
  fungsiLampu?: string;
  lebarJalan?: string;
  kondisi?: string;
  jenisTiang?: string;
  garduStatus?: string;
  kodeGardu?: string;
  keterangan?: string;
  fotoAktual?: string;
  fotoKemerataan?: string;
}

type TimestampLike =
  | { toDate?: () => Date; seconds?: number }
  | Date
  | string
  | number
  | null
  | undefined;

interface SurveyPraExistingDetailProps {
  onBack: () => void;
  statusFilter?: string;
  activeKabupaten?: string | null;
}

export default function SurveyPraExistingDetail({
  onBack,
  statusFilter = "diverifikasi",
  activeKabupaten,
}: SurveyPraExistingDetailProps) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super-admin";
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDetailMap, setShowDetailMap] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKecamatan, setFilterKecamatan] = useState("Semua Kecamatan");
  const [filterDesa, setFilterDesa] = useState("Semua Desa");
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [pageCursors, setPageCursors] = useState<QueryDocumentSnapshot[]>([]);
  const [kabupatenField, setKabupatenField] = useState<"kabupaten" | "kabupatenName" | null>(null);
  const [floatingScrollbar, setFloatingScrollbar] = useState({
    visible: false,
    left: 0,
    width: 0,
  });
  const tableSectionRef = useRef<HTMLDivElement | null>(null);
  const topScrollbarRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const topScrollbarContentRef = useRef<HTMLDivElement | null>(null);
  const floatingScrollbarRef = useRef<HTMLDivElement | null>(null);
  const floatingScrollbarContentRef = useRef<HTMLDivElement | null>(null);

  const tableHeaders = [
    "No",
    "Judul",
    "Surveyor",
    "Lokasi",
    "Jenis Lampu",
    "Jumlah",
    "Koordinat",
    "Foto",
    "Status",
    "Aksi",
  ];

  const buildConstraints = (selectedKabupatenField: "kabupaten" | "kabupatenName" | null, page: number, pageSize: number) => {
    const constraints: QueryConstraint[] = [where("status", "==", statusFilter), orderBy("createdAt", "desc")];

    if (activeKabupaten && selectedKabupatenField) {
      constraints.unshift(where(selectedKabupatenField, "==", activeKabupaten));
    }

    constraints.push(limit(pageSize));

    const previousCursor = page > 1 ? pageCursors[page - 2] : null;
    if (previousCursor) {
      constraints.push(startAfter(previousCursor));
    }

    return constraints;
  };

  const fetchSurveys = async () => {
    try {
      setLoading(true);
      const surveysRef = collection(db, "survey-pra-existing");
      const candidateFields: Array<"kabupaten" | "kabupatenName" | null> = activeKabupaten
        ? ["kabupaten", "kabupatenName"]
        : [null];

      let selectedField: "kabupaten" | "kabupatenName" | null = candidateFields[0];
      let visibleDocs: QueryDocumentSnapshot[] = [];
      let hasMore = false;

      for (const field of candidateFields) {
        const snapshot = await getDocs(query(surveysRef, ...buildConstraints(field, 1, itemsPerPage)));
        visibleDocs = snapshot.docs;
        hasMore = visibleDocs.length === itemsPerPage;

        if (visibleDocs.length > 0 || field === candidateFields[candidateFields.length - 1]) {
          selectedField = field;
          break;
        }
      }

      setKabupatenField(selectedField);
      setSurveys(visibleDocs.map(mapDoc));
      setCurrentPage(1);
      setHasNextPage(hasMore);
      setPageCursors(visibleDocs.length > 0 ? [visibleDocs[visibleDocs.length - 1]] : []);
      setTotalCount(0);
    } catch (error) {
      console.error("Error fetching pra existing surveys:", error);
    } finally {
      setLoading(false);
    }
  };

  const mapDoc = (docSnap: QueryDocumentSnapshot) => ({
        id: docSnap.id,
        title: docSnap.data().title || `Survey Pra Existing - ${docSnap.data().jenisLampu || "Untitled"}`,
        type: "pra-existing",
        status: docSnap.data().status || "diverifikasi",
        surveyorName: docSnap.data().surveyorName || "Unknown",
        surveyorEmail: docSnap.data().surveyorEmail,
        createdAt: docSnap.data().createdAt,
        verifiedAt: docSnap.data().verifiedAt || docSnap.data().createdAt,
        verifiedBy: docSnap.data().verifiedBy || docSnap.data().editedBy || "Admin",
        validatedAt: docSnap.data().validatedAt || docSnap.data().createdAt,
        validatedBy: docSnap.data().validatedBy || docSnap.data().editedBy || "Admin",
        latitude: docSnap.data().latitude || 0,
        longitude: docSnap.data().longitude || 0,
        adminLatitude: docSnap.data().adminLatitude,
        adminLongitude: docSnap.data().adminLongitude,
        finalLatitude: docSnap.data().finalLatitude,
        finalLongitude: docSnap.data().finalLongitude,
        accuracy: docSnap.data().accuracy,
        kabupaten: docSnap.data().kabupaten,
        kabupatenName: docSnap.data().kabupatenName,
        kecamatan: docSnap.data().kecamatan,
        desa: docSnap.data().desa,
        banjar: docSnap.data().banjar,
        namaJalan: docSnap.data().namaJalan,
        kepemilikanTiang: docSnap.data().kepemilikanTiang,
        kepemilikanDisplay: docSnap.data().kepemilikanDisplay || docSnap.data().keteranganTiang,
        tipeTiangPLN: docSnap.data().tipeTiangPLN,
        jenisLampu: docSnap.data().jenisLampu,
        jumlahLampu: docSnap.data().jumlahLampu,
        dayaLampu: docSnap.data().dayaLampu,
        fungsiLampu: docSnap.data().fungsiLampu,
        lebarJalan: docSnap.data().lebarJalan,
        kondisi: docSnap.data().kondisi,
        jenisTiang: docSnap.data().jenisTiang,
        garduStatus: docSnap.data().garduStatus,
        kodeGardu: docSnap.data().kodeGardu,
        keterangan: docSnap.data().keterangan,
        fotoAktual: docSnap.data().fotoAktual,
        fotoKemerataan: docSnap.data().fotoKemerataan,
      }) as Survey;

  useEffect(() => {
    setSurveys([]);
    setCurrentPage(1);
    setHasNextPage(false);
    setPageCursors([]);
    setKabupatenField(null);
  }, [statusFilter, activeKabupaten, itemsPerPage]);

  useEffect(() => {
    void fetchSurveys();
  }, [statusFilter, activeKabupaten, itemsPerPage]);

  const formatDate = (timestamp: TimestampLike) => {
    if (!timestamp) return "N/A";
    try {
      let date: Date;

      if (timestamp instanceof Date) {
        date = timestamp;
      } else if (typeof timestamp === "object" && timestamp !== null) {
        if ("toDate" in timestamp && typeof timestamp.toDate === "function") {
          date = timestamp.toDate();
        } else if ("seconds" in timestamp && typeof timestamp.seconds === "number") {
          date = new Date(timestamp.seconds * 1000);
        } else {
          return "N/A";
        }
      } else {
        date = new Date(timestamp);
      }

      return date.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "N/A";
    }
  };

  const handleViewDetail = (survey: Survey) => {
    setSelectedSurvey(survey);
    setShowDetailMap(false);
    setShowDetailModal(true);
  };

  const handleViewMaps = (latitude: number, longitude: number) => {
    window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, "_blank");
  };

  const getDisplayLatitude = (survey: Survey) => survey.finalLatitude ?? survey.adminLatitude ?? survey.latitude;
  const getDisplayLongitude = (survey: Survey) => survey.finalLongitude ?? survey.adminLongitude ?? survey.longitude;

  const handleExportExcel = () => {
    const headers = [
      "No",
      "ID Survey",
      "Judul",
      "Surveyor",
      "Kabupaten",
      "Kecamatan",
      "Desa",
      "Banjar",
      "Kepemilikan Tiang",
      "Tipe Tiang PLN",
      "Jenis Lampu",
      "Jumlah Lampu",
      "Daya Lampu",
      "Fungsi Lampu",
      "Jenis Tiang",
      "Gardu",
      "Kode Gardu",
      "Keterangan",
      "Koordinat Petugas X",
      "Koordinat Petugas Y",
      "Koordinat Admin X",
      "Koordinat Admin Y",
      "Status",
      "Diverifikasi Oleh",
      "Tanggal Verifikasi",
      "Tanggal Survey",
      "Link Foto Petugas",
    ];

    if (statusFilter === "tervalidasi" && isSuperAdmin) {
      headers.splice(headers.length - 2, 0, "Divalidasi Oleh", "Tanggal Validasi");
    }

    const rows = filteredSurveys.map((survey, index) => {
      // Collect photo URLs
      const fotoUrls = [];
      if (survey.fotoAktual) fotoUrls.push(survey.fotoAktual);
      if (survey.fotoKemerataan) fotoUrls.push(survey.fotoKemerataan);
      
      const fotoLink = fotoUrls.length > 0 ? fotoUrls.join(" | ") : "";

      const row = [
        index + 1,
        survey.id || "",
        survey.title || "",
        survey.surveyorName || "",
        survey.kabupatenName || survey.kabupaten || "",
        survey.kecamatan || "",
        survey.desa || "",
        survey.banjar || "",
        survey.kepemilikanDisplay || survey.kepemilikanTiang || "",
        survey.tipeTiangPLN || "",
        survey.jenisLampu || "",
        survey.jumlahLampu || "",
        survey.dayaLampu || "",
        survey.fungsiLampu || "",
        survey.jenisTiang || "",
        survey.garduStatus || "",
        survey.kodeGardu || "",
        survey.keterangan || "",
        getDisplayLongitude(survey)?.toFixed(7) || "",
        getDisplayLatitude(survey)?.toFixed(7) || "",
        survey.adminLongitude?.toFixed(7) || "",
        survey.adminLatitude?.toFixed(7) || "",
        survey.status || "",
        survey.verifiedBy || "",
        formatDate(survey.verifiedAt) || "",
      ];

      if (statusFilter === "tervalidasi" && isSuperAdmin) {
        row.push(survey.validatedBy || "", formatDate(survey.validatedAt) || "");
      }

      row.push(formatDate(survey.createdAt) || "", fotoLink);

      return row;
    });

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    
    // Auto-width columns
    const colWidths = headers.map((header, i) => {
      const maxLength = Math.max(
        header.length,
        ...rows.map(row => String(row[i] || "").length)
      );
      return { wch: Math.min(maxLength + 2, 50) };
    });
    ws['!cols'] = colWidths;

    // Add hyperlinks for photo URLs
    rows.forEach((row, rowIndex) => {
      const fotoIndex = headers.length - 1; // Last column (Link Foto Petugas)
      const fotoUrl = row[fotoIndex];
      
      if (fotoUrl && typeof fotoUrl === 'string' && fotoUrl.trim() !== "") {
        const cellAddress = XLSX.utils.encode_cell({ r: rowIndex + 1, c: fotoIndex });
        ws[cellAddress] = {
          v: "Klik untuk lihat foto",
          l: { Target: fotoUrl, Tooltip: "Buka foto di browser" },
          s: { font: { color: { rgb: "FF0000FF" }, underline: true } }
        };
      }
    });

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Survey Pra Existing");
    
    // Generate filename with date
    const fileName = `survey-pra-existing-${new Date().toISOString().split("T")[0]}.xlsx`;
    
    // Download file
    XLSX.writeFile(wb, fileName);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.")) return;
    try {
      await deleteDoc(doc(db, "survey-pra-existing", id));
      await fetchSurveys();
      alert("Data berhasil dihapus!");
    } catch (error) {
      console.error("Error deleting survey:", error);
      alert("Gagal menghapus data: " + error);
    }
  };

  const normalizeCoordinateText = (value: string) => value.replace(/\s+/g, "");

  const filteredSurveys = surveys.filter((survey) => {
    // Search query filter
    if (searchQuery) {
      const needle = searchQuery.toLowerCase();
      const searchableText = [
        survey.title,
        survey.surveyorName,
        survey.kabupatenName || survey.kabupaten,
        survey.kecamatan,
        survey.desa,
        survey.banjar,
        survey.jenisLampu,
        survey.fungsiLampu,
        survey.garduStatus,
        survey.kodeGardu,
      ].join(" ").toLowerCase();

      const coordinateTerms = searchQuery
        .split(/[\s,;]+/)
        .map((term) => normalizeCoordinateText(term.trim()))
        .filter(Boolean);
      const coordinateValues = [
        survey.latitude,
        survey.longitude,
        survey.adminLatitude,
        survey.adminLongitude,
        survey.finalLatitude,
        survey.finalLongitude,
      ]
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
        .flatMap((value) => [value.toString(), value.toFixed(7)]);
      const matchesCoordinate =
        coordinateTerms.length > 0 &&
        coordinateTerms.every((term) =>
          coordinateValues.some((value) => normalizeCoordinateText(value).includes(term))
        );

      if (!searchableText.includes(needle) && !matchesCoordinate) return false;
    }

    // Kecamatan filter
    if (filterKecamatan !== "Semua Kecamatan" && survey.kecamatan !== filterKecamatan) {
      return false;
    }

    // Desa filter
    if (filterDesa !== "Semua Desa" && survey.desa !== filterDesa) {
      return false;
    }

    return true;
  });

  // Pagination logic
  const totalItems = totalCount > 0 ? totalCount : (hasNextPage ? currentPage * itemsPerPage + 1 : ((currentPage - 1) * itemsPerPage) + surveys.length);
  const totalPages = Math.max(1, totalCount > 0 ? Math.ceil(totalItems / itemsPerPage) : currentPage + (hasNextPage ? 1 : 0));
  const startIndex = filteredSurveys.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endIndex = filteredSurveys.length === 0 ? 0 : Math.min(startIndex + itemsPerPage - 1, totalItems);
  const paginatedSurveys = filteredSurveys;

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;

    void (async () => {
      try {
        setLoading(true);
        const surveysRef = collection(db, "survey-pra-existing");
        const snapshot = await getDocs(query(surveysRef, ...buildConstraints(kabupatenField, page, itemsPerPage)));
        const visibleDocs = snapshot.docs;
        const nextHasMore = visibleDocs.length === itemsPerPage;

        if (page > 1 && visibleDocs.length === 0) {
          setHasNextPage(false);
          return;
        }

        setSurveys(visibleDocs.map(mapDoc));
        setCurrentPage(page);
        setHasNextPage(nextHasMore);
        setPageCursors((current) => {
          const next = current.slice(0, Math.max(page - 1, 0));
          const lastVisible = visibleDocs[visibleDocs.length - 1];
          if (lastVisible) {
            next[page - 1] = lastVisible;
          }
          return next;
        });
      } catch (error) {
        console.error("Error changing pra existing page:", error);
      } finally {
        setLoading(false);
      }
    })();
  };

  // Get unique kecamatans from surveys
  const kecamatanOptions = useMemo(() => {
    const uniqueKecamatans = [...new Set(surveys.map(s => s.kecamatan).filter(Boolean))];
    return ["Semua Kecamatan", ...uniqueKecamatans.sort()];
  }, [surveys]);

  // Get unique desas based on selected kecamatan
  const desaOptions = useMemo(() => {
    if (filterKecamatan === "Semua Kecamatan") {
      const uniqueDesas = [...new Set(surveys.map(s => s.desa).filter(Boolean))];
      return ["Semua Desa", ...uniqueDesas.sort()];
    } else {
      const filtered = surveys.filter(s => s.kecamatan === filterKecamatan);
      const uniqueDesas = [...new Set(filtered.map(s => s.desa).filter(Boolean))];
      return ["Semua Desa", ...uniqueDesas.sort()];
    }
  }, [surveys, filterKecamatan]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "tervalidasi":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "diverifikasi":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "ditolak":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
    }
  };

  useEffect(() => {
    const topScrollbar = topScrollbarRef.current;
    const tableScroll = tableScrollRef.current;
    const topScrollbarContent = topScrollbarContentRef.current;
    const floatingScrollbarNode = floatingScrollbarRef.current;
    const floatingScrollbarContent = floatingScrollbarContentRef.current;

    if (!topScrollbar || !tableScroll || !topScrollbarContent) return;

    const syncScrollbarWidth = () => {
      const scrollWidth = `${tableScroll.scrollWidth}px`;
      topScrollbarContent.style.width = scrollWidth;
      if (floatingScrollbarContent) {
        floatingScrollbarContent.style.width = scrollWidth;
      }
    };

    let isSyncingScroll = false;

    const syncScrollLeft = (source: HTMLDivElement) => {
      if (isSyncingScroll) return;

      isSyncingScroll = true;
      const nextLeft = source.scrollLeft;
      const scrollTargets = [topScrollbar, floatingScrollbarNode, tableScroll].filter(
        (node): node is HTMLDivElement => node instanceof HTMLDivElement
      );

      scrollTargets.forEach((node) => {
        if (node !== source && node.scrollLeft !== nextLeft) {
          node.scrollLeft = nextLeft;
        }
      });
      isSyncingScroll = false;
    };

    const handleTopScroll = () => {
      syncScrollLeft(topScrollbar);
    };

    const handleFloatingScroll = () => {
      if (floatingScrollbarNode) {
        syncScrollLeft(floatingScrollbarNode);
      }
    };

    const handleTableScroll = () => {
      syncScrollLeft(tableScroll);
    };

    const updateFloatingScrollbar = () => {
      const tableSection = tableSectionRef.current;
      if (!tableSection) return;

      const sectionRect = tableSection.getBoundingClientRect();
      const scrollRect = tableScroll.getBoundingClientRect();
      const topOffset = 16;
      const shouldFloat = sectionRect.top < topOffset && sectionRect.bottom > topOffset + 72;

      setFloatingScrollbar((current) => {
        const next = {
          visible: shouldFloat,
          left: scrollRect.left,
          width: scrollRect.width,
        };

        if (
          current.visible === next.visible &&
          current.left === next.left &&
          current.width === next.width
        ) {
          return current;
        }

        return next;
      });
    };

    const scrollHost = tableSectionRef.current?.closest("main");

    syncScrollbarWidth();
    updateFloatingScrollbar();

    topScrollbar.addEventListener("scroll", handleTopScroll);
    floatingScrollbarNode?.addEventListener("scroll", handleFloatingScroll);
    tableScroll.addEventListener("scroll", handleTableScroll);
    window.addEventListener("resize", syncScrollbarWidth);
    window.addEventListener("resize", updateFloatingScrollbar);
    window.addEventListener("scroll", updateFloatingScrollbar, true);
    scrollHost?.addEventListener("scroll", updateFloatingScrollbar);

    return () => {
      topScrollbar.removeEventListener("scroll", handleTopScroll);
      floatingScrollbarNode?.removeEventListener("scroll", handleFloatingScroll);
      tableScroll.removeEventListener("scroll", handleTableScroll);
      window.removeEventListener("resize", syncScrollbarWidth);
      window.removeEventListener("resize", updateFloatingScrollbar);
      window.removeEventListener("scroll", updateFloatingScrollbar, true);
      scrollHost?.removeEventListener("scroll", updateFloatingScrollbar);
    };
  }, [filteredSurveys.length, floatingScrollbar.visible]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl shadow-xl p-6 text-white">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2.5 bg-white/20 hover:bg-white/30 rounded-xl transition-all backdrop-blur-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">Survey Pra Existing</h1>
              <p className="text-emerald-100 text-sm mt-1">
                Data Survey Pra Existing yang telah {statusFilter === "tervalidasi" ? "tervalidasi" : statusFilter}
              </p>
            </div>
          </div>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-emerald-700 font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:bg-emerald-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M5 20h14" />
            </svg>
            Export Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Cari judul, jenis lampu, surveyor, atau koordinat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-gray-900 placeholder:text-gray-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterKecamatan}
              onChange={(e) => {
                setFilterKecamatan(e.target.value);
                setFilterDesa("Semua Desa"); // Reset desa when kecamatan changes
              }}
              className="px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-gray-900 bg-white"
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
              className="px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
            >
              {desaOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
            <span className="text-emerald-700 font-medium">{filteredSurveys.length}</span>
            <span className="text-emerald-600 text-sm">dari {surveys.length} data</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600 font-medium">Memuat data survey...</p>
          </div>
        ) : filteredSurveys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h4 className="text-xl font-bold text-gray-900 mb-2">Belum Ada Data</h4>
            <p className="text-gray-500 text-center max-w-md">
              Belum ada data Survey Pra Existing yang sesuai dengan filter.
            </p>
          </div>
        ) : (
          <div ref={tableSectionRef} className="relative rounded-2xl overflow-hidden bg-white">
            {floatingScrollbar.visible && (
              <div
                className="fixed z-40 rounded-full border border-gray-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur"
                style={{
                  top: 16,
                  left: floatingScrollbar.left,
                  width: floatingScrollbar.width,
                }}
              >
                <div
                  ref={floatingScrollbarRef}
                  className="overflow-x-auto overflow-y-hidden rounded-full bg-gray-100"
                >
                  <div ref={floatingScrollbarContentRef} className="h-3 min-w-full" />
                </div>
              </div>
            )}
            <div className="border-b border-gray-200 bg-white/95 px-6 py-3 shadow-sm backdrop-blur rounded-t-2xl">
              <div
                ref={topScrollbarRef}
                className="overflow-x-auto overflow-y-hidden rounded-full bg-gray-100"
              >
                <div ref={topScrollbarContentRef} className="h-3 min-w-full" />
              </div>
            </div>
            <div ref={tableScrollRef} className="overflow-x-auto rounded-b-2xl">
              <table className="w-full min-w-[1400px]">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr>
                  {tableHeaders.map((header) => (
                    <th
                      key={header}
                      className={`bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-600 ${
                        header === "Aksi" ? "text-center" : ""
                      }`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedSurveys.map((survey, index) => (
                  <tr key={survey.id} className="hover:bg-emerald-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="w-8 h-8 flex items-center justify-center bg-emerald-100 text-emerald-700 font-bold rounded-lg text-sm">
                        {startIndex + index}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900">{survey.title}</span>
                        <span className="text-xs text-gray-500 mt-0.5">{formatDate(survey.createdAt)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm">
                          {survey.surveyorName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">{survey.surveyorName}</span>
                          {survey.surveyorEmail && <span className="text-xs text-gray-500">{survey.surveyorEmail}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-[220px]">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {[survey.desa, survey.banjar].filter(Boolean).join(" - ") || survey.kecamatan || "N/A"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {[survey.kabupatenName || survey.kabupaten].filter(Boolean).join(" | ") || "-"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{survey.jenisLampu || "N/A"}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{survey.jumlahLampu || "N/A"}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded">
                        {getDisplayLatitude(survey).toFixed(6)}, {getDisplayLongitude(survey).toFixed(6)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {survey.fotoAktual ? (
                        <img
                          src={survey.fotoAktual}
                          alt="Foto Aktual"
                          className="w-14 h-14 object-cover rounded-xl cursor-pointer hover:scale-110 transition-transform shadow-sm border-2 border-white"
                          onClick={() => window.open(survey.fotoAktual, "_blank")}
                        />
                      ) : (
                        <div className="w-14 h-14 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1.5 text-xs font-semibold rounded-full border capitalize ${getStatusBadge(survey.status)}`}>
                        {survey.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleViewMaps(getDisplayLatitude(survey), getDisplayLongitude(survey))}
                          className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all"
                          title="Lihat di Google Maps"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleViewDetail(survey)}
                          className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all"
                          title="Lihat Detail"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(survey.id)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-all"
                          title="Hapus"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            
            {/* Pagination Controls */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-600">
                    <span>Menampilkan {paginatedSurveys.length} dari {totalCount > 0 ? totalItems : "?"} data</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Tampilkan:</label>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
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
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-1 text-sm border rounded ${
                            currentPage === pageNum
                              ? "bg-emerald-500 text-white border-emerald-500"
                              : "bg-white border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || !hasNextPage}
                    className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showDetailModal && selectedSurvey && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => {
            setShowDetailModal(false);
            setShowDetailMap(false);
          }} />
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="relative bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 z-10 bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 rounded-t-3xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Detail Survey Pra Existing</h2>
                    <p className="text-emerald-100 text-sm mt-1">{selectedSurvey.title}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setShowDetailMap(false);
                    }}
                    className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <span className={`px-4 py-2 text-sm font-bold rounded-full border-2 capitalize ${getStatusBadge(selectedSurvey.status)}`}>
                    {selectedSurvey.status}
                  </span>
                  <span className="text-gray-500 text-sm">
                    Divalidasi oleh <span className="font-medium text-gray-700">{selectedSurvey.validatedBy}</span> pada{" "}
                    {formatDate(selectedSurvey.validatedAt)}
                  </span>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    Lokasi Survey
                  </h3>
                  {!showDetailMap ? (
                    <div className="rounded-xl border border-dashed border-emerald-200 bg-white px-4 py-6 text-center">
                      <p className="text-sm text-gray-600">
                        Peta belum dimuat untuk menjaga loading tetap ringan. Klik tombol berikut jika perlu melihat posisi.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowDetailMap(true)}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-700"
                      >
                        Tampilkan Peta
                      </button>
                    </div>
                  ) : (
                    <DynamicDetailMap
                      latitude={getDisplayLatitude(selectedSurvey)}
                      longitude={getDisplayLongitude(selectedSurvey)}
                      accuracy={selectedSurvey.accuracy}
                      title={selectedSurvey.title}
                    />
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-gray-600 font-mono bg-white px-3 py-1.5 rounded-lg border">
                      {getDisplayLatitude(selectedSurvey).toFixed(7)}, {getDisplayLongitude(selectedSurvey).toFixed(7)}
                    </span>
                    <button
                      onClick={() => handleViewMaps(getDisplayLatitude(selectedSurvey), getDisplayLongitude(selectedSurvey))}
                      className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      <span>Buka di Google Maps</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Koordinat Petugas Section */}
                <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                  <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    Koordinat Petugas
                  </h3>
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Latitude</p>
                        <p className="font-mono text-sm font-bold text-gray-900">
                          {getDisplayLatitude(selectedSurvey).toFixed(7)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Longitude</p>
                        <p className="font-mono text-sm font-bold text-gray-900">
                          {getDisplayLongitude(selectedSurvey).toFixed(7)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <p className="text-xs text-blue-700">
                        <strong>Info:</strong> Koordinat GPS saat survey pertama kali oleh petugas di lapangan.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
                    <h3 className="text-lg font-bold text-emerald-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Informasi Surveyor
                    </h3>
                    <div className="space-y-3">
                      <InfoRow label="Nama Surveyor" value={selectedSurvey.surveyorName} />
                      <InfoRow label="Email" value={selectedSurvey.surveyorEmail || "N/A"} />
                      <InfoRow label="Tanggal Survey" value={formatDate(selectedSurvey.createdAt)} />
                    </div>
                  </div>

                  <div className="bg-teal-50 rounded-2xl p-5 border border-teal-100">
                    <h3 className="text-lg font-bold text-teal-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Data Survey
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                      <InfoRow label="Kabupaten" value={selectedSurvey.kabupatenName || selectedSurvey.kabupaten || "N/A"} />
                      <InfoRow label="Kecamatan" value={selectedSurvey.kecamatan || "N/A"} />
                      <InfoRow label="Desa" value={selectedSurvey.desa || "N/A"} />
                      <InfoRow label="Banjar" value={selectedSurvey.banjar || "N/A"} />
                      <InfoRow label="Kepemilikan Tiang" value={selectedSurvey.kepemilikanDisplay || selectedSurvey.kepemilikanTiang || "N/A"} />
                      <InfoRow label="Tipe Tiang PLN" value={selectedSurvey.tipeTiangPLN || "N/A"} />
                      <InfoRow label="Jenis Lampu" value={selectedSurvey.jenisLampu || "N/A"} />
                      <InfoRow label="Jumlah Lampu" value={selectedSurvey.jumlahLampu || "N/A"} />
                      <InfoRow label="Daya Lampu" value={selectedSurvey.dayaLampu || "N/A"} />
                      <InfoRow label="Fungsi Lampu" value={selectedSurvey.fungsiLampu || "N/A"} />
                      <InfoRow label="Jenis Tiang" value={selectedSurvey.jenisTiang || "N/A"} />
                      <InfoRow label="Gardu" value={selectedSurvey.garduStatus || "N/A"} />
                      <InfoRow label="Kode Gardu" value={selectedSurvey.kodeGardu || "N/A"} />
                      <InfoRow label="Keterangan" value={selectedSurvey.keterangan || "N/A"} />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Foto Aktual
                  </h3>
                  {selectedSurvey.fotoAktual ? (
                    <div
                      className="relative w-full max-w-xl aspect-video rounded-2xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-emerald-400 transition-all"
                      onClick={() => window.open(selectedSurvey.fotoAktual, "_blank")}
                    >
                      <img src={selectedSurvey.fotoAktual} alt="Foto Aktual" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center">
                      <span className="text-sm text-gray-500">Tidak ada foto</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 rounded-b-3xl flex justify-end gap-3">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
                >
                  Tutup
                </button>
                <button
                  onClick={() => handleViewMaps(getDisplayLatitude(selectedSurvey), getDisplayLongitude(selectedSurvey))}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  Buka di Maps
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}
