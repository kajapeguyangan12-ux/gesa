"use client";

import { useState } from "react";
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

function GesaSurveyContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState("dashboard");

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "distribusi-tugas", label: "Distribusi Tugas", icon: "📋" },
    { id: "validasi-survey", label: "Validasi Survey", icon: "✓" },
    { id: "data-survey-valid", label: "Data Survey Valid", icon: "📁" },
    { id: "data-survey-tolak", label: "Data Survey Valid (TOLAK)", icon: "❌" },
    { id: "data-survey-validasi", label: "Data Survey Validasi", icon: "🔍", superAdminOnly: true },
    { id: "maps-validasi", label: "Maps Validasi", icon: "🗺️" },
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
              const isSuperAdmin = user?.role === 'super-admin';
              
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
              const isSuperAdmin = user?.role === 'super-admin';
              
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
          {activeMenu === "dashboard" && <DashboardContent setActiveMenu={setActiveMenu} />}
          {activeMenu === "distribusi-tugas" && <DistribusiTugas setActiveMenu={setActiveMenu} />}
          {activeMenu === "validasi-survey" && <ValidasiSurvey />}
          {activeMenu === "data-survey-valid" && <DataSurveyValid />}
          {activeMenu === "data-survey-tolak" && <DataSurveyTolak />}
          {activeMenu === "data-survey-validasi" && <DataSurveyValidasi />}
          {activeMenu === "maps-validasi" && <MapsValidasi />}
          {activeMenu === "tracking-history" && <TrackingHistory />}
        </div>
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
