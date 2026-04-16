"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardContent from "./components/DashboardContent";
import DistribusiTugas from "./components/DistribusiTugas";
import ValidasiSurvey from "./components/ValidasiSurvey";
import DataSurveyValid from "./components/DataSurveyValid";
import DataSurveyTolak from "./components/DataSurveyTolak";
import MapsValidasi from "./components/MapsValidasi";
import DataSurveyValidasi from "./components/DataSurveyValidasi";
import TrackingHistory from "./components/TrackingHistory";
import { KABUPATEN_OPTIONS } from "@/utils/constants";
import { getActiveKabupatenFromStorage, setActiveKabupatenToStorage } from "@/utils/helpers";

function GesaSurveyContent() {
  const { user } = useAuth();
  const router = useRouter();
  const isSuperAdmin = user?.role === "super-admin";
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [visitedMenus, setVisitedMenus] = useState<string[]>(["dashboard"]);
  const [activeKabupaten, setActiveKabupaten] = useState<string | null>(null);
  const [pendingKabupaten, setPendingKabupaten] = useState<string | null>(null);
  const [showKabupatenPicker, setShowKabupatenPicker] = useState(false);
  const [showKabupatenConfirm, setShowKabupatenConfirm] = useState(false);

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

  useEffect(() => {
    setVisitedMenus((current) =>
      current.includes(activeMenu) ? current : [...current, activeMenu]
    );
  }, [activeMenu]);

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

  const primaryReviewLabel = "Verifikasi";
  const secondaryReviewLabel = "Validasi Data";
  const validatedDataLabel = isSuperAdmin ? "Data Survey Valid" : "Data Survey Terverifikasi";
  const rejectedDataLabel = isSuperAdmin ? "Data Survey Valid (TOLAK)" : "Data Survey Terverifikasi (TOLAK)";
  const validatedMapLabel = isSuperAdmin ? "Maps Valid" : "Maps Terverifikasi";

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "distribusi-tugas", label: "Distribusi Tugas", icon: "📋" },
    { id: "validasi-survey", label: primaryReviewLabel, icon: "✓" },
    { id: "data-survey-valid", label: validatedDataLabel, icon: "📁" },
    { id: "data-survey-tolak", label: rejectedDataLabel, icon: "❌" },
    { id: "data-survey-validasi", label: secondaryReviewLabel, icon: "🔍", superAdminOnly: true },
    { id: "maps-validasi", label: validatedMapLabel, icon: "🗺️" },
    { id: "tracking-history", label: "Tracking History", icon: "📍" },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar - Hidden on mobile */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Admin Panel</h3>
              <p className="text-xs text-gray-500">Survey Management</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            {menuItems.map((item) => {
              // Check if super admin only menu
              const isSuperAdminMenu = item.superAdminOnly;
              // Hide super admin menu if not authorized
              if (isSuperAdminMenu && !isSuperAdmin) {
                return null;
              }
              
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveMenu(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${
                    activeMenu === item.id
                      ? "bg-green-50 text-green-700 border-l-4 border-green-600"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => router.push("/admin/module-selection")}
            className="w-full flex items-center gap-2 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-all text-sm font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Kembali</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile Header */}
        <div className="lg:hidden sticky top-0 bg-white border-b border-gray-200 p-4 z-40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Admin Panel</h3>
                <p className="text-xs text-gray-500">GESA Survey</p>
              </div>
            </div>
            <button
              onClick={() => router.push("/admin/module-selection")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-all"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className="lg:hidden bg-white border-b border-gray-200 overflow-x-auto">
          <div className="flex gap-2 p-4 min-w-max">
            {menuItems.map((item) => {
              // Check if super admin only menu
              const isSuperAdminMenu = item.superAdminOnly;
              // Hide super admin menu if not authorized
              if (isSuperAdminMenu && !isSuperAdmin) {
                return null;
              }
              
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveMenu(item.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-all ${
                    activeMenu === item.id
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 lg:p-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
                Kabupaten aktif: {activeKabupatenName}
              </span>
              <span className="text-xs text-gray-500">Data hanya tampil sesuai kabupaten terpilih.</span>
            </div>
            <button
              onClick={() => setShowKabupatenPicker(true)}
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-green-700 border border-gray-200 hover:border-green-200 rounded-lg bg-white transition-all"
            >
              Ganti kabupaten
            </button>
          </div>
          {visitedMenus.includes("dashboard") && (
            <section className={activeMenu === "dashboard" ? "block" : "hidden"} aria-hidden={activeMenu !== "dashboard"}>
              <DashboardContent
                setActiveMenu={setActiveMenu}
                isSuperAdmin={isSuperAdmin}
                activeKabupaten={activeKabupaten}
              />
            </section>
          )}
          {visitedMenus.includes("distribusi-tugas") && (
            <section className={activeMenu === "distribusi-tugas" ? "block" : "hidden"} aria-hidden={activeMenu !== "distribusi-tugas"}>
              <DistribusiTugas setActiveMenu={setActiveMenu} />
            </section>
          )}
          {visitedMenus.includes("validasi-survey") && (
            <section className={activeMenu === "validasi-survey" ? "block" : "hidden"} aria-hidden={activeMenu !== "validasi-survey"}>
              <ValidasiSurvey activeKabupaten={activeKabupaten} />
            </section>
          )}
          {visitedMenus.includes("data-survey-valid") && (
            <section className={activeMenu === "data-survey-valid" ? "block" : "hidden"} aria-hidden={activeMenu !== "data-survey-valid"}>
              <DataSurveyValid activeKabupaten={activeKabupaten} />
            </section>
          )}
          {visitedMenus.includes("data-survey-tolak") && (
            <section className={activeMenu === "data-survey-tolak" ? "block" : "hidden"} aria-hidden={activeMenu !== "data-survey-tolak"}>
              <DataSurveyTolak activeKabupaten={activeKabupaten} />
            </section>
          )}
          {visitedMenus.includes("data-survey-validasi") && isSuperAdmin && (
            <section className={activeMenu === "data-survey-validasi" ? "block" : "hidden"} aria-hidden={activeMenu !== "data-survey-validasi"}>
              <DataSurveyValidasi activeKabupaten={activeKabupaten} />
            </section>
          )}
          {visitedMenus.includes("maps-validasi") && (
            <section className={activeMenu === "maps-validasi" ? "block" : "hidden"} aria-hidden={activeMenu !== "maps-validasi"}>
              <MapsValidasi activeKabupaten={activeKabupaten} />
            </section>
          )}
          {visitedMenus.includes("tracking-history") && (
            <section className={activeMenu === "tracking-history" ? "block" : "hidden"} aria-hidden={activeMenu !== "tracking-history"}>
              <TrackingHistory />
            </section>
          )}
        </div>

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
                          ? "border-green-400 bg-green-50 shadow-sm"
                          : "border-gray-200 hover:border-green-300 hover:bg-green-50/40"
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
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold"
                >
                  Mulai
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function GesaSurveyPage() {
  return (
    <ProtectedRoute>
      <GesaSurveyContent />
    </ProtectedRoute>
  );
}

