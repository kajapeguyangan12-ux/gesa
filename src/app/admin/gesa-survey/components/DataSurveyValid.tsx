"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
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
  verifiedAt?: { toDate?: () => Date } | Date | string | number | null;
  validatedAt?: { toDate?: () => Date } | Date | string | number | null;
  taskId?: string;
  taskTitle?: string;
  kabupaten?: string;
  kecamatan?: string;
  desa?: string;
  banjar?: string;
}

export default function DataSurveyValid({ activeKabupaten }: { activeKabupaten?: string | null }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super-admin";
  const targetStatus = isSuperAdmin ? "tervalidasi" : "diverifikasi";
  const pageTitle = isSuperAdmin ? "Data Survey Valid" : "Data Survey Terverifikasi";
  const pageDescription = isSuperAdmin
    ? "Akses data survey yang telah tervalidasi berdasarkan kategori dan zona"
    : "Akses data survey yang telah diverifikasi berdasarkan kategori dan zona";
  const [selectedCategory, setSelectedCategory] = useState<"existing" | "propose" | "pra-existing" | null>(null);
  const [selectedSurveyor, setSelectedSurveyor] = useState("Semua Petugas");
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    existing: 0,
    propose: 0,
    praExisting: 0,
  });
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [fullDataLoaded, setFullDataLoaded] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [dataSource, setDataSource] = useState<string>("supabase");

  const fetchStatistics = useCallback(async () => {
    try {
      setStatsLoading(true);
      const params = new URLSearchParams({
        includeDetails: "1",
        status: targetStatus,
      });
      if (activeKabupaten) params.set("kabupaten", activeKabupaten);

      const response = await fetch(`/api/admin/gesa-survey?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Gagal memuat data valid dari Supabase.");
      }

      const payload = await response.json() as {
        source?: string;
        generatedAt?: string;
        existing?: { totalData?: number };
        propose?: { totalData?: number };
        praExisting?: { totalData?: number };
        allRows?: Survey[];
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
      setFullDataLoaded(true);
      setSurveys(Array.isArray(payload.allRows) ? payload.allRows : []);
      setDataSource(payload.source || "supabase");
      setLastUpdatedAt(payload.generatedAt ? new Date(payload.generatedAt) : new Date());
    } catch (error) {
      console.error("Error fetching statistics:", error);
    } finally {
      setStatsLoading(false);
    }
  }, [activeKabupaten, targetStatus]);

  useEffect(() => {
    setStatsLoaded(false);
    setFullDataLoaded(false);
    setStats({
      total: 0,
      existing: 0,
      propose: 0,
      praExisting: 0,
    });
    setSurveys([]);
    setSelectedSurveyor("Semua Petugas");
    setDataSource("supabase");
    setLastUpdatedAt(null);
  }, [activeKabupaten, targetStatus]);

  const surveyorOptions = useMemo(
    () => ["Semua Petugas", ...new Set(surveys.map((survey) => survey.surveyorName).filter(Boolean))],
    [surveys]
  );

  const recapSurveys = useMemo(() => {
    if (selectedSurveyor === "Semua Petugas") return surveys;
    return surveys.filter((survey) => survey.surveyorName === selectedSurveyor);
  }, [selectedSurveyor, surveys]);

  const recapStats = useMemo(
    () => ({
      total: recapSurveys.length,
      existing: recapSurveys.filter((survey) => survey.type === "existing").length,
      propose: recapSurveys.filter((survey) => survey.type === "propose").length,
      praExisting: recapSurveys.filter((survey) => survey.type === "pra-existing").length,
    }),
    [recapSurveys]
  );

  const taskRecap = useMemo(() => {
    const taskMap = new Map<string, { label: string; count: number }>();

    recapSurveys.forEach((survey) => {
      const taskKey = survey.taskId || survey.taskTitle || "tanpa-tugas";
      const taskLabel = survey.taskTitle || survey.taskId || "Tanpa Tugas";
      const current = taskMap.get(taskKey);
      if (current) {
        current.count += 1;
        return;
      }
      taskMap.set(taskKey, { label: taskLabel, count: 1 });
    });

    return Array.from(taskMap.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [recapSurveys]);

  const handleCategoryClick = (category: "existing" | "propose" | "pra-existing") => {
    setSelectedCategory(category);
  };

  const handleExportCsv = () => {
    const headers = ["No", "Judul", "Tipe", "Status", "Surveyor", "Kabupaten", "Kecamatan", "Desa", "Banjar", "Tanggal Verifikasi"];
    if (isSuperAdmin) {
      headers.push("Tanggal Validasi");
    }

    const rows = surveys.map((survey, index) => {
      const row = [
        index + 1,
        survey.title,
        survey.type,
        survey.status,
        survey.surveyorName,
        survey.kabupaten || "-",
        survey.kecamatan || "-",
        survey.desa || "-",
        survey.banjar || "-",
        formatDate(survey.verifiedAt || survey.createdAt),
      ];

      if (isSuperAdmin) {
        row.push(formatDate(survey.validatedAt));
      }

      return row;
    });
    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${isSuperAdmin ? "data-survey-valid" : "data-survey-terverifikasi"}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const formatDate = (timestamp: Survey["createdAt"] | Survey["verifiedAt"] | Survey["validatedAt"]) => {
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
    return <SurveyExistingDetail onBack={() => setSelectedCategory(null)} statusFilter={targetStatus} activeKabupaten={activeKabupaten} />;
  }

  if (selectedCategory === "propose") {
    return <SurveyProposeDetail onBack={() => setSelectedCategory(null)} statusFilter={targetStatus} activeKabupaten={activeKabupaten} />;
  }

  if (selectedCategory === "pra-existing") {
    return <SurveyPraExistingDetail onBack={() => setSelectedCategory(null)} statusFilter={targetStatus} activeKabupaten={activeKabupaten} />;
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{pageTitle}</h1>
              <p className="text-sm text-gray-600 mt-1">Kelola dan pantau aktivitas survey</p>
            </div>
          </div>
          <button 
            onClick={handleExportCsv}
            disabled={!fullDataLoaded || surveys.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-green-300 disabled:to-green-400 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 disabled:transform-none"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Ekspor Semua (CSV)
          </button>
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

      {/* Page Description */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-2">{pageTitle}</h2>
        <p className="text-gray-600 text-sm">{pageDescription}</p>
      </div>

      {isSuperAdmin && (
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Rekap Titik Valid per Petugas</h2>
              <p className="text-sm text-gray-600">
                Alat bantu untuk melihat jumlah titik yang sudah tervalidasi per petugas dan per tugas. Rekap baru dihitung saat diminta.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto lg:items-end">
              <div className="w-full lg:w-72">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Filter Petugas</label>
                <select
                  value={selectedSurveyor}
                  onChange={(event) => setSelectedSurveyor(event.target.value)}
                  disabled={!fullDataLoaded}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  {surveyorOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => void fetchStatistics()}
                disabled={statsLoading}
                className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors"
              >
                {statsLoading ? "Menghitung..." : statsLoaded ? "Hitung Ulang Rekap" : "Hitung Rekap"}
              </button>
            </div>
          </div>

          {!fullDataLoaded ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
              <p className="text-base font-semibold text-gray-900 mb-1">Rekap detail belum dimuat</p>
              <p className="text-sm text-gray-600">Klik `Hitung Rekap` untuk memuat data petugas dan jumlah titik per tugas.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm font-medium text-blue-900 mb-1">Total Titik Valid</p>
                  <h3 className="text-3xl font-bold text-blue-700">{recapStats.total}</h3>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-medium text-emerald-900 mb-1">Survey Existing</p>
                  <h3 className="text-3xl font-bold text-emerald-700">{recapStats.existing}</h3>
                </div>
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <p className="text-sm font-medium text-green-900 mb-1">Survey APJ Propose</p>
                  <h3 className="text-3xl font-bold text-green-700">{recapStats.propose}</h3>
                </div>
                <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
                  <p className="text-sm font-medium text-teal-900 mb-1">Survey Pra Existing</p>
                  <h3 className="text-3xl font-bold text-teal-700">{recapStats.praExisting}</h3>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900">Jumlah Titik per Tugas</h3>
                  <p className="text-sm text-gray-600">
                    {selectedSurveyor === "Semua Petugas"
                      ? "Menampilkan akumulasi semua petugas."
                      : `Menampilkan tugas untuk ${selectedSurveyor}.`}
                  </p>
                </div>
                {taskRecap.length === 0 ? (
                  <div className="px-5 py-8 text-sm text-gray-500">Belum ada titik valid untuk filter yang dipilih.</div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {taskRecap.map((task, index) => (
                      <div key={`${task.label}-${index}`} className="px-5 py-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-gray-900">{task.label}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-700">{task.count}</p>
                          <p className="text-xs text-gray-500">titik valid</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Survey Category Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Survey Existing Card */}
        <div className="group bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-200 overflow-hidden cursor-pointer">
          <div className="p-8">
            <div className="flex flex-col items-center text-center">
              {/* Icon */}
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Survey Existing</h3>
              
              {/* Description */}
              <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                {isSuperAdmin ? "Data Survey Existing yang telah tervalidasi" : "Data Survey Existing yang telah diverifikasi"}
              </p>

              {/* Button */}
              <button 
                onClick={() => handleCategoryClick("existing")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg group-hover:gap-3"
              >
                Klik untuk melihat data
                <svg className="w-5 h-5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Survey Tiang APJ Propose Card */}
        <div className="group bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-200 overflow-hidden cursor-pointer">
          <div className="p-8">
            <div className="flex flex-col items-center text-center">
              {/* Icon */}
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Survey Tiang APJ Propose</h3>
              
              {/* Description */}
              <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                {isSuperAdmin ? "Data Survey Tiang APJ Propose yang telah tervalidasi" : "Data Survey Tiang APJ Propose yang telah diverifikasi"}
              </p>

              {/* Button */}
              <button 
                onClick={() => handleCategoryClick("propose")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg group-hover:gap-3"
              >
                Klik untuk melihat data
                <svg className="w-5 h-5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Survey Pra Existing Card */}
        <div className="group bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-200 overflow-hidden cursor-pointer">
          <div className="p-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-3">Survey Pra Existing</h3>
              <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                {isSuperAdmin ? "Data Survey Pra Existing yang telah tervalidasi" : "Data Survey Pra Existing yang telah diverifikasi"}
              </p>
              <button
                onClick={() => handleCategoryClick("pra-existing")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg group-hover:gap-3"
              >
                Klik untuk melihat data
                <svg className="w-5 h-5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Information Box */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-xl p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-bold text-gray-900 mb-3">Informasi Kategori Survey</h4>
            <div className="space-y-2 text-sm text-gray-700">
              <p className="flex items-start gap-2">
                <span className="font-semibold text-blue-700 min-w-[180px]">Survey Existing:</span>
                <span>Survey yang berkaitan dengan data existing yang sudah ada</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-semibold text-green-700 min-w-[180px]">Survey Tiang APJ Propose:</span>
                <span>Survey tiang APJ untuk usulan atau rencana baru</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-semibold text-emerald-700 min-w-[180px]">Survey Pra Existing:</span>
                <span>Survey pra existing sederhana untuk pendataan awal</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Section */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Ringkasan Hitungan</h3>
          <p className="text-sm text-gray-600">Hitungan kartu hanya dijalankan saat tombol ditekan.</p>
        </div>
        <button
          onClick={() => void fetchStatistics()}
          disabled={statsLoading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors"
        >
          {statsLoading ? "Menghitung..." : statsLoaded ? (isSuperAdmin ? "Hitung Ulang Semua" : "Hitung Ulang") : (isSuperAdmin ? "Hitung Kartu & Rekap" : "Hitung")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Survey Valid</p>
              <h3 className="text-2xl font-bold text-gray-900">{statsLoaded ? stats.total : "-"}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Survey Existing</p>
              <h3 className="text-2xl font-bold text-gray-900">{statsLoaded ? stats.existing : "-"}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Survey APJ Propose</p>
              <h3 className="text-2xl font-bold text-gray-900">{statsLoaded ? stats.propose : "-"}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Survey Pra Existing</p>
              <h3 className="text-2xl font-bold text-gray-900">{statsLoaded ? stats.praExisting : "-"}</h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
