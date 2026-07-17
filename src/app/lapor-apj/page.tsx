"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

type PointDetail = {
  idTitik: string;
  namaJalan: string;
  kabupaten: string;
  dayaLampu: string;
  latitude: number;
  longitude: number;
};

function LaporApjContent() {
  const router = useRouter();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const idTitik = searchParams.get("idTitik") || "";
  const scanValue = searchParams.get("scan") || idTitik;
  const [point, setPoint] = useState<PointDetail | null>(null);
  const [loadingPoint, setLoadingPoint] = useState(Boolean(idTitik));
  const [pointError, setPointError] = useState("");
  const [form, setForm] = useState({ reporterName: "", reporterEmail: "", phoneNumber: "", damageType: "", description: "", photoName: "" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role !== "masyarakat-umum" || !idTitik) return;
    const params = new URLSearchParams({ idTitik });
    if (scanValue) params.set("scan", scanValue);
    router.replace(`/masyarakat/laporan-kerusakan?${params.toString()}`);
  }, [idTitik, router, scanValue, user?.role]);

  useEffect(() => {
    if (!idTitik) {
      setLoadingPoint(false);
      setPointError("Link QR tidak memuat ID titik APJ.");
      return;
    }
    const loadPoint = async () => {
      setLoadingPoint(true);
      setPointError("");
      try {
        const response = await fetch(`/api/om/apj-point/${encodeURIComponent(idTitik)}`, { cache: "no-store" });
        const payload = (await response.json()) as { latest?: PointDetail; error?: string };
        if (!response.ok || !payload.latest) throw new Error(payload.error || "Titik APJ tidak ditemukan.");
        setPoint(payload.latest);
      } catch (loadError) {
        setPointError(loadError instanceof Error ? loadError.message : "Titik APJ tidak ditemukan.");
      } finally {
        setLoadingPoint(false);
      }
    };
    void loadPoint();
  }, [idTitik]);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/public/apj-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idTitik, ...form }),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal mengirim laporan.");
      setSuccess(`Laporan berhasil dikirim. Nomor laporan: ${payload.id}. Progres perbaikan akan dikirim ke email yang didaftarkan.`);
      setForm({ reporterName: "", reporterEmail: "", phoneNumber: "", damageType: "", description: "", photoName: "" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Gagal mengirim laporan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(239,68,68,0.18),_transparent_30%),linear-gradient(180deg,_#fff7f7_0%,_#f8fafc_100%)] px-4 py-6">
      <div className="mx-auto max-w-md overflow-hidden rounded-[32px] border border-red-100 bg-white shadow-[0_24px_70px_rgba(127,29,29,0.14)]">
        <div className="bg-gradient-to-r from-red-600 to-rose-600 p-5 text-white">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-red-100">Laporan Cepat APJ</div>
          <h1 className="mt-2 text-2xl font-black">Laporkan Kerusakan Lampu</h1>
          <p className="mt-1 text-sm text-red-50">Tidak perlu login. Data titik otomatis dari QR.</p>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Titik APJ</div>
            <div className="mt-1 text-xl font-black text-slate-950">{idTitik || "-"}</div>
            {loadingPoint ? <div className="mt-2 text-sm text-slate-500">Memuat data titik...</div> : null}
            {pointError ? <div className="mt-2 text-sm text-red-600">{pointError}</div> : null}
            {point ? (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div className="rounded-xl bg-white p-2">Jalan: <b>{point.namaJalan}</b></div>
                <div className="rounded-xl bg-white p-2">Daya: <b>{point.dayaLampu}</b></div>
                <div className="rounded-xl bg-white p-2">Area: <b>{point.kabupaten}</b></div>
                <div className="rounded-xl bg-white p-2">Status: <b>Terdaftar</b></div>
              </div>
            ) : null}
          </div>

          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Nama Pelapor</span>
              <input value={form.reporterName} onChange={(event) => update("reporterName", event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-red-400" placeholder="Masukkan nama" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">No. HP</span>
              <input required value={form.phoneNumber} onChange={(event) => update("phoneNumber", event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-red-400" placeholder="08xxxxxxxxxx" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Email Notifikasi Progres <span className="text-red-600">*</span></span>
              <input required type="email" value={form.reporterEmail} onChange={(event) => update("reporterEmail", event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-red-400" placeholder="nama@email.com" />
              <span className="mt-1 block text-[11px] leading-4 text-slate-500">Notifikasi progres penanganan dan perbaikan akan dikirim ke email ini.</span>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Jenis Kerusakan</span>
              <select value={form.damageType} onChange={(event) => update("damageType", event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-red-400">
                <option value="">Pilih jenis kerusakan</option>
                <option value="Lampu padam">Lampu padam</option>
                <option value="Lampu redup">Lampu redup</option>
                <option value="Lampu berkedip">Lampu berkedip</option>
                <option value="Tiang/kabel bermasalah">Tiang/kabel bermasalah</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Deskripsi</span>
              <textarea value={form.description} onChange={(event) => update("description", event.target.value)} rows={4} className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-red-400" placeholder="Jelaskan kondisi lampu" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Foto Kerusakan</span>
              <div className="mt-1 flex items-center rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-500">
                <span className="min-w-0 flex-1 truncate">{form.photoName || "Upload foto opsional"}</span>
                <span className="font-bold text-red-600">Pilih</span>
              </div>
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => update("photoName", event.target.files?.[0]?.name || "")} />
            </label>

            {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
            {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}

            <button type="submit" disabled={submitting || loadingPoint || Boolean(pointError)} className="w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-200 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? "Mengirim..." : "Kirim Laporan"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function LaporApjPage() {
  return (
    <Suspense fallback={<main className="p-6 text-sm text-slate-600">Memuat form laporan...</main>}>
      <LaporApjContent />
    </Suspense>
  );
}
