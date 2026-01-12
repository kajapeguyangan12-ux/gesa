"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";

interface ModuleCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  bgGradient: string;
  route: string;
}

const modules: ModuleCard[] = [
  {
    id: "survey-cahaya",
    title: "Survey Cahaya",
    description: "Manajemen dan analisis survey pencahayaan",
    icon: "💡",
    color: "from-yellow-400 to-orange-500",
    bgGradient: "bg-gradient-to-br from-yellow-50 to-orange-50",
    route: "/admin",
  },
  {
    id: "kemerataan-cahaya",
    title: "Kemerataan Cahaya",
    description: "Pengukuran tingkat kemerataan cahaya",
    icon: "☀️",
    color: "from-amber-400 to-yellow-600",
    bgGradient: "bg-gradient-to-br from-amber-50 to-yellow-50",
    route: "/kemerataan-cahaya",
  },
  {
    id: "gesa-survey",
    title: "Gesa Survey",
    description: "Survey umum dan pengumpulan data",
    icon: "📋",
    color: "from-blue-400 to-cyan-500",
    bgGradient: "bg-gradient-to-br from-blue-50 to-cyan-50",
    route: "/gesa-survey",
  },
  {
    id: "kontruksi",
    title: "Gesa Kontruksi",
    description: "Manajemen proyek konstruksi",
    icon: "🏗️",
    color: "from-slate-500 to-gray-700",
    bgGradient: "bg-gradient-to-br from-slate-50 to-gray-50",
    route: "/kontruksi",
  },
  {
    id: "om",
    title: "O&M",
    description: "Operation & Maintenance management",
    icon: "🔧",
    color: "from-green-400 to-emerald-600",
    bgGradient: "bg-gradient-to-br from-green-50 to-emerald-50",
    route: "/om",
  },
  {
    id: "bmd-gudang",
    title: "BMD & Gudang Project",
    description: "Barang Milik Daerah dan manajemen gudang",
    icon: "📦",
    color: "from-purple-400 to-indigo-600",
    bgGradient: "bg-gradient-to-br from-purple-50 to-indigo-50",
    route: "/bmd-gudang",
  },
];

