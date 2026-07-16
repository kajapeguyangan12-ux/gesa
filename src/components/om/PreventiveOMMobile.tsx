"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

type PreventiveTab = "home" | "notifications" | "scan" | "profile";

type PreventiveCard = {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  icon: ReactNode;
};

type OMNotification = {
  id: string;
  title: string;
  message: string;
  source: string;
  reportId: string;
  createdAt: string | null;
};

type OMTask = {
  id: string;
  title: string;
  message: string;
  taskId: string;
  taskType: string;
  scope: "group" | "point" | string;
  groupId?: string;
  groupName?: string;
  pointId?: string;
  pointName?: string;
  repeatMode?: string;
  luxTarget?: string;
  targetPoints?: OMTaskPoint[];
  status?: string;
  createdAt: string | null;
};

type OMReport = {
  id: string;
  title: string;
  description: string;
  reportType: string;
  location: string;
  damageType?: string;
  idTitik?: string;
  photoDamageName?: string;
  photoPoleName?: string;
  phoneNumber?: string;
  taskStatus?: string;
  status: string;
  createdAt: string | null;
};

type ApjPoint = {
  id: string;
  idTitik: string;
  namaTitik?: string;
  namaJalan: string;
  kabupaten: string;
  dayaLampu: string;
  surveyorName: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  group?: string;
  validatedAt?: string;
  operationalAt?: string;
  source?: string;
  status?: string;
  stage?: string;
  rawPayload?: Record<string, unknown>;
};

type OMTaskPoint = {
  idTitik: string;
  namaTitik?: string;
  namaJalan?: string;
  dayaLampu?: string;
  latitude?: number;
  longitude?: number;
  operationalAt?: string;
  nextDueAt?: string;
};

const OMTaskPointMap = dynamic(() => import("@/components/om/OMTaskPointMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-slate-50 text-xs text-slate-500">Memuat peta titik...</div>,
});

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

type PointDetailEntry = [string, unknown];

const displayedRawPointKeys = new Set([
  "id", "idTitik", "id_titik", "namaTitik", "nama_titik", "namaJalan", "nama_jalan", "jalan",
  "kabupaten", "kecamatan", "dayaLampu", "daya_lampu", "grup", "group", "zona",
  "noSeriTiangArm", "no_seri_tiang_arm", "noSeriLampu1", "no_seri_lampu_1", "noSeriLampu2", "no_seri_lampu_2",
  "lebarJalan", "lebar_jalan", "fungsiRuas", "fungsi_ruas", "tiang", "lenganArm", "lengan_arm",
  "armAgExs", "arm_ag_exs", "presetIluminasi", "preset_iluminasi", "presetIluminasiAwal",
  "preset_iluminasi_awal", "presetIluminasiBatas", "preset_iluminasi_batas", "latitude", "lat",
  "longitude", "lng", "lon", "instalasi", "keteranganTitik", "keterangan_titik", "status",
  "kontruksiStatus", "stage", "tahap", "type", "source", "surveyorName", "surveyor_name",
  "createdAt", "created_at", "validatedAt", "validated_at", "operationalAt", "operational_at",
]);

function pickRawPointValue(raw: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function pointDetailSections(point: ApjPoint) {
  const raw = point.rawPayload || {};
  const primary: PointDetailEntry[] = [
    ["ID Titik APJ", point.idTitik || pickRawPointValue(raw, "idTitik", "id_titik")],
    ["Nama Titik", point.namaTitik || pickRawPointValue(raw, "namaTitik", "nama_titik")],
    ["No Seri Tiang/Arm", pickRawPointValue(raw, "noSeriTiangArm", "no_seri_tiang_arm")],
    ["No Seri Lampu 1", pickRawPointValue(raw, "noSeriLampu1", "no_seri_lampu_1")],
    ["No Seri Lampu 2", pickRawPointValue(raw, "noSeriLampu2", "no_seri_lampu_2")],
    ["Kabupaten", point.kabupaten || pickRawPointValue(raw, "kabupaten")],
    ["Kecamatan", pickRawPointValue(raw, "kecamatan")],
    ["Nama Jalan", point.namaJalan || pickRawPointValue(raw, "namaJalan", "nama_jalan", "jalan")],
    ["Lebar Jalan", pickRawPointValue(raw, "lebarJalan", "lebar_jalan")],
    ["Fungsi Ruas", pickRawPointValue(raw, "fungsiRuas", "fungsi_ruas")],
    ["Grup APJ", point.group || pickRawPointValue(raw, "group", "grup")],
    ["Zona / Label Area", pickRawPointValue(raw, "zona")],
    ["Daya Lampu", point.dayaLampu || pickRawPointValue(raw, "dayaLampu", "daya_lampu")],
    ["Tiang", pickRawPointValue(raw, "tiang")],
    ["Lengan ARM", pickRawPointValue(raw, "lenganArm", "lengan_arm")],
    ["ARM AG/EXS", pickRawPointValue(raw, "armAgExs", "arm_ag_exs")],
    ["Preset Iluminasi", pickRawPointValue(raw, "presetIluminasi", "preset_iluminasi")],
    ["Preset Iluminasi Awal", pickRawPointValue(raw, "presetIluminasiAwal", "preset_iluminasi_awal")],
    ["Batas Preset Iluminasi", pickRawPointValue(raw, "presetIluminasiBatas", "preset_iluminasi_batas")],
    ["Latitude", point.latitude || pickRawPointValue(raw, "latitude", "lat")],
    ["Longitude", point.longitude || pickRawPointValue(raw, "longitude", "lng", "lon")],
    ["Instalasi", pickRawPointValue(raw, "instalasi")],
    ["Keterangan Titik", pickRawPointValue(raw, "keteranganTitik", "keterangan_titik")],
  ];
  const system: PointDetailEntry[] = [
    ["Status", point.status],
    ["Tahap", point.stage],
    ["Sumber", point.source],
    ["Surveyor", point.surveyorName],
    ["Tanggal Dibuat", formatDateTime(point.createdAt)],
    ["Tanggal Validasi", formatDateTime(point.validatedAt)],
    ["Tanggal Operasi", formatDateTime(point.operationalAt)],
  ];
  const rawEntries = Object.entries(raw)
    .filter(([key, value]) => !displayedRawPointKeys.has(key) && value !== undefined && value !== "")
    .map(([key, value]) => [`Raw: ${key}`, value] as PointDetailEntry);
  const hasValue = ([, value]: PointDetailEntry) => value !== undefined && value !== null && value !== "" && value !== "-";
  return { primary, system: system.filter(hasValue), raw: rawEntries };
}

function PointDetailFields({ point }: { point: ApjPoint }) {
  const sections = pointDetailSections(point);
  const renderEntries = (entries: PointDetailEntry[]) => entries.map(([label, value]) => (
    <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-1 break-words text-xs font-semibold text-slate-800">{formatDetailValue(value)}</div>
    </div>
  ));

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">Data Utama</div>
        <div className="space-y-2">{renderEntries(sections.primary)}</div>
      </section>
      {sections.system.length ? (
        <section>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Informasi Sistem</div>
          <div className="space-y-2">{renderEntries(sections.system)}</div>
        </section>
      ) : null}
      {sections.raw.length ? (
        <section>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Data Teknis Tambahan</div>
          <div className="space-y-2">{renderEntries(sections.raw)}</div>
        </section>
      ) : null}
    </div>
  );
}

export function isPreventiveOmRole(role?: string | null) {
  return role === "petugas-om" || role === "petugas-om-preventif";
}

export function isCorrectiveOmRole(role?: string | null) {
  return role === "petugas-om-correctif";
}

