"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Image from "next/image";

interface Survey {
  id: string;
  namaJalan: string;
  tanggal: string;
  status: "draft" | "in-progress" | "completed" | "validated";
  progress: number;
  lokasi: string;
}

function GesaSurveyContent() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [surveys, setSurveys] = useState<Survey[]>([
    {
      id: "1",
      namaJalan: "Jl. Asia Afrika",
      tanggal: "2025-12-18",
      status: "in-progress",
      progress: 65,
      lokasi: "Bandung Tengah",
    },
    {
      id: "2",
      namaJalan: "Jl. Dago",
      tanggal: "2025-12-17",
      status: "completed",
      progress: 100,
      lokasi: "Bandung Utara",
    },
    {
      id: "3",
      namaJalan: "Jl. Soekarno Hatta",
      tanggal: "2025-12-16",
      status: "draft",
      progress: 20,
      lokasi: "Bandung Timur",
    },
  ]);

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getStatusColor = (status: Survey["status"]) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-700 border-gray-300";
      case "in-progress":
        return "bg-blue-100 text-blue-700 border-blue-300";
      case "completed":
        return "bg-green-100 text-green-700 border-green-300";
      case "validated":
        return "bg-purple-100 text-purple-700 border-purple-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  const getStatusLabel = (status: Survey["status"]) => {
    switch (status) {
      case "draft":
        return "Draft";
      case "in-progress":
        return "Sedang Berjalan";
      case "completed":
        return "Selesai";
      case "validated":
        return "Tervalidasi";
      default:
        return "Unknown";
    }
  };

  const filteredSurveys = surveys.filter((survey) => {
    const matchesStatus = filterStatus === "all" || survey.status === filterStatus;
    const matchesSearch = survey.namaJalan.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          survey.lokasi.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    total: surveys.length,
    draft: surveys.filter((s) => s.status === "draft").length,
    inProgress: surveys.filter((s) => s.status === "in-progress").length,
    completed: surveys.filter((s) => s.status === "completed").length,
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Selamat Pagi";
    if (hour < 15) return "Selamat Siang";
    if (hour < 18) return "Selamat Sore";
    return "Selamat Malam";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 pb-20 lg:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Back Button & Logo & Title */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/module-selection")}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg transform transition-transform hover:scale-105">
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 13h1v7c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-7h1a1 1 0 00.707-1.707l-9-9a.999.999 0 00-1.414 0l-9 9A1 1 0 003 13zm7 7v-5h4v5h-4zm2-15.586l6 6V15l.001 5H16v-5c0-1.103-.897-2-2-2h-4c-1.103 0-2 .897-2 2v5H6v-9.586l6-6z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">Dashboard</h1>
                <p className="text-xs sm:text-sm text-gray-600 font-medium">{getGreeting()}, <span className="font-bold text-blue-600">{user?.displayName || "riko"}</span></p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Menu Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {/* Daftar Survey */}
          <button
            onClick={() => router.push("/survey-selection")}
            className="bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 sm:p-10 text-center group relative overflow-hidden border border-gray-100 hover:border-yellow-200 active:scale-[0.98]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-5 text-4xl shadow-md group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                📋
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3 group-hover:text-yellow-700 transition-colors">Daftar Survey</h3>
              <div className="inline-block px-5 py-2 bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 rounded-full text-xs font-bold shadow-sm border border-yellow-200">
                Mulai tugas dulu
              </div>
            </div>
          </button>

          {/* Daftar Tugas */}
          <button
            onClick={() => router.push("/tasks")}
            className="bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 sm:p-10 text-center group relative overflow-hidden border border-gray-100 hover:border-green-200 active:scale-[0.98]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-green-50 to-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-5 text-4xl shadow-md group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                📅
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 group-hover:text-green-700 transition-colors">Daftar Tugas</h3>
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto text-white font-bold text-lg shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all">
                {stats.inProgress}
              </div>
            </div>
          </button>
        </div>

        {/* Ringkasan Hari Ini */}
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden border border-gray-100">
          {/* Header */}
          <div className="px-6 sm:px-8 py-5 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">Ringkasan Hari Ini</h2>
                <p className="text-xs sm:text-sm text-gray-600 mt-1 font-medium">Status pekerjaan terkini</p>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-semibold">Baru saja</span>
              </div>
            </div>
          </div>

          {/* Stats Content */}
          <div className="p-6 sm:p-8">
            {/* Top Stats */}
            <div className="grid grid-cols-3 gap-4 sm:gap-6 mb-8">
              {/* Survey Hari Ini */}
              <div className="text-center group">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-3xl sm:text-4xl font-bold text-blue-600 mb-2">0</p>
                <p className="text-xs sm:text-sm font-bold text-gray-700">Survey Hari Ini</p>
                <p className="text-xs text-gray-500 mt-1">Dibuat hari ini</p>
              </div>

              {/* Tugas Selesai */}
              <div className="text-center group">
                <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-200 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-3xl sm:text-4xl font-bold text-green-600 mb-2">0</p>
                <p className="text-xs sm:text-sm font-bold text-gray-700">Tugas Selesai</p>
                <p className="text-xs text-gray-500 mt-1">Total selesai</p>
              </div>

              {/* Menunggu Validasi */}
              <div className="text-center group">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                  <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-3xl sm:text-4xl font-bold text-orange-600 mb-2">0</p>
                <p className="text-xs sm:text-sm font-bold text-gray-700">Menunggu Validasi</p>
                <p className="text-xs text-gray-500 mt-1">Survey pending</p>
              </div>
            </div>

            {/* Bottom Stats */}
            <div className="grid grid-cols-2 gap-6 pt-6 border-t-2 border-gray-200">
              <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-slate-100 border border-gray-200 hover:shadow-lg transition-all duration-300 group">
                <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-br from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">0</p>
                <p className="text-xs sm:text-sm font-bold text-gray-700">Total Survey</p>
              </div>
              <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 hover:shadow-lg transition-all duration-300 group">
                <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-br from-blue-700 to-indigo-700 bg-clip-text text-transparent mb-2">0</p>
                <p className="text-xs sm:text-sm font-bold text-gray-700">Total Tugas</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t-2 border-gray-200 shadow-2xl lg:hidden z-50">
        <div className="grid grid-cols-3 h-20 max-w-md mx-auto">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex flex-col items-center justify-center gap-1.5 text-blue-600 relative group active:scale-95 transition-transform"
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"></div>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 13h1v7c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-7h1a1 1 0 00.707-1.707l-9-9a.999.999 0 00-1.414 0l-9 9A1 1 0 003 13zm7 7v-5h4v5h-4zm2-15.586l6 6V15l.001 5H16v-5c0-1.103-.897-2-2-2h-4c-1.103 0-2 .897-2 2v5H6v-9.586l6-6z"/>
              </svg>
            </div>
            <span className="text-xs font-bold">Home</span>
          </button>
          
          <button
            onClick={() => router.push("/notifications")}
            className="flex flex-col items-center justify-center gap-1.5 text-gray-500 hover:text-gray-700 group active:scale-95 transition-all"
          >
            <div className="w-10 h-10 bg-gray-100 group-hover:bg-gray-200 rounded-2xl flex items-center justify-center transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <span className="text-xs font-semibold">Notifikasi</span>
          </button>
          
          <button
            onClick={() => router.push("/profile")}
            className="flex flex-col items-center justify-center gap-1.5 text-gray-500 hover:text-gray-700 group active:scale-95 transition-all"
          >
            <div className="w-10 h-10 bg-gray-100 group-hover:bg-gray-200 rounded-2xl flex items-center justify-center transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="text-xs font-semibold">Profil</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

function GesaSurveyPage() {
  return (
    <ProtectedRoute>
      <GesaSurveyContent />
    </ProtectedRoute>
  );
}

export default GesaSurveyPage;
