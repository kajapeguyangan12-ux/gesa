"use client";

import { useState, useEffect, memo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { clearCachedData, fetchWithCache } from "@/utils/firestoreCache";
import { KABUPATEN_OPTIONS } from "@/utils/constants";

interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  kabupaten?: string;
  department?: string;
  createdAt: any;
  uid?: string;
}

interface UsersPagePayload {
  hasMore: boolean;
  query?: string;
  users: User[];
  nextOffset?: number;
}

type UserRole =
  | "super-admin"
  | "admin"
  | "masyarakat-umum"
  | "pemkab-gesa"
  | "petugas-existing"
  | "petugas-apj-propose"
  | "petugas-pra-existing"
  | "petugas-survey-cahaya"
  | "petugas-kontruksi"
  | "petugas-om"
  | "petugas-om-correctif"
  | "petugas-om-preventif"
  | "petugas-bmd-gudang";
type KabupatenId = (typeof KABUPATEN_OPTIONS)[number]["id"];

// Memoized UserCard component for better performance
const getRoleBadgeLabel = (role: string) => {
  switch (role) {
    case "super-admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    case "masyarakat-umum":
      return "Masyarakat";
    case "pemkab-gesa":
      return "Pemkab";
    case "petugas-om":
      return "O&M Preventif";
    case "petugas-om-correctif":
      return "O&M Correctif";
    case "petugas-om-preventif":
      return "O&M Preventif";
    default:
      return role.includes("petugas") ? "Petugas" : role;
  }
};

const UserCard = memo(({ user, classes, onViewDetail, onDelete, isSuperAdmin, isSelected, onToggleSelect }: { user: User; classes: any; onViewDetail: (user: User) => void; onDelete: (user: User) => void; isSuperAdmin: boolean; isSelected: boolean; onToggleSelect: (userId: string) => void }) => (
  <div
    className={`group bg-gradient-to-br ${classes.cardBg} rounded-xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 border-2 ${classes.border} hover:-translate-y-1 ${isSelected ? "ring-2 ring-red-400 ring-offset-2" : ""}`}
  >
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-start gap-3">
        {isSuperAdmin && (
          <label className="mt-1 inline-flex items-center">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(user.id)}
              className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
          </label>
        )}
        <div className={`w-14 h-14 ${classes.icon} rounded-xl flex items-center justify-center shadow-md`}>
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
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
      {getRoleBadgeLabel(user.role)}
    </div>
    {user.role === "super-admin" ? (
      <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
        Semua wilayah
      </div>
    ) : (
      <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {user.kabupaten || "tabanan"}
      </div>
    )}
  </div>
));

UserCard.displayName = "UserCard";

