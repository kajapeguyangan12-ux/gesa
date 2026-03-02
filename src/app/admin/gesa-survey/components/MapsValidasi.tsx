"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import dynamic from "next/dynamic";

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
  createdAt: any;
  validatedAt: any;
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
}

export default function MapsValidasi() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    visible: 0,
    existing: 0,
    propose: 0,
  });

  useEffect(() => {
    fetchSurveys();
  }, []);

  const fetchSurveys = async () => {
    try {
      setLoading(true);
      
      // Fetch dari survey-existing
      const existingRef = collection(db, "survey-existing");
      const existingQuery = query(existingRef, where("status", "==", "tervalidasi"));
      const existingSnapshot = await getDocs(existingQuery);
      
      // Fetch dari survey-apj-propose
      const proposeRef = collection(db, "survey-apj-propose");
      const proposeQuery = query(proposeRef, where("status", "==", "tervalidasi"));
      const proposeSnapshot = await getDocs(proposeQuery);
      
      // Combine data dari kedua collection
      const existingData = existingSnapshot.docs.map((doc) => {
        const surveyData = doc.data();
        return {
          id: doc.id,
          title: surveyData.namaTitikSurvey || surveyData.title || "Untitled",
          type: "existing",
          status: surveyData.status || "tervalidasi",
          surveyorName: surveyData.namaSurveyor || "-",
          validatedBy: surveyData.validatedBy || surveyData.editedBy || "Admin",
          latitude: surveyData.latitude || 0,
          longitude: surveyData.longitude || 0,
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
        };
      }) as Survey[];
      
      const proposeData = proposeSnapshot.docs.map((doc) => {
        const surveyData = doc.data();
        return {
          id: doc.id,
          title: surveyData.namaTitikSurvey || surveyData.title || "Untitled",
          type: "propose",
          status: surveyData.status || "tervalidasi",
          surveyorName: surveyData.namaSurveyor || "-",
          validatedBy: surveyData.validatedBy || surveyData.editedBy || "Admin",
          latitude: surveyData.latitude || 0,
          longitude: surveyData.longitude || 0,
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
        };
      }) as Survey[];
      
      const allSurveys = [...existingData, ...proposeData];
      
      setSurveys(allSurveys);
      setStats({
        total: allSurveys.length,
        visible: allSurveys.length,
        existing: existingData.length,
        propose: proposeData.length,
      });
    } catch (error) {
      console.error("Error fetching surveys:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetView = () => {
    // Reset map view to default center
    window.location.reload();
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
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Peta Bersama</h1>
              <p className="text-sm text-gray-600 mt-1">Visualisasi bersama titik koordinat survey yang telah divalidasi dalam peta interaktif</p>
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-md border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-600 font-medium">Total Survey Valid</p>
              <h3 className="text-3xl font-bold text-gray-900">{stats.total}</h3>
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
              <h3 className="text-3xl font-bold text-gray-900">{stats.visible}</h3>
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
              <h3 className="text-3xl font-bold text-gray-900">{stats.existing}</h3>
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
              <h3 className="text-3xl font-bold text-gray-900">{stats.propose}</h3>
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
                <h3 className="font-bold text-gray-900 text-lg">Peta Bersama</h3>
                <p className="text-sm text-gray-600">Menampilkan {stats.visible} titik koordinat survey tervalidasi</p>
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
          ) : (
            <MapsValidasiMap surveys={surveys} />
          )}
        </div>

        {/* Map Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-600 text-center">
            <span className="font-medium">Total Titik:</span> {stats.total} • 
            <span className="font-medium"> Tampil:</span> {stats.visible} • 
            <span className="font-medium"> Zoom:</span> Drag untuk menggeser, scroll untuk zoom • 
            <span className="font-medium"> Filter:</span> Semua Collection
          </p>
        </div>
      </div>
    </div>
  );
}
