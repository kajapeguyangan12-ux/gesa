"use client";

import { useState, useEffect, memo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { collection, getDocs, query, where, orderBy, addDoc, serverTimestamp, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  password?: string;
  role: string;
  department?: string;
  createdAt: any;
}

type UserRole = "super-admin" | "admin" | "petugas-existing" | "petugas-apj-propose" | "petugas-survey-cahaya" | "petugas-kontruksi" | "petugas-om" | "petugas-bmd-gudang";

// Memoized UserCard component for better performance
const UserCard = memo(({ user, classes, onViewDetail, onDelete, isSuperAdmin }: { user: User; classes: any; onViewDetail: (user: User) => void; onDelete: (user: User) => void; isSuperAdmin: boolean }) => (
  <div
    className={`group bg-gradient-to-br ${classes.cardBg} rounded-xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 border-2 ${classes.border} hover:-translate-y-1`}
  >
    <div className="flex items-start justify-between mb-4">
      <div className={`w-14 h-14 ${classes.icon} rounded-xl flex items-center justify-center shadow-md`}>
        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      </div>
      {isSuperAdmin && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button 
            onClick={() => onViewDetail(user)}
            className={`p-2 ${classes.hover} rounded-lg transition-all hover:scale-110`}
            title="Lihat Detail"
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button 
            onClick={() => onDelete(user)}
            className="p-2 hover:bg-red-100 rounded-lg transition-all hover:scale-110"
            title="Hapus User"
          >
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </div>
    
    <h4 className="font-bold text-gray-900 text-lg mb-1 truncate">
      {user.name}
    </h4>
    <p className="text-sm text-gray-700 font-semibold mb-3 truncate">
      @{user.username}
    </p>
    
    <div className="flex items-center gap-2 text-sm text-gray-600 mb-4 bg-white bg-opacity-50 rounded-lg px-3 py-2">
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
      <span className="truncate">{user.email}</span>
    </div>
    
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r ${classes.badge} text-white rounded-lg text-xs font-bold shadow-sm`}>
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      {user.role === "super-admin" 
        ? "Super Admin" 
        : user.role === "admin" 
        ? "Admin" 
        : user.role.includes("petugas") 
        ? "Petugas" 
        : user.role}
    </div>
  </div>
));

UserCard.displayName = "UserCard";

function UserAdminContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [superAdmins, setSuperAdmins] = useState<User[]>([]);
  const [administrators, setAdministrators] = useState<User[]>([]);
  const [surveyExisting, setSurveyExisting] = useState<User[]>([]);
  const [surveyAPJ, setSurveyAPJ] = useState<User[]>([]);
  const [surveyCahaya, setSurveyCahaya] = useState<User[]>([]);
  const [kontruksi, setKontruksi] = useState<User[]>([]);
  const [om, setOm] = useState<User[]>([]);
  const [bmdGudang, setBmdGudang] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    role: "petugas-existing" as UserRole,
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isSuperAdmin = user?.role === "super-admin";

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch super administrators
      const superAdminQuery = query(
        collection(db, "User-Admin"),
        where("role", "==", "super-admin"),
        orderBy("createdAt", "desc")
      );
      const superAdminSnapshot = await getDocs(superAdminQuery);
      const superAdminData = superAdminSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as User[];
      setSuperAdmins(superAdminData);
      
      // Fetch administrators
      const adminQuery = query(
        collection(db, "User-Admin"),
        where("role", "==", "admin"),
        orderBy("createdAt", "desc")
      );
      const adminSnapshot = await getDocs(adminQuery);
      const adminData = adminSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as User[];
      setAdministrators(adminData);

      // Fetch Survey Existing
      const existingQuery = query(
        collection(db, "User-Admin"),
        where("role", "==", "petugas-existing"),
        orderBy("createdAt", "desc")
      );
      const existingSnapshot = await getDocs(existingQuery);
      setSurveyExisting(existingSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as User[]);

      // Fetch Survey APJ Propose
      const apjQuery = query(
        collection(db, "User-Admin"),
        where("role", "==", "petugas-apj-propose"),
        orderBy("createdAt", "desc")
      );
      const apjSnapshot = await getDocs(apjQuery);
      setSurveyAPJ(apjSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as User[]);

      // Fetch Survey Cahaya
      const cahayaQuery = query(
        collection(db, "User-Admin"),
        where("role", "==", "petugas-survey-cahaya"),
        orderBy("createdAt", "desc")
      );
      const cahayaSnapshot = await getDocs(cahayaQuery);
      setSurveyCahaya(cahayaSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as User[]);

      // Fetch Kontruksi
      const kontruksiQuery = query(
        collection(db, "User-Admin"),
        where("role", "==", "petugas-kontruksi"),
        orderBy("createdAt", "desc")
      );
      const kontruksiSnapshot = await getDocs(kontruksiQuery);
      setKontruksi(kontruksiSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as User[]);

      // Fetch O&M
      const omQuery = query(
        collection(db, "User-Admin"),
        where("role", "==", "petugas-om"),
        orderBy("createdAt", "desc")
      );
      const omSnapshot = await getDocs(omQuery);
      setOm(omSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as User[]);

      // Fetch BMD & Gudang
      const bmdQuery = query(
        collection(db, "User-Admin"),
        where("role", "==", "petugas-bmd-gudang"),
        orderBy("createdAt", "desc")
      );
      const bmdSnapshot = await getDocs(bmdQuery);
      setBmdGudang(bmdSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as User[]);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Add user data to Firestore
      await addDoc(collection(db, "User-Admin"), {
        uid: userCredential.user.uid,
        name: formData.name,
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        createdAt: serverTimestamp(),
      });

      alert("User berhasil ditambahkan!");
      setShowAddUserModal(false);
      setFormData({
        name: "",
        username: "",
        email: "",
        password: "",
        role: "petugas-existing",
      });
      fetchUsers(); // Refresh data
    } catch (error: any) {
      console.error("Error adding user:", error);
      alert(`Gagal menambahkan user: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetail = (user: User) => {
    setSelectedUser(user);
    setShowPassword(false);
    setShowDetailModal(true);
  };

  const handleDeleteClick = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser || !isSuperAdmin) return;

    setDeleting(true);
    try {
      await deleteDoc(doc(db, "User-Admin", selectedUser.id));
      alert("User berhasil dihapus!");
      setShowDeleteModal(false);
      setSelectedUser(null);
      fetchUsers(); // Refresh data
    } catch (error: any) {
      console.error("Error deleting user:", error);
      alert(`Gagal menghapus user: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "long",
      timeStyle: "short"
    }).format(date);
  };

  const roleLabels: Record<UserRole, string> = {
    "super-admin": "Super Admin (Akses Penuh)",
    "admin": "Admin (Halaman Admin)",
    "petugas-existing": "Petugas Survey Existing",
    "petugas-apj-propose": "Petugas APJ Propose",
    "petugas-survey-cahaya": "Petugas Survey Cahaya",
    "petugas-kontruksi": "Petugas Kontruksi",
    "petugas-om": "Petugas O&M",
    "petugas-bmd-gudang": "Petugas BMD & Gudang Project",
  };

  const renderUserSection = (
    title: string,
    users: User[],
    color: string,
    badgeLabel: string
  ) => {
    const colorClasses: Record<string, any> = {
      red: {
        gradient: "from-red-500 to-red-600",
        cardBg: "from-red-50 to-red-100",
        border: "border-red-200 hover:border-red-400",
        badge: "from-red-600 to-red-700",
        icon: "bg-gradient-to-br from-red-600 to-red-700",
        hover: "hover:bg-red-200",
        empty: "bg-red-50 border-red-300 text-red-400",
      },
      purple: {
        gradient: "from-purple-500 to-purple-600",
        cardBg: "from-purple-50 to-purple-100",
        border: "border-purple-200 hover:border-purple-400",
        badge: "from-purple-600 to-purple-700",
        icon: "bg-gradient-to-br from-purple-600 to-purple-700",
        hover: "hover:bg-purple-200",
        empty: "bg-purple-50 border-purple-300 text-purple-400",
      },
      blue: {
        gradient: "from-blue-500 to-blue-600",
        cardBg: "from-blue-50 to-blue-100",
        border: "border-blue-200 hover:border-blue-400",
        badge: "from-blue-600 to-blue-700",
        icon: "bg-gradient-to-br from-blue-600 to-blue-700",
        hover: "hover:bg-blue-200",
        empty: "bg-blue-50 border-blue-300 text-blue-400",
      },
      green: {
        gradient: "from-green-500 to-green-600",
        cardBg: "from-green-50 to-green-100",
        border: "border-green-200 hover:border-green-400",
        badge: "from-green-600 to-green-700",
        icon: "bg-gradient-to-br from-green-600 to-green-700",
        hover: "hover:bg-green-200",
        empty: "bg-green-50 border-green-300 text-green-400",
      },
      orange: {
        gradient: "from-orange-500 to-orange-600",
        cardBg: "from-orange-50 to-orange-100",
        border: "border-orange-200 hover:border-orange-400",
        badge: "from-orange-600 to-orange-700",
        icon: "bg-gradient-to-br from-orange-600 to-orange-700",
        hover: "hover:bg-orange-200",
        empty: "bg-orange-50 border-orange-300 text-orange-400",
      },
      teal: {
        gradient: "from-teal-500 to-teal-600",
        cardBg: "from-teal-50 to-teal-100",
        border: "border-teal-200 hover:border-teal-400",
        badge: "from-teal-600 to-teal-700",
        icon: "bg-gradient-to-br from-teal-600 to-teal-700",
        hover: "hover:bg-teal-200",
        empty: "bg-teal-50 border-teal-300 text-teal-400",
      },
      indigo: {
        gradient: "from-indigo-500 to-indigo-600",
        cardBg: "from-indigo-50 to-indigo-100",
        border: "border-indigo-200 hover:border-indigo-400",
        badge: "from-indigo-600 to-indigo-700",
        icon: "bg-gradient-to-br from-indigo-600 to-indigo-700",
        hover: "hover:bg-indigo-200",
        empty: "bg-indigo-50 border-indigo-300 text-indigo-400",
      },
      pink: {
        gradient: "from-pink-500 to-pink-600",
        cardBg: "from-pink-50 to-pink-100",
        border: "border-pink-200 hover:border-pink-400",
        badge: "from-pink-600 to-pink-700",
        icon: "bg-gradient-to-br from-pink-600 to-pink-700",
        hover: "hover:bg-pink-200",
        empty: "bg-pink-50 border-pink-300 text-pink-400",
      },
    };

    const classes = colorClasses[color] || colorClasses.blue;

    return (
      <div className="mb-8">
        <div className={`flex items-center gap-3 mb-5 bg-gradient-to-r ${classes.gradient} rounded-xl px-5 py-4 shadow-md`}>
          <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
            <p className="text-sm text-white text-opacity-80">{users.length} pengguna terdaftar</p>
          </div>
        </div>

        {users.length === 0 ? (
          <div className={`text-center py-12 ${classes.empty} rounded-xl border-2 border-dashed`}>
            <svg className="w-16 h-16 mx-auto mb-3 text-current" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            <p className="text-gray-600">Belum ada {title.toLowerCase()} terdaftar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {users.map((user) => (
              <UserCard 
                key={user.id} 
                user={user} 
                classes={classes}
                onViewDetail={handleViewDetail}
                onDelete={handleDeleteClick}
                isSuperAdmin={isSuperAdmin}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">User & Admin</h1>
              <p className="text-sm text-gray-500">Manajemen pengguna dan administrator sistem</p>
            </div>
            <button
              onClick={() => router.push("/admin/module-selection")}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-semibold transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline">Kembali</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
        {/* Manajemen Pengguna Banner */}
        <div className="mb-8 bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl shadow-xl p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-white bg-opacity-20 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl lg:text-3xl font-bold text-white mb-1">
                  Manajemen Pengguna
                </h2>
                <p className="text-sm lg:text-base text-purple-100">
                  Kelola dan pantau aktivitas pengguna sistem
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAddUserModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-white hover:bg-gray-50 text-purple-700 rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span>Tambah Pengguna</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Memuat data pengguna...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {renderUserSection("Super Administrator", superAdmins, "red", "Super Admin")}
            {renderUserSection("Administrator", administrators, "purple", "Admin Survey")}
            {renderUserSection("Petugas Survey Existing", surveyExisting, "blue", "Survey Existing")}
            {renderUserSection("Petugas Survey APJ Propose", surveyAPJ, "green", "Survey APJ")}
            {renderUserSection("Petugas Survey Cahaya", surveyCahaya, "orange", "Survey Cahaya")}
            {renderUserSection("Petugas Kontruksi", kontruksi, "teal", "Kontruksi")}
            {renderUserSection("Petugas O&M", om, "indigo", "O&M")}
            {renderUserSection("Petugas BMD & Gudang Project", bmdGudang, "pink", "BMD & Gudang")}
          </div>
        )}
      </main>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn" 
          style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowAddUserModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 rounded-t-2xl z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Tambah Pengguna Baru</h3>
                <button
                  onClick={() => setShowAddUserModal(false)}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 text-black font-medium border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all placeholder:text-gray-400"
                  placeholder="Masukkan nama lengkap"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-3 text-black font-medium border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all placeholder:text-gray-400"
                  placeholder="Masukkan username"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 text-black font-medium border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all placeholder:text-gray-400"
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 text-black font-medium border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all placeholder:text-gray-400"
                  placeholder="Minimal 6 karakter"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Role / Jabatan
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-4 py-3 text-black font-medium border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all bg-white"
                  required
                >
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
                  disabled={submitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={submitting}
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Menyimpan...
                    </span>
                  ) : (
                    "Tambah Pengguna"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail User Modal */}
      {showDetailModal && selectedUser && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn" 
          style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowDetailModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-2xl z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white">Detail Pengguna</h3>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-all"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* User Avatar */}
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-xl">
                  <svg className="w-14 h-14 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
              </div>

              {/* User Info Grid */}
              <div className="space-y-4">
                {/* Name */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border-2 border-gray-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Nama Lengkap</p>
                      <p className="text-lg font-bold text-gray-900">{selectedUser.name}</p>
                    </div>
                  </div>
                </div>

                {/* Username */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border-2 border-gray-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Username</p>
                      <p className="text-lg font-bold text-gray-900">@{selectedUser.username}</p>
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border-2 border-gray-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</p>
                      <p className="text-lg font-bold text-gray-900 break-all">{selectedUser.email}</p>
                    </div>
                  </div>
                </div>

                {/* Password */}
                {selectedUser.password && (
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border-2 border-gray-200">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Password</p>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-bold text-gray-900 font-mono">
                            {showPassword ? selectedUser.password : '••••••••••'}
                          </p>
                          <button
                            onClick={() => setShowPassword(!showPassword)}
                            className="p-1.5 hover:bg-gray-200 rounded-lg transition-all"
                            title={showPassword ? "Sembunyikan Password" : "Tampilkan Password"}
                          >
                            {showPassword ? (
                              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Role */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border-2 border-gray-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Role / Jabatan</p>
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-bold shadow-sm mt-1">
                        {roleLabels[selectedUser.role as UserRole] || selectedUser.role}
                      </div>
                    </div>
                  </div>
                </div>

                {/* User ID */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border-2 border-gray-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">User ID</p>
                      <p className="text-sm font-mono font-semibold text-gray-700 break-all">{selectedUser.id}</p>
                    </div>
                  </div>
                </div>

                {/* Created At */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border-2 border-gray-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tanggal Dibuat</p>
                      <p className="text-sm font-semibold text-gray-700">{formatDate(selectedUser.createdAt)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6 pt-6 border-t-2 border-gray-200">
                {isSuperAdmin && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleDeleteClick(selectedUser);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-semibold transition-all border-2 border-red-200 hover:border-red-300"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Hapus User
                  </button>
                )}
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn" 
          style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Warning Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 text-center mb-2">
                Konfirmasi Hapus User
              </h3>
              <p className="text-gray-600 text-center mb-6">
                Apakah Anda yakin ingin menghapus user ini? Tindakan ini tidak dapat dibatalkan.
              </p>

              {/* User Info */}
              <div className="bg-red-50 rounded-xl p-4 border-2 border-red-200 mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-red-200 rounded-lg flex items-center justify-center">
                    <svg className="w-7 h-7 text-red-700" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-lg">{selectedUser.name}</p>
                    <p className="text-sm text-gray-600">@{selectedUser.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>{selectedUser.email}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all"
                  disabled={deleting}
                >
                  Batal
                </button>
                <button
                  onClick={handleDeleteUser}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={deleting}
                >
                  {deleting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Menghapus...
                    </span>
                  ) : (
                    "Ya, Hapus User"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UserAdminPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role !== "super-admin") {
      router.push("/module-selection");
    }
  }, [user, router]);

  return (
    <ProtectedRoute>
      <UserAdminContent />
    </ProtectedRoute>
  );
}
