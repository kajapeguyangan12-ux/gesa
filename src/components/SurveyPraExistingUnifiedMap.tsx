"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import dynamic from "next/dynamic";
import type { TaskNavigationInfo } from "@/utils/taskNavigation";
import { formatWitaDateTime } from "@/utils/dateTime";

const KMZTaskOverlay = dynamic(() => import("./KMZTaskOverlay"), { ssr: false });
const DEFAULT_POSITION: [number, number] = [-8.4095, 115.1889];

type LeafletDefaultProto = L.Icon.Default & { _getIconUrl?: unknown };

if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as LeafletDefaultProto)._getIconUrl;

  L.Icon.Default.mergeOptions({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

const submittedSurveyIcon = L.divIcon({
  className: "submitted-survey-marker",
  html: `
    <div style="position:relative;width:20px;height:20px;">
      <div style="width:20px;height:20px;border-radius:9999px;background:#10b981;border:3px solid #ffffff;box-shadow:0 4px 12px rgba(16,185,129,0.35);"></div>
      <div style="position:absolute;left:50%;top:16px;width:10px;height:10px;background:#10b981;transform:translateX(-50%) rotate(45deg);border-bottom:3px solid #ffffff;border-right:3px solid #ffffff;"></div>
    </div>
  `,
  iconSize: [20, 28],
  iconAnchor: [10, 28],
  popupAnchor: [0, -24],
});

const currentUserIcon = L.divIcon({
  className: "current-user-marker",
  html: `
    <div style="position:relative;width:24px;height:24px;">
      <div style="position:absolute;inset:0;border-radius:9999px;background:#2563eb;border:3px solid #ffffff;box-shadow:0 6px 18px rgba(37,99,235,0.38);"></div>
      <div style="position:absolute;left:50%;top:19px;width:12px;height:12px;background:#2563eb;transform:translateX(-50%) rotate(45deg);border-bottom:3px solid #ffffff;border-right:3px solid #ffffff;"></div>
      <div style="position:absolute;left:50%;top:50%;width:7px;height:7px;border-radius:9999px;background:#ffffff;transform:translate(-50%,-50%);"></div>
    </div>
  `,
  iconSize: [24, 34],
  iconAnchor: [12, 34],
  popupAnchor: [0, -28],
});

interface SubmittedSurveyMapData {
  id: string;
  latitude: number;
  longitude: number;
  kecamatan?: string;
  desa?: string;
  banjar?: string;
  namaJalan?: string;
  kepemilikanTiang?: string;
  surveyorName?: string;
  createdAt?: { toDate?: () => Date } | Date | string | number | null;
  status?: string;
}

interface SurveyPraExistingUnifiedMapProps {
  latitude: number | null;
  longitude: number | null;
  accuracy: number;
  hasGPS: boolean;
  kmzFileUrl?: string;
  completedPoints?: string[];
  trackingPath?: Array<{ lat: number; lng: number }>;
  onPointComplete?: (pointId: string, pointName: string, lat: number, lng: number) => void;
  onTaskNavigationInfoChange?: (info: TaskNavigationInfo | null) => void;
  surveyData: SubmittedSurveyMapData[];
}

function MapUpdater({ center, hasGPS, initialZoom }: { center: [number, number]; hasGPS: boolean; initialZoom: number }) {
  const map = useMap();
  const previousCenterRef = useRef<[number, number] | null>(null);
  const hasAutoFocusedGPSRef = useRef(false);

  useEffect(() => {
    if (!map) {
      return;
    }

    if (!previousCenterRef.current) {
      map.setView(center, initialZoom, { animate: false });
      previousCenterRef.current = center;
      hasAutoFocusedGPSRef.current = hasGPS;
      return;
    }

    const [previousLat, previousLng] = previousCenterRef.current;
    const movedEnough = Math.abs(previousLat - center[0]) > 0.00003 || Math.abs(previousLng - center[1]) > 0.00003;

    if (hasGPS && !hasAutoFocusedGPSRef.current) {
      map.setView(center, 18, { animate: true, duration: 1 });
      hasAutoFocusedGPSRef.current = true;
      previousCenterRef.current = center;
      return;
    }

    if (movedEnough) {
      map.panTo(center, { animate: true, duration: 1 });
      previousCenterRef.current = center;
    }

    if (!hasGPS) {
      hasAutoFocusedGPSRef.current = false;
    }
  }, [center, hasGPS, initialZoom, map]);

  return null;
}

function MapWithKMZ({
  kmzFileUrl,
  currentPosition,
  completedPoints,
  onPointComplete,
  onTaskNavigationInfoChange,
}: {
  kmzFileUrl?: string;
  currentPosition?: { lat: number; lng: number } | null;
  completedPoints?: string[];
  onPointComplete?: (pointId: string, pointName: string, lat: number, lng: number) => void;
  onTaskNavigationInfoChange?: (info: TaskNavigationInfo | null) => void;
}) {
  const map = useMap();

  return kmzFileUrl ? (
    <KMZTaskOverlay
      map={map}
      kmzFileUrl={kmzFileUrl}
      currentPosition={currentPosition}
      completedPoints={completedPoints}
      onPointComplete={onPointComplete}
      onTaskNavigationInfoChange={onTaskNavigationInfoChange}
    />
  ) : null;
}

export default function SurveyPraExistingUnifiedMap({
  latitude,
  longitude,
  accuracy,
  hasGPS,
  kmzFileUrl,
  completedPoints,
  trackingPath = [],
  onPointComplete,
  onTaskNavigationInfoChange,
  surveyData,
}: SurveyPraExistingUnifiedMapProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 120);
    return () => clearTimeout(timer);
  }, []);

  const markerData = useMemo(() => {
    const duplicateCounter = new Map<string, number>();

    return surveyData.map((survey) => {
      const key = `${survey.latitude.toFixed(6)}_${survey.longitude.toFixed(6)}`;
      const duplicateIndex = duplicateCounter.get(key) || 0;
      duplicateCounter.set(key, duplicateIndex + 1);

      if (duplicateIndex === 0) {
        return {
          ...survey,
          markerLatitude: survey.latitude,
          markerLongitude: survey.longitude,
          duplicateIndex,
        };
      }

      const angle = duplicateIndex * 0.9;
      const latOffset = Math.cos(angle) * 0.00008 * duplicateIndex;
      const lngOffset = Math.sin(angle) * 0.00008 * duplicateIndex;

      return {
        ...survey,
        markerLatitude: survey.latitude + latOffset,
        markerLongitude: survey.longitude + lngOffset,
        duplicateIndex,
      };
    });
  }, [surveyData]);

  const position = useMemo<[number, number]>(() => {
    if (latitude !== null && longitude !== null) {
      return [latitude, longitude];
    }

    if (surveyData.length > 0) {
      return [
        surveyData.reduce((sum, item) => sum + item.latitude, 0) / surveyData.length,
        surveyData.reduce((sum, item) => sum + item.longitude, 0) / surveyData.length,
      ];
    }

    return DEFAULT_POSITION;
  }, [latitude, longitude, surveyData]);

  const currentPosition = useMemo(
    () => (latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null),
    [latitude, longitude]
  );
  const initialZoom = hasGPS ? 18 : surveyData.length > 0 ? 13 : 12;

  const formatDate = (value: SubmittedSurveyMapData["createdAt"]) => {
    if (!value) return "-";
    return formatWitaDateTime(value) || "-";
  };

  const getAccuracyColor = (acc: number): string => {
    if (acc < 10) return "#10b981";
    if (acc < 20) return "#3b82f6";
    if (acc < 50) return "#f59e0b";
    return "#ef4444";
  };

  const getGPSStatusText = (): string => {
    if (!hasGPS) return "GPS Tidak Aktif";
    if (accuracy < 10) return "GPS Presisi Tinggi";
    if (accuracy < 20) return "GPS Akurat";
    if (accuracy < 50) return "GPS Cukup Baik";
    return "GPS Kurang Presisi";
  };

  if (!ready) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-2xl border border-blue-200 bg-slate-100 sm:h-[340px] lg:h-[420px]">
        <div className="text-center">
          <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="text-sm text-slate-500">Memuat peta gabungan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[280px] overflow-hidden rounded-2xl border border-blue-200 shadow-sm sm:h-[340px] lg:h-[420px]">
      <MapContainer center={position} zoom={initialZoom} style={{ height: "100%", width: "100%", zIndex: 0 }} zoomControl scrollWheelZoom attributionControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={20}
        />

        <MapWithKMZ
          kmzFileUrl={kmzFileUrl}
          currentPosition={currentPosition}
          completedPoints={completedPoints}
          onPointComplete={onPointComplete}
          onTaskNavigationInfoChange={onTaskNavigationInfoChange}
        />

        {markerData.map((survey) => (
          <Marker key={survey.id} position={[survey.markerLatitude, survey.markerLongitude]} icon={submittedSurveyIcon}>
            <Popup>
              <div className="min-w-[200px] p-2 text-xs">
                <p className="text-sm font-bold text-slate-900">Survey Pra Existing</p>
                {survey.duplicateIndex > 0 && (
                  <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                    Marker digeser sedikit karena koordinat sama dengan titik lain.
                  </p>
                )}
                <div className="mt-2 space-y-1 text-slate-700">
                  <p><span className="font-semibold">Lokasi:</span> {[survey.desa, survey.banjar, survey.namaJalan].filter(Boolean).join(" - ") || "-"}</p>
                  <p><span className="font-semibold">Kecamatan:</span> {survey.kecamatan || "-"}</p>
                  <p><span className="font-semibold">Kepemilikan:</span> {survey.kepemilikanTiang || "-"}</p>
                  <p><span className="font-semibold">Surveyor:</span> {survey.surveyorName || "-"}</p>
                  <p><span className="font-semibold">Waktu:</span> {formatDate(survey.createdAt)}</p>
                  <p><span className="font-semibold">Koordinat:</span> {survey.latitude.toFixed(6)}, {survey.longitude.toFixed(6)}</p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {trackingPath.length > 1 && (
          <Polyline
            positions={trackingPath.map((point) => [point.lat, point.lng] as [number, number])}
            pathOptions={{ color: "#2563EB", weight: 4, opacity: 0.8 }}
          />
        )}

        {hasGPS && latitude !== null && longitude !== null && (
          <>
            <Circle
              center={[latitude, longitude]}
              radius={Math.max(accuracy, 5)}
              pathOptions={{
                color: getAccuracyColor(accuracy),
                fillColor: getAccuracyColor(accuracy),
                fillOpacity: 0.12,
                weight: 1,
              }}
            />
            <Marker position={[latitude, longitude]} icon={currentUserIcon}>
              <Popup>
                <div style={{ padding: "8px", minWidth: "170px" }}>
                  <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Lokasi GPS Anda</div>
                  <div style={{ fontSize: "12px", color: "#666" }}>
                    Lat: {latitude.toFixed(6)}<br />
                    Lng: {longitude.toFixed(6)}<br />
                    Akurasi: +/-{accuracy.toFixed(1)}m
                  </div>
                  <div style={{ paddingTop: "8px", borderTop: "1px solid #ddd", marginTop: "8px" }}>
                    <p style={{ fontSize: "12px", fontWeight: "600", margin: "0" }}>{getGPSStatusText()}</p>
                    {trackingPath.length > 1 && (
                      <p style={{ fontSize: "11px", margin: "6px 0 0", color: "#2563EB" }}>Tracking tersimpan: {trackingPath.length} titik</p>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        <MapUpdater center={position} hasGPS={hasGPS} initialZoom={initialZoom} />
      </MapContainer>

      <div className="pointer-events-none absolute left-2 right-2 top-2 flex items-start justify-between gap-2">
        <div className="rounded-lg bg-white/95 px-3 py-1.5 text-xs font-bold shadow-md backdrop-blur">
          {hasGPS ? (
            <>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-green-500"></span>
              +/-{accuracy.toFixed(1)}m
            </>
          ) : (
            <span className="text-amber-700">GPS belum aktif</span>
          )}
        </div>
        <div className="rounded-lg bg-blue-600/95 px-3 py-1.5 text-xs font-semibold text-white shadow-md">
          {trackingPath.length > 1 ? `Tracking ${trackingPath.length} titik` : `${markerData.length} titik survey`}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-8 left-2 rounded-lg bg-white/95 px-3 py-2 text-[11px] text-slate-700 shadow-md backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-blue-600 ring-2 ring-white"></span>
            Posisi Anda
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white"></span>
            Titik Survey
          </span>
        </div>
      </div>
    </div>
  );
}
