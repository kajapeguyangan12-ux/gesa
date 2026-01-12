"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import dynamic from "next/dynamic";

// Define props type inline
interface MapComponentProps {
  latitude: number;
  longitude: number;
  accuracy?: number;
  title: string;
}

// Dynamic import for Map
const DynamicDetailMap = dynamic<MapComponentProps>(
  () => import("@/app/admin/gesa-survey/components/SurveyDetailMap"),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-64 lg:h-96 bg-gray-100 rounded-xl flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Memuat peta...</p>
        </div>
      </div>
    )
  }
);

interface Survey {
  id: string;
  title: string;
  type: string;
  status: string;
  surveyorName: string;
  surveyorEmail?: string;
  createdAt: any;
  latitude: number;
  longitude: number;
  accuracy?: number;
  
  // Survey Existing fields
  lokasiJalan?: string;
  namaJalan?: string;
  namaGang?: string;
  jenisExisting?: string;
  keteranganTiang?: string;
  kepemilikan?: string;
  jenisTitik?: string;
  palet?: string;
  lumina?: string;
  metodeUkur?: string;
  tinggiMedian?: string;
  lebarMedian?: string;
  medianDisplay?: string;
  lebarJalan1?: string;
  lebarJalan2?: string;
  lebarJalanDisplay?: string;
  lebarTrotoar?: string;
  lamnyaBerdekatan?: string;
  tinggiAPM?: string;
  tinggiARM?: string;
  tinggiArm?: string;
  keterangan?: string;
  lebarBahuBertiang?: string;
  lebarTrotoarBertiang?: string;
  lainnyaBertiang?: string;
  
  // APJ Propose specific fields
  statusIDTitik?: string;
  idTitik?: string;
  dayaLampu?: string;
  dataTiang?: string;
  dataRuas?: string;
  subRuas?: string;
  median?: string;
  lebarJalan?: string;
  jarakAntarTiang?: string;
  fotoKemerataan?: string;
  
  // Photos
  fotoTiangAPM?: string;
  fotoTitikActual?: string;
  photoUrl?: string;
  
  // Metadata
  jenis?: string;
  zona?: string;
  kategori?: string;
  editedBy?: string;
}

