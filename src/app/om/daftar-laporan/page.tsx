"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { OMPageShell } from "@/components/om/OMPageShell";
import { isMobileOmRole, PreventiveOMReportsList } from "@/components/om/PreventiveOMMobile";

type OMReport = {
  id: string;
  title: string;
  description: string;
  reportType: string;
  location: string;
  reporterName: string;
  status: "new" | "diproses" | "selesai" | "ditolak" | string;
  createdAt?: string;
  updatedAt?: string;
  statusTimeline?: Array<{
    status: string;
    actorName: string;
    note: string;
    at: string;
  }>;
  damageType?: string;
  idTitik?: string;
  photoDamageName?: string;
  photoPoleName?: string;
  phoneNumber?: string;
  inspectionCondition?: string;
  repairAction?: string;
  formVariant?: string;
};

const statusLabels: Record<string, string> = {
  new: "Baru",
  diproses: "Diproses",
  selesai: "Selesai",
  ditolak: "Ditolak",
};

function statusTone(status: string) {
  if (status === "selesai") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "diproses") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "ditolak") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function ReportDetailField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-1 text-xs font-semibold text-slate-800">{value || "-"}</div>
    </div>
  );
}

export default function OMDaftarLaporanPage() {
  const { user } = useAuth();
  const isMobileRole = isMobileOmRole(user?.role);
  const accountKabupaten = user?.role === "super-admin" ? "" : user?.kabupaten?.trim().toLowerCase() || "tabanan";
  const [reports, setReports] = useState<OMReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError("");
      const areaSuffix = accountKabupaten ? `&kabupaten=${encodeURIComponent(accountKabupaten)}` : "";
      const response = await fetch(`/api/om/reports?limit=200${areaSuffix}`, { cache: "no-store" });
      const payload = (await response.json()) as { reports?: OMReport[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal memuat laporan O&M.");
      setReports(Array.isArray(payload.reports) ? payload.reports : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat laporan O&M.");
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || isMobileRole) return;
    void loadReports();
  }, [isMobileRole, user, accountKabupaten]);

  const updateStatus = async (report: OMReport, status: "diproses" | "selesai" | "ditolak") => {
    try {
      setBusyId(report.id);
      const response = await fetch("/api/om/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: report.id,
          status,
          actorId: user?.uid || "",
          actorName: user?.displayName || user?.email || "Admin O&M",
          actorRole: user?.role || "admin",
          actorKabupaten: accountKabupaten,
          note: `Laporan ${statusLabels[status].toLowerCase()} oleh admin.`,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal mengubah status laporan.");
      await loadReports();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Gagal mengubah status laporan.");
    } finally {
      setBusyId(null);
    }
  };

  const counts = {
    total: reports.length,
    new: reports.filter((report) => report.status === "new").length,
    diproses: reports.filter((report) => report.status === "diproses").length,
    selesai: reports.filter((report) => report.status === "selesai").length,
  };

  return (
    <ProtectedRoute>
      {isMobileRole ? (
        <PreventiveOMReportsList mode="tasks" />
      ) : (
        <OMPageShell
          eyebrow="Monitoring Laporan"
          title="Daftar laporan O&M aktif untuk diproses admin."
          description="Pantau laporan masuk, ubah status tindak lanjut, dan lihat jejak status terakhir dari satu halaman."
          statusTitle="Flow status laporan sudah aktif."
          statusDescription="Status laporan berjalan dari new, diproses, selesai, atau ditolak agar admin dan petugas punya alur tindak lanjut yang jelas."
          metaCards={[
            { label: "Total", value: String(counts.total), hint: "Semua laporan", tone: "teal" },
            { label: "Baru", value: String(counts.new), hint: "Perlu ditinjau", tone: "cyan" },
            { label: "Diproses", value: String(counts.diproses), hint: "Sedang ditindaklanjuti", tone: "slate" },
            { label: "Selesai", value: String(counts.selesai), hint: "Sudah ditutup", tone: "emerald" },
          ]}
        >
          <div className="rounded-[28px] border border-teal-100 bg-white/95 p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">Daftar Laporan</div>
                <h2 className="mt-1 text-xl font-bold text-slate-950">Antrian tindak lanjut O&M</h2>
              </div>
              <button onClick={() => void loadReports()} disabled={loading} className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 disabled:opacity-60">
                {loading ? "Memuat..." : "Muat Ulang"}
              </button>
            </div>

            {error ? <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

            <div className="mt-5 space-y-3">
              {!loading && reports.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  Belum ada laporan O&M masuk.
                </div>
              ) : null}

              {reports.map((report) => (
                <div key={report.id} className="rounded-[24px] border border-slate-100 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusTone(report.status)}`}>
                          {statusLabels[report.status] || report.status || "Baru"}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {report.reportType || "preventif"}
                        </span>
                      </div>
                      <h3 className="mt-3 text-base font-bold text-slate-950">{report.title || "Laporan O&M"}</h3>
                      <div className="mt-1 text-sm leading-6 text-slate-600">{report.description || "-"}</div>
                      <div className="mt-2 text-xs text-slate-500">
                        {report.reporterName || "Petugas"} - {report.location || "-"}
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        <ReportDetailField label="ID Tiang" value={report.idTitik || report.location} />
                        <ReportDetailField label="Jenis" value={report.damageType || report.title} />
                        <ReportDetailField label="No. Telp" value={report.phoneNumber} />
                        {report.reportType === "korektif" || report.formVariant === "corrective" ? (
                          <>
                            <ReportDetailField label="Tindakan Perbaikan" value={report.repairAction} />
                            <ReportDetailField label="Foto Hasil" value={report.photoDamageName} />
                          </>
                        ) : (
                          <>
                            <ReportDetailField label="Kondisi Inspeksi" value={report.inspectionCondition} />
                            <ReportDetailField label="Foto Temuan" value={report.photoDamageName} />
                            <ReportDetailField label="Foto Tiang" value={report.photoPoleName} />
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {report.status === "new" ? (
                        <button onClick={() => void updateStatus(report, "diproses")} disabled={busyId === report.id} className="rounded-2xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
                          Proses
                        </button>
                      ) : null}
                      {report.status !== "selesai" && report.status !== "ditolak" ? (
                        <button onClick={() => void updateStatus(report, "selesai")} disabled={busyId === report.id} className="rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
                          Selesai
                        </button>
                      ) : null}
                      {report.status !== "selesai" && report.status !== "ditolak" ? (
                        <button onClick={() => void updateStatus(report, "ditolak")} disabled={busyId === report.id} className="rounded-2xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
                          Tolak
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {report.statusTimeline && report.statusTimeline.length > 0 ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Status Terakhir</div>
                      {report.statusTimeline.slice(-2).reverse().map((item, index) => (
                        <div key={`${report.id}-status-${index}`} className="mt-2 text-xs leading-5 text-slate-600">
                          <span className="font-semibold text-slate-900">{statusLabels[item.status] || item.status}</span> oleh {item.actorName || "-"}
                          {item.note ? <span> - {item.note}</span> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </OMPageShell>
      )}
    </ProtectedRoute>
  );
}
