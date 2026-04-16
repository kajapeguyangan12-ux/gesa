"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { clearCachedData, fetchWithCache } from "@/utils/firestoreCache";
import dynamic from "next/dynamic";

// Dynamic import for Map
const DynamicDetailMap = dynamic<{
  latitude: number;
  longitude: number;
  accuracy?: number;
  title: string;
}>(
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
  createdAt: TimestampLike;
  validatedAt: TimestampLike;
  validatedBy: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
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
  tinggiAPM?: string;
  tinggiARM?: string;
  tinggiArm?: string;
  keterangan?: string;
  lebarBahuBertiang?: string;
  lebarTrotoarBertiang?: string;
  lainnyaBertiang?: string;
  statusIDTitik?: string;
  idTitik?: string;
  dayaLampu?: string;
  dataTiang?: string;
  dataRuas?: string;
  subRuas?: string;
  median?: string;
  lebarJalan?: string;
  jarakAntarTiang?: string;
  // Pra existing fields
  jenisLampu?: string;
  jumlahLampu?: string;
  kondisi?: string;
  jenisTiang?: string;
  kabupaten?: string;
  kabupatenName?: string;
  kecamatan?: string;
  desa?: string;
  banjar?: string;
  kepemilikanTiang?: string;
  kepemilikanDisplay?: string;
  tipeTiangPLN?: string;
  fungsiLampu?: string;
  garduStatus?: string;
  kodeGardu?: string;
  adminLatitude?: number;
  adminLongitude?: number;
  finalLatitude?: number;
  finalLongitude?: number;
  hasAdminCoordinateOverride?: boolean;
  fotoAktual?: string;
  fotoKemerataan?: string;
  fotoTiangAPM?: string;
  fotoTitikActual?: string;
  photoUrl?: string;
  jenis?: string;
  zona?: string;
  kategori?: string;
  editedBy?: string;
  rejectionReason?: string;
  surveyorUid?: string;
}

type TimestampLike =
  | { toDate?: () => Date; seconds?: number }
  | Date
  | string
  | number
  | null
  | undefined;

interface Task {
  id: string;
  surveyorId: string;
  surveyorName: string;
  surveyorEmail: string;
  type: string;
  status: string;
  createdByAdminId?: string;
  createdByAdminName?: string;
  createdByAdminEmail?: string;
}

