"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";

function ProfileContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [showManage, setShowManage] = useState(false);

  const [form, setForm] = useState({
    username: user?.username || "",
    email: user?.email || "",
    name: user?.displayName || user?.name || "",
    newPassword: "",
    confirmPassword: "",
  });

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-md px-4 pb-24 pt-3">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-gray-200 pb-3">
          <button
            onClick={() => (showManage ? setShowManage(false) : router.push("/kontruksi"))}
            className="w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center shadow-sm"
            aria-label="Kembali"
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="text-center flex-1">
            <div className="text-xs uppercase tracking-wide text-gray-400">dashboard</div>
            <div className="text-base font-bold text-gray-900">Profil</div>
          </div>
          <div className="relative w-12 h-12">
            <Image src="/BDG1.png" alt="Logo" fill className="object-contain" />
          </div>
        </header>

        {!showManage ? (
          <div className="mt-6 space-y-6">
            <div className="flex flex-col items-center gap-3">
              <div className="w-28 h-28 rounded-full border-4 border-gray-200 bg-gray-50 flex items-center justify-center text-4xl text-gray-600">
                {(user?.displayName || user?.email || "P").charAt(0).toUpperCase()}
              </div>
              <button className="text-xs text-blue-600 font-semibold">Edit</button>
            </div>

            <div className="space-y-3">
              <div className="border border-gray-300 rounded-full px-4 py-2 text-sm">
                {user?.displayName || "Nama Petugas"}
              </div>
              <div className="border border-gray-300 rounded-full px-4 py-2 text-sm">
                {user?.phoneNumber || "No. Telp"}
              </div>
              <div className="border border-gray-300 rounded-full px-4 py-2 text-sm">
                {user?.email || "Email"}
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setShowManage(true)}
                className="px-6 py-2 rounded-full border border-gray-300 text-sm font-semibold"
              >
                Kelola Akun
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 border border-gray-300 rounded-2xl p-4 space-y-4">
            <div className="text-center text-sm font-semibold text-gray-700">
              Kelola Akun Anda Dibawah ini
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-500">Username</label>
              <div className="flex items-center gap-2 border border-gray-300 rounded-full px-3 py-2">
                <input
                  className="flex-1 text-sm outline-none"
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                />
                <span className="text-gray-400">✎</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-500">Email</label>
              <div className="flex items-center gap-2 border border-gray-300 rounded-full px-3 py-2">
                <input
                  className="flex-1 text-sm outline-none"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                />
                <span className="text-gray-400">✎</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-500">Nama</label>
              <div className="flex items-center gap-2 border border-gray-300 rounded-full px-3 py-2">
                <input
                  className="flex-1 text-sm outline-none"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
                <span className="text-gray-400">✎</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-500">Kata Sandi Baru</label>
              <input
                type="password"
                className="w-full border border-gray-300 rounded-full px-3 py-2 text-sm"
                placeholder="Masukkan Sandi Baru Jika Ingin Mengubah"
                value={form.newPassword}
                onChange={(e) => setForm((prev) => ({ ...prev, newPassword: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-500">Konfirmasi Kata Sandi</label>
              <input
                type="password"
                className="w-full border border-gray-300 rounded-full px-3 py-2 text-sm"
                placeholder="Masukkan Ulang Kata Sandi Baru"
                value={form.confirmPassword}
                onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              />
            </div>

            <div className="flex justify-center pt-2">
              <button className="px-6 py-2 rounded-full border border-gray-300 bg-blue-50 text-sm font-semibold">
                Simpan Perubahan
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="mx-auto w-full max-w-md grid grid-cols-3 h-16">
          <button
            onClick={() => router.push("/kontruksi")}
            className="flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-red-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 13h1v7c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-7h1a1 1 0 00.707-1.707l-9-9a.999.999 0 00-1.414 0l-9 9A1 1 0 003 13z" />
            </svg>
            <span className="text-xs font-semibold">Home</span>
          </button>

          <button
            onClick={() => router.push("/notifications")}
            className="flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-red-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="text-xs font-semibold">Notifikasi</span>
          </button>

          <button
            onClick={() => router.push("/profile")}
            className="flex flex-col items-center justify-center gap-1 text-red-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs font-semibold">Profil</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