export default function ValidasiSurvey() {
  const [activeTab, setActiveTab] = useState<"existing" | "propose">("existing");
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Survey | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Filter states
  const [filterStatus, setFilterStatus] = useState<string>("Semua Status");
  const [filterJenisExisting, setFilterJenisExisting] = useState<string>("Semua Jenis");
  const [filterSort, setFilterSort] = useState<string>("Terbaru");

  // State untuk menyimpan semua surveys
  const [allSurveys, setAllSurveys] = useState<Survey[]>([]);

  // Fetch surveys from Firebase
  useEffect(() => {
    fetchSurveys();
  }, [activeTab]);

  const fetchSurveys = async () => {
    try {
      setLoading(true);
      
      // Fetch data dari kedua collection untuk statistik
      const existingRef = collection(db, "survey-existing");
      const proposeRef = collection(db, "survey-apj-propose");
      
      const [existingSnapshot, proposeSnapshot] = await Promise.all([
        getDocs(existingRef),
        getDocs(proposeRef)
      ]);
      
      const existingData = existingSnapshot.docs
        .filter((doc) => doc.data().status === "diverifikasi")
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
          title: doc.data().title || `Survey existing - ${doc.data().namaJalan || "Untitled"}`,
          type: "existing",
          status: doc.data().status || "menunggu",
          surveyorName: doc.data().surveyorName || "Unknown",
          kepemilikan: doc.data().kepemilikan || doc.data().keteranganTiang || "N/A",
          jenis: doc.data().jenis || doc.data().jenisTitik || "N/A",
          tinggiArm: doc.data().tinggiArm || doc.data().tinggiARM || "N/A",
        })) as Survey[];
      
      const proposeData = proposeSnapshot.docs
        .filter((doc) => doc.data().status === "diverifikasi")
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
          title: doc.data().title || `Survey propose - ${doc.data().namaJalan || "Untitled"}`,
          type: "propose",
          status: doc.data().status || "menunggu",
          surveyorName: doc.data().surveyorName || "Unknown",
          kepemilikan: doc.data().kepemilikan || doc.data().keteranganTiang || "N/A",
          jenis: doc.data().jenis || doc.data().jenisTitik || "N/A",
          tinggiArm: doc.data().tinggiArm || doc.data().tinggiARM || "N/A",
        })) as Survey[];
      
      // Simpan semua surveys untuk statistik
      setAllSurveys([...existingData, ...proposeData]);
      
      // Set surveys berdasarkan activeTab untuk list
      setSurveys(activeTab === "existing" ? existingData : proposeData);
    } catch (error) {
      console.error("Error fetching surveys:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort surveys
  const filteredSurveys = surveys.filter(survey => {
    // Filter by status
    if (filterStatus !== "Semua Status") {
      const statusLower = filterStatus.toLowerCase();
      if (survey.status !== statusLower) return false;
    }
    
    // Filter by jenis existing (only for existing tab)
    if (activeTab === "existing" && filterJenisExisting !== "Semua Jenis") {
      if (survey.jenisExisting !== filterJenisExisting) return false;
    }
    
    return true;
  }).sort((a, b) => {
    // Sort by date
    if (filterSort === "Terbaru") {
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    } else {
      return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    }
  });
  
  // Calculate statistics dari semua surveys yang diverifikasi
  const totalSurveys = allSurveys.length;
  const totalExisting = allSurveys.filter(s => s.type === "existing").length;
  const totalPropose = allSurveys.filter(s => s.type === "propose").length;
  const diverifikasiCount = allSurveys.length; // semua yang tampil adalah diverifikasi

  const handleViewDetail = (survey: Survey) => {
    setSelectedSurvey(survey);
    setShowDetailModal(true);
  };

  const handleEdit = (survey: Survey) => {
    setEditFormData(survey);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editFormData) return;
    
    try {
      setIsSaving(true);
      const collectionName = activeTab === "existing" ? "survey-existing" : "survey-apj-propose";
      const surveyRef = collection(db, collectionName);
      const surveyDoc = doc(db, collectionName, editFormData.id);
      
      // Get current user from localStorage
      const userData = localStorage.getItem('userData');
      const currentUser = userData ? JSON.parse(userData) : null;
      
      // Update document
      await updateDoc(surveyDoc, {
        ...editFormData,
        editedBy: currentUser?.name || currentUser?.email || 'Admin',
        updatedAt: new Date()
      });
      
      // Refresh surveys
      await fetchSurveys();
      setShowEditModal(false);
      setEditFormData(null);
      
      alert('Data berhasil diperbarui!');
    } catch (error) {
      console.error('Error updating survey:', error);
      alert('Gagal memperbarui data: ' + error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidasi = async (survey: Survey) => {
    if (!confirm('Apakah Anda yakin ingin memvalidasi survey ini? Survey akan dipindahkan ke Data Survey Valid.')) return;
    
    try {
      const collectionName = survey.type === "existing" ? "survey-existing" : "survey-apj-propose";
      const surveyDoc = doc(db, collectionName, survey.id);
      
      // Get current user from localStorage
      const userData = localStorage.getItem('userData');
      const currentUser = userData ? JSON.parse(userData) : null;
      
      // Update status to tervalidasi (final validation)
      await updateDoc(surveyDoc, {
        status: "tervalidasi",
        validatedBy: currentUser?.name || currentUser?.email || 'Admin',
        validatedAt: new Date()
      });
      
      // Refresh surveys
      await fetchSurveys();
      setShowDetailModal(false);
      setSelectedSurvey(null);
      
      alert('Survey berhasil divalidasi! Survey dipindahkan ke Data Survey Valid.');
    } catch (error) {
      console.error('Error validating survey:', error);
      alert('Gagal memvalidasi survey: ' + error);
    }
  };

  const handleTolak = async (survey: Survey) => {
    const alasan = prompt('Masukkan alasan penolakan:');
    if (!alasan) return;
    
    try {
      const collectionName = survey.type === "existing" ? "survey-existing" : "survey-apj-propose";
      const surveyDoc = doc(db, collectionName, survey.id);
      
      // Get current user from localStorage
      const userData = localStorage.getItem('userData');
      const currentUser = userData ? JSON.parse(userData) : null;
      
      // Update status to ditolak
      await updateDoc(surveyDoc, {
        status: "ditolak",
        rejectedBy: currentUser?.name || currentUser?.email || 'Admin',
        rejectedAt: new Date(),
        rejectionReason: alasan
      });
      
      // Refresh surveys
      await fetchSurveys();
      setShowDetailModal(false);
      setSelectedSurvey(null);
      
      alert('Survey berhasil ditolak!');
    } catch (error) {
      console.error('Error rejecting survey:', error);
      alert('Gagal menolak survey: ' + error);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return "N/A";
    }
  };

  return (
    <>
      {/* Validasi Survey Content */}
      <div className="mb-6 bg-white rounded-2xl shadow-sm p-4 lg:p-6 border border-gray-100">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
              Validasi Survey
            </h2>
            <p className="text-sm text-gray-600">
              Data survey yang sudah diverifikasi, menunggu validasi akhir untuk dipindahkan ke Data Survey Valid
            </p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
            <p className="text-sm font-medium text-blue-900 mb-1">Total Survey</p>
            <h3 className="text-4xl font-bold text-blue-600">{totalSurveys}</h3>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
            <p className="text-sm font-medium text-orange-900 mb-1">Total Survey Existing</p>
            <h3 className="text-4xl font-bold text-orange-600">{totalExisting}</h3>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
            <p className="text-sm font-medium text-purple-900 mb-1">Total Survey APJ Propose</p>
            <h3 className="text-4xl font-bold text-purple-600">{totalPropose}</h3>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
            <p className="text-sm font-medium text-green-900 mb-1">Menunggu Validasi</p>
            <h3 className="text-4xl font-bold text-green-600">{diverifikasiCount}</h3>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-200">
          <button 
            onClick={() => setActiveTab("existing")}
            className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all ${
              activeTab === "existing"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <span className="text-xl">📁</span>
            Survey Existing
          </button>
          <button 
            onClick={() => setActiveTab("propose")}
            className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all ${
              activeTab === "propose"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <span className="text-xl">💡</span>
            Survey APJ Propose
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 lg:p-6 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-black">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filter:
              </div>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Semua Status</option>
                <option>Menunggu</option>
                <option>Tervalidasi</option>
                <option>Ditolak</option>
              </select>
              {activeTab === "existing" && (
                <select 
                  value={filterJenisExisting}
                  onChange={(e) => setFilterJenisExisting(e.target.value)}
                  className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>Semua Jenis</option>
                  <option>Murni</option>
                  <option>Tidak Murni</option>
                </select>
              )}
              <select 
                value={filterSort}
                onChange={(e) => setFilterSort(e.target.value)}
                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Terbaru</option>
                <option>Terlama</option>
              </select>
            </div>
            <div className="flex items-center gap-2 text-sm text-black">
              <span>Tampilkan:</span>
              <select className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-medium text-black focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>10</option>
                <option>25</option>
                <option>50</option>
              </select>
              <span>per halaman</span>
              <span className="ml-4 font-medium">Menampilkan 1-{filteredSurveys.length} dari {surveys.length} data</span>
            </div>
          </div>
        </div>

        {/* Survey List */}
        <div className="p-4 lg:p-6">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                activeTab === "existing" ? "bg-blue-100" : "bg-yellow-100"
              }`}>
                <span className="text-xl">{activeTab === "existing" ? "📁" : "💡"}</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">
                  {activeTab === "existing" ? "Survey Existing" : "Survey APJ Propose"}
                </h3>
                <p className="text-xs text-gray-600">
                  {activeTab === "existing" 
                    ? "Survey Existing dan infrastruktur pendukung" 
                    : "Survey area baru untuk pengembangan"}
                </p>
              </div>
            </div>
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${
              activeTab === "existing" 
                ? "bg-blue-100 text-blue-700" 
                : "bg-yellow-100 text-yellow-700"
            }`}>
              {filteredSurveys.length} Survey (Hal 1)
            </span>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">Memuat data survey...</p>
            </div>
          ) : filteredSurveys.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-4xl">{activeTab === "existing" ? "📁" : "💡"}</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Survey</h4>
              <p className="text-sm text-gray-600 text-center max-w-md">
                Belum ada data survey {activeTab === "existing" ? "existing" : "APJ propose"} yang perlu divalidasi.
              </p>
            </div>
          ) : (
            /* Survey Cards */
            <div className="space-y-4">
              {filteredSurveys.map((survey) => (
                <div key={survey.id} className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Photo */}
                    <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {(survey.fotoTiangAPM || survey.fotoTitikActual || survey.photoUrl) ? (
                        <img 
                          src={survey.fotoTiangAPM || survey.fotoTitikActual || survey.photoUrl} 
                          alt={survey.title} 
                          className="w-full h-full object-cover rounded-lg"
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"%3E%3Crect fill="%23e5e7eb" width="80" height="80"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="monospace" font-size="14" fill="%239ca3af"%3ENo Image%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      ) : (
                        <span className="text-gray-400 text-xs font-medium">No Foto</span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-gray-900 mb-1">{survey.title}</h4>
                          <div className="flex flex-wrap gap-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${
                              survey.status === "menunggu" 
                                ? "bg-yellow-100 text-yellow-700"
                                : survey.status === "tervalidasi"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}>
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                              </svg>
                              {survey.status.charAt(0).toUpperCase() + survey.status.slice(1)}
                            </span>
                            {survey.editedBy && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                                🖋️ Diedit oleh {survey.editedBy}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>{survey.surveyorName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{formatDate(survey.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>{survey.latitude.toFixed(7)}, {survey.longitude.toFixed(7)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-gray-600">
                          Kepemilikan: {survey.kepemilikan} • Jenis: {survey.jenis} • Tinggi ARM: {survey.tinggiArm}
                        </p>
                        {survey.jenisExisting && (
                          <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                            survey.jenisExisting === "Murni" 
                              ? "bg-purple-600 text-white" 
                              : "bg-orange-600 text-white"
                          }`}>
                            {survey.jenisExisting}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button 
                          onClick={() => handleViewDetail(survey)}
                          className="p-2 hover:bg-blue-100 rounded-lg transition-all" 
                          title="Lihat Detail"
                        >
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button 
                          onClick={() => handleEdit(survey)}
                          className="p-2 hover:bg-blue-100 rounded-lg transition-all" 
                          title="Edit"
                        >
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button className="p-2 hover:bg-red-100 rounded-lg transition-all" title="Hapus">
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        {survey.status === "menunggu" && (
                          <>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleValidasi(survey);
                              }}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Validasi
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTolak(survey);
                              }}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Tolak
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedSurvey && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 lg:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl lg:rounded-3xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-y-auto my-4">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-4 lg:p-6 rounded-t-2xl lg:rounded-t-3xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    selectedSurvey.type === "existing" ? "bg-blue-100" : "bg-yellow-100"
                  }`}>
                    <span className="text-2xl lg:text-3xl">{selectedSurvey.type === "existing" ? "📁" : "💡"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg lg:text-2xl font-bold text-gray-900 mb-1 break-words">
                      {selectedSurvey.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs lg:text-sm text-gray-600">
                      <span className={`px-2 lg:px-3 py-1 lg:py-1.5 rounded-full font-medium ${
                        selectedSurvey.status === "menunggu" 
                          ? "bg-yellow-100 text-yellow-700"
                          : selectedSurvey.status === "tervalidasi"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {selectedSurvey.status.charAt(0).toUpperCase() + selectedSurvey.status.slice(1)}
                      </span>
                      <span>•</span>
                      <span>{formatDate(selectedSurvey.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-all flex-shrink-0"
                  title="Tutup"
                >
                  <svg className="w-5 h-5 lg:w-6 lg:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
              {/* Map Section */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-blue-200">
                <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-3 lg:mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Lokasi Survey
                </h3>
                <DynamicDetailMap 
                  latitude={selectedSurvey.latitude} 
                  longitude={selectedSurvey.longitude}
                  accuracy={selectedSurvey.accuracy || 0}
                  title={selectedSurvey.title}
                />
                <div className="mt-3 lg:mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3 text-xs lg:text-sm">
                  <div className="bg-white/70 backdrop-blur px-3 lg:px-4 py-2 lg:py-3 rounded-lg border border-blue-200">
                    <p className="text-gray-600 mb-1">Latitude</p>
                    <p className="font-mono font-bold text-gray-900">{selectedSurvey.latitude.toFixed(7)}</p>
                  </div>
                  <div className="bg-white/70 backdrop-blur px-3 lg:px-4 py-2 lg:py-3 rounded-lg border border-blue-200">
                    <p className="text-gray-600 mb-1">Longitude</p>
                    <p className="font-mono font-bold text-gray-900">{selectedSurvey.longitude.toFixed(7)}</p>
                  </div>
                </div>
              </div>

              {/* Photos Section */}
              {(selectedSurvey.fotoTiangAPM || selectedSurvey.fotoTitikActual || selectedSurvey.photoUrl) && (
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-purple-200">
                  <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-3 lg:mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 lg:w-6 lg:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Dokumentasi Foto
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                    {selectedSurvey.fotoTiangAPM && (
                      <div className="space-y-2">
                        <p className="text-xs lg:text-sm font-semibold text-gray-700">Foto Tiang APM</p>
                        <img 
                          src={selectedSurvey.fotoTiangAPM} 
                          alt="Tiang APM" 
                          className="w-full h-48 lg:h-64 object-cover rounded-lg border-2 border-white shadow-lg hover:scale-105 transition-transform cursor-pointer"
                          onClick={() => window.open(selectedSurvey.fotoTiangAPM, '_blank')}
                        />
                      </div>
                    )}
                    {selectedSurvey.fotoTitikActual && (
                      <div className="space-y-2">
                        <p className="text-xs lg:text-sm font-semibold text-gray-700">Foto Titik Actual</p>
                        <img 
                          src={selectedSurvey.fotoTitikActual} 
                          alt="Titik Actual" 
                          className="w-full h-48 lg:h-64 object-cover rounded-lg border-2 border-white shadow-lg hover:scale-105 transition-transform cursor-pointer"
                          onClick={() => window.open(selectedSurvey.fotoTitikActual, '_blank')}
                        />
                      </div>
                    )}
                    {selectedSurvey.fotoKemerataan && (
                      <div className="space-y-2">
                        <p className="text-xs lg:text-sm font-semibold text-gray-700">Foto Kemerataan</p>
                        <img 
                          src={selectedSurvey.fotoKemerataan} 
                          alt="Kemerataan" 
                          className="w-full h-48 lg:h-64 object-cover rounded-lg border-2 border-white shadow-lg hover:scale-105 transition-transform cursor-pointer"
                          onClick={() => window.open(selectedSurvey.fotoKemerataan, '_blank')}
                        />
                      </div>
                    )}
                    {selectedSurvey.photoUrl && !selectedSurvey.fotoTiangAPM && (
                      <div className="space-y-2">
                        <p className="text-xs lg:text-sm font-semibold text-gray-700">Foto Survey</p>
                        <img 
                          src={selectedSurvey.photoUrl} 
                          alt="Survey" 
                          className="w-full h-48 lg:h-64 object-cover rounded-lg border-2 border-white shadow-lg hover:scale-105 transition-transform cursor-pointer"
                          onClick={() => window.open(selectedSurvey.photoUrl, '_blank')}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Survey Information */}
              <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-gray-200">
                <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-3 lg:mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 lg:w-6 lg:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Informasi Survey
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                  {/* 1. Surveyor Info - Always first */}
                  <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">Surveyor</p>
                    <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.surveyorName}</p>
                    {selectedSurvey.surveyorEmail && (
                      <p className="text-xs text-gray-500 mt-1">{selectedSurvey.surveyorEmail}</p>
                    )}
                  </div>

                  {/* 2. Nama Jalan */}
                  {selectedSurvey.namaJalan && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Nama Jalan</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.namaJalan}</p>
                    </div>
                  )}

                  {/* For Survey Existing - show after Nama Jalan */}
                  {selectedSurvey.lokasiJalan && selectedSurvey.type === "existing" && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Lokasi Jalan</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.lokasiJalan}</p>
                    </div>
                  )}

                  {selectedSurvey.namaGang && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Nama Gang</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.namaGang}</p>
                    </div>
                  )}

                  {/* 3. Status ID Titik - For APJ Propose */}
                  {selectedSurvey.statusIDTitik && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Status ID Titik</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.statusIDTitik}</p>
                    </div>
                  )}

                  {/* 4. ID Titik (if ada) */}
                  {selectedSurvey.idTitik && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">ID Titik</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.idTitik}</p>
                    </div>
                  )}

                  {/* 5. Daya Lampu */}
                  {selectedSurvey.dayaLampu && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Daya Lampu</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.dayaLampu}</p>
                    </div>
                  )}

                  {/* 6. Data Tiang */}
                  {selectedSurvey.dataTiang && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Data Tiang</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.dataTiang}</p>
                    </div>
                  )}

                  {/* For Survey Existing - Kepemilikan/Keterangan Tiang */}
                  {(selectedSurvey.keteranganTiang || selectedSurvey.kepemilikan) && selectedSurvey.type === "existing" && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Kepemilikan Tiang</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">
                        {selectedSurvey.keteranganTiang || selectedSurvey.kepemilikan}
                      </p>
                    </div>
                  )}

                  {/* 7. Data Ruas */}
                  {selectedSurvey.dataRuas && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Data Ruas</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.dataRuas}</p>
                    </div>
                  )}

                  {/* 8. Sub Ruas */}
                  {selectedSurvey.subRuas && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Sub Ruas</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.subRuas}</p>
                    </div>
                  )}

                  {/* 9. Median */}
                  {selectedSurvey.median && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Median</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">
                        {selectedSurvey.median}
                        {selectedSurvey.tinggiMedian && selectedSurvey.lebarMedian && 
                          ` (T: ${selectedSurvey.tinggiMedian}m, L: ${selectedSurvey.lebarMedian}m)`
                        }
                      </p>
                    </div>
                  )}

                  {/* Survey Existing - Median Display */}
                  {selectedSurvey.medianDisplay && selectedSurvey.type === "existing" && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Median Jalan</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.medianDisplay}</p>
                    </div>
                  )}

                  {/* 10. Lebar Jalan */}
                  {selectedSurvey.lebarJalan && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Lebar Jalan</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.lebarJalan}m</p>
                    </div>
                  )}

                  {/* Survey Existing - Lebar Jalan Display */}
                  {selectedSurvey.lebarJalanDisplay && selectedSurvey.type === "existing" && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Lebar Jalan</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.lebarJalanDisplay}</p>
                    </div>
                  )}

                  {/* 11. Jarak Antar Tiang */}
                  {selectedSurvey.jarakAntarTiang && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Jarak Antar Tiang</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.jarakAntarTiang}m</p>
                    </div>
                  )}

                  {/* 12. Lebar Bahu Bertiang */}
                  {selectedSurvey.lebarBahuBertiang && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Lebar Bahu Bertiang</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.lebarBahuBertiang}m</p>
                    </div>
                  )}

                  {/* 13. Lebar Trotoar Bertiang */}
                  {selectedSurvey.lebarTrotoarBertiang && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Lebar Trotoar Bertiang</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.lebarTrotoarBertiang}m</p>
                    </div>
                  )}

                  {/* Survey Existing - Lebar Trotoar */}
                  {selectedSurvey.lebarTrotoar && selectedSurvey.type === "existing" && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Lebar Trotoar</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.lebarTrotoar}</p>
                    </div>
                  )}

                  {/* 14. Lainnya Bertiang (if exists) */}
                  {selectedSurvey.lainnyaBertiang && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Lainnya Bertiang</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.lainnyaBertiang}m</p>
                    </div>
                  )}

                  {/* Survey Existing specific fields */}
                  {selectedSurvey.jenisExisting && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Jenis Existing</p>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          selectedSurvey.jenisExisting === "Murni" 
                            ? "bg-purple-600 text-white" 
                            : "bg-orange-600 text-white"
                        }`}>
                          {selectedSurvey.jenisExisting}
                        </span>
                      </div>
                    </div>
                  )}

                  {(selectedSurvey.jenisTitik || selectedSurvey.jenis) && selectedSurvey.type === "existing" && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Jenis Titik</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">
                        {selectedSurvey.jenisTitik || selectedSurvey.jenis}
                      </p>
                    </div>
                  )}

                  {selectedSurvey.palet && selectedSurvey.palet !== "N/A" && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Palet/Trafo</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.palet}</p>
                    </div>
                  )}

                  {selectedSurvey.lumina && selectedSurvey.lumina !== "N/A" && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Lumina/Lampu</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.lumina}</p>
                    </div>
                  )}

                  {(selectedSurvey.tinggiARM || selectedSurvey.tinggiArm) && selectedSurvey.tinggiARM !== "N/A" && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Tinggi ARM</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">
                        {selectedSurvey.tinggiARM || selectedSurvey.tinggiArm}
                      </p>
                    </div>
                  )}

                  {selectedSurvey.tinggiAPM && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Tinggi APM</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.tinggiAPM}</p>
                    </div>
                  )}

                  {selectedSurvey.metodeUkur && (
                    <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Metode Ukur</p>
                      <p className="font-semibold text-sm lg:text-base text-gray-900">{selectedSurvey.metodeUkur}</p>
                    </div>
                  )}
                </div>

                {/* Additional Notes */}
                {selectedSurvey.keterangan && (
                  <div className="mt-3 lg:mt-4 bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-600 mb-2">Keterangan Tambahan</p>
                    <p className="text-sm lg:text-base text-gray-900 whitespace-pre-wrap">{selectedSurvey.keterangan}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 lg:p-6 rounded-b-2xl lg:rounded-b-3xl">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 lg:gap-3">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 lg:px-6 py-2.5 lg:py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg lg:rounded-xl transition-all text-sm lg:text-base"
                >
                  Tutup
                </button>
                {selectedSurvey.status === "menunggu" && (
                  <>
                    <button 
                      onClick={() => handleTolak(selectedSurvey)}
                      className="px-4 lg:px-6 py-2.5 lg:py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg lg:rounded-xl transition-all flex items-center justify-center gap-2 text-sm lg:text-base"
                    >
                      <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Tolak
                    </button>
                    <button 
                      onClick={() => handleValidasi(selectedSurvey)}
                      className="px-4 lg:px-6 py-2.5 lg:py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg lg:rounded-xl transition-all flex items-center justify-center gap-2 text-sm lg:text-base"
                    >
                      <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Validasi
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editFormData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 lg:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl lg:rounded-3xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-y-auto my-4">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 lg:p-6 rounded-t-2xl lg:rounded-t-3xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 lg:w-14 lg:h-14 bg-white/20 backdrop-blur rounded-xl lg:rounded-2xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 lg:w-8 lg:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg lg:text-2xl font-bold mb-1">Edit Survey</h2>
                    <p className="text-sm text-white/90">{editFormData.title}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-all flex-shrink-0"
                  title="Tutup"
                >
                  <svg className="w-5 h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
              {/* Info Surveyor (Read Only) */}
              <div className="bg-gradient-to-br from-gray-50 to-slate-100 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-gray-300">
                <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 lg:w-6 lg:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Informasi Surveyor
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                  <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">Nama Surveyor</p>
                    <p className="font-semibold text-sm lg:text-base text-gray-900">{editFormData.surveyorName}</p>
                  </div>
                  <div className="bg-white p-3 lg:p-4 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1">Status Survey</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      editFormData.status === "menunggu" 
                        ? "bg-yellow-100 text-yellow-700"
                        : editFormData.status === "tervalidasi"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {editFormData.status.charAt(0).toUpperCase() + editFormData.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Informasi Lokasi */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-blue-200">
                <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Informasi Lokasi
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Lokasi Jalan</label>
                    <input
                      type="text"
                      value={editFormData.lokasiJalan || ''}
                      onChange={(e) => setEditFormData({...editFormData, lokasiJalan: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Contoh: Jl. Raya"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Nama Jalan</label>
                    <input
                      type="text"
                      value={editFormData.namaJalan || ''}
                      onChange={(e) => setEditFormData({...editFormData, namaJalan: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Nama jalan"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Nama Gang</label>
                    <input
                      type="text"
                      value={editFormData.namaGang || ''}
                      onChange={(e) => setEditFormData({...editFormData, namaGang: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Nama gang (opsional)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Jenis Existing</label>
                    <select
                      value={editFormData.jenisExisting || ''}
                      onChange={(e) => setEditFormData({...editFormData, jenisExisting: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                    >
                      <option value="">Pilih Jenis</option>
                      <option value="Murni">Murni</option>
                      <option value="Tidak Murni">Tidak Murni</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Koordinat GPS</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.0000001"
                        value={editFormData.latitude || ''}
                        onChange={(e) => setEditFormData({...editFormData, latitude: parseFloat(e.target.value)})}
                        className="w-1/2 px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                        placeholder="Latitude"
                      />
                      <input
                        type="number"
                        step="0.0000001"
                        value={editFormData.longitude || ''}
                        onChange={(e) => setEditFormData({...editFormData, longitude: parseFloat(e.target.value)})}
                        className="w-1/2 px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                        placeholder="Longitude"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Informasi Tiang */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-green-200">
                <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 lg:w-6 lg:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Informasi Tiang & Teknis
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Kepemilikan Tiang</label>
                    <select
                      value={editFormData.keteranganTiang || editFormData.kepemilikan || ''}
                      onChange={(e) => setEditFormData({...editFormData, keteranganTiang: e.target.value, kepemilikan: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                    >
                      <option value="">Pilih kepemilikan</option>
                      <option value="PLN - Tiang TR">PLN - Tiang TR</option>
                      <option value="PLN - Tiang TM">PLN - Tiang TM</option>
                      <option value="PEMDA">PEMDA</option>
                      <option value="Swasta">Swasta</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Jenis Titik</label>
                    <select
                      value={editFormData.jenisTitik || editFormData.jenis || ''}
                      onChange={(e) => setEditFormData({...editFormData, jenisTitik: e.target.value, jenis: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                    >
                      <option value="">Pilih jenis titik</option>
                      <option value="Besi">Besi</option>
                      <option value="Beton">Beton</option>
                      <option value="Kayu">Kayu</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Palet/Trafo</label>
                    <input
                      type="text"
                      value={editFormData.palet || ''}
                      onChange={(e) => setEditFormData({...editFormData, palet: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Palet/Trafo"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Lumina/Lampu</label>
                    <input
                      type="text"
                      value={editFormData.lumina || ''}
                      onChange={(e) => setEditFormData({...editFormData, lumina: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Lumina/Lampu"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Tinggi APM</label>
                    <input
                      type="text"
                      value={editFormData.tinggiAPM || ''}
                      onChange={(e) => setEditFormData({...editFormData, tinggiAPM: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Tinggi APM"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Tinggi ARM</label>
                    <input
                      type="text"
                      value={editFormData.tinggiARM || editFormData.tinggiArm || ''}
                      onChange={(e) => setEditFormData({...editFormData, tinggiARM: e.target.value, tinggiArm: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Tinggi ARM"
                    />
                  </div>
                </div>
              </div>

              {/* Informasi Jalan */}
              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-yellow-200">
                <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 lg:w-6 lg:h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Dimensi Jalan
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Lebar Jalan 1</label>
                    <input
                      type="text"
                      value={editFormData.lebarJalan1 || ''}
                      onChange={(e) => setEditFormData({...editFormData, lebarJalan1: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Lebar jalan 1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Lebar Jalan 2</label>
                    <input
                      type="text"
                      value={editFormData.lebarJalan2 || ''}
                      onChange={(e) => setEditFormData({...editFormData, lebarJalan2: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Lebar jalan 2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Lebar Trotoar</label>
                    <input
                      type="text"
                      value={editFormData.lebarTrotoar || ''}
                      onChange={(e) => setEditFormData({...editFormData, lebarTrotoar: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Lebar trotoar"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Tinggi Median</label>
                    <input
                      type="text"
                      value={editFormData.tinggiMedian || ''}
                      onChange={(e) => setEditFormData({...editFormData, tinggiMedian: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Tinggi median"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Lebar Median</label>
                    <input
                      type="text"
                      value={editFormData.lebarMedian || ''}
                      onChange={(e) => setEditFormData({...editFormData, lebarMedian: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Lebar median"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Metode Ukur</label>
                    <input
                      type="text"
                      value={editFormData.metodeUkur || ''}
                      onChange={(e) => setEditFormData({...editFormData, metodeUkur: e.target.value})}
                      className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900"
                      placeholder="Metode ukur"
                    />
                  </div>
                </div>
              </div>

              {/* Keterangan Tambahan */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-purple-200">
                <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 lg:w-6 lg:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  Keterangan Tambahan
                </h3>
                <textarea
                  value={editFormData.keterangan || ''}
                  onChange={(e) => setEditFormData({...editFormData, keterangan: e.target.value})}
                  rows={4}
                  className="w-full px-3 lg:px-4 py-2 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base text-gray-900 resize-none"
                  placeholder="Tambahkan catatan atau keterangan tambahan..."
                />
              </div>

              {/* URL Foto (Read Only) */}
              {(editFormData.fotoTiangAPM || editFormData.fotoTitikActual) && (
                <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-gray-200">
                  <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 lg:w-6 lg:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Foto Survey (Tidak bisa diedit)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {editFormData.fotoTiangAPM && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">Foto Tiang APM</p>
                        <img 
                          src={editFormData.fotoTiangAPM} 
                          alt="Tiang APM" 
                          className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
                        />
                      </div>
                    )}
                    {editFormData.fotoTitikActual && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">Foto Titik Actual</p>
                        <img 
                          src={editFormData.fotoTitikActual} 
                          alt="Titik Actual" 
                          className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 lg:p-6 rounded-b-2xl lg:rounded-b-3xl">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 lg:gap-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  disabled={isSaving}
                  className="px-4 lg:px-6 py-2.5 lg:py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg lg:rounded-xl transition-all text-sm lg:text-base disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="px-4 lg:px-6 py-2.5 lg:py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg lg:rounded-xl transition-all flex items-center justify-center gap-2 text-sm lg:text-base disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Simpan Perubahan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
