"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import dynamic from "next/dynamic";

const KMZTaskOverlay = dynamic(() => import("./KMZTaskOverlay"), { ssr: false });

type LeafletDefaultProto = L.Icon.Default & { _getIconUrl?: unknown };

if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as LeafletDefaultProto)._getIconUrl;

  L.Icon.Default.mergeOptions({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

interface MapUpdaterProps {
  center: [number, number];
  zoom: number;
}

function MapUpdater({ center, zoom }: MapUpdaterProps) {
  const map = useMap();

  useEffect(() => {
    if (map && center) {
      map.setView(center, zoom, { animate: true, duration: 1 });
    }
  }, [center, zoom, map]);

  return null;
}

interface MapWithKMZProps {
  kmzFileUrl?: string;
  currentPosition?: { lat: number; lng: number } | null;
  completedPoints?: string[];
  onPointComplete?: (pointId: string, pointName: string, lat: number, lng: number) => void;
}

function MapWithKMZ({ kmzFileUrl, currentPosition, completedPoints, onPointComplete }: MapWithKMZProps) {
  const map = useMap();

  return <>{kmzFileUrl && <KMZTaskOverlay map={map} kmzFileUrl={kmzFileUrl} currentPosition={currentPosition} completedPoints={completedPoints} onPointComplete={onPointComplete} />}</>;
}

export interface GPSMapProps {
  latitude: number | null;
  longitude: number | null;
  accuracy: number;
  hasGPS: boolean;
  kmzFileUrl?: string;
  completedPoints?: string[];
  trackingPath?: Array<{ lat: number; lng: number }>;
  onPointComplete?: (pointId: string, pointName: string, lat: number, lng: number) => void;
}

function GPSMap({ latitude, longitude, accuracy, hasGPS, kmzFileUrl, completedPoints, trackingPath = [], onPointComplete }: GPSMapProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 120);

    return () => clearTimeout(timer);
  }, []);

  const defaultPosition: [number, number] = [-8.4095, 115.1889];
  const position: [number, number] = latitude !== null && longitude !== null ? [latitude, longitude] : defaultPosition;
  const zoom = hasGPS ? 18 : 12;

  if (!isReady) {
    return (
      <div className="rounded-xl overflow-hidden border-2 border-blue-200 shadow-lg flex items-center justify-center bg-gray-100" style={{ height: "500px" }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Memuat peta...</p>
        </div>
      </div>
    );
  }

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

  return (
    <div className="rounded-xl overflow-hidden border-2 border-blue-200 shadow-lg" style={{ height: "500px", width: "100%", position: "relative" }}>
      <MapContainer
        center={position}
        zoom={zoom}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
        zoomControl={true}
        scrollWheelZoom={true}
        attributionControl={true}
        preferCanvas={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={20}
        />

        <MapWithKMZ
          kmzFileUrl={kmzFileUrl}
          currentPosition={latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null}
          completedPoints={completedPoints}
          onPointComplete={onPointComplete}
        />

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
            <Marker position={[latitude, longitude]}>
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

        <MapUpdater center={position} zoom={zoom} />
      </MapContainer>

      {hasGPS && (
        <div className="absolute top-2 left-2 bg-white bg-opacity-95 backdrop-blur px-3 py-1.5 rounded-lg shadow-md text-xs font-bold z-50">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5 bg-green-500"></span>
          +/-{accuracy.toFixed(1)}m
        </div>
      )}

      {trackingPath.length > 1 && (
        <div className="absolute top-2 right-2 rounded-lg bg-blue-600/95 px-3 py-1.5 text-xs font-semibold text-white shadow-md z-50">
          Tracking {trackingPath.length} titik
        </div>
      )}

      {!hasGPS && (
        <div className="absolute top-2 left-2 right-2 bg-yellow-100 border border-yellow-400 px-3 py-2 rounded-lg shadow-md text-xs font-semibold z-50 text-center">
          GPS belum aktif. Aktifkan GPS untuk melihat posisi Anda.
        </div>
      )}
    </div>
  );
}

export default GPSMap;
