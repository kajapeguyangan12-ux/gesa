"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { formatWitaDateTime } from "@/utils/dateTime";

interface PanelStats {
  totalSurvey: number;
  totalTugas: number;
  surveyHariIni: number;
  tugasSelesai: number;
  menungguValidasi: number;
}

const initialStats: PanelStats = {
  totalSurvey: 0,
  totalTugas: 0,
  surveyHariIni: 0,
  tugasSelesai: 0,
  menungguValidasi: 0,
};

const cardColorMap = {
  blue: {
    wrapper: "bg-blue-100 text-blue-600",
  },
  green: {
    wrapper: "bg-green-100 text-green-600",
  },
  yellow: {
    wrapper: "bg-yellow-100 text-yellow-600",
  },
} as const;

function StatCard({
  icon,
  label,
  value,
  color,
  loading,
}: {
  icon: string;
  label: string;
  value: number;
  color: keyof typeof cardColorMap;
  loading: boolean;
}) {
  return (
    <div className="flex items-center rounded-xl border border-gray-200 bg-white p-4">
      <div className={`mr-4 flex h-12 w-12 items-center justify-center rounded-lg ${cardColorMap[color].wrapper}`}>
        <p className="text-2xl">{icon}</p>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        {loading ? <div className="mt-1 h-8 w-8 animate-pulse rounded-md bg-gray-200"></div> : <p className="text-2xl font-bold text-gray-800">{value}</p>}
      </div>
    </div>
  );
}

function PraExistingPanelContent() {
  const router = useRouter();
  const { user } = useAuth();

  const [stats, setStats] = useState<PanelStats>(initialStats);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"supabase" | "firestore">("firestore");
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");

  const handleBack = () => {
    router.push("/module-selection");
  };

  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    let isCancelled = false;

    const loadStats = async () => {
      try {
        setLoading(true);

        const [tasksResponse, surveysResponse] = await Promise.all([
          fetch(`/api/tasks?surveyorId=${encodeURIComponent(user.uid)}&surveyorEmail=${encodeURIComponent(user.email || "")}`, {
            cache: "no-store",
          }),
          fetch(`/api/pra-existing/submitted-surveys?surveyorUid=${encodeURIComponent(user.uid)}`, {
            cache: "no-store",
          }),
        ]);

        const tasksPayload = await tasksResponse.json().catch(() => ({}));
        const surveysPayload = await surveysResponse.json().catch(() => ({}));

        if (!tasksResponse.ok) {
          throw new Error(tasksPayload?.error || "Gagal memuat tugas pra-existing.");
        }

        if (!surveysResponse.ok) {
          throw new Error(surveysPayload?.error || "Gagal memuat survey pra-existing.");
        }

        const latestTasks = Array.isArray(tasksPayload.tasks) ? tasksPayload.tasks : [];
        const latestSurveys = Array.isArray(surveysPayload.surveys) ? surveysPayload.surveys : [];
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const praExistingTasks = latestTasks.filter((task: Record<string, unknown>) => task.type === "pra-existing");
        const surveyHariIni = latestSurveys.filter((survey: Record<string, unknown>) => {
          const rawCreatedAt = survey.createdAt;
          const createdAt = typeof rawCreatedAt === "string" || typeof rawCreatedAt === "number" ? new Date(rawCreatedAt) : null;
          return createdAt instanceof Date && !Number.isNaN(createdAt.getTime()) && createdAt >= startOfToday;
        }).length;
        const menungguValidasi = latestSurveys.filter((survey: Record<string, unknown>) => survey.status === "menunggu").length;
        const tugasSelesai = praExistingTasks.filter((task: Record<string, unknown>) => task.status === "completed").length;

        if (isCancelled) return;

        setStats({
          totalSurvey: latestSurveys.length,
          surveyHariIni,
          menungguValidasi,
          totalTugas: praExistingTasks.length,
          tugasSelesai,
        });
        setDataSource("supabase");
        setLastUpdatedAt(new Date().toISOString());
      } catch (error) {
        console.error("Error loading pra-existing panel stats:", error);
        if (isCancelled) return;
        setStats(initialStats);
        setDataSource("firestore");
        setLastUpdatedAt("");
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void loadStats();

    return () => {
      isCancelled = true;
    };
  }, [user?.uid, user?.email]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white p-4 shadow-sm">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Kembali"
              className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Kembali</span>
            </button>
            <h1 className="text-xl font-bold text-gray-800">Dashboard Pra Existing</h1>
          </div>
          <p className="text-sm text-gray-600">
            Selamat Pagi, <span className="font-semibold">{user?.displayName || user?.email}</span>
          </p>
        </div>
      </header>
      <main className="container mx-auto flex-grow px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Sumber Data Aktif</div>
            <div className="mt-1 text-base font-bold text-emerald-900">{dataSource === "supabase" ? "Supabase" : "Firestore"}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">Update Terakhir</div>
            <div className="mt-1 text-base font-bold text-slate-900">
              {lastUpdatedAt ? formatWitaDateTime(lastUpdatedAt) || "Belum ada" : "Belum ada"}
            </div>
          </div>
        </div>
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div onClick={() => router.push("/pra-existing-surveys")} className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm transition-shadow hover:shadow-lg">
            <div className="mb-3 inline-flex rounded-xl bg-blue-100 px-3 py-2 text-sm font-bold text-blue-700">SRV</div>
            <h3 className="text-lg font-semibold text-gray-800">Daftar Survey</h3>
            <p className="mt-2 text-sm text-gray-600">Buat survey pra-existing baru</p>
          </div>
          <div onClick={() => router.push("/tugas-survey-pra-existing")} className="relative cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm transition-shadow hover:shadow-lg">
            <div className="mb-3 inline-flex rounded-xl bg-indigo-100 px-3 py-2 text-sm font-bold text-indigo-700">TSK</div>
            <h3 className="text-lg font-semibold text-gray-800">Daftar Tugas</h3>
            {!loading && stats.totalTugas > 0 && (
              <span className="absolute right-4 top-4 rounded-full bg-red-500 px-2 py-1 text-xs font-bold text-white">
                {stats.totalTugas}
              </span>
            )}
            <p className="mt-2 text-sm text-gray-600">Lihat tugas pra-existing dari admin</p>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="mb-4 text-xl font-bold text-gray-800">Ringkasan Hari Ini</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <StatCard icon="SV" label="Survey Hari Ini" value={stats.surveyHariIni} color="blue" loading={loading} />
            <StatCard icon="OK" label="Tugas Selesai" value={stats.tugasSelesai} color="green" loading={loading} />
            <StatCard icon="PD" label="Menunggu Validasi" value={stats.menungguValidasi} color="yellow" loading={loading} />
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-xl font-bold text-gray-800">Statistik Keseluruhan</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex items-center rounded-xl border border-gray-200 bg-white p-4">
              <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                <p className="text-sm font-bold">ALL</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total Survey</p>
                {loading ? <div className="mt-1 h-8 w-8 animate-pulse rounded-md bg-gray-200"></div> : <p className="text-2xl font-bold text-gray-800">{stats.totalSurvey}</p>}
              </div>
            </div>
            <div className="flex items-center rounded-xl border border-gray-200 bg-white p-4">
              <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                <p className="text-sm font-bold">JOB</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total Tugas</p>
                {loading ? <div className="mt-1 h-8 w-8 animate-pulse rounded-md bg-gray-200"></div> : <p className="text-2xl font-bold text-gray-800">{stats.totalTugas}</p>}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function PraExistingPanelPage() {
  return (
    <ProtectedRoute>
      <PraExistingPanelContent />
    </ProtectedRoute>
  );
}
