"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ProtectedRoute from "@/components/ProtectedRoute";

type ZoneItem = {
  id?: string;
  idTitik?: string;
  grup?: string;
};

function FormUjiBetonContent() {
  const router = useRouter();
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [selectedIdTitik, setSelectedIdTitik] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("activeKontruksiTask");
    if (stored) {
      try {
        const task = JSON.parse(stored);
        setZones(task?.zones || []);
      } catch {
        setZones([]);
      }
    }
  }, []);

  const idOptions = useMemo(() => {
    return (zones || []).filter((z) => z.idTitik);
  }, [zones]);

  return (
    <div className="relative min-h-screen bg-white overflow-hidden">
      <div className="absolute left-4 top-20 h-20 w-1 bg-red-600" />
      <div className="absolute left-6 top-20 h-20 w-[3px] bg-red-500" />

      <div className="absolute -bottom-28 -left-28 h-80 w-80 rounded-full bg-red-600" />
      <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full border-[6px] border-red-500" />

      <div className="relative mx-auto w-full max-w-md px-5 pb-24 pt-5">
        <div className="text-[11px] uppercase tracking-wide text-gray-300">dashboard</div>

        <header className="mt-2 flex items-center justify-between">
          <button
            onClick={() => router.push("/kontruksi/daftar-kontruksi/penggalian")}
            className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center shadow-md"
            aria-label="Kembali"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <div className="text-base font-semibold text-gray-900">Uji Beton</div>
          </div>

          <div className="relative w-12 h-12">
            <Image src="/BDG1.png" alt="Logo" fill className="object-contain" />
          </div>
        </header>

        <div className="mt-6 rounded-2xl border border-gray-300 bg-white p-4 shadow-sm">
          <div className="text-center text-xs text-gray-700">Lengkapi data Dibawah</div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-900">Pilih Id Titik</label>
              <select
                value={selectedIdTitik}
                onChange={(e) => setSelectedIdTitik(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">Masukkan Id Titik</option>
                {idOptions.map((z, idx) => (
                  <option key={`${z.id || idx}`} value={z.idTitik}>
                    {z.idTitik} {z.grup ? `- ${z.grup}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-900">Foto Uji Kekuatan Beton</label>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs">
                <input type="text" placeholder="Masukkan Foto Uji Kekuatan Beton" className="w-full outline-none" />
                <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8h3l2-3h8l2 3h3v11H3z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-900">Foto Titik Lokasi</label>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs">
                <input type="text" placeholder="Masukkan Foto Titik Lokasi" className="w-full outline-none" />
                <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8h3l2-3h8l2 3h3v11H3z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <button className="w-24 rounded-full border border-gray-400 bg-sky-100 py-1 text-xs font-semibold text-gray-800 shadow-sm">
              Kirim
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FormUjiBetonPage() {
  return (
    <ProtectedRoute>
      <FormUjiBetonContent />
    </ProtectedRoute>
  );
}
