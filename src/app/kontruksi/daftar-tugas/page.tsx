"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

type DesignTask = {
  id: string;
  designUploadId?: string;
  assigneeId?: string;
  assigneeName?: string;
  zones?: Array<{ id?: string; idTitik?: string; grup?: string }>;
  status?: string;
  createdAt?: any;
  createdByName?: string;
};

const formatDate = (value: any) => {
  if (!value) return "-";
  try {
    const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "-";
  }
};

function DaftarTugasContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<DesignTask[]>([]);

  useEffect(() => {
    if (user?.uid) {
      loadTasks();
    }
  }, [user?.uid]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "design_tasks"),
        where("assigneeId", "==", user?.uid || ""),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      setTasks(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DesignTask)));
    } catch (e) {
      console.error("Failed to load kontruksi tasks:", e);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const taskCards = useMemo(() => {
    return tasks.map((task) => {
      const zones = task.zones || [];
      const groups = new Set(zones.map((z) => (z.grup || "").trim()).filter(Boolean));
      return {
        ...task,
        groupCount: groups.size,
        zoneCount: zones.length,
      };
    });
  }, [tasks]);

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
            onClick={() => router.push("/kontruksi")}
            className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center shadow-md"
            aria-label="Kembali"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <div className="text-base font-semibold text-gray-900">Daftar Tugas</div>
            <div className="text-[11px] text-gray-500 font-semibold">List Tugas Masuk</div>
          </div>

          <div className="relative w-12 h-12">
            <Image src="/BDG1.png" alt="Logo" fill className="object-contain" />
          </div>
        </header>

        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="text-sm text-gray-500">Memuat tugas...</div>
          ) : taskCards.length === 0 ? (
            <div className="rounded-2xl border border-gray-300 bg-white p-4 text-center text-xs text-gray-500 shadow-sm">
              Belum ada tugas masuk.
            </div>
          ) : (
            taskCards.map((task) => (
              <button
                key={task.id}
                onClick={() => {
                  localStorage.setItem("activeKontruksiTask", JSON.stringify(task));
                  router.push("/kontruksi/daftar-tugas/titik");
                }}
                className="w-full rounded-2xl border border-gray-300 bg-white px-3 py-3 text-left shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] text-gray-500">Judul Tugas</div>
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {task.designUploadId || "Tugas Kontruksi"}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-600">
                      Jumlah Grup: {task.groupCount} • Titik: {task.zoneCount}
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-500">{formatDate(task.createdAt)}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function DaftarTugasPage() {
  return (
    <ProtectedRoute>
      <DaftarTugasContent />
    </ProtectedRoute>
  );
}
