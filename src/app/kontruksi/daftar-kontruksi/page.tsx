"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ProtectedRoute from "@/components/ProtectedRoute";

type MenuCard = {
  id: string;
  title: string;
  route?: string;
  icon: React.ReactNode;
};

function DaftarKontruksiContent() {
  const router = useRouter();

  const menuCards: MenuCard[] = useMemo(
    () => [
      {
        id: "penggalian-pondasi",
        title: "Penggalian & Pondasi",
        route: "/kontruksi/daftar-kontruksi/penggalian",
        icon: (
          <svg className="w-12 h-12 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <rect x="4" y="5" width="16" height="10" rx="1.5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 13h12" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16h10" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 19h12" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 5l2-2 2 2" />
          </svg>
        ),
      },
      {
        id: "pemasangan-tiang",
        title: "Pemasangan Tiang,\nArm & Lampu",
        route: "/kontruksi/daftar-kontruksi/pemasangan-tiang",
        icon: (
          <svg className="w-12 h-12 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7l3-2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 5v4" />
            <circle cx="19" cy="10" r="1.2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 21h6" />
          </svg>
        ),
      },
      {
        id: "pemasangan-kabel",
        title: "Pemasangan Kabel",
        route: "/kontruksi/daftar-kontruksi/pemasangan-kabel",
        icon: (
          <svg className="w-12 h-12 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 6h4l2 3h8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18c2-2 4-3 7-3 3 0 5 1 6 3" />
            <circle cx="5" cy="6" r="1.2" />
            <circle cx="19" cy="9" r="1.2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15l2 2 3-3" />
          </svg>
        ),
      },
      {
        id: "comissioning",
        title: "Comissioning",
        route: "/kontruksi/daftar-kontruksi/comissioning",
        icon: (
          <svg className="w-12 h-12 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <rect x="5" y="4" width="12" height="16" rx="2" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 16h4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l2 2 3-3" />
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
            onClick={() => router.push("/kontruksi")}
            className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center shadow-md"
            aria-label="Kembali"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <div className="text-base font-semibold text-gray-900">Daftar Kontruksi</div>
          </div>

          <div className="relative w-12 h-12">
            <Image src="/BDG1.png" alt="Logo" fill className="object-contain" />
          </div>
        </header>

        <div className="mt-8 grid grid-cols-2 gap-4">
          {menuCards.map((card) => (
            <button
              key={card.id}
              onClick={() => card.route && router.push(card.route)}
              className={`rounded-2xl border border-gray-300 bg-white p-4 text-center shadow-sm transition-all active:scale-[0.98] ${
                card.route ? "hover:shadow-md" : "opacity-90 cursor-default"
              }`}
              aria-disabled={!card.route}
            >
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-xl border border-gray-300 bg-gray-50">
                {card.icon}
              </div>
              <div className="text-xs font-semibold text-gray-900 whitespace-pre-line">{card.title}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DaftarKontruksiPage() {
  return (
    <ProtectedRoute>
      <DaftarKontruksiContent />
    </ProtectedRoute>
  );
}
