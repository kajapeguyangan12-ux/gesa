"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import dynamic from "next/dynamic";

// Dynamic import for Map component
const DynamicDetailMap = dynamic(
  () => import("./SurveyDetailMap"),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-64 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Memuat peta...</p>
        </div>
      </div>
    )
  }
);

interface Survey {
  id: string;
  title: string;
  namaJalan?: string;
  type: string;
  status: string;
  surveyorName: string;
  surveyorEmail?: string;
  createdAt: any;
  validatedAt: any;
  validatedBy: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  kepemilikan?: string;
  jenis?: string;
  tinggiArm?: string;
  kategori?: string;
  zona?: string;
  photoUrl?: string;
  fotoTiangAPM?: string;
  fotoTitikActual?: string;
  fotoKemerataan?: string;
  // Additional APJ Propose fields
  statusIDTitik?: string;
  idTitik?: string;
  dayaLampu?: string;
  dataTiang?: string;
  dataRuas?: string;
  subRuas?: string;
  median?: string;
  lebarJalan?: string;
  jarakAntarTiang?: string;
  keterangan?: string;
}

interface SurveyProposeDetailProps {
  onBack: () => void;
  statusFilter?: string;
}

export default function SurveyProposeDetail({ onBack, statusFilter = "tervalidasi" }: SurveyProposeDetailProps) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterZona, setFilterZona] = useState<string>("all");

  useEffect(() => {
    fetchSurveys();
  }, [statusFilter]);

  const fetchSurveys = async () => {
    try {
      setLoading(true);
      const surveysRef = collection(db, "survey-apj-propose");
      const q = query(surveysRef, where("status", "==", statusFilter));
      const snapshot = await getDocs(q);
      
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        title: doc.data().title || `Survey APJ Propose - ${doc.data().namaJalan || "Untitled"}`,
        namaJalan: doc.data().namaJalan,
        type: "propose",
        status: doc.data().status || statusFilter,
        surveyorName: doc.data().surveyorName || "Unknown",
        surveyorEmail: doc.data().surveyorEmail,
        createdAt: doc.data().createdAt,
        validatedAt: doc.data().validatedAt || doc.data().createdAt,
        validatedBy: doc.data().validatedBy || doc.data().editedBy || "Admin",
        latitude: doc.data().latitude || 0,
        longitude: doc.data().longitude || 0,
        accuracy: doc.data().accuracy,
        kepemilikan: doc.data().kepemilikan,
        jenis: doc.data().jenis || doc.data().jenisTitik,
        tinggiArm: doc.data().tinggiArm || doc.data().tinggiARM,
        kategori: doc.data().kategori || "Survey APJ Propose",
        zona: doc.data().zona || "N/A",
        photoUrl: doc.data().photoUrl,
        fotoTiangAPM: doc.data().fotoTiangAPM,
        fotoTitikActual: doc.data().fotoTitikActual,
        fotoKemerataan: doc.data().fotoKemerataan,
        statusIDTitik: doc.data().statusIDTitik,
        idTitik: doc.data().idTitik,
        dayaLampu: doc.data().dayaLampu,
        dataTiang: doc.data().dataTiang,
        dataRuas: doc.data().dataRuas,
        subRuas: doc.data().subRuas,
        median: doc.data().median,
        lebarJalan: doc.data().lebarJalan,
        jarakAntarTiang: doc.data().jarakAntarTiang,
        keterangan: doc.data().keterangan,
      })) as Survey[];
      
      setSurveys(data);
    } catch (error) {
      console.error("Error fetching surveys:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return "N/A";
    }
  };

  const handleExportExcel = () => {
    const headers = ["No", "Judul", "Nama Jalan", "Surveyor", "Zona", "Koordinat", "Status", "Divalidasi Oleh", "Tanggal"];
    const rows = filteredSurveys.map((s, i) => [
      i + 1,
      s.title,
      s.namaJalan || "-",
      s.surveyorName,
      s.zona || "-",
      `${s.latitude}, ${s.longitude}`,
      s.status,
      s.validatedBy,
      formatDate(s.validatedAt)
    ]);
    
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `survey-apj-propose-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleViewMaps = (latitude: number, longitude: number) => {
    window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, '_blank');
  };

  const handleViewDetail = (survey: Survey) => {
    setSelectedSurvey(survey);
    setShowDetailModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.")) return;
    
    try {
      await deleteDoc(doc(db, "survey-apj-propose", id));
      await fetchSurveys();
      alert("Data berhasil dihapus!");
    } catch (error) {
      console.error("Error deleting survey:", error);
      alert("Gagal menghapus data: " + error);
    }
  };

  const uniqueZones = [...new Set(surveys.map(s => s.zona).filter(Boolean))];

  const filteredSurveys = surveys.filter(survey => {
    const matchSearch = searchQuery === "" || 
      survey.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      survey.namaJalan?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      survey.surveyorName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchZona = filterZona === "all" || survey.zona === filterZona;
    
    return matchSearch && matchZona;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "tervalidasi":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "diverifikasi":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "ditolak":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl shadow-xl p-6 text-white">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2.5 bg-white/20 hover:bg-white/30 rounded-xl transition-all backdrop-blur-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">Survey Tiang APJ Propose</h1>
              <p className="text-green-100 text-sm mt-1">
                Data Survey Tiang APJ Propose yang telah {statusFilter === "tervalidasi" ? "tervalidasi" : statusFilter}
              </p>
            </div>
          </div>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-green-700 font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:bg-green-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Ekspor Excel
          </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Cari berdasarkan judul, nama jalan, atau surveyor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-gray-900 placeholder:text-gray-500"
            />
          </div>
          
          <select
            value={filterZona}
            onChange={(e) => setFilterZona(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white min-w-[150px]"
          >
            <option value="all">Semua Zona</option>
            {uniqueZones.map(zona => (
              <option key={zona} value={zona}>{zona}</option>
            ))}
          </select>
          
          <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 rounded-xl border border-green-100">
            <span className="text-green-700 font-medium">{filteredSurveys.length}</span>
            <span className="text-green-600 text-sm">dari {surveys.length} data</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600 font-medium">Memuat data survey...</p>
          </div>
        ) : filteredSurveys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h4 className="text-xl font-bold text-gray-900 mb-2">Belum Ada Data</h4>
            <p className="text-gray-500 text-center max-w-md">
              Belum ada data Survey Tiang APJ Propose yang sesuai dengan filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">No</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Judul Proyek</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Surveyor</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Zona</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Koordinat</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Foto</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Divalidasi</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSurveys.map((survey, index) => (
                  <tr key={survey.id} className="hover:bg-green-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="w-8 h-8 flex items-center justify-center bg-green-100 text-green-700 font-bold rounded-lg text-sm">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900">{survey.title}</span>
                        {survey.namaJalan && (
                          <span className="text-xs text-gray-500 mt-0.5">{survey.namaJalan}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm">
                          {survey.surveyorName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">{survey.surveyorName}</span>
                          {survey.surveyorEmail && (
                            <span className="text-xs text-gray-500">{survey.surveyorEmail}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 rounded-full border border-orange-200">
                        {survey.zona || "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded">
                        {survey.latitude.toFixed(6)}, {survey.longitude.toFixed(6)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {survey.photoUrl || survey.fotoTiangAPM || survey.fotoTitikActual ? (
                        <img 
                          src={survey.photoUrl || survey.fotoTiangAPM || survey.fotoTitikActual} 
                          alt="Survey" 
                          className="w-14 h-14 object-cover rounded-xl cursor-pointer hover:scale-110 transition-transform shadow-sm border-2 border-white"
                          onClick={() => window.open(survey.photoUrl || survey.fotoTiangAPM || survey.fotoTitikActual, '_blank')}
                        />
                      ) : (
                        <div className="w-14 h-14 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">{survey.validatedBy}</span>
                        <span className="text-xs text-gray-500">{formatDate(survey.validatedAt)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1.5 text-xs font-semibold rounded-full border capitalize ${getStatusBadge(survey.status)}`}>
                        {survey.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleViewMaps(survey.latitude, survey.longitude)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                          title="Lihat di Google Maps"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleViewDetail(survey)}
                          className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-all"
                          title="Lihat Detail"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(survey.id)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-all"
                          title="Hapus"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedSurvey && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDetailModal(false)} />
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="relative bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 z-10 bg-gradient-to-r from-green-600 to-emerald-700 text-white p-6 rounded-t-3xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Detail Survey APJ Propose</h2>
                    <p className="text-green-100 text-sm mt-1">{selectedSurvey.title}</p>
                  </div>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Status Badge */}
                <div className="flex items-center gap-3">
                  <span className={`px-4 py-2 text-sm font-bold rounded-full border-2 capitalize ${getStatusBadge(selectedSurvey.status)}`}>
                    {selectedSurvey.status}
                  </span>
                  <span className="text-gray-500 text-sm">
                    Divalidasi oleh <span className="font-medium text-gray-700">{selectedSurvey.validatedBy}</span> pada {formatDate(selectedSurvey.validatedAt)}
                  </span>
                </div>

                {/* Map Section */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    Lokasi Survey
                  </h3>
                  <DynamicDetailMap
                    latitude={selectedSurvey.latitude}
                    longitude={selectedSurvey.longitude}
                    accuracy={selectedSurvey.accuracy}
                    title={selectedSurvey.title}
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-gray-600 font-mono bg-white px-3 py-1.5 rounded-lg border">
                      {selectedSurvey.latitude.toFixed(7)}, {selectedSurvey.longitude.toFixed(7)}
                    </span>
                    <button
                      onClick={() => handleViewMaps(selectedSurvey.latitude, selectedSurvey.longitude)}
                      className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700 font-medium"
                    >
                      <span>Buka di Google Maps</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Surveyor Info */}
                  <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                    <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Informasi Surveyor
                    </h3>
                    <div className="space-y-3">
                      <InfoRow label="Nama Surveyor" value={selectedSurvey.surveyorName} />
                      <InfoRow label="Email" value={selectedSurvey.surveyorEmail || "N/A"} />
                      <InfoRow label="Tanggal Survey" value={formatDate(selectedSurvey.createdAt)} />
                    </div>
                  </div>

                  {/* Survey Details */}
                  <div className="bg-green-50 rounded-2xl p-5 border border-green-100">
                    <h3 className="text-lg font-bold text-green-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Detail Survey
                    </h3>
                    <div className="space-y-3">
                      <InfoRow label="Nama Jalan" value={selectedSurvey.namaJalan || "N/A"} />
                      <InfoRow label="Zona" value={selectedSurvey.zona || "N/A"} />
                      <InfoRow label="Kategori" value={selectedSurvey.kategori || "N/A"} />
                      <InfoRow label="Kepemilikan" value={selectedSurvey.kepemilikan || "N/A"} />
                    </div>
                  </div>
                </div>

                {/* Technical Data */}
                <div className="bg-purple-50 rounded-2xl p-5 border border-purple-100">
                  <h3 className="text-lg font-bold text-purple-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Data Teknis
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <InfoCard label="Status ID Titik" value={selectedSurvey.statusIDTitik} />
                    <InfoCard label="ID Titik" value={selectedSurvey.idTitik} />
                    <InfoCard label="Daya Lampu" value={selectedSurvey.dayaLampu} />
                    <InfoCard label="Data Tiang" value={selectedSurvey.dataTiang} />
                    <InfoCard label="Data Ruas" value={selectedSurvey.dataRuas} />
                    <InfoCard label="Sub Ruas" value={selectedSurvey.subRuas} />
                    <InfoCard label="Median" value={selectedSurvey.median} />
                    <InfoCard label="Lebar Jalan" value={selectedSurvey.lebarJalan} />
                    <InfoCard label="Jarak Antar Tiang" value={selectedSurvey.jarakAntarTiang} />
                    <InfoCard label="Tinggi ARM" value={selectedSurvey.tinggiArm} />
                    <InfoCard label="Jenis" value={selectedSurvey.jenis} />
                    <InfoCard label="Akurasi GPS" value={selectedSurvey.accuracy ? `${selectedSurvey.accuracy.toFixed(2)}m` : null} />
                  </div>
                </div>

                {/* Keterangan */}
                {selectedSurvey.keterangan && (
                  <div className="bg-yellow-50 rounded-2xl p-5 border border-yellow-100">
                    <h3 className="text-lg font-bold text-yellow-900 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      Keterangan
                    </h3>
                    <p className="text-gray-700 bg-white rounded-xl p-4 border border-yellow-200">{selectedSurvey.keterangan}</p>
                  </div>
                )}

                {/* Photos Grid */}
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Dokumentasi Foto
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <PhotoCard label="Foto Utama" url={selectedSurvey.photoUrl} />
                    <PhotoCard label="Foto Tiang APM" url={selectedSurvey.fotoTiangAPM} />
                    <PhotoCard label="Foto Titik Actual" url={selectedSurvey.fotoTitikActual} />
                    <PhotoCard label="Foto Kemerataan" url={selectedSurvey.fotoKemerataan} />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 rounded-b-3xl flex justify-end gap-3">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
                >
                  Tutup
                </button>
                <button
                  onClick={() => handleViewMaps(selectedSurvey.latitude, selectedSurvey.longitude)}
                  className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  Buka di Maps
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Components
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="bg-white rounded-xl p-3 border border-purple-100">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value || "N/A"}</p>
    </div>
  );
}

function PhotoCard({ label, url }: { label: string; url?: string }) {
  return (
    <div className="group">
      <p className="text-xs text-gray-500 mb-2 font-medium">{label}</p>
      {url ? (
        <div 
          className="relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-green-400 transition-all"
          onClick={() => window.open(url, '_blank')}
        >
          <img src={url} alt={label} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </div>
        </div>
      ) : (
        <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex flex-col items-center justify-center">
          <svg className="w-8 h-8 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs text-gray-400">Tidak ada</span>
        </div>
      )}
    </div>
  );
}
