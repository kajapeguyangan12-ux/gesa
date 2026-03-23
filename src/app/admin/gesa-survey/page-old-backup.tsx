"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Petugas {
  id: string;
  name: string;
  email: string;
  role?: string;
}

function GesaSurveyContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [showTaskDropdown, setShowTaskDropdown] = useState(false);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [showExistingModal, setShowExistingModal] = useState(false);
  const [showProposeExistingModal, setShowProposeExistingModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [selectedSurveyor, setSelectedSurveyor] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [kmzFile, setKmzFile] = useState<File | null>(null);
  const [kmzFile2, setKmzFile2] = useState<File | null>(null);
  const [petugasList, setPetugasList] = useState<Petugas[]>([]);
  const [loadingPetugas, setLoadingPetugas] = useState(false);

  // Fetch petugas when modal opens
  useEffect(() => {
    if (showProposeModal || showExistingModal || showProposeExistingModal) {
      fetchPetugas();
    }
  }, [showProposeModal, showExistingModal, showProposeExistingModal]);

  // Prevent body scrolling when modal is open
  useEffect(() => {
    if (showProposeModal || showExistingModal || showProposeExistingModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showProposeModal, showExistingModal, showProposeExistingModal]);

  const fetchPetugas = async () => {
    try {
      setLoadingPetugas(true);
      
      // Fetch all users and filter by multiple roles
      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);
      
      const data = snapshot.docs
        .filter((doc) => {
          const role = doc.data().role;
          return role === "petugas" || role === "petugas existing" || role === "petugas apj propose";
        })
        .map((doc) => ({
          id: doc.id,
          name: doc.data().name,
          email: doc.data().email,
          role: doc.data().role,
        })) as (Petugas & { role: string })[];
      
      setPetugasList(data);
    } catch (error) {
      console.error("Error fetching petugas:", error);
    } finally {
      setLoadingPetugas(false);
    }
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "distribusi-tugas", label: "Distribusi Tugas", icon: "📋" },
    { id: "validasi-survey", label: "Validasi Survey", icon: "✓" },
    { id: "data-survey-valid", label: "Data Survey Valid", icon: "📁" },
    { id: "mapa-validasi", label: "Mapa Validasi", icon: "🗺️" },
    { id: "progress-surveyor", label: "Progress Surveyor", icon: "📈" },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Modal Tugas Propose */}
      {showProposeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto my-8 relative">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 rounded-t-2xl flex items-center justify-between z-10 shadow-lg">
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
                <div className="relative">
                  <select
                    value={selectedSurveyor}
                    onChange={(e) => setSelectedSurveyor(e.target.value)}
                    disabled={loadingPetugas}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {loadingPetugas 
                        ? "Memuat data..." 
                        : petugasList.length === 0 
                        ? "Tidak ada petugas tersedia" 
                        : "Pilih Surveyor"}
                    </option>
                    {!loadingPetugas && petugasList.map((petugas) => (
                      <option key={petugas.id} value={petugas.id} className="text-gray-900">
                        {petugas.name} - {petugas.email} ({petugas.role === "petugas apj propose" ? "APJ Propose" : petugas.role === "petugas existing" ? "Existing" : "Petugas"}) ({petugas.role === "petugas apj propose" ? "APJ Propose" : petugas.role === "petugas existing" ? "Existing" : "Petugas"})
                      </option>
                    ))}
                  </select>
                  <svg className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
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
                    setTaskDescription("");
                    setExcelFile(null);
                    setKmzFile(null);
                  }}
                  className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    // Handle submit logic
                    console.log("Submit task");
                  }}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-sm flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Buat Tugas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tugas Zona Existing */}
      {showExistingModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto my-8 relative">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 rounded-t-2xl flex items-center justify-between z-10 shadow-lg">
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
                <div className="relative">
                  <select
                    value={selectedSurveyor}
                    onChange={(e) => setSelectedSurveyor(e.target.value)}
                    disabled={loadingPetugas}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="" className="text-gray-400">Pilih Surveyor</option>
                    {loadingPetugas ? (
                      <option value="" disabled>Memuat data...</option>
                    ) : petugasList.length === 0 ? (
                      <option value="" disabled>Tidak ada petugas tersedia</option>
                    ) : (
                      petugasList.map((petugas) => (
                        <option key={petugas.id} value={petugas.id} className="text-gray-900">
                          {petugas.name} - {petugas.email}
                        </option>
                      ))
                    )}
                  </select>
                  <svg className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
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
                    onChange={(e) => setKmzFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="kmz-upload-existing"
                  />
                  <label htmlFor="kmz-upload-existing" className="cursor-pointer">
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
                    setTaskDescription("");
                    setKmzFile(null);
                  }}
                  className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    // Handle submit logic
                    console.log("Submit zona existing task");
                  }}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-sm flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Buat Tugas
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
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-5 rounded-t-2xl flex items-center justify-between z-10 shadow-lg">
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
                <div className="relative">
                  <select
                    value={selectedSurveyor}
                    onChange={(e) => setSelectedSurveyor(e.target.value)}
                    disabled={loadingPetugas}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {loadingPetugas 
                        ? "Memuat data..." 
                        : petugasList.length === 0 
                        ? "Tidak ada petugas tersedia" 
                        : "Pilih Surveyor"}
                    </option>
                    {!loadingPetugas && petugasList.map((petugas) => (
                      <option key={petugas.id} value={petugas.id} className="text-gray-900">
                        {petugas.name} - {petugas.email} ({petugas.role === "petugas apj propose" ? "APJ Propose" : petugas.role === "petugas existing" ? "Existing" : "Petugas"})
                      </option>
                    ))}
                  </select>
                  <svg className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
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
                    setTaskDescription("");
                    setKmzFile(null);
                    setKmzFile2(null);
                  }}
                  className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    // Handle submit logic
                    console.log("Submit propose & existing task");
                  }}
                  className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-all shadow-sm flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Buat Tugas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar - Hidden on mobile */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Admin Panel</h3>
              <p className="text-xs text-gray-500">Survey Management</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveMenu(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${
                  activeMenu === item.id
                    ? "bg-green-50 text-green-700 border-l-4 border-green-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => router.push("/admin/module-selection")}
            className="w-full flex items-center gap-2 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-all text-sm font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Kembali ke Module</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Admin Gesa Survey</h1>
              <p className="text-sm text-gray-500">Kelola dan pantau aktivitas survey</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Mobile Menu Button */}
              <button className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              {/* Notification */}
              <button className="p-2 hover:bg-gray-100 rounded-lg relative">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              
              {/* Settings */}
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {activeMenu === "distribusi-tugas" ? (
            <>
              {/* Header Section */}
              <div className="mb-6 bg-white rounded-2xl shadow-sm p-4 lg:p-6 border border-gray-100">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
                      Manajemen Tugas Survey
                    </h2>
                    <p className="text-sm text-gray-600">
                      Pantau dan kelola distribusi tugas untuk tim surveyor
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="p-2.5 hover:bg-gray-100 rounded-lg transition-all">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    
                    {/* Dropdown Button */}
                    <div className="relative">
                      <button 
                        onClick={() => setShowTaskDropdown(!showTaskDropdown)}
                        className="flex items-center gap-2 px-4 lg:px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-sm"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Buat Tugas Baru</span>
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Dropdown Menu */}
                      {showTaskDropdown && (
                        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden z-50">
                          <div className="p-2">
                            {/* Tugas APJ Propose */}
                            <button 
                              onClick={() => {
                                setShowTaskDropdown(false);
                                setShowProposeModal(true);
                              }}
                              className="w-full flex items-start gap-4 p-4 rounded-xl hover:bg-gray-50 transition-all group"
                            >
                              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-green-200 transition-all">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </div>
                              <div className="flex-1 text-left">
                                <h4 className="font-bold text-gray-900 mb-1">Tugas APJ Propose</h4>
                                <p className="text-sm text-gray-600">Survey area baru dengan titik koordinat</p>
                              </div>
                            </button>

                            {/* Tugas Zona Existing */}
                            <button 
                              onClick={() => {
                                setShowTaskDropdown(false);
                                setShowExistingModal(true);
                              }}
                              className="w-full flex items-start gap-4 p-4 rounded-xl hover:bg-gray-50 transition-all group"
                            >
                              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-all">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                              </div>
                              <div className="flex-1 text-left">
                                <h4 className="font-bold text-gray-900 mb-1">Tugas Zona Existing</h4>
                                <p className="text-sm text-gray-600">Survey area terpasang dengan zona polygon</p>
                              </div>
                            </button>

                            {/* Tugas Propose & Existing */}
                            <button 
                              onClick={() => {
                                setShowTaskDropdown(false);
                                setShowProposeExistingModal(true);
                              }}
                              className="w-full flex items-start gap-4 p-4 rounded-xl hover:bg-gray-50 transition-all group"
                            >
                              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-purple-200 transition-all">
                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                                </svg>
                              </div>
                              <div className="flex-1 text-left">
                                <h4 className="font-bold text-gray-900 mb-1">Tugas Propose & Existing</h4>
                                <p className="text-sm text-gray-600">Survey kombinasi area baru dan terpasang</p>
                              </div>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-blue-900">Total Tugas</p>
                      <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-3xl font-bold text-blue-900">0</h3>
                  </div>

                  <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4 border border-yellow-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-yellow-900">Sedang Berjalan</p>
                      <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-3xl font-bold text-yellow-900">0</h3>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-green-900">Selesai</p>
                      <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-3xl font-bold text-green-900">0</h3>
                  </div>

                  <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-red-900">Pending</p>
                      <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-3xl font-bold text-red-900">0</h3>
                  </div>
                </div>
              </div>

              {/* Task List Section */}
              <div className="bg-white rounded-2xl shadow-sm p-4 lg:p-6 border border-gray-100">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">Daftar Tugas</h3>
                    <p className="text-sm text-gray-600">0 tugas ditemukan</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 lg:flex-initial lg:w-64">
                      <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Cari tugas..."
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all">
                      <span>Semua Status</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all">
                      <span>Semua Prioritas</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Empty State */}
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Tugas</h4>
                  <p className="text-sm text-gray-600 text-center max-w-md mb-6">
                    Mulai dengan membuat tugas baru untuk mendistribusikan pekerjaan survey kepada tim Anda.
                  </p>
                  <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Buat Tugas Pertama</span>
                  </button>
                </div>
              </div>
            </>
          ) : activeMenu === "validasi-survey" ? (
            <>
              {/* Validasi Survey Content */}
              <div className="mb-6 bg-white rounded-2xl shadow-sm p-4 lg:p-6 border border-gray-100">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
                      Validasi Survey
                    </h2>
                    <p className="text-sm text-gray-600">
                      Kelola dan pantau aktivitas survey
                    </p>
                  </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                    <p className="text-sm font-medium text-blue-900 mb-1">Total Survey</p>
                    <h3 className="text-4xl font-bold text-blue-600">2</h3>
                  </div>

                  <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4 border border-yellow-200">
                    <p className="text-sm font-medium text-yellow-900 mb-1">Menunggu</p>
                    <h3 className="text-4xl font-bold text-yellow-600">2</h3>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                    <p className="text-sm font-medium text-green-900 mb-1">Tervalidasi</p>
                    <h3 className="text-4xl font-bold text-green-600">0</h3>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="mb-6 bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="flex border-b border-gray-200">
                  <button className="flex items-center gap-2 px-6 py-4 font-semibold text-blue-600 border-b-2 border-blue-600">
                    <span className="text-xl">📁</span>
                    Survey Existing
                  </button>
                  <button className="flex items-center gap-2 px-6 py-4 font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50">
                    <span className="text-xl">💡</span>
                    Survey APJ Propose
                  </button>
                </div>

                {/* Filters */}
                <div className="p-4 lg:p-6 border-b border-gray-200">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        Filter:
                      </div>
                      <select className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>Semua Status</option>
                        <option>Menunggu</option>
                        <option>Tervalidasi</option>
                        <option>Ditolak</option>
                      </select>
                      <select className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>Semua Tipe</option>
                      </select>
                      <select className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>Terbaru</option>
                        <option>Terlama</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>Tampilkan:</span>
                      <select className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>10</option>
                        <option>25</option>
                        <option>50</option>
                      </select>
                      <span>per halaman</span>
                      <span className="ml-4 font-medium">Menampilkan 1-2 dari 2 data</span>
                    </div>
                  </div>
                </div>

                {/* Survey List */}
                <div className="p-4 lg:p-6">
                  {/* Section Header */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-xl">📁</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">Survey Existing</h3>
                        <p className="text-xs text-gray-600">Survey Existing dan infrastruktur pendukung</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                      2 Survey (Hal 1)
                    </span>
                  </div>

                  {/* Survey Cards */}
                  <div className="space-y-4">
                    {/* Survey Card 1 */}
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                      <div className="flex flex-col lg:flex-row gap-4">
                        {/* Photo Placeholder */}
                        <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-gray-500 text-xs font-medium">No Foto</span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-bold text-gray-900 mb-1">Rr</h4>
                              <div className="flex flex-wrap gap-2">
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                  </svg>
                                  Menunggu
                                </span>
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                                  🖋️ Diedit oleh adminsurvey1
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span>dery</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>30/12/2025 14:52</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span>-8.6490032, 115.2142389</span>
                            </div>
                          </div>

                          <p className="text-xs text-gray-600">
                            Kepemilikan: N/A • Jenis: N/A • Tinggi ARM: N/A
                          </p>

                          {/* Actions */}
                          <div className="flex flex-wrap items-center gap-2">
                            <button className="p-2 hover:bg-blue-100 rounded-lg transition-all" title="Lihat Detail">
                              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button className="p-2 hover:bg-blue-100 rounded-lg transition-all" title="Edit">
                              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button className="p-2 hover:bg-red-100 rounded-lg transition-all" title="Hapus">
                              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                            <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Validasi
                            </button>
                            <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Tolak
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Survey Card 2 */}
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                      <div className="flex flex-col lg:flex-row gap-4">
                        {/* Photo Placeholder */}
                        <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-gray-500 text-xs font-medium">No Foto</span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-bold text-gray-900 mb-1">Dd</h4>
                              <div className="flex flex-wrap gap-2">
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                  </svg>
                                  Menunggu
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span>hendi</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>29/12/2025 15:55</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span>-8.6488508, 115.214352</span>
                            </div>
                          </div>

                          <p className="text-xs text-gray-600">
                            Kepemilikan: PLN • Jenis: Besi • Tinggi ARM: N/A
                          </p>

                          {/* Actions */}
                          <div className="flex flex-wrap items-center gap-2">
                            <button className="p-2 hover:bg-blue-100 rounded-lg transition-all" title="Lihat Detail">
                              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button className="p-2 hover:bg-blue-100 rounded-lg transition-all" title="Edit">
                              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button className="p-2 hover:bg-red-100 rounded-lg transition-all" title="Hapus">
                              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                            <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Validasi
                            </button>
                            <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Tolak
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Dashboard Content */}
              <div className="mb-6 bg-gradient-to-r from-green-600 to-green-700 rounded-2xl shadow-lg p-4 lg:p-6">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl lg:text-2xl font-bold text-white mb-1">
                        Dashboard Survey
                      </h2>
                      <p className="text-sm text-green-100">
                        Kelola dan pantau aktivitas survey
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-all border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Distribusi Tugas</h3>
                  <p className="text-sm text-gray-600 mb-4">Kelola distribusi tugas survey kepada petugas</p>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-green-600">0</div>
                    <button 
                      onClick={() => setActiveMenu("distribusi-tugas")}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-medium"
                    >
                      Kelola
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-all border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Validasi Survey</h3>
                  <p className="text-sm text-gray-600 mb-4">Review dan validasi hasil survey</p>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-blue-600">0</div>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium">
                      Kelola
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-all border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Progress Surveyor</h3>
                  <p className="text-sm text-gray-600 mb-4">Monitor progress petugas survey</p>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-purple-600">0</div>
                    <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all text-sm font-medium">
                      Lihat
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function GesaSurveyPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/module-selection");
    }
  }, [user, router]);

  return (
    <ProtectedRoute>
      <GesaSurveyContent />
    </ProtectedRoute>
  );
}
