"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { formatWitaDateTime } from "@/utils/dateTime";
import SurveyExistingDetail from "./SurveyExistingDetail";
import SurveyProposeDetail from "./SurveyProposeDetail";
import SurveyPraExistingDetail from "./SurveyPraExistingDetail";
import { formatPanelUpdatedAt, getReadableDataSourceLabel } from "@/utils/panelDataSource";

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
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [dataSource, setDataSource] = useState<string>("Belum ada");
  const [fetchError, setFetchError] = useState("");

  const fetchStatistics = useCallback(async () => {
    try {
      setStatsLoading(true);
      setFetchError("");
      const params = new URLSearchParams({
        includeDetails: "1",
        status: "ditolak",
      });
      if (activeKabupaten) params.set("kabupaten", activeKabupaten);

      const response = await fetch(`/api/admin/gesa-survey?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Gagal memuat data survey ditolak dari Supabase.");
      }
      const payload = await response.json() as {
        source?: string;
        generatedAt?: string;
        existing?: { totalData?: number };
        propose?: { totalData?: number };
        praExisting?: { totalData?: number };
      };

      const existingCount = payload.existing?.totalData || 0;
      const proposeCount = payload.propose?.totalData || 0;
      const praExistingCount = payload.praExisting?.totalData || 0;

      setStats({
        total: existingCount + proposeCount + praExistingCount,
        existing: existingCount,
        propose: proposeCount,
        praExisting: praExistingCount,
      });
      setStatsLoaded(true);
      setDataSource(payload.source || "supabase");
      setLastUpdatedAt(payload.generatedAt ? new Date(payload.generatedAt) : new Date());
    } catch (error) {
      console.error("Error fetching statistics:", error);
      setFetchError(error instanceof Error ? error.message : "Gagal memuat data survey ditolak.");
      setDataSource("Belum ada");
      setLastUpdatedAt(null);
    } finally {
      setStatsLoading(false);
    }
  }, [activeKabupaten]);

  useEffect(() => {
    setStatsLoaded(false);
    setStatsLoading(false);
    setStats({
      total: 0,
      existing: 0,
      propose: 0,
      praExisting: 0,
    });
    setDataSource("Belum ada");
    setLastUpdatedAt(null);
    setFetchError("");
  }, [activeKabupaten]);

  const handleCategoryClick = (category: "existing" | "propose" | "pra-existing") => {
    setSelectedCategory(category);
  };

  const handleExportCsv = async () => {
    try {
      setExportLoading(true);
      const params = new URLSearchParams({
        includeDetails: "1",
        status: "ditolak",
      });
      if (activeKabupaten) params.set("kabupaten", activeKabupaten);

      const response = await fetch(`/api/admin/gesa-survey?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Gagal memuat data survey ditolak dari Supabase.");
      }

      const payload = await response.json() as { allRows?: Survey[] };
      const allRows = Array.isArray(payload.allRows) ? payload.allRows : [];

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
    return formatWitaDateTime(timestamp) || "-";
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
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Sumber Data Panel</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{getReadableDataSourceLabel(dataSource)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Update Terakhir</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{formatPanelUpdatedAt(lastUpdatedAt)}</div>
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          Gagal memuat data panel: {fetchError}
        </div>
      )}

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