export default function DataSurveyValidasi({ activeKabupaten }: { activeKabupaten?: string | null }) {
  const VALIDASI_CACHE_PREFIX = "data_survey_validasi";
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Survey | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isBulkValidating, setIsBulkValidating] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSurveyor, setFilterSurveyor] = useState<string>("all");
  const [filterKecamatan, setFilterKecamatan] = useState<string>("all");
  const [filterDesa, setFilterDesa] = useState<string>("all");
  const [coordinateSearch, setCoordinateSearch] = useState("");
  const [selectedSurveyIds, setSelectedSurveyIds] = useState<string[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    existing: 0,
    propose: 0,
    praExisting: 0,
  });
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setSelectedSurveyIds([]);
  }, [filterType, filterStatus, filterSurveyor, filterKecamatan, filterDesa, coordinateSearch]);

  useEffect(() => {
    setSurveys([]);
    setTasks([]);
    setCurrentPage(1);
    setShowAll(false);
    setDataLoaded(false);
    setStats({
      total: 0,
      existing: 0,
      propose: 0,
      praExisting: 0,
    });
  }, [activeKabupaten]);

  const fetchAllSurveys = async (requestedLimit?: number | null, forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      // Get current admin info
      const storedUser = localStorage.getItem('gesa_user');
      const currentAdmin = storedUser ? JSON.parse(storedUser) : null;
      const adminId = currentAdmin?.uid || null;
      const superAdmin = currentAdmin?.role === "super-admin";
      setCurrentAdminId(adminId);
      
      // Fetch tasks first to get list of assigned surveyors by THIS admin
      const tasksCacheKey = `${VALIDASI_CACHE_PREFIX}_tasks_${adminId || "all"}`;
      const surveysCacheKey = `${VALIDASI_CACHE_PREFIX}_surveys_${adminId || "all"}_${activeKabupaten || "all"}_${requestedLimit ?? "all"}`;
      if (forceRefresh) {
        clearCachedData(tasksCacheKey);
        clearCachedData(surveysCacheKey);
      }

      const tasksData = await fetchWithCache<Task[]>(
        tasksCacheKey,
        async () => {
          const tasksRef = collection(db, "tasks");
          const tasksQuery = query(tasksRef, orderBy("createdAt", "desc"), limit(300));
          const tasksSnapshot = await getDocs(tasksQuery);
          return tasksSnapshot.docs
            .filter((doc) => {
              const taskAdminId = doc.data().createdByAdminId;
              return !taskAdminId || taskAdminId === adminId;
            })
            .map((doc) => ({
              id: doc.id,
              surveyorId: doc.data().surveyorId,
              surveyorName: doc.data().surveyorName,
              surveyorEmail: doc.data().surveyorEmail,
              type: doc.data().type,
              status: doc.data().status,
              createdByAdminId: doc.data().createdByAdminId,
              createdByAdminName: doc.data().createdByAdminName,
              createdByAdminEmail: doc.data().createdByAdminEmail,
            })) as Task[];
        },
        120_000
      );
      setTasks(tasksData);
      
      // Get list of assigned surveyor UIDs (only from tasks created by this admin)
      const assignedSurveyorIds = tasksData.map(task => task.surveyorId);
      
      const { allSurveys, existingData, proposeData, praExistingData } = await fetchWithCache<{
        allSurveys: Survey[];
        existingData: Survey[];
        proposeData: Survey[];
        praExistingData: Survey[];
      }>(
        surveysCacheKey,
        async () => {
          const existingRef = collection(db, "survey-existing");
          const proposeRef = collection(db, "survey-apj-propose");
          const praExistingRef = collection(db, "survey-pra-existing");
          const safeLimit = requestedLimit ? Math.max(requestedLimit * 5, 50) : null;

          const existingQuery = activeKabupaten
            ? (requestedLimit
                ? query(existingRef, where("kabupaten", "==", activeKabupaten), where("status", "==", "diverifikasi"), orderBy("createdAt", "desc"), limit(safeLimit!))
                : query(existingRef, where("kabupaten", "==", activeKabupaten), orderBy("createdAt", "desc")))
            : (requestedLimit
                ? query(existingRef, where("status", "==", "diverifikasi"), orderBy("createdAt", "desc"), limit(safeLimit!))
                : query(existingRef, orderBy("createdAt", "desc")));
          const proposeQuery = activeKabupaten
            ? (requestedLimit
                ? query(proposeRef, where("kabupaten", "==", activeKabupaten), where("status", "==", "diverifikasi"), orderBy("createdAt", "desc"), limit(safeLimit!))
                : query(proposeRef, where("kabupaten", "==", activeKabupaten), orderBy("createdAt", "desc")))
            : (requestedLimit
                ? query(proposeRef, where("status", "==", "diverifikasi"), orderBy("createdAt", "desc"), limit(safeLimit!))
                : query(proposeRef, orderBy("createdAt", "desc")));
          const praExistingQuery = activeKabupaten
            ? (requestedLimit
                ? query(praExistingRef, where("kabupaten", "==", activeKabupaten), where("status", "==", "diverifikasi"), orderBy("createdAt", "desc"), limit(safeLimit!))
                : query(praExistingRef, where("kabupaten", "==", activeKabupaten), orderBy("createdAt", "desc")))
            : (requestedLimit
                ? query(praExistingRef, where("status", "==", "diverifikasi"), orderBy("createdAt", "desc"), limit(safeLimit!))
                : query(praExistingRef, orderBy("createdAt", "desc")));
          
          const [existingSnapshot, proposeSnapshot, praExistingSnapshot] = await Promise.all([
            getDocs(existingQuery),
            getDocs(proposeQuery),
            getDocs(praExistingQuery),
          ]);
          
          const existingData = existingSnapshot.docs
            .filter((doc) => {
              const surveyorUid = doc.data().surveyorUid;
              const status = doc.data().status;
              if (status !== "diverifikasi") return false;
              if (superAdmin) return true;
              return surveyorUid && assignedSurveyorIds.includes(surveyorUid);
            })
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
              title: doc.data().title || `Survey Existing - ${doc.data().namaJalan || "Untitled"}`,
              type: "existing",
              surveyorName: doc.data().surveyorName || "Unknown",
            })) as Survey[];
          
          const proposeData = proposeSnapshot.docs
            .filter((doc) => {
              const surveyorUid = doc.data().surveyorUid;
              const status = doc.data().status;
              if (status !== "diverifikasi") return false;
              if (superAdmin) return true;
              return surveyorUid && assignedSurveyorIds.includes(surveyorUid);
            })
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
              title: doc.data().title || `Survey APJ Propose - ${doc.data().namaJalan || "Untitled"}`,
              type: "propose",
              surveyorName: doc.data().surveyorName || "Unknown",
            })) as Survey[];

          const praExistingData = praExistingSnapshot.docs
            .filter((doc) => {
              const surveyorUid = doc.data().surveyorUid;
              const status = doc.data().status;
              if (status !== "diverifikasi") return false;
              if (superAdmin) return true;
              return surveyorUid && assignedSurveyorIds.includes(surveyorUid);
            })
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
              title: doc.data().title || `Survey Pra Existing - ${doc.data().jenisLampu || "Untitled"}`,
              type: "pra-existing",
              surveyorName: doc.data().surveyorName || "Unknown",
            })) as Survey[];
          
          const allSurveys = [...existingData, ...proposeData, ...praExistingData].sort((a, b) => {
            const dateA =
              a.createdAt instanceof Date
                ? a.createdAt
                : typeof a.createdAt === "object" && a.createdAt?.toDate
                ? a.createdAt.toDate()
                : new Date(0);
            const dateB =
              b.createdAt instanceof Date
                ? b.createdAt
                : typeof b.createdAt === "object" && b.createdAt?.toDate
                ? b.createdAt.toDate()
                : new Date(0);
            return dateB.getTime() - dateA.getTime();
          });

          return { allSurveys, existingData, proposeData, praExistingData };
        },
        5 * 60_000
      );
      
      setSurveys(requestedLimit ? allSurveys.slice(0, requestedLimit) : allSurveys);
      setDataLoaded(true);
      
      setStats({
        total: requestedLimit ? allSurveys.slice(0, requestedLimit).length : allSurveys.length,
        existing: requestedLimit ? allSurveys.slice(0, requestedLimit).filter((survey) => survey.type === "existing").length : existingData.length,
        propose: requestedLimit ? allSurveys.slice(0, requestedLimit).filter((survey) => survey.type === "propose").length : proposeData.length,
        praExisting: requestedLimit ? allSurveys.slice(0, requestedLimit).filter((survey) => survey.type === "pra-existing").length : praExistingData.length,
      });
    } catch (error) {
      console.error("Error fetching surveys:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const clearValidasiCaches = () => {
    clearCachedData(`${VALIDASI_CACHE_PREFIX}_tasks_${currentAdminId || "all"}`);
    clearCachedData(`${VALIDASI_CACHE_PREFIX}_surveys_${currentAdminId || "all"}_${activeKabupaten || "all"}_10`);
    clearCachedData(`${VALIDASI_CACHE_PREFIX}_surveys_${currentAdminId || "all"}_${activeKabupaten || "all"}_all`);
  };

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
      const collectionName =
        editFormData.type === "existing"
          ? "survey-existing"
          : editFormData.type === "propose"
          ? "survey-apj-propose"
          : "survey-pra-existing";
      const surveyDoc = doc(db, collectionName, editFormData.id);
      
      const storedUser = localStorage.getItem('gesa_user');
      const currentUser = storedUser ? JSON.parse(storedUser) : null;
      const normalizedLatitude = Number(editFormData.latitude);
      const normalizedLongitude = Number(editFormData.longitude);
      const normalizedAdminLatitude = Number(editFormData.adminLatitude);
      const normalizedAdminLongitude = Number(editFormData.adminLongitude);
      const hasValidBaseCoords = Number.isFinite(normalizedLatitude) && Number.isFinite(normalizedLongitude);
      const hasValidAdminCoords = Number.isFinite(normalizedAdminLatitude) && Number.isFinite(normalizedAdminLongitude);
      const resolvedPraLatitude = hasValidAdminCoords
        ? normalizedAdminLatitude
        : hasValidBaseCoords
          ? normalizedLatitude
          : null;
      const resolvedPraLongitude = hasValidAdminCoords
        ? normalizedAdminLongitude
        : hasValidBaseCoords
          ? normalizedLongitude
          : null;
      
      await updateDoc(surveyDoc, {
        ...editFormData,
        latitude: hasValidBaseCoords ? normalizedLatitude : editFormData.latitude,
        longitude: hasValidBaseCoords ? normalizedLongitude : editFormData.longitude,
        adminLatitude: hasValidAdminCoords ? normalizedAdminLatitude : null,
        adminLongitude: hasValidAdminCoords ? normalizedAdminLongitude : null,
        finalLatitude:
          editFormData.type === "pra-existing" && resolvedPraLatitude !== null
            ? resolvedPraLatitude
            : editFormData.finalLatitude ?? null,
        finalLongitude:
          editFormData.type === "pra-existing" && resolvedPraLongitude !== null
            ? resolvedPraLongitude
            : editFormData.finalLongitude ?? null,
        hasAdminCoordinateOverride:
          editFormData.type === "pra-existing" &&
          resolvedPraLatitude !== null &&
          resolvedPraLongitude !== null &&
          (Math.abs(resolvedPraLatitude - normalizedLatitude) > 0.0000001 ||
            Math.abs(resolvedPraLongitude - normalizedLongitude) > 0.0000001),
        kepemilikanTiang: editFormData.kepemilikanDisplay || editFormData.kepemilikanTiang,
        editedBy: currentUser?.name || currentUser?.email || 'Admin',
        updatedAt: new Date()
      });
      
      clearValidasiCaches();
      await fetchAllSurveys();
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
      const collectionName =
        survey.type === "existing"
          ? "survey-existing"
          : survey.type === "propose"
          ? "survey-apj-propose"
          : "survey-pra-existing";
      const surveyDoc = doc(db, collectionName, survey.id);
      
      const storedUser = localStorage.getItem('gesa_user');
      const currentUser = storedUser ? JSON.parse(storedUser) : null;
      const normalizedAdminLatitude = Number(survey.adminLatitude);
      const normalizedAdminLongitude = Number(survey.adminLongitude);
      const shouldUseAdminCoordinate =
        survey.type === "pra-existing" &&
        Number.isFinite(normalizedAdminLatitude) &&
        Number.isFinite(normalizedAdminLongitude);
      
      await updateDoc(surveyDoc, {
        status: "tervalidasi",
        ...(shouldUseAdminCoordinate
          ? {
              latitude: normalizedAdminLatitude,
              longitude: normalizedAdminLongitude,
              finalLatitude: normalizedAdminLatitude,
              finalLongitude: normalizedAdminLongitude,
              coordinateSource: "admin",
            }
          : {}),
        validatedBy: currentUser?.name || currentUser?.email || 'Admin',
        validatedAt: new Date()
      });
      
      clearValidasiCaches();
      await fetchAllSurveys();
      
      alert('Survey berhasil divalidasi! Survey dipindahkan ke Data Survey Valid.');
    } catch (error) {
      console.error('Error validating survey:', error);
      alert('Gagal memvalidasi survey: ' + error);
    }
  };

  const handleBulkValidasi = async () => {
    const selectedSurveys = filteredSurveys.filter((survey) => selectedSurveyIds.includes(survey.id));
    if (selectedSurveys.length === 0) {
      alert("Pilih minimal satu data untuk divalidasi.");
      return;
    }

    if (!confirm(`Validasi ${selectedSurveys.length} data terpilih dan pindahkan ke Data Survey Valid?`)) return;

    try {
      setIsBulkValidating(true);
      const storedUser = localStorage.getItem("gesa_user");
      const currentUser = storedUser ? JSON.parse(storedUser) : null;

      await Promise.all(
        selectedSurveys.map(async (survey) => {
          const collectionName =
            survey.type === "existing"
              ? "survey-existing"
              : survey.type === "propose"
              ? "survey-apj-propose"
              : "survey-pra-existing";
          const surveyDoc = doc(db, collectionName, survey.id);
          const normalizedAdminLatitude = Number(survey.adminLatitude);
          const normalizedAdminLongitude = Number(survey.adminLongitude);
          const shouldUseAdminCoordinate =
            survey.type === "pra-existing" &&
            Number.isFinite(normalizedAdminLatitude) &&
            Number.isFinite(normalizedAdminLongitude);

          await updateDoc(surveyDoc, {
            status: "tervalidasi",
            ...(shouldUseAdminCoordinate
              ? {
                  latitude: normalizedAdminLatitude,
                  longitude: normalizedAdminLongitude,
                  finalLatitude: normalizedAdminLatitude,
                  finalLongitude: normalizedAdminLongitude,
                  coordinateSource: "admin",
                }
              : {}),
            validatedBy: currentUser?.name || currentUser?.email || "Admin",
            validatedAt: new Date(),
          });
        })
      );

      setSelectedSurveyIds([]);
      clearValidasiCaches();
      await fetchAllSurveys();
      alert(`${selectedSurveys.length} data berhasil divalidasi.`);
    } catch (error) {
      console.error("Error bulk validating surveys:", error);
      alert("Gagal memvalidasi data terpilih: " + error);
    } finally {
      setIsBulkValidating(false);
    }
  };

  const handleExportSelected = () => {
    const selectedSurveys = filteredSurveys.filter((survey) => selectedSurveyIds.includes(survey.id));
    if (selectedSurveys.length === 0) {
      alert("Pilih minimal satu data untuk diunduh.");
      return;
    }

    const headers = ["No", "Nama Jalan", "Tipe", "Surveyor", "Kecamatan", "Desa", "Latitude", "Longitude", "Status", "Tanggal"];
    const rows = selectedSurveys.map((survey, index) => [
      index + 1,
      survey.namaJalan || survey.title || "",
      survey.type,
      survey.surveyorName || "",
      survey.kecamatan || "",
      survey.desa || "",
      getResolvedLatitude(survey) ?? "",
      getResolvedLongitude(survey) ?? "",
      survey.status || "",
      formatDate(survey.createdAt),
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `validasi-data-terpilih-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleTolak = async (survey: Survey) => {
    const alasan = prompt('Masukkan alasan penolakan:');
    if (!alasan) return;
    
    try {
      const collectionName =
        survey.type === "existing"
          ? "survey-existing"
          : survey.type === "propose"
          ? "survey-apj-propose"
          : "survey-pra-existing";
      const surveyDoc = doc(db, collectionName, survey.id);
      
      const storedUser = localStorage.getItem('gesa_user');
      const currentUser = storedUser ? JSON.parse(storedUser) : null;
      
      await updateDoc(surveyDoc, {
        status: "ditolak",
        rejectedBy: currentUser?.name || currentUser?.email || 'Admin',
        rejectedAt: new Date(),
        rejectionReason: alasan
      });
      
      clearValidasiCaches();
      await fetchAllSurveys();
      setShowDetailModal(false);
      setSelectedSurvey(null);
      
      alert('Survey berhasil ditolak!');
    } catch (error) {
      console.error('Error rejecting survey:', error);
      alert('Gagal menolak survey: ' + error);
    }
  };

  const handleDelete = async (survey: Survey) => {
    if (!confirm('Apakah Anda yakin ingin menghapus survey ini? Data tidak dapat dikembalikan!')) return;
    
    try {
      const collectionName =
        survey.type === "existing"
          ? "survey-existing"
          : survey.type === "propose"
          ? "survey-apj-propose"
          : "survey-pra-existing";
      const surveyDoc = doc(db, collectionName, survey.id);
      
      await deleteDoc(surveyDoc);
      clearValidasiCaches();
      await fetchAllSurveys();
      
      alert('Survey berhasil dihapus!');
    } catch (error) {
      console.error('Error deleting survey:', error);
      alert('Gagal menghapus survey: ' + error);
    }
  };

  const formatDate = (timestamp: TimestampLike) => {
    if (!timestamp) return "N/A";
    try {
      const date =
        typeof timestamp === "object" && timestamp !== null && "toDate" in timestamp && typeof timestamp.toDate === "function"
          ? timestamp.toDate()
          : timestamp instanceof Date
            ? timestamp
            : typeof timestamp === "string" || typeof timestamp === "number"
              ? new Date(timestamp)
              : null;
      if (!date || Number.isNaN(date.getTime())) return "N/A";
      return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return "N/A";
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "menunggu":
        return "bg-yellow-100 text-yellow-700";
      case "diverifikasi":
        return "bg-blue-100 text-blue-700";
      case "tervalidasi":
        return "bg-green-100 text-green-700";
      case "ditolak":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getTypeBadge = (type: string) => {
    if (type === "existing") return "bg-blue-100 text-blue-700";
    if (type === "propose") return "bg-purple-100 text-purple-700";
    return "bg-emerald-100 text-emerald-700";
  };

  const normalizeCoordinateText = (value: string) => value.replace(/\s+/g, "");
  const getResolvedLatitude = (survey: Survey) =>
    typeof survey.finalLatitude === "number" && Number.isFinite(survey.finalLatitude)
      ? survey.finalLatitude
      : typeof survey.adminLatitude === "number" && Number.isFinite(survey.adminLatitude)
        ? survey.adminLatitude
        : survey.latitude;
  const getResolvedLongitude = (survey: Survey) =>
    typeof survey.finalLongitude === "number" && Number.isFinite(survey.finalLongitude)
      ? survey.finalLongitude
      : typeof survey.adminLongitude === "number" && Number.isFinite(survey.adminLongitude)
        ? survey.adminLongitude
        : survey.longitude;

  const surveyorOptions = useMemo(
    () => ["all", ...new Set(surveys.map((survey) => survey.surveyorName).filter(Boolean))],
    [surveys]
  );

  const kecamatanOptions = useMemo(
    () => ["all", ...new Set(surveys.map((survey) => survey.kecamatan).filter(Boolean))],
    [surveys]
  );

  const desaOptions = useMemo(() => {
    const base = filterKecamatan === "all" ? surveys : surveys.filter((survey) => survey.kecamatan === filterKecamatan);
    return ["all", ...new Set(base.map((survey) => survey.desa).filter(Boolean))];
  }, [filterKecamatan, surveys]);

  const filteredSurveys = surveys.filter(survey => {
    if (filterType !== "all" && survey.type !== filterType) return false;
    if (filterStatus !== "all" && survey.status !== filterStatus) return false;
    if (filterSurveyor !== "all" && survey.surveyorName !== filterSurveyor) return false;
    if (filterKecamatan !== "all" && survey.kecamatan !== filterKecamatan) return false;
    if (filterDesa !== "all" && survey.desa !== filterDesa) return false;

    if (coordinateSearch.trim()) {
      const searchTerms = coordinateSearch
        .split(/[\s,;]+/)
        .map((term) => normalizeCoordinateText(term.trim()))
        .filter(Boolean);
      const coordinateValues = [
        getResolvedLatitude(survey),
        getResolvedLongitude(survey),
        survey.adminLatitude,
        survey.adminLongitude,
        survey.finalLatitude,
        survey.finalLongitude,
      ]
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
        .flatMap((value) => [value.toString(), value.toFixed(7)]);

      const matchesCoordinate = searchTerms.every((term) =>
        coordinateValues.some((value) => normalizeCoordinateText(value).includes(term))
      );

      if (!matchesCoordinate) return false;
    }

    return true;
  });

  // Pagination logic
  const totalItems = filteredSurveys.length;
  const totalPages = showAll ? 1 : Math.ceil(totalItems / itemsPerPage);
  const startIndex = showAll ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = showAll ? totalItems : startIndex + itemsPerPage;
  const paginatedSurveys = showAll ? filteredSurveys : filteredSurveys.slice(startIndex, endIndex);

  // Debug pagination values
  console.log("=== DATA VERIFIKASI PAGINATION DEBUG ===");
  console.log("filteredSurveys.length:", filteredSurveys.length);
  console.log("totalItems:", totalItems);
  console.log("totalPages:", totalPages);
  console.log("currentPage:", currentPage);
  console.log("itemsPerPage:", itemsPerPage);
  console.log("showAll:", showAll);
  console.log("paginatedSurveys.length:", paginatedSurveys.length);
  console.log("========================================");

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, filterStatus, filterSurveyor, filterKecamatan, filterDesa, coordinateSearch]);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle items per page change
  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
    setShowAll(false);
    if (dataLoaded && surveys.length < value) {
      void fetchAllSurveys(value);
    }
  };

  // Handle show all toggle
  const handleShowAllToggle = () => {
    setShowAll(!showAll);
    setCurrentPage(1);
  };

  const allFilteredSelected = filteredSurveys.length > 0 && filteredSurveys.every((survey) => selectedSurveyIds.includes(survey.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedSurveyIds((prev) => prev.filter((id) => !filteredSurveys.some((survey) => survey.id === id)));
      return;
    }
    setSelectedSurveyIds((prev) => Array.from(new Set([...prev, ...filteredSurveys.map((survey) => survey.id)])));
  };

  const toggleSelectSurvey = (surveyId: string) => {
    setSelectedSurveyIds((prev) =>
      prev.includes(surveyId) ? prev.filter((id) => id !== surveyId) : [...prev, surveyId]
    );
  };

  // Pagination controls component
  const PaginationControls = () => {
    console.log("DataVerifikasi PaginationControls rendering, totalItems:", totalItems);
    
    // Always return the controls, even if totalItems is 0
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-gray-50 border-t">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            <span>Menampilkan {showAll ? totalItems : paginatedSurveys.length} dari {totalItems} data</span>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Tampilkan:</label>
            <select
              value={showAll ? "all" : itemsPerPage}
              onChange={(e) => {
                if (e.target.value === "all") {
                  handleShowAllToggle();
                } else {
                  handleItemsPerPageChange(Number(e.target.value));
                }
              }}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">Semua</option>
            </select>
          </div>
        </div>

        {/* Always show pagination controls when there's data */}
        {!showAll && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-1 text-sm border rounded ${
                      currentPage === pageNum
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-white border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm p-4 lg:p-6 border border-gray-100">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
              Validasi Data
            </h2>
            <p className="text-sm text-gray-600">
              Data survey yang sudah diverifikasi pada tahap awal. Setelah divalidasi, data akan pindah ke Data Survey Valid.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <button
              onClick={() => void fetchAllSurveys(10)}
              disabled={loading}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-colors"
            >
              {loading ? "Memuat..." : "Muat 10 Data"}
            </button>
            <button
              onClick={() => void fetchAllSurveys(null)}
              disabled={loading}
              className="px-4 py-3 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold rounded-xl transition-colors"
            >
              Muat Semua
            </button>
            <button
              onClick={() => void fetchAllSurveys(showAll ? null : 10, true)}
              disabled={loading || refreshing || !dataLoaded}
              className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-semibold rounded-xl transition-colors"
            >
              {refreshing ? "Refresh..." : "Refresh Data"}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filter:
            </div>
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Semua Tipe</option>
              <option value="existing">Survey Existing</option>
              <option value="propose">Survey APJ Propose</option>
              <option value="pra-existing">Survey Pra Existing</option>
            </select>
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Semua Status</option>
              <option value="menunggu">Menunggu</option>
              <option value="diverifikasi">Diverifikasi</option>
              <option value="tervalidasi">Tervalidasi</option>
              <option value="ditolak">Ditolak</option>
            </select>
            <select
              value={filterSurveyor}
              onChange={(e) => setFilterSurveyor(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Semua Petugas</option>
              {surveyorOptions.filter((option) => option !== "all").map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={filterKecamatan}
              onChange={(e) => {
                setFilterKecamatan(e.target.value);
                setFilterDesa("all");
              }}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Semua Kecamatan</option>
              {kecamatanOptions.filter((option) => option !== "all").map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={filterDesa}
              onChange={(e) => setFilterDesa(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Semua Desa</option>
              {desaOptions.filter((option) => option !== "all").map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <div className="w-full lg:w-80">
              <input
                type="text"
                value={coordinateSearch}
                onChange={(e) => setCoordinateSearch(e.target.value)}
                placeholder="Cari koordinat, contoh: -8.53 atau 115.12"
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="ml-auto text-sm text-gray-600 font-medium">
              Total: {filteredSurveys.length} dari {surveys.length} survey
            </div>
          </div>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="text-sm text-gray-600">
                Terpilih: <span className="font-semibold text-gray-900">{selectedSurveyIds.length}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  disabled={filteredSurveys.length === 0}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  {allFilteredSelected ? "Batal Pilih Semua" : "Pilih Semua"}
                </button>
                <button
                  onClick={handleExportSelected}
                  disabled={selectedSurveyIds.length === 0}
                  className="px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-50"
                >
                  Download Terpilih
                </button>
                <button
                  onClick={handleBulkValidasi}
                  disabled={selectedSurveyIds.length === 0 || isBulkValidating}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {isBulkValidating ? "Memvalidasi..." : "Validasi Terpilih"}
                </button>
              </div>
            </div>
          </div>
        </div>

        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">Memuat data survey...</p>
          </div>
        ) : filteredSurveys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-4xl">📊</span>
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Belum Ada Data</h4>
            <p className="text-sm text-gray-600 text-center max-w-md">
              Belum ada data survey yang sesuai dengan filter yang dipilih.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900 text-center">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900">No</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900">Nama Jalan</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900">Tipe</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900">Surveyor</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900">Kecamatan</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900">Desa</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900">Tanggal</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-4 py-3 text-sm font-semibold text-gray-900 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedSurveys.map((survey, index) => (
                  <tr key={survey.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedSurveyIds.includes(survey.id)}
                        onChange={() => toggleSelectSurvey(survey.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                      {survey.namaJalan || survey.title || "N/A"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeBadge(survey.type)}`}>
                        {survey.type === "existing"
                          ? "Existing"
                          : survey.type === "propose"
                          ? "APJ Propose"
                          : "Pra Existing"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{survey.surveyorName || "N/A"}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{survey.kecamatan || "N/A"}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{survey.desa || "N/A"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(survey.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(survey.status)}`}>
                        {survey.status?.charAt(0).toUpperCase() + survey.status?.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
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
                          className="p-2 hover:bg-yellow-100 rounded-lg transition-all" 
                          title="Edit"
                        >
                          <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {survey.status === "diverifikasi" && (
                          <button 
                            onClick={() => handleValidasi(survey)}
                            className="p-2 hover:bg-green-100 rounded-lg transition-all" 
                            title="Validasi Data - pindah ke Data Survey Valid"
                          >
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                        {survey.status !== "ditolak" && survey.status !== "tervalidasi" && survey.status !== "diverifikasi" && (
                          <button 
                            onClick={() => handleTolak(survey)}
                            className="p-2 hover:bg-orange-100 rounded-lg transition-all" 
                            title="Tolak"
                          >
                            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                        <button 
                          onClick={() => handleDelete(survey)}
                          className="p-2 hover:bg-red-100 rounded-lg transition-all" 
                          title="Hapus"
                        >
                          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={10} className="px-4 py-3 text-right">
                    <PaginationControls />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedSurvey && (
        <DetailModal 
          survey={selectedSurvey}
          onClose={() => setShowDetailModal(false)}
          onEdit={() => {
            setShowDetailModal(false);
            handleEdit(selectedSurvey);
          }}
          onTolak={() => {
            setShowDetailModal(false);
            handleTolak(selectedSurvey);
          }}
          formatDate={formatDate}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && editFormData && (
        <EditModal 
          survey={editFormData}
          isSaving={isSaving}
          onClose={() => {
            setShowEditModal(false);
            setEditFormData(null);
          }}
          onSave={handleSaveEdit}
          onChange={setEditFormData}
        />
      )}
    </>
  );
}

// Detail Modal Component
function DetailModal({ 
  survey, 
  onClose, 
  onEdit, 
  onTolak,
  formatDate 
}: { 
  survey: Survey; 
  onClose: () => void; 
  onEdit: () => void;
  onTolak: () => void;
  formatDate: (date: TimestampLike) => string;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 lg:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl lg:rounded-3xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-y-auto my-4">
        {/* Modal Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-4 lg:p-6 rounded-t-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                survey.type === "existing" ? "bg-blue-100" : "bg-purple-100"
              }`}>
                <span className="text-2xl">{survey.type === "existing" ? "📁" : "💡"}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg lg:text-2xl font-bold text-gray-900 mb-1 break-words">
                  {survey.title || survey.namaJalan || "Detail Survey"}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs lg:text-sm text-gray-600">
                  <span className={`px-3 py-1 rounded-full font-medium ${
                    survey.status === "menunggu" ? "bg-yellow-100 text-yellow-700"
                    : survey.status === "tervalidasi" ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                  }`}>
                    {survey.status?.charAt(0).toUpperCase() + survey.status?.slice(1)}
                  </span>
                  <span>•</span>
                  <span>{formatDate(survey.createdAt)}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-all flex-shrink-0"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 lg:p-6 space-y-6">
          {/* Map Section */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Lokasi Survey
            </h3>
            <DynamicDetailMap 
              latitude={survey.latitude} 
              longitude={survey.longitude}
              accuracy={survey.accuracy || 0}
              title={survey.title || survey.namaJalan || "Survey Location"}
            />
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="bg-white/70 backdrop-blur px-4 py-3 rounded-lg border border-blue-200">
                <p className="text-gray-600 mb-1">Latitude</p>
                <p className="font-mono font-bold text-gray-900">{survey.latitude.toFixed(7)}</p>
              </div>
              <div className="bg-white/70 backdrop-blur px-4 py-3 rounded-lg border border-blue-200">
                <p className="text-gray-600 mb-1">Longitude</p>
                <p className="font-mono font-bold text-gray-900">{survey.longitude.toFixed(7)}</p>
              </div>
            </div>
          </div>

          {/* Photos Section */}
          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Dokumentasi Foto
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {survey.fotoTiangAPM && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Foto Tiang APM</p>
                  <img src={survey.fotoTiangAPM} alt="Tiang APM" className="w-full h-48 object-cover rounded-lg border border-gray-200" />
                </div>
              )}
              {survey.fotoTitikActual && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Foto Titik Actual</p>
                  <img src={survey.fotoTitikActual} alt="Titik Actual" className="w-full h-48 object-cover rounded-lg border border-gray-200" />
                </div>
              )}
              {survey.fotoKemerataan && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Foto Kemerataan</p>
                  <img src={survey.fotoKemerataan} alt="Kemerataan" className="w-full h-48 object-cover rounded-lg border border-gray-200" />
                </div>
              )}
              {survey.fotoAktual && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Foto Aktual</p>
                  <img src={survey.fotoAktual} alt="Foto Aktual" className="w-full h-48 object-cover rounded-lg border border-gray-200" />
                </div>
              )}
            </div>
          </div>

          {/* Survey Information */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Informasi Survey
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Common Fields */}
                <InfoField label="1. Nama Jalan" value={survey.namaJalan} />
                <InfoField label="2. Surveyor" value={survey.surveyorName} />
                <InfoField label="3. Latitude" value={survey.latitude?.toFixed(7)} />
                <InfoField label="4. Longitude" value={survey.longitude?.toFixed(7)} />
                <InfoField label="5. Zona" value={survey.zona} />
                <InfoField label="6. Kategori" value={survey.kategori} />
                
                {/* Conditional Fields based on survey type */}
                {survey.type === "existing" ? (
                  <>
                    <InfoField label="7. Jenis Existing" value={survey.jenisExisting} />
                    <InfoField label="8. Keterangan Tiang" value={survey.keteranganTiang} />
                    <InfoField label="9. Jenis Titik" value={survey.jenisTitik} />
                    <InfoField label="10. Tinggi APM (m)" value={survey.tinggiAPM} />
                    <InfoField label="11. Tinggi ARM (m)" value={survey.tinggiARM || survey.tinggiArm} />
                    <InfoField label="12. Metode Ukur" value={survey.metodeUkur} />
                    <InfoField label="13. Lebar Jalan (m)" value={survey.lebarJalanDisplay} />
                    <InfoField label="14. Keterangan" value={survey.keterangan} />
                  </>
                ) : survey.type === "propose" ? (
                  <>
                    <InfoField label="7. Status ID Titik" value={survey.statusIDTitik} />
                    <InfoField label="8. ID Titik" value={survey.idTitik} />
                    <InfoField label="9. Daya Lampu (W)" value={survey.dayaLampu} />
                    <InfoField label="10. Data Tiang" value={survey.dataTiang} />
                    <InfoField label="11. Data Ruas" value={survey.dataRuas} />
                    <InfoField label="12. Sub Ruas" value={survey.subRuas} />
                    <InfoField label="13. Jarak Antar Tiang (m)" value={survey.jarakAntarTiang} />
                    <InfoField label="14. Keterangan" value={survey.keterangan} />
                  </>
                ) : (
                  <>
                    <InfoField label="7. Kabupaten" value={survey.kabupatenName || survey.kabupaten} />
                    <InfoField label="8. Kecamatan" value={survey.kecamatan} />
                    <InfoField label="9. Desa" value={survey.desa} />
                    <InfoField label="10. Banjar" value={survey.banjar} />
                    <InfoField label="11. Kepemilikan Tiang" value={survey.kepemilikanDisplay || survey.kepemilikanTiang} />
                    <InfoField label="12. Tipe Tiang PLN" value={survey.tipeTiangPLN} />
                    <InfoField label="13. Jenis Lampu" value={survey.jenisLampu} />
                    <InfoField label="14. Jumlah Lampu" value={survey.jumlahLampu} />
                    <InfoField label="15. Daya Lampu" value={survey.dayaLampu} />
                    <InfoField label="16. Fungsi Lampu" value={survey.fungsiLampu} />
                    <InfoField label="17. Lebar Jalan" value={survey.lebarJalan} />
                    <InfoField label="18. Kondisi" value={survey.kondisi} />
                    <InfoField label="19. Jenis Tiang" value={survey.jenisTiang} />
                    <InfoField label="20. Gardu" value={survey.garduStatus} />
                    <InfoField label="21. Kode Gardu" value={survey.kodeGardu} />
                    <InfoField
                      label="22. Koordinat Final Admin"
                      value={
                        Number.isFinite(survey.adminLatitude) && Number.isFinite(survey.adminLongitude)
                          ? `${survey.adminLatitude?.toFixed(7)}, ${survey.adminLongitude?.toFixed(7)}`
                          : undefined
                      }
                    />
                    <InfoField label="23. Keterangan" value={survey.keterangan} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-all"
            >
              Tutup
            </button>
            <button
              onClick={onEdit}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
            {survey.status !== "ditolak" && (
              <button
                onClick={onTolak}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Tolak
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Info Field Component
function InfoField({ label, value }: { label: string; value: string | number | undefined | null }) {
  return (
    <div className="bg-gray-50 px-4 py-3 rounded-lg border border-gray-200">
      <p className="text-xs font-medium text-gray-600 mb-1">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value || "N/A"}</p>
    </div>
  );
}

// Edit Modal Component
function EditModal({
  survey,
  isSaving,
  onClose,
  onSave,
  onChange
}: {
  survey: Survey;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
  onChange: (survey: Survey) => void;
}) {
  const handleChange = (field: keyof Survey, value: string | number) => {
    onChange({ ...survey, [field]: value });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 lg:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-y-auto my-4">
        {/* Modal Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Edit Survey</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-all">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Map Preview Section */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Preview Lokasi Survey
            </h3>
            <DynamicDetailMap 
              key={`${survey.type === "pra-existing" && Number.isFinite(survey.adminLatitude) ? survey.adminLatitude : survey.latitude}-${survey.type === "pra-existing" && Number.isFinite(survey.adminLongitude) ? survey.adminLongitude : survey.longitude}`}
              latitude={survey.type === "pra-existing" && Number.isFinite(survey.adminLatitude) ? survey.adminLatitude || 0 : survey.latitude} 
              longitude={survey.type === "pra-existing" && Number.isFinite(survey.adminLongitude) ? survey.adminLongitude || 0 : survey.longitude}
              accuracy={survey.accuracy || 0}
              title={survey.title || survey.namaJalan || "Survey Location"}
            />
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="bg-white/70 backdrop-blur px-4 py-3 rounded-lg border border-blue-200">
                <p className="text-gray-700 font-medium mb-1">Latitude</p>
                <p className="font-mono font-bold text-gray-900">{survey.latitude?.toFixed(7) || 'N/A'}</p>
              </div>
              <div className="bg-white/70 backdrop-blur px-4 py-3 rounded-lg border border-blue-200">
                <p className="text-gray-700 font-medium mb-1">Longitude</p>
                <p className="font-mono font-bold text-gray-900">{survey.longitude?.toFixed(7) || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Common Fields */}
            <EditField label="Nama Jalan" value={survey.namaJalan} onChange={(v) => handleChange('namaJalan', v)} />
            <EditField label="Zona" value={survey.zona} onChange={(v) => handleChange('zona', v)} />
            <EditField label="Kategori" value={survey.kategori} onChange={(v) => handleChange('kategori', v)} />
            <EditField label="Latitude" value={survey.latitude?.toString()} onChange={(v) => handleChange('latitude', parseFloat(v) || 0)} type="number" />
            <EditField label="Longitude" value={survey.longitude?.toString()} onChange={(v) => handleChange('longitude', parseFloat(v) || 0)} type="number" />
            
            {/* Conditional Fields */}
            {survey.type === "existing" ? (
              <>
                <EditField label="Jenis Existing" value={survey.jenisExisting} onChange={(v) => handleChange('jenisExisting', v)} />
                <EditField label="Keterangan Tiang" value={survey.keteranganTiang} onChange={(v) => handleChange('keteranganTiang', v)} />
                <EditField label="Jenis Titik" value={survey.jenisTitik} onChange={(v) => handleChange('jenisTitik', v)} />
                <EditField label="Tinggi APM (m)" value={survey.tinggiAPM} onChange={(v) => handleChange('tinggiAPM', v)} />
                <EditField label="Tinggi ARM (m)" value={survey.tinggiARM || survey.tinggiArm} onChange={(v) => handleChange('tinggiARM', v)} />
                <EditField label="Metode Ukur" value={survey.metodeUkur} onChange={(v) => handleChange('metodeUkur', v)} />
              </>
            ) : survey.type === "propose" ? (
              <>
                <EditField label="Status ID Titik" value={survey.statusIDTitik} onChange={(v) => handleChange('statusIDTitik', v)} />
                <EditField label="ID Titik" value={survey.idTitik} onChange={(v) => handleChange('idTitik', v)} />
                <EditField label="Daya Lampu (W)" value={survey.dayaLampu} onChange={(v) => handleChange('dayaLampu', v)} />
                <EditField label="Data Tiang" value={survey.dataTiang} onChange={(v) => handleChange('dataTiang', v)} />
                <EditField label="Data Ruas" value={survey.dataRuas} onChange={(v) => handleChange('dataRuas', v)} />
                <EditField label="Sub Ruas" value={survey.subRuas} onChange={(v) => handleChange('subRuas', v)} />
                <EditField label="Jarak Antar Tiang (m)" value={survey.jarakAntarTiang} onChange={(v) => handleChange('jarakAntarTiang', v)} />
              </>
            ) : (
              <>
                <EditField label="Kabupaten" value={survey.kabupatenName || survey.kabupaten} onChange={(v) => handleChange('kabupatenName', v)} />
                <EditField label="Kecamatan" value={survey.kecamatan} onChange={(v) => handleChange('kecamatan', v)} />
                <EditField label="Desa" value={survey.desa} onChange={(v) => handleChange('desa', v)} />
                <EditField label="Banjar" value={survey.banjar} onChange={(v) => handleChange('banjar', v)} />
                <EditField label="Kepemilikan Tiang" value={survey.kepemilikanDisplay || survey.kepemilikanTiang} onChange={(v) => handleChange('kepemilikanDisplay', v)} />
                <EditField label="Tipe Tiang PLN" value={survey.tipeTiangPLN} onChange={(v) => handleChange('tipeTiangPLN', v)} />
                <EditField label="Jenis Lampu" value={survey.jenisLampu} onChange={(v) => handleChange('jenisLampu', v)} />
                <EditField label="Jumlah Lampu" value={survey.jumlahLampu} onChange={(v) => handleChange('jumlahLampu', v)} />
                <EditField label="Daya Lampu" value={survey.dayaLampu} onChange={(v) => handleChange('dayaLampu', v)} />
                <EditField label="Fungsi Lampu" value={survey.fungsiLampu} onChange={(v) => handleChange('fungsiLampu', v)} />
                <EditField label="Lebar Jalan" value={survey.lebarJalan} onChange={(v) => handleChange('lebarJalan', v)} />
                <EditField label="Kondisi" value={survey.kondisi} onChange={(v) => handleChange('kondisi', v)} />
                <EditField label="Jenis Tiang" value={survey.jenisTiang} onChange={(v) => handleChange('jenisTiang', v)} />
                <EditField label="Gardu" value={survey.garduStatus} onChange={(v) => handleChange('garduStatus', v)} />
                <EditField label="Kode Gardu" value={survey.kodeGardu} onChange={(v) => handleChange('kodeGardu', v)} />
                <EditField label="Koordinat Final Admin Latitude" value={survey.adminLatitude?.toString()} onChange={(v) => handleChange('adminLatitude', parseFloat(v) || 0)} type="number" />
                <EditField label="Koordinat Final Admin Longitude" value={survey.adminLongitude?.toString()} onChange={(v) => handleChange('adminLongitude', parseFloat(v) || 0)} type="number" />
              </>
            )}
            
            <div className="md:col-span-2">
              <EditField label="Keterangan" value={survey.keterangan} onChange={(v) => handleChange('keterangan', v)} multiline />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 rounded-b-2xl flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-all disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Menyimpan...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Simpan Perubahan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Edit Field Component
function EditField({ 
  label, 
  value, 
  onChange, 
  type = "text",
  multiline = false 
}: { 
  label: string; 
  value: string | number | undefined | null; 
  onChange: (value: string) => void;
  type?: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-2">{label}</label>
      {multiline ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
        />
      ) : (
        <input
          type={type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          step={type === "number" ? "0.0000001" : undefined}
        />
      )}
    </div>
  );
}
