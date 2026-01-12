"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Survey {
  id: string;
  title: string;
  type: string;
  status: string;
  surveyorName: string;
  createdAt: any;
  validatedAt: any;
  validatedBy: string;
  latitude: number;
  longitude: number;
  kepemilikan: string;
  jenis: string;
  tinggiArm: string;
  kategori: string;
  zona: string;
  photoUrl?: string;
}

interface SurveyExistingDetailProps {
  onBack: () => void;
  statusFilter?: string;
}

export default function SurveyExistingDetail({ onBack, statusFilter = "tervalidasi" }: SurveyExistingDetailProps) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSurveys();
  }, []);

  const fetchSurveys = async () => {
    try {
      setLoading(true);
      const surveysRef = collection(db, "survey-existing");
      
      // Query untuk Survey Existing berdasarkan statusFilter
      const q = query(surveysRef, where("status", "==", statusFilter));
      
      const snapshot = await getDocs(q);
      
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        title: doc.data().title || "Untitled",
        type: "existing",
        status: doc.data().status || "tervalidasi",
        surveyorName: doc.data().surveyorName || "Unknown",
        createdAt: doc.data().createdAt,
        validatedAt: doc.data().validatedAt || doc.data().createdAt,
        validatedBy: doc.data().validatedBy || doc.data().editedBy || "Admin",
        latitude: doc.data().latitude || 0,
        longitude: doc.data().longitude || 0,
        kepemilikan: doc.data().kepemilikan || "N/A",
        jenis: doc.data().jenis || "N/A",
        tinggiArm: doc.data().tinggiArm || "N/A",
        kategori: doc.data().kategori || "Survey Existing",
        zona: doc.data().zona || "Existing",
        photoUrl: doc.data().photoUrl,
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
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      return "N/A";
    }
  };

  const handleExportExcel = () => {
    console.log("Exporting Survey Existing to Excel...");
    // Implement Excel export logic
  };

  const handleViewMaps = (latitude: number, longitude: number) => {
    window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, '_blank');
  };

  const handleDelete = (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus data ini?")) {
      console.log("Deleting survey:", id);
      // Implement delete logic
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-all flex-shrink-0"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Survey Existing</h1>
              <p className="text-sm text-gray-600 mt-1">Data Survey Existing yang telah tervalidasi</p>
            </div>
          </div>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Ekspor Excel
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="text-sm text-gray-700">
        Menampilkan <span className="font-semibold">{surveys.length}</span> data survey tervalidasi
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">Memuat data survey...</p>
          </div>
        ) : surveys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-4xl">📁</span>
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Data</h4>
            <p className="text-sm text-gray-600 text-center max-w-md">
              Belum ada data Survey Existing yang telah tervalidasi.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Judul Proyek
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Lokasi
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Surveyor
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Kategori
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Zona
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Foto
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Divalidasi Oleh
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Tanggal Validasi
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {surveys.map((survey) => (
                  <tr key={survey.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{survey.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {survey.latitude.toFixed(7)}, {survey.longitude.toFixed(7)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{survey.surveyorName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                        Survey Existing
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                        {survey.zona}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {survey.photoUrl ? (
                        <img 
                          src={survey.photoUrl} 
                          alt="Survey" 
                          className="w-12 h-12 object-cover rounded-lg cursor-pointer hover:scale-110 transition-transform"
                          onClick={() => window.open(survey.photoUrl, '_blank')}
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                          <span className="text-xs text-gray-500">No Foto</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        oleh <span className="font-medium">{survey.validatedBy}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{formatDate(survey.validatedAt)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                        Tervalidasi
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewMaps(survey.latitude, survey.longitude)}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                          title="Lihat Maps"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                        <button
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                          title="Lihat Detail"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(survey.id)}
                          className="text-red-600 hover:text-red-800 transition-colors"
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
    </div>
  );
}
