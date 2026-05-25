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
  description: string;
  accent: string;
  iconWrapClassName: string;
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
        description: "Lihat titik kerja yang dibagikan dan buka detail tugas lapangan.",
        accent: "from-rose-500 via-red-500 to-orange-400",
        iconWrapClassName: "from-rose-50 to-orange-50 text-rose-600 border-rose-100",
        route: "/kontruksi/daftar-tugas",
        icon: (
          <svg className="h-8 w-8 sm:h-9 sm:w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
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
        description: "Isi perkembangan pekerjaan per tahap dengan lebih cepat dari lapangan.",
        accent: "from-slate-700 via-slate-800 to-zinc-900",
        iconWrapClassName: "from-slate-50 to-slate-100 text-slate-700 border-slate-200",
        route: "/kontruksi/daftar-kontruksi",
        icon: (
          <svg className="h-8 w-8 sm:h-9 sm:w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
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
        description: "Pantau hasil yang pernah dikirim dan cek progres pekerjaan sebelumnya.",
        accent: "from-amber-400 via-orange-400 to-red-500",
        iconWrapClassName: "from-amber-50 to-orange-50 text-amber-600 border-amber-100",
        route: "/kontruksi/riwayat",
        icon: (
          <svg className="h-8 w-8 sm:h-9 sm:w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
            <circle cx="12" cy="12" r="8" />
          </svg>
        ),
      },
      {
        id: "maps-hasil",
        title: "Maps Hasil Kontruksi",
        subtitle: "Lihat titik",
        description: "Buka peta hasil pekerjaan untuk melihat titik dan sebaran progres.",
        accent: "from-emerald-500 via-teal-500 to-cyan-500",
        iconWrapClassName: "from-emerald-50 to-cyan-50 text-emerald-600 border-emerald-100",
        route: "/kontruksi/maps",
        icon: (
          <svg className="h-8 w-8 sm:h-9 sm:w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
        ),
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(254,226,226,0.68),_transparent_34%),linear-gradient(180deg,_#fff7f7_0%,_#ffffff_42%,_#fff4f1_100%)] pb-24 text-slate-900 lg:pb-10">
      <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between rounded-[28px] border border-white/70 bg-white/75 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur md:px-6">
          <button
            onClick={() => router.push("/module-selection")}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-all hover:-translate-x-0.5 hover:shadow-md"
            aria-label="Kembali"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>

          <div className="text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-rose-400 sm:text-xs">Dashboard</div>
            <div className="text-base font-bold text-slate-900 sm:text-xl">Petugas Kontruksi</div>
          </div>

          <div className="relative h-11 w-11 sm:h-12 sm:w-12">
            <Image src="/BDG1.png" alt="Logo" fill className="object-contain" />
          </div>
        </header>

        <section className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
          <div className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,_#0f172a_0%,_#1e293b_52%,_#ef4444_100%)] px-5 py-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] sm:px-7 sm:py-8">
            <div className="absolute -right-10 top-0 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute bottom-0 right-12 h-28 w-28 rounded-full bg-orange-300/20 blur-2xl" />
            <div className="relative max-w-xl">
              <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-100">
                Area Kerja Kontruksi
              </div>
              <h1 className="mt-4 text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
                Kelola tugas lapangan dari satu dashboard yang lebih jelas.
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-slate-200 sm:text-base">
                Akses daftar tugas, input progres, riwayat pekerjaan, dan peta hasil kontruksi dengan tampilan yang lebih nyaman di layar kecil maupun besar.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <div className="min-w-[140px] rounded-2xl border border-white/12 bg-white/10 px-4 py-3 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Petugas</div>
                  <div className="mt-1 text-sm font-semibold text-white sm:text-base">{user?.displayName || user?.email || "Petugas"}</div>
                </div>
                <div className="min-w-[140px] rounded-2xl border border-white/12 bg-white/10 px-4 py-3 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Akses Cepat</div>
                  <div className="mt-1 text-sm font-semibold text-white sm:text-base">4 menu operasional</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[28px] border border-rose-100 bg-white/90 p-5 shadow-[0_18px_45px_rgba(248,113,113,0.12)] backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-400">Ringkasan</div>
              <div className="mt-2 text-xl font-bold text-slate-900">Akses modul lebih cepat</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Tata letak dibuat lebih lebar di desktop dan tetap nyaman disentuh di HP, tanpa area kosong besar di sisi layar.
              </p>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Navigasi</div>
                  <div className="mt-2 text-lg font-bold text-slate-900">Menu Utama</div>
                </div>
                <div className="rounded-2xl bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Aktif
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {menuCards.map((card) => (
                  <div key={card.id} className="rounded-2xl bg-slate-50 px-3 py-3 text-slate-600">
                    <div className="font-semibold text-slate-900">{card.title}</div>
                    <div className="mt-1 text-xs">{card.subtitle}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Menu Operasional</div>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">Pilih area kerja</h2>
            </div>
            <div className="hidden rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-500 shadow-sm md:block">
              Tampilan responsif untuk mobile dan desktop
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {menuCards.map((card) => (
              <button
                key={card.id}
                onClick={() => router.push(card.route)}
                className="group relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 p-5 text-left shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_22px_55px_rgba(15,23,42,0.14)] active:scale-[0.985] sm:p-6"
              >
                <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${card.accent}`} />
                <div className={`inline-flex h-16 w-16 items-center justify-center rounded-3xl border bg-gradient-to-br ${card.iconWrapClassName} transition-transform duration-300 group-hover:scale-105`}>
                  {card.icon}
                </div>
                <div className="mt-5 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{card.subtitle}</div>
                    <div className="mt-2 text-lg font-bold leading-snug text-slate-900">{card.title}</div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition-all duration-300 group-hover:bg-slate-900 group-hover:text-white">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
              </button>
            ))}
          </div>
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/92 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-3 gap-2 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          <button
            onClick={() => router.push("/kontruksi")}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-rose-50 py-3 text-rose-600"
          >
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 13h1v7c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-7h1a1 1 0 00.707-1.707l-9-9a.999.999 0 00-1.414 0l-9 9A1 1 0 003 13z" />
            </svg>
            <span className="text-xs font-semibold">Home</span>
          </button>

          <button
            onClick={() => router.push("/notifications")}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl py-3 text-slate-500 transition-colors hover:text-rose-600"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="text-xs font-semibold">Notifikasi</span>
          </button>

          <button
            onClick={() => router.push("/profile")}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl py-3 text-slate-500 transition-colors hover:text-rose-600"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
