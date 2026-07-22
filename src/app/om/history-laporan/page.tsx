"use client";

import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { OMPageShell } from "@/components/om/OMPageShell";
import { isMobileOmRole, PreventiveOMReportsList } from "@/components/om/PreventiveOMMobile";

type StatusTimelineItem = {
  status: string;
  actorId?: string;
  actorName?: string;
  note?: string;
  at?: string;
};

type HistoryReport = {
  id: string;
  title: string;
  description: string;
  reportType: string;
  location?: string;
  idTitik?: string;
  reporterName?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  damageType?: string;
  taskTitle?: string;
  groupName?: string;
  statusTimeline?: StatusTimelineItem[];
  lastStatusActorName?: string;
  lastStatusNote?: string;
  lastStatusAt?: string;
};

const statusLabels: Record<string, string> = {
  new: "Baru",
  diproses: "Diproses",
  selesai: "Selesai",
  ditolak: "Ditolak",
};

function formatDateTime(value?: string) {
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

function statusTone(status: string) {
  if (status === "selesai") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "diproses") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "ditolak") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function AdminReportHistory() {
  const { user } = useAuth();
  const accountKabupaten = user?.role === "super-admin" ? "" : user?.kabupaten?.trim().toLowerCase() || "tabanan";
  const [reports, setReports] = useState<HistoryReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<HistoryReport | null>(null);
  const [statusFilter, setStatusFilter] = useState("semua");
  const [typeFilter, setTypeFilter] = useState("semua");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = async () => {
    setLoading(true);
    setError("");
    try {
      const areaSuffix = accountKabupaten ? `&kabupaten=${encodeURIComponent(accountKabupaten)}` : "";
      const response = await fetch(`/api/om/reports?limit=500${areaSuffix}`, { cache: "no-store" });
      const payload = (await response.json()) as { reports?: HistoryReport[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal memuat riwayat laporan.");
      setReports(payload.reports || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat riwayat laporan.");
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReports();
  }, [accountKabupaten]);

  const visibleReports = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return reports.filter((report) => {
      if (statusFilter !== "semua" && report.status !== statusFilter) return false;
      if (typeFilter !== "semua" && report.reportType !== typeFilter) return false;
      if (!keyword) return true;
      return [report.id, report.title, report.idTitik, report.location, report.reporterName, report.damageType, report.taskTitle, report.groupName]
        .some((value) => String(value || "").toLowerCase().includes(keyword));
    });
  }, [query, reports, statusFilter, typeFilter]);

  const totalEvents = reports.reduce((total, report) => total + (report.statusTimeline?.length || 1), 0);
  const closedCount = reports.filter((report) => report.status === "selesai" || report.status === "ditolak").length;
  const actorCount = new Set(reports.flatMap((report) => (report.statusTimeline || []).map((item) => item.actorName).filter(Boolean))).size;

  return (
    <OMPageShell
      eyebrow="Riwayat & Audit Laporan"
      title="Riwayat laporan O&M untuk audit dan penelusuran."
      description="Telusuri laporan lama, kronologi perubahan status, catatan keputusan, serta identitas petugas atau admin yang terlibat."
      statusTitle="Jejak laporan tercatat dalam satu alur baca."
      statusDescription="Setiap laporan menampilkan kondisi terakhir dan timeline lengkap sejak laporan dibuat hingga selesai atau ditolak."
      metaCards={[
        { label: "Laporan", value: String(reports.length), hint: "Seluruh riwayat", tone: "teal" },
        { label: "Kronologi", value: String(totalEvents), hint: "Total catatan status", tone: "cyan" },
        { label: "Ditutup", value: String(closedCount), hint: "Selesai atau ditolak", tone: "slate" },
        { label: "Aktor", value: String(actorCount), hint: "Petugas/admin tercatat", tone: "emerald" },
      ]}
    >
      <div className="rounded-[28px] border border-teal-100 bg-white/95 p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">Log Aktivitas</div>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Histori laporan dan perubahan status</h2>
            <p className="mt-1 text-sm text-slate-500">Klik salah satu laporan untuk melihat kronologi lengkap.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari laporan, ID titik, atau petugas..." className="min-w-[280px] rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-teal-400" />
            <button type="button" onClick={() => void loadReports()} disabled={loading} className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-700 disabled:opacity-60">
              {loading ? "Memuat..." : "Muat Ulang"}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-400">
              <option value="semua">Semua Status</option>
              <option value="new">Baru</option>
              <option value="diproses">Diproses</option>
              <option value="selesai">Selesai</option>
              <option value="ditolak">Ditolak</option>
            </select>
          </label>
          <label>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Jenis Laporan</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-400">
              <option value="semua">Semua Jenis</option>
              <option value="preventif">Preventif</option>
              <option value="korektif">Korektif</option>
              <option value="masyarakat">Masyarakat</option>
            </select>
          </label>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
        {!loading && visibleReports.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">Belum ada riwayat yang sesuai filter.</div> : null}

        <div className="mt-5 space-y-3">
          {visibleReports.map((report) => {
            const timeline = report.statusTimeline || [];
            const latest = timeline[timeline.length - 1];
            return (
              <button key={report.id} type="button" onClick={() => setSelectedReport(report)} className="block w-full rounded-[24px] border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-teal-200 hover:bg-teal-50/50">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${statusTone(report.status)}`}>{statusLabels[report.status] || report.status}</span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{report.reportType || "laporan"}</span>
                      <span className="text-[11px] text-slate-400">{timeline.length || 1} catatan</span>
                    </div>
                    <h3 className="mt-3 truncate text-sm font-bold text-slate-950">{report.title || "Laporan O&M"}</h3>
                    <div className="mt-1 text-xs text-slate-500">{report.idTitik || report.location || "-"} · {report.reporterName || "Pelapor"} · {formatDateTime(report.createdAt)}</div>
                  </div>
                  <div className="w-full rounded-2xl border border-slate-200 bg-white p-3 lg:max-w-md">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Perubahan Terakhir</div>
                    <div className="mt-1 text-xs font-semibold text-slate-800">{latest?.actorName || report.lastStatusActorName || report.reporterName || "Sistem GESA"}</div>
                    <div className="mt-0.5 text-xs text-slate-600">{latest?.note || report.lastStatusNote || "Laporan dibuat dan tercatat di sistem."}</div>
                    <div className="mt-1 text-[10px] text-slate-400">{formatDateTime(latest?.at || report.lastStatusAt || report.updatedAt || report.createdAt)}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedReport ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div className="min-w-0 pr-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase ${statusTone(selectedReport.status)}`}>{statusLabels[selectedReport.status] || selectedReport.status}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-600">Riwayat Laporan</span>
                </div>
                <h3 className="mt-2 truncate text-lg font-black text-slate-950">{selectedReport.title}</h3>
                <div className="mt-1 text-xs text-slate-500">{selectedReport.idTitik || selectedReport.location || "-"} · {selectedReport.id}</div>
              </div>
              <button type="button" onClick={() => setSelectedReport(null)} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">Tutup</button>
            </div>
            <div className="max-h-[75vh] overflow-auto p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Pelapor</div><div className="mt-1 text-xs font-semibold">{selectedReport.reporterName || "-"}</div></div>
                <div className="rounded-2xl bg-slate-50 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Jenis</div><div className="mt-1 text-xs font-semibold">{selectedReport.reportType || "-"}</div></div>
                <div className="rounded-2xl bg-slate-50 p-3 sm:col-span-2"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Deskripsi</div><div className="mt-1 text-xs leading-5 text-slate-700">{selectedReport.description || "-"}</div></div>
              </div>

              <div className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-slate-900">Kronologi Lengkap</div>
              <div className="mt-4 space-y-0">
                {(selectedReport.statusTimeline?.length ? selectedReport.statusTimeline : [{ status: selectedReport.status || "new", actorName: selectedReport.reporterName || "Pelapor", note: "Laporan dibuat dan masuk ke sistem.", at: selectedReport.createdAt }]).map((item, index, timeline) => (
                  <div key={`${selectedReport.id}-${item.status}-${item.at || index}`} className="relative flex gap-4 pb-6">
                    {index < timeline.length - 1 ? <div className="absolute left-[11px] top-6 h-full w-0.5 bg-teal-100" /> : null}
                    <div className="relative z-10 mt-1 h-6 w-6 shrink-0 rounded-full border-4 border-white bg-teal-600 shadow" />
                    <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${statusTone(item.status)}`}>{statusLabels[item.status] || item.status}</span>
                        <span className="text-[10px] text-slate-400">{formatDateTime(item.at)}</span>
                      </div>
                      <div className="mt-2 text-xs font-bold text-slate-900">{item.actorName || "Sistem GESA"}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-600">{item.note || `Status laporan menjadi ${statusLabels[item.status] || item.status}.`}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </OMPageShell>
  );
}

export default function OMHistoryLaporanPage() {
  const { user } = useAuth();
  const isMobileRole = isMobileOmRole(user?.role);

  return (
    <ProtectedRoute>
      {isMobileRole ? <PreventiveOMReportsList mode="reports" /> : <AdminReportHistory />}
    </ProtectedRoute>
  );
}
