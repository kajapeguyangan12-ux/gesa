"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ProtectedRoute from "@/components/ProtectedRoute";

type MenuCard = {
  id: string;
  title: string;
  route: string;
  icon: React.ReactNode;
};

function PenggalianPanelContent() {
  const router = useRouter();

  const menuCards: MenuCard[] = useMemo(
    () => [
      {
        id: "penggalian",
        title: "Penggalian",
        route: "/kontruksi/daftar-kontruksi/penggalian/penggalian",
        icon: (
          <svg className="w-12 h-12 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <circle cx="7" cy="7" r="2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18l3-6 3 2 2 4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 11l5-3 3 4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l3-2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 6l2 4" />
          </svg>
        ),
      },
      {
        id: "pembesian",
        title: "Pembesian & Grounding",
        route: "/kontruksi/daftar-kontruksi/penggalian/pembesian",
        icon: (
          <svg className="w-12 h-12 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 18h14" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 14h12" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 18v-8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-10" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 18v-6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 10h10" />
          </svg>
        ),
      },
      {
        id: "pengecoran",
        title: "Pengecoran",
        route: "/kontruksi/daftar-kontruksi/penggalian/pengecoran",
        icon: (
          <svg className="w-12 h-12 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 13h9l2 4H8z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 13V7l5-2v6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 13v-2h6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 13l2 4" />
          </svg>
        ),
      },
      {
        id: "uji-beton",
        title: "Uji Beton",
        route: "/kontruksi/daftar-kontruksi/penggalian/uji-beton",
        icon: (
          <svg className="w-12 h-12 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <rect x="5" y="11" width="14" height="7" rx="1.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V8" />
            <circle cx="8" cy="6" r="1.2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 15l2 2 4-4" />
          </svg>
        ),
      },
    ],
    []
  );

  return (
    <div className="relative min-h-screen bg-white overflow-hidden">
      <div className="absolute left-4 top-20 h-20 w-1 bg-red-600" />
      <div className="absolute left-6 top-20 h-20 w-[3px] bg-red-500" />

      <div className="absolute -bottom-28 -left-28 h-80 w-80 rounded-full bg-red-600" />
      <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full border-[6px] border-red-500" />

      <div className="relative mx-auto w-full max-w-md px-5 pb-24 pt-5">
        <div className="text-[11px] uppercase tracking-wide text-gray-300">dashboard</div>

        <header className="mt-2 flex items-center justify-between">
          <button
            onClick={() => router.push("/kontruksi/daftar-kontruksi")}
            className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center shadow-md"
            aria-label="Kembali"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <div className="text-base font-semibold text-gray-900">Penggalian & Pondasi</div>
          </div>

          <div className="relative w-12 h-12">
            <Image src="/BDG1.png" alt="Logo" fill className="object-contain" />
          </div>
        </header>

        <div className="mt-8 grid grid-cols-2 gap-4">
          {menuCards.map((card) => (
            <button
              key={card.id}
              onClick={() => router.push(card.route)}
              className="rounded-2xl border border-gray-300 bg-white p-4 text-center shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
            >
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-xl border border-gray-300 bg-gray-50">
                {card.icon}
              </div>
              <div className="text-xs font-semibold text-gray-900">{card.title}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PenggalianPanelPage() {
  return (
    <ProtectedRoute>
      <PenggalianPanelContent />
    </ProtectedRoute>
  );
}
