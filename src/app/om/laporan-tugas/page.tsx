"use client";

import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { OMPageShell } from "@/components/om/OMPageShell";
import { isMobileOmRole, PreventiveOMReportForm } from "@/components/om/PreventiveOMMobile";

type WorkReport = {
  id: string;
  title: string;
  description: string;
  reportType: string;
  formVariant?: string;
  location?: string;
  idTitik?: string;
  reporterName?: string;
  status?: string;
  createdAt?: string;
  taskId?: string;
  taskTitle?: string;
  taskScope?: string;
  groupName?: string;
  damageType?: string;
  inspectionCondition?: string;
  repairAction?: string;
  luxTitikApi?: string;
  luxRataRata?: string;
  luxBeforePhotoName?: string;
  luxBeforePhotoUrl?: string;
  adjustmentActionLabel?: string;
  luxAfterAdjustment?: string;
  luxAfterPhotoName?: string;
  luxAfterPhotoUrl?: string;
  lampCondition?: string;
  ornamentCondition?: string;
  maintenanceAction?: string;
  photoDamageName?: string;
  photoPoleName?: string;
  photoLampName?: string;
  photoOrnamentName?: string;
  phoneNumber?: string;
};

type ReportFilter = "semua" | "preventif" | "korektif";

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

function reportTypeLabel(report: WorkReport) {
  return report.reportType === "korektif" ? "Perbaikan Korektif" : "Perawatan Preventif";
}

function DetailField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-1 break-words text-xs font-semibold text-slate-800">{value || "-"}</div>
    </div>
  );
}

