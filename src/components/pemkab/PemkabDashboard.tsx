"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const PemkabLeafletMap = dynamic(() => import("@/components/pemkab/PemkabLeafletMap"), {
  ssr: false,
  loading: () => <div className="flex h-full min-h-[270px] items-center justify-center rounded-sm border border-gray-300 bg-slate-50 text-xs text-slate-500">Memuat peta...</div>,
});

type PemkabView = "kontruksi" | "om" | "laporan" | "profile";

type AdminReport = {
  id: string;
  title: string;
  location: string;
  status: string;
  kabupaten: string;
  createdAt: string | null;
  rawPayload?: Record<string, unknown>;
};

type OMReport = {
  id: string;
  title: string;
  description: string;
  reportType: string;
  location: string;
  idTitik?: string;
  damageType?: string;
  reporterName: string;
  status: string;
  kabupaten?: string;
  createdAt: string | null;
  updatedAt?: string | null;
};

type OMApjPoint = {
  id: string;
  idTitik: string;
  namaTitik?: string;
  namaJalan?: string;
  group?: string;
  status?: string;
  latitude?: number;
  longitude?: number;
  kabupaten?: string;
  dayaLampu?: string;
  validatedAt?: string;
  reports?: {
    total: number;
    new: number;
    diproses: number;
    selesai: number;
    ditolak: number;
  };
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function pickCoordinate(raw: Record<string, unknown> | undefined, keys: string[]) {
  if (!raw) return 0;
  for (const key of keys) {
    const direct = normalizeNumber(raw[key]);
    if (direct) return direct;
    const parts = key.split(".");
    let current: unknown = raw;
    for (const part of parts) {
      if (!current || typeof current !== "object") {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[part];
    }
    const nested = normalizeNumber(current);
    if (nested) return nested;
  }
  return 0;
}

function inDateRange(value: string | null | undefined, startDate: string, endDate: string) {
  if (!startDate && !endDate) return true;
  if (!value) return false;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`).getTime();
    if (time < start) return false;
  }
  if (endDate) {
    const end = new Date(`${endDate}T23:59:59`).getTime();
    if (time > end) return false;
  }
  return true;
}

function normalizeText(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function diffHours(start?: string | null, end?: string | null) {
  if (!start || !end) return 0;
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) return 0;
  return Math.round(((endTime - startTime) / 3_600_000) * 10) / 10;
}

function RedDecorations() {
  return (
    <>
      <div className="pointer-events-none absolute left-0 top-0 h-24 w-44 overflow-hidden">
        <div className="absolute -left-10 -top-16 h-32 w-48 rounded-br-[80px] bg-red-600" />
        <div className="absolute -left-9 -top-12 h-28 w-44 rounded-br-[80px] border-b-4 border-white/80" />
      </div>
      <div className="pointer-events-none absolute bottom-0 right-0 h-24 w-52 overflow-hidden">
        <div className="absolute -bottom-16 -right-8 h-32 w-56 rounded-tl-[90px] bg-red-600" />
        <div className="absolute -bottom-12 -right-10 h-28 w-52 rounded-tl-[90px] border-t-4 border-white/80" />
      </div>
    </>
  );
}

function Sidebar({ active, onChange }: { active: PemkabView; onChange: (view: PemkabView) => void }) {
  const items: Array<{ id: PemkabView; label: string }> = [
    { id: "kontruksi", label: "Maps Data Valid" },
    { id: "om", label: "Maps O&M" },
    { id: "laporan", label: "Data Laporan" },
    { id: "profile", label: "Profil" },
  ];
  return (
    <aside className="relative z-10 w-28 shrink-0 border-r border-gray-300 bg-white/90 px-2 py-3">
      <div className="mb-2 flex items-center gap-1 text-[10px] font-bold">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-500 text-[9px]">P</span>
        Pemkab
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`w-full rounded-sm px-2 py-1.5 text-left text-[10px] font-semibold ${active === item.id ? "bg-red-600 text-white" : "bg-white text-gray-800 hover:bg-red-50"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </aside>
  );
}

function TopActions({ title }: { title: string }) {
  const router = useRouter();
  return (
    <header className="relative z-10 flex h-10 items-center justify-between border-b border-gray-300 bg-white/80 px-3">
      <button
        type="button"
        onClick={() => router.push("/module-selection")}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black text-white"
        aria-label="Kembali ke panel modul"
        title="Kembali ke panel modul"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div className="min-w-0 flex-1 px-3 text-center text-xs font-bold">{title}</div>
      <div className="relative h-7 w-14">
        <Image src="/BDG1.png" alt="BGD" fill className="object-contain" />
      </div>
    </header>
  );
}

function StatCard({ label, value, note }: { label: string; value: number | string; note: string }) {
  return (
    <div className="rounded-sm border border-gray-300 bg-white p-3 shadow-sm">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-black text-gray-950">{value}</div>
      <div className="text-[10px] text-gray-500">{note}</div>
    </div>
  );
}

function ProgressBar({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-gray-700">
        <span>{label}</span>
        <span>{value} ({percent}%)</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function SlaDashboard({
  reports,
  constructionCount,
  omPointCount,
}: {
  reports: OMReport[];
  constructionCount: number;
  omPointCount: number;
}) {
  const now = Date.now();
  const total = reports.length;
  const newCount = reports.filter((report) => (report.status || "new") === "new").length;
  const processCount = reports.filter((report) => report.status === "diproses").length;
  const doneCount = reports.filter((report) => report.status === "selesai").length;
  const rejectedCount = reports.filter((report) => report.status === "ditolak").length;
  const activeCount = reports.filter((report) => !["selesai", "ditolak"].includes(report.status || "")).length;
  const overdueCount = reports.filter((report) => {
    if (["selesai", "ditolak"].includes(report.status || "")) return false;
    const created = new Date(report.createdAt || "").getTime();
    if (!Number.isFinite(created)) return false;
    return now - created > 48 * 60 * 60 * 1000;
  }).length;
  const doneDurations = reports
    .filter((report) => report.status === "selesai")
    .map((report) => diffHours(report.createdAt, report.updatedAt))
    .filter((hours) => hours > 0);
  const avgDoneHours = doneDurations.length > 0 ? Math.round(doneDurations.reduce((sum, item) => sum + item, 0) / doneDurations.length) : 0;
  const completionRate = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="rounded-sm border border-gray-300 bg-white/95 p-3 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-600">Ringkasan SLA & Progres</div>
          <div className="mt-1 text-xs text-gray-600">SLA awal: laporan aktif lebih dari 48 jam dihitung overdue.</div>
        </div>
        <div className={`rounded-full px-3 py-1 text-[10px] font-black ${overdueCount > 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
          {overdueCount > 0 ? `${overdueCount} overdue` : "SLA aman"}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Completion" value={`${completionRate}%`} note={`${doneCount} dari ${total} laporan selesai`} />
        <StatCard label="Aktif" value={activeCount} note="New + diproses, belum final" />
        <StatCard label="Overdue 48 jam" value={overdueCount} note="Belum selesai/ditolak" />
        <StatCard label="Rata-rata selesai" value={avgDoneHours ? `${avgDoneHours} jam` : "-"} note="Dari laporan status selesai" />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-2">
          <ProgressBar label="Belum diproses" value={newCount} total={total} tone="bg-red-500" />
          <ProgressBar label="Diproses" value={processCount} total={total} tone="bg-amber-500" />
          <ProgressBar label="Selesai" value={doneCount} total={total} tone="bg-emerald-600" />
          <ProgressBar label="Ditolak" value={rejectedCount} total={total} tone="bg-slate-500" />
        </div>
        <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
          <div className="rounded-sm border border-gray-200 bg-gray-50 p-2">
            <div className="text-gray-500">APJ O&M</div>
            <div className="text-lg font-black text-gray-950">{omPointCount}</div>
          </div>
          <div className="rounded-sm border border-gray-200 bg-gray-50 p-2">
            <div className="text-gray-500">Konstruksi</div>
            <div className="text-lg font-black text-gray-950">{constructionCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportsTable({ reports }: { reports: OMReport[] }) {
  return (
    <div className="h-full rounded-sm border border-gray-300 bg-white">
      <div className="border-b border-gray-300 p-2">
        <input className="h-7 w-full rounded-full border border-gray-300 px-3 text-[11px] outline-none" placeholder="Daftar titik yang sudah dalam proses kontruksi / O&M" readOnly />
      </div>
      <div className="max-h-[260px] overflow-auto">
        {reports.length === 0 ? <p className="p-4 text-center text-xs text-gray-500">Belum ada laporan O&M.</p> : null}
        {reports.map((report) => (
          <div key={report.id} className="grid grid-cols-[1fr_auto] gap-2 border-b border-gray-200 px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-gray-950">{report.damageType || report.title}</div>
              <div className="truncate text-[10px] text-gray-500">{report.idTitik || report.location}</div>
              <div className="text-[10px] text-gray-400">{formatDate(report.createdAt)} - {report.reporterName || "Pelapor"}</div>
            </div>
            <div className="self-start rounded-full border border-gray-300 px-2 py-1 text-[10px] font-semibold">{report.status || "new"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

type PemkabFilter = {
  wilayah: string;
  status: string;
  startDate: string;
  endDate: string;
};

function FilterPanel({
  filter,
  wilayahOptions,
  statusOptions,
  onChange,
  onReset,
}: {
  filter: PemkabFilter;
  wilayahOptions: string[];
  statusOptions: string[];
  onChange: (key: keyof PemkabFilter, value: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-sm border border-gray-300 bg-white/95 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Filter Monitoring</div>
        <button type="button" onClick={onReset} className="rounded-full border border-gray-300 px-3 py-1 text-[10px] font-bold text-gray-700">
          Reset
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="text-[10px] text-gray-600">Wilayah</span>
          <select value={filter.wilayah} onChange={(event) => onChange("wilayah", event.target.value)} className="mt-1 h-8 w-full rounded-sm border border-gray-300 bg-white px-2 text-xs outline-none">
            <option value="">Semua wilayah</option>
            {wilayahOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] text-gray-600">Status</span>
          <select value={filter.status} onChange={(event) => onChange("status", event.target.value)} className="mt-1 h-8 w-full rounded-sm border border-gray-300 bg-white px-2 text-xs outline-none">
            <option value="">Semua status</option>
            {statusOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] text-gray-600">Dari tanggal</span>
          <input type="date" value={filter.startDate} onChange={(event) => onChange("startDate", event.target.value)} className="mt-1 h-8 w-full rounded-sm border border-gray-300 bg-white px-2 text-xs outline-none" />
        </label>
        <label className="block">
          <span className="text-[10px] text-gray-600">Sampai tanggal</span>
          <input type="date" value={filter.endDate} onChange={(event) => onChange("endDate", event.target.value)} className="mt-1 h-8 w-full rounded-sm border border-gray-300 bg-white px-2 text-xs outline-none" />
        </label>
      </div>
    </div>
  );
}

function ProfileView() {
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
    setMessage("Profil berhasil diperbarui.");
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-white/70">
        <div className="flex h-28 w-28 items-center justify-center rounded-full border-[5px] border-black bg-white">
          <svg className="h-20 w-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4.25" strokeWidth={1.8} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 20a7 7 0 0 1 14 0" />
          </svg>
        </div>
        <button type="button" onClick={() => setEditing(true)} className="mt-3 rounded-md border border-sky-300 bg-sky-50 px-5 py-2 text-xs font-bold">Edit Profil</button>
        <div className="mt-4 grid w-full max-w-xs gap-2">
          <div className="rounded-full border border-gray-400 bg-white px-4 py-2 text-center text-xs font-bold">{form.name || "Nama"}</div>
          <div className="rounded-full border border-gray-400 bg-white px-4 py-2 text-center text-xs font-bold">{form.username || "Username"}</div>
          <div className="rounded-full border border-gray-400 bg-white px-4 py-2 text-center text-xs font-bold">{form.email || "Email"}</div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="mx-auto mt-4 w-full max-w-md rounded-sm border border-gray-500 bg-white p-4">
      <p className="mb-3 text-center text-xs font-semibold">Kelola Akun Anda Dibawah Ini</p>
      <div className="space-y-2">
        {[
          ["Username", "username", "Data Username"],
          ["Email", "email", "Data Email"],
          ["Nama", "name", "Data Nama"],
          ["No. Telp", "phoneNumber", "Data No. Telp"],
          ["Kata Sandi Baru", "newPassword", "Masukkan kata sandi baru jika ingin mengubah"],
          ["Konfirmasi Kata Sandi", "confirmPassword", "Masukkan ulang kata sandi baru"],
        ].map(([label, key, placeholder]) => (
          <label key={key} className="block">
            <span className="text-[10px] text-gray-600">{label}</span>
            <input
              type={key.toLowerCase().includes("password") ? "password" : "text"}
              value={form[key as keyof typeof form]}
              onChange={(event) => update(key as keyof typeof form, event.target.value)}
              className="mt-1 h-8 w-full rounded-sm border border-gray-400 px-2 text-xs outline-none"
              placeholder={placeholder}
            />
          </label>
        ))}
      </div>
      {error ? <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</div> : null}
      {message ? <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">{message}</div> : null}
      <button type="submit" className="mx-auto mt-5 block rounded-md border border-gray-500 bg-sky-100 px-5 py-2 text-xs font-bold">Simpan Perubahan</button>
    </form>
  );
}

function Panel({ active, children }: { active: PemkabView; children: ReactNode }) {
  const titleMap: Record<PemkabView, string> = {
    kontruksi: "Maps Data Valid",
    om: "Maps O&M",
    laporan: "Monitoring Laporan",
    profile: "Profil Pemkab",
  };
  const [view, setView] = useState<PemkabView>(active);

  return (
    <div className="min-h-screen bg-[#f3f3f3] p-4">
      <div className="mx-auto min-h-[520px] w-full max-w-5xl overflow-hidden border border-gray-300 bg-white shadow-sm">
        <div className="relative min-h-[520px]">
          <RedDecorations />
          <TopActions title={titleMap[view]} />
          <div className="relative z-10 flex min-h-[480px]">
            <Sidebar active={view} onChange={setView} />
            <main className="min-w-0 flex-1 p-4">
              <div key={`pemkab-view-${view}`}>
                {view === active ? children : <PemkabContent active={view} />}
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

function PemkabContent({ active }: { active: PemkabView }) {
  const [constructionReports, setConstructionReports] = useState<AdminReport[]>([]);
  const [omReports, setOmReports] = useState<OMReport[]>([]);
  const [omPoints, setOmPoints] = useState<OMApjPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PemkabFilter>({ wilayah: "", status: "", startDate: "", endDate: "" });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [constructionResponse, omResponse, omPointsResponse] = await Promise.all([
          fetch("/api/admin/reports?limit=200&includeData=1", { cache: "no-store" }),
          fetch("/api/om/reports?limit=200", { cache: "no-store" }),
          fetch("/api/om/apj-points?limit=5000", { cache: "no-store" }),
        ]);
        const constructionPayload = (await constructionResponse.json()) as { reports?: AdminReport[] };
        const omPayload = (await omResponse.json()) as { reports?: OMReport[] };
        const omPointsPayload = (await omPointsResponse.json()) as { points?: OMApjPoint[] };
        setConstructionReports(constructionPayload.reports || []);
        setOmReports(omPayload.reports || []);
        setOmPoints(omPointsPayload.points || []);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const wilayahOptions = useMemo(() => {
    const values = new Set<string>();
    constructionReports.forEach((item) => {
      if (item.kabupaten) values.add(item.kabupaten);
    });
    omReports.forEach((item) => {
      if (item.kabupaten) values.add(item.kabupaten);
    });
    omPoints.forEach((item) => {
      if (item.kabupaten) values.add(item.kabupaten);
    });
    return Array.from(values).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [constructionReports, omPoints, omReports]);

  const statusOptions = useMemo(() => {
    const values = new Set(["new", "diproses", "selesai", "ditolak", "valid", "menyala", "ada laporan"]);
    constructionReports.forEach((item) => {
      if (item.status) values.add(item.status);
    });
    omReports.forEach((item) => {
      if (item.status) values.add(item.status);
    });
    return Array.from(values).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [constructionReports, omReports]);

  const filteredConstructionReports = useMemo(() => {
    const wilayah = normalizeText(filter.wilayah);
    const status = normalizeText(filter.status);
    return constructionReports.filter((report) => {
      if (wilayah && normalizeText(report.kabupaten) !== wilayah) return false;
      if (status && normalizeText(report.status || "pending") !== status) return false;
      return inDateRange(report.createdAt, filter.startDate, filter.endDate);
    });
  }, [constructionReports, filter]);

  const filteredOmReports = useMemo(() => {
    const wilayah = normalizeText(filter.wilayah);
    const status = normalizeText(filter.status);
    return omReports.filter((report) => {
      if (wilayah) {
        const searchable = normalizeText(`${report.kabupaten || ""} ${report.location || ""} ${report.idTitik || ""}`);
        if (!searchable.includes(wilayah)) return false;
      }
      if (status && normalizeText(report.status || "new") !== status) return false;
      return inDateRange(report.createdAt, filter.startDate, filter.endDate);
    });
  }, [filter, omReports]);

  const filteredOmPoints = useMemo(() => {
    const wilayah = normalizeText(filter.wilayah);
    const status = normalizeText(filter.status);
    return omPoints.filter((point) => {
      if (wilayah && normalizeText(point.kabupaten) !== wilayah) return false;
      if (status) {
        const pointStatus = normalizeText((point.reports?.total || 0) > 0 ? "ada laporan" : point.status || "menyala");
        const reportStatusHit =
          status === "new" ? (point.reports?.new || 0) > 0 :
          status === "diproses" ? (point.reports?.diproses || 0) > 0 :
          status === "selesai" ? (point.reports?.selesai || 0) > 0 :
          status === "ditolak" ? (point.reports?.ditolak || 0) > 0 :
          false;
        if (pointStatus !== status && !reportStatusHit) return false;
      }
      return inDateRange(point.validatedAt, filter.startDate, filter.endDate);
    });
  }, [filter, omPoints]);

  const stats = useMemo(() => {
    const processed = filteredOmReports.filter((report) => !["", "new"].includes((report.status || "").toLowerCase())).length;
    return {
      totalOm: filteredOmReports.length,
      newOm: filteredOmReports.filter((report) => (report.status || "new") === "new").length,
      processed,
      construction: filteredConstructionReports.length,
      omPoints: filteredOmPoints.length,
      omPointsWithReports: filteredOmPoints.filter((point) => (point.reports?.total || 0) > 0).length,
    };
  }, [filteredConstructionReports.length, filteredOmPoints, filteredOmReports]);

  const constructionMapPoints = useMemo(
    () =>
      filteredConstructionReports.map((report) => ({
        id: report.id,
        label: report.title || report.location || "Data konstruksi",
        subtitle: report.location,
        status: report.status || "pending",
        latitude: pickCoordinate(report.rawPayload, ["latitude", "lat", "coords.latitude", "coordinate.latitude", "location.latitude"]),
        longitude: pickCoordinate(report.rawPayload, ["longitude", "lng", "lon", "coords.longitude", "coordinate.longitude", "location.longitude"]),
        meta: {
          Kabupaten: report.kabupaten,
          Tanggal: formatDate(report.createdAt),
        },
      })),
    [filteredConstructionReports]
  );

  const omMapPoints = useMemo(
    () =>
      filteredOmPoints.map((point) => ({
        id: point.id || point.idTitik,
        label: point.idTitik || point.namaTitik || "APJ",
        subtitle: `${point.namaJalan || "-"}${point.group ? ` - ${point.group}` : ""}`,
        status: (point.reports?.total || 0) > 0 ? "ada laporan" : point.status || "menyala",
        latitude: point.latitude || 0,
        longitude: point.longitude || 0,
        meta: {
          Grup: point.group,
          Kabupaten: point.kabupaten,
          Daya: point.dayaLampu,
          Laporan: point.reports?.total || 0,
        },
      })),
    [filteredOmPoints]
  );

  const updateFilter = (key: keyof PemkabFilter, value: string) => setFilter((current) => ({ ...current, [key]: value }));
  const resetFilter = () => setFilter({ wilayah: "", status: "", startDate: "", endDate: "" });
  const filterPanel = <FilterPanel filter={filter} wilayahOptions={wilayahOptions} statusOptions={statusOptions} onChange={updateFilter} onReset={resetFilter} />;

  if (active === "profile") {
    return <ProfileView />;
  }

  if (active === "kontruksi") {
    return (
      <div className="space-y-3">
        {filterPanel}
        <div className="grid h-full gap-3 lg:grid-cols-[1fr_220px]">
          <PemkabLeafletMap
            title="Maps Data Valid"
            points={loading ? [] : constructionMapPoints}
          />
          <div className="grid content-start gap-2">
            <StatCard label="Data valid" value={stats.construction} note="Total data kontruksi/report valid" />
            <StatCard label="Berkoordinat" value={constructionMapPoints.filter((point) => point.latitude && point.longitude).length} note="Marker yang tampil di peta" />
            <StatCard label="Diproses" value={filteredConstructionReports.filter((item) => item.status && item.status !== "pending").length} note="Status bukan pending" />
            <StatCard label="Pending" value={filteredConstructionReports.filter((item) => !item.status || item.status === "pending").length} note="Masih menunggu proses" />
          </div>
        </div>
      </div>
    );
  }

  if (active === "om") {
    return (
      <div className="space-y-3">
        {filterPanel}
        <div className="grid h-full gap-3 lg:grid-cols-[1fr_220px]">
          <PemkabLeafletMap
            title="Maps O&M"
            points={loading ? [] : omMapPoints}
          />
          <div className="grid content-start gap-2">
            <StatCard label="Titik APJ" value={stats.omPoints} note="Master APJ O&M menyala" />
            <StatCard label="Berkoordinat" value={omMapPoints.filter((point) => point.latitude && point.longitude).length} note="Marker yang tampil di peta" />
            <StatCard label="Ada laporan" value={stats.omPointsWithReports} note="Titik yang punya laporan O&M" />
            <StatCard label="Total laporan" value={stats.totalOm} note="Semua laporan O&M" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filterPanel}
      <SlaDashboard reports={filteredOmReports} constructionCount={stats.construction} omPointCount={stats.omPoints} />
      <div className="grid h-full gap-3 lg:grid-cols-[1fr_220px]">
        <ReportsTable reports={filteredOmReports} />
        <div className="grid content-start gap-2">
          <StatCard label="Total laporan" value={stats.totalOm} note="Masuk dari O&M dan masyarakat" />
          <StatCard label="Belum diproses" value={stats.newOm} note="Perlu tindak lanjut admin/petugas" />
          <StatCard label="Sudah diproses" value={stats.processed} note="Sudah berubah status" />
          <StatCard label="Kontruksi" value={stats.construction} note="Data report kontruksi/valid" />
        </div>
      </div>
    </div>
  );
}

export default function PemkabDashboard() {
  return (
    <Panel active="kontruksi">
      <PemkabContent active="kontruksi" />
    </Panel>
  );
}
