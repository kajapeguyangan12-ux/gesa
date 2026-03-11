"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

type TaskNotification = {
  id: string;
  designUploadId?: string;
  assigneeId?: string;
  assigneeName?: string;
  status?: string;
  zones?: any[];
  createdAt?: any;
  createdByName?: string;
};

function NotificationsContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<TaskNotification[]>([]);

  useEffect(() => {
    if (user?.uid) {
      loadNotifications();
    }
  }, [user?.uid]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "design_tasks"),
        where("assigneeId", "==", user?.uid || "")
      );
      const snapshot = await getDocs(q);
      setItems(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as TaskNotification)));
    } catch (e) {
      console.error("Failed to load notifications:", e);
      setItems([]);
    } finally {
      setLoading(false);
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

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-md px-4 pb-24 pt-3">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-gray-200 pb-3">
          <div className="text-center flex-1">
            <div className="text-xs uppercase tracking-wide text-gray-400">dashboard</div>
            <div className="text-base font-bold text-gray-900">Notifikasi</div>
          </div>
          <div className="relative w-12 h-12">
            <Image src="/BDG1.png" alt="Logo" fill className="object-contain" />
          </div>
        </header>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Notifikasi muncul ketika admin memberikan tugas ke petugas.
          </div>
          <button
            onClick={loadNotifications}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            Muat Ulang
          </button>
        </div>

        {/* List */}
        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="text-sm text-gray-500">Memuat notifikasi...</div>
          ) : items.length === 0 ? (
            <div className="border border-gray-200 rounded-xl p-6 text-center text-xs text-gray-500">
              Belum ada notifikasi tugas.
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-left shadow-sm"
              >
                <div className="text-sm font-semibold text-gray-900">
                  Tugas baru dari {item.createdByName || "Admin"}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Design: {item.designUploadId || "-"} â€¢ Zona: {item.zones?.length || 0}
                </div>
                <div className="text-xs text-gray-500 text-right mt-1">
                  {formatDate(item.createdAt)}
                </div>
              </button>
            ))
          )}
        </div>
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
            className="flex flex-col items-center justify-center gap-1 text-red-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="text-xs font-semibold">Notifikasi</span>
          </button>

          <button
            onClick={() => router.push("/profile")}
            className="flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-red-600 transition-colors"
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

export default function NotificationsPage() {
  return (
    <ProtectedRoute>
      <NotificationsContent />
    </ProtectedRoute>
  );
}
