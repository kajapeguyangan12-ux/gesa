"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { db, storage } from "@/lib/firebase";
import { setupPolling } from "@/utils/firestoreCache";
import { loadParsedTaskGeometries } from "@/utils/kmzTaskParser";
import { prepareOfflineBasemapForTask } from "@/utils/offlineBasemap";
import {
  addPendingPraExistingSurvey,
  countPendingPraExistingSurveys,
  getOfflineTaskPackage,
  getPendingPraExistingSurveys,
  removePendingPraExistingSurvey,
  saveOfflineTaskPackage,
  updateOfflineTaskBasemapStatus,
  updatePendingPraExistingSurvey,
} from "@/utils/offlinePraExisting";
import type { TaskNavigationInfo } from "@/utils/taskNavigation";
import { analyzeTaskNavigation, type ParsedTaskGeometries } from "@/utils/taskNavigation";
import { KABUPATEN_OPTIONS } from "@/utils/constants";
import { getActiveKabupatenFromStorage, setActiveKabupatenToStorage } from "@/utils/helpers";
import {
  DEFAULT_PRA_EXISTING_OFFLINE_SETTINGS,
  PRA_EXISTING_OFFLINE_SETTINGS_COLLECTION,
  PRA_EXISTING_OFFLINE_SETTINGS_DOC,
  isPraExistingTaskOfflineEnabled,
  type PraExistingOfflineSettings,
} from "@/utils/praExistingOfflineSettings";
import { PRA_EXISTING_TABANAN_DATA } from "./location-data";

type DynamicMapProps = {
  latitude: number | null;
  longitude: number | null;
  accuracy: number;
  hasGPS: boolean;
  kmzFileUrl?: string;
  completedPoints?: string[];
  trackingPath?: Array<{ lat: number; lng: number }>;
  onPointComplete?: (pointId: string, pointName: string, lat: number, lng: number) => void;
  onTaskNavigationInfoChange?: (info: TaskNavigationInfo | null) => void;
};

type UnifiedMapProps = DynamicMapProps & {
  surveyData: SubmittedSurveyItem[];
};

const DynamicUnifiedMap = dynamic<UnifiedMapProps>(() => import("@/components/SurveyPraExistingUnifiedMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] items-center justify-center rounded-2xl border border-blue-200 bg-slate-100 sm:h-[340px] lg:h-[420px]">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
        <p className="text-sm text-slate-500">Memuat peta gabungan...</p>
      </div>
    </div>
  ),
});

interface GPSCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

interface ActiveTask {
  id: string;
  title?: string;
  description?: string;
  type?: string;
  status?: string;
  surveyorId?: string;
  kmzFileUrl?: string;
  kmzFileUrl2?: string;
  offlineEnabled?: boolean;
}

interface FormState {
  kabupaten: string;
  kecamatan: string;
  desa: string;
  banjar: string;
  kepemilikanTiang: string;
  tipeTiangPLN: string;
  jenisTiang: string;
  jenisLampu: string;
  jumlahLampu: string;
  dayaLampu: string;
  fungsiLampu: string;
  garduStatus: string;
  kodeGardu: string;
  keterangan: string;
}

interface SubmittedSurveyItem {
  id: string;
  latitude: number;
  longitude: number;
  kecamatan?: string;
  desa?: string;
  banjar?: string;
  namaJalan?: string;
  kepemilikanTiang?: string;
  surveyorName?: string;
  createdAt?: { toDate?: () => Date } | Date | string | number | null;
  status?: string;
}

const initialFormState: FormState = {
  kabupaten: "",
  kecamatan: "",
  desa: "",
  banjar: "",
  kepemilikanTiang: "",
  tipeTiangPLN: "",
  jenisTiang: "",
  jenisLampu: "",
  jumlahLampu: "",
  dayaLampu: "",
  fungsiLampu: "APJ",
  garduStatus: "",
  kodeGardu: "",
  keterangan: "",
};

declare global {
  interface Window {
    completeTaskPoint?: (pointId: string, pointName: string, lat: number, lng: number) => void;
  }
}

const emptyTaskGeometries: ParsedTaskGeometries = {
  polygons: [],
  polylines: [],
  points: [],
};

