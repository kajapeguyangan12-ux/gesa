"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";

const MapsKontruksiValidMap = dynamic(
  () => import("@/app/admin/kontruksi/components/MapsKontruksiValidMap"),
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

type KontruksiPoint = {
  id: string;
  title: string;
  type: "existing" | "propose";
  latitude: number;
  longitude: number;
  zona: string;
  idTitik: string;
  statusKontruksi: KontruksiStatus;
  updatedAt: any;
  source: "valid" | "submission";
};

const statusLabels: Record<KontruksiStatus, string> = {
  "belum-dimulai": "Belum Dimulai",
  "berjalan": "Sedang Berjalan",
  "selesai": "Selesai",
  "terkendala": "Terkendala",
};

function normalizeStatus(value: any): KontruksiStatus {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("selesai") || raw.includes("done") || raw.includes("valid")) return "selesai";
  if (raw.includes("jalan") || raw.includes("progress") || raw.includes("ongoing")) return "berjalan";
  if (raw.includes("kendala") || raw.includes("blokir") || raw.includes("problem")) return "terkendala";
  return "belum-dimulai";
}

function parseNumber(value: any) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getOwnerId(item: any) {
  return (
    item.submittedById ||
    item.createdById ||
    item.petugasId ||
    item.userId ||
    item.assigneeId ||
    item.kontruksiPetugasId ||
    ""
  );
}

