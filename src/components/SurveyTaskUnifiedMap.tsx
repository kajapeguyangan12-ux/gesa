"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import dynamic from "next/dynamic";
import { loadParsedTaskGeometries } from "@/utils/kmzTaskParser";
import { analyzeTaskNavigation, type ParsedTaskGeometries, type TaskNavigationInfo } from "@/utils/taskNavigation";

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

export interface UnifiedSurveyMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  duplicateMessage?: string;
  details: Array<{ label: string; value: string }>;
  createdAt?: { toDate?: () => Date } | Date | string | number | null;
}

interface SurveyTaskUnifiedMapProps {
  latitude: number | null;
  longitude: number | null;
  accuracy: number;
  hasGPS: boolean;
  kmzFileUrl?: string;
  completedPoints?: string[];
  trackingPath?: Array<{ lat: number; lng: number }>;
  onPointComplete?: (pointId: string, pointName: string, lat: number, lng: number) => void;
  onTaskNavigationInfoChange?: (info: TaskNavigationInfo | null) => void;
  surveyData: UnifiedSurveyMarker[];
  markerColor?: string;
  markerLabel?: string;
  stableOverlay?: boolean;
}

function createMarkerIcon(color: string) {
  return L.divIcon({
    className: "submitted-survey-marker",
    html: `
      <div style="position:relative;width:20px;height:20px;">
        <div style="width:20px;height:20px;border-radius:9999px;background:${color};border:3px solid #ffffff;box-shadow:0 4px 12px rgba(15,23,42,0.22);"></div>
        <div style="position:absolute;left:50%;top:16px;width:10px;height:10px;background:${color};transform:translateX(-50%) rotate(45deg);border-bottom:3px solid #ffffff;border-right:3px solid #ffffff;"></div>
      </div>
    `,
    iconSize: [20, 28],
    iconAnchor: [10, 28],
    popupAnchor: [0, -24],
  });
}

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

