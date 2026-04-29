"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";

export default function OMLaporanTugasPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [reportType, setReportType] = useState("preventif");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

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
        reporterRole: user.role || "petugas-om",
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
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-100"
          >
            ← Kembali
          </button>
          <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Laporan Tugas O&M</h1>
                <p className="mt-2 text-sm text-gray-500">
                  Kirim laporan preventif atau korektif. Semua laporan akan masuk ke Admin dan Super Admin.
                </p>
              </div>
              <div className="relative h-16 w-16">
                <Image src="/BDG1.png" alt="Logo" fill className="object-contain" />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Tipe Laporan</span>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-red-500 focus:outline-none"
                  >
                    <option value="preventif">Preventif</option>
                    <option value="korektif">Korektif</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-700">Lokasi (opsional)</span>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Contoh: Jalan Mawar, Denpasar"
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-red-500 focus:outline-none"
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Judul Laporan</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Masukkan judul laporan"
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-red-500 focus:outline-none"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Deskripsi</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Jelaskan masalah atau pekerjaan yang harus dilakukan"
                  rows={5}
                  className="w-full rounded-3xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-red-500 focus:outline-none"
                />
              </label>

              {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-gray-500">
                  Laporan Anda akan otomatis diberitahu ke Admin dan Super Admin.
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-3xl bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                >
                  {loading ? "Mengirim..." : "Kirim Laporan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
