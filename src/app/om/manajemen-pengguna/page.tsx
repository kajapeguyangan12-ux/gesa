"use client";

import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { OMPageShell } from "@/components/om/OMPageShell";
import { KABUPATEN_OPTIONS } from "@/utils/constants";
import { useAuth } from "@/hooks/useAuth";

type OMUserRole = "petugas-om" | "petugas-om-preventif" | "petugas-om-correctif";

type OMUser = {
  id: string;
  uid: string;
  name: string;
  username: string;
  email: string;
  role: OMUserRole | string;
  phoneNumber?: string;
  kabupaten?: string;
  createdAt?: string;
};

type UserForm = {
  id: string;
  name: string;
  username: string;
  email: string;
  password: string;
  role: OMUserRole;
  phoneNumber: string;
  kabupaten: string;
};

const OM_ROLE_LABELS: Record<OMUserRole, string> = {
  "petugas-om": "Petugas O&M Preventif (Legacy)",
  "petugas-om-preventif": "Petugas O&M Preventif",
  "petugas-om-correctif": "Petugas O&M Correctif",
};

const emptyForm: UserForm = {
  id: "",
  name: "",
  username: "",
  email: "",
  password: "",
  role: "petugas-om-preventif",
  phoneNumber: "",
  kabupaten: "tabanan",
};

function isOmRole(role: string): role is OMUserRole {
  return role === "petugas-om" || role === "petugas-om-preventif" || role === "petugas-om-correctif";
}

function normalizeRole(role: string) {
  return role === "petugas-om" ? "petugas-om-preventif" : role;
}

function RolePill({ role }: { role: string }) {
  const normalizedRole = normalizeRole(role);
  const tone =
    normalizedRole === "petugas-om-correctif"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {OM_ROLE_LABELS[role as OMUserRole] || OM_ROLE_LABELS[normalizedRole as OMUserRole] || role}
    </span>
  );
}