function ModuleSelectionContent() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const { user, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Filter module berdasarkan role user
  const getFilteredModules = () => {
    if (!user) return [];

    // Super admin bisa lihat semua module
    if (user.role === "super-admin") {
      return modules;
    }

    // Filter berdasarkan role petugas
    switch (user.role) {
      case "petugas-survey-cahaya":
        // Hanya tampilkan Survey Cahaya dan Kemerataan Cahaya
        return modules.filter(m => m.id === "survey-cahaya" || m.id === "kemerataan-cahaya");
      
      case "petugas-existing":
      case "petugas-apj-propose":
        // Hanya tampilkan Gesa Survey
        return modules.filter(m => m.id === "gesa-survey");
      
      case "petugas-kontruksi":
        // Hanya tampilkan Gesa Kontruksi
        return modules.filter(m => m.id === "kontruksi");
      
      case "petugas-om":
        // Hanya tampilkan O&M
        return modules.filter(m => m.id === "om");
      
      case "petugas-bmd-gudang":
        // Hanya tampilkan BMD & Gudang
        return modules.filter(m => m.id === "bmd-gudang");
      
      default:
        return [];
    }
  };

  const filteredModules = getFilteredModules();

  const handleModuleClick = (route: string, moduleId: string) => {
    // Jika module Survey Cahaya, cek role untuk routing
    if (moduleId === "survey-cahaya") {
      if (user?.role === "admin" || user?.role === "super-admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard-pengukuran");
      }
    } else {
      router.push(route);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Mobile-Optimized Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Logo & Brand - Mobile Optimized */}
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="relative w-9 h-9 sm:w-12 sm:h-12 flex-shrink-0">
                <Image
                  src="/BDG1.png"
                  alt="Logo BGD"
                  fill
                  className="object-contain"
                />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900">
                  Gesa Platform
                </h1>
                <p className="text-xs sm:text-sm text-gray-500">
                  by Bali Gerbang Digital
                </p>
              </div>
            </div>

            {/* User Info & Logout - Mobile Optimized */}
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900 truncate max-w-[120px] lg:max-w-none">
                  {user?.displayName || user?.email}
                </p>
                <p className="text-xs text-gray-500">
                  {user?.role === "super-admin" ? "Super Admin" : "Petugas"}
                </p>
              </div>
              {user?.role === "super-admin" && (
                <button
                  onClick={() => router.push("/admin/module-selection")}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-gradient-to-r from-red-600 to-red-700 rounded-lg hover:from-red-700 hover:to-red-800 active:scale-95 transition-all duration-200 touch-manipulation flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="hidden sm:inline">Admin Panel</span>
                </button>
              )}
              <button
                onClick={handleLogout}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 active:scale-95 transition-all duration-200 touch-manipulation"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Mobile Optimized */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-12 pb-20 sm:pb-12">
        {/* Welcome Section - Mobile Optimized */}
        <div
          className={`text-center mb-6 sm:mb-12 px-2 transition-all duration-1000 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-2 sm:mb-3">
            Pilih Modul Gesa
          </h2>
          <p className="text-sm sm:text-lg text-gray-600 max-w-2xl mx-auto px-4">
            Silakan pilih modul yang ingin Anda akses untuk memulai pekerjaan
          </p>
        </div>

        {/* Module Grid - Mobile Optimized with Better Touch */}
        {filteredModules.length > 0 ? (
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 transition-all duration-1000 delay-300 ${
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            }`}
          >
            {filteredModules.map((module, index) => (
              <div
                key={module.id}
                className="transition-all duration-500"
                style={{
                  transitionDelay: `${300 + index * 100}ms`,
                }}
              >
                <button
                  onClick={() => handleModuleClick(module.route, module.id)}
                  onMouseEnter={() => setHoveredCard(module.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  className={`w-full p-5 sm:p-6 rounded-2xl sm:rounded-2xl border-2 transition-all duration-300 text-left group active:scale-95 touch-manipulation ${
                    hoveredCard === module.id
                      ? "border-transparent shadow-2xl sm:scale-105 sm:-translate-y-2"
                      : "border-gray-200 shadow-lg hover:shadow-xl"
                  } ${module.bgGradient}`}
                >
                {/* Icon - Mobile Optimized */}
                <div
                  className={`inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br ${
                    module.color
                  } mb-3 sm:mb-4 transition-transform duration-300 ${
                    hoveredCard === module.id ? "sm:scale-110 sm:rotate-6" : ""
                  }`}
                >
                  <span className="text-2xl sm:text-3xl">{module.icon}</span>
                </div>

                {/* Content - Mobile Optimized */}
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1.5 sm:mb-2 group-hover:text-gray-800 transition-colors">
                  {module.title}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 group-hover:text-gray-700 transition-colors leading-relaxed">
                  {module.description}
                </p>

                {/* Arrow Icon - Mobile Optimized */}
                <div className="mt-3 sm:mt-4 flex items-center text-xs sm:text-sm font-medium text-gray-500 group-hover:text-gray-700 transition-colors">
                  <span>Buka Modul</span>
                  <svg
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ml-2 transition-transform duration-300 ${
                      hoveredCard === module.id ? "translate-x-2" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            </div>
          ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8 max-w-md mx-auto">
              <svg className="w-16 h-16 mx-auto mb-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Tidak Ada Modul Tersedia
              </h3>
              <p className="text-gray-600">
                Role Anda tidak memiliki akses ke modul manapun. Hubungi administrator untuk informasi lebih lanjut.
              </p>
            </div>
          </div>
        )}

        {/* Info Section - Mobile Optimized */}
        <div
          className={`mt-8 sm:mt-12 text-center transition-all duration-1000 delay-700 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          <div className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-50 border border-blue-200 rounded-full mx-2">
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-xs sm:text-sm text-blue-700 font-medium">
              Butuh bantuan? Hubungi administrator sistem
            </p>
          </div>
        </div>
      </main>

      {/* Footer - Mobile Optimized */}
      <footer className="mt-8 sm:mt-16 py-6 sm:py-8 border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs sm:text-sm text-gray-500">
            © 2025 Bali Gerbang Digital. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function ModuleSelectionPage() {
  return (
    <ProtectedRoute>
      <ModuleSelectionContent />
    </ProtectedRoute>
  );
}
