"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Image from "next/image";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { KABUPATEN_OPTIONS } from "@/utils/constants";
import { getActiveKabupatenFromStorage, setActiveKabupatenToStorage } from "@/utils/helpers";

function DashboardPengukuranContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [formData, setFormData] = useState({
    namaLampu: "",
    dayaLampu: "",
    teganganAwal: "",
    tinggiTiang: "",
  });
  const [loadingReport, setLoadingReport] = useState(false);
  const [showReportPicker, setShowReportPicker] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsList, setReportsList] = useState<Array<{ id: string; label: string }>>([]);
  const [activeKabupaten, setActiveKabupaten] = useState<string | null>(null);
  const [pendingKabupaten, setPendingKabupaten] = useState<string | null>(null);
  const [showKabupatenPicker, setShowKabupatenPicker] = useState(false);
  const [showKabupatenConfirm, setShowKabupatenConfirm] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    const stored = getActiveKabupatenFromStorage(user?.uid || "");
    if (stored) {
      setActiveKabupaten(stored);
      setShowKabupatenPicker(false);
    } else {
      setActiveKabupaten(null);
      setShowKabupatenPicker(true);
    }
  }, [user?.uid]);

  const activeKabupatenName =
    KABUPATEN_OPTIONS.find((k) => k.id === activeKabupaten)?.name || "-";
  const pendingKabupatenName =
    KABUPATEN_OPTIONS.find((k) => k.id === pendingKabupaten)?.name || "-";

  const handleKabupatenPick = (kabupatenId: string) => {
    if (kabupatenId === activeKabupaten) {
      setShowKabupatenPicker(false);
      return;
    }
    setPendingKabupaten(kabupatenId);
    setShowKabupatenConfirm(true);
  };

  const handleKabupatenConfirm = () => {
    if (!pendingKabupaten) return;
    setActiveKabupaten(pendingKabupaten);
    setActiveKabupatenToStorage(user?.uid || "", pendingKabupaten);
    setPendingKabupaten(null);
    setShowKabupatenConfirm(false);
    setShowKabupatenPicker(false);
  };

  const handleKabupatenCancel = () => {
    setPendingKabupaten(null);
    setShowKabupatenConfirm(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleMulaiSurvei = () => {
    console.log("Mulai Survei Baru:", formData);
    // Navigate to measurement grid with form data
    router.push(`/measurement-grid?namaLampu=${encodeURIComponent(formData.namaLampu)}&dayaLampu=${formData.dayaLampu}&teganganAwal=${formData.teganganAwal}&tinggiTiang=${formData.tinggiTiang}`);
  };

  const buildReportLabel = (data: any) => {
    const title = data?.projectTitle || data?.title || data?.namaLampu || data?.judul || "(untitled)";
    const location = data?.projectLocation || data?.location || data?.lokasi || "";
    const reporter = data?.reporterName || data?.officer || data?.petugas || data?.createdByName || "";
    const date = data?.date || data?.tanggal || "";
    const parts = [title, reporter ? `oleh ${reporter}` : "", location, date].filter(Boolean);
    return parts.join(" | ");
  };

  const handleMuatLaporan = async () => {
    try {
      if (!activeKabupaten) {
        alert("Pilih kabupaten terlebih dahulu.");
        setShowKabupatenPicker(true);
        return;
      }
      setLoadingReport(true);
      setShowReportPicker(true);
      setReportsLoading(true);
      const q = query(
        collection(db, "reports"),
        where("kabupaten", "==", activeKabupaten),
        orderBy("createdAt", "desc"),
        limit(100)
      );
      const snapshot = await getDocs(q);
      let docs = snapshot.docs;
      if (user?.uid) {
        const mine = docs.filter((doc) => doc.data()?.createdById === user.uid);
        if (mine.length > 0) docs = mine;
      }
      const list = docs.map((doc) => ({
        id: doc.id,
        label: buildReportLabel(doc.data()),
      }));
      setReportsList(list);
    } catch (err) {
      console.error("Gagal memuat laporan:", err);
      alert("Gagal memuat laporan. Silakan coba lagi.");
    } finally {
      setLoadingReport(false);
      setReportsLoading(false);
    }
  };

  const isFormValid = formData.namaLampu && formData.dayaLampu && formData.teganganAwal && formData.tinggiTiang;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Header with Logo */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 sm:w-12 sm:h-12">
                <Image
                  src="/BDG1.png"
                  alt="Logo BGD"
                  fill
                  className="object-contain"
                />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-gray-900">
                  Survey Cahaya
                </h1>
                <p className="text-xs text-gray-500">Dashboard Pengukuran</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                    Kabupaten aktif: {activeKabupatenName}
                  </span>
                  <button
                    onClick={() => setShowKabupatenPicker(true)}
                    className="text-[11px] font-semibold text-gray-700 hover:text-blue-700 border border-gray-200 hover:border-blue-200 bg-white px-2 py-0.5 rounded-full transition-all"
                  >
                    Ganti kabupaten
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push("/module-selection")}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all duration-200 active:scale-95 touch-manipulation"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline">Kembali</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
        {/* Main Card */}
        <div 
          className={`bg-white rounded-2xl sm:rounded-3xl shadow-xl p-5 sm:p-8 md:p-10 border border-gray-100 transition-all duration-1000 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          {/* Header with Icon */}
          <div className="flex items-start gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="text-2xl sm:text-3xl">💡</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
                Dashboard Pengukuran
              </h2>
              <p className="text-gray-500 mt-1 text-sm sm:text-base">
                Isi detail untuk memulai atau muat sesi terakhir.
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-5 sm:space-y-6">
            {/* Nama Lampu */}
            <div className="space-y-2">
              <label className="block text-sm sm:text-base font-bold text-gray-900">
                Nama Lampu
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Masukkan Nama Lampu"
                  value={formData.namaLampu}
                  onChange={(e) => handleInputChange("namaLampu", e.target.value)}
                  className="w-full pl-12 pr-4 py-3 sm:py-4 border-2 border-gray-200 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition-all text-gray-900 placeholder-gray-400 text-sm sm:text-base font-medium bg-gray-50 focus:bg-white touch-manipulation"
                />
              </div>
            </div>

            {/* Daya Lampu & Tegangan Awal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              {/* Daya Lampu */}
              <div className="space-y-2">
                <label className="block text-sm sm:text-base font-bold text-gray-900">
                  Daya Lampu
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <input
                    type="number"
                    placeholder="Contoh: 55"
                    value={formData.dayaLampu}
                    onChange={(e) => handleInputChange("dayaLampu", e.target.value)}
                    className="w-full pl-12 pr-12 py-3 sm:py-4 border-2 border-gray-200 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition-all text-gray-900 placeholder-gray-400 text-sm sm:text-base font-medium bg-gray-50 focus:bg-white touch-manipulation"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-base sm:text-lg">
                    W
                  </span>
                </div>
              </div>

              {/* Tegangan Awal */}
              <div className="space-y-2">
                <label className="block text-sm sm:text-base font-bold text-gray-900">
                  Tegangan Awal
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  </div>
                  <input
                    type="number"
                    placeholder="Contoh: 220"
                    value={formData.teganganAwal}
                    onChange={(e) => handleInputChange("teganganAwal", e.target.value)}
                    className="w-full pl-12 pr-12 py-3 sm:py-4 border-2 border-gray-200 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition-all text-gray-900 placeholder-gray-400 text-sm sm:text-base font-medium bg-gray-50 focus:bg-white touch-manipulation"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-base sm:text-lg">
                    V
                  </span>
                </div>
              </div>
            </div>

            {/* Tinggi Tiang */}
            <div className="space-y-2">
              <label className="block text-sm sm:text-base font-bold text-gray-900">
                Tinggi Tiang
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
                <select
                  value={formData.tinggiTiang}
                  onChange={(e) => handleInputChange("tinggiTiang", e.target.value)}
                  className="w-full pl-12 pr-12 py-3 sm:py-4 border-2 border-gray-200 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition-all text-gray-900 appearance-none bg-gray-50 focus:bg-white cursor-pointer text-sm sm:text-base font-medium touch-manipulation"
                >
                  <option value="" disabled>Pilih Tinggi Tiang...</option>
                  <option value="5">5 Meter</option>
                  <option value="6">6 Meter</option>
                  <option value="7">7 Meter</option>
                  <option value="8">8 Meter</option>
                  <option value="9">9 Meter</option>
                  <option value="9.5">9.5 Meter</option>
                  <option value="10">10 Meter</option>
                </select>
                <svg className="w-5 h-5 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 sm:space-y-4 pt-4 sm:pt-6">
              {/* Mulai Survei Baru */}
              <button
                onClick={handleMulaiSurvei}
                disabled={!isFormValid}
                className={`group w-full py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base transition-all duration-300 shadow-lg touch-manipulation relative overflow-hidden ${
                  isFormValid
                    ? "bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 text-white hover:shadow-2xl active:scale-95"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  Mulai Survei Baru
                </span>
                {isFormValid && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 transform -translate-x-full group-hover:translate-x-full transition-all duration-1000"></div>
                )}
              </button>

              {/* Muat Laporan Petugas */}
              <button
                onClick={handleMuatLaporan}
                disabled={loadingReport}
                className={`group w-full py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base transition-all duration-300 shadow-lg active:scale-95 touch-manipulation relative overflow-hidden ${
                  loadingReport
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 hover:from-amber-500 hover:via-yellow-600 hover:to-amber-600 text-gray-900 hover:shadow-2xl"
                }`}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {loadingReport ? "Memuat..." : "Muat Laporan Petugas"}
                </span>
                {!loadingReport && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-30 transform -translate-x-full group-hover:translate-x-full transition-all duration-1000"></div>
                )}
              </button>
            </div>
          </div>

          {/* Info Tips - Enhanced Design */}
          <div className="mt-6 sm:mt-8 p-4 sm:p-5 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl sm:rounded-2xl border-2 border-blue-100 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 sm:w-7 sm:h-7 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1 text-xs sm:text-sm">
                <p className="font-bold text-gray-900 mb-2">Tips Pengisian:</p>
                <ul className="space-y-1.5 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold flex-shrink-0">•</span>
                    <span>Pastikan semua data terisi dengan benar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold flex-shrink-0">•</span>
                    <span>Gunakan "Muat Laporan" untuk melanjutkan survey sebelumnya</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold flex-shrink-0">•</span>
                    <span>Data akan tersimpan otomatis setiap perubahan</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      {showKabupatenPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Pilih Kabupaten</h3>
              <p className="text-sm text-gray-600">Pilih lokasi kerja agar data terfokus dan tidak tercampur.</p>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {KABUPATEN_OPTIONS.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => handleKabupatenPick(k.id)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      activeKabupaten === k.id
                        ? "border-blue-400 bg-blue-50 shadow-sm"
                        : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/40"
                    }`}
                  >
                    <div className="text-base font-bold text-gray-900">{k.name}</div>
                    <div className="text-xs text-gray-600 mt-1">{k.description}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex items-center justify-end">
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
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
              >
                Mulai
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportPicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Pilih Laporan Petugas</h3>
                <p className="text-xs text-gray-500">Pilih satu laporan untuk dibuka di admin</p>
              </div>
              <button onClick={() => setShowReportPicker(false)} className="w-9 h-9 rounded-lg hover:bg-gray-100">
                <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-2">
              {reportsLoading ? (
                <div className="text-sm text-gray-500">Memuat daftar laporan...</div>
              ) : reportsList.length === 0 ? (
                <div className="text-sm text-gray-500">Belum ada laporan yang bisa dipilih.</div>
              ) : (
                reportsList.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => router.push(`/admin/reports/${r.id}/edit`)}
                    className="w-full text-left px-3 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all"
                  >
                    <div className="text-sm font-semibold text-gray-900 truncate">{r.label}</div>
                    <div className="text-xs text-gray-500">ID: {r.id}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPengukuran() {
  return (
    <ProtectedRoute>
      <DashboardPengukuranContent />
    </ProtectedRoute>
  );
}
