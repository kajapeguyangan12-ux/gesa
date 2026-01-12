"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Image from "next/image";

interface DashboardStats {
  surveyHariIni: number;
  tugasSelesai: number;
  menungguValidasi: number;
  totalSurvey: number;
  totalTugas: number;
}

function DashboardContent() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [stats, setStats] = useState<DashboardStats>({
    surveyHariIni: 0,
    tugasSelesai: 0,
    menungguValidasi: 0,
    totalSurvey: 0,
    totalTugas: 0,
  });

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const menuCards = [
    {
      id: "daftar-survey",
      title: "Daftar Survey",
      description: "Mulai tugas dulu",
      icon: "📋",
      color: "from-blue-400 to-blue-600",
      route: "/module-selection",
      badge: null,
    },
    {
      id: "daftar-tugas",
      title: "Daftar Tugas",
      description: "Lihat tugas dari admin",
      icon: "📅",
      color: "from-green-400 to-green-600",
      route: "/tugas-survey",
      badge: stats.totalTugas > 0 ? stats.totalTugas.toString() : null,
    },
    {
      id: "sistem-kemerataan",
      title: "Sistem Kemerataan",
      description: "Analisis data",
      icon: "🔆",
      color: "from-orange-400 to-orange-600",
      route: "/kemerataan-cahaya",
      badge: null,
    },
    {
      id: "upload-progress",
      title: "Upload Progress Tracking",
      description: "Track progress",
      icon: "📊",
      color: "from-purple-400 to-purple-600",
      route: "/progress-tracking",
      badge: null,
    },
  ];

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Selamat Pagi";
    if (hour < 15) return "Selamat Siang";
    if (hour < 18) return "Selamat Sore";
    return "Selamat Malam";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 pb-20 lg:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-md border-b-2 border-blue-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl p-2 shadow-sm">
                <Image
                  src="/Logo/BDG1.png"
                  alt="Logo"
                  fill
                  className="object-contain p-1"
                />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-xs sm:text-sm text-gray-600 font-medium">{getGreeting()}, {user?.displayName || "User"}</p>
              </div>
            </div>

            {/* User Badge */}
            <button
              onClick={() => router.push("/profile")}
              className="hidden sm:flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="text-sm font-bold text-gray-800">{user?.displayName}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Menu Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {menuCards.map((card) => (
            <button
              key={card.id}
              onClick={() => router.push(card.route)}
              className="group relative bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden p-6 text-left active:scale-95"
            >
              {/* Background Gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
              
              {/* Badge */}
              {card.badge && (
                <div className="absolute top-4 right-4 w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-md">
                  <span className="text-xs font-bold text-white">{card.badge}</span>
                </div>
              )}

              {/* Icon */}
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center text-3xl mb-4 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                {card.icon}
              </div>

              {/* Content */}
              <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                {card.title}
              </h3>
              <p className="text-sm text-gray-600">{card.description}</p>

              {/* Arrow Icon */}
              <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-gray-100 group-hover:bg-blue-500 flex items-center justify-center transition-all duration-300">
                <svg className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* Ringkasan Hari Ini */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Ringkasan Hari Ini</h2>
                <p className="text-sm text-blue-100 mt-0.5">Status pekerjaan terkini</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="w-10 h-10 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center transition-all">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button className="w-10 h-10 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center transition-all">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              {/* Survey Hari Ini */}
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center mx-auto mb-2">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-3xl font-bold text-blue-600 mb-1">{stats.surveyHariIni}</p>
                <p className="text-xs font-semibold text-gray-700">Survey Hari Ini</p>
                <p className="text-xs text-gray-500 mt-1">Dibuat hari ini</p>
              </div>

              {/* Tugas Selesai */}
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-2">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-3xl font-bold text-green-600 mb-1">{stats.tugasSelesai}</p>
                <p className="text-xs font-semibold text-gray-700">Tugas Selesai</p>
                <p className="text-xs text-gray-500 mt-1">Total selesai</p>
              </div>

              {/* Menunggu Validasi */}
              <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
                <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center mx-auto mb-2">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-3xl font-bold text-orange-600 mb-1">{stats.menungguValidasi}</p>
                <p className="text-xs font-semibold text-gray-700">Menunggu Validasi</p>
                <p className="text-xs text-gray-500 mt-1">Survey pending</p>
              </div>
            </div>

            {/* Summary Totals */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{stats.totalSurvey}</p>
                <p className="text-xs font-semibold text-gray-600 mt-1">Total Survey</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{stats.totalTugas}</p>
                <p className="text-xs font-semibold text-gray-600 mt-1">Total Tugas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Access (Mobile Only) */}
        <div className="lg:hidden bg-white rounded-2xl shadow-lg p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Akses Cepat</h3>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => router.push("/measurement-grid")}
              className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl text-center hover:shadow-md transition-all active:scale-95"
            >
              <div className="text-2xl mb-1">📏</div>
              <p className="text-xs font-semibold text-gray-700">Pengukuran</p>
            </button>
            <button
              onClick={() => router.push("/kemerataan-cahaya")}
              className="p-3 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl text-center hover:shadow-md transition-all active:scale-95"
            >
              <div className="text-2xl mb-1">💡</div>
              <p className="text-xs font-semibold text-gray-700">Kemerataan</p>
            </button>
            <button
              onClick={() => router.push("/profile")}
              className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl text-center hover:shadow-md transition-all active:scale-95"
            >
              <div className="text-2xl mb-1">👤</div>
              <p className="text-xs font-semibold text-gray-700">Profil</p>
            </button>
          </div>
        </div>
      </main>

      {/* Bottom Navigation (Mobile Only) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="grid grid-cols-3 h-16">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex flex-col items-center justify-center gap-1 text-blue-600"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 13h1v7c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-7h1a1 1 0 00.707-1.707l-9-9a.999.999 0 00-1.414 0l-9 9A1 1 0 003 13zm7 7v-5h4v5h-4zm2-15.586l6 6V15l.001 5H16v-5c0-1.103-.897-2-2-2h-4c-1.103 0-2 .897-2 2v5H6v-9.586l6-6z"/>
            </svg>
            <span className="text-xs font-semibold">Home</span>
          </button>
          
          <button
            onClick={() => router.push("/notifications")}
            className="flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-blue-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="text-xs font-semibold">Notifikasi</span>
          </button>
          
          <button
            onClick={() => router.push("/profile")}
            className="flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-blue-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs font-semibold">Profil</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

export default DashboardPage;
