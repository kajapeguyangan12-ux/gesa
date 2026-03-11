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

type ActiveTask = {
  id: string;
  designUploadId?: string;
  zones?: ZoneItem[];
};

function DaftarTitikContent() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("Semua");
  const [activeTask, setActiveTask] = useState<ActiveTask | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("activeKontruksiTask");
    if (stored) {
      try {
        setActiveTask(JSON.parse(stored));
      } catch {
        setActiveTask(null);
      }
    }
  }, []);

  const zones = activeTask?.zones || [];

  const groups = useMemo(() => {
    const list = new Set<string>();
    zones.forEach((z) => {
      if (z.grup) list.add(z.grup);
    });
    return ["Semua", ...Array.from(list)];
  }, [zones]);

  const filteredZones = useMemo(() => {
    return zones.filter((z) => {
      const target = `${z.idTitik || ""} ${z.grup || ""}`.toLowerCase();
      const matchSearch = target.includes(search.toLowerCase().trim());
      const matchFilter = filter === "Semua" ? true : z.grup === filter;
      return matchSearch && matchFilter;
    });
  }, [zones, search, filter]);

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
            onClick={() => router.push("/kontruksi/daftar-tugas")}
            className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center shadow-md"
            aria-label="Kembali"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <div className="text-base font-semibold text-gray-900">Daftar Tugas</div>
          </div>

          <div className="relative w-12 h-12">
            <Image src="/BDG1.png" alt="Logo" fill className="object-contain" />
          </div>
        </header>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-xs"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs"
            >
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 text-center text-xs font-semibold text-gray-700">
          List Data Titik Kontruksi
        </div>

        <div className="mt-3 space-y-2">
          {filteredZones.length === 0 ? (
            <div className="rounded-2xl border border-gray-300 bg-white p-4 text-center text-xs text-gray-500 shadow-sm">
              Tidak ada data titik.
            </div>
          ) : (
            filteredZones.map((zone, idx) => (
              <button
                key={`${zone.id || idx}`}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-left shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] text-gray-500">Id Titik</div>
                    <div className="text-sm font-semibold text-gray-900 truncate">{zone.idTitik || "-"}</div>
                    <div className="text-[11px] text-gray-500">Grup</div>
                    <div className="text-xs text-gray-700 truncate">{zone.grup || "-"}</div>
                  </div>
                  <div className="w-7 h-7 rounded-full border border-gray-400 flex items-center justify-center text-gray-600">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function DaftarTitikPage() {
  return (
    <ProtectedRoute>
      <DaftarTitikContent />
    </ProtectedRoute>
  );
}
