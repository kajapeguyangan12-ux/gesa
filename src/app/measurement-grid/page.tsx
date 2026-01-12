"use client";

import { useState, useEffect, Suspense, useMemo, useCallback, memo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Image from "next/image";

interface CellData {
  row: number;
  col: number;
  nilaiLux: string;
  tipeApi: "normal" | "titik-api";
  lampiran?: File | null;
  tanggal: string;
  waktu: string;
  lokasi: string;
}

interface ModalData extends CellData {
  show: boolean;
}

function MeasurementGridContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [gridData, setGridData] = useState<Map<string, CellData>>(new Map());
  const [modalState, setModalState] = useState<ModalData>({
    show: false,
    row: 0,
    col: 0,
    nilaiLux: "",
    tipeApi: "normal",
    lampiran: null,
    tanggal: new Date().toLocaleDateString("id-ID"),
    waktu: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    lokasi: "Lokasi tidak tersedia",
  });

  const surveyData = {
    namaLampu: searchParams.get("namaLampu") || "",
    dayaLampu: searchParams.get("dayaLampu") || "",
    teganganAwal: searchParams.get("teganganAwal") || "",
    tinggiTiang: searchParams.get("tinggiTiang") || "",
  };

  // Grid configuration: 35 columns x 45 rows
  const ROWS = 45;
  const COLS = 35;
  const [showSidebar, setShowSidebar] = useState(true);

  useEffect(() => {
    setIsLoaded(true);
    // Request location permission
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setModalState(prev => ({
            ...prev,
            lokasi: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          }));
        },
        () => {
          setModalState(prev => ({ ...prev, lokasi: "Lokasi tidak tersedia" }));
        }
      );
    }
  }, []);

  // Calculate statistics
  const calculateStats = () => {
    const values = Array.from(gridData.values())
      .filter(cell => {
        // Only include normal cells with valid lux values
        if (cell.tipeApi !== "normal") return false;
        if (!cell.nilaiLux || cell.nilaiLux.trim() === "") return false;
        const num = parseFloat(cell.nilaiLux);
        return !isNaN(num) && isFinite(num);
      })
      .map(cell => parseFloat(cell.nilaiLux));

    if (values.length === 0) {
      return { min: 0, max: 0, avg: 0 };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;

    return { min, max, avg };
  };

  const stats = calculateStats();

  const getCellKey = (row: number, col: number) => `${row}-${col}`;

  const handleCellClick = useCallback((row: number, col: number) => {
    const cellKey = getCellKey(row, col);
    const existingData = gridData.get(cellKey);
    
    setModalState(prev => ({
      ...prev,
      show: true,
      row,
      col,
      nilaiLux: existingData?.nilaiLux || "",
      tipeApi: existingData?.tipeApi || "normal",
      lampiran: existingData?.lampiran || null,
      tanggal: new Date().toLocaleDateString("id-ID"),
      waktu: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    }));
  }, [gridData]);

  const handleCloseModal = useCallback(() => {
    setModalState(prev => ({ ...prev, show: false }));
  }, []);

  const handleSaveCell = useCallback((action?: "jarak" | "lebar") => {
    if (!modalState.nilaiLux) return;

    const cellKey = getCellKey(modalState.row, modalState.col);
    const newData: CellData = {
      row: modalState.row,
      col: modalState.col,
      nilaiLux: modalState.nilaiLux,
      tipeApi: modalState.tipeApi,
      lampiran: modalState.lampiran,
      tanggal: modalState.tanggal,
      waktu: modalState.waktu,
      lokasi: modalState.lokasi,
    };

    setGridData(prev => new Map(prev).set(cellKey, newData));
    
    if (action === "jarak") {
      // Move to next column (jarak tiang)
      const nextCol = modalState.col + 1;
      if (nextCol < COLS) {
        handleCellClick(modalState.row, nextCol);
      } else {
        handleCloseModal();
      }
    } else if (action === "lebar") {
      // Move to next row (lebar jalan)
      const nextRow = modalState.row + 1;
      if (nextRow < ROWS) {
        handleCellClick(nextRow, modalState.col);
      } else {
        handleCloseModal();
      }
    } else {
      handleCloseModal();
    }
  }, [modalState, COLS, ROWS, handleCellClick, handleCloseModal]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      try {
        // Convert image to WebP
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = document.createElement('img');
        
        img.onload = () => {
          // Set canvas size (compress to max 1920px width)
          const maxWidth = 1920;
          const maxHeight = 1920;
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw and convert to WebP
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  // Create WebP file
                  const webpFile = new File(
                    [blob], 
                    file.name.replace(/\.[^.]+$/, '.webp'),
                    { type: 'image/webp' }
                  );
                  setModalState(prev => ({ ...prev, lampiran: webpFile }));
                }
                // Cleanup
                URL.revokeObjectURL(img.src);
              },
              'image/webp',
              0.85 // Quality 85%
            );
          }
        };
        
        img.onerror = () => {
          console.error('Error loading image');
          URL.revokeObjectURL(img.src);
          // Fallback: use original file
          setModalState(prev => ({ ...prev, lampiran: file }));
        };
        
        img.src = URL.createObjectURL(file);
      } catch (error) {
        console.error('Error converting image:', error);
        // Fallback: use original file
        setModalState(prev => ({ ...prev, lampiran: file }));
      }
    }
  };

  const getCellColor = useCallback((row: number, col: number) => {
    const cellKey = getCellKey(row, col);
    const data = gridData.get(cellKey);
    
    if (!data) return "bg-white hover:bg-gray-50 text-gray-400 border border-gray-200";
    
    const lux = parseFloat(data.nilaiLux);
    
    // Titik Api = Merah terang (sangat terang)
    if (data.tipeApi === "titik-api") return "bg-red-500 hover:bg-red-600 text-white shadow-md";
    
    // Heat map: Merah (terang) -> Kuning (tengah) -> Putih (tidak terang)
    if (lux >= 50) return "bg-red-400 hover:bg-red-500 text-white shadow-sm"; // Sangat terang = Merah
    if (lux >= 40) return "bg-orange-400 hover:bg-orange-500 text-white"; // Terang = Orange
    if (lux >= 30) return "bg-yellow-300 hover:bg-yellow-400 text-gray-900"; // Tengah terang = Kuning
    if (lux >= 20) return "bg-yellow-200 hover:bg-yellow-300 text-gray-800"; // Sedang = Kuning muda
    if (lux >= 10) return "bg-yellow-100 hover:bg-yellow-200 text-gray-700"; // Redup = Kuning pucat
    if (lux >= 5) return "bg-orange-50 hover:bg-orange-100 text-gray-600"; // Sangat redup = Putih kekuningan
    return "bg-white hover:bg-gray-50 text-gray-500 border border-gray-200"; // Tidak terang = Putih
  }, [gridData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50" style={{ contain: 'layout style' }}>
      {/* Header - Mobile Optimized */}
      <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200" style={{ contain: 'layout style paint' }}>
        <div className="px-3 sm:px-6 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Back + Logo + Title */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <button
                onClick={() => router.push("/dashboard-pengukuran")}
                className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all active:scale-95 touch-manipulation"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div className="relative w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
                <Image
                  src="/Logo/BDG1.png"
                  alt="Logo BGD"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-sm sm:text-base font-bold text-gray-900 truncate">
                  {surveyData.namaLampu || "Pengukuran Cahaya"}
                </h1>
                <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                  {surveyData.dayaLampu}W • {surveyData.teganganAwal}V • {surveyData.tinggiTiang}m
                </p>
              </div>
            </div>
            
            {/* Right: Toggle Sidebar Button (Mobile) */}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="lg:hidden flex-shrink-0 w-9 h-9 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all active:scale-95 touch-manipulation"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {showSidebar && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setShowSidebar(false)}
          style={{ contain: 'strict' }}
        />
      )}

      {/* Main Content with Sidebar */}
      <main className="max-w-[1920px] mx-auto px-2 sm:px-4 py-3 sm:py-6">
        <div className="flex gap-4 items-start relative">
          {/* Sidebar - Info & Stats */}
          <aside className={`
            fixed lg:sticky top-0 left-0 h-screen lg:h-auto
            w-80 flex-shrink-0 
            bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 lg:bg-transparent
            overflow-y-auto
            z-50 lg:z-auto
            transition-all duration-300 ease-in-out
            ${
              showSidebar 
                ? "translate-x-0" 
                : "-translate-x-full lg:translate-x-0"
            }
            ${isLoaded ? "opacity-100" : "opacity-0"}
          `}>
            <div className="p-4 space-y-4">
              {/* Close Button (Mobile Only) */}
              <button
                onClick={() => setShowSidebar(false)}
                className="lg:hidden w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-xl transition-all active:scale-95 border border-gray-200 shadow-sm"
              >
                <span>Tutup Info</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {/* Back to Selection */}
              <button
                onClick={() => router.push("/module-selection")}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all duration-200 active:scale-95 border border-blue-200 touch-manipulation"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Kembali ke Pemilihan</span>
              </button>

              {/* Info Laporan Card */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3">
                  <h3 className="text-base sm:text-lg font-bold text-white">Info Laporan</h3>
                </div>
              <div className="p-4 space-y-4">
                {/* Nama Lampu */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Nama Lampu</label>
                  <p className="text-base font-bold text-gray-900 mt-1">{surveyData.namaLampu || "-"}</p>
                </div>

                {/* Lokasi Proyek */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Lokasi Proyek</label>
                  <div className="flex items-start gap-2 mt-1">
                    <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-sm text-gray-600">{modalState.lokasi}</p>
                  </div>
                </div>

                {/* Status GPS */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Status GPS:</label>
                  <div className="flex items-center gap-2 mt-1">
                    {modalState.lokasi === "Lokasi tidak tersedia" ? (
                      <>
                        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="text-sm font-semibold text-red-600">GPS Error</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm font-semibold text-green-600">GPS Aktif</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Grid 2x2 untuk info detail */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Petugas */}
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-xs font-semibold text-gray-500">Petugas</span>
                    </div>
                    <p className="text-sm font-bold text-gray-900 truncate">{user?.displayName || "Admin"}</p>
                  </div>

                  {/* Tegangan */}
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="text-xs font-semibold text-gray-500">Tegangan</span>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{surveyData.teganganAwal}V</p>
                  </div>

                  {/* Tanggal */}
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs font-semibold text-gray-500">Tanggal</span>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })}</p>
                  </div>

                  {/* Tinggi Tiang */}
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                      <span className="text-xs font-semibold text-gray-500">Tinggi Tiang</span>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{surveyData.tinggiTiang} Meter</p>
                  </div>
                </div>

                {/* Daya */}
                <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-3 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span className="text-xs font-semibold text-yellow-700">Daya</span>
                  </div>
                  <p className="text-xl font-bold text-yellow-900">{surveyData.dayaLampu}W</p>
                </div>
              </div>
            </div>

            {/* Statistik Card */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3">
                <h3 className="text-lg font-bold text-white">Statistik (Lux)</h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-3">
                  {/* L-Min */}
                  <div className="text-center">
                    <p className="text-xs font-semibold text-gray-500 mb-1">L-Min</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.min.toFixed(2)}</p>
                  </div>

                  {/* L-Max */}
                  <div className="text-center">
                    <p className="text-xs font-semibold text-gray-500 mb-1">L-Max</p>
                    <p className="text-2xl font-bold text-green-600">{stats.max.toFixed(2)}</p>
                  </div>

                  {/* L-Avg */}
                  <div className="text-center">
                    <p className="text-xs font-semibold text-gray-500 mb-1">L-Avg</p>
                    <p className="text-2xl font-bold text-amber-600">{stats.avg.toFixed(2)}</p>
                  </div>
                </div>

                {/* Progress bars */}
                <div className="mt-4 space-y-2">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600">Data Terisi</span>
                      <span className="font-bold text-gray-900">{gridData.size}/{ROWS * COLS}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                        style={{ width: `${(gridData.size / (ROWS * COLS)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </aside>

          {/* Main Grid Area */}
          <div className="flex-1 min-w-0 space-y-3 sm:space-y-4">
            {/* Info Card - Legend */}
            <div className={`bg-white rounded-xl shadow-lg p-3 sm:p-5 border border-gray-200 transition-all duration-1000 delay-300 ${
              isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            }`}>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm font-bold text-gray-900 mr-1">Legenda:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-white border-2 border-gray-200 rounded-md sm:rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-semibold text-gray-400">0</div>
              <span className="text-[10px] sm:text-sm font-semibold text-gray-700">Kosong</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-400 rounded-md sm:rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold text-white">50</div>
              <span className="text-[10px] sm:text-sm font-semibold text-gray-700">≥50</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-orange-400 rounded-md sm:rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold text-white">40</div>
              <span className="text-[10px] sm:text-sm font-semibold text-gray-700">40-49</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-yellow-300 rounded-md sm:rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold text-gray-900">30</div>
              <span className="text-[10px] sm:text-sm font-semibold text-gray-700">30-39</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-yellow-200 rounded-md sm:rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold text-gray-800">20</div>
              <span className="text-[10px] sm:text-sm font-semibold text-gray-700">20-29</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-yellow-100 rounded-md sm:rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold text-gray-700">10</div>
              <span className="text-[10px] sm:text-sm font-semibold text-gray-700">10-19</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-white border border-gray-300 rounded-md sm:rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold text-gray-600">5</div>
              <span className="text-[10px] sm:text-sm font-semibold text-gray-700">&lt;10</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-500 rounded-md sm:rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold text-white">⚠</div>
              <span className="text-[10px] sm:text-sm font-semibold text-gray-700 hidden sm:inline">Titik Api</span>
            </div>
          </div>
        </div>

        {/* Grid Container - Optimized with CSS containment */}
        <div className={`bg-white rounded-lg sm:rounded-xl shadow-lg p-2 sm:p-4 md:p-6 border border-gray-200 overflow-x-auto ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`} style={{ contain: 'layout style paint' }}>
          <div className="inline-block min-w-full">
            <div className="grid bg-gray-50 p-1 sm:p-2 rounded-md sm:rounded-lg" style={{ 
              gridTemplateColumns: `50px repeat(${COLS}, 48px)`,
              gap: "5px",
              willChange: 'transform'
            }}>
              {/* Header Row */}
              <div className="sticky left-0 bg-white flex items-center justify-center font-bold text-xs sm:text-sm text-gray-600 z-10 rounded leading-tight p-1">
                <span className="text-center">Jarak<br/>Tiang</span>
              </div>
              {useMemo(() => Array.from({ length: COLS }, (_, i) => (
                <div key={`header-${i}`} className="bg-white flex items-center justify-center font-bold text-sm sm:text-base text-gray-700 rounded">
                  {i + 1}
                </div>
              )), [COLS])}

              {/* Grid Rows - Optimized */}
              {useMemo(() => Array.from({ length: ROWS }, (_, row) => (
                <div key={`row-${row}`} className="contents">
                  {/* Row Header */}
                  <div className="sticky left-0 bg-white flex items-center justify-center font-bold text-sm sm:text-base text-gray-700 z-10 rounded">
                    {row + 1}
                  </div>
                  
                  {/* Row Cells */}
                  {Array.from({ length: COLS }, (_, col) => {
                    const cellKey = getCellKey(row, col);
                    const cellData = gridData.get(cellKey);
                    return (
                      <button
                        key={cellKey}
                        onClick={() => handleCellClick(row, col)}
                        className={`h-12 sm:h-14 text-xs sm:text-base font-bold flex items-center justify-center active:scale-95 touch-manipulation rounded-md sm:rounded-lg transition-transform ${getCellColor(row, col)}`}
                        style={{ contain: 'layout style paint' }}
                      >
                        {cellData?.nilaiLux ? parseFloat(cellData.nilaiLux).toFixed(0) : "0"}
                      </button>
                    );
                  })}
                </div>
              )), [ROWS, COLS, gridData, getCellColor, handleCellClick])}
            </div>
          </div>
        </div>
          </div>
        </div>
      </main>

      {/* Modal - Mobile Optimized */}
      {modalState.show && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" style={{ contain: 'layout style paint' }}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto" style={{ contain: 'layout style paint', willChange: 'transform' }}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 sm:p-5 rounded-t-3xl sm:rounded-t-2xl z-10">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold">Ubah Data Sel</h3>
                  <p className="text-xs sm:text-sm text-blue-100 mt-1 truncate">
                    Jarak {modalState.col + 1}m, Lebar {modalState.row + 1}m
                  </p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/20 active:bg-white/30 transition-colors touch-manipulation"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
              {/* Nilai Lux - Diperbesar untuk mudah diisi */}
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Nilai Lux <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="Masukkan nilai lux..."
                  value={modalState.nilaiLux}
                  onChange={(e) => setModalState(prev => ({ ...prev, nilaiLux: e.target.value }))}
                  className="w-full px-4 py-4 text-xl font-bold border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900 placeholder-gray-400 touch-manipulation bg-white"
                  autoFocus
                />
              </div>

              {/* Tipe Sel - Compact */}
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Tipe Sel
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalState(prev => ({ ...prev, tipeApi: "normal" }))}
                    className={`py-2.5 px-3 rounded-lg font-bold text-sm transition-all active:scale-95 touch-manipulation ${
                      modalState.tipeApi === "normal"
                        ? "bg-blue-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalState(prev => ({ ...prev, tipeApi: "titik-api" }))}
                    className={`py-2.5 px-3 rounded-lg font-bold text-sm transition-all active:scale-95 touch-manipulation ${
                      modalState.tipeApi === "titik-api"
                        ? "bg-red-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Titik Api
                  </button>
                </div>
              </div>

              {/* Lampiran - Optional, Simplified */}
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Lampiran <span className="text-xs text-gray-500">(Opsional)</span>
                </label>
                {modalState.lampiran ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <svg className="w-6 h-6 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{modalState.lampiran.name}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalState(prev => ({ ...prev, lampiran: null }))}
                      className="flex-shrink-0 text-red-500 hover:text-red-700 p-1 touch-manipulation"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <div className="p-3 bg-blue-50 border-2 border-dashed border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 active:bg-blue-200 transition-all text-center touch-manipulation">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm font-semibold text-blue-700">Ambil Foto</span>
                      </div>
                    </div>
                  </label>
                )}
              </div>

              {/* Info Otomatis - Compact */}
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-500 mb-2">INFO OTOMATIS</p>
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="font-medium">{modalState.tanggal}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">{modalState.waktu}</span>
                  </div>
                </div>
                <div className="flex items-start gap-1 mt-2 text-xs text-gray-600">
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  <span className="font-medium line-clamp-1">{modalState.lokasi}</span>
                </div>
              </div>

              {/* Action Buttons - Simplified & Lighter */}
              <div className="space-y-2 pt-3 pb-safe">
                {/* Primary Actions - Simpan & Lanjut */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveCell("jarak")}
                    className="py-3 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white rounded-lg font-bold text-sm transition-all shadow-md active:scale-95 touch-manipulation"
                  >
                    Simpan & →
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveCell("lebar")}
                    className="py-3 bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white rounded-lg font-bold text-sm transition-all shadow-md active:scale-95 touch-manipulation"
                  >
                    Simpan & ↓
                  </button>
                </div>

                {/* Secondary Action - Simpan Saja */}
                <button
                  type="button"
                  onClick={() => handleSaveCell()}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg font-bold text-sm transition-all shadow-md active:scale-95 touch-manipulation flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Simpan Saja
                </button>

                {/* Cancel Button */}
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-600 rounded-lg font-semibold text-sm transition-all active:scale-95 touch-manipulation"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MeasurementGridPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
        <MeasurementGridContent />
      </Suspense>
    </ProtectedRoute>
  );
}

export default MeasurementGridPage;
