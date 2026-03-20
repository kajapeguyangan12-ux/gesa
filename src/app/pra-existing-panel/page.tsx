"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, Timestamp, where } from "firebase/firestore";

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

function PraExistingPanelContent() {
  const router = useRouter();
  const { user } = useAuth();

  const [stats, setStats] = useState<PanelStats>(initialStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.uid) {
        setStats(initialStats);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startOfToday = Timestamp.fromDate(today);

        const surveysRef = collection(db, "survey-pra-existing");
        const tasksRef = collection(db, "tasks");

        const [surveySnapshot, surveyTodaySnapshot, menungguValidasiSnapshot, tugasSnapshot, tugasSelesaiSnapshot] = await Promise.all([
          getDocs(query(surveysRef, where("surveyorUid", "==", user.uid))),
          getDocs(query(surveysRef, where("surveyorUid", "==", user.uid), where("createdAt", ">=", startOfToday))),
          getDocs(query(surveysRef, where("surveyorUid", "==", user.uid), where("status", "==", "menunggu"))),
          getDocs(query(tasksRef, where("surveyorId", "==", user.uid), where("type", "==", "pra-existing"))),
          getDocs(query(tasksRef, where("surveyorId", "==", user.uid), where("type", "==", "pra-existing"), where("status", "==", "completed"))),
        ]);

        setStats({
          totalSurvey: surveySnapshot.size,
          surveyHariIni: surveyTodaySnapshot.size,
          menungguValidasi: menungguValidasiSnapshot.size,
          totalTugas: tugasSnapshot.size,
          tugasSelesai: tugasSelesaiSnapshot.size,
        });
      } catch (error) {
        console.error("Error fetching pra-existing dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user?.uid]);

  const StatCard = ({
    icon,
    label,
    value,
    color,
  }: {
    icon: string;
    label: string;
    value: number;
    color: keyof typeof cardColorMap;
  }) => (
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

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white p-4 shadow-sm">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Dashboard Pra Existing</h1>
          <p className="text-sm text-gray-600">
            Selamat Pagi, <span className="font-semibold">{user?.displayName || user?.email}</span>
          </p>
        </div>
      </header>
      <main className="container mx-auto flex-grow px-4 py-8 sm:px-6 lg:px-8">
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
            <StatCard icon="SV" label="Survey Hari Ini" value={stats.surveyHariIni} color="blue" />
            <StatCard icon="OK" label="Tugas Selesai" value={stats.tugasSelesai} color="green" />
            <StatCard icon="PD" label="Menunggu Validasi" value={stats.menungguValidasi} color="yellow" />
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
