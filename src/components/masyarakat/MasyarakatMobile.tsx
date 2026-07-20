"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const SurveyAPJProposeMap = dynamic(() => import("@/components/SurveyAPJProposeMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-xl border-2 border-blue-200 bg-gray-100 text-sm text-gray-500">
      Memuat peta APJ...
    </div>
  ),
});

type PublicTab = "home" | "notifications" | "scan" | "profile";

type PublicReport = {
  id: string;
  title: string;
  description: string;
  reportType: string;
  location: string;
  damageType?: string;
  idTitik?: string;
  photoDamageName?: string;
  phoneNumber?: string;
  reporterEmail?: string;
  status: string;
  statusTimeline?: PublicStatusTimelineItem[];
  createdAt: string | null;
  updatedAt?: string | null;
};

type PublicStatusTimelineItem = {
  status: string;
  actorId?: string;
  actorName?: string;
  note?: string;
  at?: string | null;
};

type PublicNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string | null;
};

type ApjSurvey = {
  id?: string;
  id_titik?: string;
  idTitik?: string;
  nama_jalan?: string;
  namaJalan?: string;
  kabupaten?: string;
  latitude?: number | string;
  longitude?: number | string;
  daya_lampu?: string;
  dayaLampu?: string;
  surveyor_name?: string;
  surveyorName?: string;
  status?: string;
  created_at?: string;
  createdAt?: string;
};

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

const PUBLIC_STATUS_LABELS: Record<string, string> = {
  new: "Baru",
  diproses: "Diproses",
  selesai: "Selesai",
  ditolak: "Ditolak",
};

const PUBLIC_STATUS_STYLES: Record<string, string> = {
  new: "border-amber-200 bg-amber-50 text-amber-700",
  diproses: "border-sky-200 bg-sky-50 text-sky-700",
  selesai: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ditolak: "border-red-200 bg-red-50 text-red-700",
};

function getPublicStatusLabel(status?: string | null) {
  const normalized = (status || "new").toLowerCase();
  return PUBLIC_STATUS_LABELS[normalized] || status || "Baru";
}

function getPublicStatusClass(status?: string | null) {
  const normalized = (status || "new").toLowerCase();
  return PUBLIC_STATUS_STYLES[normalized] || "border-gray-200 bg-gray-50 text-gray-700";
}

function buildPublicTimeline(report: PublicReport): PublicStatusTimelineItem[] {
  if (Array.isArray(report.statusTimeline) && report.statusTimeline.length > 0) {
    return report.statusTimeline;
  }
  return [
    {
      status: report.status || "new",
      actorName: "Sistem GESA",
      note: report.status === "new" ? "Laporan dibuat dan menunggu tindak lanjut admin." : `Status laporan: ${getPublicStatusLabel(report.status)}.`,
      at: report.updatedAt || report.createdAt,
    },
  ];
}

function extractApjIdFromScanValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const parsed =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? new URL(trimmed)
        : trimmed.startsWith("/")
          ? new URL(trimmed, window.location.origin)
          : null;
    if (!parsed) throw new Error("Bukan URL sistem.");
    const queryKeys = ["idTitik", "id_titik", "apjId", "apj_id", "titik", "id"];
    for (const key of queryKeys) {
      const queryValue = parsed.searchParams.get(key)?.trim();
      if (queryValue) return queryValue;
    }

    const pathParts = parsed.pathname.split("/").map((part) => part.trim()).filter(Boolean);
    const knownSegmentIndex = pathParts.findIndex((part) => ["apj", "titik", "tiang", "point", "points"].includes(part.toLowerCase()));
    if (knownSegmentIndex >= 0 && pathParts[knownSegmentIndex + 1]) return decodeURIComponent(pathParts[knownSegmentIndex + 1]);
    if (pathParts.length > 0) return decodeURIComponent(pathParts[pathParts.length - 1]);
  } catch {
    // Non-URL barcode values are treated as a direct APJ/titik ID.
  }

  const idMatch = trimmed.match(/(?:idTitik|id_titik|apjId|apj_id|titik|id)\s*[:=]\s*([A-Za-z0-9._-]+)/i);
  return idMatch?.[1] || trimmed;
}

