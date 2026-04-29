"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const MapsKontruksiValidMap = dynamic(
  () => import("./MapsKontruksiValidMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex flex-col items-center justify-center bg-gray-50">
        <div className="w-16 h-16 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600">Menyiapkan peta...</p>
      </div>
    ),
  }
);

type KontruksiStatus = "belum-dimulai" | "berjalan" | "selesai" | "terkendala";

interface KontruksiPoint {
  id: string;
  title: string;
  type: "existing" | "propose";
  latitude: number;
  longitude: number;
  zona: string;
  idTitik: string;
  statusKontruksi: KontruksiStatus;
  updatedAt: any;
}

const statusLabels: Record<KontruksiStatus, string> = {
  "belum-dimulai": "Belum Dimulai",
  "berjalan": "Sedang Berjalan",
  "selesai": "Selesai",
  "terkendala": "Terkendala",
};

export default function MapsKontruksiValid() {
  const [points, setPoints] = useState<KontruksiPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    belum: 0,
    berjalan: 0,
    selesai: 0,
    terkendala: 0,
  });

  useEffect(() => {
    fetchPoints();
  }, []);

  const normalizeStatus = (value: any): KontruksiStatus => {
    const raw = String(value || "").toLowerCase();
    if (raw.includes("selesai") || raw.includes("done")) return "selesai";
    if (raw.includes("jalan") || raw.includes("progress")) return "berjalan";
    if (raw.includes("kendala") || raw.includes("blokir")) return "terkendala";
    return "belum-dimulai";
  };

  const fetchPoints = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/kontruksi?resource=valid&limit=1000", { cache: "no-store" });
      const payload = (await response.json()) as { items?: any[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal memuat titik kontruksi valid.");

      const all = (Array.isArray(payload.items) ? payload.items : []).map((data) => {
        return {
          id: data.id,
          title: data.namaTitik || "Titik Kontruksi",
          type: data.type || "existing",
          latitude: data.latitude || 0,
          longitude: data.longitude || 0,
          zona: data.zona || "N/A",
          idTitik: data.idTitik || "N/A",
          statusKontruksi: normalizeStatus(data.kontruksiStatus),
          updatedAt: data.updatedAt || data.validatedAt,
        } as KontruksiPoint;
      });
      setPoints(all);
      setStats({
        total: all.length,
        belum: all.filter((p) => p.statusKontruksi === "belum-dimulai").length,
        berjalan: all.filter((p) => p.statusKontruksi === "berjalan").length,
        selesai: all.filter((p) => p.statusKontruksi === "selesai").length,
        terkendala: all.filter((p) => p.statusKontruksi === "terkendala").length,
      });
    } catch (error) {
      console.error("Error fetching kontruksi points:", error);
      setPoints([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Maps Data Valid Kontruksi</h1>
              <p className="text-sm text-gray-600 mt-1">
                Peta titik yang sudah valid, dengan warna status progres kontruksi.
              </p>
            </div>
          </div>
          <button
            onClick={fetchPoints}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Muat Ulang
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-md border border-gray-200">
          <p className="text-xs text-gray-600 font-medium">Total Titik</p>
          <h3 className="text-3xl font-bold text-gray-900">{stats.total}</h3>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-md border border-gray-200">
          <p className="text-xs text-gray-600 font-medium">{statusLabels["belum-dimulai"]}</p>
          <h3 className="text-3xl font-bold text-gray-900">{stats.belum}</h3>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-md border border-gray-200">
          <p className="text-xs text-gray-600 font-medium">{statusLabels["berjalan"]}</p>
          <h3 className="text-3xl font-bold text-gray-900">{stats.berjalan}</h3>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-md border border-gray-200">
          <p className="text-xs text-gray-600 font-medium">{statusLabels["selesai"]}</p>
          <h3 className="text-3xl font-bold text-gray-900">{stats.selesai}</h3>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-md border border-gray-200">
          <p className="text-xs text-gray-600 font-medium">{statusLabels["terkendala"]}</p>
          <h3 className="text-3xl font-bold text-gray-900">{stats.terkendala}</h3>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="h-[520px] relative">
          {loading ? (
            <div className="h-full flex items-center justify-center bg-gray-50">
              <div className="w-16 h-16 border-4 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            <MapsKontruksiValidMap points={points} statusLabels={statusLabels} />
          )}
          {!loading && points.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none">
              <div className="bg-white/90 border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                <div className="text-sm font-semibold text-gray-600">Belum ada titik kontruksi</div>
                <div className="text-xs text-gray-500 mt-1">
                  Titik akan muncul setelah data kontruksi divalidasi dan memiliki koordinat.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