function UserAdminContent() {
  const DEFAULT_VISIBLE_USERS = 4;
  const USER_FETCH_LIMIT = 10;
  const USERS_CACHE_KEY = "user-admin_dataset_v4";
  const USERS_CACHE_TTL_MS = 15 * 60 * 1000;
  const { user } = useAuth();
  const router = useRouter();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [superAdmins, setSuperAdmins] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    role: "petugas-existing" as UserRole,
    kabupaten: "tabanan" as KabupatenId,
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);
  const [loadingAllUsers, setLoadingAllUsers] = useState(false);
  const [supabaseOffset, setSupabaseOffset] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [activeKabupatenTab, setActiveKabupatenTab] = useState<KabupatenId>("tabanan");

  const isSuperAdmin = user?.role === "super-admin";
  const isSelectedRoleSuperAdmin = formData.role === "super-admin";

  useEffect(() => {
    void fetchUsers(false, "");
  }, []);

  useEffect(() => {
    setSelectedUserIds((previous) => previous.filter((userId) => allUsers.some((item) => item.id === userId)));
  }, [allUsers]);

  const applyUserBuckets = (users: User[]) => {
    setAllUsers(users);
    setSuperAdmins(users.filter((item) => item.role === "super-admin"));
  };

  const fetchUsers = async (forceRefresh = false, searchQuery = activeSearchQuery) => {
    try {
      const normalizedSearchQuery = searchQuery.trim();
      if (forceRefresh) {
        setRefreshing(true);
        if (!normalizedSearchQuery) {
          clearCachedData(USERS_CACHE_KEY);
        }
      } else {
        setLoading(true);
      }
      setExpandedSections({});
      setHasMoreUsers(false);
      setSupabaseOffset(0);
      setSelectedUserIds([]);

      const loadUsersPage = async () => {
        if (normalizedSearchQuery) {
          const searchBatchSize = 200;
          let offset = 0;
          let hasMore = true;
          const users: User[] = [];

          while (hasMore) {
            const params = new URLSearchParams({
              limit: String(searchBatchSize),
              offset: String(offset),
              q: normalizedSearchQuery,
            });

            const response = await fetch(`/api/admin/user-admin?${params.toString()}`, {
              cache: "no-store",
            });
            const payload = (await response.json()) as UsersPagePayload & { error?: string; total?: number };
            if (!response.ok) {
              throw new Error(payload.error || "Gagal memuat hasil pencarian user dari Supabase.");
            }

            const batchUsers = payload.users || [];
            users.push(...batchUsers);
            hasMore = Boolean(payload.hasMore);
            offset = payload.nextOffset || offset + batchUsers.length;

            if (batchUsers.length === 0) {
              hasMore = false;
            }
          }

          return {
            query: normalizedSearchQuery,
            users,
            hasMore: false,
            nextOffset: users.length,
          };
        }

        const params = new URLSearchParams({
          limit: String(USER_FETCH_LIMIT),
          offset: "0",
        });

        const response = await fetch(`/api/admin/user-admin?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as UsersPagePayload & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Gagal memuat data user dari Supabase.");
        }
        return payload;
      };

      const pagePayload = normalizedSearchQuery
        ? await loadUsersPage()
        : await fetchWithCache<UsersPagePayload>(
            USERS_CACHE_KEY,
            loadUsersPage,
            USERS_CACHE_TTL_MS
          );

      applyUserBuckets(pagePayload.users);
      setActiveSearchQuery(normalizedSearchQuery);
      setHasMoreUsers(pagePayload.hasMore);
      setSupabaseOffset(pagePayload.nextOffset || pagePayload.users.length);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLoadMoreUsers = async () => {
    if (!hasMoreUsers || loadingMoreUsers || loadingAllUsers) return;

    setLoadingMoreUsers(true);
    try {
      const params = new URLSearchParams({
        limit: String(USER_FETCH_LIMIT),
        offset: String(supabaseOffset),
      });
      if (activeSearchQuery) {
        params.set("q", activeSearchQuery);
      }

      const response = await fetch(`/api/admin/user-admin?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as UsersPagePayload & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Gagal memuat data user berikutnya dari Supabase.");
      }
      const nextUsers = payload.users || [];
      if (nextUsers.length === 0) {
        setHasMoreUsers(false);
        return;
      }

      const mergedUsers = [...allUsers, ...nextUsers];
      applyUserBuckets(mergedUsers);
      setHasMoreUsers(Boolean(payload.hasMore));
      setSupabaseOffset(payload.nextOffset || mergedUsers.length);
    } catch (error) {
      console.error("Error loading more users:", error);
    } finally {
      setLoadingMoreUsers(false);
    }
  };

  const handleLoadAllUsers = async () => {
    if (!hasMoreUsers || loadingMoreUsers || loadingAllUsers) return;

    setLoadingAllUsers(true);
    try {
      let nextOffset = supabaseOffset;
      let nextHasMore: boolean = hasMoreUsers;
      let mergedUsers = [...allUsers];

      while (nextHasMore) {
        const params = new URLSearchParams({
          limit: String(USER_FETCH_LIMIT),
          offset: String(nextOffset),
        });
        if (activeSearchQuery) {
          params.set("q", activeSearchQuery);
        }

        const response = await fetch(`/api/admin/user-admin?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as UsersPagePayload & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Gagal memuat seluruh data user dari Supabase.");
        }

        const nextUsers = payload.users || [];
        if (nextUsers.length === 0) {
          nextHasMore = false;
          break;
        }

        mergedUsers = [...mergedUsers, ...nextUsers];
        nextHasMore = Boolean(payload.hasMore);
        nextOffset = payload.nextOffset || mergedUsers.length;
      }

      applyUserBuckets(mergedUsers);
      setHasMoreUsers(nextHasMore);
      setSupabaseOffset(nextOffset);
    } catch (error) {
      console.error("Error loading all users:", error);
    } finally {
      setLoadingAllUsers(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/user-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          username: formData.username,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          ...(formData.role === "super-admin" ? {} : { kabupaten: formData.kabupaten }),
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Gagal menambahkan user.");
      }

      alert("User berhasil ditambahkan!");
      setShowAddUserModal(false);
      setFormData({
        name: "",
        username: "",
        email: "",
        password: "",
        role: "petugas-existing",
        kabupaten: "tabanan",
      });
      fetchUsers(true); // Refresh data
    } catch (error: any) {
      console.error("Error adding user:", error);
      alert(`Gagal menambahkan user: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetail = (user: User) => {
    setSelectedUser(user);
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
      const response = await fetch(`/api/admin/user-admin/${encodeURIComponent(selectedUser.id)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Gagal menghapus user.");
      }
      alert("User berhasil dihapus!");
      setShowDeleteModal(false);
      setSelectedUser(null);
      fetchUsers(true); // Refresh data
    } catch (error: any) {
      console.error("Error deleting user:", error);
      alert(`Gagal menghapus user: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleSearchUsers = async () => {
    await fetchUsers(true, searchInput);
  };

  const handleResetSearch = async () => {
    setSearchInput("");
    await fetchUsers(true, "");
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((previous) =>
      previous.includes(userId) ? previous.filter((id) => id !== userId) : [...previous, userId]
    );
  };

  const toggleSelectAllLoadedUsers = () => {
    const loadedIds = allUsers.map((item) => item.id);
    const allLoadedSelected = loadedIds.length > 0 && loadedIds.every((userId) => selectedUserIds.includes(userId));
    setSelectedUserIds(allLoadedSelected ? [] : loadedIds);
  };

  const handleBulkDeleteUsers = async () => {
    if (!isSuperAdmin || selectedUserIds.length === 0) return;

    const confirmed = confirm(
      `Apakah Anda yakin ingin menghapus ${selectedUserIds.length} user yang dipilih? Akun auth juga akan ikut dihapus.`
    );

    if (!confirmed) {
      return;
    }

    setBulkDeleting(true);
    try {
      const response = await fetch("/api/admin/user-admin/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedUserIds }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Gagal menghapus user secara massal.");
      }

      if (selectedUser && selectedUserIds.includes(selectedUser.id)) {
        setShowDetailModal(false);
        setShowDeleteModal(false);
        setSelectedUser(null);
      }

      setSelectedUserIds([]);
      alert("User terpilih berhasil dihapus.");
      await fetchUsers(true, activeSearchQuery);
    } catch (error: any) {
      console.error("Error bulk deleting users:", error);
      alert(`Gagal menghapus user secara massal: ${error.message}`);
    } finally {
      setBulkDeleting(false);
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
    "masyarakat-umum": "Masyarakat Umum",
    "pemkab-gesa": "Pemkab Monitoring GESA",
    "petugas-existing": "Petugas Survey Existing",
    "petugas-apj-propose": "Petugas APJ Propose",
    "petugas-pra-existing": "Petugas Survey Pra Existing",
    "petugas-survey-cahaya": "Petugas Survey Cahaya",
    "petugas-kontruksi": "Petugas Kontruksi",
    "petugas-om": "Petugas O&M Preventif (Legacy)",
    "petugas-om-correctif": "Petugas O&M Correctif",
    "petugas-om-preventif": "Petugas O&M Preventif",
    "petugas-bmd-gudang": "Petugas BMD & Gudang Project",
  };

  const roleSections: Array<{ title: string; role: UserRole; color: string }> = [
    { title: "Administrator", role: "admin", color: "purple" },
    { title: "Masyarakat Umum", role: "masyarakat-umum", color: "slate" },
    { title: "Pemkab Monitoring GESA", role: "pemkab-gesa", color: "cyan" },
    { title: "Petugas Survey Existing", role: "petugas-existing", color: "blue" },
    { title: "Petugas Survey APJ Propose", role: "petugas-apj-propose", color: "green" },
    { title: "Petugas Survey Pra Existing", role: "petugas-pra-existing", color: "emerald" },
    { title: "Petugas Survey Cahaya", role: "petugas-survey-cahaya", color: "orange" },
    { title: "Petugas Kontruksi", role: "petugas-kontruksi", color: "teal" },
    { title: "Petugas BMD & Gudang Project", role: "petugas-bmd-gudang", color: "pink" },
  ];

  const normalizeUserKabupaten = (value?: string) => {
    const normalized = value?.trim().toLowerCase();
    return normalized === "denpasar" ? "denpasar" : "tabanan";
  };

  const getUsersByKabupatenAndRole = (kabupaten: KabupatenId, role: UserRole) =>
    allUsers.filter((item) => item.role === role && normalizeUserKabupaten(item.kabupaten) === kabupaten);

  const getOmUsersByKabupaten = (kabupaten: KabupatenId) =>
    allUsers.filter(
      (item) =>
        normalizeUserKabupaten(item.kabupaten) === kabupaten &&
        ["petugas-om", "petugas-om-preventif", "petugas-om-correctif"].includes(item.role)
    );

  const getUsersByKabupaten = (kabupaten: KabupatenId) =>
    allUsers.filter((item) => item.role !== "super-admin" && normalizeUserKabupaten(item.kabupaten) === kabupaten);

  const renderUserSection = (
    title: string,
    users: User[],
    color: string
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
      emerald: {
        gradient: "from-emerald-500 to-emerald-600",
        cardBg: "from-emerald-50 to-emerald-100",
        border: "border-emerald-200 hover:border-emerald-400",
        badge: "from-emerald-600 to-emerald-700",
        icon: "bg-gradient-to-br from-emerald-600 to-emerald-700",
        hover: "hover:bg-emerald-200",
        empty: "bg-emerald-50 border-emerald-300 text-emerald-400",
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
      violet: {
        gradient: "from-violet-500 to-violet-600",
        cardBg: "from-violet-50 to-violet-100",
        border: "border-violet-200 hover:border-violet-400",
        badge: "from-violet-600 to-violet-700",
        icon: "bg-gradient-to-br from-violet-600 to-violet-700",
        hover: "hover:bg-violet-200",
        empty: "bg-violet-50 border-violet-300 text-violet-400",
      },
      cyan: {
        gradient: "from-cyan-500 to-sky-600",
        cardBg: "from-cyan-50 to-sky-100",
        border: "border-cyan-200 hover:border-cyan-400",
        badge: "from-cyan-600 to-sky-700",
        icon: "bg-gradient-to-br from-cyan-600 to-sky-700",
        hover: "hover:bg-cyan-200",
        empty: "bg-cyan-50 border-cyan-300 text-cyan-500",
      },
      slate: {
        gradient: "from-slate-500 to-slate-700",
        cardBg: "from-slate-50 to-slate-100",
        border: "border-slate-200 hover:border-slate-400",
        badge: "from-slate-600 to-slate-700",
        icon: "bg-gradient-to-br from-slate-600 to-slate-700",
        hover: "hover:bg-slate-200",
        empty: "bg-slate-50 border-slate-300 text-slate-500",
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
    const sectionKey = `${title}-${color}`;
    const isExpanded = expandedSections[sectionKey] || false;
    const visibleUsers = isExpanded ? users : users.slice(0, DEFAULT_VISIBLE_USERS);
    const hasMoreUsers = users.length > DEFAULT_VISIBLE_USERS;

    return (
      <div key={`${title}-${color}`} className="mb-8">
        <div className={`flex items-center gap-3 mb-5 bg-gradient-to-r ${classes.gradient} rounded-xl px-5 py-4 shadow-md`}>
          <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
            <div className="text-sm text-white text-opacity-80">
              <p>{users.length} pengguna terdaftar</p>
              {title === "Petugas O&M" ? (
                <p className="mt-1 text-xs text-white/90">
                  Preventif: {users.filter((item) => item.role === "petugas-om" || item.role === "petugas-om-preventif").length}
                  {" • "}
                  Correctif: {users.filter((item) => item.role === "petugas-om-correctif").length}
                </p>
              ) : null}
            </div>
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
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visibleUsers.map((user) => (
                <UserCard 
                  key={user.id} 
                  user={user} 
                  classes={classes}
                  onViewDetail={handleViewDetail}
                  onDelete={handleDeleteClick}
                  isSuperAdmin={isSuperAdmin}
                  isSelected={selectedUserIds.includes(user.id)}
                  onToggleSelect={toggleUserSelection}
                />
              ))}
            </div>

            {hasMoreUsers && (
              <div className="mt-4 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSections((current) => ({
                      ...current,
                      [sectionKey]: !isExpanded,
                    }))
                  }
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${
                    isExpanded
                      ? "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                      : `border-transparent bg-gradient-to-r ${classes.badge} text-white hover:opacity-95`
                  }`}
                >
                  <span>{isExpanded ? "Lihat lebih sedikit" : `Lihat lebih banyak (${users.length - DEFAULT_VISIBLE_USERS} lagi)`}</span>
                  <svg
                    className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderKabupatenSection = (kabupaten: KabupatenId) => {
    const kabupatenMeta = KABUPATEN_OPTIONS.find((item) => item.id === kabupaten);
    const users = getUsersByKabupaten(kabupaten);
    const tone =
      kabupaten === "tabanan"
        ? {
            wrap: "border-emerald-200 bg-emerald-50/50",
            header: "from-emerald-600 to-teal-600",
            badge: "bg-white/20 text-white",
          }
        : {
            wrap: "border-sky-200 bg-sky-50/50",
            header: "from-sky-600 to-blue-600",
            badge: "bg-white/20 text-white",
          };

    return (
      <section key={kabupaten} className={`rounded-2xl border ${tone.wrap} p-4 lg:p-5`}>
        <div className={`mb-5 rounded-xl bg-gradient-to-r ${tone.header} px-5 py-4 text-white shadow-md`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold">{kabupatenMeta?.name || kabupaten}</h3>
              <p className="text-sm text-white/80">{kabupatenMeta?.description || "Kelompok pengguna wilayah"}</p>
            </div>
            <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${tone.badge}`}>
              {users.length} pengguna
            </span>
          </div>
        </div>

        <div className="space-y-6">
          {roleSections.map((section) => (
            <div key={`${kabupaten}-${section.role}`}>
              {renderUserSection(
                section.title,
                getUsersByKabupatenAndRole(kabupaten, section.role),
                section.color
              )}
            </div>
          ))}
          <div key={`${kabupaten}-petugas-om`}>
            {renderUserSection("Petugas O&M", getOmUsersByKabupaten(kabupaten), "indigo")}
          </div>
        </div>
      </section>
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
                 <p className="mt-2 text-xs lg:text-sm text-purple-100/90">
                  Memuat {USER_FETCH_LIMIT} pengguna per halaman dari Supabase, atau tampilkan semuanya sekaligus.
                 </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => void fetchUsers(true)}
                disabled={refreshing}
                className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 disabled:bg-white/10 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl border border-white/20"
              >
                <svg className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{refreshing ? "Memuat..." : "Refresh Data"}</span>
              </button>
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
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Memuat data pengguna...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 rounded-2xl border border-purple-100 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="flex-1">
                  <label className="mb-2 block text-sm font-semibold text-gray-800">
                    Cari Pengguna
                  </label>
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleSearchUsers();
                      }
                    }}
                    placeholder="Cari nama, username, email, role, atau wilayah..."
                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-medium text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSearchUsers()}
                    className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-purple-700"
                  >
                    Cari
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleResetSearch()}
                    disabled={!searchInput && !activeSearchQuery}
                    className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reset
                  </button>
                </div>
              </div>
              {activeSearchQuery ? (
                <p className="mt-3 text-xs font-medium text-purple-700">
                  Menampilkan hasil pencarian untuk: <span className="font-bold">{activeSearchQuery}</span>
                </p>
              ) : (
                  <p className="mt-3 text-xs text-gray-500">
                    Pencarian dilakukan ke backend, jadi user bisa ditemukan walau belum tampil di batch awal.
                  </p>
                )}
              </div>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-purple-100 bg-white px-4 py-3 shadow-sm">
              <p className="text-sm font-medium text-gray-700">
                {activeSearchQuery ? "Total hasil pencarian: " : "Total pengguna yang sudah dimuat: "}
                <span className="font-bold text-purple-700">{allUsers.length}</span>
              </p>
              <p className="text-xs text-gray-500">
                {activeSearchQuery
                  ? "Hasil diambil dari query pencarian backend."
                  : `Data dimuat bertahap per ${USER_FETCH_LIMIT} item.`}
              </p>
            </div>

            {isSuperAdmin ? (
              <div className="mb-6 rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="inline-flex items-center gap-3 text-sm font-semibold text-gray-800">
                      <input
                        type="checkbox"
                        checked={allUsers.length > 0 && selectedUserIds.length === allUsers.length}
                        onChange={toggleSelectAllLoadedUsers}
                        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span>Pilih semua user yang sudah dimuat</span>
                    </label>
                    <span className="text-xs font-medium text-gray-500">
                      {selectedUserIds.length > 0
                        ? `${selectedUserIds.length} user dipilih`
                        : "Belum ada user yang dipilih"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleBulkDeleteUsers()}
                    disabled={selectedUserIds.length === 0 || bulkDeleting}
                    className="rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-red-700 hover:to-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {bulkDeleting ? "Menghapus..." : "Hapus User Terpilih"}
                  </button>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  Penghapusan massal ini ikut membersihkan data user di tabel sistem dan akun auth Supabase.
                </p>
              </div>
            ) : null}

            <div className="space-y-6">
              {renderUserSection("Super Administrator", superAdmins, "red")}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Daftar User Per Kabupaten</h3>
                    <p className="text-sm text-gray-500">Pilih folder wilayah agar daftar tidak terlalu panjang.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                    {KABUPATEN_OPTIONS.map((item) => {
                      const count = getUsersByKabupaten(item.id).length;
                      const active = activeKabupatenTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveKabupatenTab(item.id)}
                          className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                            active
                              ? "bg-white text-purple-700 shadow-sm ring-1 ring-purple-100"
                              : "text-slate-600 hover:bg-white/70"
                          }`}
                        >
                          <span>{item.name}</span>
                          <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${active ? "bg-purple-50 text-purple-700" : "bg-slate-200 text-slate-600"}`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {renderKabupatenSection(activeKabupatenTab)}
              </div>
            </div>

            {hasMoreUsers && !activeSearchQuery && (
              <div className="mt-8 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void handleLoadMoreUsers()}
                    disabled={loadingMoreUsers || loadingAllUsers}
                    className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-400"
                  >
                    <span>{loadingMoreUsers ? "Memuat..." : `Muat ${USER_FETCH_LIMIT} pengguna berikutnya`}</span>
                    {!loadingMoreUsers && (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLoadAllUsers()}
                    disabled={loadingMoreUsers || loadingAllUsers}
                    className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-white px-5 py-3 text-sm font-semibold text-purple-700 shadow-sm transition-all hover:border-purple-300 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span>{loadingAllUsers ? "Memuat semua..." : "Tampilkan semua user"}</span>
                    {!loadingAllUsers && (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
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

              {!isSelectedRoleSuperAdmin ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Wilayah / Kabupaten
                  </label>
                  <select
                    value={formData.kabupaten}
                    onChange={(e) => setFormData({ ...formData, kabupaten: e.target.value as KabupatenId })}
                    className="w-full px-4 py-3 text-black font-medium border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all bg-white"
                    required
                  >
                    {KABUPATEN_OPTIONS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-gray-500">
                    Admin dan petugas akan membaca data sesuai wilayah ini. Untuk data lama, fokus awal tetap tabanan.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                  Super Admin tidak memakai wilayah karena aksesnya penuh ke semua kabupaten.
                </div>
              )}

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

                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border-2 border-gray-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        {selectedUser.role === "super-admin" ? "Akses Wilayah" : "Wilayah / Kabupaten"}
                      </p>
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg font-bold shadow-sm mt-1">
                        {selectedUser.role === "super-admin"
                          ? "Semua wilayah"
                          : KABUPATEN_OPTIONS.find((item) => item.id === (selectedUser.kabupaten || "tabanan"))?.name || selectedUser.kabupaten || "Tabanan"}
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
