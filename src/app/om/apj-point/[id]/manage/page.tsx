"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";

type ApjPoint = {
  idTitik: string;
  namaTitik?: string;
  namaJalan: string;
  kabupaten: string;
  dayaLampu: string;
  group?: string;
  latitude: number;
  longitude: number;
  createdAt?: string;
  rawPayload?: Record<string, unknown>;
};

function qrImageUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(value)}`;
}

function ManageApjPoint({ idTitik }: { idTitik: string }) {
  const router = useRouter();
  const [point, setPoint] = useState<ApjPoint | null>(null);
  const [form, setForm] = useState({ namaTitik: "", namaJalan: "", kabupaten: "", dayaLampu: "", group: "", latitude: "", longitude: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isOmTestData = Boolean(point?.rawPayload?.isOmTestData || point?.rawPayload?.isTestData || point?.rawPayload?.source === "om_manual_test");

  const reportUrl = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    return `${origin}/lapor-apj?idTitik=${encodeURIComponent(idTitik)}`;
  }, [idTitik]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/om/apj-point/${encodeURIComponent(idTitik)}`, { cache: "no-store" });
      const payload = (await response.json()) as { latest?: ApjPoint; error?: string };
      if (!response.ok || !payload.latest) throw new Error(payload.error || "Data APJ tidak ditemukan.");
      const next = payload.latest;
      setPoint(next);
      setForm({
        namaTitik: next.namaTitik || next.idTitik || idTitik,
        namaJalan: next.namaJalan || "",
        kabupaten: next.kabupaten || "",
        dayaLampu: next.dayaLampu || "",
        group: next.group || String(next.rawPayload?.grup || next.rawPayload?.group || ""),
        latitude: Number.isFinite(next.latitude) ? String(next.latitude) : "",
        longitude: Number.isFinite(next.longitude) ? String(next.longitude) : "",
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Data APJ tidak ditemukan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idTitik]);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/om/apj-point/${encodeURIComponent(idTitik)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal menyimpan data APJ.");
      setMessage(payload.message || "Data APJ berhasil disimpan.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan data APJ.");
    } finally {
      setSaving(false);
    }
  };

  const deleteTestPoint = async () => {
    if (!isOmTestData) {
      setError("Data konstruksi asli tidak boleh dihapus dari fitur test O&M.");
      return;
    }
    const confirmed = window.confirm(`Hapus data test APJ ${idTitik}? Data konstruksi asli tidak akan terpengaruh.`);
    if (!confirmed) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/om/apj-point/${encodeURIComponent(idTitik)}`, { method: "DELETE" });
      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal menghapus data APJ.");
      router.push("/om/maps");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Gagal menghapus data APJ.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.16),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#eefcf8_100%)] px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/om/maps" className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">‹</Link>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Admin Data APJ</div>
              <h1 className="text-2xl font-black text-slate-950">Kelola Detail Titik APJ</h1>
              <p className="text-sm text-slate-600">Admin O&M mengelola detail APJ dan QR dari halaman ini.</p>
            </div>
          </div>
          <Link href={`/om/apj-point/${encodeURIComponent(idTitik)}/qr`} className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            Generate QR
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm">
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">ID Titik</div>
              <div className="mt-1 text-3xl font-black text-slate-950">{idTitik}</div>
              {isOmTestData ? (
                <div className="mt-2 inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">Data test O&M</div>
              ) : null}
            </div>
            {loading ? <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Memuat data APJ...</div> : null}
            {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
            {point ? (
              <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
                {[
                  ["Nama Titik", "namaTitik"],
                  ["Nama Jalan", "namaJalan"],
                  ["Kabupaten", "kabupaten"],
                  ["Daya Lampu", "dayaLampu"],
                  ["Grup/Zona", "group"],
                  ["Latitude", "latitude"],
                  ["Longitude", "longitude"],
                ].map(([label, key]) => (
                  <label key={key} className="block">
                    <span className="text-sm font-semibold text-slate-700">{label}</span>
                    <input
                      value={form[key as keyof typeof form]}
                      onChange={(event) => update(key as keyof typeof form, event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-400"
                    />
                  </label>
                ))}
                <div className="md:col-span-2">
                  {message ? <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
                  <button type="submit" disabled={saving} className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
                    {saving ? "Menyimpan..." : "Simpan Detail APJ"}
                  </button>
                  {isOmTestData ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void deleteTestPoint()}
                      className="ml-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 disabled:opacity-60"
                    >
                      Hapus Data Test
                    </button>
                  ) : null}
                </div>
              </form>
            ) : null}
          </section>

          <aside className="space-y-4">
            <div className="rounded-[28px] border border-red-100 bg-white/95 p-5 text-center shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600">QR Masyarakat</div>
              <img src={qrImageUrl(reportUrl)} alt={`QR ${idTitik}`} className="mx-auto mt-4 h-56 w-56 rounded-2xl border border-slate-200 bg-white p-3" />
              <div className="mt-3 break-all rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{reportUrl}</div>
              <Link href={`/lapor-apj?idTitik=${encodeURIComponent(idTitik)}`} className="mt-3 block rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white">
                Lihat Tampilan Masyarakat
              </Link>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm">
              <div className="text-sm font-black text-slate-950">Aturan Flow</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Admin mengelola data APJ di sini. QR hanya membuka halaman masyarakat untuk melihat ringkas data titik dan mengirim laporan.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function ManageApjPointPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProtectedRoute>
      <ManageApjPoint idTitik={decodeURIComponent(id)} />
    </ProtectedRoute>
  );
}
