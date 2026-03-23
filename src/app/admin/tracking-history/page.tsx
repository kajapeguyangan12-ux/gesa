"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import dynamic from "next/dynamic";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Interface for TrackingHistoryMap props
interface TrackingHistoryMapProps {
  trackingPath: Array<{lat: number, lng: number, timestamp?: number}>;
}

// Dynamic import for Tracking Map
const DynamicTrackingMap = dynamic<TrackingHistoryMapProps>(
  () => import("../../../components/TrackingHistoryMap"),
  { 
    ssr: false,
    loading: () => (
      <div className="rounded-xl overflow-hidden border-2 border-purple-200 shadow-lg flex items-center justify-center bg-gray-100" style={{ height: '500px' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Memuat peta tracking...</p>
        </div>
      </div>
    )
  }
);

interface TrackingSession {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  startTime: any;
  endTime: any;
  status: string;
  path: Array<{lat: number, lng: number, timestamp: number}>;
  totalDistance: number;
  pointsCount: number;
  duration: number;
  surveyType: string;
}

function TrackingHistoryContent() {
  const router = useRouter();
  const { user } = useAuth();

  const [trackingSessions, setTrackingSessions] = useState<TrackingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<TrackingSession | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterUser, setFilterUser] = useState<string>("all");

  useEffect(() => {
    loadTrackingSessions();
  }, []);

  const loadTrackingSessions = async () => {
    try {
      setLoading(true);
      const sessionsQuery = query(
        collection(db, "tracking-sessions"),
        orderBy("startTime", "desc")
      );
      const querySnapshot = await getDocs(sessionsQuery);
      const sessions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TrackingSession[];
      
      setTrackingSessions(sessions);
      console.log("Loaded tracking sessions:", sessions.length);
    } catch (error) {
      console.error("Error loading tracking sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      return "N/A";
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}j ${minutes}m ${secs}d`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}d`;
    } else {
      return `${secs}d`;
    }
  };

  const filteredSessions = trackingSessions.filter(session => {
    if (filterStatus !== "all" && session.status !== filterStatus) return false;
    if (filterUser !== "all" && session.userEmail !== filterUser) return false;
    return true;
  });

  const uniqueUsers = Array.from(new Set(trackingSessions.map(s => s.userEmail)));

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/admin/module-selection")}
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">Tracking History</h1>
                <p className="text-xs text-gray-600">Riwayat perjalanan surveyor</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Filter Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all font-semibold text-gray-900 bg-white"
              >
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="completed">Selesai</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Filter Surveyor</label>
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all font-semibold text-gray-900 bg-white"
              >
                <option value="all">Semua Surveyor</option>
                {uniqueUsers.map(email => (
                  <option key={email} value={email}>{email}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Selected Session Map */}
        {selectedSession && (
          <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Detail Tracking</h2>
                <p className="text-sm text-gray-600">{selectedSession.userName} - {formatDate(selectedSession.startTime)}</p>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-all"
              >
                Tutup
              </button>
            </div>

            <DynamicTrackingMap trackingPath={selectedSession.path} />

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs text-gray-600 mb-1">Jarak Total</p>
                <p className="text-lg font-bold text-blue-700">{selectedSession.totalDistance.toFixed(2)} km</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-xs text-gray-600 mb-1">Titik Terekam</p>
                <p className="text-lg font-bold text-green-700">{selectedSession.pointsCount}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3">
                <p className="text-xs text-gray-600 mb-1">Durasi</p>
                <p className="text-lg font-bold text-purple-700">{formatDuration(selectedSession.duration)}</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-3">
                <p className="text-xs text-gray-600 mb-1">Status</p>
                <p className="text-lg font-bold text-orange-700 capitalize">{selectedSession.status}</p>
              </div>
            </div>
          </div>
        )}

        {/* Sessions List */}
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Daftar Tracking Sessions</h2>
              <p className="text-sm text-gray-600">{filteredSessions.length} session ditemukan</p>
            </div>
            <button
              onClick={loadTrackingSessions}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p className="text-gray-500">Memuat data tracking...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">Belum ada data tracking</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className="border-2 border-gray-200 rounded-xl p-4 hover:border-purple-300 hover:bg-purple-50 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        session.status === 'active' ? 'bg-green-100' : 'bg-blue-100'
                      }`}>
                        <svg className={`w-6 h-6 ${
                          session.status === 'active' ? 'text-green-600' : 'text-blue-600'
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{session.userName}</h3>
                        <p className="text-xs text-gray-600">{session.userEmail}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      session.status === 'active' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {session.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    <div>
                      <p className="text-xs text-gray-500">Mulai</p>
                      <p className="text-sm font-semibold text-gray-800">{formatDate(session.startTime)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Selesai</p>
                      <p className="text-sm font-semibold text-gray-800">{session.endTime ? formatDate(session.endTime) : "Belum selesai"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Jarak</p>
                      <p className="text-sm font-semibold text-gray-800">{session.totalDistance?.toFixed(2) || "0.00"} km</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Titik</p>
                      <p className="text-sm font-semibold text-gray-800">{session.pointsCount || session.path?.length || 0}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function TrackingHistoryPage() {
  return (
    <ProtectedRoute>
      <TrackingHistoryContent />
    </ProtectedRoute>
  );
}
