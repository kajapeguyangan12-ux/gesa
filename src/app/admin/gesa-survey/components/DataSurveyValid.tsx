"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  verifiedAt?: { toDate?: () => Date } | Date | string | number | null;
  validatedAt?: { toDate?: () => Date } | Date | string | number | null;
  taskId?: string;
  taskTitle?: string;
  kabupaten?: string;
  kecamatan?: string;
  desa?: string;
  banjar?: string;
}

export default function DataSurveyValid({ activeKabupaten }: { activeKabupaten?: string | null }) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super-admin";
  const targetStatus = isSuperAdmin ? "tervalidasi" : "diverifikasi";
  const pageTitle = isSuperAdmin ? "Data Survey Valid" : "Data Survey Terverifikasi";
  const pageDescription = isSuperAdmin
    ? "Akses data survey yang telah tervalidasi berdasarkan kategori dan zona"
    : "Akses data survey yang telah diverifikasi berdasarkan kategori dan zona";
  const [selectedCategory, setSelectedCategory] = useState<"existing" | "propose" | "pra-existing" | null>(null);
  const [selectedSurveyor, setSelectedSurveyor] = useState("Semua Petugas");
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    existing: 0,
    propose: 0,
    praExisting: 0,
  });

  const fetchStatistics = useCallback(async () => {
    try {
      // Fetch from all collections
      const existingRef = collection(db, "survey-existing");
      const proposeRef = collection(db, "survey-apj-propose");
      const praExistingRef = collection(db, "survey-pra-existing");
      
      const qExisting = activeKabupaten
        ? query(existingRef, where("kabupaten", "==", activeKabupaten), where("status", "==", targetStatus))
        : query(existingRef, where("status", "==", targetStatus));
      const qPropose = activeKabupaten
        ? query(proposeRef, where("kabupaten", "==", activeKabupaten), where("status", "==", targetStatus))
        : query(proposeRef, where("status", "==", targetStatus));
      const qPraExisting = activeKabupaten
        ? query(praExistingRef, where("kabupaten", "==", activeKabupaten), where("status", "==", targetStatus))
        : query(praExistingRef, where("status", "==", targetStatus));
      
      console.log("🔍 Debug - Active Kabupaten:", activeKabupaten);
      console.log("🔍 Debug - Query Pra Existing:", qPraExisting);
      
      const [existingSnapshot, proposeSnapshot, praExistingSnapshot] = await Promise.all([
        getDocs(qExisting),
        getDocs(qPropose),
        getDocs(qPraExisting),
      ]);
      
      console.log("🔍 Debug - Pra Existing Snapshot Size:", praExistingSnapshot.size);
      console.log("🔍 Debug - Pra Existing ALL Status Check:", praExistingSnapshot.docs.map(doc => ({
        id: doc.id,
        status: doc.data().status,
        kabupaten: doc.data().kabupaten,
        kabupatenName: doc.data().kabupatenName,
        title: doc.data().title,
        jenisLampu: doc.data().jenisLampu,
        createdAt: doc.data().createdAt
      })));
      
      const existingCount = existingSnapshot.size;
      const proposeCount = proposeSnapshot.size;
      const praExistingCount = praExistingSnapshot.size;
      
      console.log("🔍 Debug - Counts:", { existingCount, proposeCount, praExistingCount });
      
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
          status: doc.data().status || targetStatus,
          surveyorName: doc.data().surveyorName || "Unknown",
          createdAt: doc.data().createdAt,
          verifiedAt: doc.data().verifiedAt || doc.data().createdAt,
          validatedAt: doc.data().validatedAt || null,
          taskId: doc.data().taskId || "",
          taskTitle: doc.data().taskTitle || "",
          kabupaten: doc.data().kabupatenName || doc.data().kabupaten || "",
          kecamatan: doc.data().kecamatan || "",
          desa: doc.data().desa || "",
          banjar: doc.data().banjar || "",
        })),
        ...proposeSnapshot.docs.map((doc) => ({
          id: doc.id,
          title: doc.data().title || `Survey APJ Propose - ${doc.data().namaJalan || "Untitled"}`,
          type: "propose",
          status: doc.data().status || targetStatus,
          surveyorName: doc.data().surveyorName || "Unknown",
          createdAt: doc.data().createdAt,
          verifiedAt: doc.data().verifiedAt || doc.data().createdAt,
          validatedAt: doc.data().validatedAt || null,
          taskId: doc.data().taskId || "",
          taskTitle: doc.data().taskTitle || "",
          kabupaten: doc.data().kabupatenName || doc.data().kabupaten || "",
          kecamatan: doc.data().kecamatan || "",
          desa: doc.data().desa || "",
          banjar: doc.data().banjar || "",
        })),
        ...praExistingSnapshot.docs.map((doc) => ({
          id: doc.id,
          title: doc.data().title || `Survey Pra Existing - ${doc.data().jenisLampu || "Untitled"}`,
          type: "pra-existing",
          status: doc.data().status || targetStatus,
          surveyorName: doc.data().surveyorName || "Unknown",
          createdAt: doc.data().createdAt,
          verifiedAt: doc.data().verifiedAt || doc.data().createdAt,
          validatedAt: doc.data().validatedAt || null,
          taskId: doc.data().taskId || "",
          taskTitle: doc.data().taskTitle || "",
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
  }, [activeKabupaten, targetStatus]);

  useEffect(() => {
    void Promise.resolve().then(fetchStatistics);
  }, [fetchStatistics]);

  const surveyorOptions = useMemo(
    () => ["Semua Petugas", ...new Set(surveys.map((survey) => survey.surveyorName).filter(Boolean))],
    [surveys]
  );

  const recapSurveys = useMemo(() => {
    if (selectedSurveyor === "Semua Petugas") return surveys;
    return surveys.filter((survey) => survey.surveyorName === selectedSurveyor);
  }, [selectedSurveyor, surveys]);

  const recapStats = useMemo(
    () => ({
      total: recapSurveys.length,
      existing: recapSurveys.filter((survey) => survey.type === "existing").length,
      propose: recapSurveys.filter((survey) => survey.type === "propose").length,
      praExisting: recapSurveys.filter((survey) => survey.type === "pra-existing").length,
    }),
    [recapSurveys]
  );

  const taskRecap = useMemo(() => {
    const taskMap = new Map<string, { label: string; count: number }>();

    recapSurveys.forEach((survey) => {
      const taskKey = survey.taskId || survey.taskTitle || "tanpa-tugas";
      const taskLabel = survey.taskTitle || survey.taskId || "Tanpa Tugas";
      const current = taskMap.get(taskKey);
      if (current) {
        current.count += 1;
        return;
      }
      taskMap.set(taskKey, { label: taskLabel, count: 1 });
    });

    return Array.from(taskMap.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [recapSurveys]);

  const handleCategoryClick = (category: "existing" | "propose" | "pra-existing") => {
    setSelectedCategory(category);
  };

  const handleExportCsv = () => {
    const headers = ["No", "Judul", "Tipe", "Status", "Surveyor", "Kabupaten", "Kecamatan", "Desa", "Banjar", "Tanggal Verifikasi"];
    if (isSuperAdmin) {
      headers.push("Tanggal Validasi");
    }

    const rows = surveys.map((survey, index) => {
      const row = [
        index + 1,
        survey.title,
        survey.type,
        survey.status,
        survey.surveyorName,
        survey.kabupaten || "-",
        survey.kecamatan || "-",
        survey.desa || "-",
        survey.banjar || "-",
        formatDate(survey.verifiedAt || survey.createdAt),
      ];

      if (isSuperAdmin) {
        row.push(formatDate(survey.validatedAt));
      }

      return row;
    });
    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${isSuperAdmin ? "data-survey-valid" : "data-survey-terverifikasi"}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const formatDate = (timestamp: Survey["createdAt"] | Survey["verifiedAt"] | Survey["validatedAt"]) => {
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
    return <SurveyExistingDetail onBack={() => setSelectedCategory(null)} statusFilter={targetStatus} activeKabupaten={activeKabupaten} />;
  }

  if (selectedCategory === "propose") {
    return <SurveyProposeDetail onBack={() => setSelectedCategory(null)} statusFilter={targetStatus} activeKabupaten={activeKabupaten} />;
  }

  if (selectedCategory === "pra-existing") {
    return <SurveyPraExistingDetail onBack={() => setSelectedCategory(null)} statusFilter={targetStatus} activeKabupaten={activeKabupaten} />;
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{pageTitle}</h1>
              <p className="text-sm text-gray-600 mt-1">Kelola dan pantau aktivitas survey</p>
            </div>
          </div>
          <button 
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Ekspor Semua (CSV)
          </button>
        </div>
      </div>

      {/* Page Description */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-2">{pageTitle}</h2>
        <p className="text-gray-600 text-sm">{pageDescription}</p>
      </div>

      {isSuperAdmin && (
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Rekap Titik Valid per Petugas</h2>
              <p className="text-sm text-gray-600">
                Alat bantu untuk melihat jumlah titik yang sudah tervalidasi per petugas dan per tugas.
              </p>
            </div>
            <div className="w-full lg:w-72">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Filter Petugas</label>
              <select
                value={selectedSurveyor}
                onChange={(event) => setSelectedSurveyor(event.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {surveyorOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-900 mb-1">Total Titik Valid</p>
              <h3 className="text-3xl font-bold text-blue-700">{recapStats.total}</h3>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-900 mb-1">Survey Existing</p>
              <h3 className="text-3xl font-bold text-emerald-700">{recapStats.existing}</h3>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-900 mb-1">Survey APJ Propose</p>
              <h3 className="text-3xl font-bold text-green-700">{recapStats.propose}</h3>
            </div>
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
              <p className="text-sm font-medium text-teal-900 mb-1">Survey Pra Existing</p>
              <h3 className="text-3xl font-bold text-teal-700">{recapStats.praExisting}</h3>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Jumlah Titik per Tugas</h3>
              <p className="text-sm text-gray-600">
                {selectedSurveyor === "Semua Petugas"
                  ? "Menampilkan akumulasi semua petugas."
                  : `Menampilkan tugas untuk ${selectedSurveyor}.`}
              </p>
            </div>
            {taskRecap.length === 0 ? (
              <div className="px-5 py-8 text-sm text-gray-500">Belum ada titik valid untuk filter yang dipilih.</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {taskRecap.map((task, index) => (
                  <div key={`${task.label}-${index}`} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">{task.label}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-700">{task.count}</p>
                      <p className="text-xs text-gray-500">titik valid</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Survey Category Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Survey Existing Card */}
        <div className="group bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-200 overflow-hidden cursor-pointer">
          <div className="p-8">
            <div className="flex flex-col items-center text-center">
              {/* Icon */}
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Survey Existing</h3>
              
              {/* Description */}
              <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                {isSuperAdmin ? "Data Survey Existing yang telah tervalidasi" : "Data Survey Existing yang telah diverifikasi"}
              </p>

              {/* Button */}
              <button 
                onClick={() => handleCategoryClick("existing")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg group-hover:gap-3"
              >
                Klik untuk melihat data
                <svg className="w-5 h-5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Survey Tiang APJ Propose Card */}
        <div className="group bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-200 overflow-hidden cursor-pointer">
          <div className="p-8">
            <div className="flex flex-col items-center text-center">
              {/* Icon */}
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Survey Tiang APJ Propose</h3>
              
              {/* Description */}
              <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                {isSuperAdmin ? "Data Survey Tiang APJ Propose yang telah tervalidasi" : "Data Survey Tiang APJ Propose yang telah diverifikasi"}
              </p>

              {/* Button */}
              <button 
                onClick={() => handleCategoryClick("propose")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg group-hover:gap-3"
              >
                Klik untuk melihat data
                <svg className="w-5 h-5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Survey Pra Existing Card */}
        <div className="group bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-200 overflow-hidden cursor-pointer">
          <div className="p-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg mb-6 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-3">Survey Pra Existing</h3>
              <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                {isSuperAdmin ? "Data Survey Pra Existing yang telah tervalidasi" : "Data Survey Pra Existing yang telah diverifikasi"}
              </p>
              <button
                onClick={() => handleCategoryClick("pra-existing")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg group-hover:gap-3"
              >
                Klik untuk melihat data
                <svg className="w-5 h-5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Information Box */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-xl p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-bold text-gray-900 mb-3">Informasi Kategori Survey</h4>
            <div className="space-y-2 text-sm text-gray-700">
              <p className="flex items-start gap-2">
                <span className="font-semibold text-blue-700 min-w-[180px]">Survey Existing:</span>
                <span>Survey yang berkaitan dengan data existing yang sudah ada</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-semibold text-green-700 min-w-[180px]">Survey Tiang APJ Propose:</span>
                <span>Survey tiang APJ untuk usulan atau rencana baru</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-semibold text-emerald-700 min-w-[180px]">Survey Pra Existing:</span>
                <span>Survey pra existing sederhana untuk pendataan awal</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Survey Valid</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats.total}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Survey Existing</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats.existing}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Survey APJ Propose</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats.propose}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Survey Pra Existing</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats.praExisting}</h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
