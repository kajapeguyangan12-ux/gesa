"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import * as XLSX from "xlsx";
import MapsKontruksiValid from "./components/MapsKontruksiValid";

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
};

const menuItems: MenuItem[] = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "distribusi", label: "Distribusi Pekerjaan", icon: "🧩" },
  { id: "manajemen", label: "Manajemen Pengguna", icon: "👥" },
  { id: "validasi", label: "Validasi Data Kontruksi", icon: "✅" },
  { id: "data-valid", label: "Data Kontruksi Valid", icon: "📊" },
  { id: "maps-valid", label: "Maps Data Valid", icon: "🗺️" },
  { id: "upload-design", label: "Upload Data Design", icon: "📤" },
];

export default function AdminKontruksiPage() {
  const router = useRouter();
  const { user } = useAuth();
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

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-red-50">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200">
          <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push("/admin/module-selection")}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <div>
                  <div className="text-sm text-gray-500">Dashboard</div>
                  <div className="text-lg font-bold text-gray-900">Gesa Kontruksi</div>
                </div>
              </div>

              <div className="flex-1 hidden md:flex justify-center">
                <div className="w-full max-w-xl relative">
                  <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    placeholder="Search..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-full border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowNotif(true)}
                  className="w-10 h-10 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center"
                  aria-label="Notifikasi"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0h6z" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowProfile(true)}
                  className="w-10 h-10 rounded-full border-2 border-gray-200 bg-gray-100 flex items-center justify-center font-bold text-gray-700"
                  aria-label="Profil"
                >
                  {(user?.displayName || "A").charAt(0).toUpperCase()}
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-[1920px] mx-auto px-4 sm:px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
            {/* Sidebar */}
            <aside className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
              <div className="text-xs uppercase text-gray-400 font-semibold mb-3">Menu</div>
              <div className="space-y-2">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActive(item.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-sm font-semibold ${
                      active === item.id
                        ? "bg-red-50 border-red-200 text-red-700"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </aside>

            {/* Content */}
            <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-gray-900">
                  {active === "home"
                    ? "Home"
                    : active === "distribusi"
                    ? "Distribusi Pekerjaan"
                    : active === "manajemen"
                    ? "Manajemen Pengguna"
                    : active === "validasi"
                    ? "Validasi Data Kontruksi"
                  : active === "data-valid"
                    ? "Data Kontruksi Valid"
                    : active === "maps-valid"
                    ? "Maps Data Valid"
                    : "Upload Data Design"}
                </h2>
                <p className="text-sm text-gray-500">Pilih fitur yang ingin digunakan.</p>
              </div>

              {active === "distribusi" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <button
                    onClick={async () => {
                      setShowHistory(true);
                      if (historyItems.length === 0) await loadHistory();
                    }}
                    className="group border border-gray-200 rounded-2xl p-4 hover:shadow-md hover:border-red-200 transition-all bg-white"
                  >
                    <div className="text-3xl mb-2">🗓️</div>
                    <div className="text-sm font-bold text-gray-900 group-hover:text-red-700">
                      Riwayat Tugas Kontruksi
                    </div>
                  </button>
                  <button
                    onClick={async () => {
                      setShowAssignUsers(true);
                      if (kontruksiUsers.length === 0) await loadKontruksiUsers();
                    }}
                    className="group border border-gray-200 rounded-2xl p-4 hover:shadow-md hover:border-red-200 transition-all bg-white"
                  >
                    <div className="text-3xl mb-2">📝</div>
                    <div className="text-sm font-bold text-gray-900 group-hover:text-red-700">
                      Bagikan Tugas Kontruksi
                    </div>
                  </button>
                </div>
              ) : active === "manajemen" ? (
                <div className="space-y-4">
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
                    <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center">
                      <div className="text-sm font-semibold text-gray-600">Belum ada petugas kontruksi</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Tambahkan petugas kontruksi untuk mengelola tugas di modul ini.
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {kontruksiUsers.map((u) => (
                        <div
                          key={u.id}
                          className="border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-3"
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
                <div className="space-y-4">
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

                  {loadingSubmissions ? (
                    <div className="text-sm text-gray-500">Memuat data kontruksi...</div>
                  ) : submissions.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center">
                      <div className="text-sm font-semibold text-gray-600">Belum ada data kontruksi masuk</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Data akan muncul setelah petugas mengirim laporan kontruksi.
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {submissions.map((item) => (
                        <div
                          key={item.id}
                          className="border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                        >
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
                          </div>
                          <div className="flex items-center gap-2">
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
                <div className="space-y-4">
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

                  {loadingValid ? (
                    <div className="text-sm text-gray-500">Memuat data valid...</div>
                  ) : validItems.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center">
                      <div className="text-sm font-semibold text-gray-600">Belum ada data kontruksi valid</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Data valid akan muncul setelah proses validasi selesai.
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {validItems.map((item) => (
                        <div key={item.id} className="border border-gray-200 rounded-xl p-4">
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
                <div className="border border-gray-200 rounded-2xl p-5 bg-gradient-to-br from-red-50 to-white">
                  <div className="text-sm font-bold text-gray-900 mb-2">Upload Data Design (Dari Survey)</div>
                  <div className="text-xs text-gray-600 mb-4">
                    Unggah file design yang sudah dibuat berdasarkan data survey.
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
                    <div className="border-2 border-dashed border-red-200 rounded-xl p-6 text-center bg-white hover:bg-red-50 transition-all cursor-pointer">
                      <div className="text-3xl mb-2">📤</div>
                      <div className="text-sm font-semibold text-gray-900">Klik untuk upload</div>
                      <div className="text-xs text-gray-500 mt-1">XLSX atau XLS</div>
                    </div>
                  </label>
                  <div className="mt-4 text-xs text-gray-500">
                    Status: {uploadStatus || "Belum ada file diupload."}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {cards.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => setActive(card.id)}
                      className="group border border-gray-200 rounded-2xl p-4 hover:shadow-md hover:border-red-200 transition-all bg-white"
                    >
                      <div className="text-3xl mb-2">{card.icon}</div>
                      <div className="text-sm font-bold text-gray-900 group-hover:text-red-700">
                        {card.label}
                      </div>
                    </button>
                  ))}
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