function AdminWorkReportRecap() {
  const { user } = useAuth();
  const accountKabupaten = user?.role === "super-admin" ? "" : user?.kabupaten?.trim().toLowerCase() || "tabanan";
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<WorkReport | null>(null);
  const [filter, setFilter] = useState<ReportFilter>("semua");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = async () => {
    setLoading(true);
    setError("");
    try {
      const areaSuffix = accountKabupaten ? `&kabupaten=${encodeURIComponent(accountKabupaten)}` : "";
      const response = await fetch(`/api/om/reports?limit=500${areaSuffix}`, { cache: "no-store" });
      const payload = (await response.json()) as { reports?: WorkReport[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal memuat rekap laporan tugas.");
      setReports((payload.reports || []).filter((report) => report.reportType === "preventif" || report.reportType === "korektif"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat rekap laporan tugas.");
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
      if (filter !== "semua" && report.reportType !== filter) return false;
      if (!keyword) return true;
      return [report.id, report.idTitik, report.location, report.title, report.taskTitle, report.reporterName, report.groupName, report.damageType]
        .some((value) => String(value || "").toLowerCase().includes(keyword));
    });
  }, [filter, query, reports]);

  const preventiveCount = reports.filter((report) => report.reportType === "preventif").length;
  const correctiveCount = reports.filter((report) => report.reportType === "korektif").length;
  const taskCount = reports.filter((report) => Boolean(report.taskId) || report.formVariant === "preventive-task").length;

  const exportCsv = () => {
    const rows = [
      ["Tanggal", "Jenis", "ID Titik", "Grup", "Petugas", "Tugas", "Temuan/Kerusakan", "Kondisi Lampu", "Lux Titik Api", "Tindakan"],
      ...visibleReports.map((report) => [
        formatDateTime(report.createdAt),
        reportTypeLabel(report),
        report.idTitik || report.location || "-",
        report.groupName || "-",
        report.reporterName || "-",
        report.taskTitle || report.title || "-",
        report.damageType || report.inspectionCondition || "-",
        report.lampCondition || "-",
        report.luxTitikApi || "-",
        report.reportType === "korektif" ? report.repairAction || "-" : report.maintenanceAction || "-",
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rekap-perawatan-perbaikan-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <OMPageShell
      eyebrow="Rekap Laporan Tugas"
      title="Rekap perawatan preventif dan perbaikan korektif."
      description="Data di halaman ini otomatis berasal dari formulir hasil pekerjaan yang dikirim petugas O&M, bukan diinput ulang oleh admin."
      statusTitle="Satu sumber rekap pekerjaan lapangan."
      statusDescription="Admin dapat menelusuri hasil inspeksi, pengukuran lux, kondisi komponen, tindakan perawatan, dan perbaikan korektif dari satu halaman."
      metaCards={[
        { label: "Total", value: String(reports.length), hint: "Seluruh hasil pekerjaan", tone: "teal" },
        { label: "Preventif", value: String(preventiveCount), hint: "Rekap perawatan", tone: "cyan" },
        { label: "Korektif", value: String(correctiveCount), hint: "Rekap perbaikan", tone: "slate" },
        { label: "Dari Tugas", value: String(taskCount), hint: "Terhubung distribusi tugas", tone: "emerald" },
      ]}
    >
      <div className="rounded-[28px] border border-teal-100 bg-white/95 p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">Data Masuk dari Petugas</div>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Rekap pekerjaan O&M</h2>
            <p className="mt-1 text-sm text-slate-500">Klik laporan untuk melihat seluruh isian form petugas.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari ID titik, petugas, grup, atau tugas..."
              className="min-w-[280px] rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-teal-400"
            />
            <button type="button" onClick={() => void loadReports()} disabled={loading} className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-700 disabled:opacity-60">
              {loading ? "Memuat..." : "Muat Ulang"}
            </button>
            <button type="button" onClick={exportCsv} disabled={visibleReports.length === 0} className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
              Export Rekap
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {([
            ["semua", `Semua (${reports.length})`],
            ["preventif", `Preventif (${preventiveCount})`],
            ["korektif", `Korektif (${correctiveCount})`],
          ] as Array<[ReportFilter, string]>).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full border px-4 py-2 text-xs font-semibold ${filter === value ? "border-teal-600 bg-teal-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>
              {label}
            </button>
          ))}
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
        {!loading && visibleReports.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">Belum ada laporan tugas preventif atau korektif.</div> : null}

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
          <div className="hidden grid-cols-[150px_140px_150px_minmax(180px,1fr)_180px_110px] gap-3 bg-slate-50 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 lg:grid">
            <div>Tanggal</div><div>Jenis</div><div>ID Titik</div><div>Hasil/Tindakan</div><div>Petugas</div><div>Detail</div>
          </div>
          <div className="divide-y divide-slate-100">
            {visibleReports.map((report) => {
              const action = report.reportType === "korektif" ? report.repairAction : report.maintenanceAction || report.inspectionCondition;
              return (
                <button key={report.id} type="button" onClick={() => setSelectedReport(report)} className="grid w-full gap-2 px-4 py-4 text-left transition hover:bg-teal-50/50 lg:grid-cols-[150px_140px_150px_minmax(180px,1fr)_180px_110px] lg:items-center lg:gap-3">
                  <div className="text-xs text-slate-600">{formatDateTime(report.createdAt)}</div>
                  <div><span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${report.reportType === "korektif" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{report.reportType}</span></div>
                  <div className="text-xs font-bold text-slate-950">{report.idTitik || report.location || "-"}</div>
                  <div className="min-w-0"><div className="truncate text-xs font-semibold text-slate-800">{action || report.damageType || report.description || "-"}</div><div className="mt-0.5 truncate text-[11px] text-slate-400">{report.taskTitle || report.title}</div></div>
                  <div className="truncate text-xs text-slate-600">{report.reporterName || "-"}</div>
                  <div className="text-xs font-semibold text-teal-700">Lihat lengkap</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selectedReport ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:items-center">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-600">{reportTypeLabel(selectedReport)}</div>
                <h3 className="mt-1 text-lg font-black text-slate-950">{selectedReport.title || "Laporan Tugas O&M"}</h3>
                <div className="mt-1 text-xs text-slate-500">{formatDateTime(selectedReport.createdAt)} · {selectedReport.reporterName || "Petugas O&M"}</div>
              </div>
              <button type="button" onClick={() => setSelectedReport(null)} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">Tutup</button>
            </div>
            <div className="max-h-[75vh] overflow-auto p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DetailField label="Nomor Laporan" value={selectedReport.id} />
                <DetailField label="ID Titik APJ" value={selectedReport.idTitik || selectedReport.location} />
                <DetailField label="Petugas" value={selectedReport.reporterName} />
                <DetailField label="Tugas" value={selectedReport.taskTitle} />
                <DetailField label="Grup APJ" value={selectedReport.groupName} />
                <DetailField label="Cakupan" value={selectedReport.taskScope} />
                <DetailField label="Jenis Kerusakan/Temuan" value={selectedReport.damageType} />
                <DetailField label="Kondisi Inspeksi" value={selectedReport.inspectionCondition} />
                <DetailField label="Lux Titik Api" value={selectedReport.luxTitikApi} />
                <DetailField label="Lux Rata-rata" value={selectedReport.luxRataRata} />
                <DetailField label="Penyesuaian Dimming" value={selectedReport.adjustmentActionLabel} />
                <DetailField label="Lux Setelah Penyesuaian" value={selectedReport.luxAfterAdjustment} />
                <DetailField label="Kondisi Lampu" value={selectedReport.lampCondition} />
                <DetailField label="Kondisi Ornamen" value={selectedReport.ornamentCondition} />
                <DetailField label="Tindakan Perawatan" value={selectedReport.maintenanceAction} />
                <DetailField label="Tindakan Perbaikan" value={selectedReport.repairAction} />
                <DetailField label="Foto Lampu" value={selectedReport.photoLampName || selectedReport.photoDamageName} />
                <DetailField label="Foto Ornamen/Tiang" value={selectedReport.photoOrnamentName || selectedReport.photoPoleName} />
                <div className="sm:col-span-2 lg:col-span-3"><DetailField label="Deskripsi / Catatan Petugas" value={selectedReport.description} /></div>
              </div>
              {selectedReport.luxBeforePhotoUrl || selectedReport.luxAfterPhotoUrl ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {selectedReport.luxBeforePhotoUrl ? (
                    <a href={selectedReport.luxBeforePhotoUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 text-xs font-bold text-slate-700">Bukti Lux Meter Awal</div>
                      <img src={selectedReport.luxBeforePhotoUrl} alt="Bukti lux meter awal" className="h-48 w-full rounded-xl object-cover" />
                    </a>
                  ) : null}
                  {selectedReport.luxAfterPhotoUrl ? (
                    <a href={selectedReport.luxAfterPhotoUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 p-3">
                      <div className="mb-2 text-xs font-bold text-amber-900">Bukti Lux Setelah Penyesuaian</div>
                      <img src={selectedReport.luxAfterPhotoUrl} alt="Bukti lux setelah penyesuaian" className="h-48 w-full rounded-xl object-cover" />
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </OMPageShell>
  );
}

export default function OMLaporanTugasPage() {
  const { user } = useAuth();
  const isMobileRole = isMobileOmRole(user?.role);

  return (
    <ProtectedRoute>
      {isMobileRole ? <PreventiveOMReportForm /> : <AdminWorkReportRecap />}
    </ProtectedRoute>
  );
}
