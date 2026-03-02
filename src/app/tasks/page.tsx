"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, getDownloadURL } from "firebase/storage";
import dynamic from "next/dynamic";

// Dynamic import for KMZ Map Preview
const DynamicKMZMapPreview = dynamic(
  () => import("@/components/KMZMapPreview"),
  { 
    ssr: false,
    loading: () => (
      <div className="rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center bg-gray-100" style={{ height: '400px' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Memuat peta...</p>
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
  status: string;
  type: string;
  kmzFileUrl?: string;
  kmzFileUrl2?: string;
  excelFileUrl?: string;
  createdAt: any;
  startedAt?: any;
  completedAt?: any;
}

function TasksContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [kmzFile, setKmzFile] = useState<File | null>(null);
  const [kmzFile2, setKmzFile2] = useState<File | null>(null);
  const [loadingKmz, setLoadingKmz] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Detail modal auto-load states
  const [detailKmzFile, setDetailKmzFile] = useState<File | null>(null);
  const [detailKmzFile2, setDetailKmzFile2] = useState<File | null>(null);
  const [loadingDetailKmz, setLoadingDetailKmz] = useState(false);
  
  // Cache untuk menyimpan file KMZ yang sudah di-load
  const [kmzCache, setKmzCache] = useState<Map<string, File>>(new Map());

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  // Auto-load KMZ files when detail modal opens
  useEffect(() => {
    if (showModal && selectedTask) {
      loadDetailKmzFiles(selectedTask);
    }
  }, [showModal, selectedTask]);

  // Debug effect untuk monitor state changes
  useEffect(() => {
    if (selectedTask) {
      console.log("[STATE] State Update:", {
        taskType: selectedTask.type,
        loadingKmz,
        hasKmzFile: !!kmzFile,
        hasKmzFile2: !!kmzFile2,
        kmzFileUrl: selectedTask.kmzFileUrl,
        kmzFileUrl2: selectedTask.kmzFileUrl2
      });
    }
  }, [selectedTask, loadingKmz, kmzFile, kmzFile2]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      
      console.log("=== FETCHING TASKS ===");
      console.log("Current user UID:", user?.uid);
      console.log("Current user Email:", user?.email);
      
      const tasksRef = collection(db, "tasks");
      
      // Get all tasks to see what's in the database
      const allTasksSnapshot = await getDocs(tasksRef);
      console.log("Total tasks in database:", allTasksSnapshot.size);
      
      allTasksSnapshot.forEach((doc) => {
        console.log("Task:", doc.id, {
          title: doc.data().title,
          surveyorId: doc.data().surveyorId,
          surveyorEmail: doc.data().surveyorEmail,
          status: doc.data().status
        });
      });
      
      // Try with UID first
      let q = query(tasksRef, where("surveyorId", "==", user?.uid));
      let snapshot = await getDocs(q);
      
      console.log(`Tasks found with UID (${user?.uid}):`, snapshot.size);
      
      // If no tasks found with UID, try with email as fallback
      if (snapshot.empty && user?.email) {
        console.log("No tasks found with UID, trying with email...");
        q = query(tasksRef, where("surveyorEmail", "==", user.email));
        snapshot = await getDocs(q);
        console.log(`Tasks found with email (${user.email}):`, snapshot.size);
      }
      
      const tasksData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Task[];
      
      console.log("Tasks data loaded:", tasksData);
      setTasks(tasksData);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadDetailKmzFiles = async (task: Task) => {
    console.log("=== Loading Detail KMZ Files ===");
    console.log("Task:", task.title, "Type:", task.type);
    
    setLoadingDetailKmz(true);
    setDetailKmzFile(null);
    setDetailKmzFile2(null);
    
    try {
      const loadSingleKMZ = async (url: string, filename: string) => {
        console.log(`[LOADING] ${filename}`);
        
        try {
          // Use proxy API route to bypass CORS
          const proxyUrl = `/api/proxy-kmz?url=${encodeURIComponent(url)}`;
          console.log("[PROXY] Fetching via proxy:", proxyUrl);
          
          const response = await fetch(proxyUrl);
          
          if (!response.ok) {
            console.warn("[WARN] Proxy failed, trying direct URL...");
            const directResponse = await fetch(url);
            
            if (!directResponse.ok) {
              throw new Error(`HTTP ${directResponse.status}`);
            }
            
            const blob = await directResponse.blob();
            return new File([blob], filename, { type: "application/vnd.google-earth.kmz" });
          }
          
          const blob = await response.blob();
          console.log(`[SUCCESS] ${filename} loaded, size:`, blob.size, "bytes");
          return new File([blob], filename, { type: "application/vnd.google-earth.kmz" });
        } catch (error) {
          console.error(`[ERROR] Error loading ${filename}:`, error);
          return null;
        }
      };
      
      // Load Propose KMZ
      if (task.kmzFileUrl && (task.type === "propose" || task.type === "propose-existing")) {
        const file = await loadSingleKMZ(task.kmzFileUrl, "propose.kmz");
        if (file) setDetailKmzFile(file);
      }
      
      // Load Existing KMZ
      if (task.kmzFileUrl2 && (task.type === "existing" || task.type === "propose-existing")) {
        const file = await loadSingleKMZ(task.kmzFileUrl2, "existing.kmz");
        if (file) setDetailKmzFile2(file);
      }
      
      console.log("[COMPLETE] Detail KMZ loading complete");
    } catch (error) {
      console.error("[ERROR] Error in loadDetailKmzFiles:", error);
    } finally {
      setLoadingDetailKmz(false);
    }
  };

  const handleCardClick = (task: Task) => {
    setSelectedTask(task);
    setShowModal(true);
    setShowPreview(false);
    setLoadError(null);
    // Reset KMZ files
    setKmzFile(null);
    setKmzFile2(null);
    setDetailKmzFile(null);
    setDetailKmzFile2(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedTask(null);
    setKmzFile(null);
    setKmzFile2(null);
    setDetailKmzFile(null);
    setDetailKmzFile2(null);
    setLoadingKmz(false);
    setLoadingDetailKmz(false);
    setShowPreview(false);
    setLoadError(null);
  };

  const handleLoadPreview = () => {
    if (selectedTask) {
      setShowPreview(true);
      loadKmzFiles(selectedTask);
    }
  };

  const loadKmzFiles = useCallback(async (task: Task) => {
    console.log("=== Loading KMZ Files ===");
    console.log("Task:", task.title, "Type:", task.type);
    console.log("KMZ URLs:", task.kmzFileUrl, task.kmzFileUrl2);
    
    setLoadingKmz(true);
    setKmzFile(null);
    setKmzFile2(null);
    
    try {
      // Helper function untuk load single KMZ file
      const loadSingleKMZ = async (url: string, filename: string, cacheKey: string) => {
        // Check cache first
        if (kmzCache.has(cacheKey)) {
          console.log(`[CACHE] Using cached ${filename}`);
          return kmzCache.get(cacheKey)!;
        }
        
        console.log(`[LOADING] ${filename} from:`, url);
        
        try {
          let downloadUrl = url;
          
          // Jika URL dari Firebase Storage, dapatkan fresh download URL
          if (url.includes('firebasestorage.googleapis.com')) {
            // Extract path dari URL
            const urlObj = new URL(url);
            const pathMatch = urlObj.pathname.match(/\/o\/(.+)/);
            
            if (pathMatch) {
              const encodedPath = pathMatch[1].split('?')[0];
              const decodedPath = decodeURIComponent(encodedPath);
              console.log("[STORAGE] Getting fresh download URL for:", decodedPath);
              
              // Get fresh download URL dengan token yang valid
              const storageRef = ref(storage, decodedPath);
              downloadUrl = await getDownloadURL(storageRef);
              console.log("[SUCCESS] Fresh URL obtained");
            }
          }
          
          // Download file menggunakan fetch
          const response = await fetch(downloadUrl, {
            method: 'GET',
            mode: 'cors',
            cache: 'default',
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const blob = await response.blob();
          const file = new File([blob], filename, { type: "application/vnd.google-earth.kmz" });
          
          // Save to cache
          setKmzCache(prev => new Map(prev).set(cacheKey, file));
          console.log(`[SUCCESS] ${filename} loaded successfully, size:`, blob.size, "bytes");
          
          return file;
        } catch (error) {
          console.error(`[ERROR] Error loading ${filename}:`, error);
          throw error;
        }
      };
      
      // Load Propose KMZ
      if (task.kmzFileUrl && (task.type === "propose" || task.type === "propose-existing")) {
        const file = await loadSingleKMZ(task.kmzFileUrl, "propose.kmz", task.kmzFileUrl);
        console.log("Setting kmzFile state with:", file.name);
        setKmzFile(file);
      }
      
      // Load Existing KMZ
      if (task.kmzFileUrl2 && (task.type === "existing" || task.type === "propose-existing")) {
        const file = await loadSingleKMZ(task.kmzFileUrl2, "existing.kmz", task.kmzFileUrl2);
        console.log("Setting kmzFile2 state with:", file.name);
        setKmzFile2(file);
      }
      
      console.log("[SUCCESS] All KMZ files loaded successfully");
      
    } catch (error) {
      console.error("[ERROR] Error loading KMZ files:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLoadError(errorMessage);
    } finally {
      console.log("[COMPLETE] Loading complete, setting loadingKmz to false");
      setLoadingKmz(false);
    }
  }, [kmzCache]);

  const handleStartTask = async (task: Task) => {
    try {
      const taskRef = doc(db, "tasks", task.id);
      await updateDoc(taskRef, {
        status: "in-progress",
        startedAt: new Date(),
      });
      
      localStorage.setItem("activeTask", JSON.stringify({
        id: task.id,
        title: task.title,
        type: task.type,
        kmzFileUrl: task.kmzFileUrl,
        kmzFileUrl2: task.kmzFileUrl2,
      }));
      
      // Always go to survey selection first to let user choose survey type
      router.push("/survey-selection");
    } catch (error) {
      console.error("Error starting task:", error);
      alert("Gagal memulai tugas. Silakan coba lagi.");
    }
  };

  const handleCompleteTask = async (task: Task) => {
    const confirmComplete = window.confirm(
      `Apakah Anda yakin ingin menyelesaikan tugas "${task.title}"?\n\nSetelah diselesaikan, tugas tidak dapat dilanjutkan lagi.`
    );
    
    if (!confirmComplete) return;

    try {
      const taskRef = doc(db, "tasks", task.id);
      await updateDoc(taskRef, {
        status: "completed",
        completedAt: new Date(),
      });
      
      // Remove active task from localStorage
      localStorage.removeItem("activeTask");
      
      // Refresh tasks list
      await fetchTasks();
      
      // Close modal
      handleCloseModal();
      
      alert("Tugas berhasil diselesaikan! 🎉");
    } catch (error) {
      console.error("Error completing task:", error);
      alert("Gagal menyelesaikan tugas. Silakan coba lagi.");
    }
  };

  const getTypeLabel = (type: string) => {
    switch(type) {
      case "propose": return "Survey Propose";
      case "existing": return "Survey Existing";
      default: return "Propose & Existing";
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "pending": return { text: "Menunggu", class: "bg-yellow-100 text-yellow-700" };
      case "in-progress": return { text: "Sedang Berjalan", class: "bg-blue-100 text-blue-700" };
      case "completed": return { text: "Selesai", class: "bg-green-100 text-green-700" };
      default: return { text: status, class: "bg-gray-100 text-gray-700" };
    }
  };
  
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white border-b">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-2.5 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg transition-all shadow-sm border border-gray-200"
                aria-label="Kembali"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-xl font-bold text-gray-900">Daftar Tugas</h1>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-4 py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin mb-4"></div>
              <p className="text-sm text-gray-500">Memuat tugas...</p>
            </div>
          ) : tasks.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg className="w-20 h-20 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Tugas</h2>
              <p className="text-sm text-gray-500 max-w-sm">
                Tugas akan muncul di sini ketika admin memberikan penugasan
              </p>
            </div>
          ) : (
            /* Task List */
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => handleCardClick(task)}
                  className="bg-white border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{task.title}</h3>
                      <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusBadge(task.status).class}`}>
                      {getStatusBadge(task.status).text}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-3">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      {getTypeLabel(task.type)}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {task.createdAt?.toDate?.()?.toLocaleDateString('id-ID') || "N/A"}
                    </span>
                    {task.kmzFileUrl && (
                      <span className="flex items-center gap-1 text-purple-600">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        File KMZ
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Modal */}
        {showModal && selectedTask && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div 
              className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Detail Tugas</h3>
                <button
                  onClick={handleCloseModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-4">
                {/* Title & Status */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="text-xl font-bold text-gray-900">{selectedTask.title}</h4>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(selectedTask.status).class}`}>
                      {getStatusBadge(selectedTask.status).text}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{selectedTask.description}</p>
                </div>

                {/* Info Grid */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Jenis Survey</span>
                    <span className="font-medium text-gray-900">{getTypeLabel(selectedTask.type)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tanggal Dibuat</span>
                    <span className="font-medium text-gray-900">
                      {selectedTask.createdAt?.toDate?.()?.toLocaleDateString('id-ID', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) || "N/A"}
                    </span>
                  </div>
                  {selectedTask?.startedAt && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Dimulai</span>
                      <span className="font-medium text-gray-900">
                        {selectedTask?.startedAt?.toDate?.()?.toLocaleDateString('id-ID') || "N/A"}
                      </span>
                    </div>
                  )}
                  {selectedTask?.kmzFileUrl && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">File KMZ</span>
                      <span className="font-medium text-purple-600">Tersedia</span>
                    </div>
                  )}
                </div>

                {/* Auto-load Map Preview Section */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Preview Peta Lokasi
                  </h4>

                  {loadingDetailKmz ? (
                    <div className="rounded-xl overflow-hidden border-2 border-blue-200 flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50" style={{ height: '400px' }}>
                      <div className="text-center">
                        <div className="relative mb-4">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500 mx-auto"></div>
                          <div className="animate-ping absolute top-0 left-1/2 transform -translate-x-1/2 rounded-full h-12 w-12 border-4 border-purple-400 opacity-20"></div>
                        </div>
                        <p className="text-gray-800 text-sm font-semibold mb-1">Memuat Peta...</p>
                        <p className="text-gray-600 text-xs">Mohon tunggu sebentar</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Map Preview for Existing */}
                      {(selectedTask?.type === "existing" || selectedTask?.type === "propose-existing") && (
                        <div>
                          <label className="flex items-center gap-2 text-xs font-bold text-blue-700 mb-2 bg-blue-50 px-3 py-2 rounded-lg">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            Peta Survey Existing
                            <span className="ml-auto text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Area Terpasang</span>
                          </label>
                          {detailKmzFile2 ? (
                            <DynamicKMZMapPreview file={detailKmzFile2} height="400px" />
                          ) : (
                            <div className="rounded-xl overflow-hidden border-2 border-dashed border-blue-300 flex items-center justify-center bg-blue-50" style={{ height: '400px' }}>
                              <div className="text-center">
                                <svg className="w-12 h-12 text-blue-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                                <p className="text-blue-600 text-sm font-semibold mb-1">File KMZ tidak tersedia</p>
                                {selectedTask?.kmzFileUrl2 && (
                                  <a href={selectedTask.kmzFileUrl2} download className="text-blue-500 text-xs hover:underline">Download file</a>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Map Preview for Propose */}
                      {(selectedTask?.type === "propose" || selectedTask?.type === "propose-existing") && (
                        <div>
                          <label className="flex items-center gap-2 text-xs font-bold text-green-700 mb-2 bg-green-50 px-3 py-2 rounded-lg">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            Peta Survey Propose
                            <span className="ml-auto text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">Area Baru</span>
                          </label>
                          {detailKmzFile ? (
                            <DynamicKMZMapPreview file={detailKmzFile} height="400px" />
                          ) : (
                            <div className="rounded-xl overflow-hidden border-2 border-dashed border-green-300 flex items-center justify-center bg-green-50" style={{ height: '400px' }}>
                              <div className="text-center">
                                <svg className="w-12 h-12 text-green-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                                <p className="text-green-600 text-sm font-semibold mb-1">File KMZ tidak tersedia</p>
                                {selectedTask?.kmzFileUrl && (
                                  <a href={selectedTask.kmzFileUrl} download className="text-green-500 text-xs hover:underline">Download file</a>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Old KMZ Preview Section (Keep for backward compatibility) */}
                {false && (selectedTask?.kmzFileUrl || selectedTask?.kmzFileUrl2) && !showPreview && !loadingKmz && (
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-5">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-blue-900 text-lg mb-2">Peta Lokasi Tersedia</h4>
                        <p className="text-blue-700 text-sm mb-4">
                          File KMZ untuk lokasi survey sudah tersedia. Klik tombol di bawah untuk melihat preview peta interaktif dengan titik-titik lokasi.
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={handleLoadPreview}
                            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 px-6 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Lihat Preview Peta
                          </button>
                          {selectedTask?.kmzFileUrl && (
                            <a
                              href={selectedTask?.kmzFileUrl}
                              download
                              className="bg-white hover:bg-gray-50 text-blue-600 py-3 px-4 rounded-xl font-medium text-sm transition-all border-2 border-blue-200 flex items-center gap-2 shadow"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Download
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Loading KMZ */}
                {loadingKmz && (
                  <div className="rounded-xl overflow-hidden border-2 border-blue-200 flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50" style={{ height: '400px' }}>
                    <div className="text-center">
                      <div className="relative mb-4">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto"></div>
                        <div className="animate-ping absolute top-0 left-1/2 transform -translate-x-1/2 rounded-full h-16 w-16 border-4 border-purple-400 opacity-20"></div>
                      </div>
                      <p className="text-gray-800 text-base font-bold mb-2">Memuat Peta KMZ...</p>
                      <p className="text-gray-600 text-sm">Mohon tunggu, sedang mengunduh dan memproses file peta</p>
                    </div>
                  </div>
                )}

                {/* Error State */}
                {loadError && !loadingKmz && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5">
                    <div className="flex gap-3">
                      <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1">
                        <h4 className="font-bold text-red-900 mb-1">Gagal Memuat Peta</h4>
                        <p className="text-red-700 text-sm mb-3">{loadError}</p>
                        <button
                          onClick={handleLoadPreview}
                          className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium text-sm transition-all"
                        >
                          Coba Lagi
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Map Preview for Existing */}
                {(selectedTask?.type === "existing" || selectedTask?.type === "propose-existing") && kmzFile2 && (
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Peta Survey Existing
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Area Terpasang</span>
                    </label>
                    <DynamicKMZMapPreview file={kmzFile2} height="400px" />
                  </div>
                )}

                {/* Map Preview for Propose */}
                {(selectedTask?.type === "propose" || selectedTask?.type === "propose-existing") && kmzFile && (
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Peta Survey Propose
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Area Baru</span>
                    </label>
                    <DynamicKMZMapPreview file={kmzFile} height="400px" />
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex gap-3">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
                >
                  Tutup
                </button>
                
                {selectedTask && selectedTask.status !== "completed" && (
                  <>
                    {selectedTask.status === "in-progress" && (
                      <button
                        onClick={() => handleCompleteTask(selectedTask)}
                        className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Selesai Tugas
                      </button>
                    )}
                    <button
                      onClick={() => {
                        handleStartTask(selectedTask);
                        handleCloseModal();
                      }}
                      className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
                    >
                      {selectedTask?.status === "pending" ? "Mulai Tugas" : "Lanjutkan Survey"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

function TasksPage() {
  return (
    <ProtectedRoute>
      <TasksContent />
    </ProtectedRoute>
  );
}

export default TasksPage;