function OMUserManagementContent() {
  const { user: currentUser } = useAuth();
  const accountKabupaten = currentUser?.role === "super-admin" ? "" : currentUser?.kabupaten?.trim().toLowerCase() || "tabanan";
  const [users, setUsers] = useState<OMUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | OMUserRole>("all");
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const pageSize = 200;
      let offset = 0;
      let hasMore = true;
      const rows: OMUser[] = [];

      while (hasMore) {
        const params = new URLSearchParams({
          limit: String(pageSize),
          offset: String(offset),
        });
        if (accountKabupaten) params.set("kabupaten", accountKabupaten);
        const response = await fetch(`/api/admin/user-admin?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as {
          users?: OMUser[];
          hasMore?: boolean;
          nextOffset?: number;
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error || "Gagal memuat user O&M.");
        const batch = payload.users || [];
        rows.push(...batch.filter((user) => isOmRole(user.role || "")));
        hasMore = Boolean(payload.hasMore);
        offset = typeof payload.nextOffset === "number" ? payload.nextOffset : offset + batch.length;
        if (batch.length === 0) hasMore = false;
      }

      setUsers(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat user O&M.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, [accountKabupaten]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return users.filter((user) => {
      const normalizedRole = normalizeRole(user.role || "");
      const roleMatches = roleFilter === "all" || normalizedRole === roleFilter;
      const keywordMatches =
        !keyword ||
        user.name.toLowerCase().includes(keyword) ||
        user.username.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword) ||
        (user.phoneNumber || "").toLowerCase().includes(keyword);
      return roleMatches && keywordMatches;
    });
  }, [roleFilter, search, users]);

  const counts = useMemo(
    () => ({
      total: users.length,
      preventif: users.filter((user) => normalizeRole(user.role || "") === "petugas-om-preventif").length,
      correctif: users.filter((user) => normalizeRole(user.role || "") === "petugas-om-correctif").length,
    }),
    [users]
  );

  const openAddForm = () => {
    setFormMode("add");
    setForm({ ...emptyForm, kabupaten: accountKabupaten || emptyForm.kabupaten });
    setError("");
    setMessage("");
    setShowForm(true);
  };

  const openEditForm = (user: OMUser) => {
    setFormMode("edit");
    setForm({
      id: user.id || user.uid,
      name: user.name || "",
      username: user.username || "",
      email: user.email || "",
      password: "",
      role: isOmRole(normalizeRole(user.role || "")) ? (normalizeRole(user.role || "") as OMUserRole) : "petugas-om-preventif",
      phoneNumber: user.phoneNumber || "",
      kabupaten: accountKabupaten || user.kabupaten || "tabanan",
    });
    setError("");
    setMessage("");
    setShowForm(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.name.trim() || !form.username.trim() || !form.email.trim() || !form.role || !form.kabupaten) {
      setError("Nama, username, email, role, dan kabupaten wajib diisi.");
      return;
    }

    if (formMode === "add" && !form.password.trim()) {
      setError("Password wajib diisi untuk user baru.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        phoneNumber: form.phoneNumber.trim(),
        kabupaten: accountKabupaten || form.kabupaten,
        actorRole: currentUser?.role || "admin",
        actorKabupaten: accountKabupaten,
      };
      const response = await fetch(
        formMode === "add" ? "/api/admin/user-admin" : `/api/admin/user-admin/${encodeURIComponent(form.id)}`,
        {
          method: formMode === "add" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Gagal menyimpan user O&M.");

      setMessage(formMode === "add" ? "User O&M berhasil ditambahkan." : "User O&M berhasil diperbarui.");
      setShowForm(false);
      setForm(emptyForm);
      await fetchUsers();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Gagal menyimpan user O&M.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (user: OMUser) => {
    const confirmed = confirm(`Hapus user O&M "${user.name || user.email}"? Akun auth juga akan ikut dihapus.`);
    if (!confirmed) return;

    setDeletingId(user.id || user.uid);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/user-admin/${encodeURIComponent(user.id || user.uid)}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Gagal menghapus user O&M.");
      setMessage("User O&M berhasil dihapus.");
      await fetchUsers();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Gagal menghapus user O&M.");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <OMPageShell
      eyebrow="Manajemen Pengguna"
      title="Kelola akun petugas O&M preventif dan correctif dalam satu workspace."
      description="Panel ini hanya menampilkan user yang terkait modul O&M, sehingga admin bisa menambah, mengedit, dan menghapus petugas tanpa bercampur role lain."
      statusTitle="Kontrol user O&M sudah aktif."
      statusDescription="Data diambil dari user admin Supabase dan difilter khusus role O&M preventif, correctif, serta legacy petugas O&M."
      metaCards={[
        { label: "Total", value: String(counts.total), hint: "Semua petugas O&M", tone: "teal" },
        { label: "Preventif", value: String(counts.preventif), hint: "Termasuk role legacy", tone: "emerald" },
        { label: "Correctif", value: String(counts.correctif), hint: "Petugas korektif", tone: "cyan" },
        { label: "Mode", value: "CRUD", hint: "Tambah, edit, hapus", tone: "slate" },
      ]}
    >
      <div className="rounded-[28px] border border-white/70 bg-white/92 p-5 shadow-[0_18px_40px_-26px_rgba(15,23,42,0.38)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Cari petugas</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                placeholder="Nama, username, email, atau no. telp"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Filter role</span>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as "all" | OMUserRole)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
              >
                <option value="all">Semua O&M</option>
                <option value="petugas-om-preventif">Preventif</option>
                <option value="petugas-om-correctif">Correctif</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={openAddForm}
            className="rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-200/60 transition hover:brightness-105"
          >
            Tambah User O&M
          </button>
        </div>

        {message ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
        {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        {showForm ? (
          <form onSubmit={handleSubmit} className="mt-5 rounded-[24px] border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-bold text-slate-950">{formMode === "add" ? "Tambah User O&M" : "Edit User O&M"}</div>
                <div className="text-sm text-slate-500">{formMode === "add" ? "Buat akun petugas preventif atau correctif." : "Ubah data akun petugas O&M."}</div>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600">
                Tutup
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-400" placeholder="Nama lengkap" />
              <input value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-400" placeholder="Username" />
              <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-400" placeholder="Email" type="email" />
              <input value={form.phoneNumber} onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-400" placeholder="No. telp" />
              <input value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-400" placeholder={formMode === "add" ? "Password" : "Password baru (opsional)"} type="password" />
              <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as OMUserRole }))} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-400">
                <option value="petugas-om-preventif">Petugas O&M Preventif</option>
                <option value="petugas-om-correctif">Petugas O&M Correctif</option>
              </select>
              <select disabled={Boolean(accountKabupaten)} value={accountKabupaten || form.kabupaten} onChange={(event) => setForm((current) => ({ ...current, kabupaten: event.target.value }))} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-400 disabled:bg-slate-100">
                {KABUPATEN_OPTIONS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={submitting} className="mt-4 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {submitting ? "Menyimpan..." : formMode === "add" ? "Tambah User" : "Simpan Perubahan"}
            </button>
          </form>
        ) : null}

        <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200">
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Memuat petugas O&M...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">Belum ada petugas O&M untuk filter ini.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredUsers.map((user) => (
                <div key={user.id || user.uid} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-base font-bold text-slate-950">{user.name || user.email}</div>
                      <RolePill role={user.role} />
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      @{user.username || "-"} • {user.email || "-"} • {user.phoneNumber || "No. telp belum diisi"}
                    </div>
                    <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{user.kabupaten || "tabanan"}</div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEditForm(user)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(user)}
                      disabled={deletingId === (user.id || user.uid)}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                    >
                      {deletingId === (user.id || user.uid) ? "Hapus..." : "Hapus"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </OMPageShell>
  );
}

export default function OMManajemenPenggunaPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "super-admin"]}>
      <OMUserManagementContent />
    </ProtectedRoute>
  );
}
