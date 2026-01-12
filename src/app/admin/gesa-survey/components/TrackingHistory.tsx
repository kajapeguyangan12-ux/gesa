"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Dynamic import for Tracking Map
const DynamicTrackingMap = dynamic<{
  trackingPath: Array<{lat: number, lng: number, timestamp?: number}>;
}>(
  () => import("@/components/TrackingHistoryMap").then(mod => mod.default),
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

export default function TrackingHistory() {
  const [trackingSessions, setTrackingSessions] = useState<TrackingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<TrackingSession | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

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
      return `${hours}j ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}d`;
    } else {
      return `${secs}d`;
    }
  };

  const filteredSessions = trackingSessions.filter(session => {
    if (filterStatus !== "all" && session.status !== filterStatus) return false;
    if (filterUser !== "all" && session.userEmail !== filterUser) return false;
    if (filterType !== "all" && session.surveyType !== filterType) return false;
    return true;
  });

  const uniqueUsers = Array.from(new Set(trackingSessions.map(s => s.userEmail)));

  // Calculate statistics
  const totalSessions = filteredSessions.length;
  const activeSessions = filteredSessions.filter(s => s.status === 'active').length;
  const totalDistance = filteredSessions.reduce((sum, s) => sum + (s.totalDistance || 0), 0);
  const totalPoints = filteredSessions.reduce((sum, s) => sum + (s.pointsCount || s.path?.length || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">📍 Tracking History Petugas</h2>
            <p className="text-purple-100 text-sm mt-1">Monitoring perjalanan surveyor real-time</p>
          </div>
          <button
            onClick={loadTrackingSessions}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur rounded-xl transition-all flex items-center gap-2 font-semibold"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur rounded-xl p-4">
            <p className="text-purple-100 text-xs mb-1">Total Session</p>
            <p className="text-3xl font-bold">{totalSessions}</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4">
            <p className="text-purple-100 text-xs mb-1">Aktif Sekarang</p>
            <p className="text-3xl font-bold">{activeSessions}</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4">
            <p className="text-purple-100 text-xs mb-1">Total Jarak</p>
            <p className="text-2xl font-bold">{totalDistance.toFixed(1)} <span className="text-lg">km</span></p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4">
            <p className="text-purple-100 text-xs mb-1">Total Titik</p>
            <p className="text-3xl font-bold">{totalPoints}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Status</label>
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
            <label className="block text-sm font-bold text-gray-700 mb-2">Surveyor</label>
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
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Tipe Survey</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all font-semibold text-gray-900 bg-white"
            >
              <option value="all">Semua Tipe</option>
              <option value="existing">Survey Existing</option>
              <option value="apj-propose">APJ Propose</option>
            </select>
          </div>
        </div>
      </div>

      {/* Selected Session Map */}
      {selectedSession && (
        <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">🗺️ Detail Tracking</h3>
              <p className="text-sm text-gray-600">{selectedSession.userName} • {formatDate(selectedSession.startTime)}</p>
            </div>
            <button
              onClick={() => setSelectedSession(null)}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-all"
            >
              ✕ Tutup
            </button>
          </div>

          <DynamicTrackingMap trackingPath={selectedSession.path} />

          <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-gray-600 mb-1">Jarak Total</p>
              <p className="text-lg font-bold text-blue-700">{selectedSession.totalDistance?.toFixed(2) || "0.00"} km</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-xs text-gray-600 mb-1">Titik Terekam</p>
              <p className="text-lg font-bold text-green-700">{selectedSession.pointsCount || selectedSession.path?.length || 0}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3">
              <p className="text-xs text-gray-600 mb-1">Durasi</p>
              <p className="text-lg font-bold text-purple-700">{formatDuration(selectedSession.duration || 0)}</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-3">
              <p className="text-xs text-gray-600 mb-1">Status</p>
              <p className="text-lg font-bold text-orange-700 capitalize">{selectedSession.status}</p>
            </div>
            <div className="bg-pink-50 rounded-xl p-3">
              <p className="text-xs text-gray-600 mb-1">Tipe Survey</p>
              <p className="text-sm font-bold text-pink-700">{selectedSession.surveyType === 'existing' ? 'Existing' : 'APJ Propose'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900">📋 Daftar Tracking Sessions</h3>
          <p className="text-sm text-gray-600">{filteredSessions.length} session ditemukan</p>
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
            <p className="text-sm text-gray-500 mt-1">Data tracking akan muncul setelah surveyor memulai tracking</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className="border-2 border-gray-200 rounded-xl p-4 hover:border-purple-400 hover:bg-purple-50 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      session.status === 'active' ? 'bg-green-100' : 'bg-blue-100'
                    }`}>
                      <svg className={`w-7 h-7 ${
                        session.status === 'active' ? 'text-green-600' : 'text-blue-600'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{session.userName}</h4>
                      <p className="text-xs text-gray-600">{session.userEmail}</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                        session.surveyType === 'existing' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {session.surveyType === 'existing' ? 'Survey Existing' : 'APJ Propose'}
                      </span>
                    </div>
                  </div>
                  <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                    session.status === 'active' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {session.status === 'active' ? '🟢 AKTIF' : '✓ Selesai'}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Mulai</p>
                    <p className="text-sm font-semibold text-gray-800">{formatDate(session.startTime)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Selesai</p>
                    <p className="text-sm font-semibold text-gray-800">{session.endTime ? formatDate(session.endTime) : "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Jarak</p>
                    <p className="text-sm font-semibold text-gray-800">{session.totalDistance?.toFixed(2) || "0.00"} km</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Titik GPS</p>
                    <p className="text-sm font-semibold text-gray-800">{session.pointsCount || session.path?.length || 0}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