export default function KontruksiMapsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [points, setPoints] = useState<KontruksiPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.uid) return;
    let mounted = true;

    const loadPoints = async () => {
      setLoading(true);
      setError("");
      try {
        const submissionsQuery = query(
          collection(db, "kontruksi-submissions"),
          orderBy("createdAt", "desc"),
          limit(100)
        );
        const validQuery = query(
          collection(db, "kontruksi-valid"),
          orderBy("validatedAt", "desc"),
          limit(100)
        );

        const [subSnap, validSnap] = await Promise.all([getDocs(submissionsQuery), getDocs(validQuery)]);

        const submissionPoints: KontruksiPoint[] = subSnap.docs
          .map((doc) => ({ id: doc.id, ...(doc.data() as any) }) as any)
          .filter((item) => getOwnerId(item) === user.uid)
          .map((data) => ({
            id: data.id,
            title: data.namaTitik || data.idTitik || "Titik Kontruksi",
            type: (data.type === "propose" ? "propose" : "existing") as "existing" | "propose",
            latitude: parseNumber(data.latitude) || parseNumber(data.lat) || 0,
            longitude: parseNumber(data.longitude) || parseNumber(data.lng) || parseNumber(data.lon) || 0,
            zona: data.zona || data.group || "N/A",
            idTitik: data.idTitik || data.namaTitik || "N/A",
            statusKontruksi: normalizeStatus(data.kontruksiStatus || data.status || data.stage),
            updatedAt: data.updatedAt || data.createdAt,
            source: "submission",
          } as KontruksiPoint))
          .filter((point) => point.latitude !== 0 && point.longitude !== 0);

        const validPoints: KontruksiPoint[] = validSnap.docs
          .map((doc) => ({ id: doc.id, ...(doc.data() as any) }) as any)
          .filter((item) => getOwnerId(item) === user.uid)
          .map((data) => ({
            id: data.id,
            title: data.namaTitik || data.idTitik || "Titik Kontruksi",
            type: (data.type === "propose" ? "propose" : "existing") as "existing" | "propose",
            latitude: parseNumber(data.latitude) || parseNumber(data.lat) || 0,
            longitude: parseNumber(data.longitude) || parseNumber(data.lng) || parseNumber(data.lon) || 0,
            zona: data.zona || data.group || "N/A",
            idTitik: data.idTitik || data.namaTitik || "N/A",
            statusKontruksi: normalizeStatus(data.kontruksiStatus || data.status || data.stage),
            updatedAt: data.updatedAt || data.validatedAt || data.createdAt,
            source: "valid",
          } as KontruksiPoint))
          .filter((point) => point.latitude !== 0 && point.longitude !== 0);

        const allPoints: KontruksiPoint[] = [...submissionPoints, ...validPoints];

        if (mounted) {
          setPoints(allPoints);
        }
      } catch (err) {
        console.error("Failed to load kontruksi map data:", err);
        if (mounted) {
          setError("Gagal memuat data peta. Silakan refresh.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadPoints();
    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  const stats = useMemo(() => {
    return {
      total: points.length,
      belum: points.filter((p) => p.statusKontruksi === "belum-dimulai").length,
      berjalan: points.filter((p) => p.statusKontruksi === "berjalan").length,
      selesai: points.filter((p) => p.statusKontruksi === "selesai").length,
      terkendala: points.filter((p) => p.statusKontruksi === "terkendala").length,
    };
  }, [points]);

  const formatDate = (value: any) => {
    if (!value) return "-";
    try {
      const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
      if (Number.isNaN(date.getTime())) return "-";
      return date.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "-";
    }
  };

  return (
    <ProtectedRoute>
      <div className="relative min-h-screen bg-white overflow-hidden">
        <div className="absolute left-4 top-20 h-20 w-1 bg-red-600" />
        <div className="absolute left-6 top-20 h-20 w-[3px] bg-red-500" />

        <div className="absolute -bottom-28 -left-28 h-80 w-80 rounded-full bg-red-600" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full border-[6px] border-red-500" />

        <div className="relative mx-auto w-full max-w-5xl px-4 pb-24 pt-5">
          <div className="text-[11px] uppercase tracking-wide text-gray-300">kontruksi</div>

          <header className="mt-2 flex items-center justify-between gap-4">
            <button
              onClick={() => router.push("/kontruksi")}
              className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center shadow-md"
              aria-label="Kembali"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex-1 text-center">
              <div className="text-base font-semibold text-gray-900">Maps Hasil Kontruksi</div>
              <div className="text-xs text-gray-500">Menampilkan titik kontruksi yang dikerjakan oleh Anda.</div>
            </div>

            <div className="relative w-12 h-12">
              <Image src="/BDG1.png" alt="Logo" fill className="object-contain" />
            </div>
          </header>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden min-h-[520px]">
              <div className="h-[520px] relative">
                {loading ? (
                  <div className="h-full flex items-center justify-center bg-gray-50">
                    <div className="w-16 h-16 border-4 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <>
                    <MapsKontruksiValidMap points={points} statusLabels={statusLabels} />
                    {points.length === 0 && !error && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 text-center px-8">
                        <p className="text-lg font-semibold text-gray-700">Belum ada titik kontruksi</p>
                        <p className="mt-2 text-sm text-gray-500">Titik akan tampil di peta setelah data kontruksi terkirim.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="text-xs text-gray-500">Total Titik</div>
                  <div className="mt-2 text-3xl font-bold text-gray-900">{stats.total}</div>
                </div>
                <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="text-xs text-gray-500">Sedang Berjalan</div>
                  <div className="mt-2 text-3xl font-bold text-amber-600">{stats.berjalan}</div>
                </div>
                <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="text-xs text-gray-500">Selesai</div>
                  <div className="mt-2 text-3xl font-bold text-emerald-600">{stats.selesai}</div>
                </div>
                <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="text-xs text-gray-500">Terkendala</div>
                  <div className="mt-2 text-3xl font-bold text-red-600">{stats.terkendala}</div>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Detail Data</div>
                    <div className="text-xs text-gray-500">{points.length} titik terdeteksi</div>
                  </div>
                </div>

                {loading ? (
                  <div className="text-sm text-gray-500">Memuat data...</div>
                ) : error ? (
                  <div className="text-sm text-red-600">{error}</div>
                ) : points.length === 0 ? (
                  <div className="text-sm text-gray-500">Tidak ada titik kontruksi yang dapat ditampilkan.</div>
                ) : (
                  <div className="space-y-3">
                    {points.slice(0, 8).map((point) => (
                      <div key={point.id} className="rounded-3xl border border-gray-200 bg-gray-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{point.title}</div>
                            <div className="text-xs text-gray-500">{point.idTitik}</div>
                          </div>
                          <span className="text-xs font-semibold uppercase text-gray-500">{point.source}</span>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-gray-600">
                          <div>ZONA: {point.zona}</div>
                          <div>STATUS: {statusLabels[point.statusKontruksi]}</div>
                          <div>UPDATE: {formatDate(point.updatedAt)}</div>
                        </div>
                      </div>
                    ))}
                    {points.length > 8 && (
                      <div className="text-xs text-gray-500">Menampilkan 8 data terbaru.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
