"use client";

import { useState, useEffect, type FormEvent } from "react";
import { collection, getDoc, getDocs, addDoc, serverTimestamp, query, orderBy, limit, deleteDoc, doc, setDoc, updateDoc, where } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { clearCachedData, fetchWithCache } from "@/utils/firestoreCache";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import dynamic from "next/dynamic";
import { loadParsedTaskGeometries } from "@/utils/kmzTaskParser";
import { analyzeTaskNavigation, type LatLngPoint, type ParsedTaskGeometries } from "@/utils/taskNavigation";
import type { UnifiedSurveyMarker } from "@/components/SurveyTaskUnifiedMap";
import { fetchAdminSurveyRows, type AdminSurveyRow } from "./supabaseSurveyClient";
import {
  DEFAULT_PRA_EXISTING_OFFLINE_SETTINGS,
  PRA_EXISTING_OFFLINE_SETTINGS_COLLECTION,
  PRA_EXISTING_OFFLINE_SETTINGS_DOC,
  type PraExistingOfflineSettings,
} from "@/utils/praExistingOfflineSettings";

// Dynamic import for KMZ Map Preview (SSR disabled for Leaflet)
const DynamicKMZMapPreview = dynamic(
  () => import("@/components/KMZMapPreview"),
  { 
    ssr: false,
    loading: () => (
      <div className="rounded-xl overflow-hidden border-2 border-purple-200 shadow-lg flex items-center justify-center bg-gray-100" style={{ height: '300px' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Memuat preview...</p>
        </div>
      </div>
    )
  }
);

const DynamicSurveyTaskUnifiedMap = dynamic(
  () => import("@/components/SurveyTaskUnifiedMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[300px] items-center justify-center rounded-2xl border border-blue-200 bg-slate-100">
        <div className="text-center">
          <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="text-sm text-slate-500">Memuat peta progres...</p>
        </div>
      </div>
    ),
  }
);

interface Petugas {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  type: string;
  surveyorId: string;
  surveyorName: string;
  surveyorEmail: string;
  status: string;
  kmzFileUrl?: string;
  kmzFileUrl2?: string;
  excelFileUrl?: string;
  offlineEnabled?: boolean;
  createdAt: { toDate?: () => Date } | Date | string | number | null;
}

type TaskProgressKind = "propose" | "existing" | "pra-existing";

interface TaskProgressSection {
  kind: TaskProgressKind;
  label: string;
  markerLabel: string;
  markerColor: string;
  kmzFileUrl?: string;
  markers: UnifiedSurveyMarker[];
  totalPoints: number;
  exactMatchCount: number;
  inferredMatchCount: number;
}

interface SurveyDocData {
  id: string;
  title?: string;
  status?: string;
  latitude?: number | string;
  longitude?: number | string;
  accuracy?: number | string;
  lokasiLengkap?: string;
  namaJalan?: string;
  desa?: string;
  banjar?: string;
  kabupaten?: string;
  surveyorName?: string;
  surveyorUid?: string;
  taskId?: string;
  taskTitle?: string;
  createdAt?: { toDate?: () => Date } | Date | string | number | null;
  submittedAtLocal?: string;
}

interface DistribusiTugasProps {
  setActiveMenu?: (menu: string) => void;
  isSuperAdmin?: boolean;
  isActive?: boolean;
}

export default function DistribusiTugas({ isSuperAdmin = false, isActive = false }: DistribusiTugasProps) {
  const TASKS_CACHE_PREFIX = "distribusi_tugas_tasks";
  const TASK_PROGRESS_CACHE_PREFIX = "distribusi_tugas_progress";
  const PETUGAS_CACHE_KEY = "distribusi_tugas_petugas_list_supabase_v1";
  const [showTaskDropdown, setShowTaskDropdown] = useState(false);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [showExistingModal, setShowExistingModal] = useState(false);
  const [showProposeExistingModal, setShowProposeExistingModal] = useState(false);
  const [showPraExistingModal, setShowPraExistingModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [selectedSurveyor, setSelectedSurveyor] = useState("");
  const [surveyorSearch, setSurveyorSearch] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskOfflineEnabled, setTaskOfflineEnabled] = useState(true);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [kmzFile, setKmzFile] = useState<File | null>(null);
  const [kmzFile2, setKmzFile2] = useState<File | null>(null);
  const [petugasList, setPetugasList] = useState<Petugas[]>([]);
  const [loadingPetugas, setLoadingPetugas] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Task list states
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [offlineSettings, setOfflineSettings] = useState<PraExistingOfflineSettings>(DEFAULT_PRA_EXISTING_OFFLINE_SETTINGS);
  const [loadingOfflineSettings, setLoadingOfflineSettings] = useState(true);
  const [savingOfflineSettings, setSavingOfflineSettings] = useState(false);
  const [savingTaskOfflineId, setSavingTaskOfflineId] = useState<string | null>(null);
  const [selectedTaskFilter, setSelectedTaskFilter] = useState<"all" | "pending" | "in-progress" | "completed">("all");
  const [searchInput, setSearchInput] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [hasRequestedTaskLoad, setHasRequestedTaskLoad] = useState(false);
  
  // Detail modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<Task | null>(null);
  const [detailKmzFile, setDetailKmzFile] = useState<File | null>(null);
  const [detailKmzFile2, setDetailKmzFile2] = useState<File | null>(null);
  const [loadingDetailKmz, setLoadingDetailKmz] = useState(false);
  const [loadingTaskProgress, setLoadingTaskProgress] = useState(false);
  const [taskProgressError, setTaskProgressError] = useState<string | null>(null);
  const [taskProgressSections, setTaskProgressSections] = useState<TaskProgressSection[]>([]);

  // Fetch tasks on component mount
  useEffect(() => {
    if (!isActive) return;
    fetchOfflineSettings();
    if (isSuperAdmin && !hasRequestedTaskLoad) {
      setTasks([]);
      setLoadingTasks(false);
      return;
    }
    void fetchTasks();
    // fetchTasks bergantung pada query aktif dan mode super admin; effect ini memang dipicu ulang saat keduanya berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, activeSearchQuery, isSuperAdmin, hasRequestedTaskLoad]);

  // Auto-load KMZ files when detail modal opens
  useEffect(() => {
    if (!isActive) return;
    if (showDetailModal && selectedTaskDetail) {
      void loadDetailKmzFiles(selectedTaskDetail);
      void loadTaskProgress(selectedTaskDetail);
    }
    // Fungsi loader didefinisikan di komponen yang sama dan aman dipicu ulang saat task detail berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDetailModal, selectedTaskDetail, isActive]);

  const fetchOfflineSettings = async () => {
    try {
      setLoadingOfflineSettings(true);
      const settingsRef = doc(
        db,
        PRA_EXISTING_OFFLINE_SETTINGS_COLLECTION,
        PRA_EXISTING_OFFLINE_SETTINGS_DOC
      );
      const settingsSnap = await getDoc(settingsRef);

      if (!settingsSnap.exists()) {
        setOfflineSettings(DEFAULT_PRA_EXISTING_OFFLINE_SETTINGS);
        return;
      }

      const data = settingsSnap.data() as { globalEnabled?: unknown };
      setOfflineSettings({
        globalEnabled:
          typeof data.globalEnabled === "boolean"
            ? data.globalEnabled
            : DEFAULT_PRA_EXISTING_OFFLINE_SETTINGS.globalEnabled,
      });
    } catch (error) {
      console.error("Error fetching pra-existing offline settings:", error);
      setOfflineSettings(DEFAULT_PRA_EXISTING_OFFLINE_SETTINGS);
    } finally {
      setLoadingOfflineSettings(false);
    }
  };

  const fetchTasks = async (forceRefresh = false, overrideSearch?: string) => {
    try {
      setLoadingTasks(true);
      
      // Get current admin info
      const storedUser = localStorage.getItem('gesa_user');
      const currentAdmin = storedUser ? JSON.parse(storedUser) : null;
      const adminId = currentAdmin?.uid || null;
      const effectiveSearch = typeof overrideSearch === "string" ? overrideSearch.trim() : activeSearchQuery.trim();
      const includeAll = isSuperAdmin;
      
      const cacheKey = `${TASKS_CACHE_PREFIX}_${includeAll ? "super_admin_all" : adminId || "all"}_${effectiveSearch || "all"}`;
      if (forceRefresh) {
        clearCachedData(cacheKey);
      }

      const params = new URLSearchParams();
      if (adminId && !includeAll) params.set("adminId", adminId);
      if (includeAll) params.set("includeAll", "true");
      if (effectiveSearch) params.set("q", effectiveSearch);

      const response = await fetch(`/api/admin/tasks?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Gagal memuat tugas admin dari Supabase.");
      }

      const payload = (await response.json()) as { tasks?: Task[] };
      const tasksData = Array.isArray(payload.tasks) ? payload.tasks : [];
      
      setTasks(tasksData);
      console.log("Tasks loaded for admin:", tasksData.length);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoadingTasks(false);
    }
  };

  // Fetch petugas when modal opens
  useEffect(() => {
    if (showProposeModal || showExistingModal || showProposeExistingModal || showPraExistingModal) {
      clearCachedData(PETUGAS_CACHE_KEY);
      fetchPetugas();
    }
  }, [showProposeModal, showExistingModal, showProposeExistingModal, showPraExistingModal]);

  // Prevent body scrolling when modal is open
  useEffect(() => {
    if (showProposeModal || showExistingModal || showProposeExistingModal || showPraExistingModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showProposeModal, showExistingModal, showProposeExistingModal, showPraExistingModal]);

  useEffect(() => {
    setSurveyorSearch("");
  }, [showProposeModal, showExistingModal, showProposeExistingModal, showPraExistingModal]);

  useEffect(() => {
    if (showPraExistingModal) {
      setTaskOfflineEnabled(offlineSettings.globalEnabled);
    }
  }, [showPraExistingModal, offlineSettings.globalEnabled]);

  const fetchPetugas = async () => {
    try {
      setLoadingPetugas(true);
      
      const data = await fetchWithCache<(Petugas & { role: string; uid: string })[]>(
        PETUGAS_CACHE_KEY,
        async () => {
          const allowedRoles = new Set([
            "petugas-existing",
            "petugas-apj-propose",
            "petugas-pra-existing",
            "petugas-survey-cahaya",
            "petugas-kontruksi",
            "petugas-om",
            "petugas-bmd-gudang",
          ]);

          try {
            const pageSize = 200;
            let offset = 0;
            let hasMore = true;
            const supabaseUsers: (Petugas & { role: string; uid: string })[] = [];

            while (hasMore) {
              const params = new URLSearchParams({
                limit: String(pageSize),
                offset: String(offset),
              });
              const response = await fetch(`/api/admin/user-admin?${params.toString()}`, {
                cache: "no-store",
              });

              if (!response.ok) {
                throw new Error("Gagal memuat petugas dari Supabase.");
              }

              const payload = (await response.json()) as {
                users?: Array<{
                  id?: string;
                  uid?: string;
                  name?: string;
                  email?: string;
                  role?: string;
                }>;
                hasMore?: boolean;
                nextOffset?: number;
              };

              const rows = Array.isArray(payload.users) ? payload.users : [];
              supabaseUsers.push(
                ...rows
                  .map((user) => ({
                    id: user.id || user.uid || "",
                    name: user.name || "-",
                    email: user.email || "-",
                    role: typeof user.role === "string" ? user.role.trim() : "",
                    uid: user.uid || user.id || "",
                  }))
                  .filter((user) => allowedRoles.has(user.role))
              );

              hasMore = Boolean(payload.hasMore);
              offset = typeof payload.nextOffset === "number" ? payload.nextOffset : offset + rows.length;

              if (rows.length === 0) {
                hasMore = false;
              }
            }

            return supabaseUsers;
          } catch (supabaseError) {
            console.error("Supabase petugas fetch failed, fallback to Firestore:", supabaseError);

            const usersRef = collection(db, "User-Admin");
            const petsQuery = query(
              usersRef,
              where("role", "in", Array.from(allowedRoles))
            );
            const snapshot = await getDocs(petsQuery);

            return snapshot.docs.map((userDoc) => {
              const user = userDoc.data() as {
                uid?: string;
                name?: string;
                email?: string;
                role?: string;
              };

              return {
                id: userDoc.id,
                name: user.name || "-",
                email: user.email || "-",
                role: typeof user.role === "string" ? user.role.trim() : "",
                uid: user.uid || userDoc.id,
              };
            });
          }
        },
        300_000
      );
      
      setPetugasList(data);
    } catch (error) {
      console.error("Error fetching petugas:", error);
    } finally {
      setLoadingPetugas(false);
    }
  };

  const getPetugasOptions = (taskType: "propose" | "existing" | "propose-existing" | "pra-existing" | "all") => {
    if (taskType === "propose") return petugasList.filter((p) => p.role === "petugas-apj-propose");
    if (taskType === "existing") return petugasList.filter((p) => p.role === "petugas-existing");
    if (taskType === "pra-existing") return petugasList.filter((p) => p.role === "petugas-pra-existing");
    return petugasList;
  };

  const getFilteredPetugasOptions = (taskType: "propose" | "existing" | "propose-existing" | "pra-existing" | "all") => {
    const options = getPetugasOptions(taskType);
    const keyword = surveyorSearch.trim().toLowerCase();

    if (!keyword) {
      return options;
    }

    return options.filter((petugas) =>
      petugas.name.toLowerCase().includes(keyword) ||
      petugas.email.toLowerCase().includes(keyword) ||
      (petugas.role || "").toLowerCase().includes(keyword)
    );
  };

  const uploadFileToStorage = async (file: File, folder: string): Promise<string> => {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storageRef = ref(storage, `${folder}/${fileName}`);
    
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  };

  const getTaskCreatedAtMs = (value: Task["createdAt"]) => {
    if (!value) return null;
    if (value instanceof Date) {
      return value.getTime();
    }
    if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
      return value.toDate().getTime();
    }
    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value).getTime();
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const getSurveyCreatedAtMs = (value: SurveyDocData["createdAt"], submittedAtLocal?: string) => {
    if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
      return value.toDate().getTime();
    }
    if (value instanceof Date) {
      return value.getTime();
    }
    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value).getTime();
      if (!Number.isNaN(parsed)) return parsed;
    }
    if (submittedAtLocal) {
      const parsed = new Date(submittedAtLocal).getTime();
      if (!Number.isNaN(parsed)) return parsed;
    }
    return null;
  };

  const getTaskProgressConfigs = (task: Task) => {
    const configs: Array<{
      kind: TaskProgressKind;
      label: string;
      markerLabel: string;
      markerColor: string;
      collectionName: string;
      kmzFileUrl?: string;
    }> = [];

    if (task.type === "propose" || task.type === "propose-existing") {
      configs.push({
        kind: "propose",
        label: "Progress Survey Propose",
        markerLabel: "Titik Propose",
        markerColor: "#16a34a",
        collectionName: "survey-apj-propose",
        kmzFileUrl: task.kmzFileUrl,
      });
    }

    if (task.type === "existing" || task.type === "propose-existing") {
      configs.push({
        kind: "existing",
        label: "Progress Survey Existing",
        markerLabel: "Titik Existing",
        markerColor: "#2563eb",
        collectionName: "survey-existing",
        kmzFileUrl: task.kmzFileUrl2,
      });
    }

    if (task.type === "pra-existing") {
      configs.push({
        kind: "pra-existing",
        label: "Progress Survey Pra Existing",
        markerLabel: "Titik Pra Existing",
        markerColor: "#0f766e",
        collectionName: "survey-pra-existing",
        kmzFileUrl: task.kmzFileUrl2,
      });
    }

    return configs;
  };

  const isPointMatchedToTaskGeometry = (point: LatLngPoint, geometries: ParsedTaskGeometries | null) => {
    if (!geometries) return false;

    const hasGeometry =
      geometries.polygons.length > 0 || geometries.polylines.length > 0 || geometries.points.length > 0;
    if (!hasGeometry) return false;

    const info = analyzeTaskNavigation(point, geometries);
    if (!info?.hasTaskGeometry) return false;

    if (info.geometryType === "polygon") {
      return info.isInsidePolygon === true || (info.distanceToTargetMeters ?? Number.POSITIVE_INFINITY) <= 120;
    }

    return (info.distanceToTargetMeters ?? Number.POSITIVE_INFINITY) <= 120;
  };

  const mapSurveyDocToMarker = (kind: TaskProgressKind, data: SurveyDocData): UnifiedSurveyMarker | null => {
    const latitude = Number(data.latitude);
    const longitude = Number(data.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    const locationLabel =
      data.lokasiLengkap ||
      data.namaJalan ||
      [data.desa, data.banjar].filter(Boolean).join(" - ") ||
      data.kabupaten ||
      "-";

    const typeLabel =
      kind === "existing"
        ? "Existing"
        : kind === "propose"
          ? "APJ Propose"
          : "Pra Existing";

    return {
      id: data.id,
      latitude,
      longitude,
      title: data.title || `Titik ${typeLabel}`,
      details: [
        { label: "Petugas", value: data.surveyorName || "-" },
        { label: "Status", value: data.status || "-" },
        { label: "Lokasi", value: locationLabel },
        { label: "Sumber", value: data.taskId ? "taskId" : "area tugas" },
      ],
      createdAt: data.createdAt || data.submittedAtLocal || null,
    };
  };

  const loadTaskProgress = async (task: Task) => {
    try {
      setLoadingTaskProgress(true);
      setTaskProgressError(null);
      const taskCreatedAtMs = getTaskCreatedAtMs(task.createdAt);
      const configs = getTaskProgressConfigs(task);
      const cacheKey = `${TASK_PROGRESS_CACHE_PREFIX}_${task.id}`;
      clearCachedData(cacheKey);
      const sections = await Promise.all(
        configs.map(async (config): Promise<TaskProgressSection> => {
          const geometries =
            config.kmzFileUrl
              ? await loadParsedTaskGeometries(config.kmzFileUrl).catch(() => null)
              : null;

          const payload = await fetchAdminSurveyRows({
            activeKabupaten: null,
            adminId: null,
            type: config.kind,
          });

          let exactMatchCount = 0;
          let inferredMatchCount = 0;

          const markers = payload.rows
            .filter((survey: AdminSurveyRow) => {
              const sameSurveyor =
                survey.surveyorUid === task.surveyorId ||
                (survey.surveyorEmail && task.surveyorEmail && survey.surveyorEmail === task.surveyorEmail);

              if (!sameSurveyor) {
                return false;
              }

              if (survey.taskId) {
                const isExact = survey.taskId === task.id;
                if (isExact) exactMatchCount += 1;
                return isExact;
              }

              const latitude = Number(survey.latitude);
              const longitude = Number(survey.longitude);
              if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                return false;
              }

              const surveyCreatedAtMs = getSurveyCreatedAtMs(survey.createdAt, typeof survey.submittedAtLocal === "string" ? survey.submittedAtLocal : undefined);
              if (taskCreatedAtMs && surveyCreatedAtMs && surveyCreatedAtMs + 5 * 60 * 1000 < taskCreatedAtMs) {
                return false;
              }

              const matched = isPointMatchedToTaskGeometry({ lat: latitude, lng: longitude }, geometries);
              if (matched) inferredMatchCount += 1;
              return matched;
            })
            .map((survey): SurveyDocData => ({
              id: survey.id,
              title: survey.title,
              status: survey.status,
              latitude: survey.latitude,
              longitude: survey.longitude,
              accuracy: survey.accuracy,
              lokasiLengkap:
                [survey.kabupatenName || survey.kabupaten, survey.kecamatan, survey.desa, survey.banjar]
                  .filter(Boolean)
                  .join(" - "),
              namaJalan: survey.namaJalan,
              desa: survey.desa,
              banjar: survey.banjar,
              kabupaten: survey.kabupatenName || survey.kabupaten,
              surveyorName: survey.surveyorName,
              surveyorUid: survey.surveyorUid,
              taskId: survey.taskId,
              taskTitle: survey.taskTitle,
              createdAt: survey.createdAt,
              submittedAtLocal: typeof survey.submittedAtLocal === "string" ? survey.submittedAtLocal : undefined,
            }))
            .map((survey) => mapSurveyDocToMarker(config.kind, survey))
            .filter((marker): marker is UnifiedSurveyMarker => marker !== null)
            .sort((left, right) => {
              const leftTime = getSurveyCreatedAtMs(left.createdAt, undefined) ?? 0;
              const rightTime = getSurveyCreatedAtMs(right.createdAt, undefined) ?? 0;
              return rightTime - leftTime;
            });

          return {
            kind: config.kind,
            label: config.label,
            markerLabel: config.markerLabel,
            markerColor: config.markerColor,
            kmzFileUrl: config.kmzFileUrl,
            markers,
            totalPoints: markers.length,
            exactMatchCount,
            inferredMatchCount,
          };
        })
      );

      setTaskProgressSections(sections);
    } catch (error) {
      console.error("Error loading task progress:", error);
      setTaskProgressSections([]);
      setTaskProgressError("Progress tugas gagal dimuat. Coba buka ulang detail tugas.");
    } finally {
      setLoadingTaskProgress(false);
    }
  };

  const handleSubmitTask = async (taskType: "propose" | "existing" | "propose-existing" | "pra-existing") => {
    // Validation
    if (!taskTitle.trim()) {
      alert("Judul tugas harus diisi!");
      return;
    }
    if (!selectedSurveyor) {
      alert("Pilih surveyor terlebih dahulu!");
      return;
    }
    if (!taskDescription.trim()) {
      alert("Deskripsi tugas harus diisi!");
      return;
    }

    // Check if files are uploaded based on task type
    if (taskType === "propose" && !kmzFile) {
      alert("File KMZ harus di-upload untuk tugas Propose!");
      return;
    }
    if (taskType === "existing" && !kmzFile2) {
      alert("File KMZ harus di-upload untuk tugas Existing!");
      return;
    }
    if (taskType === "pra-existing" && !kmzFile2) {
      alert("File KMZ harus di-upload untuk tugas Pra Existing!");
      return;
    }
    if (taskType === "propose-existing" && (!kmzFile || !kmzFile2)) {
      alert("Kedua file KMZ harus di-upload!");
      return;
    }

    try {
      setSubmitting(true);

      // Get selected surveyor data
      const surveyor = petugasList.find((p) => p.id === selectedSurveyor) as (Petugas & { role: string; uid: string }) | undefined;
      if (!surveyor) {
        alert("Data surveyor tidak ditemukan!");
        return;
      }

      console.log("Creating task for surveyor:", surveyor);
      console.log("Surveyor UID:", surveyor.uid);
      console.log("Surveyor Email:", surveyor.email);

      // Upload files to storage
      let kmzFileUrl = "";
      let kmzFileUrl2 = "";
      let excelFileUrl = "";

      if (kmzFile) {
        kmzFileUrl = await uploadFileToStorage(kmzFile, "tasks/kmz");
      }
      if (kmzFile2) {
        kmzFileUrl2 = await uploadFileToStorage(kmzFile2, "tasks/kmz");
      }
      if (excelFile) {
        excelFileUrl = await uploadFileToStorage(excelFile, "tasks/excel");
      }

      // Get current admin info
      const storedUser = localStorage.getItem('gesa_user');
      const currentAdmin = storedUser ? JSON.parse(storedUser) : null;

      // Create task document
      const taskData = {
        title: taskTitle,
        description: taskDescription,
        type: taskType,
        surveyorId: surveyor.uid,
        surveyorName: surveyor.name,
        surveyorEmail: surveyor.email,
        status: "pending",
        kmzFileUrl: kmzFileUrl || null,
        kmzFileUrl2: kmzFileUrl2 || null,
        excelFileUrl: excelFileUrl || null,
        offlineEnabled: taskType === "pra-existing" ? taskOfflineEnabled : false,
        createdAt: serverTimestamp(),
        startedAt: null,
        completedAt: null,
        // Admin yang membuat tugas
        createdByAdminId: currentAdmin?.uid || null,
        createdByAdminName: currentAdmin?.name || currentAdmin?.email || 'Admin',
        createdByAdminEmail: currentAdmin?.email || null,
      };

      console.log("Task data to be saved:", taskData);
      
      const response = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData),
      });
      if (!response.ok) {
        throw new Error("Gagal membuat tugas di Supabase.");
      }

      alert("Tugas berhasil dibuat dan dikirim ke surveyor!");
      
      // Refresh task list
      await fetchTasks(true);
      
      // Reset form and close modal
      setTaskTitle("");
      setSelectedSurveyor("");
      setTaskDescription("");
      setTaskOfflineEnabled(offlineSettings.globalEnabled);
      setExcelFile(null);
      setKmzFile(null);
      setKmzFile2(null);
      setShowProposeModal(false);
      setShowExistingModal(false);
      setShowProposeExistingModal(false);
      setShowPraExistingModal(false);
    } catch (error) {
      console.error("Error creating task:", error);
      alert("Gagal membuat tugas. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus tugas ini?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Gagal menghapus tugas di Supabase.");
      }
      clearCachedData(`${TASK_PROGRESS_CACHE_PREFIX}_${taskId}`);
      await fetchTasks(true);
      alert("Tugas berhasil dihapus!");
    } catch (error) {
      console.error("Error deleting task:", error);
      alert("Gagal menghapus tugas.");
    }
  };

  const handleReactivateTask = async (task: Task) => {
    if (!confirm(`Aktifkan kembali tugas "${task.title}" agar petugas bisa melanjutkan survey?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        status: "in-progress",
        reactivatedAt: new Date().toISOString(),
        completedAt: null,
        }),
      });
      if (!response.ok) {
        throw new Error("Gagal mengaktifkan kembali tugas di Supabase.");
      }

      await fetchTasks(true);
      setSelectedTaskDetail((previous) => (previous?.id === task.id ? { ...previous, status: "in-progress" } : previous));
      alert("Tugas berhasil diaktifkan kembali.");
    } catch (error) {
      console.error("Error reactivating task:", error);
      alert("Gagal mengaktifkan kembali tugas.");
    }
  };

  const handleSaveGlobalOfflineSettings = async (nextEnabled: boolean) => {
    try {
      setSavingOfflineSettings(true);
      await setDoc(
        doc(db, PRA_EXISTING_OFFLINE_SETTINGS_COLLECTION, PRA_EXISTING_OFFLINE_SETTINGS_DOC),
        {
          globalEnabled: nextEnabled,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setOfflineSettings({ globalEnabled: nextEnabled });
      alert(`Mode offline pra-existing ${nextEnabled ? "diaktifkan" : "dinonaktifkan"} untuk seluruh sistem.`);
    } catch (error) {
      console.error("Error updating global offline settings:", error);
      alert("Gagal menyimpan pengaturan offline global.");
    } finally {
      setSavingOfflineSettings(false);
    }
  };

  const handleToggleTaskOffline = async (task: Task, nextEnabled: boolean) => {
    try {
      setSavingTaskOfflineId(task.id);
      const response = await fetch(`/api/admin/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        offlineEnabled: nextEnabled,
        offlineUpdatedAt: new Date().toISOString(),
        }),
      });
      if (!response.ok) {
        throw new Error("Gagal memperbarui mode offline tugas di Supabase.");
      }

      setTasks((previous) =>
        previous.map((item) => (item.id === task.id ? { ...item, offlineEnabled: nextEnabled } : item))
      );
      setSelectedTaskDetail((previous) =>
        previous?.id === task.id ? { ...previous, offlineEnabled: nextEnabled } : previous
      );
      alert(`Mode offline untuk tugas "${task.title}" ${nextEnabled ? "diaktifkan" : "dinonaktifkan"}.`);
    } catch (error) {
      console.error("Error updating task offline settings:", error);
      alert("Gagal memperbarui pengaturan offline tugas.");
    } finally {
      setSavingTaskOfflineId(null);
    }
  };

  const loadDetailKmzFiles = async (task: Task) => {
    console.log("=== Loading Detail KMZ Files ===");
    console.log("Task:", task.title, "Type:", task.type);
    console.log("KMZ URLs:", task.kmzFileUrl, task.kmzFileUrl2);
    
    setLoadingDetailKmz(true);
    setDetailKmzFile(null);
    setDetailKmzFile2(null);
    
    try {
      const loadSingleKMZ = async (url: string, filename: string) => {
        console.log(`[LOADING] ${filename}`);
        console.log(`[URL] URL:`, url);
        
        try {
          // Use Next.js API route as proxy to bypass CORS
          const proxyUrl = `/api/proxy-kmz?url=${encodeURIComponent(url)}`;
          console.log("[PROXY] Fetching via proxy:", proxyUrl);
          
          const response = await fetch(proxyUrl);
          
          if (!response.ok) {
            // Fallback: try direct URL
            console.warn("[WARN] Proxy failed, trying direct URL...");
            const directResponse = await fetch(url);
            
            if (!directResponse.ok) {
              throw new Error(`HTTP ${directResponse.status}: ${directResponse.statusText}`);
            }
            
            const blob = await directResponse.blob();
            const file = new File([blob], filename, { type: "application/vnd.google-earth.kmz" });
            console.log(`✅ ${filename} loaded via direct URL, size:`, blob.size, "bytes");
            return file;
          }
          
          console.log("[CONVERT] Converting to blob...");
          const blob = await response.blob();
          console.log("[SIZE] Blob size:", blob.size, "bytes");
          
          const file = new File([blob], filename, { type: "application/vnd.google-earth.kmz" });
          console.log(`[SUCCESS] ${filename} loaded successfully`);
          
          return file;
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
      
      console.log("[COMPLETE] Loading complete");
    } catch (error) {
      console.error("[ERROR] Error in loadDetailKmzFiles:", error);
    } finally {
      setLoadingDetailKmz(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "pending": return { text: "Menunggu", class: "bg-yellow-100 text-yellow-700 border-yellow-200" };
      case "in-progress": return { text: "Sedang Berjalan", class: "bg-blue-100 text-blue-700 border-blue-200" };
      case "completed": return { text: "Selesai", class: "bg-green-100 text-green-700 border-green-200" };
      default: return { text: status, class: "bg-gray-100 text-gray-700 border-gray-200" };
    }
  };

  const formatCreatedAt = (value: Task["createdAt"], options?: Intl.DateTimeFormatOptions) => {
    if (!value) return "N/A";

    let date: Date | null = null;
    if (typeof value === "object" && value !== null && "toDate" in value && typeof value.toDate === "function") {
      date = value.toDate();
    } else if (value instanceof Date) {
      date = value;
    } else if (typeof value === "string" || typeof value === "number") {
      date = new Date(value);
    }

    if (!date || Number.isNaN(date.getTime())) {
      return "N/A";
    }

    return date.toLocaleDateString("id-ID", options);
  };

  const getTypeLabel = (type: string) => {
    switch(type) {
      case "propose": return { text: "Survey Propose", icon: "🆕", color: "text-green-600" };
      case "existing": return { text: "Survey Existing", icon: "📍", color: "text-blue-600" };
      case "propose-existing": return { text: "Propose & Existing", icon: "🔄", color: "text-purple-600" };
      default: return { text: type, icon: "📋", color: "text-gray-600" };
    }
  };

  const getOfflineBadge = (task: Task) => {
    if (task.type !== "pra-existing") {
      return {
        text: "Tidak dipakai",
        className: "bg-slate-100 text-slate-600 border-slate-200",
      };
    }

    if (!offlineSettings.globalEnabled) {
      return {
        text: "Global off",
        className: "bg-rose-50 text-rose-700 border-rose-200",
      };
    }

    if (task.offlineEnabled === false) {
      return {
        text: "Per tugas off",
        className: "bg-amber-50 text-amber-700 border-amber-200",
      };
    }

    return {
      text: "Aktif",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const matchesFilter = selectedTaskFilter === "all" || task.status === selectedTaskFilter;
    const normalizedSearch = activeSearchQuery.toLowerCase();
    const matchesSearch = !normalizedSearch ||
                         task.title.toLowerCase().includes(normalizedSearch) ||
                         task.surveyorName.toLowerCase().includes(normalizedSearch) ||
                         task.surveyorEmail.toLowerCase().includes(normalizedSearch) ||
                         task.description.toLowerCase().includes(normalizedSearch);
    return matchesFilter && matchesSearch;
  });

  // Calculate stats
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === "pending").length,
    inProgress: tasks.filter(t => t.status === "in-progress").length,
    completed: tasks.filter(t => t.status === "completed").length,
  };

  const handleSearchSubmit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const nextSearch = searchInput.trim();
    if (isSuperAdmin && !hasRequestedTaskLoad) {
      setHasRequestedTaskLoad(true);
    }
    if (nextSearch === activeSearchQuery) {
      void fetchTasks(true, nextSearch);
      return;
    }
    setActiveSearchQuery(nextSearch);
  };

  const handleResetSearch = () => {
    setSearchInput("");
    if (isSuperAdmin) {
      setActiveSearchQuery("");
      setHasRequestedTaskLoad(false);
      setTasks([]);
      setLoadingTasks(false);
      return;
    }
    if (!activeSearchQuery) {
      void fetchTasks(true, "");
      return;
    }
    setActiveSearchQuery("");
  };

  const shouldShowSuperAdminEmptyState = isSuperAdmin && !hasRequestedTaskLoad;

  return (
    <>
      {/* Main Content */}
      <div className="min-h-screen bg-gray-50">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-8 py-8 shadow-xl">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">Manajemen Tugas Survey</h1>
                <p className="text-blue-100">Pantau dan kelola distribusi tugas untuk tim surveyor</p>
                {isSuperAdmin ? (
                  <p className="mt-2 text-xs font-medium text-blue-100/90">
                    Mode super admin aktif: data seluruh sistem baru dimuat saat Anda memberi perintah.
                  </p>
                ) : null}
              </div>
              <button 
                onClick={() => {
                  if (isSuperAdmin && !hasRequestedTaskLoad) {
                    setHasRequestedTaskLoad(true);
                    return;
                  }
                  void fetchTasks(true);
                }}
                className="flex items-center gap-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-5 py-3 rounded-xl font-semibold transition-all backdrop-blur-sm border border-white border-opacity-30"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isSuperAdmin && !hasRequestedTaskLoad ? "Muat Tugas" : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="max-w-7xl mx-auto px-8 -mt-6 mb-8">
          {shouldShowSuperAdminEmptyState ? (
            <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-lg">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Mode Manual Super Admin</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Statistik dan daftar tugas belum dimuat. Gunakan `Cari` untuk pencarian tertentu atau `Muat Tugas` jika ingin menampilkan seluruh tugas sistem.
                  </p>
                </div>
                <div className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  Menunggu perintah
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <span className="text-3xl font-bold text-gray-900">{stats.total}</span>
                </div>
                <p className="text-sm font-medium text-gray-600">Total Tugas</p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-3xl font-bold text-gray-900">{stats.pending}</span>
                </div>
                <p className="text-sm font-medium text-gray-600">Sedang Berjalan</p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-3xl font-bold text-gray-900">{stats.completed}</span>
                </div>
                <p className="text-sm font-medium text-gray-600">Selesai</p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-3xl font-bold text-gray-900">{stats.inProgress}</span>
                </div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
              </div>
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-lg">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-base font-semibold text-gray-900">Kontrol Offline Pra Existing</p>
                <p className="mt-1 text-sm text-gray-500">
                  Toggle global ini menjadi izin utama. Jika global mati, semua tugas pra-existing tetap online-only walaupun per tugas diaktifkan.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${offlineSettings.globalEnabled ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {loadingOfflineSettings ? "Memuat pengaturan..." : offlineSettings.globalEnabled ? "Global aktif" : "Global nonaktif"}
                </span>
                <button
                  onClick={() => void handleSaveGlobalOfflineSettings(!offlineSettings.globalEnabled)}
                  disabled={loadingOfflineSettings || savingOfflineSettings}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-60 ${offlineSettings.globalEnabled ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
                >
                  {savingOfflineSettings
                    ? "Menyimpan..."
                    : offlineSettings.globalEnabled
                      ? "Nonaktifkan Offline Global"
                      : "Aktifkan Offline Global"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="max-w-7xl mx-auto px-8 mb-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              {/* Search */}
              <form onSubmit={handleSearchSubmit} className="flex-1 w-full md:w-auto">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="relative flex-1">
                    <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder={isSuperAdmin ? "Cari seluruh tugas sistem..." : "Cari tugas atau surveyor..."}
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800"
                    >
                      Cari
                    </button>
                    <button
                      type="button"
                      onClick={handleResetSearch}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                {isSuperAdmin ? (
                  <p className="mt-2 text-xs text-gray-500">
                    Search akan memanggil data hanya saat Anda klik `Cari`, bukan otomatis saat halaman dibuka.
                  </p>
                ) : null}
              </form>

              {/* Filter Status */}
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedTaskFilter("all")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedTaskFilter === "all" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setSelectedTaskFilter("pending")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedTaskFilter === "pending" ? "bg-yellow-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  Menunggu
                </button>
                <button
                  onClick={() => setSelectedTaskFilter("in-progress")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedTaskFilter === "in-progress" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  Berjalan
                </button>
                <button
                  onClick={() => setSelectedTaskFilter("completed")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedTaskFilter === "completed" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  Selesai
                </button>
              </div>

              {/* Add Task Button */}
              <div className="relative">
                <button
                  onClick={() => setShowTaskDropdown(!showTaskDropdown)}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Buat Tugas Baru
                </button>
                {showTaskDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50">
                    <button
                      onClick={() => { setShowProposeModal(true); setShowTaskDropdown(false); }}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-all flex items-center gap-3 text-sm"
                    >
                      <span className="text-2xl">🆕</span>
                      <div>
                        <p className="font-semibold text-gray-900">Survey Propose</p>
                        <p className="text-xs text-gray-500">Area baru untuk pengembangan</p>
                      </div>
                    </button>
                    <button
                      onClick={() => { setShowExistingModal(true); setShowTaskDropdown(false); }}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-all flex items-center gap-3 text-sm"
                    >
                      <span className="text-2xl">📍</span>
                      <div>
                        <p className="font-semibold text-gray-900">Survey Existing</p>
                        <p className="text-xs text-gray-500">Area yang sudah terpasang</p>
                      </div>
                    </button>
                    <button
                      onClick={() => { setShowPraExistingModal(true); setShowTaskDropdown(false); }}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-all flex items-center gap-3 text-sm"
                    >
                      <span className="text-2xl">🧾</span>
                      <div>
                        <p className="font-semibold text-gray-900">Survey Pra Existing</p>
                        <p className="text-xs text-gray-500">Survey pra existing sederhana</p>
                      </div>
                    </button>
                    <button
                      onClick={() => { setShowProposeExistingModal(true); setShowTaskDropdown(false); }}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-all flex items-center gap-3 text-sm"
                    >
                      <span className="text-2xl">🔄</span>
                      <div>
                        <p className="font-semibold text-gray-900">Propose & Existing</p>
                        <p className="text-xs text-gray-500">Gabungan kedua survey</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tasks List */}
        <div className="max-w-7xl mx-auto px-8 pb-8">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Daftar Tugas</h2>
              <p className="text-sm text-gray-500 mt-1">
                {shouldShowSuperAdminEmptyState ? "Belum ada data. Jalankan pencarian atau muat semua tugas." : `${filteredTasks.length} tugas ditemukan`}
              </p>
            </div>

            {loadingTasks ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-500">Memuat data tugas...</p>
                </div>
              </div>
            ) : shouldShowSuperAdminEmptyState ? (
              <div className="flex flex-col items-center justify-center py-20 px-4">
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Pencarian Belum Dijalankan</h3>
                <p className="text-gray-500 text-center max-w-xl">
                  Untuk menjaga halaman tetap ringan, super admin tidak langsung memuat seluruh tugas. Gunakan kolom pencarian atau tombol `Muat Tugas` di atas saat diperlukan.
                </p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-4">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Belum Ada Tugas</h3>
                <p className="text-gray-500 text-center max-w-md">
                  Mulai dengan membuat tugas baru untuk mendistribusikan pekerjaan survey kepada tim Anda.
                </p>
                <button
                  onClick={() => setShowTaskDropdown(true)}
                  className="mt-6 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Buat Tugas Pertama
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredTasks.map((task) => {
                  const typeInfo = getTypeLabel(task.type);
                  const statusInfo = getStatusBadge(task.status);
                  const offlineInfo = getOfflineBadge(task);
                  
                  return (
                    <div key={task.id} className="p-6 hover:bg-gray-50 transition-all">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-gray-900">{task.title}</h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.class}`}>
                              {statusInfo.text}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                          
                          <div className="flex flex-wrap gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{typeInfo.icon}</span>
                              <span className={`font-medium ${typeInfo.color}`}>{typeInfo.text}</span>
                            </div>
                            {task.type === "pra-existing" && (
                              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${offlineInfo.className}`}>
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.556A5.5 5.5 0 0112 6.5a5.5 5.5 0 013.889 10.056M4.929 19.071a10 10 0 0114.142 0M1.5 15.643a15 15 0 0121 0" />
                                </svg>
                                <span>Offline: {offlineInfo.text}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-gray-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span>{task.surveyorName}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>{formatCreatedAt(task.createdAt)}</span>
                            </div>
                            {task.kmzFileUrl && (
                              <div className="flex items-center gap-2 text-purple-600">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                                <span className="font-medium">File KMZ</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {task.status === "completed" && (
                            <button
                              onClick={() => handleReactivateTask(task)}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                              title="Aktifkan kembali"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedTaskDetail(task);
                              setShowDetailModal(true);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Lihat detail"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Hapus tugas"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Tugas Propose */}
      {showProposeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto my-8 relative">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 rounded-t-2xl flex items-center justify-between z-[100] shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Buat Tugas Propose</h3>
                  <p className="text-sm text-blue-100">Survey area baru untuk pengembangan</p>
                </div>
              </div>
              <button
                onClick={() => setShowProposeModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white hover:bg-opacity-20 transition-all"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Judul Tugas */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  Judul Tugas
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Masukkan judul tugas yang jelas dan deskriptif"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-gray-400"
                />
              </div>

              {/* Surveyor */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Surveyor
                  <span className="text-red-500">*</span>
                </label>
                <SurveyorSelectField
                  selectedSurveyor={selectedSurveyor}
                  onSurveyorChange={setSelectedSurveyor}
                  surveyorSearch={surveyorSearch}
                  onSurveyorSearchChange={setSurveyorSearch}
                  loadingPetugas={loadingPetugas}
                  surveyorOptions={getFilteredPetugasOptions("propose")}
                  accentColor="blue"
                />
              </div>

              {/* Deskripsi */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  Deskripsi
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Jelaskan detail tugas, lokasi, dan instruksi khusus untuk surveyor"
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none placeholder:text-gray-400"
                />
              </div>

              {/* Upload File Excel/CSV */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Upload File Excel/CSV
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-all cursor-pointer bg-gray-50">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="excel-upload"
                  />
                  <label htmlFor="excel-upload" className="cursor-pointer">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    {excelFile ? (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900">{excelFile.name}</p>
                        <p className="text-xs text-gray-500">{(excelFile.size / 1024).toFixed(2)} KB</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-900 mb-1">Klik untuk memilih file Excel/CSV</p>
                        <p className="text-xs text-gray-500">Format: .xlsx, .xls, .csv (Maks. 10MB)</p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Upload File KMZ/KML */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Upload File KMZ/KML
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-400 transition-all cursor-pointer bg-gray-50">
                  <input
                    type="file"
                    accept=".kmz,.kml"
                    onChange={(e) => setKmzFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="kmz-upload"
                  />
                  <label htmlFor="kmz-upload" className="cursor-pointer">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                    </div>
                    {kmzFile ? (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900">{kmzFile.name}</p>
                        <p className="text-xs text-gray-500">{(kmzFile.size / 1024).toFixed(2)} KB</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-900 mb-1">Klik untuk memilih file KMZ/KML</p>
                        <p className="text-xs text-gray-500">Format: .kmz, .kml (Maks. 20MB)</p>
                      </>
                    )}
                  </label>
                </div>
                
                {/* Map Preview */}
                {kmzFile && (
                  <div className="mt-4">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Preview Peta
                    </label>
                    <DynamicKMZMapPreview file={kmzFile} height="300px" />
                  </div>
                )}
              </div>

              {/* Info Alert */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-900 mb-1">Penting!</p>
                  <p className="text-xs text-amber-700">
                    File harus di-upload (Excel/CSV atau KMZ/KML) sebelum tugas dapat dibuat. 
                    Pastikan file berisi data koordinat yang valid dan sesuai format.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl border-t border-gray-200 flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                <span className="text-red-500">*</span> Field wajib diisi
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowProposeModal(false);
                    setTaskTitle("");
                    setSelectedSurveyor("");
                    setSurveyorSearch("");
                    setTaskDescription("");
                    setExcelFile(null);
                    setKmzFile(null);
                  }}
                  className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleSubmitTask("propose")}
                  disabled={submitting}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Membuat...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Buat Tugas</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tugas Zona Existing - Similar structure, I'll include the code below to save space */}
      {showExistingModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto my-8 relative">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 rounded-t-2xl flex items-center justify-between z-[100] shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Buat Tugas Zona Existing</h3>
                  <p className="text-sm text-blue-100">Survey area terpasang untuk pemeliharaan</p>
                </div>
              </div>
              <button
                onClick={() => setShowExistingModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white hover:bg-opacity-20 transition-all"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content similar to propose modal but simpler */}
            <div className="p-6 space-y-6">
              {/* Fields similar to propose modal */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  Judul Tugas
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Masukkan judul tugas yang jelas dan deskriptif"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-gray-400"
                />
              </div>

              {/* Surveyor */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Surveyor
                  <span className="text-red-500">*</span>
                </label>
                <SurveyorSelectField
                  selectedSurveyor={selectedSurveyor}
                  onSurveyorChange={setSelectedSurveyor}
                  surveyorSearch={surveyorSearch}
                  onSurveyorSearchChange={setSurveyorSearch}
                  loadingPetugas={loadingPetugas}
                  surveyorOptions={getFilteredPetugasOptions("existing")}
                  accentColor="blue"
                />
              </div>

              {/* Deskripsi */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  Deskripsi
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Jelaskan detail tugas, lokasi, dan instruksi khusus untuk surveyor"
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none placeholder:text-gray-400"
                />
              </div>

              {/* Upload File KMZ/KML */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Upload File KMZ/KML
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-400 transition-all cursor-pointer bg-gray-50">
                  <input
                    type="file"
                    accept=".kmz,.kml"
                    onChange={(e) => setKmzFile2(e.target.files?.[0] || null)}
                    className="hidden"
                    id="kmz-upload-existing"
                  />
                  <label htmlFor="kmz-upload-existing" className="cursor-pointer">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                    </div>
                    {kmzFile2 ? (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900">{kmzFile2.name}</p>
                        <p className="text-xs text-gray-500">{(kmzFile2.size / 1024).toFixed(2)} KB</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-900 mb-1">Klik untuk memilih file KMZ/KML</p>
                        <p className="text-xs text-gray-500">Format: .kmz, .kml (Maks. 20MB)</p>
                      </>
                    )}
                  </label>
                </div>
                
                {/* Map Preview */}
                {kmzFile2 && (
                  <div className="mt-4">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Preview Peta
                    </label>
                    <DynamicKMZMapPreview file={kmzFile2} height="300px" />
                  </div>
                )}
              </div>

              {/* Info Alert */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-900 mb-1">ℹ️ Tugas Zona Existing</p>
                  <p className="text-xs text-blue-700">
                    File KMZ/KML berisi area zona survey yang sudah dilakukan sebelumnya sebagai marker terhadap area yang akan di-survey.
                    Petugas akan menggunakan zona ini untuk memetakan area pekerjaan mereka.
                  </p>
                </div>
              </div>

              {/* Warning Alert */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-900 mb-1">⚠️ File KMZ/KML wajib di-upload</p>
                  <p className="text-xs text-amber-700">
                    File KMZ/KML harus berisi data koordinat zona yang valid sesuai format.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl border-t border-gray-200 flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                <span className="text-red-500">*</span> Field wajib diisi
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowExistingModal(false);
                    setTaskTitle("");
                    setSelectedSurveyor("");
                    setSurveyorSearch("");
                    setTaskDescription("");
                    setKmzFile2(null);
                  }}
                  className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleSubmitTask("existing")}
                  disabled={submitting}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Membuat...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Buat Tugas</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tugas Pra Existing */}
      {showPraExistingModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto my-8 relative">
            <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-5 rounded-t-2xl flex items-center justify-between z-[100] shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Buat Tugas Pra Existing</h3>
                  <p className="text-sm text-emerald-100">Survey pra existing sederhana</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPraExistingModal(false);
                  setTaskOfflineEnabled(offlineSettings.globalEnabled);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white hover:bg-opacity-20 transition-all"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  Judul Tugas
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Masukkan judul tugas yang jelas dan deskriptif"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Surveyor
                  <span className="text-red-500">*</span>
                </label>
                <SurveyorSelectField
                  selectedSurveyor={selectedSurveyor}
                  onSurveyorChange={setSelectedSurveyor}
                  surveyorSearch={surveyorSearch}
                  onSurveyorSearchChange={setSurveyorSearch}
                  loadingPetugas={loadingPetugas}
                  surveyorOptions={getFilteredPetugasOptions("pra-existing")}
                  accentColor="emerald"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  Deskripsi
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Jelaskan detail tugas, lokasi, dan instruksi khusus untuk surveyor"
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none placeholder:text-gray-400"
                />
              </div>

              <div className={`rounded-2xl border p-4 ${offlineSettings.globalEnabled ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Mode Offline Tugas</p>
                    <p className="mt-1 text-xs text-gray-600">
                      Jika aktif, petugas pra-existing boleh menyiapkan paket offline saat mulai tugas. Jika nonaktif, form hanya bisa dipakai saat online.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <input
                      type="checkbox"
                      checked={taskOfflineEnabled}
                      onChange={(e) => setTaskOfflineEnabled(e.target.checked)}
                      disabled={!offlineSettings.globalEnabled}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    {taskOfflineEnabled ? "Aktif" : "Nonaktif"}
                  </label>
                </div>
                {!offlineSettings.globalEnabled ? (
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    Offline global sedang dimatikan. Toggle per tugas akan aktif lagi setelah global dihidupkan.
                  </p>
                ) : null}
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Upload File KMZ/KML
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-emerald-400 transition-all cursor-pointer bg-gray-50">
                  <input
                    type="file"
                    accept=".kmz,.kml"
                    onChange={(e) => setKmzFile2(e.target.files?.[0] || null)}
                    className="hidden"
                    id="kmz-upload-pra-existing"
                  />
                  <label htmlFor="kmz-upload-pra-existing" className="cursor-pointer">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                    </div>
                    {kmzFile2 ? (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900">{kmzFile2.name}</p>
                        <p className="text-xs text-gray-500">{(kmzFile2.size / 1024).toFixed(2)} KB</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-900 mb-1">Klik untuk memilih file KMZ/KML</p>
                        <p className="text-xs text-gray-500">Format: .kmz, .kml (Maks. 20MB)</p>
                      </>
                    )}
                  </label>
                </div>

                {kmzFile2 && (
                  <div className="mt-4">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Preview Peta
                    </label>
                    <DynamicKMZMapPreview file={kmzFile2} height="300px" />
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl border-t border-gray-200 flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                <span className="text-red-500">*</span> Field wajib diisi
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowPraExistingModal(false);
                    setTaskTitle("");
                    setSelectedSurveyor("");
                    setSurveyorSearch("");
                    setTaskDescription("");
                    setTaskOfflineEnabled(offlineSettings.globalEnabled);
                    setKmzFile2(null);
                  }}
                  className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleSubmitTask("pra-existing")}
                  disabled={submitting}
                  className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Membuat...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Buat Tugas</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tugas Propose & Existing */}
      {showProposeExistingModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto my-8 relative">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-5 rounded-t-2xl flex items-center justify-between z-[100] shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Tugas Propose & Existing</h3>
                  <p className="text-sm text-purple-100">Survey kombinasi area baru dan terpasang</p>
                </div>
              </div>
              <button
                onClick={() => setShowProposeExistingModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white hover:bg-opacity-20 transition-all"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Judul Tugas */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  Judul Tugas
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Masukkan judul tugas yang jelas dan deskriptif"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-gray-400"
                />
              </div>

              {/* Surveyor */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Surveyor
                  <span className="text-red-500">*</span>
                </label>
                <SurveyorSelectField
                  selectedSurveyor={selectedSurveyor}
                  onSurveyorChange={setSelectedSurveyor}
                  surveyorSearch={surveyorSearch}
                  onSurveyorSearchChange={setSurveyorSearch}
                  loadingPetugas={loadingPetugas}
                  surveyorOptions={getFilteredPetugasOptions("all")}
                  accentColor="purple"
                />
              </div>

              {/* Deskripsi */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  Deskripsi
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Jelaskan detail tugas, lokasi, dan instruksi khusus untuk surveyor"
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none placeholder:text-gray-400"
                />
              </div>

              {/* Upload File KMZ/KML Existing */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Upload File KMZ/KML Existing
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Area Terpasang</span>
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-400 transition-all cursor-pointer bg-gray-50">
                  <input
                    type="file"
                    accept=".kmz,.kml"
                    onChange={(e) => setKmzFile2(e.target.files?.[0] || null)}
                    className="hidden"
                    id="kmz-upload-existing-2"
                  />
                  <label htmlFor="kmz-upload-existing-2" className="cursor-pointer">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                    </div>
                    {kmzFile2 ? (
                      <div>
                        <p className="text-sm font-medium text-gray-900 mb-1">📁 {kmzFile2.name}</p>
                        <p className="text-xs text-gray-500">{(kmzFile2.size / 1024).toFixed(2)} KB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-gray-900 mb-1">Klik untuk memilih file KMZ/KML Existing</p>
                        <p className="text-xs text-gray-500">Format: .kmz, .kml (Maks. 20MB)</p>
                      </div>
                    )}
                  </label>
                </div>
                
                {/* Map Preview */}
                {kmzFile2 && (
                  <div className="mt-4">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Preview Peta Existing
                    </label>
                    <DynamicKMZMapPreview file={kmzFile2} height="300px" />
                  </div>
                )}
              </div>

              {/* Upload File KMZ/KML Propose */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Upload File KMZ/KML Propose
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Area Baru</span>
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-400 transition-all cursor-pointer bg-gray-50">
                  <input
                    type="file"
                    accept=".kmz,.kml"
                    onChange={(e) => setKmzFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="kmz-upload-propose"
                  />
                  <label htmlFor="kmz-upload-propose" className="cursor-pointer">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                    </div>
                    {kmzFile ? (
                      <div>
                        <p className="text-sm font-medium text-gray-900 mb-1">📁 {kmzFile.name}</p>
                        <p className="text-xs text-gray-500">{(kmzFile.size / 1024).toFixed(2)} KB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-gray-900 mb-1">Klik untuk memilih file KMZ/KML Propose</p>
                        <p className="text-xs text-gray-500">Format: .kmz, .kml (Maks. 20MB)</p>
                      </div>
                    )}
                  </label>
                </div>
                
                {/* Map Preview */}
                {kmzFile && (
                  <div className="mt-4">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Preview Peta Propose
                    </label>
                    <DynamicKMZMapPreview file={kmzFile} height="300px" />
                  </div>
                )}
              </div>

              {/* Info Alert */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex gap-3">
                <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-purple-900 mb-1">ℹ️ Tugas Propose & Existing</p>
                  <p className="text-xs text-purple-700">
                    Upload dua file KMZ/KML: satu untuk area propose (baru) dan satu untuk area existing (terpasang). 
                    Petugas akan melakukan survey di kedua area tersebut dalam satu tugas.
                  </p>
                </div>
              </div>

              {/* Warning Alert */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-900 mb-1">⚠️ Kedua file KMZ/KML wajib di-upload</p>
                  <p className="text-xs text-amber-700">
                    Pastikan kedua file berisi data koordinat yang valid dan sesuai format untuk area propose dan existing.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl border-t border-gray-200 flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                <span className="text-red-500">*</span> Field wajib diisi
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowProposeExistingModal(false);
                    setTaskTitle("");
                    setSelectedSurveyor("");
                    setSurveyorSearch("");
                    setTaskDescription("");
                    setKmzFile(null);
                    setKmzFile2(null);
                  }}
                  className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleSubmitTask("propose-existing")}
                  disabled={submitting}
                  className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Membuat...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Buat Tugas</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Detail Modal */}
      {showDetailModal && selectedTaskDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto my-8">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 rounded-t-2xl flex items-center justify-between z-10 shadow-lg">
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">{selectedTaskDetail.title}</h3>
                <p className="text-sm text-blue-100">Detail Tugas Survey</p>
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedTaskDetail(null);
                  setDetailKmzFile(null);
                  setDetailKmzFile2(null);
                  setTaskProgressSections([]);
                  setTaskProgressError(null);
                }}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white hover:bg-opacity-20 transition-all"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Status Badge */}
              <div className="flex items-center gap-3">
                <span className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 ${getStatusBadge(selectedTaskDetail.status).class}`}>
                  {getStatusBadge(selectedTaskDetail.status).text}
                </span>
                <span className={`px-4 py-2 rounded-xl text-sm font-bold ${getTypeLabel(selectedTaskDetail.type).color} bg-opacity-10`}>
                  {getTypeLabel(selectedTaskDetail.type).icon} {getTypeLabel(selectedTaskDetail.type).text}
                </span>
                {selectedTaskDetail.type === "pra-existing" ? (
                  <span className={`px-4 py-2 rounded-xl text-sm font-semibold border ${getOfflineBadge(selectedTaskDetail).className}`}>
                    Offline: {getOfflineBadge(selectedTaskDetail).text}
                  </span>
                ) : null}
              </div>

              {/* Description */}
              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  Deskripsi Tugas
                </h4>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-200">{selectedTaskDetail.description}</p>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-blue-700 font-medium">Surveyor</p>
                      <p className="text-sm font-bold text-blue-900">{selectedTaskDetail.surveyorName}</p>
                    </div>
                  </div>
                  <p className="text-xs text-blue-700">{selectedTaskDetail.surveyorEmail}</p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-purple-700 font-medium">Tanggal Dibuat</p>
                      <p className="text-sm font-bold text-purple-900">
                        {formatCreatedAt(selectedTaskDetail.createdAt, {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {selectedTaskDetail.type === "pra-existing" ? (
                <div className={`rounded-2xl border p-4 ${offlineSettings.globalEnabled ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">Kontrol Offline Tugas Ini</h4>
                      <p className="mt-1 text-xs text-gray-600">
                        Jika aktif, petugas boleh melanjutkan form pra-existing saat offline setelah tugas dimulai dan paket offline selesai disiapkan.
                      </p>
                      {!offlineSettings.globalEnabled ? (
                        <p className="mt-2 text-xs font-medium text-amber-700">
                          Global offline sedang nonaktif. Toggle per tugas tidak berlaku sampai admin menyalakan global lagi.
                        </p>
                      ) : null}
                    </div>
                    <button
                      onClick={() => void handleToggleTaskOffline(selectedTaskDetail, selectedTaskDetail.offlineEnabled === false)}
                      disabled={savingTaskOfflineId === selectedTaskDetail.id}
                      className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-60 ${selectedTaskDetail.offlineEnabled === false ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"}`}
                    >
                      {savingTaskOfflineId === selectedTaskDetail.id
                        ? "Menyimpan..."
                        : selectedTaskDetail.offlineEnabled === false
                          ? "Aktifkan Offline Tugas"
                          : "Nonaktifkan Offline Tugas"}
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Files Section */}
              {(selectedTaskDetail.kmzFileUrl || selectedTaskDetail.kmzFileUrl2 || selectedTaskDetail.excelFileUrl) && (
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    File Terlampir
                  </h4>
                  <div className="space-y-2">
                    {selectedTaskDetail.kmzFileUrl && (
                      <a
                        href={selectedTaskDetail.kmzFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-purple-50 hover:bg-purple-100 border-2 border-purple-200 rounded-xl transition-all group"
                      >
                        <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-purple-900">File KMZ Propose</p>
                          <p className="text-xs text-purple-600">Klik untuk download</p>
                        </div>
                        <svg className="w-5 h-5 text-purple-600 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </a>
                    )}
                    
                    {selectedTaskDetail.kmzFileUrl2 && (
                      <a
                        href={selectedTaskDetail.kmzFileUrl2}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-xl transition-all group"
                      >
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-blue-900">File KMZ Existing</p>
                          <p className="text-xs text-blue-600">Klik untuk download</p>
                        </div>
                        <svg className="w-5 h-5 text-blue-600 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </a>
                    )}

                    {selectedTaskDetail.excelFileUrl && (
                      <a
                        href={selectedTaskDetail.excelFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-green-50 hover:bg-green-100 border-2 border-green-200 rounded-xl transition-all group"
                      >
                        <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-green-900">File Excel</p>
                          <p className="text-xs text-green-600">Klik untuk download</p>
                        </div>
                        <svg className="w-5 h-5 text-green-600 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* KMZ Map Preview Section */}
              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Preview Peta Lokasi
                </h4>

                {/* Always show map section, with loading or content */}
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
                      {(selectedTaskDetail.type === "existing" || selectedTaskDetail.type === "propose-existing") && (
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
                                <p className="text-blue-500 text-xs">Silakan download file untuk melihat peta</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Map Preview for Propose */}
                      {(selectedTaskDetail.type === "propose" || selectedTaskDetail.type === "propose-existing") && (
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
                                <p className="text-green-500 text-xs">Silakan download file untuk melihat peta</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Progress Tugas di Peta
                </h4>

                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-600">
                    Data progress tidak refresh otomatis lagi. Gunakan refresh manual saat ingin ambil data terbaru.
                  </p>
                  <button
                    onClick={() => void loadTaskProgress(selectedTaskDetail)}
                    disabled={loadingTaskProgress}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {loadingTaskProgress ? "Memuat..." : "Refresh Progress"}
                  </button>
                </div>

                {loadingTaskProgress ? (
                  <div className="flex h-[220px] items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50">
                    <div className="text-center">
                      <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-600" />
                      <p className="text-sm font-medium text-emerald-700">Memuat progress tugas...</p>
                    </div>
                  </div>
                ) : taskProgressError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {taskProgressError}
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Total Titik Input</p>
                        <p className="mt-2 text-3xl font-bold text-blue-900">
                          {taskProgressSections.reduce((total, section) => total + section.totalPoints, 0)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Match Task ID</p>
                        <p className="mt-2 text-3xl font-bold text-emerald-900">
                          {taskProgressSections.reduce((total, section) => total + section.exactMatchCount, 0)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Match Area KMZ</p>
                        <p className="mt-2 text-3xl font-bold text-amber-900">
                          {taskProgressSections.reduce((total, section) => total + section.inferredMatchCount, 0)}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                      Titik dengan <span className="font-semibold text-slate-900">Match Task ID</span> dihitung langsung dari `taskId` di data survey.
                      Titik dengan <span className="font-semibold text-slate-900">Match Area KMZ</span> dipetakan dari koordinat survey yang masuk ke area atau titik tugas pada KMZ.
                    </div>

                    {taskProgressSections.map((section) => (
                      <div key={section.kind} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h5 className="text-sm font-bold text-slate-900">{section.label}</h5>
                            <p className="mt-1 text-xs text-slate-500">
                              Polygon atau titik tugas ditampilkan bersama titik hasil input petugas.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-slate-900 px-3 py-1 font-semibold text-white">
                              {section.totalPoints} titik
                            </span>
                            <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800">
                              {section.exactMatchCount} taskId
                            </span>
                            <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">
                              {section.inferredMatchCount} area KMZ
                            </span>
                          </div>
                        </div>

                        <div className="p-4">
                          {section.kmzFileUrl ? (
                            <DynamicSurveyTaskUnifiedMap
                              latitude={null}
                              longitude={null}
                              accuracy={0}
                              hasGPS={false}
                              kmzFileUrl={section.kmzFileUrl}
                              surveyData={section.markers}
                              markerColor={section.markerColor}
                              markerLabel={section.markerLabel}
                              stableOverlay
                            />
                          ) : (
                            <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                              File KMZ tugas belum tersedia.
                            </div>
                          )}

                          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                            {section.totalPoints > 0
                              ? `Terdeteksi ${section.totalPoints} titik input petugas untuk bagian tugas ini.`
                              : "Belum ada titik input petugas yang cocok untuk bagian tugas ini."}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Task ID */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">ID Tugas</p>
                <p className="text-sm font-mono text-gray-700">{selectedTaskDetail.id}</p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t px-6 py-4 rounded-b-2xl flex gap-3">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedTaskDetail(null);
                  setDetailKmzFile(null);
                  setDetailKmzFile2(null);
                  setTaskProgressSections([]);
                  setTaskProgressError(null);
                }}
                className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
              >
                Tutup
              </button>
              {selectedTaskDetail.status === "completed" && (
                <button
                  onClick={() => void handleReactivateTask(selectedTaskDetail)}
                  className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-all"
                >
                  Aktifkan Lagi
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SurveyorSelectField({
  selectedSurveyor,
  onSurveyorChange,
  surveyorSearch,
  onSurveyorSearchChange,
  loadingPetugas,
  surveyorOptions,
  accentColor,
}: {
  selectedSurveyor: string;
  onSurveyorChange: (value: string) => void;
  surveyorSearch: string;
  onSurveyorSearchChange: (value: string) => void;
  loadingPetugas: boolean;
  surveyorOptions: Petugas[];
  accentColor: "blue" | "emerald" | "purple";
}) {
  const focusClassName =
    accentColor === "emerald"
      ? "focus:ring-2 focus:ring-emerald-500"
      : accentColor === "purple"
        ? "focus:ring-2 focus:ring-purple-500"
        : "focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={surveyorSearch}
          onChange={(e) => onSurveyorSearchChange(e.target.value)}
          placeholder="Cari nama atau email petugas"
          disabled={loadingPetugas}
          className={`w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm text-gray-900 transition-all placeholder:text-gray-400 focus:outline-none ${focusClassName} disabled:cursor-not-allowed disabled:opacity-50`}
        />
      </div>
      <div className="relative">
        <select
          value={selectedSurveyor}
          onChange={(e) => onSurveyorChange(e.target.value)}
          disabled={loadingPetugas}
          className={`w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 transition-all focus:outline-none ${focusClassName} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <option value="">
            {loadingPetugas ? "Memuat data..." : surveyorOptions.length === 0 ? "Tidak ada petugas yang cocok" : "Pilih Surveyor"}
          </option>
          {!loadingPetugas &&
            surveyorOptions.map((petugas) => (
              <option key={petugas.id} value={petugas.id} className="text-gray-900">
                {petugas.name} - {petugas.email}
              </option>
            ))}
        </select>
        <svg className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {!loadingPetugas && surveyorSearch.trim() ? (
        <p className="text-xs text-gray-500">{surveyorOptions.length} petugas cocok dengan pencarian.</p>
      ) : null}
    </div>
  );
}
