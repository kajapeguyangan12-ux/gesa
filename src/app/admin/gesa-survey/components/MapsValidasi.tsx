"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import dynamic from "next/dynamic";
import { fetchWithCache } from "@/utils/firestoreCache";
import { useAuth } from "@/hooks/useAuth";
import { PRA_EXISTING_TABANAN_DATA } from "@/app/survey-pra-existing/location-data";

// Import Map component dynamically to avoid SSR issues
const MapsValidasiMap = dynamic(
  () => import("./MapsValidasiMap"),
  { 
    ssr: false,
    loading: () => (
      <div className="h-full flex flex-col items-center justify-center bg-gray-50">
        <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600">Menyiapkan peta...</p>
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
  validatedBy: string;
  latitude: number;
  longitude: number;
  adminLatitude?: number;
  adminLongitude?: number;
  createdAt: TimestampLike;
  validatedAt: TimestampLike;
  // Data sesuai modal
  namaJalan: string;
  zona: string;
  kategori: string;
  statusIdTitik: string;
  idTitik: string;
  dayaLampu: string;
  dataTiang: string;
  dataRuas: string;
  subRuas: string;
  jarakAntarTiang: string;
  keterangan: string;
  kabupaten?: string;
  kecamatan?: string;
  desa?: string;
  banjar?: string;
  kepemilikanDisplay?: string;
  tipeTiangPLN?: string;
  jenisLampu?: string;
  jumlahLampu?: string;
  fungsiLampu?: string;
  garduStatus?: string;
  kodeGardu?: string;
  finalLatitude?: number;
  finalLongitude?: number;
}

type TimestampLike =
  | { toDate?: () => Date; seconds?: number }
  | Date
  | string
  | number
  | null
  | undefined;

interface DashboardSummaryDocument {
  propose?: { totalDiverifikasi?: number; totalTervalidasi?: number };
  existing?: { totalDiverifikasi?: number; totalTervalidasi?: number };
  praExisting?: { totalDiverifikasi?: number; totalTervalidasi?: number };
}

export default function MapsValidasi({ activeKabupaten }: { activeKabupaten?: string | null }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super-admin";
  const targetStatus = isSuperAdmin ? "tervalidasi" : "diverifikasi";
  const pageTitle = isSuperAdmin ? "Maps Valid" : "Maps Terverifikasi";
  const pageDescription = isSuperAdmin
    ? "Visualisasi bersama titik koordinat survey yang telah divalidasi dalam peta interaktif"
    : "Visualisasi bersama titik koordinat survey yang telah diverifikasi dalam peta interaktif";
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedKecamatan, setSelectedKecamatan] = useState("Semua Kecamatan");
  const [overviewLoaded, setOverviewLoaded] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    visible: 0,
    existing: 0,
    propose: 0,
    praExisting: 0,
  });

  const kecamatanOptions = activeKabupaten === "tabanan"
    ? ["Semua Kecamatan", ...Object.keys(PRA_EXISTING_TABANAN_DATA).sort()]
    : ["Semua Kecamatan"];

  const hydrateStatsFromSummary = useCallback(async () => {
    try {
      const summaryDocId = `gesa-survey_${activeKabupaten || "all"}_super`;
      const summary = await fetchWithCache<DashboardSummaryDocument | null>(
        `dashboard_summary_${summaryDocId}`,
        async () => {
          const snapshot = await getDoc(doc(db, "dashboard-summaries", summaryDocId));
          return snapshot.exists() ? (snapshot.data() as DashboardSummaryDocument) : null;
        },
        10 * 60_000
      );

      if (!summary) return;

      const summaryKey = isSuperAdmin ? "totalTervalidasi" : "totalDiverifikasi";
      const existing = summary.existing?.[summaryKey] || 0;
      const propose = summary.propose?.[summaryKey] || 0;
      const praExisting = summary.praExisting?.[summaryKey] || 0;

      setStats((current) => ({
        ...current,
        total: existing + propose + praExisting,
        existing,
        propose,
        praExisting,
      }));
      setOverviewLoaded(true);
    } catch (error) {
      console.error("Error hydrating map overview from summary:", error);
    }
  }, [activeKabupaten, isSuperAdmin]);

  const fetchSurveys = useCallback(async (filterKecamatan?: string) => {
    try {
      setLoading(true);
      
      // Fetch dari survey-existing
      const existingRef = collection(db, "survey-existing");
      const existingQuery = activeKabupaten
        ? query(existingRef, where("kabupaten", "==", activeKabupaten), where("status", "==", targetStatus))
        : query(existingRef, where("status", "==", targetStatus));
      const existingSnapshot = await getDocs(existingQuery);
      
      // Fetch dari survey-apj-propose
      const proposeRef = collection(db, "survey-apj-propose");
      const proposeQuery = activeKabupaten
        ? query(proposeRef, where("kabupaten", "==", activeKabupaten), where("status", "==", targetStatus))
        : query(proposeRef, where("status", "==", targetStatus));
      const proposeSnapshot = await getDocs(proposeQuery);
      
      // Fetch dari survey-pra-existing
      const praExistingRef = collection(db, "survey-pra-existing");
      const praExistingQuery = activeKabupaten
        ? query(praExistingRef, where("kabupaten", "==", activeKabupaten), where("status", "==", targetStatus))
        : query(praExistingRef, where("status", "==", targetStatus));
      const praExistingSnapshot = await getDocs(praExistingQuery);

      // Combine data dari collection
      const existingData = existingSnapshot.docs.map((doc) => {
        const surveyData = doc.data();
        const resolvedLatitude = surveyData.finalLatitude || surveyData.adminLatitude || surveyData.latitude || 0;
        const resolvedLongitude = surveyData.finalLongitude || surveyData.adminLongitude || surveyData.longitude || 0;
        return {
          id: doc.id,
          title: surveyData.namaTitikSurvey || surveyData.title || "Untitled",
          type: "existing",
          status: surveyData.status || targetStatus,
          surveyorName: surveyData.namaSurveyor || "-",
          validatedBy: surveyData.validatedBy || surveyData.editedBy || "Admin",
          latitude: resolvedLatitude,
          longitude: resolvedLongitude,
          adminLatitude: surveyData.adminLatitude,
          adminLongitude: surveyData.adminLongitude,
          createdAt: surveyData.createdAt,
          validatedAt: surveyData.validatedAt || surveyData.createdAt,
          namaJalan: surveyData.namaJalan || "-",
          zona: surveyData.zona || "Existing",
          kategori: "Survey Existing",
          statusIdTitik: surveyData.statusIdTitik || "-",
          idTitik: surveyData.idTitik || "N/A",
          dayaLampu: surveyData.dayaLampu || "-",
          dataTiang: surveyData.dataTiang || "-",
          dataRuas: surveyData.dataRuas || "-",
          subRuas: surveyData.subRuas || "-",
          jarakAntarTiang: surveyData.jarakAntarTiang || "-",
          keterangan: surveyData.keterangan || "N/A",
          finalLatitude: resolvedLatitude,
          finalLongitude: resolvedLongitude,
        };
      }) as Survey[];
      
      const proposeData = proposeSnapshot.docs.map((doc) => {
        const surveyData = doc.data();
        const resolvedLatitude = surveyData.finalLatitude || surveyData.adminLatitude || surveyData.latitude || 0;
        const resolvedLongitude = surveyData.finalLongitude || surveyData.adminLongitude || surveyData.longitude || 0;
        return {
          id: doc.id,
          title: surveyData.namaTitikSurvey || surveyData.title || "Untitled",
          type: "propose",
          status: surveyData.status || targetStatus,
          surveyorName: surveyData.namaSurveyor || "-",
          validatedBy: surveyData.validatedBy || surveyData.editedBy || "Admin",
          latitude: resolvedLatitude,
          longitude: resolvedLongitude,
          adminLatitude: surveyData.adminLatitude,
          adminLongitude: surveyData.adminLongitude,
          createdAt: surveyData.createdAt,
          validatedAt: surveyData.validatedAt || surveyData.createdAt,
          namaJalan: surveyData.namaJalan || "-",
          zona: surveyData.zona || "Propose",
          kategori: "Survey APJ Propose",
          statusIdTitik: surveyData.statusIdTitik || "-",
          idTitik: surveyData.idTitik || "N/A",
          dayaLampu: surveyData.dayaLampu || "-",
          dataTiang: surveyData.dataTiang || "-",
          dataRuas: surveyData.dataRuas || "-",
          subRuas: surveyData.subRuas || "-",
          jarakAntarTiang: surveyData.jarakAntarTiang || "-",
          keterangan: surveyData.keterangan || "N/A",
          finalLatitude: resolvedLatitude,
          finalLongitude: resolvedLongitude,
        };
      }) as Survey[];

      const praExistingData = praExistingSnapshot.docs.map((doc) => {
        const surveyData = doc.data();
        return {
          id: doc.id,
          title: surveyData.title || `Survey Pra Existing - ${surveyData.jenisLampu || "Untitled"}`,
          type: "pra-existing",
          status: surveyData.status || targetStatus,
          surveyorName: surveyData.surveyorName || "-",
          validatedBy: surveyData.validatedBy || surveyData.editedBy || "Admin",
          latitude: surveyData.finalLatitude || surveyData.adminLatitude || surveyData.latitude || 0,
          longitude: surveyData.finalLongitude || surveyData.adminLongitude || surveyData.longitude || 0,
          createdAt: surveyData.createdAt,
          validatedAt: surveyData.validatedAt || surveyData.createdAt,
          namaJalan: surveyData.lokasiLengkap || surveyData.title || "-",
          zona: "Pra Existing",
          kategori: "Survey Pra Existing",
          statusIdTitik: "-",
          idTitik: "N/A",
          dayaLampu: surveyData.dayaLampu || "-",
          dataTiang: surveyData.jenisTiang || "-",
          dataRuas: "-",
          subRuas: "-",
          jarakAntarTiang: "-",
          keterangan: surveyData.keterangan || surveyData.kondisi || "N/A",
          kabupaten: surveyData.kabupatenName || surveyData.kabupaten || "-",
          kecamatan: surveyData.kecamatan || "-",
          desa: surveyData.desa || "-",
          banjar: surveyData.banjar || "-",
          kepemilikanDisplay: surveyData.kepemilikanDisplay || surveyData.keteranganTiang || surveyData.kepemilikanTiang || "-",
          tipeTiangPLN: surveyData.tipeTiangPLN || "-",
          jenisLampu: surveyData.jenisLampu || "-",
          jumlahLampu: surveyData.jumlahLampu || "-",
          fungsiLampu: surveyData.fungsiLampu || "-",
          garduStatus: surveyData.garduStatus || "-",
          kodeGardu: surveyData.kodeGardu || "-",
          finalLatitude: surveyData.finalLatitude || surveyData.adminLatitude || surveyData.latitude || 0,
          finalLongitude: surveyData.finalLongitude || surveyData.adminLongitude || surveyData.longitude || 0,
        };
      }) as Survey[];
      
      const allSurveys = [...existingData, ...proposeData, ...praExistingData];
      const normalizedKecamatan = filterKecamatan && filterKecamatan !== "Semua Kecamatan" ? filterKecamatan : "";
      const filteredSurveys = normalizedKecamatan
        ? allSurveys.filter((survey) => survey.kecamatan === normalizedKecamatan)
        : allSurveys;

      setSurveys(filteredSurveys);
      setStats({
        total: allSurveys.length,
        visible: filteredSurveys.length,
        existing: filteredSurveys.filter((survey) => survey.type === "existing").length,
        propose: filteredSurveys.filter((survey) => survey.type === "propose").length,
        praExisting: filteredSurveys.filter((survey) => survey.type === "pra-existing").length,
      });
      setMapLoaded(true);
    } catch (error) {
      console.error("Error fetching surveys:", error);
    } finally {
      setLoading(false);
    }
  }, [activeKabupaten, targetStatus]);

  useEffect(() => {
    setSurveys([]);
    setMapLoaded(false);
    setOverviewLoaded(false);
    setSelectedKecamatan("Semua Kecamatan");
    setStats({
      total: 0,
      visible: 0,
      existing: 0,
      propose: 0,
      praExisting: 0,
    });
  }, [activeKabupaten, targetStatus]);

  useEffect(() => {
    void hydrateStatsFromSummary();
  }, [hydrateStatsFromSummary]);

  const handleResetView = () => {
    setSurveys([]);
    setMapLoaded(false);
    setSelectedKecamatan("Semua Kecamatan");
    setStats({
      total: 0,
      visible: 0,
      existing: 0,
      propose: 0,
      praExisting: 0,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{pageTitle}</h1>
              <p className="text-sm text-gray-600 mt-1">{pageDescription}</p>
            </div>
          </div>
          <button 
            onClick={handleResetView}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset View
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Kontrol Tampilan Map</h2>
            <p className="text-sm text-gray-600">Default map kosong. Tampilkan semua atau pilih kecamatan saat diperlukan.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <button
              onClick={() => void fetchSurveys()}
              disabled={loading}
              className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-semibold rounded-xl transition-colors"
            >
              Tampilkan Semua
            </button>
            <select
              value={selectedKecamatan}
              onChange={(event) => setSelectedKecamatan(event.target.value)}
              className="px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {kecamatanOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              onClick={() => void fetchSurveys(selectedKecamatan)}
              disabled={loading || selectedKecamatan === "Semua Kecamatan"}
              className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold rounded-xl transition-colors"
            >
              Tampilkan Kecamatan
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-md border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-600 font-medium">{isSuperAdmin ? "Total Survey Valid" : "Total Survey Terverifikasi"}</p>
              <h3 className="text-3xl font-bold text-gray-900">{overviewLoaded ? stats.total : "-"}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-md border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-600 font-medium">Data Tampil</p>
              <h3 className="text-3xl font-bold text-gray-900">{mapLoaded ? stats.visible : "-"}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-md border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-600 font-medium">Survey Existing</p>
              <h3 className="text-3xl font-bold text-gray-900">{overviewLoaded ? stats.existing : "-"}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-md border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-600 font-medium">Survey APJ Propose</p>
              <h3 className="text-3xl font-bold text-gray-900">{overviewLoaded ? stats.propose : "-"}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-md border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-600 font-medium">Survey Pra Existing</p>
              <h3 className="text-3xl font-bold text-gray-900">{overviewLoaded ? stats.praExisting : "-"}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Map Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{pageTitle}</h3>
                <p className="text-sm text-gray-600">
                  {mapLoaded
                    ? `Menampilkan ${stats.visible} titik koordinat survey ${isSuperAdmin ? "tervalidasi" : "terverifikasi"}`
                    : "Map belum dimuat. Pilih Tampilkan Semua atau filter kecamatan."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="relative" style={{ height: "600px" }}>
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
              <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">Memuat peta...</p>
            </div>
          ) : !mapLoaded ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
              <div className="w-16 h-16 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-2xl mb-4">M</div>
              <p className="text-gray-800 font-semibold mb-1">Map Belum Ditampilkan</p>
              <p className="text-gray-600 text-sm">Klik `Tampilkan Semua` atau pilih kecamatan terlebih dulu.</p>
            </div>
          ) : (
            <MapsValidasiMap surveys={surveys} />
          )}
        </div>

        {/* Map Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-600 text-center">
            <span className="font-medium">Total Titik:</span> {overviewLoaded ? stats.total : "-"} • 
            <span className="font-medium"> Tampil:</span> {mapLoaded ? stats.visible : "-"} • 
            <span className="font-medium"> Zoom:</span> Drag untuk menggeser, scroll untuk zoom • 
            <span className="font-medium"> Filter:</span> {!mapLoaded ? "Belum dipilih" : selectedKecamatan === "Semua Kecamatan" ? "Semua Collection" : selectedKecamatan}
          </p>
        </div>
      </div>
    </div>
  );
}

