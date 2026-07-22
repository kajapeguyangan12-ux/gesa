"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";

type MenuCard = {
  id: string;
  title: string;
  description: string;
  route: string;
  eyebrow: string;
  accent: string;
  icon: ReactNode;
};

function WrenchIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M14.7 6.3a4.5 4.5 0 005.84 5.84l-8.93 8.92a2 2 0 11-2.83-2.83l8.92-8.93A4.5 4.5 0 0114.7 6.3z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8l4 4" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M9 5.5A2.5 2.5 0 0111.5 3h1A2.5 2.5 0 0115 5.5h1.5A2.5 2.5 0 0119 8v10.5A2.5 2.5 0 0116.5 21h-9A2.5 2.5 0 015 18.5V8a2.5 2.5 0 012.5-2.5H9z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 11h6M9 15h4M10 6h4" />
    </svg>
  );
}

function PencilSquareIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M16.5 4.5l3 3M5 19l3.8-.76a2 2 0 001.03-.55l9.53-9.53a2.12 2.12 0 10-3-3l-9.53 9.53a2 2 0 00-.55 1.03L5 19z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.5 14.5l3 3" />
    </svg>
  );
}

function ClockListIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M12 7v5l3 2m-3 7a8 8 0 110-16 8 8 0 010 16z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 5l-1.5-1.5M19 5l1.5-1.5" />
    </svg>
  );
}

function EnergyHistoryIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 13h3l2-7 4 12 2-5h5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M8 6a2 2 0 11-4 0 2 2 0 014 0zm0 12a2 2 0 11-4 0 2 2 0 014 0zm16-6a2 2 0 11-4 0 2 2 0 014 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M6 8v6a4 4 0 004 4h6m0-12H10a4 4 0 00-4 4"
      />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 3v15M15 6v15" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M16 19v-1a4 4 0 00-4-4H8a4 4 0 00-4 4v1m18 0v-1a4 4 0 00-3-3.87M14 7a4 4 0 11-8 0 4 4 0 018 0zm7 12v-1a4 4 0 00-3-3.87M18 7a3 3 0 11-6 0"
      />
    </svg>
  );
}

