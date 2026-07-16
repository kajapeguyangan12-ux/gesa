"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { OMPageShell } from "@/components/om/OMPageShell";
import { isMobileOmRole, PreventiveOMReportForm } from "@/components/om/PreventiveOMMobile";

export default function OMLaporanTugasPage() {
  const { user } = useAuth();
  const isMobileRole = isMobileOmRole(user?.role);
  const [reportType, setReportType] = useState("preventif");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isMobileRole) {
      setReportType("preventif");
    }
  }, [isMobileRole]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!title.trim() || !description.trim()) {
      setError("Judul dan deskripsi laporan wajib diisi.");
      return;
    }

    if (!user?.uid) {
      setError("Anda harus login untuk mengirim laporan.");
      return;
    }

    setLoading(true);

    try {
      const reportData = {
        title: title.trim(),
        description: description.trim(),
        reportType,
        location: location.trim() || "-",
        reporterUid: user.uid,
        reporterName: user.displayName || user.email || "Petugas O&M",
        reporterRole: user.role || "petugas-om-preventif",
      };

      const response = await fetch("/api/om/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportData),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Gagal mengirim laporan O&M.");
      }

      setTitle("");
      setDescription("");
      setLocation("");
      setSuccess("Laporan O&M berhasil dikirim. Admin dan Super Admin sudah diberitahu.");
    } catch (submitError) {
      console.error(submitError);
      setError("Gagal mengirim laporan. Coba lagi beberapa saat.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      {isMobileRole ? (
        <PreventiveOMReportForm />
      ) : (
      <OMPageShell
        eyebrow="Pelaporan Tugas"
        title="Input laporan O&M dalam workspace yang lebih bersih dan siap dipakai harian."
        description="Kirim laporan preventif atau korektif dengan format yang lebih rapi, sehingga admin bisa menerima informasi inti lebih cepat dan lebih konsisten."
        statusTitle="Pelaporan dibuat lebih fokus ke aksi utama."
        statusDescription="Form ini sudah disusun mengikuti bahasa visual O&M baru, dengan hirarki yang lebih jelas antara konteks pekerjaan, input utama, dan status pengiriman."
        metaCards={[
          { label: "Fungsi", value: "Submit", hint: "Kirim laporan pekerjaan lapangan", tone: "teal" },
          { label: "Mode", value: "Input", hint: "Aksi utama untuk petugas atau admin", tone: "cyan" },
          { label: "Tujuan", value: "Admin", hint: "Masuk ke admin dan super admin", tone: "slate" },
          { label: "Status", value: "Live", hint: "Form aktif dan siap digunakan", tone: "emerald" },
        ]}
      >
        <div className="rounded-[28px] border border-white/70 bg-white/92 shadow-[0_18px_40px_-26px_rgba(15,23,42,0.38)]">
          <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.3fr)_320px] xl:p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {isMobileRole ? (
                  <div className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">Tipe Laporan</span>
                    <div className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm">
                      Preventif
                    </div>
                  </div>
                ) : (
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">Tipe Laporan</span>
                    <select
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                    >
                      <option value="preventif">Preventif</option>
                      <option value="korektif">Korektif</option>
                    </select>
                  </label>
                )}

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">Lokasi</span>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Contoh: Jalan Mawar, Denpasar"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Judul Laporan</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Masukkan judul laporan"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Deskripsi</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Jelaskan masalah atau pekerjaan yang harus dilakukan"
                  rows={7}
                  className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                />
              </label>

              {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
              {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs leading-5 text-slate-500">
                  Laporan yang dikirim akan otomatis diteruskan ke admin dan super admin untuk tindak lanjut.
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-teal-600 via-cyan-600 to-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-200/70 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Mengirim..." : "Kirim Laporan"}
                </button>
              </div>
            </form>

            <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-teal-50 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Panduan Singkat</div>
              <h3 className="mt-3 text-xl font-bold text-slate-950">Buat laporan singkat, jelas, dan bisa ditindaklanjuti.</h3>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-teal-100 bg-white/90 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-teal-700">01</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">Pilih tipe laporan yang sesuai dengan pekerjaan.</div>
                </div>
                <div className="rounded-2xl border border-cyan-100 bg-white/90 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-cyan-700">02</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">Tulis judul yang langsung menjelaskan masalah atau kegiatan.</div>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-white/90 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-emerald-700">03</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">Isi deskripsi dengan kondisi lapangan dan tindakan yang dibutuhkan.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </OMPageShell>
      )}
    </ProtectedRoute>
  );
}