function SurveyPraExistingContent() {
  const router = useRouter();
  const { user } = useAuth();

  const [gpsCoords, setGpsCoords] = useState<GPSCoordinates | null>(null);
  const [trackingPath, setTrackingPath] = useState<Array<{ lat: number; lng: number }>>([]);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [isGPSActive, setIsGPSActive] = useState(false);
  const [activeKabupaten, setActiveKabupaten] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<ActiveTask | null>(null);
  const [completedPoints, setCompletedPoints] = useState<string[]>([]);
  const [submittedSurveys, setSubmittedSurveys] = useState<SubmittedSurveyItem[]>([]);
  const [loadingSubmittedSurveys, setLoadingSubmittedSurveys] = useState(false);
  const [showUnifiedMap, setShowUnifiedMap] = useState(false);
  const [showTaskSummary, setShowTaskSummary] = useState(false);
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [taskNavigationInfo, setTaskNavigationInfo] = useState<TaskNavigationInfo | null>(null);
  const [taskGeometries, setTaskGeometries] = useState<ParsedTaskGeometries>(emptyTaskGeometries);
  const [fotoAktual, setFotoAktual] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [checkingTaskAccess, setCheckingTaskAccess] = useState(true);
  const [isTaskEditable, setIsTaskEditable] = useState(false);
  const [taskAccessMessage, setTaskAccessMessage] = useState("Form dikunci sampai ada tugas yang aktif.");
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [offlineBasemapReady, setOfflineBasemapReady] = useState(false);
  const [offlineBasemapMessage, setOfflineBasemapMessage] = useState("Basemap offline belum disiapkan.");
  const [offlineSettings, setOfflineSettings] = useState<PraExistingOfflineSettings>(DEFAULT_PRA_EXISTING_OFFLINE_SETTINGS);
  const [isOfflineAllowed, setIsOfflineAllowed] = useState(false);
  const activeTaskId = activeTask?.id;
  const activeTaskType = activeTask?.type;
  const activeTaskStatus = activeTask?.status;
  const activeTaskSurveyorId = activeTask?.surveyorId;
  const activeTaskOfflineEnabled = activeTask?.offlineEnabled;

  const refreshPendingSyncCount = useCallback(async () => {
    try {
      const count = await countPendingPraExistingSurveys(activeTask?.id);
      setPendingSyncCount(count);
    } catch (error) {
      console.error("Gagal menghitung antrean sinkronisasi:", error);
    }
  }, [activeTask?.id]);

  const resetSurveyForm = useCallback(() => {
    setFormData((previous) => ({
      ...initialFormState,
      kabupaten: previous.kabupaten,
    }));
    setFotoAktual(null);
    setFotoPreview((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return "";
    });
  }, []);

  const uploadSurveyPayloadToServer = useCallback(
    async ({
      payload,
      photoFile,
      createdAtLocal,
      uploadedFromOffline,
    }: {
      payload: Record<string, unknown>;
      photoFile: File;
      createdAtLocal: number;
      uploadedFromOffline: boolean;
    }) => {
      if (!user) {
        throw new Error("User tidak ditemukan. Silakan login ulang.");
      }

      const fileName = `${user.uid}-${createdAtLocal}-${photoFile.name}`;
      const fotoRef = ref(storage, `survey-pra-existing/${fileName}`);
      await uploadBytes(fotoRef, photoFile);
      const fotoAktualUrl = await getDownloadURL(fotoRef);

      await addDoc(collection(db, "survey-pra-existing"), {
        ...payload,
        fotoAktual: fotoAktualUrl,
        uploadedFromOffline,
        offlineCreatedAt: new Date(createdAtLocal).toISOString(),
        createdAt: serverTimestamp(),
      });
    },
    [user]
  );

  const syncPendingSurveys = useCallback(async () => {
    if (!user || !isOnline || isSyncingQueue || !isOfflineAllowed) {
      return;
    }

    try {
      setIsSyncingQueue(true);
      const pendingItems = await getPendingPraExistingSurveys(activeTask?.id);

      for (const item of pendingItems) {
        try {
          await updatePendingPraExistingSurvey(item.id, {
            syncStatus: "syncing",
            attempts: item.attempts + 1,
            lastError: "",
          });

          const file = new File([item.photoBlob], item.photoName, {
            type: item.photoType || "image/jpeg",
          });
          await uploadSurveyPayloadToServer({
            payload: item.payload,
            photoFile: file,
            createdAtLocal: item.createdAtLocal,
            uploadedFromOffline: true,
          });

          await removePendingPraExistingSurvey(item.id);
        } catch (error) {
          console.error("Gagal sinkron survey offline:", error);
          await updatePendingPraExistingSurvey(item.id, {
            syncStatus: "failed",
            lastError: error instanceof Error ? error.message : "Sinkronisasi gagal",
          });
        }
      }
    } finally {
      await refreshPendingSyncCount();
      setIsSyncingQueue(false);
    }
  }, [activeTask?.id, isOfflineAllowed, isOnline, isSyncingQueue, refreshPendingSyncCount, uploadSurveyPayloadToServer, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(window.navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Gagal registrasi service worker:", error);
    });
  }, []);

  useEffect(() => {
    void refreshPendingSyncCount();
  }, [refreshPendingSyncCount]);

  useEffect(() => {
    if (!isOnline) return;
    void syncPendingSurveys();
  }, [isOnline, syncPendingSurveys]);

  useEffect(() => {
    // Use polling instead of onSnapshot to reduce Firestore reads
    const settingsRef = doc(
      db,
      PRA_EXISTING_OFFLINE_SETTINGS_COLLECTION,
      PRA_EXISTING_OFFLINE_SETTINGS_DOC
    );

    const cleanup = setupPolling(
      `pra_existing_settings_${PRA_EXISTING_OFFLINE_SETTINGS_DOC}`,
      async () => {
        const snapshot = await getDoc(settingsRef);
        if (!snapshot.exists()) {
          return DEFAULT_PRA_EXISTING_OFFLINE_SETTINGS;
        }
        const data = snapshot.data() as { globalEnabled?: unknown };
        return {
          globalEnabled:
            typeof data.globalEnabled === "boolean"
              ? data.globalEnabled
              : DEFAULT_PRA_EXISTING_OFFLINE_SETTINGS.globalEnabled,
        };
      },
      (settings) => setOfflineSettings(settings),
      60_000, // 1 minute TTL
      30_000 // poll every 30 seconds
    );

    return cleanup;
  }, []);

  useEffect(() => {
    const storedKabupaten = getActiveKabupatenFromStorage(user?.uid || "") || getActiveKabupatenFromStorage();
    if (storedKabupaten) {
      setActiveKabupaten(storedKabupaten);
      setFormData((previous) => ({ ...previous, kabupaten: storedKabupaten }));
    }
  }, [user?.uid]);

  useEffect(() => {
    if (typeof window === "undefined") {
      setCheckingTaskAccess(false);
      return;
    }

    const storedTask = window.localStorage.getItem("activeTask");
    if (!storedTask) {
      setActiveTask(null);
      setCompletedPoints([]);
      setIsOfflineAllowed(false);
      setIsTaskEditable(false);
      setTaskAccessMessage("Belum ada tugas yang dimulai. Mulai tugas dari daftar tugas agar form bisa diisi.");
      setCheckingTaskAccess(false);
      return;
    }

    try {
      const parsedTask = JSON.parse(storedTask) as ActiveTask;
      setActiveTask(parsedTask);

      const storageKey = `completed_points_${parsedTask.id}`;
      const storedPoints = window.localStorage.getItem(storageKey);
      if (storedPoints) {
        setCompletedPoints(JSON.parse(storedPoints));
      }
    } catch (error) {
      console.error("Gagal membaca tugas aktif:", error);
      window.localStorage.removeItem("activeTask");
      setActiveTask(null);
      setCompletedPoints([]);
      setIsOfflineAllowed(false);
      setIsTaskEditable(false);
      setTaskAccessMessage("Data tugas aktif tidak valid. Buka ulang tugas dari daftar tugas.");
    } finally {
      setCheckingTaskAccess(false);
    }
  }, []);

  useEffect(() => {
    if (!activeTask?.id) {
      return;
    }

    // Use polling instead of onSnapshot to reduce Firestore reads
    const taskRef = doc(db, "tasks", activeTask.id);
    const cleanup = setupPolling(
      `pra_existing_task_${activeTask.id}`,
      async () => {
        const snapshot = await getDoc(taskRef);
        if (!snapshot.exists()) {
          return null;
        }
        return snapshot.data() as ActiveTask | null;
      },
      (taskData) => {
        if (!taskData) {
          window.localStorage.removeItem("activeTask");
          setActiveTask(null);
          setCompletedPoints([]);
          setIsOfflineAllowed(false);
          setIsTaskEditable(false);
          setTaskAccessMessage("Tugas aktif tidak ditemukan. Minta admin membagikan atau aktifkan ulang tugas.");
          return;
        }

        setActiveTask((previous) =>
          previous
            ? {
                ...previous,
                title: typeof taskData.title === "string" ? taskData.title : previous.title,
                description: typeof taskData.description === "string" ? taskData.description : previous.description,
                type: typeof taskData.type === "string" ? taskData.type : previous.type,
                status: typeof taskData.status === "string" ? taskData.status : previous.status,
                surveyorId: typeof taskData.surveyorId === "string" ? taskData.surveyorId : previous.surveyorId,
                kmzFileUrl: typeof taskData.kmzFileUrl === "string" ? taskData.kmzFileUrl : previous.kmzFileUrl,
                kmzFileUrl2: typeof taskData.kmzFileUrl2 === "string" ? taskData.kmzFileUrl2 : previous.kmzFileUrl2,
                offlineEnabled:
                  typeof taskData.offlineEnabled === "boolean" ? taskData.offlineEnabled : previous.offlineEnabled,
              }
            : previous
        );
      },
      120_000, // 2 minute TTL
      60_000 // poll every 60 seconds (less aggressive than settings)
    );

    return cleanup;
  }, [activeTask?.id]);

  useEffect(() => {
    const validateActiveTask = async () => {
      if (!user?.uid) {
        setIsOfflineAllowed(false);
        setIsTaskEditable(false);
        setTaskAccessMessage("User tidak ditemukan. Silakan login ulang.");
        return;
      }

      if (!activeTaskId) {
        setIsOfflineAllowed(false);
        setIsTaskEditable(false);
        setTaskAccessMessage("Belum ada tugas yang dimulai. Mulai tugas dari daftar tugas agar form bisa diisi.");
        return;
      }

      const offlineAllowed = isPraExistingTaskOfflineEnabled(offlineSettings, {
        type: activeTaskType,
        offlineEnabled: activeTaskOfflineEnabled,
      });
      setIsOfflineAllowed(offlineAllowed);

      if (!isOnline) {
        if (!offlineAllowed) {
          setCheckingTaskAccess(false);
          setIsTaskEditable(false);
          setTaskAccessMessage("Mode offline untuk tugas ini dimatikan oleh admin. Form hanya bisa dipakai saat online.");
          setOfflineBasemapReady(false);
          setOfflineBasemapMessage("Mode offline dimatikan admin. Basemap offline tidak disiapkan.");
          return;
        }

        try {
          const offlinePackage = await getOfflineTaskPackage(activeTaskId);
          if (offlinePackage) {
            setIsTaskEditable(true);
            setCheckingTaskAccess(false);
            setTaskAccessMessage("Mode offline aktif. Data survey disimpan lokal dan akan terkirim otomatis saat online.");
            setOfflineBasemapReady(offlinePackage.basemapReady);
            setOfflineBasemapMessage(
              offlinePackage.basemapReady
                ? "Basemap area kerja siap dipakai offline."
                : "Basemap offline belum lengkap. Polygon tugas tetap tersedia."
            );
            return;
          }
        } catch (error) {
          console.error("Gagal membaca paket tugas offline:", error);
        }

        setIsTaskEditable(false);
        setCheckingTaskAccess(false);
        setTaskAccessMessage("Tugas ini belum pernah disiapkan untuk mode offline. Mulai tugas saat online terlebih dahulu.");
        return;
      }

      try {
        setCheckingTaskAccess(true);
        const taskSnap = await getDoc(doc(db, "tasks", activeTaskId));

        if (!taskSnap.exists()) {
          window.localStorage.removeItem("activeTask");
          setActiveTask(null);
          setCompletedPoints([]);
          setIsOfflineAllowed(false);
          setIsTaskEditable(false);
          setTaskAccessMessage("Tugas aktif tidak ditemukan. Minta admin membagikan atau aktifkan ulang tugas.");
          return;
        }

        const taskData = taskSnap.data() as ActiveTask;
        const belongsToUser = taskData.surveyorId === user.uid;
        const canEdit = belongsToUser && taskData.type === "pra-existing" && taskData.status === "in-progress";

        if (canEdit) {
          setIsTaskEditable(true);
          setTaskAccessMessage(
            offlineAllowed
              ? "Tugas aktif ditemukan. Form bisa diisi dan mode offline diizinkan."
              : "Tugas aktif ditemukan. Form bisa diisi saat online, tetapi mode offline dimatikan admin."
          );
          if (!offlineAllowed) {
            setOfflineBasemapReady(false);
            setOfflineBasemapMessage("Mode offline dimatikan admin. Basemap offline tidak disiapkan.");
          }
          return;
        }

        if (!belongsToUser) {
          window.localStorage.removeItem("activeTask");
          setActiveTask(null);
          setCompletedPoints([]);
          setIsOfflineAllowed(false);
          setIsTaskEditable(false);
          setTaskAccessMessage("Tugas aktif ini bukan milik akun Anda.");
          return;
        }

        if (taskData.status === "completed") {
          window.localStorage.removeItem("activeTask");
          setActiveTask(null);
          setCompletedPoints([]);
          setIsOfflineAllowed(false);
          setIsTaskEditable(false);
          setTaskAccessMessage("Tugas ini sudah selesai. Admin harus mengaktifkan ulang tugas jika survey perlu dilanjutkan.");
          return;
        }

        setIsTaskEditable(false);
        setTaskAccessMessage("Tugas belum aktif. Mulai tugas dari daftar tugas agar form bisa diisi.");
      } catch (error) {
        console.error("Gagal memvalidasi tugas aktif:", error);
        setIsOfflineAllowed(false);
        setIsTaskEditable(false);
        setTaskAccessMessage("Gagal memeriksa status tugas. Coba buka ulang tugas dari daftar tugas.");
      } finally {
        setCheckingTaskAccess(false);
      }
    };

    void validateActiveTask();
  }, [activeTaskId, activeTaskOfflineEnabled, activeTaskStatus, activeTaskSurveyorId, activeTaskType, isOnline, offlineSettings, user?.uid]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      return;
    }

    setIsGPSActive(true);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };

        setGpsCoords(nextCoords);
        if (trackingEnabled) {
          setTrackingPath((previous) => {
            const nextPoint = { lat: nextCoords.latitude, lng: nextCoords.longitude };
            if (previous.length === 0) {
              return [nextPoint];
            }

            const lastPoint = previous[previous.length - 1];
            const moved = getDistanceMeters(lastPoint.lat, lastPoint.lng, nextPoint.lat, nextPoint.lng);
            if (moved < 5) {
              return previous;
            }

            return [...previous, nextPoint];
          });
        }
      },
      (error) => {
        console.error("GPS error:", error);
        if (error.code === 1) {
          setIsGPSActive(false);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 10000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [trackingEnabled]);

  useEffect(() => {
    const loadSubmittedSurveys = async () => {
      if (!user?.uid) {
        setSubmittedSurveys([]);
        return;
      }

      try {
        setLoadingSubmittedSurveys(true);
        const surveysRef = collection(db, "survey-pra-existing");
        const q = query(surveysRef, where("surveyorUid", "==", user.uid));
        const snapshot = await getDocs(q);
        const selectedKabupaten = formData.kabupaten || activeKabupaten;
        const rawRows = snapshot.docs.map((entry) => ({ id: entry.id, ...(entry.data() as Record<string, unknown>) })) as Array<Record<string, unknown> & { id: string }>;
        const rows = rawRows
          .filter((item) => !selectedKabupaten || item.kabupaten === selectedKabupaten)
          .map((item) => ({
            id: String(item.id),
            latitude: Number(item.latitude || 0),
            longitude: Number(item.longitude || 0),
            kecamatan: typeof item.kecamatan === "string" ? item.kecamatan : "",
            desa: typeof item.desa === "string" ? item.desa : "",
            banjar: typeof item.banjar === "string" ? item.banjar : "",
            kepemilikanTiang: typeof item.keteranganTiang === "string" ? item.keteranganTiang : typeof item.kepemilikanDisplay === "string" ? item.kepemilikanDisplay : typeof item.kepemilikanTiang === "string" ? item.kepemilikanTiang : "",
            surveyorName: typeof item.surveyorName === "string" ? item.surveyorName : "",
            createdAt: item.createdAt as SubmittedSurveyItem["createdAt"],
            status: typeof item.status === "string" ? item.status : "",
          }))
          .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude) && item.latitude !== 0 && item.longitude !== 0);

        setSubmittedSurveys(rows);
      } catch (error) {
        console.error("Gagal memuat survey pra-existing:", error);
      } finally {
        setLoadingSubmittedSurveys(false);
      }
    };

    loadSubmittedSurveys();
  }, [user?.uid, formData.kabupaten, activeKabupaten]);

  const handleCompletePoint = useCallback(
    (pointId: string, pointName: string, lat: number, lng: number) => {
      setCompletedPoints((previous) => {
        if (previous.includes(pointId)) {
          return previous;
        }

        const confirmed = window.confirm(`Tandai titik "${pointName}" sebagai selesai?\nKoordinat: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        if (!confirmed) {
          return previous;
        }

        const next = [...previous, pointId];
        if (activeTask?.id) {
          window.localStorage.setItem(`completed_points_${activeTask.id}`, JSON.stringify(next));
        }

        return next;
      });
    },
    [activeTask?.id]
  );

  useEffect(() => {
    window.completeTaskPoint = handleCompletePoint;
    return () => {
      delete window.completeTaskPoint;
    };
  }, [handleCompletePoint]);

  const handleInputChange = (field: keyof FormState, value: string) => {
    setFormData((previous) => {
      const next = { ...previous, [field]: value };

      if (field === "kabupaten") {
        next.kecamatan = "";
        next.desa = "";
        next.banjar = "";
        setActiveKabupaten(value || null);
        setActiveKabupatenToStorage(user?.uid || "", value);
      }

      if (field === "kecamatan") {
        next.desa = "";
        next.banjar = "";
      }

      if (field === "desa") {
        next.banjar = "";
      }

      if (field === "kepemilikanTiang" && value !== "PLN") {
        next.tipeTiangPLN = "";
      }

      if (field === "garduStatus" && value !== "Ada") {
        next.kodeGardu = "";
      }

      return next;
    });
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setFotoAktual(file);

    if (!file) {
      setFotoPreview((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous);
        }
        return "";
      });
      return;
    }

    const previewFile = gpsCoords ? await createGeoStampedImage(file, gpsCoords) : file;
    const url = URL.createObjectURL(previewFile);
    setFotoPreview((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return url;
    });
  };

  useEffect(() => {
    return () => {
      if (fotoPreview) {
        URL.revokeObjectURL(fotoPreview);
      }
    };
  }, [fotoPreview]);

  const taskPolygonUrl = useMemo(() => activeTask?.kmzFileUrl || activeTask?.kmzFileUrl2, [activeTask]);
  const selectedKabupatenOption = useMemo(() => KABUPATEN_OPTIONS.find((item) => item.id === formData.kabupaten), [formData.kabupaten]);
  const districtOptions = useMemo(() => (formData.kabupaten === "tabanan" ? Object.keys(PRA_EXISTING_TABANAN_DATA) : []), [formData.kabupaten]);
  const desaOptions = useMemo(() => (formData.kecamatan ? Object.keys(PRA_EXISTING_TABANAN_DATA[formData.kecamatan] || {}) : []), [formData.kecamatan]);
  const banjarOptions = useMemo(() => (formData.kecamatan && formData.desa ? PRA_EXISTING_TABANAN_DATA[formData.kecamatan]?.[formData.desa] || [] : []), [formData.kecamatan, formData.desa]);
  const isOutsideAssignedPolygon = taskNavigationInfo?.geometryType === "polygon" && taskNavigationInfo.isInsidePolygon === false;
  const nearestTaskCoordinateLabel = taskNavigationInfo?.nearestCoordinate
    ? `${taskNavigationInfo.nearestCoordinate.lat.toFixed(6)}, ${taskNavigationInfo.nearestCoordinate.lng.toFixed(6)}`
    : "-";
  const distanceToTaskLabel =
    taskNavigationInfo?.distanceToTargetMeters !== null && taskNavigationInfo?.distanceToTargetMeters !== undefined
      ? taskNavigationInfo.distanceToTargetMeters < 1000
        ? `${Math.round(taskNavigationInfo.distanceToTargetMeters)} m`
        : `${(taskNavigationInfo.distanceToTargetMeters / 1000).toFixed(2)} km`
      : "-";
  const taskStatusMessage = !taskPolygonUrl
    ? "Belum ada polygon atau titik tugas dari admin."
    : !gpsCoords
      ? "Menunggu posisi GPS untuk membaca status area tugas."
      : !taskNavigationInfo?.hasTaskGeometry
        ? "Data KMZ belum terbaca sebagai polygon atau titik tugas."
        : taskNavigationInfo.geometryType === "polygon"
          ? taskNavigationInfo.isInsidePolygon
            ? "Anda sudah berada di dalam polygon tugas."
            : "Anda masih di luar polygon tugas."
          : taskNavigationInfo.geometryType === "polyline"
            ? "Tugas terbaca sebagai rute atau garis. Sistem mengarahkan ke titik terdekat pada garis."
            : "Tugas terbaca sebagai titik. Sistem mengarahkan ke titik tugas terdekat.";
  const googleMapsUrl = useMemo(() => {
    if (!taskNavigationInfo?.nearestCoordinate) {
      return "";
    }

    const destination = `${taskNavigationInfo.nearestCoordinate.lat},${taskNavigationInfo.nearestCoordinate.lng}`;
    const origin = gpsCoords ? `${gpsCoords.latitude},${gpsCoords.longitude}` : "";

    if (origin) {
      return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
    }

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
  }, [gpsCoords, taskNavigationInfo]);
  const gpsStatusLabel = !isGPSActive ? "GPS belum aktif" : gpsCoords ? `Akurasi +/-${gpsCoords.accuracy.toFixed(1)} m` : "Mencari posisi GPS";
  const currentGeoStamp = gpsCoords ? `Lat ${gpsCoords.latitude.toFixed(6)} | Lng ${gpsCoords.longitude.toFixed(6)} | ${new Date(gpsCoords.timestamp).toLocaleString("id-ID")}` : "Geostamp akan muncul setelah GPS terbaca";
  const isFormLocked = checkingTaskAccess || !isTaskEditable;
  const syncStatusLabel = isSyncingQueue ? "Menyinkronkan..." : pendingSyncCount > 0 ? `${pendingSyncCount} antrean` : "Sinkron";
  const basemapStatusLabel = !isOfflineAllowed ? "Offline dimatikan" : offlineBasemapReady ? "Peta offline siap" : "Peta offline belum siap";
  const compactOfflineInfo = isOnline
    ? !isOfflineAllowed
      ? "Mode offline dimatikan admin. Form hanya mengikuti koneksi online."
      : pendingSyncCount > 0
      ? `${pendingSyncCount} data akan dikirim otomatis.`
      : offlineBasemapReady
        ? "Siap kerja online/offline untuk area tugas."
        : "Paket tugas aktif. Peta offline sedang disiapkan."
    : !isOfflineAllowed
      ? "Mode offline dimatikan admin. Form tidak bisa dipakai tanpa koneksi."
      : pendingSyncCount > 0
      ? `${pendingSyncCount} data tersimpan lokal dan menunggu sinyal.`
      : "Mode offline aktif untuk tugas yang sudah dimulai.";

  useEffect(() => {
    let cancelled = false;

    const loadTaskGeometries = async () => {
      if (activeTask?.id) {
        try {
          const offlinePackage = await getOfflineTaskPackage(activeTask.id);
          if (offlinePackage && !cancelled) {
            setTaskGeometries(offlinePackage.geometries);
            setOfflineBasemapReady(offlinePackage.basemapReady);
            setOfflineBasemapMessage(
              offlinePackage.basemapReady
                ? "Basemap area kerja siap dipakai offline."
                : "Basemap offline belum lengkap. Polygon tugas tetap tersedia."
            );
          }
        } catch (error) {
          console.error("Gagal membaca geometri tugas offline:", error);
        }
      }

      if (!taskPolygonUrl) {
        setTaskGeometries(emptyTaskGeometries);
        return;
      }

      if (!isOnline) {
        return;
      }

      try {
        const geometries = await loadParsedTaskGeometries(taskPolygonUrl);
        if (!cancelled) {
          setTaskGeometries(geometries);
          if (activeTask?.id) {
            const existingPackage = await getOfflineTaskPackage(activeTask.id);
            await saveOfflineTaskPackage({
              taskId: activeTask.id,
              task: activeTask,
              geometries,
              savedAt: Date.now(),
              basemapReady: existingPackage?.basemapReady ?? false,
              basemapPreparedAt: existingPackage?.basemapPreparedAt ?? null,
              offlineAllowed: isOfflineAllowed,
              globalOfflineEnabled: offlineSettings.globalEnabled,
            });
          }
        }
      } catch (error) {
        console.error("Gagal memuat geometri tugas pra-existing:", error);
        if (!cancelled) {
          setTaskGeometries(emptyTaskGeometries);
        }
      }
    };

    void loadTaskGeometries();

    return () => {
      cancelled = true;
    };
  }, [activeTask, isOfflineAllowed, isOnline, offlineSettings.globalEnabled, taskPolygonUrl]);

  useEffect(() => {
    const prepareOfflinePackage = async () => {
      if (!activeTask?.id || !isOnline || !isOfflineAllowed) {
        return;
      }

      const hasGeometry =
        taskGeometries.polygons.length > 0 || taskGeometries.polylines.length > 0 || taskGeometries.points.length > 0;
      if (!hasGeometry) {
        return;
      }

      try {
        setOfflineBasemapMessage("Menyiapkan paket offline area kerja...");
        const existingPackage = await getOfflineTaskPackage(activeTask.id);
        await saveOfflineTaskPackage({
          taskId: activeTask.id,
          task: activeTask,
          geometries: taskGeometries,
          savedAt: Date.now(),
          basemapReady: existingPackage?.basemapReady ?? false,
          basemapPreparedAt: existingPackage?.basemapPreparedAt ?? null,
          offlineAllowed: true,
          globalOfflineEnabled: offlineSettings.globalEnabled,
        });

        const result = await prepareOfflineBasemapForTask(taskGeometries);
        if (result.prepared) {
          await updateOfflineTaskBasemapStatus(activeTask.id, true);
          setOfflineBasemapReady(true);
          setOfflineBasemapMessage(`Basemap offline siap untuk area kerja (${result.tileCount} tile).`);
        } else {
          setOfflineBasemapReady(false);
          setOfflineBasemapMessage("Basemap offline belum tersedia. Polygon tugas tetap bisa dipakai.");
        }
      } catch (error) {
        console.error("Gagal menyiapkan basemap offline:", error);
        setOfflineBasemapReady(false);
        setOfflineBasemapMessage("Gagal menyiapkan basemap offline. Coba lagi saat sinyal stabil.");
      }
    };

    void prepareOfflinePackage();
  }, [activeTask, isOfflineAllowed, isOnline, offlineSettings.globalEnabled, taskGeometries]);

  useEffect(() => {
    if (isOfflineAllowed) {
      return;
    }

    setOfflineBasemapReady(false);
    setOfflineBasemapMessage("Mode offline dimatikan admin. Basemap offline tidak disiapkan.");
  }, [isOfflineAllowed]);

  useEffect(() => {
    if (!gpsCoords) {
      setTaskNavigationInfo(null);
      return;
    }

    const info = analyzeTaskNavigation(
      {
        lat: gpsCoords.latitude,
        lng: gpsCoords.longitude,
      },
      taskGeometries
    );

    setTaskNavigationInfo(info);
  }, [gpsCoords, taskGeometries]);

  const connectivityLabel = isOnline ? "Online" : "Offline";
  const connectivityClassName = isOnline ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) return alert("User tidak ditemukan. Silakan login ulang.");
    if (isFormLocked) return alert(taskAccessMessage);
    if (!activeTask?.id) return alert("Tugas aktif tidak ditemukan. Buka dari daftar tugas terlebih dahulu.");
    if (!gpsCoords) return alert("GPS belum siap. Tunggu sampai posisi terbaca.");
    if (!formData.kabupaten) return alert("Kabupaten wajib dipilih agar data masuk ke wilayah yang benar.");
    if (!formData.kecamatan || !formData.desa || !formData.banjar.trim()) return alert("Kecamatan, desa, dan banjar wajib diisi.");
    if (!formData.kepemilikanTiang || !formData.jenisTiang || !formData.jenisLampu || !formData.jumlahLampu || !formData.fungsiLampu) return alert("Lengkapi semua field wajib pada form pra-existing.");
    if (formData.kepemilikanTiang === "PLN" && !formData.tipeTiangPLN) return alert("Tipe Tiang PLN wajib dipilih jika kepemilikan PLN.");
    if (!fotoAktual) return alert("Foto titik aktual wajib diunggah.");
    if (isOutsideAssignedPolygon) {
      const warningMessage = `Posisi GPS saat ini masih di luar polygon tugas.\nJarak ke tepi area sekitar ${distanceToTaskLabel}.\nKoordinat tepi terdekat: ${nearestTaskCoordinateLabel}.\n\nAkurasi GPS saat ini ${gpsCoords.accuracy.toFixed(1)} meter, jadi tetap cek kondisi lapangan.\n\nLanjut simpan survey?`;
      const confirmed = window.confirm(warningMessage);
      if (!confirmed) {
        return;
      }
    }

    try {
      setSaving(true);
      const stampedFile = await createGeoStampedImage(fotoAktual, gpsCoords);

      const kepemilikanDisplay = formData.kepemilikanTiang === "PLN" && formData.tipeTiangPLN ? `PLN - ${formData.tipeTiangPLN}` : formData.kepemilikanTiang;
      const createdAtLocal = Date.now();
      const payload = {
        ...formData,
        lokasiLengkap: [selectedKabupatenOption?.name, formData.kecamatan, formData.desa, formData.banjar].filter(Boolean).join(" - "),
        kabupaten: formData.kabupaten,
        kabupatenName: selectedKabupatenOption?.name || "",
        keteranganTiang: kepemilikanDisplay,
        kepemilikanDisplay,
        latitude: gpsCoords.latitude,
        longitude: gpsCoords.longitude,
        accuracy: gpsCoords.accuracy,
        trackingPath,
        geostamp: {
          latitude: gpsCoords.latitude,
          longitude: gpsCoords.longitude,
          accuracy: gpsCoords.accuracy,
          capturedAt: new Date(gpsCoords.timestamp).toISOString(),
        },
        type: "pra-existing",
        status: "menunggu",
        taskId: activeTask.id,
        taskTitle: activeTask.title || "",
        kmzFileUrl: taskPolygonUrl || "",
        completedPoints,
        surveyorUid: user.uid,
        surveyorEmail: user.email || "",
        surveyorName: user.displayName || user.email || "Unknown",
        title: `Survey Pra Existing - ${formData.desa} - ${formData.banjar}`,
        submittedAtLocal: new Date(createdAtLocal).toISOString(),
      };

      if (!isOfflineAllowed) {
        if (!isOnline) {
          throw new Error("Mode offline dimatikan admin. Sambungkan internet untuk mengirim survey.");
        }

        await uploadSurveyPayloadToServer({
          payload,
          photoFile: stampedFile,
          createdAtLocal,
          uploadedFromOffline: false,
        });
        alert("Survey pra-existing berhasil dikirim.");
        resetSurveyForm();
        router.push(`/tugas-survey-pra-existing?taskId=${encodeURIComponent(activeTask.id)}`);
        return;
      }

      const queueId = `${user.uid}-${createdAtLocal}-${Math.random().toString(36).slice(2, 8)}`;
      await addPendingPraExistingSurvey({
        id: queueId,
        taskId: activeTask.id,
        createdAtLocal,
        photoBlob: stampedFile,
        photoName: stampedFile.name,
        photoType: stampedFile.type,
        syncStatus: "pending",
        attempts: 0,
        payload,
      });

      await refreshPendingSyncCount();

      if (isOnline) {
        await syncPendingSurveys();
        alert("Survey pra-existing berhasil disimpan dan dikirim.");
        resetSurveyForm();
        router.push(`/tugas-survey-pra-existing?taskId=${encodeURIComponent(activeTask.id)}`);
      } else {
        alert("Survey disimpan ke perangkat. Data akan terkirim otomatis saat koneksi kembali.");
        resetSurveyForm();
      }
    } catch (error) {
      console.error("Gagal menyimpan survey pra-existing:", error);
      alert(error instanceof Error ? error.message : "Gagal menyimpan survey. Silakan coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => router.push("/tugas-survey-pra-existing")} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Survey Pra Existing</h1>
                <p className="text-sm text-slate-500">Form pra-existing dengan peta hasil survey, tracking, dan polygon tugas.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className={`rounded-full px-3 py-1 text-xs font-medium ${connectivityClassName}`}>{connectivityLabel}</div>
              {isOfflineAllowed ? (
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{syncStatusLabel}</div>
              ) : null}
              <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">{gpsStatusLabel}</div>
            </div>
          </div>
        </header>

        <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Ringkasan Tugas</p>
                  <p className="text-[11px] text-slate-500">Bisa dibuka jika perlu melihat judul dan detail tugas.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTaskSummary((previous) => !previous)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  {showTaskSummary ? "Sembunyikan" : "Lihat Tugas"}
                </button>
              </div>
              {showTaskSummary ? (
                <div className="mt-3">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{activeTask?.title || "Belum ada tugas aktif"}</p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{activeTask?.description || "Buka dari daftar tugas agar area kerja tampil."}</p>
                    </div>
                    <div className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{activeTask?.status || "draft"}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 sm:grid-cols-4">
                    <StatCard label="Kabupaten" value={selectedKabupatenOption?.name || "-"} />
                    <StatCard label="Polygon KMZ" value={taskPolygonUrl ? "Tersedia" : "Belum ada"} />
                    <StatCard label="Titik Selesai" value={String(completedPoints.length)} />
                    <StatCard label="Tracking" value={`${trackingPath.length} titik`} />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-white p-3.5 shadow-sm">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Peta Survey, Polygon, dan Tracking</h2>
                  <p className="text-[11px] text-slate-500">Semua informasi peta digabung agar halaman lebih ringkas di HP.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{loadingSubmittedSurveys ? "Memuat..." : `${submittedSurveys.length} Titik`}</div>
                  <button
                    type="button"
                    onClick={() => setShowUnifiedMap((previous) => !previous)}
                    className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    {showUnifiedMap ? "Sembunyikan Peta" : "Tampilkan Peta"}
                  </button>
                </div>
              </div>
              {showUnifiedMap ? (
                <DynamicUnifiedMap
                  latitude={gpsCoords?.latitude ?? null}
                  longitude={gpsCoords?.longitude ?? null}
                  accuracy={gpsCoords?.accuracy ?? 0}
                  hasGPS={isGPSActive}
                  kmzFileUrl={taskPolygonUrl}
                  completedPoints={completedPoints}
                  trackingPath={trackingPath}
                  onPointComplete={handleCompletePoint}
                  onTaskNavigationInfoChange={setTaskNavigationInfo}
                  surveyData={submittedSurveys}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-2.5">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-800">Peta disembunyikan untuk menghemat ruang layar.</p>
                      <p className="mt-1 text-[11px] text-slate-600">Tekan tombol <span className="font-semibold">Tampilkan Peta</span> jika ingin melihat marker survey, polygon tugas, posisi GPS, dan tracking.</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                      <div className={`rounded-xl px-3 py-1.5 text-center text-[11px] font-semibold ${isGPSActive ? "bg-emerald-500 text-white" : "bg-amber-100 text-amber-800"}`}>{isGPSActive ? "GPS Aktif" : "GPS Belum Aktif"}</div>
                      <button type="button" onClick={() => setTrackingEnabled((previous) => !previous)} className={`rounded-xl px-3 py-1.5 text-[11px] font-semibold text-white transition ${trackingEnabled ? "bg-red-500 hover:bg-red-600" : "bg-blue-600 hover:bg-blue-700"}`}>
                        {trackingEnabled ? "Hentikan Tracking" : "Mulai Tracking"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2">
                    <CompactTaskStatusPanel
                      isOutsideAssignedPolygon={isOutsideAssignedPolygon}
                      isInsideAssignedPolygon={taskNavigationInfo?.geometryType === "polygon" && taskNavigationInfo.isInsidePolygon}
                      statusMessage={taskStatusMessage}
                      targetLabel={taskNavigationInfo?.taskName || "-"}
                      distanceLabel={distanceToTaskLabel}
                      coordinateLabel={nearestTaskCoordinateLabel}
                      accuracyLabel={gpsCoords && taskNavigationInfo?.hasTaskGeometry ? `Status area dihitung dari posisi GPS saat ini. Akurasi perangkat sekitar +/-${gpsCoords.accuracy.toFixed(1)} meter.` : ""}
                      googleMapsUrl={googleMapsUrl}
                    />
                  </div>
                  <div className="mt-2">
                    <CompactRealtimePanel
                      trackingEnabled={trackingEnabled}
                      hasGPS={Boolean(gpsCoords)}
                      coordinatesLabel={gpsCoords ? `${gpsCoords.latitude.toFixed(6)}, ${gpsCoords.longitude.toFixed(6)}` : "Koordinat belum tersedia"}
                      accuracyLabel={gpsCoords ? `+/-${gpsCoords.accuracy.toFixed(1)}m` : "-"}
                      updatedAtLabel={gpsCoords ? new Date(gpsCoords.timestamp).toLocaleTimeString("id-ID") : "-"}
                    />
                  </div>
                </div>
              )}
              {showUnifiedMap ? (
                <div className="mt-2 space-y-2">
                  <CompactTaskStatusPanel
                    isOutsideAssignedPolygon={isOutsideAssignedPolygon}
                    isInsideAssignedPolygon={taskNavigationInfo?.geometryType === "polygon" && taskNavigationInfo.isInsidePolygon}
                    statusMessage={taskStatusMessage}
                    targetLabel={taskNavigationInfo?.taskName || "-"}
                    distanceLabel={distanceToTaskLabel}
                    coordinateLabel={nearestTaskCoordinateLabel}
                    accuracyLabel={gpsCoords && taskNavigationInfo?.hasTaskGeometry ? `Status area dihitung dari posisi GPS saat ini. Akurasi perangkat sekitar +/-${gpsCoords.accuracy.toFixed(1)} meter.` : ""}
                    googleMapsUrl={googleMapsUrl}
                  />
                  <CompactRealtimePanel
                    trackingEnabled={trackingEnabled}
                    hasGPS={Boolean(gpsCoords)}
                    coordinatesLabel={gpsCoords ? `${gpsCoords.latitude.toFixed(6)}, ${gpsCoords.longitude.toFixed(6)}` : "Koordinat belum tersedia"}
                    accuracyLabel={gpsCoords ? `+/-${gpsCoords.accuracy.toFixed(1)}m` : "-"}
                    updatedAtLabel={gpsCoords ? new Date(gpsCoords.timestamp).toLocaleTimeString("id-ID") : "-"}
                  />
                </div>
              ) : null}
            </div>
          </section>

          <section>
            <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Form Pra Existing</h2>
                <p className="text-sm text-slate-500">Kabupaten wajib dipilih agar data tidak nyasar dan terbaca di panel wilayah yang benar.</p>
              </div>
              <div className={`rounded-2xl border px-4 py-3 text-sm ${isFormLocked ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{checkingTaskAccess ? "Memeriksa akses tugas..." : isTaskEditable ? "Form aktif" : "Form terkunci"}</p>
                    <p className="mt-1 text-xs leading-5">{isTaskEditable ? compactOfflineInfo : taskAccessMessage}</p>
                  </div>
                  <div className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${connectivityClassName}`}>{connectivityLabel}</div>
                </div>
                {isOfflineAllowed ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                    <div className="rounded-xl bg-white/70 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Sinkron</p>
                      <p className="mt-0.5 font-semibold text-slate-800">{syncStatusLabel}</p>
                    </div>
                    <div className="rounded-xl bg-white/70 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Basemap</p>
                      <p className="mt-0.5 font-semibold text-slate-800">{basemapStatusLabel}</p>
                    </div>
                    <div className="hidden rounded-xl bg-white/70 px-3 py-2 sm:block">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Status</p>
                      <p className="mt-0.5 font-semibold text-slate-800">{isTaskEditable ? "Siap survey" : "Perlu cek tugas"}</p>
                    </div>
                  </div>
                ) : null}
                {isTaskEditable && isOfflineAllowed ? (
                  <p className="mt-2 text-[11px] text-slate-600">{offlineBasemapMessage}</p>
                ) : null}
                {!isTaskEditable && !checkingTaskAccess ? (
                  <button
                    type="button"
                    onClick={() => router.push("/tugas-survey-pra-existing")}
                    className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                  >
                    Buka Daftar Tugas
                  </button>
                ) : null}
              </div>
              <fieldset disabled={isFormLocked} className="space-y-5 disabled:opacity-60">
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField label="Kabupaten" value={formData.kabupaten} onChange={(value) => handleInputChange("kabupaten", value)} options={KABUPATEN_OPTIONS.map((item) => item.id)} optionLabelMap={Object.fromEntries(KABUPATEN_OPTIONS.map((item) => [item.id, item.name]))} required />
                  <SelectField label="Kecamatan" value={formData.kecamatan} onChange={(value) => handleInputChange("kecamatan", value)} options={districtOptions} required disabled={formData.kabupaten !== "tabanan"} />
                  <SelectField label="Desa" value={formData.desa} onChange={(value) => handleInputChange("desa", value)} options={desaOptions} required disabled={!formData.kecamatan} />
                  <SelectField label="Banjar" value={formData.banjar} onChange={(value) => handleInputChange("banjar", value)} options={banjarOptions} required disabled={!formData.desa} />
                  <SelectField label="Kepemilikan Tiang" value={formData.kepemilikanTiang} onChange={(value) => handleInputChange("kepemilikanTiang", value)} options={["PLN", "Lainnya"]} required />
                  <SelectField label="Tipe Tiang PLN" value={formData.tipeTiangPLN} onChange={(value) => handleInputChange("tipeTiangPLN", value)} options={["Tiang Tegangan Menengah (3 Kabel)", "Tiang Tegangan Rendah (Kabel 1)", "Tiang Trafo"]} disabled={formData.kepemilikanTiang !== "PLN"} required={formData.kepemilikanTiang === "PLN"} />
                  <SelectField label="Jenis Tiang" value={formData.jenisTiang} onChange={(value) => handleInputChange("jenisTiang", value)} options={["Beton", "Besi", "Kayu"]} required />
                  <SelectField label="Jenis Lampu" value={formData.jenisLampu} onChange={(value) => handleInputChange("jenisLampu", value)} options={["LED", "Mercury", "Panel Surya", "Kap"]} required />
                  <SelectField label="Jumlah Lampu" value={formData.jumlahLampu} onChange={(value) => handleInputChange("jumlahLampu", value)} options={["0", "1", "2", "3", "4"]} required />
                  <SelectField label="Fungsi Lampu" value={formData.fungsiLampu} onChange={(value) => handleInputChange("fungsiLampu", value)} options={["Alat Penerangan Jalan (APJ)", "Fasilitas Sosial (contoh : Rumah Ibadah, Bale Banjar,)", "Fasilitas Umum (contoh: Perumahan, Lapangan, Parkir)"]} required />
                </div>
                {formData.kabupaten && formData.kabupaten !== "tabanan" && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Data kecamatan dan desa detail saat ini baru disiapkan untuk Kabupaten Tabanan.</div>}
                <div className="space-y-3 rounded-2xl border border-dashed border-slate-300 p-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Foto Titik Aktual <span className="ml-1 text-red-500">*</span></label>
                    <input type="file" accept="image/*" capture="environment" onChange={(event) => void handlePhotoChange(event)} className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700" />
                    <p className="mt-2 text-xs text-slate-500">Gunakan kamera perangkat. Saat upload, foto akan diberi geostamp koordinat dan waktu.</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><span className="font-semibold text-slate-800">Geostamp:</span> {currentGeoStamp}</div>
                  {fotoPreview && <div className="space-y-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-2"><p className="px-2 text-xs font-medium text-emerald-700">Preview hasil geostamp</p><Image src={fotoPreview} alt="Preview foto aktual" width={1200} height={800} className="h-56 w-full rounded-lg object-cover" unoptimized /></div>}
                </div>
                <button type="submit" disabled={saving || isFormLocked} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300">{saving ? "Menyimpan..." : "Simpan Survey Pra Existing"}</button>
              </fieldset>
            </form>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371e3;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function createGeoStampedImage(file: File, gps: GPSCoordinates): Promise<File> {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(image, 0, 0);
  const margin = Math.max(20, Math.round(image.width * 0.028));
  const paddingX = Math.max(18, Math.round(image.width * 0.022));
  const paddingY = Math.max(14, Math.round(image.height * 0.018));
  const titleFontSize = Math.max(20, Math.round(image.width * 0.022));
  const bodyFontSize = Math.max(18, Math.round(image.width * 0.018));
  const lineGap = Math.max(10, Math.round(bodyFontSize * 0.4));
  const title = "GeoTag Survey Pra Existing";
  const lines = [
    `Koordinat : ${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}`,
    `Akurasi    : +/-${gps.accuracy.toFixed(1)} m`,
    `Waktu      : ${new Date(gps.timestamp).toLocaleString("id-ID")}`,
  ];

  ctx.save();
  ctx.textBaseline = "top";

  ctx.font = `700 ${titleFontSize}px Arial`;
  const titleWidth = ctx.measureText(title).width;
  ctx.font = `${bodyFontSize}px Arial`;
  const contentWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
  const boxWidth = Math.min(image.width - margin * 2, Math.max(titleWidth, contentWidth) + paddingX * 2);
  const boxHeight = paddingY * 2 + titleFontSize + 10 + lines.length * bodyFontSize + (lines.length - 1) * lineGap;
  const boxX = margin;
  const boxY = image.height - boxHeight - margin;

  drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, Math.max(14, Math.round(image.width * 0.015)));
  ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#F8FAFC";
  ctx.font = `700 ${titleFontSize}px Arial`;
  ctx.fillText(title, boxX + paddingX, boxY + paddingY);

  let currentY = boxY + paddingY + titleFontSize + 10;
  ctx.font = `${bodyFontSize}px Arial`;
  lines.forEach((line) => {
    ctx.fillText(line, boxX + paddingX, currentY);
    currentY += bodyFontSize + lineGap;
  });
  ctx.restore();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) return file;

  const stampedName = file.name.replace(/\.(jpg|jpeg|png|webp)$/i, "") + "-geostamp.jpg";
  return new File([blob], stampedName, { type: "image/jpeg" });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function StatCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-2"><p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p><p className="mt-0.5 text-sm font-medium text-slate-800">{value}</p></div>;
}

function InfoMiniCard({ label, value, monospace = false }: { label: string; value: string; monospace?: boolean }) {
  return (
    <div className="rounded-xl bg-white/90 p-2 shadow-sm ring-1 ring-black/5">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xs font-medium text-slate-800 ${monospace ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function CompactTaskStatusPanel({
  isOutsideAssignedPolygon,
  isInsideAssignedPolygon,
  statusMessage,
  targetLabel,
  distanceLabel,
  coordinateLabel,
  accuracyLabel,
  googleMapsUrl,
}: {
  isOutsideAssignedPolygon: boolean;
  isInsideAssignedPolygon: boolean | null | undefined;
  statusMessage: string;
  targetLabel: string;
  distanceLabel: string;
  coordinateLabel: string;
  accuracyLabel: string;
  googleMapsUrl: string;
}) {
  const panelClassName = isOutsideAssignedPolygon
    ? "border-amber-300 bg-amber-50 text-amber-900"
    : isInsideAssignedPolygon
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-slate-200 bg-slate-50 text-slate-700";

  const headingClassName = isOutsideAssignedPolygon
    ? "text-amber-900"
    : isInsideAssignedPolygon
      ? "text-emerald-800"
      : "text-slate-900";

  return (
    <div className={`rounded-2xl border p-2.5 text-sm ${panelClassName}`}>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2 flex-1">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status Area Tugas</p>
            <p className={`mt-1 text-xs font-semibold ${headingClassName}`}>{statusMessage}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <InfoMiniCard label="Target" value={targetLabel} />
            <InfoMiniCard label="Jarak" value={distanceLabel} />
            <InfoMiniCard label="Koordinat" value={coordinateLabel} monospace />
          </div>
          {accuracyLabel ? <p className="text-[11px] text-slate-500">{accuracyLabel}</p> : null}
        </div>
        <div className="flex w-full flex-col gap-2 lg:max-w-[210px]">
          <button
            type="button"
            onClick={() => {
              if (!googleMapsUrl) {
                return;
              }
              window.open(googleMapsUrl, "_blank", "noopener,noreferrer");
            }}
            disabled={!googleMapsUrl}
            className="rounded-xl bg-blue-600 px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Arahkan ke Google Maps
          </button>
          <p className="text-[11px] text-slate-500">Tujuan diarahkan ke titik tepi atau titik tugas terdekat dari admin.</p>
        </div>
      </div>
    </div>
  );
}

function CompactRealtimePanel({
  trackingEnabled,
  hasGPS,
  coordinatesLabel,
  accuracyLabel,
  updatedAtLabel,
}: {
  trackingEnabled: boolean;
  hasGPS: boolean;
  coordinatesLabel: string;
  accuracyLabel: string;
  updatedAtLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-2.5 text-sm text-slate-700">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-emerald-800">Pelacakan real time {trackingEnabled ? "aktif" : "siap"}</span>
        <span className="text-xs text-emerald-700">{hasGPS ? "Terverifikasi" : "Menunggu GPS"}</span>
      </div>
      <p className="mt-2 rounded-xl bg-white px-3 py-2 font-mono text-xs text-slate-900">{coordinatesLabel}</p>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>Akurasi: {accuracyLabel}</span>
        <span>Update: {updatedAtLabel}</span>
      </div>
    </div>
  );
}

interface BaseFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}

interface SelectFieldProps extends BaseFieldProps {
  options: string[];
  optionLabelMap?: Record<string, string>;
}

function SelectField({ label, value, onChange, options, optionLabelMap, required, disabled }: SelectFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}{required ? <span className="ml-1 text-red-500">*</span> : null}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} required={required} disabled={disabled} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100">
        <option value="">Pilih</option>
        {options.map((option) => <option key={option} value={option}>{optionLabelMap?.[option] || option}</option>)}
      </select>
    </label>
  );
}

export default function SurveyPraExistingPage() {
  return <SurveyPraExistingContent />;
}