export default function OMDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super-admin";
  const [activeKabupaten, setActiveKabupaten] = useState("-");

  const menuCards: MenuCard[] = useMemo(
    () => [
      {
        id: "daftar-laporan",
        title: "Daftar Laporan",
        description: "Pantau semua laporan O&M yang masuk dan cek progres tindak lanjutnya.",
        route: "/om/daftar-laporan",
        eyebrow: "Monitoring",
        accent: "from-teal-500 via-cyan-500 to-sky-500",
        icon: <ClipboardIcon />,
      },
      {
        id: "laporan-tugas",
        title: "Pelaporan Tugas",
        description: "Buat laporan preventif atau korektif dengan format yang lebih jelas dan siap ditindaklanjuti.",
        route: "/om/laporan-tugas",
        eyebrow: "Input Cepat",
        accent: "from-emerald-500 via-teal-500 to-cyan-500",
        icon: <PencilSquareIcon />,
      },
      {
        id: "history-laporan",
        title: "Riwayat Laporan",
        description: "Telusuri histori pekerjaan, perubahan status, dan catatan lama dengan alur baca yang lebih rapi.",
        route: "/om/history-laporan",
        eyebrow: "Riwayat",
        accent: "from-amber-500 via-orange-500 to-rose-500",
        icon: <ClockListIcon />,
      },
      {
        id: "ecm-history",
        title: "ECM & History Aset",
        description: "Pantau smart meter per dua jam dan telusuri riwayat panel serta lampu, dimulai dari daftar grup APJ.",
        route: "/om/ecm-history",
        eyebrow: "Panel & Energi",
        accent: "from-cyan-600 via-blue-600 to-indigo-600",
        icon: <EnergyHistoryIcon />,
      },
      {
        id: "distribusi-tugas",
        title: "Distribusi Tugas",
        description: "Bagikan pekerjaan ke petugas O&M dengan alur yang lebih terstruktur.",
        route: "/om/distribusi-tugas",
        eyebrow: "Koordinasi",
        accent: "from-blue-600 via-cyan-600 to-teal-500",
        icon: <RouteIcon />,
      },
      {
        id: "maps-apj",
        title: "Maps APJ O&M",
        description: "Lihat master titik APJ yang sudah menyala dari konstruksi valid, lengkap per grup dan status laporan.",
        route: "/om/maps",
        eyebrow: "Peta Titik",
        accent: "from-lime-500 via-emerald-500 to-teal-600",
        icon: <MapPinIcon />,
      },
      {
        id: "manajemen-pengguna",
        title: "Manajemen Pengguna",
        description: "Atur akun, akses, dan peran petugas yang terhubung ke modul O&M.",
        route: "/om/manajemen-pengguna",
        eyebrow: "Akses Tim",
        accent: "from-slate-700 via-slate-600 to-teal-600",
        icon: <UsersIcon />,
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
      : "OM";

  const roleLabel =
    user?.role === "super-admin"
      ? "Super Admin"
        : user?.role === "admin"
          ? "Administrator"
          : user?.role === "petugas-om"
            ? "Petugas O&M Preventif"
        : user?.role === "petugas-om-correctif"
          ? "Petugas O&M Correctif"
          : user?.role === "petugas-om-preventif"
            ? "Petugas O&M Preventif"
            : "Petugas";
  useEffect(() => {
    if (!user) return;
    const nextKabupaten = isSuperAdmin ? "Semua wilayah" : user.kabupaten?.trim().toLowerCase() || "tabanan";
    setActiveKabupaten(nextKabupaten);
  }, [isSuperAdmin, user]);

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.18),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(8,145,178,0.14),_transparent_24%),linear-gradient(180deg,_#f6fdfa_0%,_#eef8f7_48%,_#f8fafc_100%)]">
      <div className="w-full px-3 pb-6 pt-3 sm:px-4 sm:pb-8 sm:pt-4 lg:px-6 xl:px-8">
        <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/88 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.28)] backdrop-blur sm:rounded-[32px]">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-400" />
          <div className="absolute -left-12 top-10 h-40 w-40 rounded-full bg-teal-100/70 blur-3xl" />
          <div className="absolute -right-12 bottom-0 h-48 w-48 rounded-full bg-cyan-100/80 blur-3xl" />

          <div className="relative border-b border-slate-200/70 px-4 py-3 sm:px-6 xl:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push("/admin/module-selection")}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:text-teal-700"
                  aria-label="Kembali"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div className="flex items-center gap-3 rounded-2xl border border-teal-100 bg-teal-50/70 px-3 py-2">
                  <div className="relative h-11 w-11 overflow-hidden rounded-xl bg-white ring-1 ring-teal-100">
                    <Image src="/BDG1.png" alt="Bali Gerbang Digital" fill className="object-contain p-1.5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-teal-700">Admin O&M</div>
                    <div className="text-sm font-semibold text-slate-900">Operations Console</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Peran</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{roleLabel}</div>
                </div>
                <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-2 shadow-sm">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-teal-700">Kabupaten</div>
                  {isSuperAdmin ? (
                    <><div className="mt-1 text-sm font-semibold text-slate-900">Semua wilayah</div><div className="mt-1 text-[11px] text-teal-700">Tabanan dan Denpasar</div></>
                  ) : (
                    <>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{activeKabupaten}</div>
                      <div className="mt-1 text-[11px] text-teal-700">Terkunci dari akun</div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 via-teal-700 to-cyan-600 text-sm font-bold text-white">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="max-w-[180px] truncate text-sm font-semibold text-slate-900">
                      {user?.displayName || user?.email || "Pengguna O&M"}
                    </div>
                    <div className="text-xs text-slate-500">Dashboard operasional harian</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative grid gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[minmax(0,1.7fr)_340px] xl:gap-5 xl:px-7 xl:py-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-teal-700 shadow-sm">
                <WrenchIcon />
                Operation & Maintenance
              </div>
              <h1 className="mt-4 max-w-5xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl xl:text-[3.35rem] xl:leading-[1.02]">
                Dashboard O&M yang lebih rapi, cepat dibaca, dan tetap satu keluarga dengan modul GESA.
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600 sm:text-base">
                Pusat kendali untuk laporan, distribusi tugas, dan pengelolaan petugas lapangan dengan visual yang lebih tegas dan karakter warna yang lebih teknis.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Menu Aktif</div>
                  <div className="mt-2 text-2xl font-bold text-slate-950">{menuCards.length}</div>
                  <div className="mt-1 text-sm text-slate-600">Area kerja utama tersedia</div>
                </div>
                <div className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">Mode</div>
                  <div className="mt-2 text-2xl font-bold text-slate-950">Live</div>
                  <div className="mt-1 text-sm text-slate-600">Siap untuk monitoring dan update</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">Fokus</div>
                  <div className="mt-2 text-lg font-bold text-slate-950">Respons Cepat</div>
                  <div className="mt-1 text-sm text-slate-600">Alur admin dibuat lebih ringkas</div>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Status</div>
                  <div className="mt-2 text-lg font-bold text-slate-950">Siap Operasi</div>
                  <div className="mt-1 text-sm text-slate-600">Panel admin dibuat untuk alur harian</div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(15,118,110,0.92))] p-5 text-white shadow-[0_24px_48px_-24px_rgba(15,23,42,0.65)] xl:self-start">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-100/90">Karakter Modul</div>
              <h2 className="mt-3 text-[1.75rem] font-bold leading-tight">Teknis, tenang, dan fokus operasional.</h2>
              <p className="mt-3 text-sm leading-6 text-teal-50/90">
                Gaya O&M diarahkan lebih bersih daripada layar lama, dekat dengan panel GESA dan Konstruksi, tetapi tetap punya identitas lewat aksen teal-cyan dan panel status yang lebih utilitarian.
              </p>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-teal-100/80">Prioritas 01</div>
                  <div className="mt-1 text-sm font-semibold">Monitoring laporan dan histori pekerjaan</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-teal-100/80">Prioritas 02</div>
                  <div className="mt-1 text-sm font-semibold">Distribusi tugas dan pengelolaan petugas</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-teal-100/80">Prioritas 03</div>
                  <div className="mt-1 text-sm font-semibold">Kontrol akses dan administrasi pengguna</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="-mt-2 grid gap-3 md:grid-cols-2 xl:-mt-6 xl:grid-cols-3 2xl:grid-cols-5">
          {menuCards.map((card) => (
            <button
              key={card.id}
              onClick={() => router.push(card.route)}
              className="group relative overflow-hidden rounded-[26px] border border-white/70 bg-white/90 p-4 text-left shadow-[0_18px_40px_-26px_rgba(15,23,42,0.38)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_60px_-28px_rgba(8,145,178,0.4)]"
            >
              <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${card.accent}`} />
              <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-slate-100/70 blur-2xl transition duration-300 group-hover:bg-teal-100/80" />

              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-white shadow-lg shadow-slate-300/40`}>
                    {card.icon}
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                    {card.eyebrow}
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-lg font-bold text-slate-950">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-sm font-semibold text-slate-700">Buka menu</span>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition group-hover:border-teal-200 group-hover:text-teal-700">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
