"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Image from "next/image";
import dynamic from "next/dynamic";
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, updateDoc, doc } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

interface GPSCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

// Dynamic import for Map component (SSR disabled for Leaflet)
const DynamicMap = dynamic<{ 
  latitude: number | null; 
  longitude: number | null; 
  accuracy: number;
  hasGPS: boolean;
  kmzFileUrl?: string;
  completedPoints?: string[];
  onPointComplete?: (pointId: string, pointName: string, lat: number, lng: number) => void;
}>(
  () => import("@/components/GPSMap"),
  { 
    ssr: false,
    loading: () => (
      <div className="rounded-xl overflow-hidden border-2 border-blue-200 shadow-lg flex items-center justify-center bg-gray-100" style={{ height: '300px' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Memuat peta...</p>
        </div>
      </div>
    )
  }
);

// Dynamic import for Survey Existing Map
const DynamicSurveyMap = dynamic(
  () => import("@/components/SurveyExistingMap"),
  { 
    ssr: false,
    loading: () => (
      <div className="rounded-xl overflow-hidden border-2 border-green-200 shadow-lg flex items-center justify-center bg-gray-100" style={{ height: '400px' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Memuat peta survey...</p>
        </div>
      </div>
    )
  }
);

function SurveyExistingContent() {
  const router = useRouter();
  const { user } = useAuth();

  const [gpsCoords, setGpsCoords] = useState<GPSCoordinates | null>(null);
  const [isGPSActive, setIsGPSActive] = useState(false);
  const [fotoTiangAPM, setFotoTiangAPM] = useState<string>("");
  const [fotoTitikActual, setFotoTitikActual] = useState<string>("");
  const [showLokasiModal, setShowLokasiModal] = useState(false);
  const [tempNamaJalan, setTempNamaJalan] = useState("");
  const [tempNamaGang, setTempNamaGang] = useState("");
  const [showLebarJalanModal, setShowLebarJalanModal] = useState(false);
  const [tempLebarJalan1, setTempLebarJalan1] = useState("");
  const [tempLebarJalan2, setTempLebarJalan2] = useState("");
  const [showKepemilikanModal, setShowKepemilikanModal] = useState(false);
  const [showJenisTiangPLNModal, setShowJenisTiangPLNModal] = useState(false);
  const [selectedKepemilikan, setSelectedKepemilikan] = useState("");
  const [showTrafoModal, setShowTrafoModal] = useState(false);
  const [showJenisTrafoModal, setShowJenisTrafoModal] = useState(false);
  const [showLampuModal, setShowLampuModal] = useState(false);
  const [showJumlahLampuModal, setShowJumlahLampuModal] = useState(false);
  const [showJenisLampuModal, setShowJenisLampuModal] = useState(false);
  const [selectedJumlahLampu, setSelectedJumlahLampu] = useState("");
  const [showMedianModal, setShowMedianModal] = useState(false);
  const [showDetailMedianModal, setShowDetailMedianModal] = useState(false);
  const [tempTinggiMedian, setTempTinggiMedian] = useState("");
  const [tempLebarMedian, setTempLebarMedian] = useState("");
  
  // State for jenis existing
  const [jenisExisting, setJenisExisting] = useState<"Murni" | "Tidak Murni" | "">("");
  
  // State for survey data
  const [surveyData, setSurveyData] = useState<any[]>([]);
  const [loadingSurveys, setLoadingSurveys] = useState(true);
  
  // State for submit loading
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState("");

  // State for KMZ file from active task
  const [kmzFileUrl, setKmzFileUrl] = useState<string | undefined>(undefined);

  // State for completed task points
  const [completedPoints, setCompletedPoints] = useState<string[]>([]);
  
  // State for GPS tracking
  const [isTracking, setIsTracking] = useState(false);
  const [trackingPath, setTrackingPath] = useState<Array<{lat: number, lng: number, timestamp: number}>>([]);
  const [trackingSessionId, setTrackingSessionId] = useState<string | null>(null);
  const [trackingInterval, setTrackingInterval] = useState<NodeJS.Timeout | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    lokasiJalan: "",
    namaJalan: "",
    namaGang: "",
    keteranganTiang: "",
    jenisTitik: "",
    palet: "",
    lumina: "",
    metodeUkur: "",
    tinggiMedian: "",
    lebarMedian: "",
    medianDisplay: "",
    lebarJalan1: "",
    lebarJalan2: "",
    lebarJalanDisplay: "",
    lebarTrotoar: "",
    lamnyaBerdekatan: "",
    tinggiAPM: "",
    keterangan: "",
    lebarBahuBertiang: "",
    lebarTrotoarBertiang: "",
    lainnyaBertiang: "",
    tinggiARM: "",
  });

  // Handle save location from modal
  const handleSaveLokasi = () => {
    if (!tempNamaJalan.trim()) {
      alert("Nama jalan harus diisi");
      return;
    }
    setFormData({ 
      ...formData, 
      namaJalan: tempNamaJalan,
      namaGang: tempNamaGang,
      lokasiJalan: tempNamaGang ? `${tempNamaJalan} - ${tempNamaGang}` : tempNamaJalan
    });
    setShowLokasiModal(false);
  };

  // Handle save lebar jalan from modal
  const handleSaveLebarJalan = () => {
    if (!tempLebarJalan1.trim()) {
      alert("Lebar jalan 1 harus diisi");
      return;
    }
    const display = tempLebarJalan2 
      ? `${tempLebarJalan1}m, ${tempLebarJalan2}m` 
      : `${tempLebarJalan1}m`;
    setFormData({ 
      ...formData, 
      lebarJalan1: tempLebarJalan1,
      lebarJalan2: tempLebarJalan2,
      lebarJalanDisplay: display
    });
    setShowLebarJalanModal(false);
  };

  // Handle kepemilikan selection
  const handleKepemilikanSelect = (kepemilikan: string) => {
    setSelectedKepemilikan(kepemilikan);
    setShowKepemilikanModal(false);
    
    if (kepemilikan === "PLN") {
      // Show second modal for PLN type
      setShowJenisTiangPLNModal(true);
    } else {
      // For Pemko or Swadaya, directly save
      setFormData({ ...formData, keteranganTiang: kepemilikan });
    }
  };

  // Handle PLN type selection
  const handlePLNTypeSelect = (type: string) => {
    const fullName = type === "Tiang TR" ? "PLN - Tiang TR" : "PLN - Tiang TM";
    setFormData({ ...formData, keteranganTiang: fullName });
    setShowJenisTiangPLNModal(false);
  };

  // Handle trafo selection
  const handleTrafoSelect = (trafo: string) => {
    setShowTrafoModal(false);
    
    if (trafo === "Ada") {
      // Show second modal for trafo type
      setShowJenisTrafoModal(true);
    } else {
      // For Tidak Ada, directly save
      setFormData({ ...formData, palet: "Tidak Ada" });
    }
  };

  // Handle trafo type selection
  const handleTrafoTypeSelect = (type: string) => {
    const fullName = type === "Double" ? "Trafo Double Phase" : "Trafo Single Phase";
    setFormData({ ...formData, palet: fullName });
    setShowJenisTrafoModal(false);
  };

  // Handle lampu selection
  const handleLampuSelect = (lampu: string) => {
    setShowLampuModal(false);
    
    if (lampu === "Ada") {
      // Show second modal for quantity
      setShowJumlahLampuModal(true);
    } else {
      // For Tidak Ada, directly save
      setFormData({ ...formData, lumina: "Tidak Ada" });
    }
  };

  // Handle jumlah lampu selection
  const handleJumlahLampuSelect = (jumlah: string) => {
    setSelectedJumlahLampu(jumlah);
    setShowJumlahLampuModal(false);
    // Show third modal for lamp type
    setShowJenisLampuModal(true);
  };

  // Handle jenis lampu selection
  const handleJenisLampuSelect = (jenis: string) => {
    const fullName = `${selectedJumlahLampu} - ${jenis}`;
    setFormData({ ...formData, lumina: fullName });
    setShowJenisLampuModal(false);
  };

  // Handle median selection
  const handleMedianSelect = (median: string) => {
    setShowMedianModal(false);
    
    if (median === "Ada") {
      // Show second modal for detail input
      setShowDetailMedianModal(true);
    } else {
      // For Tidak Ada, directly save
      setFormData({ ...formData, metodeUkur: "Tidak Ada", tinggiMedian: "", lebarMedian: "", medianDisplay: "" });
    }
  };

  // Handle save median detail
  const handleSaveMedian = () => {
    if (!tempTinggiMedian.trim()) {
      alert("Tinggi median harus diisi");
      return;
    }
    if (!tempLebarMedian.trim()) {
      alert("Lebar median harus diisi");
      return;
    }
    const display = `Tinggi: ${tempTinggiMedian}m, Lebar: ${tempLebarMedian}m`;
    setFormData({ 
      ...formData, 
      metodeUkur: "Ada",
      tinggiMedian: tempTinggiMedian,
      lebarMedian: tempLebarMedian,
      medianDisplay: display
    });
    setShowDetailMedianModal(false);
  };

  // Options for dropdowns
  const options = {
    keteranganTiang: ["Tiang Baru", "Tiang Existing", "Tiang Rusak"],
    jenisTiang: ["Besi", "Beton", "Kayu"],
    palet: ["Palet A", "Palet B", "Palet C"],
    lumina: ["LED 40W", "LED 60W", "LED 80W", "LED 100W"],
    metodeUkur: ["Manual", "Digital"],
  };

  // Auto-activate GPS on page load
  useEffect(() => {
    // Check if geolocation is available
    if ("geolocation" in navigator) {
      setIsGPSActive(true);
    } else {
      console.warn("Geolocation is not supported by this browser.");
    }
  }, []);

  // Load KMZ file URL from active task
  useEffect(() => {
    const activeTaskStr = localStorage.getItem("activeTask");
    if (activeTaskStr) {
      try {
        const activeTask = JSON.parse(activeTaskStr);
        // For existing survey, use kmzFileUrl2
        if (activeTask.kmzFileUrl2) {
          setKmzFileUrl(activeTask.kmzFileUrl2);
          console.log("KMZ file loaded for existing survey:", activeTask.kmzFileUrl2);
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
      (window as any).completeTaskPoint = (pointId: string, pointName: string, lat: number, lng: number) => {
        handleCompletePoint(pointId, pointName, lat, lng);
      };
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).completeTaskPoint;
      }
    };
  }, [handleCompletePoint]);

  // Fetch all survey data
  useEffect(() => {
    const fetchSurveyData = async () => {
      try {
        setLoadingSurveys(true);
        const surveysRef = collection(db, "survey-existing");
        const q = query(surveysRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        const surveys = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        setSurveyData(surveys);
      } catch (error) {
        console.error("Error fetching surveys:", error);
      } finally {
        setLoadingSurveys(false);
      }
    };

    fetchSurveyData();
  }, []);

  // Start GPS tracking with continuous updates
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
      reader.onload = (e) => {
        const img = document.createElement("img");
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            if (!ctx) {
              reject(new Error("Failed to get canvas context"));
              return;
            }

            // Resize if needed (max 1920px)
            let width = img.width;
            let height = img.height;
            const maxSize = 1920;

            if (width > maxSize || height > maxSize) {
              if (width > height) {
                height = (height / width) * maxSize;
                width = maxSize;
              } else {
                width = (width / height) * maxSize;
                height = maxSize;
              }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

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
          } catch (error) {
            reject(error);
          }
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "tiangAPM" | "titikActual"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if browser supports canvas
    if (typeof document === 'undefined' || !document.createElement('canvas').getContext) {
      alert("Browser Anda tidak mendukung konversi gambar");
      return;
    }

    try {
      const webpUrl = await convertToWebP(file);
      if (type === "tiangAPM") {
        setFotoTiangAPM(webpUrl);
      } else {
        setFotoTitikActual(webpUrl);
      }
    } catch (error) {
      console.error("Error converting image:", error);
      alert("Gagal mengkonversi gambar. Silakan coba dengan gambar lain.");
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
      // Create new tracking session in Firebase
      const trackingData = {
        userId: user.uid,
        userName: user.displayName || user.email,
        userEmail: user.email,
        startTime: serverTimestamp(),
        endTime: null,
        status: "active",
        path: [{
          lat: gpsCoords.latitude,
          lng: gpsCoords.longitude,
          timestamp: Date.now(),
          accuracy: gpsCoords.accuracy
        }],
        totalDistance: 0,
        surveyType: "existing"
      };

      const docRef = await addDoc(collection(db, "tracking-sessions"), trackingData);
      setTrackingSessionId(docRef.id);
      setIsTracking(true);
      setTrackingPath([{
        lat: gpsCoords.latitude,
        lng: gpsCoords.longitude,
        timestamp: Date.now()
      }]);

      // Start interval to record GPS position every 15 seconds
      const interval = setInterval(async () => {
        if (gpsCoords && docRef.id) {
          const newPoint = {
            lat: gpsCoords.latitude,
            lng: gpsCoords.longitude,
            timestamp: Date.now(),
            accuracy: gpsCoords.accuracy
          };

          setTrackingPath(prev => [...prev, newPoint]);

          // Update Firebase with new point
          try {
            const trackingRef = doc(db, "tracking-sessions", docRef.id);
            await updateDoc(trackingRef, {
              path: [...trackingPath, newPoint],
              lastUpdate: serverTimestamp()
            });
            console.log("📍 Tracking point saved");
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

      // Update Firebase - mark as completed
      const trackingRef = doc(db, "tracking-sessions", trackingSessionId);
      await updateDoc(trackingRef, {
        endTime: serverTimestamp(),
        status: "completed",
        path: trackingPath.map(p => ({
          lat: p.lat,
          lng: p.lng,
          timestamp: p.timestamp
        })),
        totalDistance: totalDistance,
        pointsCount: trackingPath.length,
        duration: trackingPath.length > 0 ? 
          (trackingPath[trackingPath.length - 1].timestamp - trackingPath[0].timestamp) / 1000 : 0 // in seconds
      });

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

  const handleSubmit = async () => {
    if (!gpsCoords) {
      alert("Harap aktifkan dan verifikasi GPS terlebih dahulu");
      return;
    }

    // Validate jenis existing
    if (!jenisExisting) {
      alert("Mohon pilih Jenis Existing (Murni atau Tidak Murni)");
      return;
    }

    // Validate required fields
    const required = ["lokasiJalan", "namaJalan", "keteranganTiang"];
    const missing = required.filter((field) => !formData[field as keyof typeof formData]);

    if (missing.length > 0) {
      alert("Mohon lengkapi semua field yang wajib diisi");
      return;
    }

    if (!fotoTiangAPM || !fotoTitikActual) {
      alert("Mohon upload kedua foto (Tiang APM dan Titik Actual)");
      return;
    }

    try {
      // Check user authentication
      if (!user?.uid) {
        alert("User tidak terautentikasi. Silakan login kembali.");
        router.push("/admin/login");
        return;
      }

      console.log("User authenticated:", user.email, user.uid);
      
      // Start loading
      setIsSubmitting(true);
      setSubmitProgress("Mempersiapkan data...");
      
      // Check canvas support
      if (typeof document === 'undefined' || !document.createElement('canvas').getContext) {
        throw new Error("Browser tidak mendukung konversi gambar");
      }
      
      // Convert images to WebP format
      setSubmitProgress("Mengkonversi gambar ke WebP...");
      const fotoTiangAPMWebP = await convertImageToWebP(fotoTiangAPM);
      const fotoTitikActualWebP = await convertImageToWebP(fotoTitikActual);

      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const userName = user?.displayName || user?.email?.split('@')[0] || 'user';
      
      console.log("Uploading to Firebase Storage...");
      
      // Upload Foto Tiang APM to Firebase Storage
      setSubmitProgress("Mengupload foto Tiang APM...");
      const tiangAPMRef = ref(storage, `survey-existing/${userName}_tiang_apm_${timestamp}.webp`);
      await uploadString(tiangAPMRef, fotoTiangAPMWebP, 'data_url');
      const tiangAPMUrl = await getDownloadURL(tiangAPMRef);
      
      console.log("Tiang APM uploaded:", tiangAPMUrl);

      // Upload Foto Titik Actual to Firebase Storage
      setSubmitProgress("Mengupload foto Titik Actual...");
      const titikActualRef = ref(storage, `survey-existing/${userName}_titik_actual_${timestamp}.webp`);
      await uploadString(titikActualRef, fotoTitikActualWebP, 'data_url');
      const titikActualUrl = await getDownloadURL(titikActualRef);
      
      console.log("Titik Actual uploaded:", titikActualUrl);

      // Save to Firestore
      setSubmitProgress("Menyimpan data ke database...");
      const surveyData = {
        // Jenis Existing (NEW)
        jenisExisting: jenisExisting,
        
        // Form data
        lokasiJalan: formData.lokasiJalan,
        namaJalan: formData.namaJalan,
        namaGang: formData.namaGang,
        keteranganTiang: formData.keteranganTiang,
        jenisTitik: formData.jenisTitik,
        palet: formData.palet,
        lumina: formData.lumina,
        metodeUkur: formData.metodeUkur,
        tinggiMedian: formData.tinggiMedian,
        lebarMedian: formData.lebarMedian,
        medianDisplay: formData.medianDisplay,
        lebarJalan1: formData.lebarJalan1,
        lebarJalan2: formData.lebarJalan2,
        lebarJalanDisplay: formData.lebarJalanDisplay,
        lebarTrotoar: formData.lebarTrotoar,
        lamnyaBerdekatan: formData.lamnyaBerdekatan,
        tinggiAPM: formData.tinggiAPM,
        keterangan: formData.keterangan,
        lebarBahuBertiang: formData.lebarBahuBertiang,
        lebarTrotoarBertiang: formData.lebarTrotoarBertiang,
        lainnyaBertiang: formData.lainnyaBertiang,
        tinggiARM: formData.tinggiARM,
        
        // GPS coordinates
        latitude: gpsCoords.latitude,
        longitude: gpsCoords.longitude,
        accuracy: gpsCoords.accuracy,
        
        // Photo URLs
        fotoTiangAPM: tiangAPMUrl,
        fotoTitikActual: titikActualUrl,
        
        // Metadata
        type: "existing",
        status: "menunggu",
        surveyorName: user?.displayName || user?.email || "Unknown",
        surveyorEmail: user?.email,
        surveyorUid: user?.uid,
        createdAt: serverTimestamp(),
        title: `Survey Existing - ${formData.namaJalan}`,
        
        // Additional fields for compatibility
        kepemilikan: formData.keteranganTiang,
        jenis: formData.jenisTitik || "N/A",
        tinggiArm: formData.tinggiARM || "N/A",
        zona: "Existing",
        kategori: "Survey Existing",
      };

      await addDoc(collection(db, "survey-existing"), surveyData);

      // Refresh survey data to update map
      setSubmitProgress("Memperbarui peta...");
      const surveysRef = collection(db, "survey-existing");
      const q = query(surveysRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const surveys = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSurveyData(surveys);
      
      setSubmitProgress("Berhasil disimpan!");
      
      // Wait a bit to show success message
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIsSubmitting(false);
      alert("Survey berhasil disimpan!");
      router.push("/survey-selection");
    } catch (error: any) {
      console.error("Error saving survey:", error);
      setIsSubmitting(false);
      
      // More specific error messages
      let errorMessage = "Gagal menyimpan survey. Silakan coba lagi.";
      if (error.message?.includes("canvas")) {
        errorMessage = "Gagal mengkonversi gambar. Browser Anda mungkin tidak mendukung fitur ini.";
      } else if (error.message?.includes("storage/unauthorized")) {
        errorMessage = "Tidak memiliki akses untuk mengupload gambar. Silakan login kembali.";
      } else if (error.message?.includes("Failed to load image")) {
        errorMessage = "Gagal memuat gambar. Pastikan format gambar valid.";
      }
      
      alert(errorMessage);
    }
  };

  // Helper function to convert image to WebP
  const convertImageToWebP = async (base64Image: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!base64Image) {
        reject(new Error('Base64 image is empty'));
        return;
      }

      const img = document.createElement('img');
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          // Clear canvas first
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Draw image
          ctx.drawImage(img, 0, 0);
          
          // Convert to WebP with quality 0.8
          const webpBase64 = canvas.toDataURL('image/webp', 0.8);
          
          if (!webpBase64) {
            reject(new Error('Failed to convert to WebP'));
            return;
          }
          
          resolve(webpBase64);
        } catch (error) {
          reject(error);
        }
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
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">Survey Existing</h1>
                <p className="text-xs text-gray-600">Form survey penerangan existing</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Map Section - Data Survey yang Sudah Diinput */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Peta Survey Existing</h2>
                  <p className="text-xs text-gray-600">Lokasi survey yang sudah diinput</p>
                </div>
              </div>
              <div className="bg-green-50 px-3 py-1.5 rounded-lg">
                <span className="text-sm font-bold text-green-700">{surveyData.length} Titik</span>
              </div>
            </div>
            
            {loadingSurveys ? (
              <div className="rounded-xl overflow-hidden border-2 border-green-200 shadow-lg flex items-center justify-center bg-gray-100" style={{ height: '400px' }}>
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
                  <p className="text-gray-500 text-sm">Memuat data survey...</p>
                </div>
              </div>
            ) : surveyData.length === 0 ? (
              <div className="rounded-xl overflow-hidden border-2 border-gray-200 shadow-sm flex items-center justify-center bg-gray-50" style={{ height: '400px' }}>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                  <p className="text-gray-600 font-medium">Belum ada data survey</p>
                  <p className="text-gray-500 text-sm mt-1">Survey yang diinput akan muncul di peta ini</p>
                </div>
              </div>
            ) : (
              <DynamicSurveyMap 
                surveyData={surveyData} 
                kmzFileUrl={kmzFileUrl}
                currentPosition={gpsCoords ? { lat: gpsCoords.latitude, lng: gpsCoords.longitude } : null}
                completedPoints={completedPoints}
                onPointComplete={handleCompletePoint}
              />
            )}
          </div>
          
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="text-xs text-blue-800">
              <p className="font-semibold mb-1">Informasi Peta:</p>
              <ul className="space-y-0.5 list-disc list-inside">
                <li>Marker hijau menunjukkan lokasi survey yang sudah diinput</li>
                <li>Klik marker untuk melihat detail survey</li>
                <li>Data akan terupdate otomatis setelah submit survey baru</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Jenis Existing - NEW */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-md p-5 border-2 border-purple-300">
          <label className="block text-sm font-bold text-gray-900 mb-3">
            Jenis Existing <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setJenisExisting("Murni")}
              className={`px-4 py-3.5 rounded-xl font-bold transition-all border-2 ${
                jenisExisting === "Murni"
                  ? "bg-purple-600 text-white border-purple-600 shadow-lg"
                  : "bg-white text-gray-700 border-gray-300 hover:border-purple-400 hover:bg-purple-50"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Murni
              </div>
            </button>
            <button
              type="button"
              onClick={() => setJenisExisting("Tidak Murni")}
              className={`px-4 py-3.5 rounded-xl font-bold transition-all border-2 ${
                jenisExisting === "Tidak Murni"
                  ? "bg-orange-600 text-white border-orange-600 shadow-lg"
                  : "bg-white text-gray-700 border-gray-300 hover:border-orange-400 hover:bg-orange-50"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Tidak Murni
              </div>
            </button>
          </div>
          {jenisExisting && (
            <div className={`mt-3 p-3 rounded-lg border-2 ${
              jenisExisting === "Murni" 
                ? "bg-purple-100 border-purple-300" 
                : "bg-orange-100 border-orange-300"
            }`}>
              <p className="text-sm font-semibold text-gray-900">
                {jenisExisting === "Murni" 
                  ? "✓ Semua form akan ditampilkan" 
                  : "⚠️ Beberapa form akan disembunyikan:"}
              </p>
              {jenisExisting === "Tidak Murni" && (
                <ul className="text-xs text-orange-700 list-disc list-inside space-y-1 ml-2 mt-2">
                  <li>Lebar Bahu Bertiang</li>
                  <li>Lebar Trotoar Bertiang</li>
                  <li>Lainnya Bertiang</li>
                  <li>Tinggi ARM</li>
                  <li>Lebar Trotoar Berdekatan</li>
                  <li>Lamnya Berdekatan</li>
                  <li>Tinggi APM</li>
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Pilih Lokasi Jalan/Gang - Modal Trigger */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">
            Pilih lokasi jalan/gang <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={() => {
              setTempNamaJalan(formData.namaJalan);
              setTempNamaGang(formData.namaGang);
              setShowLokasiModal(true);
            }}
            className="w-full px-4 py-3.5 border-2 border-gray-900 rounded-2xl hover:bg-gray-50 transition-all font-semibold text-gray-900 text-left flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <span className={formData.lokasiJalan ? "text-gray-900" : "text-gray-500"}>
                {formData.lokasiJalan || "Pilih lokasi jalan/gang"}
              </span>
            </div>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Display selected location info */}
        {formData.lokasiJalan && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-bold text-gray-900">Masukkan Lokasi Jalan & Gang</p>
                <p className="text-sm text-blue-700 mt-1"><span className="font-semibold">Nama Jalan:</span> {formData.namaJalan}</p>
                {formData.namaGang && (
                  <p className="text-sm text-blue-700"><span className="font-semibold">Nama Gang:</span> {formData.namaGang}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Lebar Jalan - Modal Trigger */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">Pilih lebar jalan</label>
          <button
            type="button"
            onClick={() => {
              setTempLebarJalan1(formData.lebarJalan1);
              setTempLebarJalan2(formData.lebarJalan2);
              setShowLebarJalanModal(true);
            }}
            className="w-full px-4 py-3.5 border-2 border-gray-900 rounded-2xl hover:bg-gray-50 transition-all font-semibold text-gray-900 text-left flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className={formData.lebarJalanDisplay ? "text-gray-900" : "text-gray-500"}>
                {formData.lebarJalanDisplay || "Pilih lebar jalan"}
              </span>
            </div>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Display selected lebar jalan info */}
        {formData.lebarJalanDisplay && (
          <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-gray-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <div>
                <p className="text-sm font-bold text-gray-900">Masukkan Lebar Jalan</p>
                <p className="text-sm text-gray-700 mt-1">Isi lebar jalan dalam meter</p>
                <p className="text-sm text-gray-900 font-semibold mt-2"><span className="text-gray-600">Lebar Jalan 1:</span> {formData.lebarJalan1}m</p>
                {formData.lebarJalan2 && (
                  <p className="text-sm text-gray-900 font-semibold"><span className="text-gray-600">Lebar Jalan 2:</span> {formData.lebarJalan2}m</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Keterangan Tiang - Modal Trigger */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">
            Kepemilikan Tiang <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={() => setShowKepemilikanModal(true)}
            className="w-full px-4 py-3.5 border-2 border-gray-900 rounded-2xl hover:bg-gray-50 transition-all font-semibold text-gray-900 text-left flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
              </svg>
              <span className={formData.keteranganTiang ? "text-gray-900" : "text-gray-500"}>
                {formData.keteranganTiang || "Pilih Kepemilikan Tiang"}
              </span>
            </div>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Display selected kepemilikan info */}
        {formData.keteranganTiang && (
          <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-orange-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
              </svg>
              <div>
                <p className="text-sm font-bold text-gray-900">Kepemilikan Tiang</p>
                <p className="text-sm text-orange-700 mt-1 font-semibold">{formData.keteranganTiang}</p>
              </div>
            </div>
          </div>
        )}

        {/* Jenis Tiang */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">Jenis Tiang</label>
          <select
            value={formData.jenisTitik}
            onChange={(e) => setFormData({ ...formData, jenisTitik: e.target.value })}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold bg-white text-gray-900"
          >
            <option value="" className="text-gray-500">Pilih Jenis Tiang</option>
            {options.jenisTiang.map((opt) => (
              <option key={opt} value={opt} className="text-gray-900">{opt}</option>
            ))}
          </select>
        </div>

        {/* Trafo - Modal Trigger */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">Trafo</label>
          <button
            type="button"
            onClick={() => setShowTrafoModal(true)}
            className="w-full px-4 py-3.5 border-2 border-gray-900 rounded-2xl hover:bg-gray-50 transition-all font-semibold text-gray-900 text-left flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
              </svg>
              <span className={formData.palet ? "text-gray-900" : "text-gray-500"}>
                {formData.palet || "Tidak Ada"}
              </span>
            </div>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Display selected trafo info */}
        {formData.palet && formData.palet !== "Tidak Ada" && (
          <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-purple-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
              </svg>
              <div>
                <p className="text-sm font-bold text-gray-900">Trafo - Pilih Jenis</p>
                <p className="text-sm text-gray-600">Pilih jenis trafo yang tersedia</p>
                <p className="text-sm text-purple-700 mt-2 font-semibold">{formData.palet}</p>
              </div>
            </div>
          </div>
        )}

        {/* Lampu - Modal Trigger */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">Lampu</label>
          <button
            type="button"
            onClick={() => setShowLampuModal(true)}
            className="w-full px-4 py-3.5 border-2 border-gray-900 rounded-2xl hover:bg-gray-50 transition-all font-semibold text-gray-900 text-left flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
              </svg>
              <span className={formData.lumina ? "text-gray-900" : "text-gray-500"}>
                {formData.lumina || "Tidak Ada"}
              </span>
            </div>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Display selected lampu info */}
        {formData.lumina && formData.lumina !== "Tidak Ada" && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
              </svg>
              <div>
                <p className="text-sm font-bold text-gray-900">Lampu - Pilih Jenis</p>
                <p className="text-sm text-gray-600">Pilih jenis lampu yang digunakan</p>
                <p className="text-sm text-yellow-700 mt-2 font-semibold">{formData.lumina}</p>
              </div>
            </div>
          </div>
        )}

        {/* Median Jalan - Modal Trigger */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">Median Jalan</label>
          <button
            type="button"
            onClick={() => {
              setTempTinggiMedian(formData.tinggiMedian);
              setTempLebarMedian(formData.lebarMedian);
              setShowMedianModal(true);
            }}
            className="w-full px-4 py-3.5 border-2 border-gray-900 rounded-2xl hover:bg-gray-50 transition-all font-semibold text-gray-900 text-left flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              <span className={formData.metodeUkur ? "text-gray-900" : "text-gray-500"}>
                {formData.metodeUkur === "Ada" ? formData.medianDisplay : formData.metodeUkur || "Pilih Median Jalan"}
              </span>
            </div>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Display selected median info */}
        {formData.metodeUkur === "Ada" && formData.medianDisplay && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-bold text-gray-900">Masukkan Detail Median</p>
                <p className="text-sm text-gray-600">Isi tinggi dan lebar median jalan</p>
                <p className="text-sm text-amber-700 mt-2 font-semibold">Tinggi Median: {formData.tinggiMedian}m</p>
                <p className="text-sm text-amber-700 font-semibold">Lebar Median: {formData.lebarMedian}m</p>
              </div>
            </div>
          </div>
        )}

        {/* Titik Koordinat */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <div className="mb-3">
            <label className="block text-sm font-bold text-gray-700 mb-2">Titik Koordinat & Tracking</label>
            <div className="flex gap-2">
              <button
                onClick={() => setIsGPSActive(!isGPSActive)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                  isGPSActive
                    ? "bg-green-500 text-white shadow-lg"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {isGPSActive ? (
                  <>
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    GPS Aktif
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    Aktifkan GPS
                  </>
                )}
              </button>

              <button
                onClick={isTracking ? stopTracking : startTracking}
                disabled={!isGPSActive || !gpsCoords}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                  isTracking
                    ? "bg-red-500 text-white shadow-lg"
                    : isGPSActive && gpsCoords
                    ? "bg-blue-500 text-white hover:bg-blue-600 shadow-md"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                {isTracking ? (
                  <>
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    Stop Tracking
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Mulai Tracking
                  </>
                )}
              </button>
            </div>
            
            {/* Tracking Info */}
            {isTracking && (
              <div className="mt-2 bg-red-50 border-2 border-red-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-bold text-red-700">Tracking Aktif</span>
                </div>
                <p className="text-xs text-red-600">
                  📍 {trackingPath.length} titik terekam • Setiap 15 detik
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {/* Map Display - Always show, with GPS marker when active */}
            <DynamicMap 
              latitude={gpsCoords?.latitude ?? null}
              longitude={gpsCoords?.longitude ?? null}
              accuracy={gpsCoords?.accuracy ?? 0}
              hasGPS={isGPSActive && gpsCoords !== null}
              kmzFileUrl={kmzFileUrl}
              completedPoints={completedPoints}
              onPointComplete={handleCompletePoint}
            />

            {/* GPS Status & Coordinate Info */}
            {isGPSActive && gpsCoords ? (
              <>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-bold text-gray-700">Pelacakan real-time aktif</span>
                    </div>
                    <span className="text-xs text-green-600 font-bold">✓ Terverifikasi</span>
                  </div>
                  <p className="text-lg font-mono font-bold text-gray-900 bg-white px-3 py-2 rounded-lg mt-2">
                    {gpsCoords.latitude.toFixed(7)}, {gpsCoords.longitude.toFixed(7)}
                  </p>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
                    <span>Akurasi: ±{gpsCoords.accuracy.toFixed(1)}m</span>
                    <span>Terakhir diperbarui: {new Date(gpsCoords.timestamp).toLocaleTimeString('id-ID')}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-4 border-2 border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-bold text-gray-600">GPS belum aktif</span>
                </div>
                <p className="text-xs text-gray-500">
                  Aktifkan GPS untuk mendapatkan koordinat real-time lokasi Anda
                </p>
              </div>
            )}
          </div>
          
          {/* Manual Complete Task Point Button */}
          {kmzFileUrl && gpsCoords && (
            <div className="mt-3 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-4">
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
                    <div className="mt-3 text-xs text-green-700 font-semibold bg-green-100 px-3 py-2 rounded-lg">
                      ✓ {completedPoints.length} titik sudah diselesaikan
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lebar Bahu Bertiang - Hidden when Tidak Murni */}
        {jenisExisting === "Murni" && (
          <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
            <label className="block text-sm font-bold text-gray-700 mb-3">Lebar Bahu Bertiang (m)</label>
            <input
              type="number"
              step="0.1"
              value={formData.lebarBahuBertiang}
              onChange={(e) => setFormData({ ...formData, lebarBahuBertiang: e.target.value })}
              placeholder="0.0"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 placeholder:text-gray-500"
            />
          </div>
        )}

        {/* Lebar Trotoar Bertiang - Hidden when Tidak Murni */}
        {jenisExisting === "Murni" && (
          <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
            <label className="block text-sm font-bold text-gray-700 mb-3">Lebar Trotoar Bertiang (m)</label>
            <input
              type="number"
              step="0.1"
              value={formData.lebarTrotoarBertiang}
              onChange={(e) => setFormData({ ...formData, lebarTrotoarBertiang: e.target.value })}
              placeholder="0.0"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 placeholder:text-gray-500"
            />
          </div>
        )}

        {/* Lainnya Bertiang - Hidden when Tidak Murni */}
        {jenisExisting === "Murni" && (
          <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
            <label className="block text-sm font-bold text-gray-700 mb-3">Lainnya Bertiang</label>
            <input
              type="text"
              value={formData.lainnyaBertiang}
              onChange={(e) => setFormData({ ...formData, lainnyaBertiang: e.target.value })}
              placeholder="Masukkan keterangan lainnya"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 placeholder:text-gray-500"
            />
          </div>
        )}

        {/* Notification when fields are hidden */}
        {jenisExisting === "Tidak Murni" && (
          <div className="bg-orange-50 border-2 border-orange-300 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-orange-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-bold text-orange-900 mb-2">Form Disembunyikan</p>
                <p className="text-xs text-orange-700 mb-2">
                  Karena Anda memilih <span className="font-bold">Tidak Murni</span>, beberapa form berikut disembunyikan:
                </p>
                <ul className="text-xs text-orange-700 list-disc list-inside space-y-1 ml-2">
                  <li>Lebar Bahu Bertiang</li>
                  <li>Lebar Trotoar Bertiang</li>
                  <li>Lainnya Bertiang</li>
                  <li>Tinggi ARM</li>
                  <li>Lebar Trotoar Berdekatan</li>
                  <li>Lamnya Berdekatan</li>
                  <li>Tinggi APM</li>
                </ul>
                <p className="text-xs text-orange-600 mt-2 italic">
                  Ubah pilihan ke "Murni" jika ingin mengisi semua form.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tinggi ARM - Hidden when Tidak Murni */}
        {jenisExisting === "Murni" && (
          <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
            <label className="block text-sm font-bold text-gray-700 mb-3">Tinggi ARM (m)</label>
            <input
              type="number"
              step="0.1"
              value={formData.tinggiARM}
              onChange={(e) => setFormData({ ...formData, tinggiARM: e.target.value })}
              placeholder="0.0"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 placeholder:text-gray-500"
            />
          </div>
        )}

        {/* Lebar Trotoar Berdekatan - Hidden when Tidak Murni */}
        {jenisExisting === "Murni" && (
          <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
            <label className="block text-sm font-bold text-gray-700 mb-3">Lebar Trotoar Berdekatan (m)</label>
            <input
              type="number"
              step="0.1"
              value={formData.lebarTrotoar}
              onChange={(e) => setFormData({ ...formData, lebarTrotoar: e.target.value })}
              placeholder="0.0"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 placeholder:text-gray-500"
            />
          </div>
        )}

        {/* Lamnya Berdekatan - Hidden when Tidak Murni */}
        {jenisExisting === "Murni" && (
          <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
            <label className="block text-sm font-bold text-gray-700 mb-3">Lamnya Berdekatan</label>
            <input
              type="text"
              value={formData.lamnyaBerdekatan}
              onChange={(e) => setFormData({ ...formData, lamnyaBerdekatan: e.target.value })}
              placeholder="Masukkan lamnya berdekatan"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 placeholder:text-gray-500"
            />
          </div>
        )}

        {/* Tinggi APM - Hidden when Tidak Murni */}
        {jenisExisting === "Murni" && (
          <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
            <label className="block text-sm font-bold text-gray-700 mb-3">Tinggi APM (m)</label>
            <input
              type="number"
              step="0.1"
              value={formData.tinggiAPM}
              onChange={(e) => setFormData({ ...formData, tinggiAPM: e.target.value })}
              placeholder="0.0"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 placeholder:text-gray-500"
            />
          </div>
        )}

        {/* Foto Tiang APM */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">Foto Tiang APM (m)</label>
          <div className="space-y-3">
            {fotoTiangAPM && (
              <div className="relative w-full h-48 rounded-xl overflow-hidden border-2 border-gray-200">
                <Image src={fotoTiangAPM} alt="Foto Tiang APM" fill className="object-cover" />
              </div>
            )}
            <label className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl cursor-pointer transition-all active:scale-95 shadow-md">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Ambil Foto
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleFileUpload(e, "tiangAPM")}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Foto Titik Actual */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">Foto Titik Actual</label>
          <div className="space-y-3">
            {fotoTitikActual && (
              <div className="relative w-full h-48 rounded-xl overflow-hidden border-2 border-gray-200">
                <Image src={fotoTitikActual} alt="Foto Titik Actual" fill className="object-cover" />
              </div>
            )}
            <label className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl cursor-pointer transition-all active:scale-95 shadow-md">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Ambil Foto
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

        {/* Keterangan */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">Keterangan</label>
          <textarea
            value={formData.keterangan}
            onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
            placeholder="Masukkan keterangan tambahan..."
            rows={4}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-semibold text-gray-900 placeholder:text-gray-500 resize-none"
          />
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`w-full py-4 ${
            isSubmitting
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
          } text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2`}
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              <span>Menyimpan...</span>
            </>
          ) : (
            <>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Simpan Survey
            </>
          )}
        </button>
      </main>

      {/* Lokasi Modal */}
      {showLokasiModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Masukkan Lokasi</h3>
                  <p className="text-sm text-gray-600">Isi nama jalan dan/atau gang</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Nama Jalan */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  Nama Jalan
                </label>
                <input
                  type="text"
                  value={tempNamaJalan}
                  onChange={(e) => setTempNamaJalan(e.target.value)}
                  placeholder="Contoh: Jalan Sudirman"
                  className="w-full px-4 py-3.5 border-2 border-gray-900 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-medium text-gray-900 placeholder:text-gray-500"
                />
              </div>

              {/* Nama Gang */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Nama Gang
                </label>
                <input
                  type="text"
                  value={tempNamaGang}
                  onChange={(e) => setTempNamaGang(e.target.value)}
                  placeholder="Contoh: Gang 1 (opsional)"
                  className="w-full px-4 py-3.5 border-2 border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-medium text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowLokasiModal(false);
                  setTempNamaJalan("");
                  setTempNamaGang("");
                }}
                className="flex-1 px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all active:scale-95"
              >
                Batal
              </button>
              <button
                onClick={handleSaveLokasi}
                className="flex-1 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg"
              >
                Simpan Lokasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lebar Jalan Modal */}
      {showLebarJalanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Masukkan Lebar Jalan</h3>
                  <p className="text-sm text-gray-600">Isi lebar jalan dalam meter</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Lebar Jalan 1 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  Lebar Jalan 1 (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={tempLebarJalan1}
                  onChange={(e) => setTempLebarJalan1(e.target.value)}
                  placeholder="Contoh: 4.0"
                  className="w-full px-4 py-3.5 border-2 border-gray-900 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-medium text-gray-900 placeholder:text-gray-500"
                />
              </div>

              {/* Lebar Jalan 2 - Opsional */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Lebar Jalan 2 (m) - Opsional
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={tempLebarJalan2}
                  onChange={(e) => setTempLebarJalan2(e.target.value)}
                  placeholder="Contoh: 3.5 (opsional)"
                  className="w-full px-4 py-3.5 border-2 border-gray-300 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-medium text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowLebarJalanModal(false);
                  setTempLebarJalan1("");
                  setTempLebarJalan2("");
                }}
                className="flex-1 px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all active:scale-95"
              >
                Batal
              </button>
              <button
                onClick={handleSaveLebarJalan}
                className="flex-1 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg"
              >
                Simpan Lebar Jalan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kepemilikan Tiang Modal */}
      {showKepemilikanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Kepemilikan Tiang</h3>
                  <p className="text-sm text-gray-600">Pilih Kepemilikan Tiang</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-3">
              {/* PLN Option */}
              <button
                type="button"
                onClick={() => handleKepemilikanSelect("PLN")}
                className="w-full px-5 py-4 bg-gray-50 hover:bg-orange-50 border-2 border-gray-200 hover:border-orange-300 rounded-2xl transition-all flex items-center gap-3 group"
              >
                <svg className="w-6 h-6 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                </svg>
                <span className="font-bold text-gray-900 text-lg">PLN</span>
              </button>

              {/* Pemko Option */}
              <button
                type="button"
                onClick={() => handleKepemilikanSelect("Pemko")}
                className="w-full px-5 py-4 bg-gray-50 hover:bg-orange-50 border-2 border-gray-200 hover:border-orange-300 rounded-2xl transition-all flex items-center gap-3 group"
              >
                <svg className="w-6 h-6 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                </svg>
                <span className="font-bold text-gray-900 text-lg">Pemko</span>
              </button>

              {/* Swadaya Option */}
              <button
                type="button"
                onClick={() => handleKepemilikanSelect("Swadaya")}
                className="w-full px-5 py-4 bg-gray-50 hover:bg-orange-50 border-2 border-gray-200 hover:border-orange-300 rounded-2xl transition-all flex items-center gap-3 group"
              >
                <svg className="w-6 h-6 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                </svg>
                <span className="font-bold text-gray-900 text-lg">Swadaya</span>
              </button>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowKepemilikanModal(false)}
                className="w-full px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all active:scale-95"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Jenis Tiang PLN Modal */}
      {showJenisTiangPLNModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Kepemilikan Tiang</h3>
                  <p className="text-sm text-gray-600 text-center mt-1">PLN - Pilih Jenis Tiang</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-3">Pilih jenis tiang PLN yang sesuai</p>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-3">
              {/* Tiang TR Option */}
              <button
                type="button"
                onClick={() => handlePLNTypeSelect("Tiang TR")}
                className="w-full px-5 py-5 bg-gray-50 hover:bg-orange-50 border-2 border-gray-200 hover:border-orange-300 rounded-2xl transition-all text-left"
              >
                <div className="flex items-center gap-3 mb-1">
                  <svg className="w-6 h-6 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                  <span className="font-bold text-gray-900 text-lg">Tiang TR</span>
                </div>
                <p className="text-sm text-gray-600 ml-9">Tiang Tegangan Rendah</p>
              </button>

              {/* Tiang TM Option */}
              <button
                type="button"
                onClick={() => handlePLNTypeSelect("Tiang TM")}
                className="w-full px-5 py-5 bg-gray-50 hover:bg-orange-50 border-2 border-gray-200 hover:border-orange-300 rounded-2xl transition-all text-left"
              >
                <div className="flex items-center gap-3 mb-1">
                  <svg className="w-6 h-6 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                  <span className="font-bold text-gray-900 text-lg">Tiang TM</span>
                </div>
                <p className="text-sm text-gray-600 ml-9">Tiang Tegangan Menengah</p>
              </button>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowJenisTiangPLNModal(false);
                  setShowKepemilikanModal(true);
                }}
                className="w-full px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all active:scale-95"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trafo Modal */}
      {showTrafoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                    <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Trafo</h3>
                  <p className="text-sm text-gray-600">Tidak Ada</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-3">
              <p className="text-sm font-bold text-gray-700 mb-4">Pilih Trafo</p>
              
              {/* Ada Option */}
              <button
                type="button"
                onClick={() => handleTrafoSelect("Ada")}
                className="w-full px-5 py-4 bg-gray-50 hover:bg-purple-50 border-2 border-gray-200 hover:border-purple-300 rounded-2xl transition-all flex items-center gap-3 group"
              >
                <svg className="w-6 h-6 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                  <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                </svg>
                <span className="font-bold text-gray-900 text-lg">Ada</span>
              </button>

              {/* Tidak Ada Option */}
              <button
                type="button"
                onClick={() => handleTrafoSelect("Tidak Ada")}
                className="w-full px-5 py-4 bg-gray-50 hover:bg-purple-50 border-2 border-gray-200 hover:border-purple-300 rounded-2xl transition-all flex items-center gap-3 group"
              >
                <svg className="w-6 h-6 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                  <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                </svg>
                <span className="font-bold text-gray-900 text-lg">Tidak Ada</span>
              </button>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowTrafoModal(false)}
                className="w-full px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all active:scale-95"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Jenis Trafo Modal */}
      {showJenisTrafoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                    <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Trafo - Pilih Jenis</h3>
                  <p className="text-sm text-gray-600 text-center mt-1">Pilih jenis trafo yang tersedia</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-3">
              {/* Double Option */}
              <button
                type="button"
                onClick={() => handleTrafoTypeSelect("Double")}
                className="w-full px-5 py-5 bg-gray-50 hover:bg-purple-50 border-2 border-gray-200 hover:border-purple-300 rounded-2xl transition-all text-left"
              >
                <div className="flex items-center gap-3 mb-1">
                  <svg className="w-6 h-6 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                  <span className="font-bold text-gray-900 text-lg">Double</span>
                </div>
                <p className="text-sm text-gray-600 ml-9">Trafo Double Phase</p>
              </button>

              {/* Single Option */}
              <button
                type="button"
                onClick={() => handleTrafoTypeSelect("Single")}
                className="w-full px-5 py-5 bg-gray-50 hover:bg-purple-50 border-2 border-gray-200 hover:border-purple-300 rounded-2xl transition-all text-left"
              >
                <div className="flex items-center gap-3 mb-1">
                  <svg className="w-6 h-6 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                  <span className="font-bold text-gray-900 text-lg">Single</span>
                </div>
                <p className="text-sm text-gray-600 ml-9">Trafo Single Phase</p>
              </button>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowJenisTrafoModal(false);
                  setShowTrafoModal(true);
                }}
                className="w-full px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all active:scale-95"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lampu Modal - First Level */}
      {showLampuModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Lampu</h3>
                  <p className="text-sm text-gray-600">Tidak Ada</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-3">
              <p className="text-sm font-bold text-gray-700 mb-4">Pilih Lampu</p>
              
              {/* Ada Option */}
              <button
                type="button"
                onClick={() => handleLampuSelect("Ada")}
                className="w-full px-5 py-4 bg-gray-50 hover:bg-yellow-50 border-2 border-gray-200 hover:border-yellow-300 rounded-2xl transition-all flex items-center gap-3 group"
              >
                <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                </svg>
                <span className="font-bold text-gray-900 text-lg">Ada</span>
              </button>

              {/* Tidak Ada Option */}
              <button
                type="button"
                onClick={() => handleLampuSelect("Tidak Ada")}
                className="w-full px-5 py-4 bg-gray-50 hover:bg-yellow-50 border-2 border-gray-200 hover:border-yellow-300 rounded-2xl transition-all flex items-center gap-3 group"
              >
                <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                </svg>
                <span className="font-bold text-gray-900 text-lg">Tidak Ada</span>
              </button>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowLampuModal(false)}
                className="w-full px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all active:scale-95"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Jumlah Lampu Modal - Second Level */}
      {showJumlahLampuModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Lampu - Pilih Jumlah</h3>
                  <p className="text-sm text-gray-600 mt-1">Pilih jumlah lampu yang ada</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-3">
              {/* 1 Lampu */}
              <button
                type="button"
                onClick={() => handleJumlahLampuSelect("1 Lampu")}
                className="w-full px-5 py-5 bg-gray-50 hover:bg-yellow-50 border-2 border-gray-200 hover:border-yellow-300 rounded-2xl transition-all text-left"
              >
                <div className="flex items-center gap-3 mb-1">
                  <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                  <span className="font-bold text-gray-900 text-lg">1 Lampu</span>
                </div>
                <p className="text-sm text-gray-600 ml-9">Satu lampu</p>
              </button>

              {/* 2 Lampu */}
              <button
                type="button"
                onClick={() => handleJumlahLampuSelect("2 Lampu")}
                className="w-full px-5 py-5 bg-gray-50 hover:bg-yellow-50 border-2 border-gray-200 hover:border-yellow-300 rounded-2xl transition-all text-left"
              >
                <div className="flex items-center gap-3 mb-1">
                  <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                  <span className="font-bold text-gray-900 text-lg">2 Lampu</span>
                </div>
                <p className="text-sm text-gray-600 ml-9">Dua lampu</p>
              </button>

              {/* 3 Lampu */}
              <button
                type="button"
                onClick={() => handleJumlahLampuSelect("3 Lampu")}
                className="w-full px-5 py-5 bg-gray-50 hover:bg-yellow-50 border-2 border-gray-200 hover:border-yellow-300 rounded-2xl transition-all text-left"
              >
                <div className="flex items-center gap-3 mb-1">
                  <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                  <span className="font-bold text-gray-900 text-lg">3 Lampu</span>
                </div>
                <p className="text-sm text-gray-600 ml-9">Tiga lampu</p>
              </button>

              {/* 4 Lampu */}
              <button
                type="button"
                onClick={() => handleJumlahLampuSelect("4 Lampu")}
                className="w-full px-5 py-5 bg-gray-50 hover:bg-yellow-50 border-2 border-gray-200 hover:border-yellow-300 rounded-2xl transition-all text-left"
              >
                <div className="flex items-center gap-3 mb-1">
                  <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                  <span className="font-bold text-gray-900 text-lg">4 Lampu</span>
                </div>
                <p className="text-sm text-gray-600 ml-9">Empat lampu</p>
              </button>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowJumlahLampuModal(false);
                  setShowLampuModal(true);
                }}
                className="w-full px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all active:scale-95"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Jenis Lampu Modal - Third Level */}
      {showJenisLampuModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Lampu - Pilih Jenis</h3>
                  <p className="text-sm text-gray-600 mt-1">Pilih jenis lampu yang digunakan</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-3">
              {/* Konvensional */}
              <button
                type="button"
                onClick={() => handleJenisLampuSelect("Konvensional")}
                className="w-full px-5 py-5 bg-gray-50 hover:bg-yellow-50 border-2 border-gray-200 hover:border-yellow-300 rounded-2xl transition-all text-left"
              >
                <div className="flex items-center gap-3 mb-1">
                  <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                  <span className="font-bold text-gray-900 text-lg">Konvensional</span>
                </div>
                <p className="text-sm text-gray-600 ml-9">Lampu tradisional</p>
              </button>

              {/* LED */}
              <button
                type="button"
                onClick={() => handleJenisLampuSelect("LED")}
                className="w-full px-5 py-5 bg-gray-50 hover:bg-yellow-50 border-2 border-gray-200 hover:border-yellow-300 rounded-2xl transition-all text-left"
              >
                <div className="flex items-center gap-3 mb-1">
                  <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                  <span className="font-bold text-gray-900 text-lg">LED</span>
                </div>
                <p className="text-sm text-gray-600 ml-9">Lampu LED modern</p>
              </button>

              {/* Swadaya */}
              <button
                type="button"
                onClick={() => handleJenisLampuSelect("Swadaya")}
                className="w-full px-5 py-5 bg-gray-50 hover:bg-yellow-50 border-2 border-gray-200 hover:border-yellow-300 rounded-2xl transition-all text-left"
              >
                <div className="flex items-center gap-3 mb-1">
                  <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                  <span className="font-bold text-gray-900 text-lg">Swadaya</span>
                </div>
                <p className="text-sm text-gray-600 ml-9">Lampu swadaya masyarakat</p>
              </button>

              {/* Panel Surya */}
              <button
                type="button"
                onClick={() => handleJenisLampuSelect("Panel Surya")}
                className="w-full px-5 py-5 bg-gray-50 hover:bg-yellow-50 border-2 border-gray-200 hover:border-yellow-300 rounded-2xl transition-all text-left"
              >
                <div className="flex items-center gap-3 mb-1">
                  <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                  <span className="font-bold text-gray-900 text-lg">Panel Surya</span>
                </div>
                <p className="text-sm text-gray-600 ml-9">Lampu tenaga surya</p>
              </button>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowJenisLampuModal(false);
                  setShowJumlahLampuModal(true);
                }}
                className="w-full px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all active:scale-95"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Median Jalan Modal - First Level */}
      {showMedianModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Median Jalan</h3>
                  <p className="text-sm text-gray-600">Pilih Median Jalan</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-3">
              {/* Ada Option */}
              <button
                type="button"
                onClick={() => handleMedianSelect("Ada")}
                className="w-full px-5 py-4 bg-gray-50 hover:bg-amber-50 border-2 border-gray-200 hover:border-amber-300 rounded-2xl transition-all flex items-center gap-3 group"
              >
                <svg className="w-6 h-6 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                <span className="font-bold text-gray-900 text-lg">Ada</span>
              </button>

              {/* Tidak Ada Option */}
              <button
                type="button"
                onClick={() => handleMedianSelect("Tidak Ada")}
                className="w-full px-5 py-4 bg-gray-50 hover:bg-amber-50 border-2 border-gray-200 hover:border-amber-300 rounded-2xl transition-all flex items-center gap-3 group"
              >
                <svg className="w-6 h-6 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                <span className="font-bold text-gray-900 text-lg">Tidak Ada</span>
              </button>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowMedianModal(false)}
                className="w-full px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all active:scale-95"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Median Modal - Second Level */}
      {showDetailMedianModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Masukkan Detail Median</h3>
                  <p className="text-sm text-gray-600 mt-1">Isi tinggi dan lebar median jalan</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Tinggi Median */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  Tinggi Median (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={tempTinggiMedian}
                  onChange={(e) => setTempTinggiMedian(e.target.value)}
                  placeholder="Contoh: 0.5"
                  className="w-full px-4 py-3.5 border-2 border-gray-900 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-medium text-gray-900 placeholder:text-gray-500"
                />
              </div>

              {/* Lebar Median */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Lebar Median (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={tempLebarMedian}
                  onChange={(e) => setTempLebarMedian(e.target.value)}
                  placeholder="Contoh: 1.2"
                  className="w-full px-4 py-3.5 border-2 border-gray-900 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-medium text-gray-900 placeholder:text-gray-500"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowDetailMedianModal(false);
                  setShowMedianModal(true);
                }}
                className="flex-1 px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all active:scale-95"
              >
                Batal
              </button>
              <button
                onClick={handleSaveMedian}
                className="flex-1 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg"
              >
                Simpan Median
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Modal */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
            <div className="text-center">
              {/* Animated Icon */}
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
              </div>

              {/* Loading Title */}
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Menyimpan Data Survey
              </h3>

              {/* Progress Text */}
              <p className="text-sm text-gray-600 mb-6">
                {submitProgress}
              </p>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-4 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
              </div>

              {/* Info Text */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="text-xs text-blue-800 text-left">
                  Mohon tunggu, jangan tutup halaman ini. Proses upload foto dan penyimpanan data sedang berlangsung.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SurveyExistingPage() {
  return (
    <ProtectedRoute>
      <SurveyExistingContent />
    </ProtectedRoute>
  );
}

export default SurveyExistingPage;
