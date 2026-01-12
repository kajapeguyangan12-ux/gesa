"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Image from "next/image";

interface GridCell {
  value: string;
}

type JenisJalan = "arterial" | "kolektor" | "lokal" | "lingkungan" | "";

function KemeratanCahayaContent() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [jenisJalan, setJenisJalan] = useState<JenisJalan>("");
  const [jarakTiang, setJarakTiang] = useState("");
  const [lebarJalan, setLebarJalan] = useState("");
  const [gridData, setGridData] = useState<Map<string, GridCell>>(new Map());
  const [rows, setRows] = useState(0);
  const [cols, setCols] = useState(0);
  const [isGridReady, setIsGridReady] = useState(false);

  // Jenis jalan options
  const jenisJalanOptions = [
    {
      id: "arterial",
      name: "Arterial",
      icon: "🛣️",
      description: "Jalan utama dengan lalu lintas tinggi",
    },
    {
      id: "kolektor",
      name: "Kolektor",
      icon: "🔗",
      description: "Jalan penghubung dengan lalu lintas sedang",
    },
    {
      id: "lokal",
      name: "Lokal",
      icon: "🏘️",
      description: "Jalan lokal dengan lalu lintas rendah",
    },
    {
      id: "lingkungan",
      name: "Lingkungan",
      icon: "🏡",
      description: "Jalan lingkungan dengan lalu lintas sangat rendah",
    },
  ];

  // Calculate statistics
  const calculateStats = useCallback(() => {
    const values = Array.from(gridData.values())
      .map(cell => parseFloat(cell.value))
      .filter(val => !isNaN(val) && isFinite(val) && val > 0);

    if (values.length === 0) {
      return { min: 0, max: 0, avg: 0, uniformity: 0 };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const uniformity = max > 0 ? (min / max) : 0;

    return { min, max, avg, uniformity };
  }, [gridData]);

  const stats = useMemo(() => calculateStats(), [calculateStats]);

  // Generate grid based on dimensions
  const handleGenerateGrid = useCallback(() => {
    const jarakValue = parseFloat(jarakTiang);
    const lebarValue = parseFloat(lebarJalan);

    if (!jenisJalan) {
      alert("Pilih jenis jalan terlebih dahulu!");
      return;
    }

    if (isNaN(jarakValue) || isNaN(lebarValue) || jarakValue < 10 || jarakValue > 100 || lebarValue < 10 || lebarValue > 50) {
      alert("Masukkan jarak tiang (10-100) dan lebar jalan (10-50) yang valid!");
      return;
    }

    // Lebar jalan = columns (horizontal/ke kanan)
    // Jarak tiang = rows (vertical/ke bawah)
    const newRows = Math.ceil(jarakValue);
    const newCols = Math.ceil(lebarValue);

    setRows(newRows);
    setCols(newCols);
    setGridData(new Map());
    setIsGridReady(true);
  }, [jenisJalan, jarakTiang, lebarJalan]);

  const getCellKey = (row: number, col: number) => `${row}-${col}`;

  const handleCellChange = useCallback((row: number, col: number, value: string) => {
    const cellKey = getCellKey(row, col);
    setGridData(prev => {
      const newMap = new Map(prev);
      if (value.trim() === "") {
        newMap.delete(cellKey);
      } else {
        newMap.set(cellKey, { value });
      }
      return newMap;
    });
  }, []);

  const handleLoadDataFromTop = useCallback(() => {
    if (gridData.size === 0) {
      alert("Tidak ada data untuk di-load!");
      return;
    }
    // Load dari atas ke bawah (copy first row to all rows)
    const newMap = new Map<string, GridCell>();
    for (let col = 0; col < cols; col++) {
      const firstRowKey = getCellKey(0, col);
      const firstRowData = gridData.get(firstRowKey);
      if (firstRowData) {
        for (let row = 0; row < rows; row++) {
          const cellKey = getCellKey(row, col);
          newMap.set(cellKey, { value: firstRowData.value });
        }
      }
    }
    setGridData(newMap);
  }, [gridData, rows, cols]);

  const handleLoadDataFromBottom = useCallback(() => {
    if (gridData.size === 0) {
      alert("Tidak ada data untuk di-load!");
      return;
    }
    // Load dari bawah ke atas (copy last row to all rows)
    const newMap = new Map<string, GridCell>();
    for (let col = 0; col < cols; col++) {
      const lastRowKey = getCellKey(rows - 1, col);
      const lastRowData = gridData.get(lastRowKey);
      if (lastRowData) {
        for (let row = 0; row < rows; row++) {
          const cellKey = getCellKey(row, col);
          newMap.set(cellKey, { value: lastRowData.value });
        }
      }
    }
    setGridData(newMap);
  }, [gridData, rows, cols]);

  const handleReset = useCallback(() => {
    setJenisJalan("");
    setJarakTiang("");
    setLebarJalan("");
    setGridData(new Map());
    setRows(0);
    setCols(0);
    setIsGridReady(false);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-red-50 to-red-100" style={{ contain: 'layout style' }}>
      {/* Header - Professional & Modern */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-md border-b-2 border-red-200" style={{ contain: 'layout style paint' }}>
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Left Section: Logo & Title */}
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <button
                onClick={() => router.push("/module-selection")}
                className="w-10 h-10 flex items-center justify-center text-white bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-xl shadow-md transition-all active:scale-95 flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-12 h-12 flex-shrink-0 bg-gradient-to-br from-red-100 to-red-50 rounded-xl p-2 shadow-sm">
                  <Image
                    src="/Logo/BDG1.png"
                    alt="Logo"
                    fill
                    className="object-contain p-1"
                  />
                </div>
                
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text">
                    Analisis Kemerataan Cahaya
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-600 font-medium">
                    Perhitungan Uniformity Ratio
                  </p>
                </div>
              </div>
            </div>

            {/* Right Section: User Info */}
            {user && (
              <div className="hidden sm:flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl shadow-sm flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-md">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="text-sm font-bold text-gray-800">{user.displayName}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex gap-4 px-4 sm:px-6 py-4">
        {/* Left Sidebar - Fixed with own scroll */}
        <aside className="w-80 flex-shrink-0 sticky top-20 h-[calc(100vh-6rem)] overflow-y-auto space-y-4" style={{ scrollbarWidth: 'thin' }}>
          {/* Setup Card */}
          <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-200">
            <h2 className="text-base font-bold text-gray-900 mb-4">Pilih jenis jalan dan span untuk memulai analisis</h2>
          
          {/* Jenis Jalan Selection */}
          <div className="mb-5">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-3">
              <span className="text-orange-500">#</span>
              Pilih Jenis Jalan
            </label>
            <div className="space-y-2">
              {jenisJalanOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setJenisJalan(option.id as JenisJalan)}
                  className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                    jenisJalan === option.id
                      ? "border-orange-400 bg-orange-50 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{option.icon}</span>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 text-sm">{option.name}</p>
                      <p className="text-xs text-gray-600">{option.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Statistik Grid */}
          <div className="bg-red-50 rounded-lg p-4 border border-red-200 mb-5">
            <p className="text-sm font-bold text-red-900 mb-3">Statistik Grid:</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-red-700">L-Min:</span>
                <span className="font-bold text-gray-900">{stats.min.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-700">L-Max:</span>
                <span className="font-bold text-gray-900">{stats.max.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-700">L-Avg:</span>
                <span className="font-bold text-gray-900">{stats.avg.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-700">Uniformity Ratio:</span>
                <span className="font-bold text-gray-900">{stats.uniformity.toFixed(3)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-red-200">
                <span className="text-red-700">Data:</span>
                <span className="font-bold text-gray-900">{gridData.size} sel</span>
              </div>
            </div>
          </div>

          {/* Ukuran Grid */}
          <div className="mb-5">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-3">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Ukuran Jarak Tiang Dan Lebar Jalan
            </label>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-1.5">Jarak Tiang</label>
                <input
                  type="number"
                  placeholder="Masukkan jarak (10-100)"
                  value={jarakTiang}
                  onChange={(e) => setJarakTiang(e.target.value)}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-sm font-semibold text-gray-900 placeholder:text-gray-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-1.5">Lebar Jalan</label>
                <input
                  type="number"
                  placeholder="Masukkan lebar (10-50)"
                  value={lebarJalan}
                  onChange={(e) => setLebarJalan(e.target.value)}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-sm font-semibold text-gray-900 placeholder:text-gray-500 bg-white"
                />
              </div>
            </div>
            {jarakTiang && lebarJalan && (
              <div className="mt-3 p-3 bg-green-100 rounded-lg border-2 border-green-400">
                <p className="text-sm text-green-900 font-bold">
                  Jarak Tiang {jarakTiang} Lebar Jalan {lebarJalan}
                </p>
                <p className="text-sm text-green-800 font-semibold mt-1">
                  Total sel: {Math.ceil(parseFloat(jarakTiang) || 0) * Math.ceil(parseFloat(lebarJalan) || 0)} sel
                </p>
              </div>
            )}
          </div>

          {/* Action Button */}
          <button
            onClick={handleGenerateGrid}
            disabled={!jenisJalan || !jarakTiang || !lebarJalan}
            className="w-full py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all shadow-sm active:scale-95 text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {isGridReady ? "Terapkan" : "Terapkan"}
          </button>
        </div>

        {/* Load Data Section */}
        {isGridReady && (
          <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-200">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-3">
              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
              Load Data
            </label>
            <div className="space-y-2">
              <button
                onClick={handleLoadDataFromTop}
                className="w-full px-3 py-2.5 bg-white hover:bg-red-50 text-gray-700 text-sm font-medium rounded-lg border-2 border-gray-200 hover:border-red-300 transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <span>Load Data Pertama (Atas ke Bawah)</span>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button
                onClick={handleLoadDataFromBottom}
                className="w-full px-3 py-2.5 bg-white hover:bg-green-50 text-gray-700 text-sm font-medium rounded-lg border-2 border-gray-200 hover:border-green-300 transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  <span>Load Data Kedua (Bawah ke Atas)</span>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </aside>

        {/* Main Grid Area */}
        <div className="flex-1 min-w-0">
          {isGridReady ? (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 h-full">
              {/* Grid Header */}
              <div className="px-6 py-5 border-b-2 border-gray-200 bg-gradient-to-r from-red-500 to-red-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        Kemerataan Sinar - {jenisJalanOptions.find(j => j.id === jenisJalan)?.name || ""}
                      </h3>
                      <p className="text-sm text-red-100 flex items-center gap-1.5 mt-0.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Analisis Kemerataan
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-semibold text-sm rounded-lg transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reset
                  </button>
                </div>
              </div>

              {/* Grid Content */}
              <div className="p-6 overflow-x-auto">
                <div className="inline-block min-w-full">
                  <div
                    className="grid gap-2 p-4 bg-gradient-to-br from-gray-50 to-red-50 rounded-xl shadow-inner"
                    style={{
                      gridTemplateColumns: `80px repeat(${cols}, minmax(70px, 1fr))`,
                      contain: 'layout style paint'
                    }}
                  >
                    {/* Top-left corner label */}
                    <div className="bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-xs font-bold text-white p-3 rounded-lg shadow-md">
                      <div className="text-center leading-tight">
                        <div>Jarak</div>
                        <div>Tiang (m)</div>
                      </div>
                    </div>
                    
                    {/* Column Headers */}
                    {Array.from({ length: cols }, (_, i) => (
                      <div key={`header-${i}`} className="bg-gradient-to-b from-red-500 to-red-600 flex items-center justify-center font-bold text-sm text-white p-3 rounded-lg shadow-md">
                        {i + 1}
                      </div>
                    ))}

                    {/* Grid Rows */}
                    {Array.from({ length: rows }, (_, row) => (
                      <div key={`row-${row}`} className="contents">
                        {/* Row Header */}
                        <div className="bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center font-bold text-sm text-white p-3 rounded-lg shadow-md">
                          {row + 1}
                        </div>
                        
                        {/* Row Cells - Read Only */}
                        {Array.from({ length: cols }, (_, col) => {
                          const cellKey = getCellKey(row, col);
                          const cellData = gridData.get(cellKey);
                          const value = cellData?.value || "0";
                          const numValue = parseFloat(value);
                          
                          // Color coding based on value (similar to measurement grid)
                          let cellColor = "bg-white text-gray-500"; // Default empty
                          if (numValue > 0) {
                            if (numValue >= 50) cellColor = "bg-red-400 text-white shadow-sm";
                            else if (numValue >= 40) cellColor = "bg-orange-400 text-white";
                            else if (numValue >= 30) cellColor = "bg-yellow-300 text-gray-900";
                            else if (numValue >= 20) cellColor = "bg-yellow-200 text-gray-800";
                            else if (numValue >= 10) cellColor = "bg-yellow-100 text-gray-700";
                            else if (numValue >= 5) cellColor = "bg-orange-50 text-gray-600";
                            else cellColor = "bg-white text-gray-500";
                          }
                          
                          return (
                            <div
                              key={cellKey}
                              className={`h-14 px-2 flex items-center justify-center border-2 border-gray-200 rounded-lg text-sm font-bold transition-all ${cellColor}`}
                              style={{ contain: 'layout style paint' }}
                              title={`Row ${row + 1}, Col ${col + 1}: ${value}`}
                            >
                              {value}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg border-2 border-dashed border-gray-300 h-full flex items-center justify-center p-12">
              <div className="text-center">
                <svg className="w-20 h-20 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7H4V5zM10 5a1 1 0 011-1h4a1 1 0 011 1v7h-6V5zM16 5a1 1 0 011-1h4a1 1 0 011 1v7h-6V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM10 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3zM16 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                </svg>
                <h3 className="text-xl font-bold text-gray-400 mb-2">Belum Ada Grid</h3>
                <p className="text-sm text-gray-500 max-w-md">
                  Pilih jenis jalan dan masukkan ukuran grid pada panel kiri, kemudian klik tombol <span className="font-semibold text-green-600">"Terapkan"</span> untuk memulai analisis
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function KemeratanCahayaPage() {
  return (
    <ProtectedRoute>
      <KemeratanCahayaContent />
    </ProtectedRoute>
  );
}

export default KemeratanCahayaPage;