function buildReportPrefillRoute(value: string, target: "panel" | "public") {
  const apjId = extractApjIdFromScanValue(value);
  const params = new URLSearchParams();
  if (apjId) params.set("idTitik", apjId);
  params.set("scan", value.trim());
  return target === "panel" ? `/masyarakat/laporan-kerusakan?${params.toString()}` : `/lapor-apj?${params.toString()}`;
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

function IconReport() {
  return (
    <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 3h7l5 5v13H7z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 3v5h5M10 13h6M10 17h4" />
      <circle cx="7" cy="16" r="3" fill="#ef4444" stroke="none" />
      <path stroke="#fff" strokeLinecap="round" strokeWidth={1.5} d="M7 14v3" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24">
      <path d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2z" fill="#dbeafe" stroke="#111827" strokeWidth="1.5" />
      <path d="M9 4v14M15 6v14" stroke="#111827" strokeWidth="1.5" />
      <path d="M12 13c2-2 3-3.7 3-5a3 3 0 1 0-6 0c0 1.3 1 3 3 5z" fill="#ef4444" />
      <circle cx="12" cy="8" r="1" fill="#fff" />
    </svg>
  );
}

function PublicTopBar({ title, onBack }: { title: string; onBack?: () => void }) {
  const router = useRouter();
  return (
    <header className="relative flex h-14 items-center justify-between border-b border-gray-300 bg-gray-100 px-3">
      <button
        type="button"
        onClick={onBack || (() => router.push("/module-selection"))}
        className="z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black text-white shadow-sm"
        aria-label="Kembali"
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

function BottomNav({ active }: { active: PublicTab }) {
  const router = useRouter();
  const navItems: Array<{ id: PublicTab; label: string; route: string; icon: ReactNode }> = [
    { id: "home", label: "Home", route: "/masyarakat", icon: <IconHome /> },
    { id: "notifications", label: "Notifikasi", route: "/masyarakat/notifications", icon: <IconBell /> },
    { id: "scan", label: "Scan", route: "/masyarakat/scan", icon: <IconQr /> },
    { id: "profile", label: "Profil", route: "/masyarakat/profile", icon: <IconUser /> },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-300 bg-[#f7d7d9]">
      <div className="mx-auto grid h-16 w-full max-w-md grid-cols-4">
        {navItems.map((item) => (
          <button key={item.id} type="button" onClick={() => router.push(item.route)} className={active === item.id ? "text-black" : "text-gray-600"} aria-label={item.label}>
            <span className="flex justify-center">{item.icon}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function PublicLayout({ title, activeTab, children, onBack }: { title: string; activeTab: PublicTab; children: ReactNode; onBack?: () => void }) {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto min-h-screen w-full max-w-md overflow-hidden border-x border-gray-300 bg-white shadow-sm">
        <div className="relative min-h-screen pb-20">
          <RedDecorations />
          <PublicTopBar title={title} onBack={onBack} />
          <main className="relative z-10 px-4 pb-6 pt-5">{children}</main>
        </div>
      </div>
      <BottomNav active={activeTab} />
    </div>
  );
}

function Field({ label, value, placeholder, onChange, type = "text" }: { label: string; value: string; placeholder: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] leading-none text-gray-600">{label}</span>
      <input value={value} type={type} onChange={(event) => onChange(event.target.value)} className="mt-1 h-8 w-full rounded-md border border-gray-400 bg-white px-2 text-xs outline-none focus:border-sky-500" placeholder={placeholder} />
    </label>
  );
}

function ReadOnlyDataField({ label, value }: { label: string; value?: string | null }) {
  return (
    <label className="block">
      <span className="text-[11px] leading-none text-gray-600">{label}</span>
      <div className="mt-1 flex h-8 w-full items-center rounded-md border border-gray-400 bg-white px-2 text-xs text-gray-700">
        {value || `Data ${label}`}
      </div>
    </label>
  );
}

function UploadLikeField({ label, fileName, onChange }: { label: string; fileName: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] leading-none text-gray-600">{label}</span>
      <div className="mt-1 flex h-8 items-center rounded-md border border-gray-400 bg-white px-2">
        <span className="min-w-0 flex-1 truncate text-xs text-gray-500">{fileName || `Masukkan ${label}`}</span>
        <input type="file" accept="image/*" className="hidden" onChange={(event) => onChange(event.target.files?.[0]?.name || "")} />
        <span className="text-gray-500">▣</span>
      </div>
    </label>
  );
}

export function PublicRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", username: "", email: "", phoneNumber: "", password: "", confirmPassword: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (form.password !== form.confirmPassword) {
      setError("Konfirmasi password tidak sama.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/register-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal daftar.");
      setSuccess("Akun berhasil dibuat. Silakan login.");
      setTimeout(() => router.push("/"), 900);
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : "Gagal daftar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicLayout title="Pendaftaran" activeTab="home" onBack={() => router.push("/")}>
      <form onSubmit={submit} className="mx-auto mt-2 w-full max-w-[330px] rounded-lg border-2 border-sky-500 bg-white/95 p-4 shadow-sm">
        <p className="mb-4 text-center text-xs font-semibold">Lengkapi formulir dibawah</p>
        <div className="space-y-2">
          <Field label="Nama Lengkap" value={form.name} onChange={(value) => update("name", value)} placeholder="Masukkan nama anda" />
          <Field label="Username" value={form.username} onChange={(value) => update("username", value)} placeholder="Masukkan username anda" />
          <Field label="Email" value={form.email} onChange={(value) => update("email", value)} placeholder="Masukkan email" type="email" />
          <Field label="No. Telp" value={form.phoneNumber} onChange={(value) => update("phoneNumber", value)} placeholder="Masukkan No. Hp" />
          <Field label="Kata Sandi" value={form.password} onChange={(value) => update("password", value)} placeholder="Masukkan kata sandi" type="password" />
          <Field label="Konfirmasi Kata Sandi" value={form.confirmPassword} onChange={(value) => update("confirmPassword", value)} placeholder="Masukkan ulang kata sandi" type="password" />
        </div>
        {error ? <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}
        {success ? <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">{success}</div> : null}
        <div className="mt-4 text-center text-[11px] text-gray-600">
          <span>Sudah punya akun? </span>
          <Link className="font-semibold text-sky-700 underline" href="/">
            Login
          </Link>
        </div>
        <button type="submit" disabled={submitting} className="mx-auto mt-5 block h-9 w-36 rounded-md border border-gray-500 bg-sky-100 text-xs font-bold disabled:opacity-60">
          {submitting ? "Mendaftar..." : "DAFTAR"}
        </button>
      </form>
    </PublicLayout>
  );
}

export function MasyarakatDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const cards = [
    { title: "Laporan Kerusakan", subtitle: "Laporkan masalah APJ", route: "/masyarakat/laporan-kerusakan", icon: <IconReport /> },
    { title: "Peta Lokasi APJ", subtitle: "Lihat titik APJ", route: "/masyarakat/peta-apj", icon: <IconMap /> },
    { title: "Riwayat Laporan Saya", subtitle: "Pantau status laporan", route: "/masyarakat/riwayat-laporan", icon: <IconReport /> },
  ];

  return (
    <PublicLayout title="Dashboard" activeTab="home" onBack={() => router.push("/module-selection")}>
      <div className="mb-5 rounded-lg border border-red-200 bg-white/90 p-4 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-red-600">Masyarakat Umum</div>
        <h2 className="mt-2 text-xl font-bold text-gray-950">{user?.displayName || user?.name || "Warga"}</h2>
        <p className="text-sm text-gray-600">Laporkan kerusakan APJ dan pantau prosesnya dari sini.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {cards.map((card) => (
          <button key={card.route} type="button" onClick={() => router.push(card.route)} className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-gray-400 bg-white px-3 py-4 text-center shadow-sm transition hover:border-red-400">
            {card.icon}
            <div className="mt-3 text-sm font-bold text-gray-950">{card.title}</div>
            <div className="mt-1 text-[11px] text-gray-600">{card.subtitle}</div>
          </button>
        ))}
      </div>
    </PublicLayout>
  );
}

export function PublicReportForm() {
  const { user } = useAuth();
  const router = useRouter();
  const [damageType, setDamageType] = useState("");
  const [description, setDescription] = useState("");
  const [photoDamageName, setPhotoDamageName] = useState("");
  const [idTitik, setIdTitik] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || "");
  const [reporterEmail, setReporterEmail] = useState(user?.email || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scannedId = params.get("idTitik")?.trim();
    if (scannedId) setIdTitik(scannedId);
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!damageType || !description || !idTitik || !reporterEmail.trim()) {
      setError("Jenis kerusakan, deskripsi, ID tiang, dan email notifikasi wajib diisi.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail.trim())) {
      setError("Format email notifikasi tidak valid.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/om/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Laporan masyarakat - ${damageType}`,
          description,
          reportType: "masyarakat",
          location: idTitik,
          reporterUid: user?.uid,
          reporterName: user?.displayName || user?.name || user?.email || "Masyarakat Umum",
          reporterRole: "masyarakat-umum",
          damageType,
          idTitik,
          photoDamageName,
          phoneNumber,
          reporterEmail: reporterEmail.trim().toLowerCase(),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal mengirim laporan.");
      setSuccess("Laporan berhasil dikirim. Progres perbaikan akan dikirim ke email yang didaftarkan.");
      setDamageType("");
      setDescription("");
      setPhotoDamageName("");
      setIdTitik("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Gagal mengirim laporan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout title="Laporkan Kerusakan" activeTab="home">
      <form onSubmit={submit} className="mx-auto mt-2 w-full max-w-[330px] rounded-lg border-2 border-sky-500 bg-white/95 p-4 shadow-sm">
        <p className="mb-4 text-center text-xs font-semibold">Lengkapi formulir dibawah</p>
        <div className="space-y-2">
          <label className="block">
            <span className="text-[11px] leading-none text-gray-600">Jenis Kerusakan</span>
            <select value={damageType} onChange={(event) => setDamageType(event.target.value)} className="mt-1 h-8 w-full rounded-md border border-gray-400 bg-white px-2 text-xs outline-none focus:border-sky-500">
              <option value="">Pilih kategori kerusakan</option>
              <option>Lampu mati</option>
              <option>Kabel putus</option>
              <option>Tiang rusak</option>
              <option>Panel bermasalah</option>
              <option>Lainnya</option>
            </select>
          </label>
          <Field label="Deskripsi Kerusakan" value={description} onChange={setDescription} placeholder="Masukkan deskripsi kerusakan" />
          <UploadLikeField label="Upload Foto Kerusakan" fileName={photoDamageName} onChange={setPhotoDamageName} />
          <label className="block">
            <span className="text-[11px] leading-none text-gray-600">ID Tiang / Scan Tiang</span>
            <div className="mt-1 flex h-8 items-center rounded-md border border-gray-400 bg-white px-2">
              <input value={idTitik} onChange={(event) => setIdTitik(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs outline-none" placeholder={idTitik ? "Data terisi otomatis dari hasil scan" : "Masukkan ID Tiang"} />
              <button type="button" onClick={() => router.push("/masyarakat/scan")} className="text-xs font-semibold text-sky-700">
                Scan
              </button>
            </div>
          </label>
          <Field label="No. Telp" value={phoneNumber} onChange={setPhoneNumber} placeholder="Masukkan Nomor HP yang bisa dihubungi" />
          <label className="block">
            <span className="text-[11px] leading-none text-gray-600">Email Notifikasi Progres <span className="text-red-600">*</span></span>
            <input required type="email" value={reporterEmail} onChange={(event) => setReporterEmail(event.target.value)} className="mt-1 h-8 w-full rounded-md border border-gray-400 px-2 text-xs outline-none focus:border-sky-500" placeholder="nama@email.com" />
            <span className="mt-1 block text-[10px] leading-4 text-gray-500">Progres penanganan dan perbaikan akan dikirim ke email ini.</span>
          </label>
        </div>
        {error ? <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}
        {success ? <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">{success}</div> : null}
        <button type="submit" disabled={loading} className="mx-auto mt-14 block h-9 w-36 rounded-md border border-gray-500 bg-sky-100 text-xs font-bold disabled:opacity-60">
          {loading ? "Mengirim..." : "Kirim Laporan"}
        </button>
      </form>
    </PublicLayout>
  );
}

export function PublicNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<PublicNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams({ role: "masyarakat-umum", uid: user?.uid || "", limit: "30" });
        const response = await fetch(`/api/om/notifications?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as { notifications?: PublicNotification[] };
        setItems(payload.notifications || []);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [user?.uid]);

  return (
    <PublicLayout title="Notifikasi" activeTab="notifications">
      <div className="space-y-2">
        {loading ? <p className="text-center text-sm text-gray-500">Memuat notifikasi...</p> : null}
        {!loading && items.length === 0 ? <p className="rounded-lg border border-gray-300 bg-white/90 p-4 text-center text-sm text-gray-500">Belum ada notifikasi.</p> : null}
        {items.map((item) => (
          <div key={item.id} className="rounded-md border border-gray-500 bg-white px-3 py-2 shadow-sm">
            <div className="text-xs font-semibold text-gray-950">{item.title}</div>
            <div className="mt-1 text-[11px] text-gray-600">{item.message || "Tidak ada detail notifikasi."}</div>
            <div className="mt-1 text-right text-[10px] text-gray-500">{formatDateTime(item.createdAt)}</div>
          </div>
        ))}
      </div>
    </PublicLayout>
  );
}

export function PublicScanPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannedRef = useRef(false);
  const [error, setError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const router = useRouter();
  const { user } = useAuth();
  const scanTarget = user?.role === "masyarakat-umum" ? "panel" : "public";

  useEffect(() => {
    let stream: MediaStream | null = null;
    let scanTimer: number | null = null;

    const openScannedValue = (value: string) => {
      const normalized = value.trim();
      if (!normalized || scannedRef.current) return;
      scannedRef.current = true;
      router.push(buildReportPrefillRoute(normalized, scanTarget));
    };

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        const BarcodeDetectorCtor = (window as Window & {
          BarcodeDetector?: new (options?: { formats?: string[] }) => {
            detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
          };
        }).BarcodeDetector;

        if (BarcodeDetectorCtor && videoRef.current) {
          const detector = new BarcodeDetectorCtor({ formats: ["qr_code", "code_128", "code_39", "ean_13"] });
          scanTimer = window.setInterval(async () => {
            const video = videoRef.current;
            if (!video || video.readyState < 2 || scannedRef.current) return;
            try {
              const results = await detector.detect(video);
              const rawValue = results[0]?.rawValue || "";
              if (rawValue) openScannedValue(rawValue);
            } catch {
              // Browser support varies; manual input remains available.
            }
          }, 700);
        } else {
          setError("Kamera aktif, tetapi browser ini belum mendukung pembaca QR otomatis. Masukkan ID titik atau link QR di input manual.");
        }
      } catch {
        setError("Kamera tidak bisa diakses. Izinkan akses kamera atau masukkan ID/link secara manual.");
      }
    };
    void start();
    return () => {
      if (scanTimer) window.clearInterval(scanTimer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [router, scanTarget]);

  const openCode = () => {
    const value = manualCode.trim();
    if (!value) return;
    router.push(buildReportPrefillRoute(value, scanTarget));
  };

  return (
    <PublicLayout title="Scan Barcode" activeTab="scan" onBack={() => router.push("/module-selection")}>
      <div className="mx-auto mt-10 flex h-56 w-56 items-center justify-center rounded-xl border border-gray-300 bg-gray-100 p-4">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full rounded-lg object-cover" />
      </div>
      {error ? <p className="mx-auto mt-4 max-w-xs rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-700">{error}</p> : null}
      <div className="mx-auto mt-6 flex max-w-xs gap-2">
        <input value={manualCode} onChange={(event) => setManualCode(event.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-gray-400 px-2 text-xs" placeholder="TEST-APJ-001 atau link QR" />
        <button type="button" onClick={openCode} className="h-9 rounded-md border border-gray-500 bg-sky-100 px-4 text-xs font-bold">
          Buka
        </button>
      </div>
    </PublicLayout>
  );
}

export function PublicProfilePage() {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", email: "", phoneNumber: "", newPassword: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({
      name: user?.name || user?.displayName || "",
      username: user?.username || "",
      email: user?.email || "",
      phoneNumber: user?.phoneNumber || "",
      newPassword: "",
      confirmPassword: "",
    });
  }, [user]);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      setError("Konfirmasi kata sandi tidak sama.");
      return;
    }
    const response = await fetch("/api/om/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: user?.uid, ...form }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error || "Gagal menyimpan profil.");
      return;
    }
    setMessage("Profil berhasil diperbarui. Login ulang jika email/password berubah.");
    setEditing(false);
  };

  if (!editing) {
    return (
      <PublicLayout title="Profil" activeTab="profile">
        <div className="mt-8 flex flex-col items-center">
          <div className="flex h-32 w-32 items-center justify-center rounded-full border-[6px] border-black bg-white">
            <IconUser />
          </div>
          <button type="button" onClick={() => setEditing(true)} className="mt-2 text-xs font-semibold text-blue-700">
            Edit
          </button>
          <div className="mt-6 w-full max-w-[330px] space-y-3">
            <div className="rounded-full border border-gray-500 bg-white px-5 py-3 text-center text-xs font-bold">{form.name || "Data Nama Lengkap"}</div>
            <div className="rounded-full border border-gray-500 bg-white px-5 py-3 text-center text-xs font-bold">{form.username || "Data Username"}</div>
            <div className="rounded-full border border-gray-500 bg-white px-5 py-3 text-center text-xs font-bold">{form.email || "Email"}</div>
          </div>
          <button type="button" onClick={() => setEditing(true)} className="mt-16 h-10 w-40 rounded-md border border-gray-500 bg-white text-xs font-bold">
            Kelola Akun
          </button>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout title="Profil" activeTab="profile">
      <form onSubmit={save} className="mx-auto mt-2 w-full max-w-[330px] rounded-lg border-2 border-sky-500 bg-white/95 p-4 shadow-sm">
        <p className="mb-4 text-center text-xs">Kelola Akun Anda Dibawah ini</p>
        <div className="space-y-2">
          <Field label="Username" value={form.username} onChange={(value) => update("username", value)} placeholder="Data Username" />
          <Field label="Email" value={form.email} onChange={(value) => update("email", value)} placeholder="Data Email" type="email" />
          <Field label="Nama" value={form.name} onChange={(value) => update("name", value)} placeholder="Data Nama" />
          <Field label="No. Telp" value={form.phoneNumber} onChange={(value) => update("phoneNumber", value)} placeholder="Data No. Telp" />
          <Field label="Kata Sandi Baru" value={form.newPassword} onChange={(value) => update("newPassword", value)} placeholder="Masukkan sandi baru jika ingin mengubah" type="password" />
          <Field label="Konfirmasi Kata Sandi" value={form.confirmPassword} onChange={(value) => update("confirmPassword", value)} placeholder="Masukkan ulang kata sandi baru" type="password" />
        </div>
        {error ? <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}
        {message ? <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">{message}</div> : null}
        <button type="submit" className="mx-auto mt-14 block h-9 w-40 rounded-md border border-gray-500 bg-sky-100 text-xs font-bold">
          Simpan Perubahan
        </button>
      </form>
    </PublicLayout>
  );
}

export function PublicReportsHistory() {
  const { user } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams({ uid: user?.uid || "", role: "masyarakat-umum" });
        const response = await fetch(`/api/om/reports/my?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as { reports?: PublicReport[] };
        setReports((payload.reports || []).filter((item) => item.reportType === "masyarakat" || item.reportType === "korektif" || item.reportType === "preventif"));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [user?.uid]);

  return (
    <PublicLayout title="Riwayat Laporan Saya" activeTab="home">
      <div className="space-y-2">
        {loading ? <p className="text-center text-sm text-gray-500">Memuat laporan...</p> : null}
        {!loading && reports.length === 0 ? <p className="rounded-lg border border-gray-300 bg-white/90 p-4 text-center text-sm text-gray-500">Belum ada laporan.</p> : null}
        {reports.map((report) => (
          <button key={report.id} type="button" onClick={() => router.push(`/masyarakat/riwayat-laporan/${encodeURIComponent(report.id)}`)} className="w-full rounded-md border border-gray-500 bg-white px-3 py-2 text-left shadow-sm transition hover:border-red-400">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-gray-950">Id Tiang</div>
                <div className="text-[11px] text-gray-600">{report.idTitik || report.location || "-"}</div>
                <div className="text-[10px] text-gray-500">Tanggal Laporan: {formatDateTime(report.createdAt)}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${getPublicStatusClass(report.status)}`}>{getPublicStatusLabel(report.status)}</div>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black text-xs text-white">›</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </PublicLayout>
  );
}

export function PublicReportDetail({ reportId }: { reportId: string }) {
  const { user } = useAuth();
  const [report, setReport] = useState<PublicReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams({ uid: user?.uid || "", role: "masyarakat-umum", limit: "100" });
        const response = await fetch(`/api/om/reports/my?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as { reports?: PublicReport[] };
        setReport((payload.reports || []).find((item) => item.id === reportId) || null);
      } finally {
        setLoading(false);
      }
    };
    if (user?.uid) void load();
  }, [reportId, user?.uid]);

  return (
    <PublicLayout title="Detail Laporan" activeTab="home">
      <div className="mx-auto mt-2 w-full max-w-[330px] rounded-lg border border-gray-500 bg-white/95 p-4 shadow-sm">
        <p className="mb-4 text-center text-xs font-semibold">Data Laporan</p>
        {loading ? <p className="py-8 text-center text-sm text-gray-500">Memuat laporan...</p> : null}
        {!loading && !report ? <p className="py-8 text-center text-sm text-gray-500">Laporan tidak ditemukan.</p> : null}
        {report ? (
          <div className="space-y-2">
            <ReadOnlyDataField label="Jenis Kerusakan" value={report.damageType || report.title} />
            <ReadOnlyDataField label="Deskripsi Kerusakan" value={report.description} />
            <ReadOnlyDataField label="Upload Foto Kerusakan" value={report.photoDamageName || "-"} />
            <ReadOnlyDataField label="Id Tiang / Scan Tiang" value={report.idTitik || report.location} />
            <ReadOnlyDataField label="No. Telp" value={report.phoneNumber || "-"} />
            <ReadOnlyDataField label="Email Notifikasi" value={report.reporterEmail || "-"} />
            <button type="button" className={`mx-auto mt-6 block h-8 w-40 rounded-md border text-xs font-semibold ${getPublicStatusClass(report.status)}`}>
              {getPublicStatusLabel(report.status)}
            </button>
            <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="mb-3 text-xs font-bold text-gray-950">Timeline Tindak Lanjut</div>
              <div className="space-y-3">
                {buildPublicTimeline(report).map((item, index) => (
                  <div key={`${item.status}-${item.at || index}`} className="relative border-l-2 border-red-200 pl-3">
                    <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-red-600" />
                    <div className="flex items-center justify-between gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getPublicStatusClass(item.status)}`}>{getPublicStatusLabel(item.status)}</span>
                      <span className="text-[10px] text-gray-500">{formatDateTime(item.at)}</span>
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-gray-800">{item.actorName || "Sistem GESA"}</div>
                    <div className="text-[11px] text-gray-600">{item.note || `Status laporan ${getPublicStatusLabel(item.status)}.`}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </PublicLayout>
  );
}

function LegacyPublicApjMapPage() {
  const [items, setItems] = useState<ApjSurvey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/survey-apj-propose/submitted-surveys?limit=30", { cache: "no-store" });
        const payload = (await response.json()) as { surveys?: ApjSurvey[]; data?: ApjSurvey[] };
        setItems(payload.surveys || payload.data || []);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <PublicLayout title="Peta Situasi & Titik" activeTab="home">
      <div className="mx-auto w-full max-w-[330px] rounded-lg border border-gray-500 bg-white/95 p-4 shadow-sm">
        <p className="text-center text-xs font-semibold">Legenda Peta</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-gray-700">
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-600" /> Titik APJ</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Ada Koordinat</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-gray-400" /> Tanpa Koordinat</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-sky-500" /> Bisa Dibuka</div>
        </div>
      </div>

      <div className="relative mx-auto mt-4 h-80 w-full max-w-[330px] overflow-hidden rounded-lg border border-gray-500 bg-gradient-to-br from-sky-50 via-white to-emerald-50 shadow-sm">
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,#cbd5e1_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] [background-size:28px_28px]" />
        <div className="absolute inset-x-0 top-1/2 h-1 -rotate-12 bg-amber-200" />
        <div className="absolute inset-y-0 left-1/2 w-1 rotate-12 bg-amber-200" />
        <div className="relative flex h-full items-center justify-center px-8 text-center text-xs text-gray-600">
          Maps yang berisi Data Titik APJ
        </div>
        {items.slice(0, 12).map((item, index) => {
          const lat = Number(item.latitude || 0);
          const lng = Number(item.longitude || 0);
          const hasCoordinate = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
          const left = 14 + ((index * 23) % 70);
          const top = 18 + ((index * 31) % 62);
          return (
            <button
              key={`${item.idTitik || item.id_titik || item.id || index}-pin`}
              type="button"
              onClick={() => {
                if (hasCoordinate) window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank", "noopener,noreferrer");
              }}
              className={`absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold text-white shadow-md ${hasCoordinate ? "bg-red-600" : "bg-gray-500"}`}
              style={{ left: `${left}%`, top: `${top}%` }}
              title={item.idTitik || item.id_titik || item.id || `APJ-${index + 1}`}
            >
              •
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-2">
        {loading ? <p className="text-center text-sm text-gray-500">Memuat titik APJ...</p> : null}
        {!loading && items.length === 0 ? <p className="rounded-lg border border-gray-300 bg-white/90 p-4 text-center text-sm text-gray-500">Belum ada data titik APJ.</p> : null}
        {items.map((item, index) => {
          const idTitik = item.idTitik || item.id_titik || item.id || `APJ-${index + 1}`;
          const namaJalan = item.namaJalan || item.nama_jalan || "-";
          const lat = Number(item.latitude || 0);
          const lng = Number(item.longitude || 0);
          const hasCoordinate = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
          return (
            <div key={`${idTitik}-${index}`} className="rounded-lg border border-gray-300 bg-white p-3 shadow-sm">
              <div className="text-sm font-bold text-gray-950">{idTitik}</div>
              <div className="text-xs text-gray-600">{namaJalan}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">{item.kabupaten || "Kabupaten"}</div>
              {hasCoordinate ? (
                <a className="mt-2 inline-flex rounded-md border border-gray-500 bg-sky-100 px-3 py-1.5 text-xs font-bold" href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer">
                  Buka Peta
                </a>
              ) : null}
            </div>
          );
        })}
      </div>
    </PublicLayout>
  );
}

export function PublicApjMapPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ApjSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const kabupaten = (user?.kabupaten || "tabanan").trim().toLowerCase();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/om/apj-points?limit=5000&kabupaten=${encodeURIComponent(kabupaten)}`, { cache: "no-store" });
        const payload = (await response.json()) as { points?: ApjSurvey[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Gagal memuat titik APJ.");
        setItems(payload.points || []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Gagal memuat titik APJ.");
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [kabupaten]);

  const mapData = items
    .map((item, index) => ({
      id: item.id || item.idTitik || item.id_titik || `apj-${index}`,
      latitude: Number(item.latitude || 0),
      longitude: Number(item.longitude || 0),
      idTitik: item.idTitik || item.id_titik || `APJ-${index + 1}`,
      namaJalan: item.namaJalan || item.nama_jalan || "-",
      dayaLampu: item.dayaLampu || item.daya_lampu || "-",
      surveyorName: item.surveyorName || item.surveyor_name || "-",
      createdAt: item.createdAt || item.created_at || null,
      status: item.status || "submitted",
    }))
    .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude) && item.latitude !== 0 && item.longitude !== 0);

  return (
    <PublicLayout title="Peta Situasi & Titik" activeTab="home">
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-300 bg-white/95 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-gray-950">Peta Titik APJ</p>
              <p className="mt-1 text-xs leading-5 text-gray-600">
                Data tersinkron langsung dari master APJ admin O&M. Area: {kabupaten || "tabanan"}.
              </p>
            </div>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              {loading ? "..." : `${mapData.length}/${items.length}`} titik
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-gray-700">
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-blue-600" /> Titik APJ</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Ada Koordinat</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-gray-400" /> Data Kosong</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-sky-500" /> Bisa Dibuka</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm">
          <div className="h-[420px] [&_.leaflet-container]:!h-[420px]">
            <SurveyAPJProposeMap surveyData={mapData} />
          </div>
        </div>

        {loading ? <p className="text-center text-sm text-gray-500">Memuat titik APJ...</p> : null}
        {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {!loading && !error && mapData.length === 0 ? (
          <p className="rounded-lg border border-gray-300 bg-white/90 p-4 text-center text-sm text-gray-500">
            Belum ada titik APJ berkoordinat untuk area ini, tapi peta tetap tersedia.
          </p>
        ) : null}

        <div className="space-y-2">
          {mapData.map((item) => (
            <div key={item.id} className="rounded-lg border border-gray-300 bg-white p-3 shadow-sm">
              <div className="text-sm font-bold text-gray-950">{item.idTitik}</div>
              <div className="text-xs text-gray-600">{item.namaJalan}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">{item.dayaLampu}</div>
              <a className="mt-2 inline-flex rounded-md border border-gray-500 bg-sky-100 px-3 py-1.5 text-xs font-bold" href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer">
                Buka Peta
              </a>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
