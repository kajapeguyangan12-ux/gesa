"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { collection, doc, getDocs, orderBy, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

const RemoteKMZMapPreview = dynamic(() => import("@/components/RemoteKMZMapPreview"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[340px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-100">
      <div className="text-center">
        <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
        <p className="text-sm text-slate-500">Memuat preview peta...</p>
      </div>
    </div>
  ),
});

type DateValue = { toDate?: () => Date } | Date | string | number | null | undefined;

interface Task {
  id: string;
  title: string;
  description: string;
  surveyorId: string;
  surveyorName: string;
  surveyorEmail: string;
  status: string;
  type: string;
  kmzFileUrl?: string;
  kmzFileUrl2?: string;
  createdAt?: DateValue;
  startedAt?: DateValue;
}

function TugasSurveyPraExistingContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const tasksRef = collection(db, "tasks");
      const q = query(
        tasksRef,
        where("surveyorId", "==", user?.uid),
        where("type", "==", "pra-existing"),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const tasksData = snapshot.docs.map((entry) => ({
        id: entry.id,
        ...(entry.data() as Omit<Task, "id">),
      }));
      setTasks(tasksData);
    } catch (error) {
      console.error("Error fetching pra existing tasks:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user, fetchTasks]);

  const handleStartTask = async (task: Task | null) => {
    if (!task) return;

    try {
      if (task.status === "pending") {
        const taskRef = doc(db, "tasks", task.id);
        await updateDoc(taskRef, {
          status: "in-progress",
          startedAt: new Date(),
        });
      }

      localStorage.setItem(
        "activeTask",
        JSON.stringify({
          id: task.id,
          title: task.title,
          description: task.description,
          type: task.type,
          status: task.status === "pending" ? "in-progress" : task.status,
          kmzFileUrl: task.kmzFileUrl,
          kmzFileUrl2: task.kmzFileUrl2,
        })
      );
      router.push("/survey-pra-existing");
    } catch (error) {
      console.error("Error starting task:", error);
      alert("Gagal memulai tugas. Silakan coba lagi.");
    }
  };

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (filterStatus === "all") return true;
        return task.status === filterStatus;
      }),
    [tasks, filterStatus]
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return { text: "Menunggu", class: "bg-amber-100 text-amber-800 border-amber-300" };
      case "in-progress":
        return { text: "Sedang Berjalan", class: "bg-blue-100 text-blue-800 border-blue-300" };
      case "completed":
        return { text: "Selesai", class: "bg-emerald-100 text-emerald-800 border-emerald-300" };
      default:
        return { text: status, class: "bg-slate-100 text-slate-800 border-slate-300" };
    }
  };

  const formatDate = (timestamp: DateValue) => {
    if (!timestamp) return "-";

    let date: Date | null = null;
    if (typeof timestamp === "object" && timestamp !== null && "toDate" in timestamp && typeof timestamp.toDate === "function") {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === "string" || typeof timestamp === "number") {
      date = new Date(timestamp);
    }

    if (!date || Number.isNaN(date.getTime())) return "-";

    return date.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const selectedTaskKmz = selectedTask?.kmzFileUrl || selectedTask?.kmzFileUrl2;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push("/pra-existing-panel")}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 transition hover:bg-slate-200"
                >
                  <svg className="h-5 w-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Daftar Tugas Pra Existing</h1>
                  <p className="text-sm text-slate-500">Pilih tugas lalu cek polygon atau titik area kerja sebelum mulai survey.</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-600">Filter Status:</span>
              {["all", "pending", "in-progress", "completed"].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                    filterStatus === status ? "bg-blue-600 text-white shadow" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {status === "all" ? "Semua" : status === "pending" ? "Menunggu" : status === "in-progress" ? "Berjalan" : "Selesai"}
                </button>
              ))}
            </div>
            <span className="text-sm font-medium text-slate-500">{filteredTasks.length} tugas ditemukan</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-16 text-center">
              <h3 className="text-lg font-semibold text-slate-900">Tidak ada tugas</h3>
              <p className="mt-2 text-sm text-slate-500">Belum ada tugas pra-existing yang ditugaskan ke akun ini.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredTasks.map((task) => {
                const badge = getStatusBadge(task.status);
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => {
                      setSelectedTask(task);
                      setShowModal(true);
                    }}
                    className="group rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-300 hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${badge.class}`}>{badge.text}</span>
                      <svg className="h-5 w-5 text-slate-400 transition group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    </div>
                    <div className="mt-4">
                      <h3 className="text-lg font-bold text-slate-900">{task.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{task.description || "Tugas pra-existing"}</p>
                    </div>
                    <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                      <div className="flex justify-between gap-4">
                        <span>Surveyor</span>
                        <span className="font-semibold text-slate-800">{task.surveyorName}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>Dibuat</span>
                        <span className="font-semibold text-slate-800">{formatDate(task.createdAt)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </main>

        {showModal && selectedTask && (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setShowModal(false)}>
            <div
              className="flex max-h-[100dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-[28px]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="shrink-0 border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-slate-900">Detail Tugas</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">{selectedTask.title}</h2>
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusBadge(selectedTask.status).class}`}>
                        {getStatusBadge(selectedTask.status).text}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{selectedTask.description || "Tugas pra-existing"}</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="rounded-full p-2 transition hover:bg-slate-100">
                    <svg className="h-6 w-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2">
                  <div className="space-y-3">
                    <InfoRow label="Jenis Survey" value="Survey Pra Existing" />
                    <InfoRow label="Surveyor" value={selectedTask.surveyorName || "-"} />
                    <InfoRow label="Tanggal Dibuat" value={formatDate(selectedTask.createdAt)} />
                  </div>
                  <div className="space-y-3">
                    <InfoRow label="Status" value={getStatusBadge(selectedTask.status).text} />
                    <InfoRow label="Dimulai" value={selectedTask.startedAt ? formatDate(selectedTask.startedAt) : "Belum dimulai"} />
                    <InfoRow label="File Area" value={selectedTaskKmz ? "Tersedia" : "Belum ada file peta"} />
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 p-4">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-900">Preview Peta Lokasi</h3>
                      <p className="text-sm text-slate-500">Polygon atau titik dari admin ditampilkan sebagai alat bantu sebelum survey dimulai.</p>
                    </div>
                    {selectedTaskKmz && (
                      <a
                        href={selectedTaskKmz}
                        target="_blank"
                        rel="noreferrer"
                        className="max-w-full text-sm font-semibold text-blue-600 hover:underline"
                      >
                        Buka file KMZ
                      </a>
                    )}
                  </div>
                  <RemoteKMZMapPreview kmzUrl={selectedTaskKmz} height="clamp(220px, 38vh, 340px)" tone="blue" />
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex sm:flex-row sm:gap-3 sm:px-6 sm:pb-4">
                <button onClick={() => setShowModal(false)} className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 border border-slate-200 transition hover:bg-slate-100">
                  Tutup
                </button>
                <button
                  onClick={() => handleStartTask(selectedTask)}
                  className="mt-3 flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 sm:mt-0"
                >
                  {selectedTask.status === "pending" ? "Mulai Tugas" : "Lanjutkan Survey"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-2 last:border-b-0 last:pb-0">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="break-words text-right font-semibold text-slate-800">{value}</span>
    </div>
  );
}

export default function TugasSurveyPraExistingPage() {
  return <TugasSurveyPraExistingContent />;
}


