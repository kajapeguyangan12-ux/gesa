"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import SurveyExistingDetail from "./SurveyExistingDetail";
import SurveyProposeDetail from "./SurveyProposeDetail";
import SurveyPraExistingDetail from "./SurveyPraExistingDetail";

interface Survey {
  id: string;
  title: string;
  type: string;
  status: string;
  surveyorName: string;
  createdAt: { toDate?: () => Date } | Date | string | number | null;
  kabupaten?: string;
  kecamatan?: string;
  desa?: string;
  banjar?: string;
}

export default function DataSurveyTolak({ activeKabupaten }: { activeKabupaten?: string | null }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super-admin";
  const pageTitle = isSuperAdmin ? "Data Survey Valid (TOLAK)" : "Data Survey Terverifikasi (TOLAK)";
  const pageDescription = isSuperAdmin
    ? "Data survey yang ditolak pada tahap validasi data"
    : "Data survey yang ditolak pada tahap verifikasi";
  const [selectedCategory, setSelectedCategory] = useState<"existing" | "propose" | "pra-existing" | null>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    existing: 0,
    propose: 0,
    praExisting: 0,
  });

  const fetchStatistics = useCallback(async () => {
    try {
      // Fetch from all collections with status "ditolak"
      const existingRef = collection(db, "survey-existing");
      const proposeRef = collection(db, "survey-apj-propose");
      const praExistingRef = collection(db, "survey-pra-existing");
      
      const qExisting = activeKabupaten
        ? query(existingRef, where("kabupaten", "==", activeKabupaten), where("status", "==", "ditolak"))
        : query(existingRef, where("status", "==", "ditolak"));
      const qPropose = activeKabupaten
        ? query(proposeRef, where("kabupaten", "==", activeKabupaten), where("status", "==", "ditolak"))
        : query(proposeRef, where("status", "==", "ditolak"));
      const qPraExisting = activeKabupaten
        ? query(praExistingRef, where("kabupaten", "==", activeKabupaten), where("status", "==", "ditolak"))
        : query(praExistingRef, where("status", "==", "ditolak"));
      
      const [existingSnapshot, proposeSnapshot, praExistingSnapshot] = await Promise.all([
        getDocs(qExisting),
        getDocs(qPropose),
        getDocs(qPraExisting),
      ]);
      
      const existingCount = existingSnapshot.size;
      const proposeCount = proposeSnapshot.size;
      const praExistingCount = praExistingSnapshot.size;
      
      setStats({
        total: existingCount + proposeCount + praExistingCount,
        existing: existingCount,
        propose: proposeCount,
        praExisting: praExistingCount,
      });

      const allRows = [
        ...existingSnapshot.docs.map((doc) => ({
          id: doc.id,
          title: doc.data().title || `Survey Existing - ${doc.data().namaJalan || "Untitled"}`,
          type: "existing",
          status: doc.data().status || "ditolak",
          surveyorName: doc.data().surveyorName || "Unknown",
          createdAt: doc.data().createdAt,
          kabupaten: doc.data().kabupatenName || doc.data().kabupaten || "",
          kecamatan: doc.data().kecamatan || "",
          desa: doc.data().desa || "",
          banjar: doc.data().banjar || "",
        })),
        ...proposeSnapshot.docs.map((doc) => ({
          id: doc.id,
          title: doc.data().title || `Survey APJ Propose - ${doc.data().namaJalan || "Untitled"}`,
          type: "propose",
          status: doc.data().status || "ditolak",
          surveyorName: doc.data().surveyorName || "Unknown",
          createdAt: doc.data().createdAt,
          kabupaten: doc.data().kabupatenName || doc.data().kabupaten || "",
          kecamatan: doc.data().kecamatan || "",
          desa: doc.data().desa || "",
          banjar: doc.data().banjar || "",
        })),
        ...praExistingSnapshot.docs.map((doc) => ({
          id: doc.id,
          title: doc.data().title || `Survey Pra Existing - ${doc.data().jenisLampu || "Untitled"}`,
          type: "pra-existing",
          status: doc.data().status || "ditolak",
          surveyorName: doc.data().surveyorName || "Unknown",
          createdAt: doc.data().createdAt,
          kabupaten: doc.data().kabupatenName || doc.data().kabupaten || "",
          kecamatan: doc.data().kecamatan || "",
          desa: doc.data().desa || "",
          banjar: doc.data().banjar || "",
        })),
      ] as Survey[];

      setSurveys(allRows);
    } catch (error) {
      console.error("Error fetching statistics:", error);
    }
  }, [activeKabupaten]);

  useEffect(() => {
    void Promise.resolve().then(fetchStatistics);
  }, [fetchStatistics]);

  const handleCategoryClick = (category: "existing" | "propose" | "pra-existing") => {
    setSelectedCategory(category);
  };

  const handleExportCsv = () => {
    const headers = ["No", "Judul", "Tipe", "Status", "Surveyor", "Kabupaten", "Kecamatan", "Desa", "Banjar", "Tanggal"];
    const rows = surveys.map((survey, index) => [
      index + 1,
      survey.title,
      survey.type,
      survey.status,
      survey.surveyorName,
      survey.kabupaten || "-",
      survey.kecamatan || "-",
      survey.desa || "-",
      survey.banjar || "-",
      formatDate(survey.createdAt),
    ]);
    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `data-survey-tolak-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const formatDate = (timestamp: Survey["createdAt"]) => {
    if (!timestamp) return "-";
    if (typeof timestamp === "object" && timestamp !== null && "toDate" in timestamp && typeof timestamp.toDate === "function") {
      return timestamp.toDate().toLocaleString("id-ID");
    }
    if (typeof timestamp !== "string" && typeof timestamp !== "number" && !(timestamp instanceof Date)) {
      return "-";
    }
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("id-ID");
  };

  // Render detail view jika kategori dipilih
  if (selectedCategory === "existing") {
    return <SurveyExistingDetail onBack={() => setSelectedCategory(null)} statusFilter="ditolak" activeKabupaten={activeKabupaten} />;
  }

  if (selectedCategory === "propose") {
    return <SurveyProposeDetail onBack={() => setSelectedCategory(null)} statusFilter="ditolak" activeKabupaten={activeKabupaten} />;
  }

  if (selectedCategory === "pra-existing") {
    return <SurveyPraExistingDetail onBack={() => setSelectedCategory(null)} statusFilter="ditolak" activeKabupaten={activeKabupaten} />;
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{pageTitle}</h1>
              <p className="text-sm text-gray-600 mt-1">{pageDescription}</p>
            </div>
          </div>
          <button 
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div 
          className="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-6 border border-red-200 cursor-pointer hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
          onClick={() => {}}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <h3 className="text-4xl font-bold text-red-600 mb-2">{stats.total}</h3>
          <p className="text-sm font-semibold text-red-900">Total Survey Ditolak</p>
          <p className="text-xs text-red-700 mt-1">Semua kategori</p>
        </div>

        <div 
          onClick={() => handleCategoryClick("existing")}
          className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 border border-orange-200 cursor-pointer hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <h3 className="text-4xl font-bold text-orange-600 mb-2">{stats.existing}</h3>
          <p className="text-sm font-semibold text-orange-900">Survey Existing</p>
          <p className="text-xs text-orange-700 mt-1">Klik untuk melihat detail</p>
        </div>

        <div 
          onClick={() => handleCategoryClick("propose")}
          className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 border border-purple-200 cursor-pointer hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <h3 className="text-4xl font-bold text-purple-600 mb-2">{stats.propose}</h3>
          <p className="text-sm font-semibold text-purple-900">Survey APJ Propose</p>
          <p className="text-xs text-purple-700 mt-1">Klik untuk melihat detail</p>
        </div>

        <div 
          onClick={() => handleCategoryClick("pra-existing")}
          className="bg-gradient-to-br from-emerald-50 to-teal-100 rounded-2xl p-6 border border-emerald-200 cursor-pointer hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <h3 className="text-4xl font-bold text-emerald-600 mb-2">{stats.praExisting}</h3>
          <p className="text-sm font-semibold text-emerald-900">Survey Pra Existing</p>
          <p className="text-xs text-emerald-700 mt-1">Klik untuk melihat detail</p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 mb-1">Tentang Data Survey Ditolak</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              {isSuperAdmin
                ? "Halaman ini menampilkan data survey yang telah ditolak pada tahap validasi data. Data ini dapat digunakan untuk review dan analisis lebih lanjut."
                : "Halaman ini menampilkan data survey yang telah ditolak pada tahap verifikasi. Data ini dapat digunakan untuk review dan analisis lebih lanjut."}{" "}
              Klik pada kategori yang diinginkan untuk melihat detail lengkap survey yang ditolak.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
