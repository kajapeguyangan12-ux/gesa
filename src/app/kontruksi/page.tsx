"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";

type MenuCard = {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  icon: React.ReactNode;
};

function KontruksiDashboardContent() {
  const router = useRouter();
  const { user } = useAuth();

  const menuCards: MenuCard[] = useMemo(
    () => [
      {
        id: "daftar-tugas",
        title: "Daftar Tugas",
        subtitle: "Tugas dari admin",
        route: "/kontruksi/daftar-tugas",
        icon: (
          <svg className="w-10 h-10 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6h11M9 12h11M9 18h11" />
            <rect x="3" y="5" width="4" height="4" rx="1" />
            <rect x="3" y="11" width="4" height="4" rx="1" />
            <rect x="3" y="17" width="4" height="4" rx="1" />
          </svg>
        ),
      },
      {
        id: "daftar-kontruksi",
        title: "Daftar Kontruksi",
        subtitle: "Input progres",
        route: "/kontruksi/daftar-kontruksi",
        icon: (
          <svg className="w-10 h-10 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 19v-7l5-3 5 3v7" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 10l3-2 3 2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19v-4h4v4" />
          </svg>
        ),
      },
      {
        id: "riwayat-kontruksi",
        title: "Riwayat Kontruksi",
        subtitle: "Catatan pekerjaan",
        route: "/kontruksi/riwayat",
        icon: (
          <svg className="w-10 h-10 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
            <circle cx="12" cy="12" r="8" />
          </svg>
        ),
      },
      {
        id: "maps-hasil",
        title: "Maps Hasil Kontruksi",
        subtitle: "Lihat titik",
        route: "/kontruksi/maps",
        icon: (
          <svg className="w-10 h-10 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
        ),
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-white to-red-50">
      <div className="mx-auto w-full max-w-md px-4 pb-24 pt-4">
        {/* Header */}
        <header className="flex items-center justify-between">
          <button
            onClick={() => router.push("/module-selection")}
            className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center shadow-sm"
            aria-label="Kembali"
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>

          <div className="text-center">
            <div className="text-xs uppercase tracking-wide text-gray-400">Dashboard</div>
            <div className="text-lg font-serif font-bold text-gray-900">Petugas Kontruksi</div>
          </div>

          <div className="relative w-12 h-12">
            <Image src="/BDG1.png" alt="Logo" fill className="object-contain" />
          </div>
        </header>

        {/* Greeting */}
        <div className="mt-4">
          <div className="text-sm text-gray-500">Halo,</div>
          <div className="text-base font-semibold text-gray-900">
            {user?.displayName || user?.email || "Petugas"}
          </div>
        </div>

        {/* Menu Cards */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          {menuCards.map((card) => (
            <button
              key={card.id}
              onClick={() => router.push(card.route)}
              className="relative rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
            >
              <div className="absolute inset-x-0 top-0 h-1.5 rounded-t-2xl bg-gradient-to-r from-red-500 via-red-400 to-red-600" />
              <div className="mt-3 flex flex-col items-center gap-3 text-center">
                <div className="w-16 h-16 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center">
                  {card.icon}
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">{card.title}</div>
                  <div className="text-xs text-gray-500">{card.subtitle}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-8" />
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="mx-auto w-full max-w-md grid grid-cols-3 h-16">
          <button
            onClick={() => router.push("/kontruksi")}
            className="flex flex-col items-center justify-center gap-1 text-red-600"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 13h1v7c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-7h1a1 1 0 00.707-1.707l-9-9a.999.999 0 00-1.414 0l-9 9A1 1 0 003 13z" />
            </svg>
            <span className="text-xs font-semibold">Home</span>
          </button>

          <button
            onClick={() => router.push("/notifications")}
            className="flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-red-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="text-xs font-semibold">Notifikasi</span>
          </button>

          <button
            onClick={() => router.push("/profile")}
            className="flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-red-600 transition-colors"
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

export default function KontruksiDashboardPage() {
  return (
    <ProtectedRoute>
      <KontruksiDashboardContent />
    </ProtectedRoute>
  );
}