export function isMobileOmRole(role?: string | null) {
  return isPreventiveOmRole(role) || isCorrectiveOmRole(role);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function RedDecorations() {
  return (
    <>
      <div className="pointer-events-none absolute left-4 top-0 h-32 w-12">
        <div className="absolute left-0 top-0 h-full w-0.5 bg-red-600" />
        <div className="absolute left-2 top-0 h-full w-0.5 bg-red-300" />
        <div className="absolute left-0 top-8 h-0.5 w-9 bg-red-600" />
        <div className="absolute left-0 top-12 h-0.5 w-9 bg-red-300" />
      </div>
      <div className="pointer-events-none absolute bottom-16 left-0 right-0 overflow-hidden">
        <svg viewBox="0 0 420 150" className="h-32 w-full">
          <path d="M0 112 C86 74, 132 78, 196 106 C258 132, 326 138, 420 54 L420 150 L0 150 Z" fill="#ef1f1f" />
          <path d="M0 94 C86 56, 132 60, 196 88 C258 114, 326 120, 420 36" fill="none" stroke="#fff" strokeWidth="7" />
          <path d="M0 104 C86 66, 132 70, 196 98 C258 124, 326 130, 420 46" fill="none" stroke="#fecaca" strokeWidth="5" />
        </svg>
      </div>
    </>
  );
}

function PreventiveTopBar({ title, onBack }: { title: string; onBack?: () => void }) {
  const router = useRouter();
  const handleBack = onBack || (() => router.push("/module-selection"));

  return (
    <header className="relative flex h-14 items-center justify-between border-b border-gray-300 bg-gray-100 px-3">
      <button
        type="button"
        onClick={handleBack}
        className="z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black text-white shadow-sm"
        aria-label={onBack ? "Kembali" : "Kembali ke modul GESA"}
        title={onBack ? "Kembali" : "Kembali ke modul GESA"}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 className="absolute inset-x-14 truncate text-center text-base font-bold text-gray-950">{title}</h1>
      <div className="relative z-10 h-8 w-16">
        <Image src="/BDG1.png" alt="BGD" fill className="object-contain" />
      </div>
    </header>
  );
}

function IconHome() {
  return (
    <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
      <path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.1} d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9" />
    </svg>
  );
}

function IconQr() {
  return (
    <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
      <path d="M3 3h7v7H3zm2 2v3h3V5zm9-2h7v7h-7zm2 2v3h3V5zM3 14h7v7H3zm2 2v3h3v-3zm9-2h2v2h-2zm2 2h2v2h-2zm-4 2h2v2h-2zm6 0h3v3h-2v-1h-1zm-4 2h2v2h-2z" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="4.25" strokeWidth={1.8} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

function BottomNav({ active }: { active: PreventiveTab }) {
  const router = useRouter();
  const navItems: Array<{ id: PreventiveTab; label: string; route: string; icon: ReactNode }> = [
    { id: "home", label: "Home", route: "/om", icon: <IconHome /> },
    { id: "notifications", label: "Notifikasi", route: "/om/notifications", icon: <IconBell /> },
    { id: "scan", label: "Scan", route: "/om/scan", icon: <IconQr /> },
    { id: "profile", label: "Profil", route: "/om/profile", icon: <IconUser /> },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-300 bg-[#f7d7d9]">
      <div className="mx-auto grid h-16 w-full max-w-md grid-cols-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => router.push(item.route)}
            className={`flex flex-col items-center justify-center gap-0.5 ${active === item.id ? "text-black" : "text-gray-600"}`}
            aria-label={item.label}
          >
            {item.icon}
            <span className="sr-only">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function PreventiveLayout({
  title,
  activeTab,
  onBack,
  children,
}: {
  title: string;
  activeTab: PreventiveTab;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto min-h-screen w-full max-w-md overflow-hidden border-x border-gray-300 bg-white shadow-sm">
        <div className="relative min-h-screen pb-20">
          <RedDecorations />
          <PreventiveTopBar title={title} onBack={onBack} />
          <main className="relative z-10 px-4 pb-6 pt-5">{children}</main>
        </div>
      </div>
      <BottomNav active={activeTab} />
    </div>
  );
}

function DashboardCard({ title, subtitle, icon, route }: PreventiveCard) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(route)}
      className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-gray-400 bg-white px-3 py-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-red-400 hover:shadow-md"
    >
      <div className="mb-3 text-black">{icon}</div>
      <div className="text-sm font-bold leading-tight text-gray-950">{title}</div>
      <div className="mt-1 text-[11px] leading-tight text-gray-500">{subtitle}</div>
    </button>
  );
}

function IconReport() {
  return (
    <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 64 64">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.8} d="M23 18H42l8 8v20a4 4 0 0 1-4 4H23a4 4 0 0 1-4-4V22a4 4 0 0 1 4-4Z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.8} d="M42 18v8h8M15 43l9-8 7 6 9-10M13 47h13" />
    </svg>
  );
}

function IconTask() {
  return (
    <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 64 64">
      <rect x="15" y="13" width="34" height="40" rx="4" strokeWidth={2.8} />
      <rect x="24" y="8" width="16" height="10" rx="3" strokeWidth={2.8} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.8} d="M23 27h18M23 35h18M23 43h11" />
      <circle cx="47" cy="45" r="8" strokeWidth={2.8} />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 64 64">
      <rect x="14" y="14" width="34" height="38" rx="4" strokeWidth={2.8} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.8} d="M23 26h18M23 34h18M23 42h11" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.8} d="M49 18v12h10" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.8} d="M58 30a13 13 0 1 1-3.8-9.2" />
    </svg>
  );
}

function IconMapPoint() {
  return (
    <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 64 64">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.8} d="M12 17l13-6 14 6 13-6v36l-13 6-14-6-13 6z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.8} d="M25 11v36M39 17v36" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.8} d="M36 29c0 5-6 11-6 11s-6-6-6-11a6 6 0 1 1 12 0z" />
      <circle cx="30" cy="29" r="2" strokeWidth={2.8} />
    </svg>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-red-100 bg-white/90 px-3 py-2 shadow-sm">
      <div className="text-[11px] font-semibold uppercase text-gray-500">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-gray-950">{value}</div>
    </div>
  );
}

function DataField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <div className="text-[11px] leading-none text-gray-600">{label}</div>
      <div className="mt-1 min-h-8 rounded-md border border-gray-400 bg-white px-2 py-1.5 text-xs font-medium text-gray-900">
        {value || "-"}
      </div>
    </div>
  );
}

function UploadLikeField({
  label,
  fileName,
  onChange,
}: {
  label: string;
  fileName: string;
  onChange: (fileName: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] leading-none text-gray-600">{label}</span>
      <div className="mt-1 flex min-h-8 items-center rounded-md border border-gray-400 bg-white px-2 py-1.5">
        <span className="min-w-0 flex-1 truncate text-xs text-gray-500">{fileName || "Upload Foto"}</span>
        <svg className="h-4 w-4 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1M12 4v12m0-12 4 4m-4-4-4 4" />
        </svg>
      </div>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0]?.name || "")}
      />
    </label>
  );
}

function ReportDetailPanel({
  report,
  variant,
  onBack,
}: {
  report: OMReport;
  variant: "report" | "task";
  onBack: () => void;
}) {
  const title = variant === "report" ? "Detail Laporan" : "Detail Tugas";

  return (
    <PreventiveLayout title={title} activeTab="home" onBack={onBack}>
      <div className="rounded-lg border-2 border-sky-500 bg-white p-4 shadow-sm">
        <div className="mb-4 text-center text-xs font-medium text-gray-700">Data Laporan</div>
        <div className="space-y-2">
          <DataField label="Jenis Kerusakan" value={report.damageType || report.title} />
          <DataField label="Deskripsi Kerusakan" value={report.description} />
          <DataField label="Upload Foto Kerusakan" value={report.photoDamageName} />
          <DataField label="Data Foto" value={report.photoDamageName ? "Tersimpan" : "-"} />
          <DataField label="ID Tiang / Scan Tiang" value={report.idTitik || report.location} />
          <DataField label="Data ID Tiang" value={report.idTitik} />
          <DataField label="No. Telp" value={report.phoneNumber} />
          <DataField label="Data No. Telp" value={report.phoneNumber} />
        </div>
        <button type="button" className="mx-auto mt-9 block rounded-md border border-gray-400 bg-white px-8 py-2 text-xs font-semibold text-gray-900">
          {variant === "report" ? report.status || "Status Laporan" : report.taskStatus || "Status"}
        </button>
      </div>
    </PreventiveLayout>
  );
}

function useMyReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<OMReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadReports = async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/om/reports/my?uid=${encodeURIComponent(user.uid)}&limit=50`, { cache: "no-store" });
      const payload = (await response.json()) as { reports?: OMReport[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal memuat laporan.");
      setReports(payload.reports || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat laporan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  return { reports, loading, error, reload: loadReports };
}

export function PreventiveOMDashboard() {
  const { user } = useAuth();
  const { reports, loading } = useMyReports();
  const isCorrective = isCorrectiveOmRole(user?.role);
  const reportType = isCorrective ? "korektif" : "preventif";
  const roleLabel = isCorrective ? "O&M Corrective" : "O&M Preventif";
  const cards = useMemo<PreventiveCard[]>(
    () => [
      { id: "laporan", title: "Laporan Kerusakan", subtitle: isCorrective ? "Kirim laporan corrective" : "Kirim laporan preventif", route: "/om/laporan-tugas", icon: <IconReport /> },
      { id: "tugas", title: "Daftar Tugas", subtitle: "Tugas dari admin", route: "/om/distribusi-tugas", icon: <IconTask /> },
      { id: "maps", title: "Maps APJ", subtitle: "Titik menyala per grup", route: "/om/maps", icon: <IconMapPoint /> },
      { id: "riwayat-laporan", title: "Riwayat Laporan Saya", subtitle: "Laporan yang dikirim", route: "/om/history-laporan", icon: <IconHistory /> },
      { id: "riwayat-tugas", title: "Riwayat Tugas Saya", subtitle: "Aktivitas pekerjaan", route: "/om/daftar-laporan", icon: <IconHistory /> },
    ],
    [isCorrective]
  );

  return (
    <PreventiveLayout title="Dashboard" activeTab="home">
      <div className="mb-5 rounded-lg border border-red-100 bg-white/90 p-4 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-red-600">{roleLabel}</div>
        <div className="mt-1 text-xl font-bold text-gray-950">{user?.displayName || user?.name || "Petugas O&M"}</div>
        <div className="mt-1 text-sm text-gray-500">{user?.kabupaten ? `Area ${user.kabupaten}` : "Area kerja belum diset"}</div>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2">
        <MiniStat label="Laporan" value={loading ? "..." : reports.length} />
        <MiniStat label="Baru" value={loading ? "..." : reports.filter((item) => item.status === "new").length} />
        <MiniStat label={isCorrective ? "Corrective" : "Preventif"} value={loading ? "..." : reports.filter((item) => item.reportType === reportType).length} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {cards.map((card) => (
          <DashboardCard key={card.id} {...card} />
        ))}
      </div>
    </PreventiveLayout>
  );
}

export function PreventiveOMNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<OMNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    const loadNotifications = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          uid: user.uid || "",
          role: user.role || "",
          limit: "50",
        });
        const response = await fetch(`/api/om/notifications?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as { notifications?: OMNotification[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Gagal memuat notifikasi.");
        setNotifications(payload.notifications || []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Gagal memuat notifikasi.");
      } finally {
        setLoading(false);
      }
    };
    void loadNotifications();
  }, [user]);

  return (
    <PreventiveLayout title="Notifikasi" activeTab="notifications" onBack={() => window.history.back()}>
      <div className="space-y-3">
        {loading ? <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">Memuat notifikasi...</div> : null}
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {!loading && !error && notifications.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">Belum ada notifikasi O&M.</div>
        ) : null}
        {notifications.map((item) => (
          <div key={item.id} className="rounded-lg border border-gray-300 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-gray-950">{item.title}</div>
                <div className="mt-1 text-xs leading-5 text-gray-600">{item.message}</div>
              </div>
              <div className="shrink-0 text-right text-[11px] text-gray-500">{formatDateTime(item.createdAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </PreventiveLayout>
  );
}

function parseScanTarget(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const queryId = url.searchParams.get("id_titik") || url.searchParams.get("idTitik") || url.searchParams.get("titik") || url.searchParams.get("id");
    if (queryId) return queryId.trim();
    const pathParts = url.pathname.split("/").filter(Boolean);
    return pathParts[pathParts.length - 1] || "";
  } catch {
    return trimmed;
  }
}

export function PreventiveOMScan() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<{ stop: () => void; destroy: () => void } | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [scanStatus, setScanStatus] = useState("Kamera belum aktif.");
  const [scanning, setScanning] = useState(false);
  const [photoScanning, setPhotoScanning] = useState(false);
  const [scannedId, setScannedId] = useState("");
  const [scannedPoint, setScannedPoint] = useState<ApjPoint | null>(null);
  const [pointLoading, setPointLoading] = useState(false);
  const [pointError, setPointError] = useState("");

  const stopCamera = () => {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
    setScanning(false);
  };

  const lookupPoint = async (idTitik: string) => {
    setScannedId(idTitik);
    setPointError("");
    setScannedPoint(null);
    setPointLoading(true);
    try {
      const response = await fetch(`/api/om/apj-point/${encodeURIComponent(idTitik)}`, { cache: "no-store" });
      const payload = (await response.json()) as { latest?: ApjPoint; error?: string };
      if (!response.ok || !payload.latest) {
        throw new Error(payload.error || "Data titik tidak ditemukan.");
      }
      setScannedPoint(payload.latest);
      setScanStatus(`ID ${idTitik} ditemukan. Lihat detail titik di bawah.`);
    } catch (lookupError) {
      setPointError(lookupError instanceof Error ? lookupError.message : "Gagal memuat detail titik.");
      setScanStatus("Barcode terbaca, tetapi detail titik belum ditemukan.");
    } finally {
      setPointLoading(false);
    }
  };

  const openPoint = (rawValue: string) => {
    const idTitik = parseScanTarget(rawValue);
    if (!idTitik) {
      setScanStatus("Isi barcode tidak memuat ID titik.");
      return;
    }
    stopCamera();
    void lookupPoint(idTitik);
  };

  const startCamera = async () => {
    setScanStatus("Mengaktifkan kamera...");
    try {
      if (!videoRef.current) throw new Error("Elemen kamera belum siap.");
      stopCamera();
      const { default: QrScanner } = await import("qr-scanner");
      const scanner = new QrScanner(
        videoRef.current,
        (result) => openPoint(result.data),
        {
          preferredCamera: "environment",
          maxScansPerSecond: 10,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          returnDetailedScanResult: true,
        }
      );
      scannerRef.current = scanner;
      await scanner.start();
      setScanning(true);
      setScanStatus("Arahkan kamera belakang ke QR titik APJ.");
    } catch (cameraError) {
      console.error(cameraError);
      stopCamera();
      const errorName = cameraError instanceof DOMException ? cameraError.name : "";
      setScanStatus(
        errorName === "NotAllowedError"
          ? "Izin kamera ditolak. Aktifkan izin kamera untuk situs ini di pengaturan Safari/browser."
          : "Gagal membuka kamera. Pastikan akses melalui HTTPS dan kamera tidak sedang digunakan aplikasi lain."
      );
    }
  };

  const scanPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    stopCamera();
    setPhotoScanning(true);
    setScanStatus("Membaca QR dari foto...");
    try {
      const { default: QrScanner } = await import("qr-scanner");
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      openPoint(typeof result === "string" ? result : result.data);
    } catch (scanError) {
      console.error(scanError);
      setScanStatus("QR tidak ditemukan pada foto. Coba foto lebih dekat, terang, dan tidak miring.");
    } finally {
      setPhotoScanning(false);
    }
  };

  useEffect(() => stopCamera, []);

  return (
    <PreventiveLayout title="Scan QR Titik" activeTab="scan" onBack={() => router.push("/om")}>
      <div className="space-y-4">
        <div className="overflow-hidden rounded-lg border border-gray-300 bg-black shadow-sm">
          <video ref={videoRef} className="aspect-[3/4] w-full object-cover" muted playsInline />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-600 shadow-sm">{scanStatus}</div>
        {scannedId ? (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-600">Hasil Scan</div>
            <div className="mt-1 text-lg font-bold text-gray-950">{scannedId}</div>
            {pointLoading ? <div className="mt-2 text-sm text-gray-500">Memuat detail titik...</div> : null}
            {pointError ? <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{pointError}</div> : null}
            {scannedPoint ? (
              <div className="mt-3 space-y-2 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                <div className="text-sm font-bold text-gray-950">{scannedPoint.namaJalan || scannedPoint.namaTitik || scannedId}</div>
                <div className="text-xs text-gray-600">Kabupaten: {scannedPoint.kabupaten}</div>
                <div className="text-xs text-gray-600">Daya: {scannedPoint.dayaLampu}</div>
                <div className="text-xs text-gray-600">Koordinat: {Number.isFinite(scannedPoint.latitude) ? scannedPoint.latitude.toFixed(5) : "-"}, {Number.isFinite(scannedPoint.longitude) ? scannedPoint.longitude.toFixed(5) : "-"}</div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const returnTo = searchParams.get("returnTo") || "/om/distribusi-tugas";
                      const workTaskId = searchParams.get("workTaskId") || "";
                      const params = new URLSearchParams();
                      params.set("scanId", scannedPoint.idTitik || scannedId);
                      if (workTaskId) params.set("workTaskId", workTaskId);
                      router.push(`${returnTo}?${params.toString()}`);
                    }}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Pakai ke Form Pengerjaan
                  </button>
                  <button type="button" onClick={() => router.push(`/om/apj-point/${encodeURIComponent(scannedPoint.idTitik || scannedId)}`)} className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white">
                    Buka Detail Titik
                  </button>
                  <button type="button" onClick={() => router.push(`/om/apj-point/${encodeURIComponent(scannedPoint.idTitik || scannedId)}/qr`)} className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
                    QR Titik
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => void startCamera()} className="rounded-lg bg-black px-4 py-3 text-sm font-semibold text-white">
            {scanning ? "Scan Aktif" : "Buka Kamera"}
          </button>
          <button type="button" onClick={stopCamera} className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-900">
            Matikan
          </button>
        </div>
        <label className="block cursor-pointer rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-center text-sm font-semibold text-sky-800">
          {photoScanning ? "Membaca Foto..." : "Ambil Foto / Pilih Foto QR"}
          <input type="file" accept="image/*" capture="environment" onChange={(event) => void scanPhoto(event)} disabled={photoScanning} className="sr-only" />
        </label>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Pada iPhone, pilih <b>Izinkan Kamera</b> saat diminta. Jika kamera sulit fokus, gunakan tombol ambil foto di atas.
        </div>
        <div className="rounded-lg border border-gray-300 bg-white p-3 shadow-sm">
          <label className="text-xs font-semibold uppercase text-gray-500">Input manual ID/link titik</label>
          <div className="mt-2 flex gap-2">
            <input
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-red-400"
              placeholder="APJ-001 atau link sistem"
            />
            <button type="button" onClick={() => openPoint(manualValue)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">
              Buka
            </button>
          </div>
        </div>
      </div>
    </PreventiveLayout>
  );
}

export function PreventiveOMApjPoint({ idTitik }: { idTitik: string }) {
  const router = useRouter();
  const [point, setPoint] = useState<ApjPoint | null>(null);
  const [history, setHistory] = useState<ApjPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPoint = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/om/apj-point/${encodeURIComponent(idTitik)}`, { cache: "no-store" });
        const payload = (await response.json()) as { latest?: ApjPoint; history?: ApjPoint[]; error?: string };
        if (!response.ok || !payload.latest) throw new Error(payload.error || "Data titik tidak ditemukan.");
        setPoint(payload.latest);
        setHistory(payload.history || []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Gagal memuat titik APJ.");
      } finally {
        setLoading(false);
      }
    };
    void loadPoint();
  }, [idTitik]);

  return (
    <PreventiveLayout title="Detail Titik APJ" activeTab="scan" onBack={() => router.push("/om/scan")}>
      {loading ? <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">Memuat data titik...</div> : null}
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {point ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase text-red-600">ID Titik</div>
            <div className="mt-1 text-2xl font-bold text-gray-950">{point.idTitik || idTitik}</div>
            <div className="mt-2 text-sm text-gray-600">{point.namaJalan}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Kabupaten" value={point.kabupaten} />
            <MiniStat label="Daya" value={point.dayaLampu} />
            <MiniStat label="Lat" value={Number.isFinite(point.latitude) ? point.latitude.toFixed(5) : "-"} />
            <MiniStat label="Lng" value={Number.isFinite(point.longitude) ? point.longitude.toFixed(5) : "-"} />
          </div>
          <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-sm">
            <div className="text-sm font-bold text-gray-950">Data Survey Terakhir</div>
            <div className="mt-2 text-sm text-gray-600">Surveyor: {point.surveyorName}</div>
            <div className="text-sm text-gray-600">Waktu: {formatDateTime(point.createdAt)}</div>
            {Number.isFinite(point.latitude) && Number.isFinite(point.longitude) ? (
              <a
                href={`https://www.google.com/maps?q=${point.latitude},${point.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white"
              >
                Buka Maps
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => router.push(`/om/apj-point/${encodeURIComponent(point.idTitik || idTitik)}/qr`)}
              className="ml-2 mt-3 inline-flex rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700"
            >
              Generate QR
            </button>
          </div>
          <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-bold text-gray-950">Semua Data Titik</div>
            <PointDetailFields point={point} />
          </div>
          <div className="rounded-lg border border-gray-300 bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-bold text-gray-950">Riwayat Data</div>
            <div className="space-y-2">
              {history.map((item) => (
                <div key={item.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                  <div className="font-semibold text-gray-950">{item.namaJalan || item.idTitik}</div>
                  <div className="text-xs text-gray-500">{formatDateTime(item.createdAt)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </PreventiveLayout>
  );
}

export function PreventiveOMReportsList({ mode }: { mode: "reports" | "tasks" }) {
  const { reports, loading, error, reload } = useMyReports();
  const [selectedReport, setSelectedReport] = useState<OMReport | null>(null);
  const title = mode === "reports" ? "Riwayat Laporan Saya" : "Riwayat Tugas Saya";

  if (selectedReport) {
    return (
      <ReportDetailPanel
        report={selectedReport}
        variant={mode === "reports" ? "report" : "task"}
        onBack={() => setSelectedReport(null)}
      />
    );
  }

  return (
    <PreventiveLayout title={title} activeTab="home" onBack={() => window.history.back()}>
      <div className="space-y-3">
        <button type="button" onClick={() => void reload()} className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm">
          Refresh
        </button>
        {loading ? <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">Memuat data...</div> : null}
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {!loading && !error && reports.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">Belum ada data.</div>
        ) : null}
        {reports.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => setSelectedReport(item)}
            className="block w-full rounded-md border border-gray-400 bg-white p-2 text-left shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-gray-950">{item.idTitik || item.location || "ID Tiang"}</div>
                <div className="mt-0.5 text-[11px] text-gray-500">{formatDateTime(item.createdAt)}</div>
              </div>
              <span className="shrink-0 text-[11px] font-semibold text-gray-700">{mode === "reports" ? "Status Laporan" : "Status"}</span>
            </div>
          </button>
        ))}
      </div>
    </PreventiveLayout>
  );
}

export function PreventiveOMTaskList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const workScannerVideoRef = useRef<HTMLVideoElement | null>(null);
  const workScannerRef = useRef<{ stop: () => void; destroy: () => void } | null>(null);
  const isCorrective = isCorrectiveOmRole(user?.role);
  const [items, setItems] = useState<OMTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<OMTask | null>(null);
  const [taskMapPoints, setTaskMapPoints] = useState<OMTaskPoint[]>([]);
  const [selectedTaskPointId, setSelectedTaskPointId] = useState("");
  const [taskMapLoading, setTaskMapLoading] = useState(false);
  const [pointPreview, setPointPreview] = useState<ApjPoint | null>(null);
  const [pointPreviewLoading, setPointPreviewLoading] = useState(false);
  const [pointPreviewError, setPointPreviewError] = useState("");
  const [workScannerOpen, setWorkScannerOpen] = useState(false);
  const [workScannerStatus, setWorkScannerStatus] = useState("Menyiapkan kamera...");
  const [workPhotoScanning, setWorkPhotoScanning] = useState(false);
  const [workForm, setWorkForm] = useState({
    name: "",
    idTitik: "",
    luxTitikApi: "",
    luxRataRata: "",
    lampCondition: "",
    ornamentCondition: "",
    maintenanceAction: "",
    photoLampName: "",
    photoOrnamentName: "",
    note: "",
  });
  const [submittingWork, setSubmittingWork] = useState(false);
  const [workMessage, setWorkMessage] = useState("");
  const [workError, setWorkError] = useState("");
  const [workFormSnapshot, setWorkFormSnapshot] = useState({
    name: "",
    idTitik: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scanId = searchParams.get("scanId")?.trim() || "";
  const workTaskId = searchParams.get("workTaskId")?.trim() || "";

  const loadTasks = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        uid: user.uid || "",
        role: user.role || "",
        limit: "80",
      });
      const response = await fetch(`/api/om/tasks?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as { tasks?: OMTask[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal memuat tugas.");
      setItems(payload.tasks || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat tugas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, user?.role]);

  useEffect(() => {
    if (!scanId || items.length === 0 || selectedTask) return;
    const task =
      (workTaskId ? items.find((item) => item.taskId === workTaskId || item.id === workTaskId) : null) ||
      items.find((item) => item.taskId === scanId || item.pointId === scanId || item.id === scanId) ||
      null;
    if (!task) return;
    openWorkForm(task, scanId);
    router.replace("/om/distribusi-tugas");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, scanId, workTaskId]);

  useEffect(() => {
    if (!selectedTask || (selectedTask as OMTask & { source?: string }).source === "work-form") return;
    const taskPoints = Array.isArray(selectedTask.targetPoints) ? selectedTask.targetPoints : [];
    setSelectedTaskPointId(selectedTask.scope === "point" ? selectedTask.pointId || "" : "");
    setTaskMapPoints(taskPoints);

    const hasCoordinates = taskPoints.some((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && point.latitude !== 0 && point.longitude !== 0);
    if (hasCoordinates) return;

    let active = true;
    const loadTaskCoordinates = async () => {
      setTaskMapLoading(true);
      try {
        const response = await fetch("/api/om/apj-points", { cache: "no-store" });
        const payload = (await response.json()) as {
          groups?: Array<{ id: string; name: string; points: OMTaskPoint[] }>;
          points?: OMTaskPoint[];
        };
        if (!response.ok || !active) return;
        const allPoints = payload.points || payload.groups?.flatMap((group) => group.points || []) || [];
        const targetIds = new Set(taskPoints.map((point) => point.idTitik).filter(Boolean));
        const matchingGroup = payload.groups?.find(
          (group) => group.id === selectedTask.groupId || group.name === selectedTask.groupName || group.name === selectedTask.groupId
        );
        const resolved = targetIds.size > 0 ? allPoints.filter((point) => targetIds.has(point.idTitik)) : matchingGroup?.points || [];
        if (active) setTaskMapPoints(resolved.length ? resolved : taskPoints);
      } catch {
        if (active) setTaskMapPoints(taskPoints);
      } finally {
        if (active) setTaskMapLoading(false);
      }
    };
    void loadTaskCoordinates();
    return () => {
      active = false;
    };
  }, [selectedTask?.id, selectedTask?.scope]);

  const openWorkForm = (task: OMTask, presetIdTitik = "") => {
    const initialIdTitik = presetIdTitik || (task.scope === "point" ? task.pointId || "" : "");
    setWorkForm({
      name: user?.displayName || user?.name || "",
      idTitik: initialIdTitik,
      luxTitikApi: "",
      luxRataRata: "",
      lampCondition: "",
      ornamentCondition: "",
      maintenanceAction: "",
      photoLampName: "",
      photoOrnamentName: "",
      note: "",
    });
    setWorkFormSnapshot({ name: user?.displayName || user?.name || "", idTitik: initialIdTitik });
    setWorkError("");
    setWorkMessage("");
    setPointPreview(null);
    setPointPreviewError("");
    setSelectedTask({ ...task, source: "work-form" } as OMTask);
  };

  const stopWorkScanner = () => {
    workScannerRef.current?.stop();
    workScannerRef.current?.destroy();
    workScannerRef.current = null;
  };

  const applyWorkScanResult = (rawValue: string) => {
    const idTitik = parseScanTarget(rawValue);
    if (!idTitik) {
      setWorkScannerStatus("QR tidak memuat ID titik APJ yang valid.");
      return;
    }
    stopWorkScanner();
    setWorkForm((current) => ({ ...current, idTitik }));
    setWorkScannerOpen(false);
    setWorkScannerStatus(`ID ${idTitik} berhasil dipindai.`);
    setWorkError("");
  };

  useEffect(() => {
    if (!workScannerOpen || !workScannerVideoRef.current) return;
    let active = true;
    const start = async () => {
      setWorkScannerStatus("Mengaktifkan kamera belakang...");
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (!active || !workScannerVideoRef.current) return;
        const scanner = new QrScanner(
          workScannerVideoRef.current,
          (result) => applyWorkScanResult(result.data),
          {
            preferredCamera: "environment",
            maxScansPerSecond: 10,
            highlightScanRegion: true,
            highlightCodeOutline: true,
            returnDetailedScanResult: true,
          }
        );
        workScannerRef.current = scanner;
        await scanner.start();
        if (active) setWorkScannerStatus("Arahkan kamera ke QR titik APJ.");
      } catch (scanError) {
        console.error(scanError);
        if (active) setWorkScannerStatus("Kamera tidak dapat dibuka. Periksa izin kamera atau gunakan foto QR.");
      }
    };
    void start();
    return () => {
      active = false;
      stopWorkScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workScannerOpen]);

  const scanWorkPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    stopWorkScanner();
    setWorkPhotoScanning(true);
    setWorkScannerStatus("Membaca QR dari foto...");
    try {
      const { default: QrScanner } = await import("qr-scanner");
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      applyWorkScanResult(typeof result === "string" ? result : result.data);
    } catch (scanError) {
      console.error(scanError);
      setWorkScannerStatus("QR tidak ditemukan. Coba foto lebih dekat dan lebih terang.");
    } finally {
      setWorkPhotoScanning(false);
    }
  };

  useEffect(() => {
    if (!selectedTask || (selectedTask as any).source !== "work-form" || !workForm.idTitik.trim()) {
      setPointPreview(null);
      setPointPreviewError("");
      setPointPreviewLoading(false);
      return;
    }
    let active = true;
    const loadPoint = async () => {
      setPointPreviewLoading(true);
      setPointPreviewError("");
      try {
        const response = await fetch(`/api/om/apj-point/${encodeURIComponent(workForm.idTitik.trim())}`, { cache: "no-store" });
        const payload = (await response.json()) as { latest?: ApjPoint; error?: string };
        if (!response.ok || !payload.latest) {
          if (active) {
            setPointPreview(null);
            setPointPreviewError(payload.error || "Data titik APJ tidak ditemukan.");
          }
          return;
        }
        if (active) setPointPreview(payload.latest);
      } catch {
        if (active) {
          setPointPreview(null);
          setPointPreviewError("Gagal mengambil data titik APJ.");
        }
      } finally {
        if (active) setPointPreviewLoading(false);
      }
    };
    void loadPoint();
    return () => {
      active = false;
    };
  }, [selectedTask, workForm.idTitik]);

  const submitWork = async () => {
    if (!selectedTask || selectedTask.status === "work-form") return;
    setWorkError("");
    setWorkMessage("");
    if (!workForm.idTitik.trim() || !workForm.luxTitikApi.trim() || !workForm.lampCondition.trim() || !workForm.maintenanceAction.trim()) {
      setWorkError("ID titik, lux titik api, kondisi lampu, dan tindakan perawatan wajib diisi.");
      return;
    }
    if (!user?.uid) {
      setWorkError("Sesi login tidak valid.");
      return;
    }
    setSubmittingWork(true);
    try {
      const response = await fetch("/api/om/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Hasil Preventif - ${workForm.idTitik.trim()}`,
          description: workForm.note.trim() || selectedTask.message || "Hasil pengerjaan tugas preventif.",
          reportType: "preventif",
          location: workForm.idTitik.trim(),
          damageType: "Perawatan Preventif",
          idTitik: workForm.idTitik.trim(),
          taskId: selectedTask.taskId || selectedTask.id,
          taskTitle: selectedTask.title,
          taskScope: selectedTask.scope,
          groupId: selectedTask.groupId,
          groupName: selectedTask.groupName,
          luxTitikApi: workForm.luxTitikApi.trim(),
          luxRataRata: workForm.luxRataRata.trim(),
          lampCondition: workForm.lampCondition.trim(),
          ornamentCondition: workForm.ornamentCondition.trim(),
          maintenanceAction: workForm.maintenanceAction.trim(),
          photoLampName: workForm.photoLampName,
          photoOrnamentName: workForm.photoOrnamentName,
          formVariant: "preventive-task",
          reporterUid: user.uid,
          reporterName: workForm.name || user.displayName || user.name || user.email || "Petugas O&M",
          reporterRole: user.role || "petugas-om-preventif",
        }),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal mengirim hasil tugas.");
      await fetch("/api/om/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedTask.taskId || selectedTask.id, status: "selesai", reportId: payload.id || "" }),
      });
      setWorkMessage("Hasil tugas preventif berhasil dikirim.");
      await loadTasks();
    } catch (submitError) {
      setWorkError(submitError instanceof Error ? submitError.message : "Gagal mengirim hasil tugas.");
    } finally {
      setSubmittingWork(false);
    }
  };

  if (selectedTask) {
    if ((selectedTask as any).source === "work-form") {
      return (
        <PreventiveLayout title="Pengerjaan Preventif" activeTab="home" onBack={() => setSelectedTask({ ...selectedTask, source: "task-detail" } as OMTask)}>
          <div className="rounded-lg border border-gray-400 bg-white p-4 shadow-sm">
            <div className="mb-4 text-center text-xs font-medium text-gray-700">Formulir Pengerjaan</div>
            <div className="space-y-2">
              <label className="block">
                <span className="text-[11px] leading-none text-gray-600">Nama</span>
                <input
                  value={workForm.name}
                  onChange={(event) => setWorkForm((current) => ({ ...current, name: event.target.value }))}
                  className="mt-1 h-8 w-full rounded-md border border-gray-400 px-2 text-xs outline-none focus:border-sky-500"
                  placeholder="Masukkan Nama"
                />
              </label>
              <label className="block">
                <span className="text-[11px] leading-none text-gray-600">ID Titik / Scan Barcode</span>
                <div className="mt-1 flex h-8 items-center rounded-md border border-gray-400 bg-white px-2">
                  <input
                    value={workForm.idTitik}
                    onChange={(event) => setWorkForm((current) => ({ ...current, idTitik: event.target.value }))}
                    className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                    placeholder={selectedTask.scope === "group" ? "Masukkan ID lampu yang dirawat duluan" : "Otomatis dari tugas"}
                  />
                  <button
                    type="button"
                    onClick={() => setWorkScannerOpen(true)}
                    className="text-xs font-semibold text-sky-700"
                  >
                    Scan
                  </button>
                </div>
              </label>
              {pointPreviewLoading ? (
                <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-700">Mengambil data titik APJ...</div>
              ) : null}
              {pointPreviewError ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">{pointPreviewError}</div>
              ) : null}
              {pointPreview ? (
                <section className="rounded-xl border border-sky-200 bg-sky-50/60 p-3">
                  <div className="mb-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">Data Titik APJ Hasil Scan</div>
                    <div className="mt-1 text-sm font-bold text-slate-950">{pointPreview.namaJalan || pointPreview.namaTitik || workForm.idTitik}</div>
                    <div className="text-[11px] text-slate-500">Data otomatis dimuat ke formulir tanpa membuka halaman lain.</div>
                  </div>
                  <PointDetailFields point={pointPreview} />
                </section>
              ) : null}
              <label className="block">
                <span className="text-[11px] leading-none text-gray-600">Lux Titik Api Lampu</span>
                <input
                  value={workForm.luxTitikApi}
                  onChange={(event) => setWorkForm((current) => ({ ...current, luxTitikApi: event.target.value }))}
                  className="mt-1 h-8 w-full rounded-md border border-gray-400 px-2 text-xs outline-none focus:border-sky-500"
                  placeholder="Contoh: 25.4 lux"
                />
              </label>
              <label className="block">
                <span className="text-[11px] leading-none text-gray-600">Lux Rata-rata Sekitar</span>
                <input
                  value={workForm.luxRataRata}
                  onChange={(event) => setWorkForm((current) => ({ ...current, luxRataRata: event.target.value }))}
                  className="mt-1 h-8 w-full rounded-md border border-gray-400 px-2 text-xs outline-none focus:border-sky-500"
                  placeholder="Opsional"
                />
              </label>
              <label className="block">
                <span className="text-[11px] leading-none text-gray-600">Kondisi Lampu</span>
                <input
                  value={workForm.lampCondition}
                  onChange={(event) => setWorkForm((current) => ({ ...current, lampCondition: event.target.value }))}
                  className="mt-1 h-8 w-full rounded-md border border-gray-400 px-2 text-xs outline-none focus:border-sky-500"
                  placeholder="Normal / redup / perlu ganti / kotor"
                />
              </label>
              <label className="block">
                <span className="text-[11px] leading-none text-gray-600">Kondisi Ornamen</span>
                <input
                  value={workForm.ornamentCondition}
                  onChange={(event) => setWorkForm((current) => ({ ...current, ornamentCondition: event.target.value }))}
                  className="mt-1 h-8 w-full rounded-md border border-gray-400 px-2 text-xs outline-none focus:border-sky-500"
                  placeholder="Normal / kotor / rusak / perlu perbaikan"
                />
              </label>
              <label className="block">
                <span className="text-[11px] leading-none text-gray-600">Upload Foto Lampu</span>
                <div className="mt-1 flex h-8 items-center rounded-md border border-gray-400 px-2">
                  <span className="min-w-0 flex-1 truncate text-xs text-gray-500">{workForm.photoLampName || "Upload bukti lampu"}</span>
                  <svg className="h-4 w-4 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1M12 4v12m0-12 4 4m-4-4-4 4" />
                  </svg>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(event) => setWorkForm((current) => ({ ...current, photoLampName: event.target.files?.[0]?.name || "" }))}
                />
              </label>
              <UploadLikeField label="Upload Foto Ornamen" fileName={workForm.photoOrnamentName} onChange={(fileName) => setWorkForm((current) => ({ ...current, photoOrnamentName: fileName }))} />
              <label className="block">
                <span className="text-[11px] leading-none text-gray-600">Tindakan Perawatan</span>
                <input
                  value={workForm.maintenanceAction}
                  onChange={(event) => setWorkForm((current) => ({ ...current, maintenanceAction: event.target.value }))}
                  className="mt-1 h-8 w-full rounded-md border border-gray-400 px-2 text-xs outline-none focus:border-sky-500"
                  placeholder="Contoh: pembersihan, pengencangan, pengecekan panel"
                />
              </label>
              <label className="block">
                <span className="text-[11px] leading-none text-gray-600">Catatan</span>
                <input
                  value={workForm.note}
                  onChange={(event) => setWorkForm((current) => ({ ...current, note: event.target.value }))}
                  className="mt-1 h-8 w-full rounded-md border border-gray-400 px-2 text-xs outline-none focus:border-sky-500"
                  placeholder="Catatan tambahan"
                />
              </label>
            </div>
            {workError ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{workError}</div> : null}
            {workMessage ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">{workMessage}</div> : null}
            <button type="button" onClick={() => void submitWork()} disabled={submittingWork} className="mx-auto mt-12 block rounded-md border border-gray-400 bg-sky-50 px-8 py-2 text-xs font-semibold text-gray-900 disabled:opacity-60">
              {submittingWork ? "Mengirim..." : "Kirim"}
            </button>
          </div>
          {workScannerOpen ? (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
              <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">Scan Langsung di Form</div>
                    <div className="text-sm font-bold text-slate-950">QR Titik APJ</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      stopWorkScanner();
                      setWorkScannerOpen(false);
                    }}
                    className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700"
                  >
                    Tutup
                  </button>
                </div>
                <div className="space-y-3 p-4">
                  <div className="relative overflow-hidden rounded-xl border border-slate-300 bg-black">
                    <video ref={workScannerVideoRef} className="aspect-[3/4] max-h-[55vh] w-full object-cover" muted playsInline />
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">{workScannerStatus}</div>
                  <label className="block cursor-pointer rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-center text-xs font-bold text-sky-800">
                    {workPhotoScanning ? "Membaca Foto..." : "Ambil Foto / Pilih Foto QR"}
                    <input type="file" accept="image/*" capture="environment" onChange={(event) => void scanWorkPhoto(event)} disabled={workPhotoScanning} className="sr-only" />
                  </label>
                  <div className="text-center text-[11px] text-slate-500">Setelah QR terbaca, ID dan data titik otomatis masuk ke formulir ini.</div>
                </div>
              </div>
            </div>
          ) : null}
        </PreventiveLayout>
      );
    }

    return (
      <PreventiveLayout title="Detail Laporan" activeTab="home" onBack={() => setSelectedTask(null)}>
        <div className="rounded-lg border border-gray-400 bg-white p-4 shadow-sm">
          <div className="mb-4 text-center text-xs font-medium text-gray-700">Data Tugas Preventif</div>
          <div className="space-y-2">
            <DataField label="Judul Tugas" value={selectedTask.title} />
            <DataField label="Penjabaran Tugas" value={selectedTask.message} />
            <DataField label="Cakupan" value={selectedTask.scope === "point" ? "Per titik" : "Per grup"} />
            <DataField label="Grup APJ" value={selectedTask.groupName || selectedTask.groupId} />
            <DataField label="ID Titik" value={selectedTask.pointId || "Dipilih saat pengerjaan"} />
            <DataField label="Target Lux" value={selectedTask.luxTarget || "-"} />
            <DataField label="Jadwal" value={selectedTask.repeatMode || "-"} />
          </div>
          {selectedTask.scope === "group" || selectedTask.scope === "point" ? (
            <section className="mt-5 border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-950">Peta Lokasi Tugas</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">Pilih marker untuk menentukan titik yang akan dikerjakan.</div>
                </div>
                <span className="rounded-full bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-700">{taskMapPoints.length} titik</span>
              </div>
              <div className="mt-3 h-72 overflow-hidden rounded-xl border border-slate-200">
                {taskMapLoading ? (
                  <div className="flex h-full items-center justify-center bg-slate-50 text-xs text-slate-500">Mengambil koordinat titik...</div>
                ) : (
                  <OMTaskPointMap points={taskMapPoints} selectedPointId={selectedTaskPointId} onSelectPoint={setSelectedTaskPointId} />
                )}
              </div>
              {taskMapPoints.length ? (
                <div className="mt-3 max-h-48 space-y-2 overflow-auto">
                  {taskMapPoints.map((point, index) => {
                    const selected = selectedTaskPointId === point.idTitik;
                    const hasCoordinate = Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && point.latitude !== 0 && point.longitude !== 0;
                    return (
                      <button
                        key={point.idTitik}
                        type="button"
                        onClick={() => setSelectedTaskPointId(point.idTitik)}
                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${selected ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white ${selected ? "bg-red-600" : "bg-sky-600"}`}>{index + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-bold text-slate-950">{point.idTitik}</span>
                          <span className="block truncate text-[11px] text-slate-500">{point.namaJalan || point.namaTitik || "Titik APJ"}</span>
                        </span>
                        <span className={`text-[10px] font-semibold ${hasCoordinate ? "text-emerald-600" : "text-slate-400"}`}>{hasCoordinate ? "Ada lokasi" : "Tanpa lokasi"}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {selectedTaskPointId ? (
                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  Titik dipilih: <b>{selectedTaskPointId}</b>. ID ini akan masuk ke form pengerjaan.
                </div>
              ) : null}
            </section>
          ) : null}
          <button
            type="button"
            onClick={() => openWorkForm(selectedTask, selectedTaskPointId)}
            className="mx-auto mt-9 block rounded-md border border-gray-400 bg-sky-50 px-8 py-2 text-xs font-semibold text-gray-900"
          >
            Kerjakan
          </button>
        </div>
      </PreventiveLayout>
    );
  }

  return (
    <PreventiveLayout title="Daftar Tugas" activeTab="home" onBack={() => window.history.back()}>
      <div className="space-y-3">
        <button type="button" onClick={() => void loadTasks()} className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm">
          Refresh
        </button>
        {loading ? <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">Memuat tugas...</div> : null}
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {!loading && !error && items.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">Belum ada tugas dari admin.</div>
        ) : null}
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => setSelectedTask(item)}
            className="block w-full rounded-md border border-gray-400 bg-white p-2 text-left shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-gray-950">{item.title || "Jenis Kerusakan"}</div>
                <div className="mt-0.5 text-[11px] text-gray-500">{formatDateTime(item.createdAt)}</div>
              </div>
              <span className="shrink-0 text-[11px] font-semibold text-gray-700">Tugas</span>
            </div>
          </button>
        ))}
      </div>
    </PreventiveLayout>
  );
}

export function PreventiveOMReportForm() {
  const router = useRouter();
  const { user } = useAuth();
  const isCorrective = isCorrectiveOmRole(user?.role);
  const reportType = isCorrective ? "korektif" : "preventif";
  const [damageType, setDamageType] = useState("");
  const [description, setDescription] = useState("");
  const [inspectionCondition, setInspectionCondition] = useState("");
  const [repairAction, setRepairAction] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || "");
  const [idTitik, setIdTitik] = useState("");
  const [photoDamageName, setPhotoDamageName] = useState("");
  const [photoPoleName, setPhotoPoleName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!damageType.trim() || !description.trim() || !idTitik.trim()) {
      setError("Jenis kerusakan, deskripsi, dan ID tiang wajib diisi.");
      return;
    }
    if (!isCorrective && !inspectionCondition.trim()) {
      setError("Kondisi inspeksi wajib diisi untuk laporan preventif.");
      return;
    }
    if (isCorrective && !repairAction.trim()) {
      setError("Tindakan perbaikan wajib diisi untuk laporan corrective.");
      return;
    }
    if (!user?.uid) {
      setError("Sesi login tidak valid.");
      return;
    }
    setLoading(true);
    try {
      const title = `${damageType.trim()} - ${idTitik.trim()}`;
      const response = await fetch("/api/om/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description.trim(),
          reportType,
          location: idTitik.trim(),
          damageType: damageType.trim(),
          idTitik: idTitik.trim(),
          photoDamageName,
          photoPoleName,
          inspectionCondition: inspectionCondition.trim(),
          repairAction: repairAction.trim(),
          formVariant: isCorrective ? "corrective" : "preventive",
          phoneNumber: phoneNumber.trim(),
          reporterUid: user.uid,
          reporterName: user.displayName || user.name || user.email || "Petugas O&M",
          reporterRole: user.role || (isCorrective ? "petugas-om-correctif" : "petugas-om-preventif"),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal mengirim laporan.");
      setDamageType("");
      setDescription("");
      setInspectionCondition("");
      setRepairAction("");
      setIdTitik("");
      setPhotoDamageName("");
      setPhotoPoleName("");
      setMessage(isCorrective ? "Laporan corrective berhasil dikirim." : "Laporan preventif berhasil dikirim.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Gagal mengirim laporan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PreventiveLayout title="Laporan Kerusakan" activeTab="home" onBack={() => router.push("/om")}>
      <form onSubmit={handleSubmit} className="rounded-lg border-2 border-sky-500 bg-white p-4 shadow-sm">
        <div className="mb-4 text-center text-xs font-medium text-gray-700">
          {isCorrective ? "Lengkapi Formulir Corrective dibawah" : "Lengkapi Formulir Preventif dibawah"}
        </div>
        <div className="space-y-2">
          <label className="block">
            <span className="text-[11px] leading-none text-gray-600">Jenis Kerusakan</span>
            <select
              value={damageType}
              onChange={(event) => setDamageType(event.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-gray-400 bg-white px-2 text-xs outline-none focus:border-sky-500"
            >
              <option value="">Pilih Kategori Kerusakan</option>
              {isCorrective ? (
                <>
                  <option value="Lampu Padam">Lampu Padam</option>
                  <option value="Kabel Putus">Kabel Putus</option>
                  <option value="Panel Bermasalah">Panel Bermasalah</option>
                  <option value="Tiang Rusak">Tiang Rusak</option>
                  <option value="Lainnya">Lainnya</option>
                </>
              ) : (
                <>
                  <option value="Inspeksi Lampu">Inspeksi Lampu</option>
                  <option value="Inspeksi Kabel">Inspeksi Kabel</option>
                  <option value="Inspeksi Panel">Inspeksi Panel</option>
                  <option value="Inspeksi Tiang">Inspeksi Tiang</option>
                  <option value="Temuan Preventif">Temuan Preventif</option>
                </>
              )}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] leading-none text-gray-600">Deskripsi Kerusakan</span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-gray-400 bg-white px-2 text-xs outline-none focus:border-sky-500"
              placeholder="Masukkan Deskripsi kerusakan"
            />
          </label>
          {!isCorrective ? (
            <label className="block">
              <span className="text-[11px] leading-none text-gray-600">Kondisi Inspeksi</span>
              <input
                value={inspectionCondition}
                onChange={(event) => setInspectionCondition(event.target.value)}
                className="mt-1 h-8 w-full rounded-md border border-gray-400 bg-white px-2 text-xs outline-none focus:border-sky-500"
                placeholder="Contoh: normal, perlu pembersihan, perlu pemantauan"
              />
            </label>
          ) : (
            <label className="block">
              <span className="text-[11px] leading-none text-gray-600">Tindakan Perbaikan</span>
              <input
                value={repairAction}
                onChange={(event) => setRepairAction(event.target.value)}
                className="mt-1 h-8 w-full rounded-md border border-gray-400 bg-white px-2 text-xs outline-none focus:border-sky-500"
                placeholder="Contoh: ganti lampu, sambung kabel, reset panel"
              />
            </label>
          )}
          <UploadLikeField label={isCorrective ? "Upload Foto Hasil Perbaikan" : "Upload Foto Temuan"} fileName={photoDamageName} onChange={setPhotoDamageName} />
          <label className="block">
            <span className="text-[11px] leading-none text-gray-600">ID Tiang / Scan Tiang</span>
            <div className="mt-1 flex h-8 items-center rounded-md border border-gray-400 bg-white px-2">
              <input
                value={idTitik}
                onChange={(event) => setIdTitik(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                placeholder="Masukkan Id Tiang"
              />
              <button type="button" onClick={() => router.push("/om/scan")} className="text-xs font-semibold text-sky-700">
                Scan
              </button>
            </div>
          </label>
          {!isCorrective ? (
            <UploadLikeField label="Upload Foto Tiang" fileName={photoPoleName} onChange={setPhotoPoleName} />
          ) : null}
          <label className="block">
            <span className="text-[11px] leading-none text-gray-600">No. Telp</span>
            <input
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-gray-400 bg-white px-2 text-xs outline-none focus:border-sky-500"
              placeholder="Masukkan Nomor Hp yang bisa dihubungi"
            />
          </label>
        </div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
        <button type="submit" disabled={loading} className="mx-auto mt-14 block rounded-md border border-gray-400 bg-sky-50 px-8 py-2 text-xs font-semibold text-gray-900 disabled:opacity-60">
          {loading ? "Mengirim..." : "Kirim Laporan"}
        </button>
      </form>
    </PreventiveLayout>
  );
}

export function PreventiveOMProfile() {
  const router = useRouter();
  const { user } = useAuth();
  const [showManage, setShowManage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [profile, setProfile] = useState({
    username: user?.username || "",
    email: user?.email || "",
    name: user?.displayName || user?.name || "",
    phoneNumber: user?.phoneNumber || "",
  });
  const [password, setPassword] = useState({ newPassword: "", confirmPassword: "" });

  useEffect(() => {
    setProfile({
      username: user?.username || "",
      email: user?.email || "",
      name: user?.displayName || user?.name || "",
      phoneNumber: user?.phoneNumber || "",
    });
  }, [user]);

  const initials = (profile.name || profile.email || "P")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSaveProfile = async () => {
    setError("");
    setMessage("");
    if (!user?.uid) {
      setError("Sesi login tidak valid.");
      return;
    }
    if (password.newPassword && password.newPassword !== password.confirmPassword) {
      setError("Konfirmasi kata sandi tidak sama.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/om/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user.uid,
          ...profile,
          newPassword: password.newPassword,
        }),
      });
      const payload = (await response.json()) as { user?: any; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal menyimpan profil.");
      if (payload.user) {
        const stored = localStorage.getItem("gesa_user");
        const current = stored ? JSON.parse(stored) : {};
        localStorage.setItem("gesa_user", JSON.stringify({ ...current, ...payload.user }));
      }
      setPassword({ newPassword: "", confirmPassword: "" });
      setMessage("Profil berhasil diperbarui.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan profil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PreventiveLayout title="Profil" activeTab="profile" onBack={() => (showManage ? setShowManage(false) : router.push("/om"))}>
      {!showManage ? (
        <div className="space-y-7">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-32 w-32 items-center justify-center rounded-full border-[6px] border-black bg-white text-5xl font-bold text-black">
              {initials}
            </div>
            <button type="button" onClick={() => setShowManage(true)} className="text-sm font-semibold text-blue-600">
              Edit
            </button>
          </div>
          <div className="space-y-3">
            <div className="rounded-full border border-gray-400 bg-white px-5 py-3 text-sm font-semibold text-gray-950">{profile.name || "Nama belum diisi"}</div>
            <div className="rounded-full border border-gray-400 bg-white px-5 py-3 text-sm font-semibold text-gray-950">@{profile.username || "username"}</div>
            <div className="rounded-full border border-gray-400 bg-white px-5 py-3 text-sm font-semibold text-gray-950">{profile.email || "Email belum diisi"}</div>
            <div className="rounded-full border border-gray-400 bg-white px-5 py-3 text-sm font-semibold text-gray-950">{profile.phoneNumber || "No. telepon belum diisi"}</div>
          </div>
          <button type="button" onClick={() => setShowManage(true)} className="mx-auto block rounded-lg border border-gray-400 bg-white px-6 py-3 text-sm font-bold text-gray-950 shadow-sm">
            Kelola Akun
          </button>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-sky-500 bg-white p-4 shadow-sm">
          <div className="mb-4 text-center text-sm font-semibold text-gray-700">Kelola akun</div>
          <div className="space-y-3">
            {[
              ["Username", "username"],
              ["Email", "email"],
              ["Nama", "name"],
              ["No. Telp", "phoneNumber"],
            ].map(([label, key]) => (
              <label key={key} className="block">
                <span className="text-xs text-gray-600">{label}</span>
                <input
                  value={profile[key as keyof typeof profile]}
                  onChange={(event) => setProfile((current) => ({ ...current, [key]: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
                />
              </label>
            ))}
            <label className="block">
              <span className="text-xs text-gray-600">Kata Sandi Baru</span>
              <input value={password.newPassword} onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))} type="password" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500" placeholder="Kosongkan jika tidak diganti" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">Konfirmasi Kata Sandi</span>
              <input value={password.confirmPassword} onChange={(event) => setPassword((current) => ({ ...current, confirmPassword: event.target.value }))} type="password" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500" />
            </label>
          </div>
          {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
          {message ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
          <button type="button" onClick={() => void handleSaveProfile()} disabled={saving} className="mt-6 w-full rounded-lg bg-sky-100 px-4 py-3 text-sm font-bold text-gray-950 ring-1 ring-sky-300 disabled:opacity-60">
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      )}
    </PreventiveLayout>
  );
}
