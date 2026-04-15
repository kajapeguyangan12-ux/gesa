"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";

type MenuCard = {
  id: string;
  title: string;
  description: string;
  route: string;
  icon: React.ReactNode;
};

export default function OMDashboard() {
  const router = useRouter();
  const { user } = useAuth();

  const menuCards: MenuCard[] = useMemo(
    () => [
      {
        id: "daftar-laporan",
        title: "Daftar Laporan",
        description: "Lihat semua laporan tugas O&M",
        route: "/om/daftar-laporan",
        icon: (
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shadow-sm">
            <span className="text-2xl">📄</span>
          </div>
        ),
      },
      {
        id: "laporan-tugas",
        title: "Laporan Tugas",
        description: "Input laporan pekerjaan O&M",
        route: "/om/laporan-tugas",
        icon: (
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shadow-sm">
            <span className="text-2xl">📝</span>
          </div>
        ),
      },
      {
        id: "history-laporan",
        title: "History Laporan",
        description: "Lihat riwayat laporan O&M",
        route: "/om/history-laporan",
        icon: (
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shadow-sm">
            <span className="text-2xl">⏱️</span>
          </div>
        ),
      },
      {
        id: "distribusi-tugas",
        title: "Distribusi Tugas O&M",
        description: "Atur tugas untuk petugas O&M",
        route: "/om/distribusi-tugas",
        icon: (
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shadow-sm">
            <span className="text-2xl">📋</span>
          </div>
        ),
      },
      {
        id: "manajemen-pengguna",
        title: "Manajemen Pengguna",
        description: "Kelola akun petugas O&M",
        route: "/om/manajemen-pengguna",
        icon: (
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shadow-sm">
            <span className="text-2xl">👥</span>
          </div>
        ),
      },
    ],
    []
  );

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "US";

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-red-50 to-red-100">
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6">
        <div className="mb-5 flex items-center justify-between gap-3 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <button
            onClick={() => router.back()}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50"
            aria-label="Kembali"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex-1 text-center">
            <div className="text-xs uppercase tracking-[0.25em] text-gray-400">O&M</div>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">Dashboard O&M</h1>
            <p className="mt-2 text-sm text-gray-600">Menu utama untuk tugas Operation & Maintenance.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50"
              aria-label="Notifikasi"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <button
              type="button"
              className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-2xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              aria-label="Profil"
            >
              {initials}
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {menuCards.map((card) => (
            <button
              key={card.id}
              onClick={() => router.push(card.route)}
              className="group rounded-3xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                {card.icon}
                <div>
                  <div className="text-lg font-semibold text-gray-900">{card.title}</div>
                  <div className="mt-1 text-sm text-gray-500">{card.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
