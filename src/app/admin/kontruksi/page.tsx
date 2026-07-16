"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import * as XLSX from "xlsx";
import MapsKontruksiValid from "./components/MapsKontruksiValid";
import { getActiveKabupatenFromStorage, setActiveKabupatenToStorage } from "@/utils/helpers";
import { KABUPATEN_OPTIONS } from "@/utils/constants";

type MenuItem = {
  id: string;
  label: string;
  icon: string;
};

type NotifItem = {
  id: string;
  title: string;
  desc: string;
  date: string;
};

type TaskHistoryItem = {
  id: string;
  assigneeName?: string;
  designUploadId?: string;
  zones?: any[];
  status?: string;
  createdAt?: any;
  createdByName?: string;
};

type KontruksiData = {
  id: string;
  namaTitik?: string;
  idTitik?: string;
  zona?: string;
  latitude?: number;
  longitude?: number;
  kontruksiStatus?: string;
  createdAt?: any;
  updatedAt?: any;
  validatedAt?: any;
  submittedByName?: string;
  submittedById?: string;
  stage?: string;
  tahap?: string;
  type?: string;
  kategori?: string;
  [key: string]: any;
};

const KONTRUKSI_STAGE_LABELS: Record<string, string> = {
  "pemasangan-tiang": "Pemasangan Tiang, Arm & Lampu",
  "pemasangan-kabel": "Pemasangan Kabel",
  comissioning: "Comissioning",
  penggalian: "Penggalian",
  pembesian: "Pembesian & Grounding",
  pengecoran: "Pengecoran",
  "uji-beton": "Uji Beton",
};

const KONTRUKSI_STAGE_FIELDS: Record<string, Array<{ key: string; label: string }>> = {
  "pemasangan-tiang": [
    { key: "fotoPerakitanDibawah", label: "Foto Perakitan Di Bawah" },
    { key: "fotoHasilPemasangan", label: "Foto Hasil Pemasangan" },
  ],
  "pemasangan-kabel": [
    { key: "fotoJalurKabel", label: "Foto Jalur Kabel" },
    { key: "fotoInstalasiPerTitik", label: "Foto Instalasi Per Titik" },
  ],
  comissioning: [
    { key: "fotoJalurKabel", label: "Foto Jalur Kabel" },
    { key: "fotoInstalasiPerTitik", label: "Foto Instalasi Per Titik" },
  ],
  penggalian: [
    { key: "kedalamanGalian", label: "Kedalaman Galian" },
    { key: "fotoKedalaman", label: "Foto Kedalaman" },
    { key: "fotoTitikLokasi", label: "Foto Titik Lokasi" },
  ],
  pembesian: [
    { key: "fotoPemasanganBesi", label: "Foto Pemasangan Besi" },
    { key: "fotoGrounding", label: "Foto Grounding" },
  ],
  pengecoran: [
    { key: "fotoUjiSlumpTest", label: "Foto Uji Slump Test" },
    { key: "fotoHasilPengecoran", label: "Foto Hasil Pengecoran" },
  ],
  "uji-beton": [
    { key: "fotoUjiKekuatanBeton", label: "Foto Uji Kekuatan Beton" },
    { key: "fotoTitikLokasi", label: "Foto Titik Lokasi" },
  ],
};

const KONTRUKSI_STAGE_FILTER_OPTIONS = Object.entries(KONTRUKSI_STAGE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function getKontruksiStage(item: KontruksiData) {
  return String(item.stage || item.tahap || item.type || item.kategori || "").trim();
}

function getKontruksiStatus(item: KontruksiData) {
  return String(item.kontruksiStatus || item.status || item.source || "").trim();
}

function getKontruksiStageLabel(item: KontruksiData) {
  const stage = getKontruksiStage(item);
  return KONTRUKSI_STAGE_LABELS[stage] || stage || "Tahap Kontruksi";
}

function getKontruksiStageFields(item: KontruksiData) {
  const stage = getKontruksiStage(item);
  return KONTRUKSI_STAGE_FIELDS[stage] || [];
}

function isPhotoLikeValue(value: unknown) {
  return typeof value === "string" && value.startsWith("http");
}

function getKontruksiPreviewPhoto(item: KontruksiData) {
  const previewField = getKontruksiStageFields(item).find((field) => isPhotoLikeValue(item[field.key]));
  return previewField ? String(item[previewField.key]) : "";
}

function KontruksiPhotoPreview({ item, tone }: { item: KontruksiData; tone: "amber" | "emerald" }) {
  const photoUrl = getKontruksiPreviewPhoto(item);
  if (!photoUrl) return null;

  const borderClass = tone === "emerald" ? "border-emerald-100" : "border-amber-100";
  return (
    <div
      className={`h-20 w-full shrink-0 rounded-2xl border ${borderClass} bg-cover bg-center bg-slate-100 lg:w-28`}
      style={{ backgroundImage: `url("${photoUrl}")` }}
      aria-label="Preview foto konstruksi"
    />
  );
}

const menuItems: MenuItem[] = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "distribusi", label: "Distribusi Pekerjaan", icon: "🧩" },
  { id: "manajemen", label: "Manajemen Pengguna", icon: "👥" },
  { id: "validasi", label: "Validasi Data Kontruksi", icon: "✅" },
  { id: "data-valid", label: "Data Kontruksi Valid", icon: "📊" },
  { id: "maps-valid", label: "Maps Data Valid", icon: "🗺️" },
  { id: "upload-design", label: "Upload Data Design", icon: "📤" },
];

const menuTheme: Record<
  string,
  {
    title: string;
    description: string;
    badge: string;
    panelClass: string;
    accentClass: string;
    glowClass: string;
  }
