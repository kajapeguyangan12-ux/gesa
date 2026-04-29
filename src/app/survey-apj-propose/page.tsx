"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Image from "next/image";
import dynamic from "next/dynamic";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { getActiveKabupatenFromStorage, setActiveKabupatenToStorage } from "@/utils/helpers";
import { KABUPATEN_OPTIONS } from "@/utils/constants";
import { formatWitaTime } from "@/utils/dateTime";
import { loadParsedTaskGeometries } from "@/utils/kmzTaskParser";
import { analyzeTaskNavigation, type ParsedTaskGeometries, type TaskNavigationInfo } from "@/utils/taskNavigation";
import { CompactRealtimePanel, CompactTaskStatusPanel, StatCard } from "@/components/SurveyTaskPanels";

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
  kabupaten?: string;
  kabupatenName?: string;
}

interface ApjProposeSurveyItem {
  id: string;
  latitude: number;
  longitude: number;
  idTitik?: string;
  namaJalan?: string;
  dayaLampu?: string;
  surveyorName?: string;
  createdAt?: string | Date | { toDate?: () => Date } | null;
}

const emptyTaskGeometries: ParsedTaskGeometries = {
  polygons: [],
  polylines: [],
  points: [],
};

const SUBMITTED_SURVEYS_REFRESH_INTERVAL_MS = 10_000;

