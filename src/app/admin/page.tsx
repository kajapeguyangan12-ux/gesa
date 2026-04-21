"use client";

import { useState, useEffect, useRef } from "react";
import { clearCachedData, fetchWithCache } from "@/utils/firestoreCache";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { KABUPATEN_OPTIONS } from "@/utils/constants";

interface SurveyData {
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
  createdAt?: any;
}

interface FilterState {
  judulLokasi: string;
  petugas: string;
  tanggal: string;
  status: string;
  kabupaten: string;
}

interface SupabaseReportsPayload {
  reports: SurveyData[];
  source: string;
  generatedAt: string;
  lastDataChangeAt: string;
}

async function fetchSurveysFromSupabase(limitValue: number): Promise<SupabaseReportsPayload> {
  const response = await fetch(`/api/admin/reports?limit=${limitValue}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Gagal memuat reports dari Supabase.");
  }

  const payload = (await response.json()) as {
    source?: string;
    generatedAt?: string;
    lastDataChangeAt?: string;
    reports?: SurveyData[];
  };

  return {
    reports: Array.isArray(payload.reports) ? payload.reports : [],
    source: payload.source || "supabase",
    generatedAt: payload.generatedAt || "",
    lastDataChangeAt: payload.lastDataChangeAt || "",
  };
}

function AdminPanelContent() {
  const REPORT_FETCH_LIMIT = 10;
  const REPORTS_CACHE_KEY = "admin_reports_dataset_v3";
  const REPORTS_CACHE_TTL_MS = 15 * 60 * 1000;
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [surveys, setSurveys] = useState<SurveyData[]>([]);
  const [filteredSurveys, setFilteredSurveys] = useState<SurveyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [dataSource, setDataSource] = useState<"supabase" | "firestore">("supabase");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>("");
  const latestReportsFingerprintRef = useRef("");
  const [filters, setFilters] = useState<FilterState>({
    judulLokasi: "",
    petugas: "",
    tanggal: "",
    status: "Semua",
    kabupaten: "Semua",
  });

  // Check if user is admin (allow super-admin)
  useEffect(() => {
    if (user && user.role !== "admin" && user.role !== "super-admin") {
      router.push("/dashboard-pengukuran");
    }
  }, [user, router]);

  // Fetch data from Firebase
  useEffect(() => {
    fetchSurveys();
  }, []);

  // Apply filters on mount and when filters change
  useEffect(() => {
    applyFilters();
  }, [surveys, filters]);

  const fetchSurveysFromSupabaseSource = async () => {
    const payload = await fetchSurveysFromSupabase(REPORT_FETCH_LIMIT);
    setDataSource("supabase");
    setLastUpdatedAt(payload.lastDataChangeAt || payload.generatedAt || new Date().toISOString());
    latestReportsFingerprintRef.current = [payload.lastDataChangeAt || payload.generatedAt || "", payload.reports.length].join("|");
    return payload.reports;
  };

  const fetchSurveys = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setIsRefreshing(true);
        clearCachedData(REPORTS_CACHE_KEY);
      } else {
        setIsLoading(true);
      }
      const surveysData = await fetchWithCache<SurveyData[]>(
        REPORTS_CACHE_KEY,
        async () => await fetchSurveysFromSupabaseSource(),
        REPORTS_CACHE_TTL_MS
      );
      
      setSurveys(surveysData);
      setFilteredSurveys(surveysData);
      setHasLoadedData(true);
    } catch (error) {
      console.error("Error fetching surveys:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const checkReportsChange = async () => {
    try {
      const payload = await fetchSurveysFromSupabase(1);
      const nextFingerprint = [payload.lastDataChangeAt || payload.generatedAt || "", payload.reports.length].join("|");

      if (!latestReportsFingerprintRef.current) {
        latestReportsFingerprintRef.current = nextFingerprint;
        return;
      }

      if (nextFingerprint !== latestReportsFingerprintRef.current) {
        clearCachedData(REPORTS_CACHE_KEY);
        await fetchSurveys(true);
      }
    } catch (error) {
      console.error("Failed to check admin reports changes:", error);
    }
  };

  useEffect(() => {
    if (!hasLoadedData) return;

    const intervalId = window.setInterval(() => {
      void checkReportsChange();
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [hasLoadedData]);

  const applyFilters = () => {
    let filtered = [...surveys];

    // Filter by title or location
    if (filters.judulLokasi.trim()) {
      const searchTerm = filters.judulLokasi.toLowerCase();
      filtered = filtered.filter(
        (survey) =>
          survey.title.toLowerCase().includes(searchTerm) ||
          survey.location.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by officer
    if (filters.petugas.trim()) {
      const searchTerm = filters.petugas.toLowerCase();
      filtered = filtered.filter((survey) =>
        survey.officer.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by date
    if (filters.tanggal) {
      filtered = filtered.filter((survey) => survey.date.includes(filters.tanggal));
    }

    // Filter by status
    if (filters.status !== "Semua" && filters.status !== "semua") {
      filtered = filtered.filter((survey) => survey.status === filters.status);
    }

    // Filter by kabupaten
    if (filters.kabupaten !== "Semua" && filters.kabupaten !== "semua") {
      const target = filters.kabupaten.toLowerCase();
      filtered = filtered.filter((survey) => (survey.kabupaten || "").toLowerCase() === target);
    }

    setFilteredSurveys(filtered);
  };

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setFilters({
      judulLokasi: "",
      petugas: "",
      tanggal: "",
      status: "Semua",
      kabupaten: "Semua",
    });
  };

  const handleSearch = () => {
    applyFilters();
  };

  const handleRefreshData = async () => {
    await fetchSurveys(true);
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Get user display name or email
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Admin';
  const activeSourceLabel = "Supabase";
  const activeTimestamp = lastUpdatedAt;

  const handleDeleteReport = async (reportId: string, title: string) => {
    const ok = window.confirm(`Hapus laporan "${title}"? Tindakan ini tidak bisa dibatalkan.`);
    if (!ok) return;
    try {
      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        let message = "Gagal menghapus laporan.";
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
      setSurveys(prev => prev.filter(s => s.id !== reportId));
      setFilteredSurveys(prev => prev.filter(s => s.id !== reportId));
      clearCachedData(REPORTS_CACHE_KEY);
    } catch (error) {
      console.error("Delete error:", error);
      alert(error instanceof Error ? error.message : "Gagal menghapus laporan.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">{/* Removed sidebar, using simple header instead */}
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo & Title */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin/module-selection')}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="font-medium">Kembali</span>
              </button>
              <div className="border-l border-gray-300 h-8"></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Panel Admin</h1>
                <p className="text-sm text-gray-500">Pilih, kelola, dan ekspor laporan yang tersimpan.</p>
              </div>
            </div>

            {/* User Info */}
            <div className="flex items-center gap-4">
              {/* User Badge */}
              <div className="flex items-center gap-3 px-4 py-2 bg-purple-50 rounded-xl border border-purple-200">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    {displayName.charAt(0).toUpperCase()}
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-purple-600 uppercase">Admin Panel</div>
                  <div className="font-semibold text-gray-900 text-sm">{displayName}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleLogout}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all flex items-center gap-2 shadow-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">{/* Filters Section */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 border border-gray-200">
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm text-blue-900">
              <span className="font-semibold">Sumber aktif: Supabase.</span>{" "}
              Daftar laporan ditampilkan dari Supabase.
              {" "}Jika query utama gagal atau kosong, sistem fallback ke Firestore.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => void handleRefreshData()}
                disabled={isRefreshing || !hasLoadedData}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl transition-all font-semibold"
              >
                <svg className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isRefreshing ? "Memuat Ulang..." : "Refresh Data"}
              </button>
            </div>
          </div>
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Sumber Data Aktif</div>
              <div className="mt-1 text-base font-bold text-emerald-900">{activeSourceLabel}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">Update Terakhir</div>
              <div className="mt-1 text-base font-bold text-slate-900">
                {activeTimestamp ? new Date(activeTimestamp).toLocaleString("id-ID") : "Belum ada"}
              </div>
            </div>
          </div>
          <div className="mb-4 text-xs font-medium text-gray-500">
            Sumber aktif: {dataSource === "supabase" ? "Supabase" : "Firestore langsung"}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">{/* Judul / Lokasi */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Judul / Lokasi
              </label>
              <input
                type="text"
                placeholder="Cari judul atau lokasi..."
                value={filters.judulLokasi}
                onChange={(e) =>
                  handleFilterChange("judulLokasi", e.target.value)
                }
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900 placeholder-gray-400"
              />
            </div>

            {/* Petugas */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Petugas
              </label>
              <input
                type="text"
                placeholder="Cari petugas..."
                value={filters.petugas}
                onChange={(e) => handleFilterChange("petugas", e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900 placeholder-gray-400"
              />
            </div>

            {/* Tanggal */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tanggal
              </label>
              <input
                type="date"
                value={filters.tanggal}
                onChange={(e) => handleFilterChange("tanggal", e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900 bg-white cursor-pointer"
              >
                <option value="Semua">Semua</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Kabupaten */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Kabupaten
              </label>
              <select
                value={filters.kabupaten}
                onChange={(e) => handleFilterChange("kabupaten", e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900 bg-white cursor-pointer"
              >
                <option value="Semua">Semua</option>
                {KABUPATEN_OPTIONS.map((k) => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            </div>

            {/* Buttons */}
            <div className="flex items-end gap-2">
              <button
                onClick={handleSearch}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-semibold"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Cari
              </button>

              <button
                onClick={handleReset}
                className="flex items-center justify-center px-4 py-2.5 border border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50 text-gray-700 rounded-xl transition-all font-semibold"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Survey Cards Grid */}
        {isLoading ? (
              <div className="flex flex-col justify-center items-center py-20">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200"></div>
                  <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-600 absolute top-0 left-0"></div>
                </div>
                <p className="mt-6 text-gray-600 font-medium">Memuat data survey...</p>
              </div>
            ) : filteredSurveys.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-16 text-center border border-gray-200">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  Tidak ada data ditemukan
                </h3>
                <p className="text-gray-500 text-lg mb-6">
                  Belum ada data survey atau filter tidak menghasilkan data
                </p>
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset Filter
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredSurveys.map((survey) => (
                  <div
                    key={survey.id}
                    className="bg-white rounded-2xl border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300 overflow-hidden group cursor-pointer"
                  >
                    {/* Card Header */}
                    <div className="p-5 border-b border-gray-100">
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {survey.title}
                        </h3>
                        {survey.modifiedBy && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-full">
                            <svg className="w-3.5 h-3.5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span className="text-xs font-semibold text-yellow-700">
                              Modified <span className="italic">by {survey.modifiedBy}</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Date & Time */}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        <span className="font-medium">{survey.dateDisplay || survey.date}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">{survey.timeDisplay || survey.time}</span>
                      </div>
                    </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 space-y-3.5">
                      {survey.kabupaten && (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full">
                          <span className="text-xs font-semibold text-blue-700">
                            Kabupaten: {survey.kabupaten}
                          </span>
                        </div>
                      )}
                      {/* Location */}
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 flex-shrink-0 mt-0.5">
                          <svg className="w-full h-full text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <span className="text-gray-700 text-sm font-medium">{survey.location}</span>
                      </div>

                      {/* Officer */}
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 flex-shrink-0">
                          <svg className="w-full h-full text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <span className="text-gray-700 text-sm font-medium">{survey.officer}</span>
                      </div>

                      {/* Watt */}
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 flex-shrink-0">
                          <svg className="w-full h-full text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <span className="text-gray-700 text-sm font-medium">{survey.watt}</span>
                      </div>

                      {/* Meter */}
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 flex-shrink-0">
                          <svg className="w-full h-full text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                          </svg>
                        </div>
                        <span className="text-gray-700 text-sm font-medium">{survey.meter}</span>
                      </div>

                      {/* Voltage */}
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 flex-shrink-0">
                          <svg className="w-full h-full text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <span className="text-gray-700 text-sm font-medium">{survey.voltage}</span>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="px-5 pb-5">
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => router.push(`/admin/reports/${survey.id}`)}
                          className="flex items-center justify-center gap-2 px-3 py-2.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-xl font-semibold text-sm transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Lihat
                        </button>
                        <button
                          onClick={() => router.push(`/admin/reports/${survey.id}/edit`)}
                          className="flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl font-semibold text-sm transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteReport(survey.id, survey.title)}
                          className="flex items-center justify-center gap-2 px-3 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-semibold text-sm transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0H7m2-3h6a1 1 0 011 1v1H8V5a1 1 0 011-1z" />
                          </svg>
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <ProtectedRoute>
      <AdminPanelContent />
    </ProtectedRoute>
  );
}