> = {
  home: {
    title: "Home",
    description: "Pilih fitur yang ingin digunakan untuk operasional modul kontruksi.",
    badge: "Ringkasan Modul",
    panelClass: "from-emerald-600 via-teal-600 to-cyan-600",
    accentClass: "text-emerald-700",
    glowClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  distribusi: {
    title: "Distribusi Pekerjaan",
    description: "Bagikan tugas kontruksi ke petugas lapangan dan pantau histori pembagiannya.",
    badge: "Distribusi Aktif",
    panelClass: "from-sky-600 via-cyan-600 to-blue-600",
    accentClass: "text-sky-700",
    glowClass: "bg-sky-50 text-sky-700 border-sky-200",
  },
  manajemen: {
    title: "Manajemen Pengguna",
    description: "Kelola petugas kontruksi yang terhubung dengan modul ini.",
    badge: "Akses Petugas",
    panelClass: "from-violet-600 via-fuchsia-600 to-purple-600",
    accentClass: "text-violet-700",
    glowClass: "bg-violet-50 text-violet-700 border-violet-200",
  },
  validasi: {
    title: "Validasi Data Kontruksi",
    description: "Periksa kiriman petugas sebelum data resmi masuk ke tahap valid.",
    badge: "Butuh Pemeriksaan",
    panelClass: "from-amber-500 via-orange-500 to-rose-500",
    accentClass: "text-orange-700",
    glowClass: "bg-orange-50 text-orange-700 border-orange-200",
  },
  "data-valid": {
    title: "Data Kontruksi Valid",
    description: "Kumpulan data kontruksi yang sudah lolos validasi dan siap digunakan.",
    badge: "Siap Digunakan",
    panelClass: "from-emerald-500 via-green-500 to-lime-500",
    accentClass: "text-green-700",
    glowClass: "bg-green-50 text-green-700 border-green-200",
  },
  "maps-valid": {
    title: "Maps Data Valid",
    description: "Tinjau hasil validasi melalui tampilan peta agar pembacaan titik lebih cepat.",
    badge: "Peta Operasional",
    panelClass: "from-cyan-600 via-sky-600 to-indigo-600",
    accentClass: "text-cyan-700",
    glowClass: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  "upload-design": {
    title: "Upload Data Design",
    description: "Unggah file design hasil survey agar siap dibagikan ke tim kontruksi.",
    badge: "Sinkron Design",
    panelClass: "from-rose-500 via-pink-500 to-fuchsia-500",
    accentClass: "text-rose-700",
    glowClass: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

export default function AdminKontruksiPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super-admin";
  const [activeKabupaten, setActiveKabupaten] = useState("tabanan");
  const [active, setActive] = useState<MenuItem["id"]>("home");
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [kontruksiUsers, setKontruksiUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAssignUsers, setShowAssignUsers] = useState(false);
  const [designUploads, setDesignUploads] = useState<any[]>([]);
  const [loadingDesigns, setLoadingDesigns] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<any | null>(null);
  const [showDesignPicker, setShowDesignPicker] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState<any | null>(null);
  const [selectedZoneIds, setSelectedZoneIds] = useState<Set<string>>(new Set());
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<TaskHistoryItem[]>([]);
  const [showAddKontruksiUser, setShowAddKontruksiUser] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [userForm, setUserForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
  });
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissions, setSubmissions] = useState<KontruksiData[]>([]);
  const [loadingValid, setLoadingValid] = useState(false);
  const [validItems, setValidItems] = useState<KontruksiData[]>([]);
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailItem, setDetailItem] = useState<KontruksiData | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "admin" && user.role !== "super-admin") {
      router.push("/dashboard-pengukuran");
    }
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    const nextKabupaten = isSuperAdmin
      ? getActiveKabupatenFromStorage(user.uid || "") || "tabanan"
      : user.kabupaten?.trim().toLowerCase() || "tabanan";
    setActiveKabupaten(nextKabupaten);
    setActiveKabupatenToStorage(user.uid || "", nextKabupaten);
  }, [isSuperAdmin, user]);

  const handleKabupatenChange = (kabupaten: string) => {
    if (!isSuperAdmin || !user) return;
    setActiveKabupaten(kabupaten);
    setActiveKabupatenToStorage(user.uid || "", kabupaten);
  };

  useEffect(() => {
    if (active === "manajemen" && kontruksiUsers.length === 0) {
      loadKontruksiUsers();
    }
  }, [active, kontruksiUsers.length]);

  useEffect(() => {
    if (active === "validasi" && submissions.length === 0) {
      loadKontruksiSubmissions();
    }
    if (active === "data-valid" && validItems.length === 0) {
      loadKontruksiValid();
    }
  }, [active, submissions.length, validItems.length]);

  useEffect(() => {
    if (active !== "home") return;
    if (kontruksiUsers.length === 0) {
      loadKontruksiUsers();
    }
    if (submissions.length === 0) {
      loadKontruksiSubmissions();
    }
    if (validItems.length === 0) {
      loadKontruksiValid();
    }
    if (designUploads.length === 0) {
      loadDesignUploads();
    }
    if (historyItems.length === 0) {
      loadHistory();
    }
  }, [active, kontruksiUsers.length, submissions.length, validItems.length, designUploads.length, historyItems.length]);

  const loadKontruksiUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await fetch("/api/admin/kontruksi?resource=users", { cache: "no-store" });
      const payload = (await response.json()) as { users?: any[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal memuat petugas kontruksi.");
      setKontruksiUsers(Array.isArray(payload.users) ? payload.users : []);
    } catch (e) {
      console.error("Failed to load kontruksi users:", e);
      setKontruksiUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadDesignUploads = async () => {
    try {
      setLoadingDesigns(true);
      const response = await fetch("/api/admin/kontruksi?resource=design-uploads", { cache: "no-store" });
      const payload = (await response.json()) as { items?: any[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal memuat design uploads.");
      setDesignUploads(Array.isArray(payload.items) ? payload.items : []);
    } catch (e) {
      console.error("Failed to load design uploads:", e);
      setDesignUploads([]);
    } finally {
      setLoadingDesigns(false);
    }
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await fetch("/api/admin/kontruksi?resource=design-tasks", { cache: "no-store" });
      const payload = (await response.json()) as { items?: TaskHistoryItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal memuat riwayat tugas.");
      setHistoryItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (e) {
      console.error("Failed to load history:", e);
      setHistoryItems([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const formatDate = (value: any) => {
    if (!value) return "-";
    try {
      const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
      if (Number.isNaN(date.getTime())) return "-";
      return date.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "-";
    }
  };

  const getDateValue = (value: any) => {
    if (!value) return 0;
    try {
      const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    } catch {
      return 0;
    }
  };

  const loadKontruksiSubmissions = async () => {
    try {
      setLoadingSubmissions(true);
      const response = await fetch("/api/admin/kontruksi?resource=submissions", { cache: "no-store" });
      const payload = (await response.json()) as { items?: KontruksiData[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal memuat data kontruksi.");
      setSubmissions(Array.isArray(payload.items) ? payload.items : []);
    } catch (e) {
      console.error("Failed to load kontruksi submissions:", e);
      setSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const loadKontruksiValid = async () => {
    try {
      setLoadingValid(true);
      const response = await fetch("/api/admin/kontruksi?resource=valid", { cache: "no-store" });
      const payload = (await response.json()) as { items?: KontruksiData[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal memuat data valid kontruksi.");
      setValidItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (e) {
      console.error("Failed to load kontruksi valid data:", e);
      setValidItems([]);
    } finally {
      setLoadingValid(false);
    }
  };

  const handleValidateSubmission = async (item: KontruksiData) => {
    try {
      setValidatingId(item.id);
      const response = await fetch("/api/admin/kontruksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "validate",
          item,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal memvalidasi data kontruksi.");
      await loadKontruksiSubmissions();
      await loadKontruksiValid();
    } catch (e) {
      console.error("Failed to validate submission:", e);
      alert("Gagal memvalidasi data kontruksi.");
    } finally {
      setValidatingId(null);
    }
  };

  const handleOpenDetail = (item: KontruksiData) => {
    setDetailItem(item);
    setShowDetail(true);
  };

  const handleOpenReject = (item: KontruksiData) => {
    setDetailItem(item);
    setRejectReason("");
    setShowReject(true);
  };

  const handleRejectSubmission = async () => {
    if (!detailItem) return;
    try {
      setRejectingId(detailItem.id);
      const response = await fetch("/api/admin/kontruksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          item: detailItem,
          rejectedById: user?.uid || "",
          rejectedByName: user?.displayName || user?.email || "Admin",
          rejectReason: rejectReason || "-",
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal menolak data kontruksi.");
      setShowReject(false);
      setDetailItem(null);
      await loadKontruksiSubmissions();
    } catch (e) {
      console.error("Failed to reject submission:", e);
      alert("Gagal menolak data kontruksi.");
    } finally {
      setRejectingId(null);
    }
  };

  const parseExcelZones = (rows: Record<string, any>[]) => {
    const zones = rows.map((row, idx) => {
      const keys = Object.keys(row || {});
      const idTitikKey = keys.find((k) => /id.*titik/i.test(k));
      const grupKey = keys.find((k) => /grup|group/i.test(k));
      const firstKey = keys[0];
      const secondKey = keys[1];
      const idTitik = idTitikKey ? row[idTitikKey] : firstKey ? row[firstKey] : "";
      const grup = grupKey ? row[grupKey] : secondKey ? row[secondKey] : "";
      const id = `zone-${idx + 1}`;
      return {
        id,
        idTitik: idTitik ?? "",
        grup: grup ?? "",
        raw: row,
      };
    });
    return zones;
  };

  const handleDesignUpload = async (file: File) => {
    try {
      setUploadStatus("Memproses file...");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      const zones = parseExcelZones(rows);
      const payload = {
        fileName: file.name,
        sheetName,
        uploadedById: user?.uid || "",
        uploadedByName: user?.displayName || user?.email || "Admin",
        createdAt: new Date().toISOString(),
        zones,
      };
      const response = await fetch("/api/admin/kontruksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: "design-upload",
          ...payload,
        }),
      });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error || "Gagal menyimpan design upload.");
      setUploadStatus(`Upload berhasil (${zones.length} zona).`);
      setDesignUploads((prev) => [{ id: result.id, ...payload }, ...prev]);
    } catch (e) {
      console.error("Upload design failed:", e);
      setUploadStatus("Gagal upload. Periksa format Excel.");
    }
  };

  const toggleZone = (zoneId: string) => {
    setSelectedZoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(zoneId)) next.delete(zoneId);
      else next.add(zoneId);
      return next;
    });
  };

  const handleSendTask = async () => {
    if (!selectedAssignee || !selectedDesign) return;
    const zones = (selectedDesign.zones || []).filter((z: any) => selectedZoneIds.has(z.id));
    try {
      const response = await fetch("/api/admin/kontruksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        resource: "design-task",
        assigneeId: selectedAssignee.id,
        assigneeName: selectedAssignee.name || selectedAssignee.displayName || selectedAssignee.username || "",
        designUploadId: selectedDesign.id,
        zones,
        status: "assigned",
        createdAt: new Date().toISOString(),
        createdById: user?.uid || "",
        createdByName: user?.displayName || user?.email || "Admin",
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal mengirim tugas.");
      setShowDesignPicker(false);
      setSelectedAssignee(null);
      setSelectedDesign(null);
      setSelectedZoneIds(new Set());
      alert("Tugas berhasil dikirim.");
    } catch (e) {
      console.error("Failed to send task:", e);
      alert("Gagal mengirim tugas.");
    }
  };

  const handleAddKontruksiUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name || !userForm.username || !userForm.email || !userForm.password) return;
    try {
      setAddingUser(true);
      const response = await fetch("/api/admin/user-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userForm.name,
          username: userForm.username,
          email: userForm.email,
          password: userForm.password,
          role: "petugas-kontruksi",
          kabupaten: activeKabupaten,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Terjadi kesalahan");
      }
      alert("Petugas kontruksi berhasil ditambahkan.");
      setShowAddKontruksiUser(false);
      setUserForm({ name: "", username: "", email: "", password: "" });
      await loadKontruksiUsers();
    } catch (e: unknown) {
      console.error("Failed to add kontruksi user:", e);
      alert(`Gagal menambahkan petugas: ${e instanceof Error ? e.message : "Terjadi kesalahan"}`);
    } finally {
      setAddingUser(false);
    }
  };

  const cards = useMemo(() => menuItems.filter((m) => m.id !== "home"), []);
  const notifItems = useMemo<NotifItem[]>(() => [], []);
  const activeTheme = menuTheme[active] || menuTheme.home;
  const activeMenuLabel = activeTheme.title;
  const activeMenuDescription = activeTheme.description;
  const dashboardMetrics = useMemo(() => {
    const totalPetugas = kontruksiUsers.length;
    const totalMasuk = submissions.length;
    const totalValid = validItems.length;
    const totalDesign = designUploads.length;
    const totalDistribusi = historyItems.length;
    const validationRate = totalMasuk + totalValid > 0 ? Math.round((totalValid / (totalMasuk + totalValid)) * 100) : 0;
    const productivityRate = totalDistribusi > 0 ? Math.min(100, Math.round((totalValid / totalDistribusi) * 100)) : 0;

    return [
      {
        label: "Petugas Aktif",
        value: totalPetugas,
        note: "Pengguna kontruksi yang sudah siap menerima tugas.",
        accent: "from-emerald-500 to-teal-500",
      },
      {
        label: "Data Masuk",
        value: totalMasuk,
        note: "Laporan yang masih menunggu pemeriksaan admin.",
        accent: "from-amber-500 to-orange-500",
      },
      {
        label: "Data Valid",
        value: totalValid,
        note: `Tingkat validasi saat ini ${validationRate}% dari total alur data.`,
        accent: "from-sky-500 to-cyan-500",
      },
      {
        label: "Design Upload",
        value: totalDesign,
        note: `Distribusi aktif ${totalDistribusi} tugas, produktivitas ${productivityRate}%.`,
        accent: "from-fuchsia-500 to-rose-500",
      },
    ];
  }, [kontruksiUsers.length, submissions.length, validItems.length, designUploads.length, historyItems.length]);
  const dashboardOverview = useMemo(() => {
    const totalFlow = submissions.length + validItems.length;
    const validationRate = totalFlow > 0 ? Math.round((validItems.length / totalFlow) * 100) : 0;

    return {
      validationRate,
      totalFlow,
    };
  }, [submissions.length, validItems.length]);
  const zoneStats = useMemo(() => {
    const source = [...submissions, ...validItems];
    const counts = new Map<string, number>();

    source.forEach((item) => {
      const zoneName = item.zona?.trim() || "Tanpa Zona";
      counts.set(zoneName, (counts.get(zoneName) || 0) + 1);
    });

    const items = Array.from(counts.entries())
      .map(([zone, total]) => ({ zone, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const maxTotal = items[0]?.total || 1;
    return items.map((item) => ({
      ...item,
      width: `${Math.max(18, Math.round((item.total / maxTotal) * 100))}%`,
    }));
  }, [submissions, validItems]);
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((item) => {
      const stageMatch = stageFilter === "all" || getKontruksiStage(item) === stageFilter;
      const statusMatch = statusFilter === "all" || getKontruksiStatus(item) === statusFilter;
      return stageMatch && statusMatch;
    });
  }, [stageFilter, statusFilter, submissions]);
  const filteredValidItems = useMemo(() => {
    return validItems.filter((item) => {
      const stageMatch = stageFilter === "all" || getKontruksiStage(item) === stageFilter;
      const statusMatch = statusFilter === "all" || getKontruksiStatus(item) === statusFilter;
      return stageMatch && statusMatch;
    });
  }, [stageFilter, statusFilter, validItems]);
  const dashboardTimeline = useMemo(() => {
    const designEvents = designUploads.map((item: any) => ({
      id: `design-${item.id}`,
      title: item.fileName || "Upload design baru",
      subtitle: `Design diunggah oleh ${item.uploadedByName || "Admin"}`,
      time: formatDate(item.createdAt),
      sortTime: getDateValue(item.createdAt),
      tone: "bg-rose-100 text-rose-700",
    }));
    const validEvents = validItems.map((item) => ({
      id: `valid-${item.id}`,
      title: item.namaTitik || item.idTitik || "Data valid",
      subtitle: `Titik ${item.idTitik || "-"} siap dipakai di peta`,
      time: formatDate(item.validatedAt),
      sortTime: getDateValue(item.validatedAt),
      tone: "bg-emerald-100 text-emerald-700",
    }));
    const taskEvents = historyItems.map((item) => ({
      id: `task-${item.id}`,
      title: item.assigneeName || "Distribusi tugas",
      subtitle: `Pembagian ${item.zones?.length || 0} zona ke petugas`,
      time: formatDate(item.createdAt),
      sortTime: getDateValue(item.createdAt),
      tone: "bg-sky-100 text-sky-700",
    }));

    return [...designEvents, ...validEvents, ...taskEvents]
      .sort((a, b) => b.sortTime - a.sortTime)
      .slice(0, 5);
  }, [designUploads, validItems, historyItems]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_24%),linear-gradient(180deg,_#f7fffc_0%,_#f8fafc_48%,_#fff7ed_100%)]">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 border-b border-emerald-100/80 bg-white/90 backdrop-blur-md">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push("/admin/module-selection")}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700 transition-all hover:-translate-x-0.5 hover:bg-emerald-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">Dashboard</div>
                  <div className="text-lg font-bold text-slate-900">Gesa Kontruksi</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {isSuperAdmin ? (
                      <div className="flex flex-wrap items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 p-1">
                        <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Kabupaten</span>
                        {KABUPATEN_OPTIONS.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleKabupatenChange(item.id)}
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                              activeKabupaten === item.id
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "text-emerald-700 hover:bg-white"
                            }`}
                          >
                            {item.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        Kabupaten aktif: {activeKabupaten} - dikunci dari akun user
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="hidden flex-1 md:flex justify-center px-4">
                <div className="relative w-full max-w-2xl">
                  <svg className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    placeholder="Cari menu, petugas, atau data kontruksi..."
                    className="w-full rounded-full border border-emerald-100 bg-emerald-50/70 py-3 pl-11 pr-4 text-sm text-slate-700 shadow-inner outline-none transition-all placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowNotif(true)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-100 bg-white text-slate-600 transition-all hover:bg-emerald-50"
                  aria-label="Notifikasi"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0h6z" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowProfile(true)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-emerald-100 bg-gradient-to-br from-emerald-500 to-teal-600 font-bold text-white shadow-sm"
                  aria-label="Profil"
                >
                  {(user?.displayName || "A").charAt(0).toUpperCase()}
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
            {/* Sidebar */}
            <aside className="rounded-[28px] border border-emerald-100/80 bg-white/90 p-4 shadow-[0_18px_60px_-28px_rgba(15,23,42,0.2)] backdrop-blur xl:sticky xl:top-24">
              <div className="mb-4 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 p-4 text-white shadow-lg">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100">Menu Modul</div>
                <div className="mt-2 text-lg font-bold">Panel Kontruksi</div>
                <div className="mt-1 text-sm text-emerald-50/90">
                  Pusat distribusi pekerjaan, validasi data, dan pengelolaan design untuk operasional kontruksi.
                </div>
              </div>
              <div className="space-y-2">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActive(item.id)}
                    className={`w-full flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-semibold transition-all ${
                      active === item.id
                        ? "border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 text-emerald-700 shadow-sm"
                        : "border-transparent bg-white text-slate-600 hover:border-emerald-100 hover:bg-emerald-50/70"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${
                        active === item.id ? "bg-white text-emerald-700 shadow-sm" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <div className="min-w-0 text-left">
                      <div className="truncate">{item.label}</div>
                      <div className="text-xs font-medium text-slate-400">
                        {menuTheme[item.id]?.badge || "Fitur"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            {/* Content */}
            <section className="min-w-0 rounded-[32px] border border-emerald-100/80 bg-white/90 p-5 lg:p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.24)] backdrop-blur">
              <div className={`relative overflow-hidden rounded-[28px] bg-gradient-to-r ${activeTheme.panelClass} p-5 lg:p-6 text-white shadow-lg`}>
                <div className="absolute inset-y-0 right-0 w-56 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.28),_transparent_62%)]" />
                <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/90">
                      {activeTheme.badge}
                    </div>
                    <h2 className="mt-4 text-3xl font-bold tracking-tight">{activeMenuLabel}</h2>
                    <p className="mt-2 max-w-xl text-sm text-white/88">{activeMenuDescription}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:min-w-[280px] lg:min-w-[320px]">
                    <div className="rounded-2xl border border-white/20 bg-white/12 p-4 backdrop-blur">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Mode</div>
                      <div className="mt-2 text-lg font-bold">Admin Kontruksi</div>
                    </div>
                    <div className="rounded-2xl border border-white/20 bg-white/12 p-4 backdrop-blur">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Fokus</div>
                      <div className="mt-2 text-lg font-bold">Operasional Kontruksi</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4 mt-5 flex flex-col gap-3 border-b border-emerald-100 pb-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className={`text-xl font-bold ${activeTheme.accentClass}`}>{activeMenuLabel}</h3>
                  <p className="mt-1 text-sm text-slate-500">{activeMenuDescription}</p>
                </div>
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${activeTheme.glowClass}`}>
                  Status panel: {activeTheme.badge}
                </span>
              </div>

              {active === "distribusi" ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <button
                    onClick={async () => {
                      setShowHistory(true);
                      if (historyItems.length === 0) await loadHistory();
                    }}
                    className="group rounded-[24px] border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/40 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_18px_40px_-24px_rgba(16,185,129,0.35)]"
                  >
                    <div className="text-3xl mb-2">🗓️</div>
                    <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-700">
                      Riwayat Tugas Kontruksi
                    </div>
                    <div className="mt-2 text-xs leading-5 text-slate-500">
                      Pantau histori pembagian tugas dan aktivitas pengiriman pekerjaan lapangan.
                    </div>
                  </button>
                  <button
                    onClick={async () => {
                      setShowAssignUsers(true);
                      if (kontruksiUsers.length === 0) await loadKontruksiUsers();
                    }}
                    className="group rounded-[24px] border border-emerald-100 bg-gradient-to-br from-white to-cyan-50/40 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_18px_40px_-24px_rgba(6,182,212,0.28)]"
                  >
                    <div className="text-3xl mb-2">📝</div>
                    <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-700">
                      Bagikan Tugas Kontruksi
                    </div>
                    <div className="mt-2 text-xs leading-5 text-slate-500">
                      Atur pembagian kerja ke petugas kontruksi secara lebih cepat dari satu panel.
                    </div>
                  </button>
                </div>
              ) : active === "manajemen" ? (
                <div className="space-y-5">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="text-xs text-gray-500">
                      Hanya menampilkan dan menambah pengguna dengan role petugas kontruksi.
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          await loadKontruksiUsers();
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50"
                      >
                        Muat Ulang
                      </button>
                      <button
                        onClick={() => setShowAddKontruksiUser(true)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Tambah Petugas Kontruksi
                      </button>
                    </div>
                  </div>

                  {loadingUsers ? (
                    <div className="text-sm text-gray-500">Memuat daftar petugas kontruksi...</div>
                  ) : kontruksiUsers.length === 0 ? (
                    <div className="rounded-[24px] border-2 border-dashed border-emerald-100 bg-emerald-50/30 p-12 text-center">
                      <div className="text-sm font-semibold text-gray-600">Belum ada petugas kontruksi</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Tambahkan petugas kontruksi untuk mengelola tugas di modul ini.
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                      {kontruksiUsers.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between gap-3 rounded-[22px] border border-emerald-100 bg-white p-4 shadow-sm"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-gray-900 truncate">
                              {u.name || u.username || u.displayName || u.email || "Petugas"}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              @{u.username || "-"} â€¢ {u.email || "-"}
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                            Petugas Kontruksi
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : active === "validasi" ? (
                <div className="space-y-5">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="text-xs text-gray-500">
                      Data dari petugas akan masuk ke sini untuk divalidasi sebelum menjadi data valid.
                    </div>
                    <button
                      onClick={async () => {
                        await loadKontruksiSubmissions();
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50"
                    >
                      Muat Ulang
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 rounded-[22px] border border-amber-100 bg-amber-50/40 p-4 md:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">Filter Tahap</label>
                      <select
                        value={stageFilter}
                        onChange={(event) => setStageFilter(event.target.value)}
                        className="w-full rounded-xl border border-amber-100 bg-white px-3 py-2 text-sm outline-none focus:border-amber-300"
                      >
                        <option value="all">Semua tahap</option>
                        {KONTRUKSI_STAGE_FILTER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">Filter Status</label>
                      <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className="w-full rounded-xl border border-amber-100 bg-white px-3 py-2 text-sm outline-none focus:border-amber-300"
                      >
                        <option value="all">Semua status</option>
                        <option value="submitted">Perlu validasi</option>
                        <option value="valid">Valid</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <div className="w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                        Tampil {filteredSubmissions.length} dari {submissions.length} data
                      </div>
                    </div>
                  </div>

                  {loadingSubmissions ? (
                    <div className="text-sm text-gray-500">Memuat data kontruksi...</div>
                  ) : submissions.length === 0 ? (
                    <div className="rounded-[24px] border-2 border-dashed border-amber-100 bg-amber-50/30 p-12 text-center">
                      <div className="text-sm font-semibold text-gray-600">Belum ada data kontruksi masuk</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Data akan muncul setelah petugas mengirim laporan kontruksi.
                      </div>
                    </div>
                  ) : filteredSubmissions.length === 0 ? (
                    <div className="rounded-[24px] border-2 border-dashed border-amber-100 bg-white p-12 text-center">
                      <div className="text-sm font-semibold text-gray-600">Tidak ada data sesuai filter</div>
                      <div className="text-xs text-gray-500 mt-1">Ubah filter tahap atau status untuk melihat data lain.</div>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {filteredSubmissions.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between"
                        >
                          <KontruksiPhotoPreview item={item} tone="amber" />
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-gray-900 truncate">
                              {item.namaTitik || item.idTitik || "Titik Kontruksi"}
                            </div>
                            <div className="text-xs text-gray-500">
                              ID Titik: {item.idTitik || "-"} â€¢ Zona: {item.zona || "-"}
                            </div>
                            <div className="text-xs text-gray-400">
                              Dikirim oleh {item.submittedByName || "Petugas"} â€¢{" "}
                              {formatDate(item.createdAt)}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                {getKontruksiStageLabel(item)}
                              </span>
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                {getKontruksiStatus(item) || "submitted"}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
                              Perlu Validasi
                            </span>
                            <button
                              onClick={() => handleOpenDetail(item)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50"
                            >
                              Detail
                            </button>
                            <button
                              onClick={() => handleOpenReject(item)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-700 hover:bg-red-50"
                            >
                              Tolak
                            </button>
                            <button
                              onClick={() => handleValidateSubmission(item)}
                              disabled={validatingId === item.id}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                                validatingId === item.id
                                  ? "bg-gray-200 text-gray-500"
                                  : "bg-green-600 text-white hover:bg-green-700"
                              }`}
                            >
                              {validatingId === item.id ? "Memvalidasi..." : "Validasi"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : active === "data-valid" ? (
                <div className="space-y-5">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="text-xs text-gray-500">
                      Data kontruksi yang sudah valid dan siap digunakan di peta.
                    </div>
                    <button
                      onClick={async () => {
                        await loadKontruksiValid();
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50"
                    >
                      Muat Ulang
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 rounded-[22px] border border-emerald-100 bg-emerald-50/40 p-4 md:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Filter Tahap</label>
                      <select
                        value={stageFilter}
                        onChange={(event) => setStageFilter(event.target.value)}
                        className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300"
                      >
                        <option value="all">Semua tahap</option>
                        {KONTRUKSI_STAGE_FILTER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Filter Status</label>
                      <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300"
                      >
                        <option value="all">Semua status</option>
                        <option value="submitted">Perlu validasi</option>
                        <option value="valid">Valid</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <div className="w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                        Tampil {filteredValidItems.length} dari {validItems.length} data
                      </div>
                    </div>
                  </div>

                  {loadingValid ? (
                    <div className="text-sm text-gray-500">Memuat data valid...</div>
                  ) : validItems.length === 0 ? (
                    <div className="rounded-[24px] border-2 border-dashed border-green-100 bg-green-50/30 p-12 text-center">
                      <div className="text-sm font-semibold text-gray-600">Belum ada data kontruksi valid</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Data valid akan muncul setelah proses validasi selesai.
                      </div>
                    </div>
                  ) : filteredValidItems.length === 0 ? (
                    <div className="rounded-[24px] border-2 border-dashed border-green-100 bg-white p-12 text-center">
                      <div className="text-sm font-semibold text-gray-600">Tidak ada data sesuai filter</div>
                      <div className="text-xs text-gray-500 mt-1">Ubah filter tahap atau status untuk melihat data lain.</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                      {filteredValidItems.map((item) => (
                        <div key={item.id} className="rounded-[22px] border border-emerald-100 bg-white p-5 shadow-sm">
                          <KontruksiPhotoPreview item={item} tone="emerald" />
                          <div className="text-sm font-bold text-gray-900 truncate">
                            {item.namaTitik || item.idTitik || "Titik Kontruksi"}
                          </div>
                          <div className="text-xs text-gray-500">
                            ID Titik: {item.idTitik || "-"} â€¢ Zona: {item.zona || "-"}
                          </div>
                          <div className="text-xs text-gray-500">
                            Koordinat: {item.latitude ?? "-"}, {item.longitude ?? "-"}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Validasi: {formatDate(item.validatedAt)}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                              {getKontruksiStageLabel(item)}
                            </span>
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                              {getKontruksiStatus(item) || "valid"}
                            </span>
                          </div>
                          <div className="mt-3">
                            <button
                              onClick={() => handleOpenDetail(item)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50"
                            >
                              Detail
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : active === "maps-valid" ? (
                <MapsKontruksiValid />
              ) : active === "upload-design" ? (
                <div className="rounded-[28px] border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-orange-50 p-6 shadow-sm">
                  <div className="mb-2 text-base font-bold text-slate-900">Upload Data Design</div>
                  <div className="mb-5 max-w-2xl text-sm text-slate-600">
                    Unggah file design final agar siap dipakai tim kontruksi sebagai acuan pekerjaan lapangan.
                  </div>
                  <label className="block">
                    <input
                      type="file"
                      className="hidden"
                      accept=".xlsx,.xls"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleDesignUpload(file);
                        e.currentTarget.value = "";
                      }}
                    />
                    <div className="cursor-pointer rounded-[24px] border-2 border-dashed border-rose-200 bg-white p-10 text-center transition-all hover:bg-rose-50/60">
                      <div className="text-3xl mb-2">📤</div>
                      <div className="text-sm font-semibold text-slate-900">Klik untuk upload file design</div>
                      <div className="mt-1 text-xs text-slate-500">Format XLSX atau XLS</div>
                    </div>
                  </label>
                  <div className="mt-4 text-xs text-slate-500">
                    Status: {uploadStatus || "Belum ada file diupload."}
                  </div>
                </div>
              ) : (
                <div className="space-y-5 xl:space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4 xl:grid-cols-2">
                    {dashboardMetrics.map((metric) => (
                      <div
                        key={metric.label}
                        className="relative overflow-hidden rounded-[26px] border border-emerald-100 bg-white p-5 shadow-sm"
                      >
                        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${metric.accent}`} />
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{metric.label}</div>
                        <div className="mt-3 text-4xl font-bold tracking-tight text-slate-900">{metric.value}</div>
                        <div className="mt-2 max-w-xs text-sm leading-6 text-slate-500">{metric.note}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1.5fr_1fr]">
                    <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,_rgba(236,253,245,0.95),_rgba(255,255,255,0.98)_52%,_rgba(224,242,254,0.9))] p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.28)]">
                      <div className="flex flex-col gap-3 border-b border-emerald-100 pb-4 md:flex-row md:items-end md:justify-between">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Report Operasional</div>
                          <div className="mt-2 text-2xl font-bold text-slate-900">Statistik kerja tim kontruksi</div>
                          <div className="mt-1 text-sm text-slate-500">Ringkasan validasi, distribusi, dan persebaran data untuk monitoring harian.</div>
                        </div>
                        <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white/80 px-4 py-3">
                          <div
                            className="h-16 w-16 rounded-full"
                            style={{
                              background: `conic-gradient(#10b981 ${dashboardOverview.validationRate}% , rgba(16,185,129,0.12) 0)`,
                            }}
                          >
                            <div className="flex h-full w-full items-center justify-center rounded-full border-4 border-white bg-white text-sm font-bold text-emerald-700">
                              {dashboardOverview.validationRate}%
                            </div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Data Valid</div>
                            <div className="mt-1 text-lg font-bold text-slate-900">{dashboardMetrics[2]?.note}</div>
                            <div className="mt-1 text-xs text-slate-500">Total alur terpantau {dashboardOverview.totalFlow} item.</div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                        <div className="rounded-[24px] border border-white/80 bg-white/85 p-5 shadow-sm">
                          <div className="text-sm font-bold text-slate-900">Distribusi data per zona</div>
                          <div className="mt-1 text-xs text-slate-500">Zona dengan volume item kontruksi tertinggi saat ini.</div>
                          <div className="mt-5 space-y-4">
                            {zoneStats.length > 0 ? (
                              zoneStats.map((item) => (
                                <div key={item.zone}>
                                  <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                                    <span className="font-semibold text-slate-700">{item.zone}</span>
                                    <span className="text-slate-500">{item.total} titik</span>
                                  </div>
                                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"
                                      style={{ width: item.width }}
                                    />
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-2xl border border-dashed border-emerald-100 bg-emerald-50/40 p-8 text-sm text-slate-500">
                                Belum ada data zona untuk divisualkan.
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-white/80 bg-slate-950 p-5 text-white shadow-sm">
                          <div className="text-sm font-bold">Pipeline Operasional</div>
                          <div className="mt-1 text-xs text-slate-300">Alur kerja dari design sampai data siap dipakai.</div>
                          <div className="mt-5 space-y-4">
                            <div className="rounded-2xl bg-white/8 p-4">
                              <div className="flex items-center justify-between text-sm">
                                <span>Design Tersedia</span>
                                <span className="font-bold">{designUploads.length}</span>
                              </div>
                              <div className="mt-3 h-2 rounded-full bg-white/10">
                                <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-orange-300" style={{ width: `${Math.min(100, Math.max(14, designUploads.length * 12))}%` }} />
                              </div>
                            </div>
                            <div className="rounded-2xl bg-white/8 p-4">
                              <div className="flex items-center justify-between text-sm">
                                <span>Distribusi Tugas</span>
                                <span className="font-bold">{historyItems.length}</span>
                              </div>
                              <div className="mt-3 h-2 rounded-full bg-white/10">
                                <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-300" style={{ width: `${Math.min(100, Math.max(14, historyItems.length * 10))}%` }} />
                              </div>
                            </div>
                            <div className="rounded-2xl bg-white/8 p-4">
                              <div className="flex items-center justify-between text-sm">
                                <span>Validasi Selesai</span>
                                <span className="font-bold">{validItems.length}</span>
                              </div>
                              <div className="mt-3 h-2 rounded-full bg-white/10">
                                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-300" style={{ width: `${Math.min(100, Math.max(14, validItems.length * 10))}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.28)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Aktivitas Terkini</div>
                          <div className="mt-2 text-2xl font-bold text-slate-900">Update lapangan terbaru</div>
                        </div>
                        <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                          Live
                        </div>
                      </div>
                      <div className="mt-5 space-y-3">
                        {dashboardTimeline.length > 0 ? (
                          dashboardTimeline.map((event) => (
                            <div key={event.id} className="flex gap-3 rounded-[22px] border border-slate-100 bg-slate-50/80 p-4">
                              <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-bold ${event.tone}`}>
                                ●
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-slate-900">{event.title}</div>
                                <div className="mt-1 text-sm leading-6 text-slate-500">{event.subtitle}</div>
                                <div className="mt-2 text-xs font-medium text-slate-400">{event.time}</div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">
                            Aktivitas terbaru akan muncul setelah ada upload, distribusi, atau validasi data.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </section>
          </div>
        </main>

        {/* Notifikasi Panel */}
        {showNotif && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-2xl overflow-hidden border border-gray-200 shadow-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowNotif(false)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </button>
                  <div>
                    <div className="text-sm text-gray-500">Dashboard</div>
                    <div className="text-lg font-bold text-gray-900">Notifikasi</div>
                  </div>
                </div>
                <div className="hidden md:block text-sm text-gray-400">Search...</div>
              </div>

              <div className="p-4">
                {notifItems.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center">
                    <div className="text-sm font-semibold text-gray-600">Tidak ada notifikasi</div>
                    <div className="text-xs text-gray-500 mt-1">Semua notifikasi akan muncul di sini.</div>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {notifItems.map((n) => (
                      <div key={n.id} className="border border-gray-200 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-gray-900">{n.title}</div>
                          <div className="text-xs text-gray-500">{n.desc}</div>
                        </div>
                        <div className="text-xs text-gray-400">{n.date}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Riwayat Tugas Kontruksi */}
        {showHistory && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-5xl rounded-2xl overflow-hidden border border-gray-200 shadow-xl">
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowHistory(false)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </button>
                  <div>
                    <div className="text-sm text-gray-500">Distribusi Pekerjaan</div>
                    <div className="text-lg font-bold text-gray-900">Riwayat Tugas Kontruksi</div>
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-2 text-xs text-gray-500">
                  <span className="px-2 py-1 rounded-full border border-gray-200">Assigned</span>
                  <span className="px-2 py-1 rounded-full border border-gray-200">In Progress</span>
                  <span className="px-2 py-1 rounded-full border border-gray-200">Done</span>
                </div>
              </div>

              <div className="p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                  <div className="text-xs text-gray-500">
                    Riwayat ini berisi semua tugas yang pernah dibagikan admin ke petugas.
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        await loadHistory();
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50"
                    >
                      Muat Ulang
                    </button>
                    <button
                      onClick={async () => {
                        setShowHistory(false);
                        setActive("distribusi");
                        setShowAssignUsers(true);
                        if (kontruksiUsers.length === 0) await loadKontruksiUsers();
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Bagikan Tugas Baru
                    </button>
                  </div>
                </div>

                {loadingHistory ? (
                  <div className="text-sm text-gray-500">Memuat riwayat...</div>
                ) : historyItems.length === 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
                    <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center">
                      <div className="text-sm font-semibold text-gray-600">Belum ada riwayat tugas</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Tugas akan muncul setelah admin membagikan tugas ke petugas.
                      </div>
                    </div>
                    <div className="border border-gray-200 rounded-2xl p-5 bg-gradient-to-br from-gray-50 to-white">
                      <div className="text-sm font-bold text-gray-900 mb-3">Alur Riwayat Tugas</div>
                      <div className="space-y-3 text-xs text-gray-600">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-semibold">1</div>
                          <div>Admin upload data design dan pilih petugas kontruksi.</div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-semibold">2</div>
                          <div>Admin memilih zona yang akan dikerjakan, lalu kirim tugas.</div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-semibold">3</div>
                          <div>Petugas mengerjakan dan mengubah status tugas.</div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-semibold">4</div>
                          <div>Riwayat akan muncul di sini untuk monitoring.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {historyItems.map((item) => (
                      <div
                        key={item.id}
                        className="border border-gray-200 rounded-xl p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-900 truncate">
                            {item.assigneeName || "Petugas"}
                          </div>
                          <div className="text-xs text-gray-500">
                            Design: {item.designUploadId || "-"} â€¢ Zona: {item.zones?.length || 0}
                          </div>
                          <div className="text-xs text-gray-400">
                            Dibuat oleh {item.createdByName || "Admin"} â€¢ {formatDate(item.createdAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                            {item.status || "assigned"}
                          </span>
                          <button className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50">
                            Detail
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tambah Petugas Kontruksi */}
        {showAddKontruksiUser && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-xl rounded-2xl overflow-hidden border border-gray-200 shadow-xl">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
                <button
                  onClick={() => setShowAddKontruksiUser(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <div>
                  <div className="text-sm text-gray-500">Manajemen Pengguna</div>
                  <div className="text-lg font-bold text-gray-900">Tambah Petugas Kontruksi</div>
                </div>
              </div>

              <form onSubmit={handleAddKontruksiUser} className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Nama</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Masukkan nama"
                      value={userForm.name}
                      onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Username</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Masukkan username"
                      value={userForm.username}
                      onChange={(e) => setUserForm((prev) => ({ ...prev, username: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Email</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Masukkan email"
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Kata Sandi</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Masukkan kata sandi"
                      type="password"
                      value={userForm.password}
                      onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">Role akan otomatis: petugas kontruksi</div>
                  <button
                    type="submit"
                    disabled={addingUser}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                      addingUser ? "bg-gray-200 text-gray-500" : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {addingUser ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Detail Kontruksi */}
        {showDetail && detailItem && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl overflow-hidden border border-gray-200 shadow-xl">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
                <button
                  onClick={() => setShowDetail(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <div>
                  <div className="text-sm text-gray-500">Detail Kontruksi</div>
                  <div className="text-lg font-bold text-gray-900">
                    {detailItem.namaTitik || detailItem.idTitik || "Titik Kontruksi"}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-emerald-700">{getKontruksiStageLabel(detailItem)}</div>
                </div>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-gray-500">ID Titik</div>
                  <div className="font-semibold text-gray-900">{detailItem.idTitik || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Zona</div>
                  <div className="font-semibold text-gray-900">{detailItem.zona || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Latitude</div>
                  <div className="font-semibold text-gray-900">{detailItem.latitude ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Longitude</div>
                  <div className="font-semibold text-gray-900">{detailItem.longitude ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Status Kontruksi</div>
                  <div className="font-semibold text-gray-900">{detailItem.kontruksiStatus || "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Dibuat</div>
                  <div className="font-semibold text-gray-900">{formatDate(detailItem.createdAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Diupdate</div>
                  <div className="font-semibold text-gray-900">{formatDate(detailItem.updatedAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Validasi</div>
                  <div className="font-semibold text-gray-900">{formatDate(detailItem.validatedAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Pengirim</div>
                  <div className="font-semibold text-gray-900">{detailItem.submittedByName || "-"}</div>
                </div>
              </div>
              <div className="border-t border-gray-100 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Data Tahap</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {getKontruksiStageFields(detailItem).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                      Belum ada field khusus untuk tahap ini.
                    </div>
                  ) : (
                    getKontruksiStageFields(detailItem).map((field) => {
                      const value = detailItem[field.key];
                      const nameValue = detailItem[`${field.key}Name`];
                      return (
                        <div key={field.key} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                          <div className="text-xs text-gray-500">{field.label}</div>
                          {isPhotoLikeValue(value) ? (
                            <div className="mt-2 space-y-2">
                              <a href={value} target="_blank" rel="noreferrer" className="inline-flex rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                                Buka Foto
                              </a>
                              <div className="truncate text-xs text-gray-500">{nameValue || value}</div>
                            </div>
                          ) : (
                            <div className="mt-1 font-semibold text-gray-900">{value || "-"}</div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tolak Kontruksi */}
        {showReject && detailItem && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-xl rounded-2xl overflow-hidden border border-gray-200 shadow-xl">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
                <button
                  onClick={() => setShowReject(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <div>
                  <div className="text-sm text-gray-500">Tolak Data Kontruksi</div>
                  <div className="text-lg font-bold text-gray-900">
                    {detailItem.namaTitik || detailItem.idTitik || "Titik Kontruksi"}
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="text-xs text-gray-500">
                  Data akan dipindahkan ke koleksi <span className="font-semibold">kontruksi-rejected</span>.
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">Alasan Penolakan</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[90px]"
                    placeholder="Masukkan alasan (opsional)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setShowReject(false)}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleRejectSubmission}
                    disabled={rejectingId === detailItem.id}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                      rejectingId === detailItem.id ? "bg-gray-200 text-gray-500" : "bg-red-600 text-white hover:bg-red-700"
                    }`}
                  >
                    {rejectingId === detailItem.id ? "Memproses..." : "Tolak"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Profile Panel */}
        {showProfile && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl overflow-hidden border border-gray-200 shadow-xl">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
                <button
                  onClick={() => setShowProfile(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <div>
                  <div className="text-sm text-gray-500">Dashboard</div>
                  <div className="text-lg font-bold text-gray-900">Foto Profil</div>
                </div>
              </div>

              <div className="p-6 flex flex-col items-center gap-4">
                <div className="w-28 h-28 rounded-full border-4 border-gray-200 bg-gray-100 flex items-center justify-center text-3xl font-bold text-gray-700">
                  {(user?.displayName || user?.email || "A").charAt(0).toUpperCase()}
                </div>
                <div className="text-center">
                  <div className="text-base font-bold text-gray-900">{user?.displayName || "Admin"}</div>
                  <div className="text-xs text-gray-500">{user?.email || "-"}</div>
                </div>
                <button className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50">
                  Edit Foto Profil
                </button>
                <button
                  onClick={() => {
                    setShowProfile(false);
                    setShowAccount(true);
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold hover:bg-gray-50"
                >
                  Kelola Akun
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Account Panel */}
        {showAccount && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-3xl rounded-2xl overflow-hidden border border-gray-200 shadow-xl">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
                <button
                  onClick={() => setShowAccount(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <div>
                  <div className="text-sm text-gray-500">Dashboard</div>
                  <div className="text-lg font-bold text-gray-900">Kelola Akun</div>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Username</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Masukkan user"
                      defaultValue={user?.username || ""}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Email</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Masukkan email"
                      defaultValue={user?.email || ""}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Nama</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Masukkan nama"
                      defaultValue={user?.displayName || user?.name || ""}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Kata Sandi Baru</label>
                    <input type="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Masukkan kata sandi baru" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Konfirmasi Kata Sandi</label>
                    <input type="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Masukkan ulang kata sandi" />
                  </div>
                </div>
                <div className="mt-6">
                  <button className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Assign Task: Pick Kontruksi User */}
        {showAssignUsers && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-xl rounded-2xl overflow-hidden border border-gray-200 shadow-xl">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
                <button
                  onClick={() => setShowAssignUsers(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <div>
                  <div className="text-sm text-gray-500">Pilih Petugas Kontruksi</div>
                  <div className="text-lg font-bold text-gray-900">Bagikan Tugas</div>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {loadingUsers ? (
                  <div className="text-sm text-gray-500">Memuat daftar petugas...</div>
                ) : kontruksiUsers.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
                    <div className="text-sm font-semibold text-gray-600">Belum ada petugas kontruksi</div>
                    <div className="text-xs text-gray-500 mt-1">Tambahkan petugas terlebih dahulu.</div>
                  </div>
                ) : (
                  kontruksiUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={async () => {
                        setSelectedAssignee(u);
                        setShowAssignUsers(false);
                        setShowDesignPicker(true);
                        if (designUploads.length === 0) await loadDesignUploads();
                      }}
                      className="w-full flex items-center justify-between gap-3 border border-gray-200 rounded-xl px-3 py-2.5 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
                          Foto
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="text-sm font-bold text-gray-900 truncate">
                            {u.username || u.name || u.displayName || u.email || "Username"}
                          </div>
                          <div className="text-xs text-gray-500">{u.role || "Role"}</div>
                        </div>
                      </div>
                      <div className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Design Picker */}
        {showDesignPicker && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-3xl rounded-2xl overflow-hidden border border-gray-200 shadow-xl">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
                <button
                  onClick={() => setShowDesignPicker(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <div>
                  <div className="text-sm text-gray-500">Pilih Data Survey</div>
                  <div className="text-lg font-bold text-gray-900">Data Design</div>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {loadingDesigns ? (
                  <div className="text-sm text-gray-500">Memuat data design...</div>
                ) : designUploads.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
                    <div className="text-sm font-semibold text-gray-600">Belum ada data design</div>
                    <div className="text-xs text-gray-500 mt-1">Upload data design terlebih dahulu.</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {designUploads.map((d: any) => (
                        <button
                          key={d.id}
                          onClick={() => {
                            setSelectedDesign(d);
                            setSelectedZoneIds(new Set());
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                            selectedDesign?.id === d.id
                              ? "bg-red-50 border-red-200 text-red-700"
                              : "bg-white border-gray-200 text-gray-700"
                          }`}
                        >
                          {d.fileName || d.id}
                        </button>
                      ))}
                    </div>

                    {selectedDesign ? (
                      <div className="border border-gray-200 rounded-xl p-3">
                        <div className="text-xs text-gray-500 mb-2">
                          {selectedDesign.fileName} • {selectedDesign.zones?.length || 0} zona
                        </div>
                        <div className="space-y-2 max-h-[360px] overflow-y-auto">
                          {(selectedDesign.zones || []).map((z: any) => (
                            <div
                              key={z.id}
                              className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg px-3 py-2"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900 truncate">
                                  {z.idTitik || "Id Titik"}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                  {z.grup || "Grup"}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleZone(z.id)}
                                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs ${
                                    selectedZoneIds.has(z.id)
                                      ? "bg-green-500 border-green-500 text-white"
                                      : "bg-white border-gray-300 text-gray-600"
                                  }`}
                                  aria-label="Pilih zona"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => toggleZone(z.id)}
                                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs ${
                                    selectedZoneIds.has(z.id)
                                      ? "bg-white border-gray-300 text-gray-600"
                                      : "bg-red-500 border-red-500 text-white"
                                  }`}
                                  aria-label="Hapus pilihan zona"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">Pilih data design terlebih dahulu.</div>
                    )}

                    <div className="pt-2">
                      <button
                        onClick={handleSendTask}
                        disabled={!selectedAssignee || !selectedDesign || selectedZoneIds.size === 0}
                        className={`w-full py-2.5 rounded-xl font-semibold ${
                          !selectedAssignee || !selectedDesign || selectedZoneIds.size === 0
                            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                      >
                        Kirim Tugas
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
