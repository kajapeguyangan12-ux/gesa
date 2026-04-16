"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchWithCache } from "@/utils/firestoreCache";
import { useAuth } from "@/hooks/useAuth";
import { KABUPATEN_OPTIONS } from "@/utils/constants";
import SurveyExistingDetail from "./SurveyExistingDetail";
import SurveyProposeDetail from "./SurveyProposeDetail";
import SurveyPraExistingDetail from "./SurveyPraExistingDetail";

interface Survey {
  id: string;
  title: string;
  type: string;
  status: string;
  surveyorName: string;
  createdAt: { toDate?: () => Date } | Date | string | number | null;
  kabupaten?: string;
  kecamatan?: string;
  desa?: string;
  banjar?: string;
}

interface DashboardSummaryDocument {
  propose?: { totalDitolak?: number };
  existing?: { totalDitolak?: number };
  praExisting?: { totalDitolak?: number };
}

export default function DataSurveyTolak({ activeKabupaten }: { activeKabupaten?: string | null }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super-admin";
  const pageTitle = isSuperAdmin ? "Data Survey Valid (TOLAK)" : "Data Survey Terverifikasi (TOLAK)";
  const pageDescription = isSuperAdmin
    ? "Data survey yang ditolak pada tahap validasi data"
    : "Data survey yang ditolak pada tahap verifikasi";
  const [selectedCategory, setSelectedCategory] = useState<"existing" | "propose" | "pra-existing" | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    existing: 0,
    propose: 0,
    praExisting: 0,
  });
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const activeKabupatenName = useMemo(
    () => KABUPATEN_OPTIONS.find((option) => option.id === activeKabupaten)?.name || null,
    [activeKabupaten]
  );

  const mapSurveyDoc = useCallback((docSnap: QueryDocumentSnapshot, type: Survey["type"]) => {
    const data = docSnap.data();

    return {
      id: docSnap.id,
      title:
        data.title ||
        (type === "existing"
          ? `Survey Existing - ${data.namaJalan || "Untitled"}`
          : type === "propose"
            ? `Survey APJ Propose - ${data.namaJalan || "Untitled"}`
            : `Survey Pra Existing - ${data.jenisLampu || "Untitled"}`),
      type,
      status: data.status || "ditolak",
      surveyorName: data.surveyorName || "Unknown",
      createdAt: data.createdAt,
      kabupaten: data.kabupatenName || data.kabupaten || "",
      kecamatan: data.kecamatan || "",
      desa: data.desa || "",
      banjar: data.banjar || "",
    } as Survey;
  }, []);

  const fetchCollectionRows = useCallback(
    async (collectionName: string, type: Survey["type"]) => {
      const collectionRef = collection(db, collectionName);
      const docMap = new Map<string, Survey>();

      const candidateQueries = activeKabupaten
        ? [
            query(collectionRef, where("kabupaten", "==", activeKabupaten), where("status", "==", "ditolak")),
            ...(activeKabupatenName
              ? [query(collectionRef, where("kabupatenName", "==", activeKabupatenName), where("status", "==", "ditolak"))]
              : []),
          ]
        : [query(collectionRef, where("status", "==", "ditolak"))];

      const snapshots = await Promise.allSettled(candidateQueries.map((candidateQuery) => getDocs(candidateQuery)));

      snapshots.forEach((result) => {
        if (result.status !== "fulfilled") {
          return;
        }

        result.value.docs.forEach((docSnap) => {
          if (!docMap.has(docSnap.id)) {
            docMap.set(docSnap.id, mapSurveyDoc(docSnap, type));
          }
        });
      });

      return Array.from(docMap.values());
    },
    [activeKabupaten, activeKabupatenName, mapSurveyDoc]
  );

  const hydrateStatsFromSummary = useCallback(async () => {
    if (!isSuperAdmin) return;

    try {
      const summaryDocId = `gesa-survey_${activeKabupaten || "all"}_super`;
      const summary = await fetchWithCache<DashboardSummaryDocument | null>(
        `dashboard_summary_${summaryDocId}`,
        async () => {
          const snapshot = await getDoc(doc(db, "dashboard-summaries", summaryDocId));
          return snapshot.exists() ? (snapshot.data() as DashboardSummaryDocument) : null;
        },
        10 * 60_000
      );

      if (!summary) return;

      const existing = summary.existing?.totalDitolak || 0;
      const propose = summary.propose?.totalDitolak || 0;
      const praExisting = summary.praExisting?.totalDitolak || 0;

      setStats({
        total: existing + propose + praExisting,
        existing,
        propose,
        praExisting,
      });
      setStatsLoaded(true);
    } catch (error) {
      console.error("Error hydrating rejected survey stats from summary:", error);
    }
  }, [activeKabupaten, isSuperAdmin]);

  const fetchStatistics = useCallback(async () => {
    try {
      setStatsLoading(true);
      const [existingRows, proposeRows, praExistingRows] = await Promise.all([
        fetchCollectionRows("survey-existing", "existing"),
        fetchCollectionRows("survey-apj-propose", "propose"),
        fetchCollectionRows("survey-pra-existing", "pra-existing"),
      ]);

      const existingCount = existingRows.length;
      const proposeCount = proposeRows.length;
      const praExistingCount = praExistingRows.length;

      setStats({
        total: existingCount + proposeCount + praExistingCount,
        existing: existingCount,
        propose: proposeCount,
        praExisting: praExistingCount,
      });
      setStatsLoaded(true);
    } catch (error) {
      console.error("Error fetching statistics:", error);
    } finally {
      setStatsLoading(false);
    }
  }, [fetchCollectionRows]);

  useEffect(() => {
    setStatsLoaded(false);
    setStatsLoading(false);
    setStats({
      total: 0,
      existing: 0,
      propose: 0,
      praExisting: 0,
    });
  }, [activeKabupaten]);

  useEffect(() => {
    void hydrateStatsFromSummary();
  }, [hydrateStatsFromSummary]);

  const handleCategoryClick = (category: "existing" | "propose" | "pra-existing") => {
    setSelectedCategory(category);
  };

  const handleExportCsv = async () => {
    try {
      setExportLoading(true);
      const [existingRows, proposeRows, praExistingRows] = await Promise.all([
        fetchCollectionRows("survey-existing", "existing"),
        fetchCollectionRows("survey-apj-propose", "propose"),
        fetchCollectionRows("survey-pra-existing", "pra-existing"),
      ]);
      const allRows = [...existingRows, ...proposeRows, ...praExistingRows];

      if (allRows.length === 0) {
        alert("Tidak ada data survey ditolak untuk diekspor.");
        return;
      }

    const headers = ["No", "Judul", "Tipe", "Status", "Surveyor", "Kabupaten", "Kecamatan", "Desa", "Banjar", "Tanggal"];
      const rows = allRows.map((survey, index) => [
      index + 1,
      survey.title,
      survey.type,
      survey.status,
      survey.surveyorName,
      survey.kabupaten || "-",
      survey.kecamatan || "-",
      survey.desa || "-",
      survey.banjar || "-",
      formatDate(survey.createdAt),
    ]);
      const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `data-survey-tolak-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
    } finally {
      setExportLoading(false);
    }
  };

  const formatDate = (timestamp: Survey["createdAt"]) => {
    if (!timestamp) return "-";
    if (typeof timestamp === "object" && timestamp !== null && "toDate" in timestamp && typeof timestamp.toDate === "function") {
      return timestamp.toDate().toLocaleString("id-ID");
    }
    if (typeof timestamp !== "string" && typeof timestamp !== "number" && !(timestamp instanceof Date)) {
      return "-";
    }
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("id-ID");
  };

  // Render detail view jika kategori dipilih
  if (selectedCategory === "existing") {
    return <SurveyExistingDetail onBack={() => setSelectedCategory(null)} statusFilter="ditolak" activeKabupaten={activeKabupaten} />;
  }

  if (selectedCategory === "propose") {
    return <SurveyProposeDetail onBack={() => setSelectedCategory(null)} statusFilter="ditolak" activeKabupaten={activeKabupaten} />;
  }

  if (selectedCategory === "pra-existing") {
    return <SurveyPraExistingDetail onBack={() => setSelectedCategory(null)} statusFilter="ditolak" activeKabupaten={activeKabupaten} />;
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{pageTitle}</h1>
              <p className="text-sm text-gray-600 mt-1">{pageDescription}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <button
              onClick={() => void fetchStatistics()}
              disabled={statsLoading}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-blue-300 disabled:to-blue-400 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 disabled:transform-none"
            >
              <svg className={`w-5 h-5 ${statsLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {statsLoading ? "Menghitung..." : statsLoaded ? "Hitung Ulang" : "Hitung Data"}
            </button>
            <button 
              onClick={() => void handleExportCsv()}
              disabled={!statsLoaded || exportLoading}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-green-300 disabled:to-green-400 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 disabled:transform-none"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {exportLoading ? "Menyiapkan CSV..." : "Export CSV"}
            </button>
          </div>
        </div>
      </div>

      {!statsLoaded && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
          <p className="text-sm font-semibold text-blue-900">Data belum dihitung</p>
          <p className="text-sm text-blue-700 mt-1">
            Klik tombol `Hitung Data` untuk memuat jumlah survey ditolak sesuai kabupaten aktif.
          </p>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div 
          className="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-6 border border-red-200 cursor-pointer hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
          onClick={() => {}}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <h3 className="text-4xl font-bold text-red-600 mb-2">{stats.total}</h3>
          <p className="text-sm font-semibold text-red-900">Total Survey Ditolak</p>
          <p className="text-xs text-red-700 mt-1">Semua kategori</p>
        </div>

        <div 
          onClick={() => handleCategoryClick("existing")}
          className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 border border-orange-200 cursor-pointer hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <h3 className="text-4xl font-bold text-orange-600 mb-2">{stats.existing}</h3>
          <p className="text-sm font-semibold text-orange-900">Survey Existing</p>
          <p className="text-xs text-orange-700 mt-1">Klik untuk melihat detail</p>
        </div>

        <div 
          onClick={() => handleCategoryClick("propose")}
          className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 border border-purple-200 cursor-pointer hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <h3 className="text-4xl font-bold text-purple-600 mb-2">{stats.propose}</h3>
          <p className="text-sm font-semibold text-purple-900">Survey APJ Propose</p>
          <p className="text-xs text-purple-700 mt-1">Klik untuk melihat detail</p>
        </div>

        <div 
          onClick={() => handleCategoryClick("pra-existing")}
          className="bg-gradient-to-br from-emerald-50 to-teal-100 rounded-2xl p-6 border border-emerald-200 cursor-pointer hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <h3 className="text-4xl font-bold text-emerald-600 mb-2">{stats.praExisting}</h3>
          <p className="text-sm font-semibold text-emerald-900">Survey Pra Existing</p>
          <p className="text-xs text-emerald-700 mt-1">Klik untuk melihat detail</p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 mb-1">Tentang Data Survey Ditolak</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              {isSuperAdmin
                ? "Halaman ini menampilkan data survey yang telah ditolak pada tahap validasi data. Data ini dapat digunakan untuk review dan analisis lebih lanjut."
                : "Halaman ini menampilkan data survey yang telah ditolak pada tahap verifikasi. Data ini dapat digunakan untuk review dan analisis lebih lanjut."}{" "}
              Klik pada kategori yang diinginkan untuk melihat detail lengkap survey yang ditolak.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
