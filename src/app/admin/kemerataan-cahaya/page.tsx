"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

type RoadType = "arterial" | "kolektor" | "lokal" | "lingkungan" | null;

interface GridStats {
  lMin: number;
  lMax: number;
  lAvg: number;
  uniformityRatio: number;
  dataCount: number;
}

function KemeratanCahayaContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedRoadType, setSelectedRoadType] = useState<RoadType>(null);
  const [jarakTiang, setJarakTiang] = useState<string>("");
  const [lebarJalan, setLebarJalan] = useState<string>("");
  const [showGrid, setShowGrid] = useState(false);
  const [gridData, setGridData] = useState<number[][]>([]);
  const [gridStats, setGridStats] = useState<GridStats>({
    lMin: 0,
    lMax: 0,
    lAvg: 0,
    uniformityRatio: 0,
    dataCount: 0,
  });

  // Check if user is admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/dashboard-pengukuran");
    }
  }, [user, router]);

  // Generate grid when jarak and lebar change
  useEffect(() => {
    if (jarakTiang && lebarJalan) {
      const jarak = parseInt(jarakTiang);
      const lebar = parseInt(lebarJalan);
      
      if (jarak > 0 && lebar > 0 && jarak <= 100 && lebar <= 50) {
        // Create grid: rows = jarak (vertical), cols = lebar (horizontal)
        const newGrid: number[][] = [];
        for (let i = 0; i < jarak; i++) {
          const row: number[] = [];
          for (let j = 0; j < lebar; j++) {
            row.push(0);
          }
          newGrid.push(row);
        }
        setGridData(newGrid);
        setGridStats({
          ...gridStats,
          dataCount: jarak * lebar,
        });
      }
    }
  }, [jarakTiang, lebarJalan]);

  const roadTypes = [
    {
      id: "arterial",
      label: "Arterial",
      description: "Jalan utama dengan lalu lintas tinggi",
      icon: "🛣️",
    },
    {
      id: "kolektor",
      label: "Kolektor",
      description: "Jalan penghubung dengan lalu lintas sedang",
      icon: "🔗",
    },
    {
      id: "lokal",
      label: "Lokal",
      description: "Jalan lokal dengan lalu lintas rendah",
      icon: "🏘️",
    },
    {
      id: "lingkungan",
      label: "Lingkungan",
      description: "Jalan lingkungan dengan lalu lintas sangat rendah",
      icon: "🏡",
    },
  ];

  const handleLoadData = () => {
    if (!selectedRoadType || !jarakTiang || !lebarJalan) {
      alert("Mohon lengkapi semua data terlebih dahulu");
      return;
    }
    setShowGrid(true);
  };

  const handleApplyGrid = () => {
    // Calculate statistics from grid data
    const flatData = gridData.flat().filter(val => val > 0);
    if (flatData.length > 0) {
      const min = Math.min(...flatData);
      const max = Math.max(...flatData);
      const avg = flatData.reduce((a, b) => a + b, 0) / flatData.length;
      const uniformity = min / avg;

      setGridStats({
        lMin: min,
        lMax: max,
        lAvg: parseFloat(avg.toFixed(2)),
        uniformityRatio: parseFloat(uniformity.toFixed(3)),
        dataCount: parseInt(jarakTiang) * parseInt(lebarJalan),
      });
    }
  };

  const handleGridCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newGrid = [...gridData];
    newGrid[rowIndex][colIndex] = numValue;
    setGridData(newGrid);
  };

  const handleLoadDataPertama = async () => {
    try {
      // Load data from Firebase - Top to Bottom (Atas ke Bawah)
      const q = query(
        collection(db, "kemeratanCahaya"),
        orderBy("createdAt", "desc"),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();
        if (data.gridData && Array.isArray(data.gridData)) {
          setGridData(data.gridData);
          alert("Data berhasil dimuat!");
        }
      } else {
        alert("Tidak ada data tersedia");
      }
    } catch (error) {
      console.error("Error loading data:", error);
      alert("Gagal memuat data");
    }
  };

  const handleLoadDataKedua = async () => {
    try {
      // Load data from Firebase - Bottom to Top (Bawah ke Atas)
      const q = query(
        collection(db, "kemeratanCahaya"),
        orderBy("createdAt", "asc"),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();
        if (data.gridData && Array.isArray(data.gridData)) {
          // Reverse the grid data for bottom to top
          const reversedData = [...data.gridData].reverse();
          setGridData(reversedData);
          alert("Data berhasil dimuat!");
        }
      } else {
        alert("Tidak ada data tersedia");
      }
    } catch (error) {
      console.error("Error loading data:", error);
      alert("Gagal memuat data");
    }
  };

  const handleResetGrid = () => {
    // Reset grid to all zeros
    const jarak = parseInt(jarakTiang);
    const lebar = parseInt(lebarJalan);
    if (jarak > 0 && lebar > 0) {
      const newGrid: number[][] = [];
      for (let i = 0; i < jarak; i++) {
        const row: number[] = [];
        for (let j = 0; j < lebar; j++) {
          row.push(0);
        }
        newGrid.push(row);
      }
      setGridData(newGrid);
      setGridStats({
        lMin: 0,
        lMax: 0,
        lAvg: 0,
        uniformityRatio: 0,
        dataCount: jarak * lebar,
      });
      alert("Grid berhasil direset!");
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              Pilih jenis jalan dan span untuk memulai analisis
            </h2>
          </div>

          {/* Road Type Selection */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-orange-600 text-lg">🛣️</span>
              <h3 className="font-semibold text-gray-900">Pilih Jenis Jalan</h3>
            </div>
            <div className="space-y-3">
              {roadTypes.map((road) => (
                <button
                  key={road.id}
                  onClick={() => setSelectedRoadType(road.id as RoadType)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    selectedRoadType === road.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{road.icon}</span>
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {road.label}
                      </h4>
                      <p className="text-sm text-gray-600">{road.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Statistics */}
          <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <h3 className="font-semibold text-gray-900 mb-3">
              Statistik Grid:
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">L-Min:</span>
                <span className="font-semibold text-blue-600">
                  {gridStats.lMin}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">L-Max:</span>
                <span className="font-semibold text-blue-600">
                  {gridStats.lMax}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">L-Avg:</span>
                <span className="font-semibold text-blue-600">
                  {gridStats.lAvg}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Uniformity Ratio:</span>
                <span className="font-semibold text-blue-600">
                  {gridStats.uniformityRatio.toFixed(3)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Data:</span>
                <span className="font-semibold text-blue-600">
                  {gridStats.dataCount} sel
                </span>
              </div>
            </div>
          </div>

          {/* Measurements */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-green-600 text-lg">📏</span>
              <h3 className="font-semibold text-gray-900">
                Ukuran Jarak Tiang Dan Lebar Jalan
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jarak Tiang
                </label>
                <input
                  type="number"
                  value={jarakTiang}
                  onChange={(e) => setJarakTiang(e.target.value)}
                  placeholder="Masukkan jarak tiang"
                  min="1"
                  max="100"
                  className="w-full px-4 py-3 text-lg font-bold text-black placeholder:text-gray-400 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lebar Jalan
                </label>
                <input
                  type="number"
                  value={lebarJalan}
                  onChange={(e) => setLebarJalan(e.target.value)}
                  placeholder="Masukkan lebar jalan"
                  min="1"
                  max="50"
                  className="w-full px-4 py-3 text-lg font-bold text-black placeholder:text-gray-400 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>

              {/* Info Box */}
              {jarakTiang && lebarJalan && (
                <div className="p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                  <p className="text-sm font-semibold text-gray-900 mb-1">
                    Jarak Tiang {jarakTiang} Lebar Jalan {lebarJalan}
                  </p>
                  <p className="text-sm font-semibold text-green-600">
                    Total sel: {parseInt(jarakTiang || "0") * parseInt(lebarJalan || "0")} sel
                  </p>
                </div>
              )}

              {/* Terapkan Button */}
              <button
                onClick={handleLoadData}
                disabled={!selectedRoadType || !jarakTiang || !lebarJalan}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all shadow-sm"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Terapkan
              </button>
            </div>
          </div>

          {/* Load Data Section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
              <h3 className="font-semibold text-gray-900">Load Data</h3>
            </div>

            <div className="space-y-3">
              {/* Load Data Pertama (Atas ke Bawah) */}
              <button
                onClick={handleLoadDataPertama}
                disabled={!showGrid}
                className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 disabled:bg-gray-100 disabled:cursor-not-allowed border-2 border-blue-200 rounded-xl transition-all"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <span className="text-sm font-semibold text-blue-700">Load Data Pertama (Atas ke Bawah)</span>
                </div>
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Load Data Kedua (Bawah ke Atas) */}
              <button
                onClick={handleLoadDataKedua}
                disabled={!showGrid}
                className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 hover:bg-purple-100 disabled:bg-gray-100 disabled:cursor-not-allowed border-2 border-purple-200 rounded-xl transition-all"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  <span className="text-sm font-semibold text-purple-700">Load Data Kedua (Bawah ke Atas)</span>
                </div>
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Reset Grid */}
              <button
                onClick={handleResetGrid}
                disabled={!showGrid}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 disabled:bg-gray-100 disabled:cursor-not-allowed border-2 border-red-200 rounded-xl transition-all"
              >
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-sm font-semibold text-red-700">Reset Grid (Kosongkan Semua)</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-end">
            <button
              onClick={() => router.push("/admin/module-selection")}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Kembali
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
          {!showGrid ? (
            <div className="flex flex-col items-center justify-center h-full p-8">
              <div className="text-center max-w-2xl">
                {/* Sun Icon */}
                <div className="mb-6 flex justify-center">
                  <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-12 h-12 text-orange-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  </div>
                </div>

                {/* Title */}
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                  Kemerataan Sinar - {selectedRoadType ? roadTypes.find(r => r.id === selectedRoadType)?.label : "Pilih Jenis Jalan"}
                </h1>

                {/* Description */}
                <p className="text-lg text-gray-600 mb-6">
                  {selectedRoadType ? "Analisis Kemerataan" : "Pilih jenis jalan dan span untuk memulai analisis"}
                </p>

                {/* User Info */}
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 shadow-sm">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {user?.email?.charAt(0).toUpperCase() || "A"}
                  </div>
                  <span className="text-sm text-gray-700">
                    Logged in as:{" "}
                    <span className="font-semibold">
                      {user?.email?.split("@")[0] || "admin"}
                    </span>
                  </span>
                </div>

                {/* Info Box */}
                {!selectedRoadType && (
                  <div className="mt-8 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg
                          className="w-6 h-6 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          Mulai Analisis
                        </h3>
                        <p className="text-sm text-gray-600">
                          Silakan pilih jenis jalan di sidebar kiri, masukkan
                          ukuran jarak tiang dan lebar jalan, kemudian klik
                          "Load Data" untuk memulai analisis kemerataan cahaya.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8">
              <div className="bg-white rounded-2xl shadow-lg p-8">
                {/* Header Grid */}
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Kemerataan Sinar - {roadTypes.find(r => r.id === selectedRoadType)?.label}
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Analisis Kemerataan</span>
                  </div>
                </div>

                {/* Grid Info */}
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    <span className="font-semibold">Jarak Tiang {jarakTiang} Lebar Jalan {lebarJalan}</span>
                    <br />
                    <span className="text-green-600">Total sel: {parseInt(jarakTiang) * parseInt(lebarJalan)} sel</span>
                  </div>
                  <button
                    onClick={handleApplyGrid}
                    className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Terapkan
                  </button>
                </div>

                {/* Grid Container */}
                <div className="overflow-x-auto">
                  <div className="flex justify-center">
                    <div className="inline-block">
                      {/* Top Label */}
                      <div className="text-center mb-3">
                        <span className="text-sm font-semibold text-gray-700">Lebar Jalan (m)</span>
                      </div>

                      <div className="flex gap-4">
                        {/* Left Label */}
                        <div className="flex items-center justify-center">
                          <div className="writing-mode-vertical text-sm font-semibold text-gray-700">
                            Jalan Raya Tiang (m)
                          </div>
                        </div>

                        {/* Grid */}
                        <div className="flex-1">
                          <div className="inline-grid gap-1" style={{ 
                            gridTemplateColumns: `repeat(${parseInt(lebarJalan)}, minmax(0, 1fr))` 
                          }}>
                            {gridData.map((row, rowIndex) => (
                              row.map((cell, colIndex) => (
                                <div
                                  key={`${rowIndex}-${colIndex}`}
                                  className="w-16 h-16 flex items-center justify-center bg-gray-200 border border-gray-300 rounded-lg font-semibold text-gray-700"
                                >
                                  {cell === 0 ? '0' : cell}
                                </div>
                              ))
                            ))}
                          </div>

                          {/* Bottom Info */}
                          <div className="mt-4 text-center text-sm text-gray-600">
                            Jarak: <span className="font-semibold text-blue-600">{jarakTiang}m</span> | 
                            Lebar: <span className="font-semibold text-blue-600">{lebarJalan}m</span> | 
                            Total: <span className="font-semibold text-blue-600">{parseInt(jarakTiang) * parseInt(lebarJalan)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function KemeratanCahayaPage() {
  return (
    <ProtectedRoute>
      <KemeratanCahayaContent />
    </ProtectedRoute>
  );
}
