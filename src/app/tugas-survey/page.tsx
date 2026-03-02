"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import dynamic from "next/dynamic";

// Dynamic import for KMZ Map Preview
const DynamicKMZMapPreview = dynamic(
  () => import("@/components/KMZMapPreview"),
  { 
    ssr: false,
    loading: () => (
      <div className="rounded-xl overflow-hidden border-2 border-blue-200 shadow-lg flex items-center justify-center bg-gray-100" style={{ height: '300px' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Memuat preview...</p>
        </div>
      </div>
    )
  }
);

interface Task {
  id: string;
  title: string;
  description: string;
  surveyorId: string;
  surveyorName: string;
  surveyorEmail: string;
  status: string; // "pending", "in-progress", "completed"
  type: string; // "propose", "existing", "propose-existing"
  kmzFileUrl?: string;
  kmzFileUrl2?: string;
  excelFileUrl?: string;
  createdAt: any;
  startedAt?: any;
  completedAt?: any;
}

function TugasSurveyContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [kmzFile, setKmzFile] = useState<File | null>(null);
  const [kmzFile2, setKmzFile2] = useState<File | null>(null);

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      
      // Fetch tasks assigned to current user
      const tasksRef = collection(db, "tasks");
      const q = query(tasksRef, where("surveyorId", "==", user?.uid));
      const snapshot = await getDocs(q);
      
      const tasksData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Task[];
      
      setTasks(tasksData);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (task: Task) => {
    setSelectedTask(task);
    setShowDetailModal(true);
    
    // Load KMZ files if URLs exist
    if (task.kmzFileUrl) {
      try {
        const response = await fetch(task.kmzFileUrl);
        const blob = await response.blob();
        const file = new File([blob], "task.kmz", { type: "application/vnd.google-earth.kmz" });
        setKmzFile(file);
      } catch (error) {
        console.error("Error loading KMZ file:", error);
      }
    }
    
    if (task.kmzFileUrl2) {
      try {
        const response = await fetch(task.kmzFileUrl2);
        const blob = await response.blob();
        const file = new File([blob], "task2.kmz", { type: "application/vnd.google-earth.kmz" });
        setKmzFile2(file);
      } catch (error) {
        console.error("Error loading KMZ file 2:", error);
      }
    }
  };

  const handleStartTask = async (task: Task) => {
    try {
      // Update task status to in-progress
      const taskRef = doc(db, "tasks", task.id);
      await updateDoc(taskRef, {
        status: "in-progress",
        startedAt: new Date(),
      });
      
      // Store task data in localStorage for survey page
      localStorage.setItem("activeTask", JSON.stringify({
        id: task.id,
        title: task.title,
        type: task.type,
        kmzFileUrl: task.kmzFileUrl,
        kmzFileUrl2: task.kmzFileUrl2,
      }));
      
      // Navigate to appropriate survey page based on type
      if (task.type === "propose") {
        router.push("/survey-apj-propose");
      } else if (task.type === "existing") {
        router.push("/survey-existing");
      } else if (task.type === "propose-existing") {
        // User can choose which to start first
        router.push("/survey-selection");
      }
    } catch (error) {
      console.error("Error starting task:", error);
      alert("Gagal memulai tugas. Silakan coba lagi.");
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filterStatus === "all") return true;
    return task.status === filterStatus;
  });

  const pendingCount = tasks.filter(t => t.status === "pending").length;
  const inProgressCount = tasks.filter(t => t.status === "in-progress").length;
  const completedCount = tasks.filter(t => t.status === "completed").length;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.back()}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-all"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Daftar Tugas Survey</h1>
                  <p className="text-sm text-gray-600 mt-1">Kelola dan pantau tugas survey Anda</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user?.displayName || user?.email}</p>
                  <p className="text-xs text-gray-500">Petugas Survey</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Tugas</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{tasks.length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Menunggu</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-2">{pendingCount}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Sedang Berjalan</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">{inProgressCount}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Selesai</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">{completedCount}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Filter */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Filter Status:</span>
                <div className="flex gap-2">
                  {[
                    { value: "all", label: "Semua", color: "gray" },
                    { value: "pending", label: "Menunggu", color: "yellow" },
                    { value: "in-progress", label: "Berjalan", color: "blue" },
                    { value: "completed", label: "Selesai", color: "green" },
                  ].map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => setFilterStatus(filter.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        filterStatus === filter.value
                          ? `bg-${filter.color}-100 text-${filter.color}-700 ring-2 ring-${filter.color}-500`
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Task List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">Memuat daftar tugas...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Tugas</h3>
              <p className="text-sm text-gray-600">
                {filterStatus === "all" 
                  ? "Anda belum memiliki tugas survey. Hubungi admin untuk penugasan."
                  : `Tidak ada tugas dengan status "${filterStatus}"`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTasks.map((task) => (
                <div key={task.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          task.type === "propose" ? "bg-yellow-100" :
                          task.type === "existing" ? "bg-blue-100" :
                          "bg-purple-100"
                        }`}>
                          <span className="text-xl">
                            {task.type === "propose" ? "💡" :
                             task.type === "existing" ? "📁" : "🔄"}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900">{task.title}</h3>
                          <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          task.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                          task.status === "in-progress" ? "bg-blue-100 text-blue-700" :
                          "bg-green-100 text-green-700"
                        }`}>
                          {task.status === "pending" ? "Menunggu" :
                           task.status === "in-progress" ? "Sedang Berjalan" : "Selesai"}
                        </span>
                      </div>

                      <div className="flex items-center gap-6 text-sm text-gray-600 mb-4">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          <span>
                            {task.type === "propose" ? "Survey Propose" :
                             task.type === "existing" ? "Survey Existing" :
                             "Propose & Existing"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{task.createdAt?.toDate?.()?.toLocaleDateString('id-ID') || "N/A"}</span>
                        </div>
                        {task.kmzFileUrl && (
                          <div className="flex items-center gap-2 text-purple-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            <span className="font-medium">File KMZ Tersedia</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleViewDetail(task)}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Lihat Detail
                        </button>
                        
                        {task.status === "pending" && (
                          <button
                            onClick={() => handleStartTask(task)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Mulai Tugas
                          </button>
                        )}
                        
                        {task.status === "in-progress" && (
                          <button
                            onClick={() => handleStartTask(task)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            Lanjutkan Survey
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Modal */}
        {showDetailModal && selectedTask && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto my-8 relative">
              {/* Modal Header */}
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 rounded-t-2xl flex items-center justify-between z-[100] shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Detail Tugas Survey</h3>
                    <p className="text-sm text-blue-100">{selectedTask.title}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setKmzFile(null);
                    setKmzFile2(null);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white hover:bg-opacity-20 transition-all"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Task Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Informasi Tugas</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Jenis Survey:</span>
                      <span className="font-medium text-gray-900">
                        {selectedTask.type === "propose" ? "Survey Propose" :
                         selectedTask.type === "existing" ? "Survey Existing" :
                         "Propose & Existing"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        selectedTask.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                        selectedTask.status === "in-progress" ? "bg-blue-100 text-blue-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                        {selectedTask.status === "pending" ? "Menunggu" :
                         selectedTask.status === "in-progress" ? "Sedang Berjalan" : "Selesai"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Tanggal Dibuat:</span>
                      <span className="font-medium text-gray-900">
                        {selectedTask.createdAt?.toDate?.()?.toLocaleDateString('id-ID', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Deskripsi Tugas</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4">
                    {selectedTask.description}
                  </p>
                </div>

                {/* KMZ File Preview for Existing or Propose+Existing */}
                {(selectedTask.type === "existing" || selectedTask.type === "propose-existing") && kmzFile2 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Peta Survey Existing
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Area Terpasang</span>
                    </h4>
                    <DynamicKMZMapPreview file={kmzFile2} height="400px" />
                  </div>
                )}

                {/* KMZ File Preview for Propose or Propose+Existing */}
                {(selectedTask.type === "propose" || selectedTask.type === "propose-existing") && kmzFile && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Peta Survey Propose
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Area Baru</span>
                    </h4>
                    <DynamicKMZMapPreview file={kmzFile} height="400px" />
                  </div>
                )}

                {/* Info Alert */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-amber-900 mb-1">ℹ️ Panduan Pengerjaan</p>
                    <p className="text-xs text-amber-700">
                      Marker hijau pada peta menunjukkan area yang harus disurvey. 
                      Setelah memulai tugas, marker dari file KMZ akan ditampilkan di halaman survey sebagai panduan lokasi.
                      Marker yang Anda buat akan berbeda dengan marker dari file KMZ.
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl border-t border-gray-200 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setKmzFile(null);
                    setKmzFile2(null);
                  }}
                  className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
                >
                  Tutup
                </button>
                
                {selectedTask.status !== "completed" && (
                  <button
                    onClick={() => handleStartTask(selectedTask)}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-sm flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {selectedTask.status === "pending" ? "Mulai Tugas" : "Lanjutkan Survey"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

export default function TugasSurveyPage() {
  return <TugasSurveyContent />;
}