const DynamicUnifiedMap = dynamic(
  () => import("@/components/SurveyTaskUnifiedMap"),
  { 
    ssr: false,
    loading: () => (
      <div className="rounded-xl overflow-hidden border-2 border-blue-200 shadow-lg flex items-center justify-center bg-gray-100" style={{ height: '400px' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Memuat peta survey...</p>
        </div>
      </div>
    )
  }
);

function SurveyAPJProposeContent() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeKabupaten, setActiveKabupaten] = useState<string | null>(null);
  const [pendingKabupaten, setPendingKabupaten] = useState<string | null>(null);
  const [showKabupatenPicker, setShowKabupatenPicker] = useState(false);
  const [showKabupatenConfirm, setShowKabupatenConfirm] = useState(false);

  const [gpsCoords, setGpsCoords] = useState<GPSCoordinates | null>(null);
  const [isGPSActive, setIsGPSActive] = useState(false);
  const [fotoTitikActual, setFotoTitikActual] = useState<string>("");
  const [fotoKemerataan, setFotoKemerataan] = useState<string>("");
  
  // State for KMZ file from active task
  const [kmzFileUrl, setKmzFileUrl] = useState<string | undefined>(undefined);
  const [activeTask, setActiveTask] = useState<ActiveTask | null>(null);
  const [showUnifiedMap, setShowUnifiedMap] = useState(false);
  const [showTaskSummary, setShowTaskSummary] = useState(false);
  const [taskNavigationInfo, setTaskNavigationInfo] = useState<TaskNavigationInfo | null>(null);
  const [taskGeometries, setTaskGeometries] = useState<ParsedTaskGeometries>(emptyTaskGeometries);
  
  // State for completed task points
  const [completedPoints, setCompletedPoints] = useState<string[]>([]);
  
  // State for survey data
  const [surveyData, setSurveyData] = useState<ApjProposeSurveyItem[]>([]);
  const [loadingSurveys, setLoadingSurveys] = useState(true);
  
  // State for GPS tracking
  const [isTracking, setIsTracking] = useState(false);
  const [trackingPath, setTrackingPath] = useState<Array<{lat: number, lng: number, timestamp: number}>>([]);
  const [trackingSessionId, setTrackingSessionId] = useState<string | null>(null);
  const [trackingInterval, setTrackingInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Modal state
  const [showIDTitikModal, setShowIDTitikModal] = useState(false);
  const [tempIDTitik, setTempIDTitik] = useState("");
  const [pilihIDTitik, setPilihIDTitik] = useState("");
  const [showDayaLampuDropdown, setShowDayaLampuDropdown] = useState(false);
  const [showDataTiangDropdown, setShowDataTiangDropdown] = useState(false);
  const [showDataRuasDropdown, setShowDataRuasDropdown] = useState(false);
  const [showSubRuasDropdown, setShowSubRuasDropdown] = useState(false);
  const [showMedianDropdown, setShowMedianDropdown] = useState(false);
  const [showMedianModal, setShowMedianModal] = useState(false);
  const [tempTinggiMedian, setTempTinggiMedian] = useState("");
  const [tempLebarMedian, setTempLebarMedian] = useState("");
  const [pilihMedian, setPilihMedian] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    statusIDTitik: "",
    idTitik: "",
    statusTitik: "",
    dayaLampu: "",
    dataTiang: "",
    dataRuas: "",
    subRuas: "",
    median: "",
    tinggiMedian: "",
    lebarMedian: "",
    namaJalan: "",
    lebarJalan: "",
    jarakAntarTiang: "",
    lebarBahuBertiang: "",
    lebarTrotoarBertiang: "",
    lainnyaBertiang: "",
    keterangan: "",
  });

  const taskPolygonUrl = kmzFileUrl;
  const submittedSurveyMarkers = useMemo(
    () =>
      surveyData.map((survey) => ({
        id: survey.id,
        latitude: Number(survey.latitude) || 0,
        longitude: Number(survey.longitude) || 0,
        title: "Survey APJ Propose",
        details: [
          { label: "ID Titik", value: survey.idTitik || "-" },
          { label: "Lokasi", value: survey.namaJalan || "-" },
          { label: "Daya Lampu", value: survey.dayaLampu || "-" },
          { label: "Surveyor", value: survey.surveyorName || "-" },
        ],
        createdAt: survey.createdAt,
      })),
    [surveyData]
  );
  const distanceToTaskLabel = useMemo(() => {
    const distance = taskNavigationInfo?.distanceToTargetMeters;
    if (distance === null || distance === undefined) return "-";
    if (distance < 1000) return `${Math.round(distance)} m`;
    return `${(distance / 1000).toFixed(2)} km`;
  }, [taskNavigationInfo?.distanceToTargetMeters]);
  const nearestTaskCoordinateLabel = useMemo(() => {
    const coordinate = taskNavigationInfo?.nearestCoordinate;
    if (!coordinate) return "-";
    return `${coordinate.lat.toFixed(6)}, ${coordinate.lng.toFixed(6)}`;
  }, [taskNavigationInfo?.nearestCoordinate]);
  const isOutsideAssignedPolygon = Boolean(
    taskNavigationInfo?.hasTaskGeometry &&
      taskNavigationInfo.geometryType === "polygon" &&
      taskNavigationInfo.isInsidePolygon === false
  );
  const taskStatusMessage = useMemo(() => {
    if (!taskNavigationInfo?.hasTaskGeometry) {
      return "Area tugas belum tersedia. Peta tetap bisa dipakai untuk survey dan tracking.";
    }
    if (taskNavigationInfo.geometryType === "polygon") {
      return taskNavigationInfo.isInsidePolygon
        ? "Posisi GPS berada di dalam area tugas APJ propose."
        : "Posisi GPS berada di luar area tugas APJ propose.";
    }
    if (taskNavigationInfo.geometryType === "polyline") {
      return "Tugas berbentuk jalur. Jarak dihitung ke garis terdekat.";
    }
    return "Tugas berbentuk titik. Jarak dihitung ke titik tugas terdekat.";
  }, [taskNavigationInfo]);
  const googleMapsUrl = useMemo(() => {
    const coordinate = taskNavigationInfo?.nearestCoordinate;
    if (!coordinate) return "";
    return `https://www.google.com/maps/dir/?api=1&destination=${coordinate.lat},${coordinate.lng}`;
  }, [taskNavigationInfo?.nearestCoordinate]);
  const coordinatesLabel = gpsCoords ? `${gpsCoords.latitude.toFixed(6)}, ${gpsCoords.longitude.toFixed(6)}` : "Koordinat belum tersedia";
  const accuracyLabel = gpsCoords ? `+/-${gpsCoords.accuracy.toFixed(1)}m` : "-";
  const updatedAtLabel = gpsCoords ? formatWitaTime(gpsCoords.timestamp) || "-" : "-";

  // Handle pilih ID Titik
  const handlePilihIDTitik = (value: string) => {
    setPilihIDTitik(value);
    if (value === "Ada") {
      setShowIDTitikModal(true);
    } else {
      setFormData({ ...formData, statusIDTitik: value, idTitik: "" });
    }
  };

  // Handle save ID Titik
  const handleSaveIDTitik = () => {
    if (!tempIDTitik.trim()) {
      alert("Masukkan ID Titik terlebih dahulu");
      return;
    }
    setFormData({ ...formData, statusIDTitik: "Ada", idTitik: tempIDTitik });
    setShowIDTitikModal(false);
  };

  // Handle cancel ID Titik
  const handleCancelIDTitik = () => {
    setTempIDTitik("");
    setPilihIDTitik("");
    setShowIDTitikModal(false);
  };

  // Handle pilih Median
  const handlePilihMedian = (value: string) => {
    setPilihMedian(value);
    if (value === "Ada") {
      setShowMedianModal(true);
    } else {
      setFormData({ ...formData, median: value, tinggiMedian: "", lebarMedian: "" });
    }
  };

  // Handle save Median
  const handleSaveMedian = () => {
    if (!tempTinggiMedian.trim() || !tempLebarMedian.trim()) {
      alert("Tinggi dan Lebar median harus diisi");
      return;
    }
    setFormData({ 
      ...formData, 
      median: "Ada", 
      tinggiMedian: tempTinggiMedian,
      lebarMedian: tempLebarMedian
    });
    setShowMedianModal(false);
  };

  // Handle cancel Median
  const handleCancelMedian = () => {
    setTempTinggiMedian("");
    setTempLebarMedian("");
    setPilihMedian("");
    setShowMedianModal(false);
  };

  const taskKabupaten = activeTask?.kabupaten || null;
  const effectiveKabupaten = taskKabupaten || activeKabupaten;

  useEffect(() => {
    if (taskKabupaten) {
      setActiveKabupaten(taskKabupaten);
      setActiveKabupatenToStorage(user?.uid || "", taskKabupaten);
      setShowKabupatenPicker(false);
      return;
    }
    const stored = getActiveKabupatenFromStorage(user?.uid || "");
    if (stored) {
      setActiveKabupaten(stored);
      setShowKabupatenPicker(false);
    } else {
      setActiveKabupaten(null);
      setShowKabupatenPicker(true);
    }
  }, [taskKabupaten, user?.uid]);

  const activeKabupatenName =
    KABUPATEN_OPTIONS.find((k) => k.id === activeKabupaten)?.name || "-";
  const pendingKabupatenName =
    KABUPATEN_OPTIONS.find((k) => k.id === pendingKabupaten)?.name || "-";

  const handleKabupatenPick = (kabupatenId: string) => {
    if (taskKabupaten) return;
    if (kabupatenId === activeKabupaten) {
      setShowKabupatenPicker(false);
      return;
    }
    setPendingKabupaten(kabupatenId);
    setShowKabupatenConfirm(true);
  };

  const handleKabupatenConfirm = () => {
    if (taskKabupaten) return;
    if (!pendingKabupaten) return;
    setActiveKabupaten(pendingKabupaten);
    setActiveKabupatenToStorage(user?.uid || "", pendingKabupaten);
    setPendingKabupaten(null);
    setShowKabupatenConfirm(false);
    setShowKabupatenPicker(false);
  };

  const handleKabupatenCancel = () => {
    setPendingKabupaten(null);
    setShowKabupatenConfirm(false);
  };

  // Load KMZ file URL from active task
  useEffect(() => {
    const activeTaskStr = localStorage.getItem("activeTask");
    if (activeTaskStr) {
      try {
        const activeTask = JSON.parse(activeTaskStr);
        setActiveTask(activeTask);
        // For propose survey, use kmzFileUrl
        if (activeTask.kmzFileUrl) {
          setKmzFileUrl(activeTask.kmzFileUrl);
          console.log("KMZ file loaded for propose survey:", activeTask.kmzFileUrl);
        }
        
        // Load completed points from localStorage
        const completedPointsKey = `completed_points_${activeTask.id}`;
        const savedCompletedPoints = localStorage.getItem(completedPointsKey);
        if (savedCompletedPoints) {
          setCompletedPoints(JSON.parse(savedCompletedPoints));
        }
      } catch (error) {
        console.error("Error loading active task:", error);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadTaskGeometries = async () => {
      if (!taskPolygonUrl) {
        setTaskGeometries(emptyTaskGeometries);
        return;
      }

      try {
        const geometries = await loadParsedTaskGeometries(taskPolygonUrl);
        if (!cancelled) {
          setTaskGeometries(geometries);
        }
      } catch (error) {
        console.error("Gagal membaca geometri tugas APJ propose:", error);
        if (!cancelled) {
          setTaskGeometries(emptyTaskGeometries);
        }
      }
    };

    void loadTaskGeometries();

    return () => {
      cancelled = true;
    };
  }, [taskPolygonUrl]);

  useEffect(() => {
    if (!gpsCoords) {
      setTaskNavigationInfo(null);
      return;
    }

    const info = analyzeTaskNavigation(
      { lat: gpsCoords.latitude, lng: gpsCoords.longitude },
      taskGeometries
    );
    setTaskNavigationInfo(info);
  }, [gpsCoords, taskGeometries]);
  
  // Load survey data from Firestore
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let cancelled = false;

    const loadSurveyData = async () => {
      try {
        if (!effectiveKabupaten) {
          if (!cancelled) {
            setSurveyData([]);
          }
          return;
        }
        if (!cancelled) {
          setLoadingSurveys(true);
        }
        const response = await fetch(
          `/api/survey-apj-propose/submitted-surveys?kabupaten=${encodeURIComponent(effectiveKabupaten)}`,
          { cache: "no-store" }
        );
        if (!response.ok) {
          throw new Error("Gagal memuat survey APJ propose dari Supabase.");
        }

        const payload = (await response.json()) as { surveys?: ApjProposeSurveyItem[] };
        const surveys = Array.isArray(payload.surveys) ? payload.surveys : [];
        if (cancelled) return;

        setSurveyData(surveys);
        console.log("Loaded APJ Propose surveys:", surveys.length);
      } catch (error) {
        console.error("Error loading survey data:", error);
      } finally {
        if (!cancelled) {
          setLoadingSurveys(false);
        }
      }
    };

    void loadSurveyData();
    intervalId = setInterval(() => {
      void loadSurveyData();
    }, SUBMITTED_SURVEYS_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [effectiveKabupaten]);
  
  // Handle completing a task point
  const handleCompletePoint = useCallback((pointId: string, pointName: string, lat: number, lng: number) => {
    setCompletedPoints(prevPoints => {
      if (prevPoints.includes(pointId)) {
        // Show professional alert that point is already completed
        const alertDiv = document.createElement('div');
        alertDiv.innerHTML = `
          <div style="background: white; padding: 24px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); max-width: 400px; text-align: center;">
            <div style="width: 60px; height: 60px; background: #FEF3C7; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
              <span style="font-size: 32px;">⚠️</span>
            </div>
            <h3 style="font-size: 18px; font-weight: 700; color: #1F2937; margin-bottom: 8px;">Titik Sudah Selesai</h3>
            <p style="color: #6B7280; font-size: 14px; margin-bottom: 20px;">Titik "${pointName}" sudah pernah ditandai selesai sebelumnya.</p>
            <button onclick="this.parentElement.parentElement.remove()" style="background: #F59E0B; color: white; border: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; cursor: pointer;">OK</button>
          </div>
        `;
        alertDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10000; background: rgba(0,0,0,0.5); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;';
        document.body.appendChild(alertDiv);
        alertDiv.onclick = (e) => { if (e.target === alertDiv) alertDiv.remove(); };
        
        return prevPoints; // Already completed
      }
      
      const confirmed = window.confirm(
        `Tandai titik "${pointName}" sebagai selesai?\n\nKoordinat: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
      );
      
      if (confirmed) {
        const newCompletedPoints = [...prevPoints, pointId];
        
        // Save to localStorage
        const activeTaskStr = localStorage.getItem("activeTask");
        if (activeTaskStr) {
          try {
            const activeTask = JSON.parse(activeTaskStr);
            const completedPointsKey = `completed_points_${activeTask.id}`;
            localStorage.setItem(completedPointsKey, JSON.stringify(newCompletedPoints));
            
            // Show professional success alert
            const alertDiv = document.createElement('div');
            alertDiv.innerHTML = `
              <div style="background: white; padding: 24px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); max-width: 400px; text-align: center;">
                <div style="width: 60px; height: 60px; background: #D1FAE5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="#10B981">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                </div>
                <h3 style="font-size: 18px; font-weight: 700; color: #1F2937; margin-bottom: 8px;">✓ Titik Berhasil Diselesaikan</h3>
                <p style="color: #6B7280; font-size: 14px; margin-bottom: 8px;">Titik <strong>"${pointName}"</strong> telah ditandai sebagai selesai.</p>
                <p style="color: #10B981; font-size: 12px; background: #D1FAE5; padding: 8px; border-radius: 8px; margin-bottom: 20px;">
                  📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}
                </p>
                <button id="closeSuccessAlert" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; border: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">OK, Mengerti</button>
              </div>
            `;
            alertDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10000; background: rgba(0,0,0,0.5); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;';
            document.body.appendChild(alertDiv);
            
            const closeBtn = document.getElementById('closeSuccessAlert');
            if (closeBtn) {
              closeBtn.onclick = () => {
                alertDiv.remove();
                // Force close all open popups and trigger re-render
                const closeButtons = document.querySelectorAll('.leaflet-popup-close-button');
                closeButtons.forEach(btn => (btn as HTMLElement).click());
              };
            }
            alertDiv.onclick = (e) => { 
              if (e.target === alertDiv) {
                alertDiv.remove();
                const closeButtons = document.querySelectorAll('.leaflet-popup-close-button');
                closeButtons.forEach(btn => (btn as HTMLElement).click());
              }
            };
            
          } catch (error) {
            console.error("Error saving completed point:", error);
          }
        }
        
        return newCompletedPoints;
      }
      
      return prevPoints;
    });
  }, []);
  
  // Setup window function for completing task points
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.completeTaskPoint = (pointId: string, pointName: string, lat: number, lng: number) => {
        handleCompletePoint(pointId, pointName, lat, lng);
      };
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete window.completeTaskPoint;
      }
    };
  }, [handleCompletePoint]);

  // GPS tracking with continuous updates
  useEffect(() => {
    if (isGPSActive) {
      if (!("geolocation" in navigator)) {
        alert("Browser Anda tidak mendukung GPS");
        setIsGPSActive(false);
        return;
      }

      let watchId: number | null = null;
      let hasGotPosition = false;

      // Strategy 1: Try to get position quickly (balanced mode)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("✓ Posisi awal didapat - Akurasi:", position.coords.accuracy.toFixed(1) + "m");
          hasGotPosition = true;
          setGpsCoords({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          });
        },
        (error) => {
          console.warn("⚠ Posisi awal gagal (error " + error.code + "), mencoba mode alternatif...");
          
          // Fallback: If first attempt fails, try with cached position
          if (!hasGotPosition) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                console.log("✓ Posisi fallback didapat - Akurasi:", position.coords.accuracy.toFixed(1) + "m");
                hasGotPosition = true;
                setGpsCoords({
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                  timestamp: position.timestamp,
                });
              },
              (err) => {
                console.warn("⚠ Fallback juga gagal:", err.message);
              },
              {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 60000, // Accept 1 minute old position
              }
            );
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 15000, // 15 seconds for first try
          maximumAge: 30000, // Accept 30 seconds old position
        }
      );

      // Strategy 2: Start continuous watching with relaxed settings
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const accuracy = position.coords.accuracy;
          console.log("📍 GPS Update - Akurasi: " + accuracy.toFixed(1) + "m");
          hasGotPosition = true;
          
          setGpsCoords({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          });
        },
        (error) => {
          // Silent error handling - just log, don't alert or disable
          if (error.code === 1) {
            console.error("❌ Izin lokasi ditolak");
            alert("Izin lokasi ditolak. Mohon aktifkan izin lokasi di browser.");
            setIsGPSActive(false);
          } else if (error.code === 2) {
            console.warn("⚠ Posisi tidak tersedia, GPS akan retry otomatis...");
          } else if (error.code === 3) {
            console.warn("⏱ Timeout pada update GPS, akan retry otomatis...");
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 27000, // Slightly less than 30s to avoid overlapping timeouts
          maximumAge: 15000, // Accept positions up to 15 seconds old
        }
      );

      return () => {
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
        }
      };
    }
  }, [isGPSActive]);

  // Convert image to WebP
  const convertToWebP = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxWidth = 1920;
          const maxHeight = 1080;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const webpUrl = URL.createObjectURL(blob);
                resolve(webpUrl);
              } else {
                reject(new Error("Failed to convert image"));
              }
            },
            "image/webp",
            0.85
          );
        };
        img.onerror = () => reject(new Error("Failed to load image"));
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
    });
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "titikActual" | "kemerataan") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("File harus berupa gambar");
      return;
    }

    try {
      const webpUrl = await convertToWebP(file);
      if (type === "titikActual") {
        setFotoTitikActual(webpUrl);
      } else {
        setFotoKemerataan(webpUrl);
      }
    } catch (error) {
      console.error("Error converting image:", error);
      alert("Gagal memproses gambar");
    }
  };

  // GPS Tracking Functions
  const startTracking = async () => {
    if (!user) {
      alert("User tidak terautentikasi");
      return;
    }

    if (!isGPSActive || !gpsCoords) {
      alert("Aktifkan GPS terlebih dahulu sebelum memulai tracking");
      return;
    }

    try {
      // Create new tracking session in Supabase
      const trackingData = {
        userId: user.uid,
        userName: user.displayName || user.email,
        userEmail: user.email,
        startTime: new Date().toISOString(),
        endTime: null,
        status: "active",
        path: [{
          lat: gpsCoords.latitude,
          lng: gpsCoords.longitude,
          timestamp: Date.now(),
          accuracy: gpsCoords.accuracy
        }],
        totalDistance: 0,
        pointsCount: 1,
        duration: 0,
        surveyType: "apj-propose"
      };

      const createResponse = await fetch("/api/tracking-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trackingData),
      });
      if (!createResponse.ok) {
        throw new Error("Gagal membuat tracking session di Supabase.");
      }
      const createPayload = (await createResponse.json()) as { id?: string };
      const sessionId = createPayload.id || "";
      if (!sessionId) {
        throw new Error("Tracking session ID tidak tersedia.");
      }
      setTrackingSessionId(sessionId);
      setIsTracking(true);
      setTrackingPath([{
        lat: gpsCoords.latitude,
        lng: gpsCoords.longitude,
        timestamp: Date.now()
      }]);

      // Start interval to record GPS position every 15 seconds
      const interval = setInterval(async () => {
        if (gpsCoords && sessionId) {
          const newPoint = {
            lat: gpsCoords.latitude,
            lng: gpsCoords.longitude,
            timestamp: Date.now(),
            accuracy: gpsCoords.accuracy
          };

          setTrackingPath(prev => [...prev, newPoint]);

          try {
            const updateResponse = await fetch(`/api/tracking-sessions/${sessionId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                path: [...trackingPath, newPoint],
                lastUpdate: new Date().toISOString(),
                pointsCount: trackingPath.length + 1
              }),
            });
            if (!updateResponse.ok) {
              throw new Error("Gagal memperbarui tracking point di Supabase.");
            }
            console.log("Tracking point saved");
          } catch (error) {
            console.error("Error updating tracking:", error);
          }
        }
      }, 15000); // Record every 15 seconds

      setTrackingInterval(interval);
      
      alert("✓ Tracking dimulai! GPS akan direkam setiap 15 detik.");
    } catch (error) {
      console.error("Error starting tracking:", error);
      alert("Gagal memulai tracking");
    }
  };

  const stopTracking = async () => {
    if (!trackingSessionId) return;

    try {
      // Clear interval
      if (trackingInterval) {
        clearInterval(trackingInterval);
        setTrackingInterval(null);
      }

      // Calculate total distance
      let totalDistance = 0;
      for (let i = 1; i < trackingPath.length; i++) {
        const prev = trackingPath[i - 1];
        const curr = trackingPath[i];
        const distance = calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
        totalDistance += distance;
      }

      const duration = trackingPath.length > 0 ? 
        (trackingPath[trackingPath.length - 1].timestamp - trackingPath[0].timestamp) / 1000 : 0;

      const updateResponse = await fetch(`/api/tracking-sessions/${trackingSessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endTime: new Date().toISOString(),
          status: "completed",
          path: trackingPath.map(p => ({
            lat: p.lat,
            lng: p.lng,
            timestamp: p.timestamp
          })),
          totalDistance: totalDistance,
          pointsCount: trackingPath.length,
          duration
        }),
      });
      if (!updateResponse.ok) {
        throw new Error("Gagal menghentikan tracking di Supabase.");
      }

      setIsTracking(false);
      setTrackingSessionId(null);
      setTrackingPath([]);

      alert(`✓ Tracking selesai!\n\nTotal Jarak: ${totalDistance.toFixed(2)} km\nTotal Titik: ${trackingPath.length}`);
    } catch (error) {
      console.error("Error stopping tracking:", error);
      alert("Gagal menghentikan tracking");
    }
  };

  // Helper function to calculate distance between two GPS points (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  // Cleanup tracking on component unmount
  useEffect(() => {
    return () => {
      if (trackingInterval) {
        clearInterval(trackingInterval);
      }
    };
  }, [trackingInterval]);

  // Handle submit
  const handleSubmit = async () => {
    // Validation
    if (!formData.dayaLampu) {
      alert("Pilih daya lampu terlebih dahulu");
      return;
    }

    if (!gpsCoords) {
      alert("Aktifkan GPS dan tunggu hingga koordinat didapat");
      return;
    }

    if (!formData.namaJalan) {
      alert("Masukkan nama jalan");
      return;
    }

    if (!fotoTitikActual) {
      alert("Ambil foto titik aktual");
      return;
    }

    try {
      // Show loading
      alert("Sedang menyimpan data...");
      
      // Convert images to WebP format
      const fotoTitikActualWebP = await convertImageToWebP(fotoTitikActual);
      const fotoKemeratanWebP = fotoKemerataan ? await convertImageToWebP(fotoKemerataan) : null;

      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const userName = user?.displayName || user?.email?.split('@')[0] || 'user';
      
      // Upload Foto Titik Actual to Firebase Storage
      const titikActualRef = ref(storage, `survey-apj-propose/${userName}_titik_actual_${timestamp}.webp`);
      await uploadString(titikActualRef, fotoTitikActualWebP, 'data_url');
      const titikActualUrl = await getDownloadURL(titikActualRef);

      // Upload Foto Kemerataan if exists
      let kemeratanUrl = null;
      if (fotoKemeratanWebP) {
        const kemeratanRef = ref(storage, `survey-apj-propose/${userName}_kemerataan_${timestamp}.webp`);
        await uploadString(kemeratanRef, fotoKemeratanWebP, 'data_url');
        kemeratanUrl = await getDownloadURL(kemeratanRef);
      }

      // Save to Firestore
      const kabupaten = taskKabupaten || getActiveKabupatenFromStorage(user?.uid || "");
      if (!kabupaten) {
        alert("Kabupaten belum dipilih. Silakan pilih kabupaten terlebih dahulu.");
        return;
      }
      const surveyData = {
        // Form data
        statusIDTitik: formData.statusIDTitik,
        idTitik: formData.idTitik,
        dayaLampu: formData.dayaLampu,
        dataTiang: formData.dataTiang,
        dataRuas: formData.dataRuas,
        subRuas: formData.subRuas,
        median: formData.median,
        tinggiMedian: formData.tinggiMedian,
        lebarMedian: formData.lebarMedian,
        namaJalan: formData.namaJalan,
        lebarJalan: formData.lebarJalan,
        jarakAntarTiang: formData.jarakAntarTiang,
        lebarBahuBertiang: formData.lebarBahuBertiang,
        lebarTrotoarBertiang: formData.lebarTrotoarBertiang,
        lainnyaBertiang: formData.lainnyaBertiang,
        keterangan: formData.keterangan,
        
        // GPS coordinates
        latitude: gpsCoords.latitude,
        longitude: gpsCoords.longitude,
        accuracy: gpsCoords.accuracy,
        
        // Photo URLs
        fotoTitikActual: titikActualUrl,
        fotoKemerataan: kemeratanUrl,
        
        // Metadata
        type: "propose",
        status: "menunggu",
        surveyorName: user?.displayName || user?.email || "Unknown",
        surveyorEmail: user?.email,
        surveyorUid: user?.uid,
        taskId: activeTask?.id || "",
        taskTitle: activeTask?.title || "",
        kmzFileUrl: taskPolygonUrl || "",
        kabupaten,
        createdAt: new Date().toISOString(),
        title: `Survey APJ Propose - ${formData.namaJalan}`,
        
        // Additional fields for compatibility
        kepemilikan: formData.dataTiang || "N/A",
        jenis: "APJ Propose",
        tinggiArm: "N/A",
        zona: "Propose",
        kategori: "Survey APJ Propose",
      };

      const response = await fetch("/api/surveys/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...surveyData,
          createdAt: new Date().toISOString(),
        }),
      });
      if (!response.ok) {
        throw new Error("Gagal menyimpan survey propose ke Supabase.");
      }
      setSurveyData((previous) => [
        {
          id: `local-${Date.now()}`,
          ...surveyData,
          createdAt: new Date().toISOString(),
        },
        ...previous,
      ]);

      alert("Data survey berhasil disimpan!");
      router.push("/survey-selection");
    } catch (error) {
      console.error("Error saving survey:", error);
      alert("Gagal menyimpan survey. Silakan coba lagi.");
    }
  };

  // Helper function to convert image to WebP
  const convertImageToWebP = async (base64Image: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        
        // Convert to WebP with quality 0.8
        const webpBase64 = canvas.toDataURL('image/webp', 0.8);
        resolve(webpBase64);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = base64Image;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-[9999] bg-white/95 backdrop-blur-xl border-b border-gray-200/50 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/survey-selection")}
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">Survey APJ Propose</h1>
                <p className="text-xs text-gray-600">Form survey tiang APJ propose</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                    Kabupaten aktif: {taskKabupaten ? activeTask?.kabupatenName || activeKabupatenName : activeKabupatenName}
                  </span>
                  {taskKabupaten ? (
                    <span className="text-[11px] font-semibold text-amber-700 border border-amber-200 bg-amber-50 px-2 py-0.5 rounded-full">
                      Dikunci dari tugas admin
                    </span>
                  ) : (
                    <button
                      onClick={() => setShowKabupatenPicker(true)}
                      className="text-[11px] font-semibold text-gray-700 hover:text-blue-700 border border-gray-200 hover:border-blue-200 bg-white px-2 py-0.5 rounded-full transition-all"
                    >
                      Ganti kabupaten
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Modal ID Titik */}
      {showIDTitikModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-gray-900 text-center">Masukkan ID Titik</h3>
            
            <input
              type="text"
              value={tempIDTitik}
              onChange={(e) => setTempIDTitik(e.target.value)}
              placeholder="Contoh: T-123"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 placeholder:text-gray-400"
            />

            <div className="flex gap-3">
              <button
                onClick={handleCancelIDTitik}
                className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-all active:scale-95"
              >
                Batal
              </button>
              <button
                onClick={handleSaveIDTitik}
                className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all active:scale-95"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {showMedianModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-gray-900 text-center">Detail Median</h3>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Tinggi Median (m)</label>
              <input
                type="number"
                step="0.01"
                value={tempTinggiMedian}
                onChange={(e) => setTempTinggiMedian(e.target.value)}
                placeholder="Contoh: 0.5"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Lebar Median (m)</label>
              <input
                type="number"
                step="0.01"
                value={tempLebarMedian}
                onChange={(e) => setTempLebarMedian(e.target.value)}
                placeholder="Contoh: 1.5"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 placeholder:text-gray-400"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelMedian}
                className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-all active:scale-95"
              >
                Batal
              </button>
              <button
                onClick={handleSaveMedian}
                className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all active:scale-95"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Ringkasan Tugas APJ Propose</p>
              <p className="text-[11px] text-slate-500">Judul tugas, status, dan progres titik bisa dibuka saat perlu.</p>
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
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{activeTask?.description || "Buka dari daftar tugas APJ propose agar area kerja tampil."}</p>
                </div>
                <div className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{activeTask?.status || "-"}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 sm:grid-cols-4">
                <StatCard label="Kabupaten" value={taskKabupaten ? activeTask?.kabupatenName || activeKabupatenName : activeKabupatenName} />
                <StatCard label="Polygon KMZ" value={taskPolygonUrl ? "Tersedia" : "Belum ada"} />
                <StatCard label="Titik Selesai" value={String(completedPoints.length)} />
                <StatCard label="Tracking" value={`${trackingPath.length} titik`} />
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Peta Survey, Area Tugas, dan Tracking</h2>
                <p className="text-[11px] text-slate-500">Marker APJ propose, polygon tugas, posisi GPS, dan tracking digabung dalam satu panel.</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{loadingSurveys ? "Memuat..." : `${surveyData.length} Titik`}</div>
                <button
                  type="button"
                  onClick={() => setShowUnifiedMap((previous) => !previous)}
                  className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  {showUnifiedMap ? "Sembunyikan Peta" : "Tampilkan Peta"}
                </button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setIsGPSActive(!isGPSActive)}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                  isGPSActive
                    ? "bg-green-500 text-white shadow-lg"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {isGPSActive ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-white animate-pulse"></div>
                    GPS Aktif
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    Aktifkan GPS
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={isTracking ? stopTracking : startTracking}
                disabled={!isGPSActive || !gpsCoords}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                  isTracking
                    ? "bg-red-500 text-white shadow-lg"
                    : isGPSActive && gpsCoords
                    ? "bg-blue-500 text-white hover:bg-blue-600 shadow-md"
                    : "cursor-not-allowed bg-gray-300 text-gray-500"
                }`}
              >
                {isTracking ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-white animate-pulse"></div>
                    Stop Tracking
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Mulai Tracking
                  </>
                )}
              </button>
            </div>
            {isTracking && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
                  <span className="text-sm font-bold text-red-700">Tracking Aktif</span>
                </div>
                <p className="mt-1 text-xs text-red-600">{trackingPath.length} titik terekam, diperbarui setiap 15 detik.</p>
              </div>
            )}
          </div>
          {showUnifiedMap ? (
            <DynamicUnifiedMap
              latitude={gpsCoords?.latitude ?? null}
              longitude={gpsCoords?.longitude ?? null}
              accuracy={gpsCoords?.accuracy ?? 0}
              hasGPS={isGPSActive && gpsCoords !== null}
              kmzFileUrl={taskPolygonUrl}
              completedPoints={completedPoints}
              trackingPath={trackingPath}
              onPointComplete={handleCompletePoint}
              onTaskNavigationInfoChange={setTaskNavigationInfo}
              surveyData={submittedSurveyMarkers}
              markerColor="#2563eb"
              markerLabel="titik propose"
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-800">Peta disembunyikan untuk menghemat ruang layar.</p>
              <p className="mt-1 text-[11px] text-slate-600">Tekan tombol <span className="font-semibold">Tampilkan Peta</span> untuk melihat marker survey, polygon tugas, GPS, dan tracking.</p>
            </div>
          )}
          <div className="mt-2 space-y-2">
            <CompactTaskStatusPanel
              isOutsideAssignedPolygon={isOutsideAssignedPolygon}
              isInsideAssignedPolygon={taskNavigationInfo?.geometryType === "polygon" ? taskNavigationInfo.isInsidePolygon : null}
              statusMessage={taskStatusMessage}
              targetLabel={taskNavigationInfo?.taskName || "-"}
              distanceLabel={distanceToTaskLabel}
              coordinateLabel={nearestTaskCoordinateLabel}
              accuracyLabel={gpsCoords && taskNavigationInfo?.hasTaskGeometry ? `Status area dihitung dari posisi GPS saat ini. Akurasi perangkat sekitar +/-${gpsCoords.accuracy.toFixed(1)} meter.` : ""}
              googleMapsUrl={googleMapsUrl}
            />
            <CompactRealtimePanel
              trackingEnabled={isTracking}
              hasGPS={Boolean(gpsCoords)}
              coordinatesLabel={coordinatesLabel}
              accuracyLabel={accuracyLabel}
              updatedAtLabel={updatedAtLabel}
            />
          </div>
        </div>

        {/* ID Titik */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">ID Titik</label>
          <select
            value={pilihIDTitik}
            onChange={(e) => handlePilihIDTitik(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 bg-white"
          >
            <option value="">Pilih Status ID Titik</option>
            <option value="Ada">Ada</option>
            <option value="Tidak Ada">Tidak Ada</option>
          </select>
          
          {/* Display selected ID Titik */}
          {formData.idTitik && (
            <div className="mt-3 p-3 bg-blue-50 border-2 border-blue-200 rounded-xl">
              <p className="text-sm text-gray-600 mb-1">ID Titik:</p>
              <p className="text-lg font-bold text-gray-900">{formData.idTitik}</p>
            </div>
          )}
        </div>

        {/* Daya Lampu */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">Daya Lampu</label>
          
          {/* Custom Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDayaLampuDropdown(!showDayaLampuDropdown)}
              className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 bg-white text-left flex items-center justify-between"
            >
              <span className={formData.dayaLampu ? "text-gray-900" : "text-gray-400"}>
                {formData.dayaLampu || "Pilih Daya Lampu"}
              </span>
              <svg 
                className={`w-5 h-5 text-gray-600 transition-transform ${showDayaLampuDropdown ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showDayaLampuDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-3">
                  <p className="text-sm font-bold text-gray-500 mb-3 px-3">Pilih Daya Lampu</p>
                  <div className="space-y-1">
                    {['120W', '90W', '60W', '40W'].map((watt) => (
                      <button
                        key={watt}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, dayaLampu: watt });
                          setShowDayaLampuDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl font-bold text-lg transition-all ${
                          formData.dayaLampu === watt
                            ? 'bg-blue-500 text-white'
                            : 'hover:bg-gray-100 text-gray-900'
                        }`}
                      >
                        {watt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Data Tiang */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">Data Tiang</label>
          
          {/* Custom Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDataTiangDropdown(!showDataTiangDropdown)}
              className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 bg-white text-left flex items-center justify-between"
            >
              <span className={formData.dataTiang ? "text-gray-900" : "text-gray-400"}>
                {formData.dataTiang || "Pilih Data Tiang"}
              </span>
              <svg 
                className={`w-5 h-5 text-gray-600 transition-transform ${showDataTiangDropdown ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showDataTiangDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-3">
                  <p className="text-sm font-bold text-gray-500 mb-3 px-3">Pilih Data Tiang</p>
                  <div className="space-y-1">
                    {['7S', '7D', '7SG', '9S', '9D', '9SG'].map((tiang) => (
                      <button
                        key={tiang}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, dataTiang: tiang });
                          setShowDataTiangDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl font-bold text-lg transition-all ${
                          formData.dataTiang === tiang
                            ? 'bg-blue-500 text-white'
                            : 'hover:bg-gray-100 text-gray-900'
                        }`}
                      >
                        {tiang}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Data Ruas */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">Data Ruas</label>
          
          {/* Custom Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDataRuasDropdown(!showDataRuasDropdown)}
              className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 bg-white text-left flex items-center justify-between"
            >
              <span className={formData.dataRuas ? "text-gray-900" : "text-gray-400"}>
                {formData.dataRuas || "Pilih Data Ruas"}
              </span>
              <svg 
                className={`w-5 h-5 text-gray-600 transition-transform ${showDataRuasDropdown ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showDataRuasDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-3">
                  <p className="text-sm font-bold text-gray-500 mb-3 px-3">Pilih Data Ruas</p>
                  <div className="space-y-1">
                    {['Arteri', 'Kolektor'].map((ruas) => (
                      <button
                        key={ruas}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, dataRuas: ruas, subRuas: "" });
                          setShowDataRuasDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl font-bold text-lg transition-all ${
                          formData.dataRuas === ruas
                            ? 'bg-blue-500 text-white'
                            : 'hover:bg-gray-100 text-gray-900'
                        }`}
                      >
                        {ruas}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sub Ruas - Only show if Kolektor is selected */}
        {formData.dataRuas === 'Kolektor' && (
          <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200 border-l-4 border-l-blue-400">
            <label className="block text-sm font-bold text-gray-700 mb-3">Sub Ruas</label>
            
            {/* Custom Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSubRuasDropdown(!showSubRuasDropdown)}
                className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 bg-white text-left flex items-center justify-between"
              >
                <span className={formData.subRuas ? "text-gray-900" : "text-gray-400"}>
                  {formData.subRuas || "Pilih Sub Ruas"}
                </span>
                <svg 
                  className={`w-5 h-5 text-gray-600 transition-transform ${showSubRuasDropdown ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showSubRuasDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-3">
                    <p className="text-sm font-bold text-gray-500 mb-3 px-3">Pilih Sub Ruas</p>
                    <div className="space-y-1">
                      {['Titik Nol', 'Kolektor A', 'Kolektor B', 'Wisata'].map((subRuas) => (
                        <button
                          key={subRuas}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, subRuas: subRuas });
                            setShowSubRuasDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-3 rounded-xl font-bold text-lg transition-all ${
                            formData.subRuas === subRuas
                              ? 'bg-blue-500 text-white'
                              : 'hover:bg-gray-100 text-gray-900'
                          }`}
                        >
                          {subRuas}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Median */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">Median</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMedianDropdown(!showMedianDropdown)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 bg-white flex items-center justify-between"
            >
              <span className={formData.median ? "text-gray-900" : "text-gray-500"}>
                {formData.median || "Pilih Status Median"}
              </span>
              <svg className={`w-5 h-5 transition-transform ${showMedianDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showMedianDropdown && (
              <div className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-300 rounded-xl shadow-lg max-h-60 overflow-auto">
                {["Ada", "Tidak Ada"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      handlePilihMedian(option);
                      setShowMedianDropdown(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors font-semibold text-gray-900 border-b border-gray-200 last:border-b-0"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
          {formData.median === "Ada" && formData.tinggiMedian && formData.lebarMedian && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-700">
                <span className="font-bold">Tinggi:</span> {formData.tinggiMedian} m
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-bold">Lebar:</span> {formData.lebarMedian} m
              </p>
            </div>
          )}
        </div>

        {kmzFileUrl && gpsCoords && (
          <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
            <label className="block text-sm font-bold text-gray-700 mb-3">Aksi Titik Tugas</label>
            <div className="mt-3 rounded-xl border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-gray-900 mb-1">Tandai Titik Selesai</h4>
                  <p className="text-xs text-gray-600 mb-3">
                    Klik tombol di bawah untuk menandai titik tugas terdekat sebagai selesai
                  </p>
                  <button
                    onClick={() => {
                      const activeTaskStr = localStorage.getItem("activeTask");
                      if (activeTaskStr && gpsCoords) {
                        const pointId = `point_manual_${Date.now()}`;
                        const pointName = "Titik Survey";
                        handleCompletePoint(pointId, pointName, gpsCoords.latitude, gpsCoords.longitude);
                      }
                    }}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 px-4 rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 active:scale-95"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Selesai Titik Ini
                  </button>
                  {completedPoints.length > 0 && (
                    <div className="mt-3 rounded-lg bg-green-100 px-3 py-2 text-xs font-semibold text-green-700">
                      {completedPoints.length} titik sudah diselesaikan
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Nama Jalan */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">Nama Jalan</label>
          <input
            type="text"
            value={formData.namaJalan}
            onChange={(e) => setFormData({ ...formData, namaJalan: e.target.value })}
            placeholder="Masukkan nama jalan..."
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 placeholder:text-gray-500"
          />
        </div>

        {/* Lebar Jalan */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">Lebar Jalan</label>
          <input
            type="text"
            value={formData.lebarJalan}
            onChange={(e) => setFormData({ ...formData, lebarJalan: e.target.value })}
            placeholder="Masukkan Lebar Jalan"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 placeholder:text-gray-500"
          />
        </div>

        {/* Jarak Antar Tiang */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">Jarak Antar Tiang (m)</label>
          <input
            type="number"
            step="0.1"
            value={formData.jarakAntarTiang}
            onChange={(e) => setFormData({ ...formData, jarakAntarTiang: e.target.value })}
            placeholder="0"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 placeholder:text-gray-500"
          />
        </div>

        {/* Lebar Bahu Bertiang */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">Lebar Bahu Bertiang (m)</label>
          <input
            type="number"
            step="0.1"
            value={formData.lebarBahuBertiang}
            onChange={(e) => setFormData({ ...formData, lebarBahuBertiang: e.target.value })}
            placeholder="0"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 placeholder:text-gray-500"
          />
        </div>

        {/* Lebar Trotoar Bertiang */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">Lebar Trotoar Bertiang (m)</label>
          <input
            type="number"
            step="0.1"
            value={formData.lebarTrotoarBertiang}
            onChange={(e) => setFormData({ ...formData, lebarTrotoarBertiang: e.target.value })}
            placeholder="0"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 placeholder:text-gray-500"
          />
        </div>

        {/* Lainnya Bertiang */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">Lainnya Bertiang</label>
          <input
            type="number"
            step="0.1"
            value={formData.lainnyaBertiang}
            onChange={(e) => setFormData({ ...formData, lainnyaBertiang: e.target.value })}
            placeholder="0"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 placeholder:text-gray-500"
          />
        </div>

        {/* Foto Titik Aktual */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">Foto Titik Aktual</label>
          <p className="text-xs text-gray-500 mb-3">Ambil foto kondisi aktual titik yang akan disurvey APJ</p>
          <div className="space-y-3">
            {fotoTitikActual && (
              <div className="relative w-full h-48 rounded-xl overflow-hidden border-2 border-gray-200">
                <Image src={fotoTitikActual} alt="Foto Titik Aktual" fill className="object-cover" />
              </div>
            )}
            <label className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl cursor-pointer transition-all active:scale-95 shadow-md">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Pilih Foto
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleFileUpload(e, "titikActual")}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Foto Kemerataan */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">Foto Kemerataan</label>
          <p className="text-xs text-gray-500 mb-3">Ambil dari galeri untuk dokumentasi kemerataan pencahayaan</p>
          <div className="space-y-3">
            {fotoKemerataan && (
              <div className="relative w-full h-48 rounded-xl overflow-hidden border-2 border-gray-200">
                <Image src={fotoKemerataan} alt="Foto Kemerataan" fill className="object-cover" />
              </div>
            )}
            <label className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl cursor-pointer transition-all active:scale-95 shadow-md">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Buka Galeri
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, "kemerataan")}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Keterangan */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">Keterangan</label>
          <textarea
            value={formData.keterangan}
            onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
            placeholder="Tambahkan catatan atau keterangan tambahan..."
            rows={4}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 placeholder:text-gray-500 resize-none"
          />
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 text-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Simpan
        </button>
      </main>

      {showKabupatenPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Pilih Kabupaten</h3>
              <p className="text-sm text-gray-600">Pilih lokasi kerja agar data terfokus dan tidak tercampur.</p>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {KABUPATEN_OPTIONS.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => handleKabupatenPick(k.id)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      activeKabupaten === k.id
                        ? "border-blue-400 bg-blue-50 shadow-sm"
                        : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/40"
                    }`}
                  >
                    <div className="text-base font-bold text-gray-900">{k.name}</div>
                    <div className="text-xs text-gray-600 mt-1">{k.description}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex items-center justify-end">
              {activeKabupaten && (
                <button
                  onClick={() => setShowKabupatenPicker(false)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50"
                >
                  Batal
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showKabupatenConfirm && pendingKabupaten && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Konfirmasi Kabupaten</h3>
              <p className="text-sm text-gray-600">
                Kamu akan bekerja di: <span className="font-semibold text-gray-900">{pendingKabupatenName}</span>
              </p>
            </div>
            <div className="p-5 flex items-center justify-end gap-2">
              <button
                onClick={handleKabupatenCancel}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleKabupatenConfirm}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
              >
                Mulai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SurveyAPJProposePage() {
  return (
    <ProtectedRoute>
      <SurveyAPJProposeContent />
    </ProtectedRoute>
  );
}

export default SurveyAPJProposePage;