function MapUpdater({ center, hasGPS, initialZoom }: { center: [number, number]; hasGPS: boolean; initialZoom: number }) {
  const map = useMap();
  const previousCenterRef = useRef<[number, number] | null>(null);
  const hasAutoFocusedGPSRef = useRef(false);

  useEffect(() => {
    if (!map) return;

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

const emptyGeometries: ParsedTaskGeometries = {
  polygons: [],
  polylines: [],
  points: [],
};

const taskPointIcon = L.divIcon({
  className: "task-kmz-marker",
  html: `
    <div style="position:relative;width:18px;height:18px;">
      <div style="width:18px;height:18px;border-radius:9999px;background:#059669;border:3px solid #ffffff;box-shadow:0 4px 10px rgba(5,150,105,0.28);"></div>
    </div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -12],
});

function DeclarativeKMZOverlay({
  kmzFileUrl,
  currentPosition,
  onTaskNavigationInfoChange,
}: {
  kmzFileUrl?: string;
  currentPosition?: { lat: number; lng: number } | null;
  onTaskNavigationInfoChange?: (info: TaskNavigationInfo | null) => void;
}) {
  const [geometries, setGeometries] = useState<ParsedTaskGeometries>(emptyGeometries);

  useEffect(() => {
    let cancelled = false;

    const loadGeometries = async () => {
      if (!kmzFileUrl) {
        setGeometries(emptyGeometries);
        return;
      }

      try {
        const parsed = await loadParsedTaskGeometries(kmzFileUrl);
        if (!cancelled) {
          setGeometries(parsed);
        }
      } catch (error) {
        console.error("Gagal memuat overlay KMZ declarative:", error);
        if (!cancelled) {
          setGeometries(emptyGeometries);
        }
      }
    };

    void loadGeometries();

    return () => {
      cancelled = true;
    };
  }, [kmzFileUrl]);

  useEffect(() => {
    const info = currentPosition ? analyzeTaskNavigation(currentPosition, geometries) : null;
    onTaskNavigationInfoChange?.(info);
  }, [currentPosition, geometries, onTaskNavigationInfoChange]);

  return (
    <>
      {geometries.polygons.map((polygon, index) => (
        <Polygon
          key={`stable-polygon-${polygon.name}-${index}-${polygon.coordinates[0]?.lat ?? 0}-${polygon.coordinates[0]?.lng ?? 0}`}
          positions={polygon.coordinates.map((coordinate) => [coordinate.lat, coordinate.lng] as [number, number])}
          pathOptions={{
            color: "#059669",
            fillColor: "#10B981",
            fillOpacity: 0.22,
            weight: 3,
          }}
        >
          <Popup>
            <div className="text-sm font-semibold text-slate-900">{polygon.name}</div>
          </Popup>
        </Polygon>
      ))}

      {geometries.polylines.map((polyline, index) => (
        <Polyline
          key={`stable-polyline-${polyline.name}-${index}-${polyline.coordinates[0]?.lat ?? 0}-${polyline.coordinates[0]?.lng ?? 0}`}
          positions={polyline.coordinates.map((coordinate) => [coordinate.lat, coordinate.lng] as [number, number])}
          pathOptions={{
            color: "#059669",
            weight: 4,
          }}
        >
          <Popup>
            <div className="text-sm font-semibold text-slate-900">{polyline.name}</div>
          </Popup>
        </Polyline>
      ))}

      {geometries.points.map((point) => (
        <Marker
          key={`stable-point-${point.name}-${point.coordinate.lat}-${point.coordinate.lng}`}
          position={[point.coordinate.lat, point.coordinate.lng]}
          icon={taskPointIcon}
        >
          <Popup>
            <div className="text-sm font-semibold text-slate-900">{point.name}</div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

export default function SurveyTaskUnifiedMap({
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
  markerColor = "#10b981",
  markerLabel = "Titik Survey",
  stableOverlay = false,
}: SurveyTaskUnifiedMapProps) {
  const [ready, setReady] = useState(false);
  const surveyMarkerIcon = useMemo(() => createMarkerIcon(markerColor), [markerColor]);

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
        return { ...survey, markerLatitude: survey.latitude, markerLongitude: survey.longitude, duplicateIndex };
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
    if (latitude !== null && longitude !== null) return [latitude, longitude];

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

  const formatDate = (value: UnifiedSurveyMarker["createdAt"]) => {
    if (!value) return "-";
    if (typeof value === "object" && value !== null && "toDate" in value && typeof value.toDate === "function") {
      return value.toDate().toLocaleString("id-ID");
    }
    if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return "-";
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("id-ID");
  };

  const getAccuracyColor = (acc: number): string => {
    if (acc < 10) return "#10b981";
    if (acc < 20) return "#3b82f6";
    if (acc < 50) return "#f59e0b";
    return "#ef4444";
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

        {stableOverlay ? (
          <DeclarativeKMZOverlay
            kmzFileUrl={kmzFileUrl}
            currentPosition={currentPosition}
            onTaskNavigationInfoChange={onTaskNavigationInfoChange}
          />
        ) : (
          <MapWithKMZ
            kmzFileUrl={kmzFileUrl}
            currentPosition={currentPosition}
            completedPoints={completedPoints}
            onPointComplete={onPointComplete}
            onTaskNavigationInfoChange={onTaskNavigationInfoChange}
          />
        )}

        {markerData.map((survey) => (
          <Marker key={survey.id} position={[survey.markerLatitude, survey.markerLongitude]} icon={surveyMarkerIcon}>
            <Popup>
              <div className="min-w-[200px] p-2 text-xs">
                <p className="text-sm font-bold text-slate-900">{survey.title}</p>
                {survey.duplicateIndex > 0 ? (
                  <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                    {survey.duplicateMessage || "Marker digeser sedikit karena koordinat sama dengan titik lain."}
                  </p>
                ) : null}
                <div className="mt-2 space-y-1 text-slate-700">
                  {survey.details.map((detail) => (
                    <p key={`${survey.id}-${detail.label}`}>
                      <span className="font-semibold">{detail.label}:</span> {detail.value || "-"}
                    </p>
                  ))}
                  <p><span className="font-semibold">Waktu:</span> {formatDate(survey.createdAt)}</p>
                  <p><span className="font-semibold">Koordinat:</span> {survey.latitude.toFixed(6)}, {survey.longitude.toFixed(6)}</p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {trackingPath.length > 1 ? (
          <Polyline positions={trackingPath.map((point) => [point.lat, point.lng] as [number, number])} pathOptions={{ color: "#2563EB", weight: 4, opacity: 0.8 }} />
        ) : null}

        {hasGPS && latitude !== null && longitude !== null ? (
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
                    Lat: {latitude.toFixed(6)}
                    <br />
                    Lng: {longitude.toFixed(6)}
                    <br />
                    Akurasi: +/-{accuracy.toFixed(1)}m
                  </div>
                  <div style={{ paddingTop: "8px", borderTop: "1px solid #ddd", marginTop: "8px" }}>
                    <p style={{ fontSize: "12px", fontWeight: "600", margin: "0" }}>{accuracy < 20 ? "GPS Akurat" : "GPS Aktif"}</p>
                    {trackingPath.length > 1 ? (
                      <p style={{ fontSize: "11px", margin: "6px 0 0", color: "#2563EB" }}>Tracking tersimpan: {trackingPath.length} titik</p>
                    ) : null}
                  </div>
                </div>
              </Popup>
            </Marker>
          </>
        ) : null}

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
          {trackingPath.length > 1 ? `Tracking ${trackingPath.length} titik` : `${markerData.length} ${markerLabel}`}
        </div>
      </div>
    </div>
  );
}
