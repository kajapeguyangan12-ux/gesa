"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import dynamic from "next/dynamic";

// Dynamic import for KMZTaskOverlay
const KMZTaskOverlay = dynamic(() => import("./KMZTaskOverlay"), { ssr: false });

// ========================================
// FIX: Leaflet Icon Issue in Next.js
// ========================================
// IMPORTANT: Only execute in browser (not during SSR)
let DefaultIcon: L.Icon<L.IconOptions> | undefined;

if (typeof window !== "undefined") {
  // Delete the default _getIconUrl to prevent errors
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  
  // Set icon URLs to CDN
  L.Icon.Default.mergeOptions({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
  
  DefaultIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
}

// ========================================
// Component: MapUpdater (Auto center & zoom)
// ========================================
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

// ========================================
// Component: MapWithKMZ (handles map instance)
// ========================================
interface MapWithKMZProps {
  kmzFileUrl?: string;
  currentPosition?: { lat: number; lng: number } | null;
  completedPoints?: string[];
  onPointComplete?: (pointId: string, pointName: string, lat: number, lng: number) => void;
}

function MapWithKMZ({ kmzFileUrl, currentPosition, completedPoints, onPointComplete }: MapWithKMZProps) {
  const [map, setMap] = useState<L.Map | null>(null);
  const mapInstance = useMap();

  useEffect(() => {
    if (mapInstance) {
      setMap(mapInstance);
    }
  }, [mapInstance]);

  return <>{kmzFileUrl && <KMZTaskOverlay map={map} kmzFileUrl={kmzFileUrl} currentPosition={currentPosition} completedPoints={completedPoints} onPointComplete={onPointComplete} />}</>;
}

// ========================================
// Component: GPSMap (Main Map Component)
// ========================================
export interface GPSMapProps {
  latitude: number | null;
  longitude: number | null;
  accuracy: number;
  hasGPS: boolean;
  kmzFileUrl?: string;
  completedPoints?: string[];
  onPointComplete?: (pointId: string, pointName: string, lat: number, lng: number) => void;
}

function GPSMap({ latitude, longitude, accuracy, hasGPS, kmzFileUrl, completedPoints, onPointComplete }: GPSMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Default location (Bali, Indonesia)
  const defaultPosition: [number, number] = [-8.4095, 115.1889];
  
  // Use GPS coordinates if available, otherwise use default
  const position: [number, number] = 
    latitude !== null && longitude !== null 
      ? [latitude, longitude] 
      : defaultPosition;

  const zoom = hasGPS ? 18 : 12;

  // Client-side mounting with double check
  useEffect(() => {
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      const timer = setTimeout(() => {
        setIsMounted(true);
        // Add extra delay to ensure DOM is ready
        setTimeout(() => setIsReady(true), 100);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, []);

  // Loading state
  if (!isMounted || !isReady) {
    return (
      <div className="rounded-xl overflow-hidden border-2 border-blue-200 shadow-lg flex items-center justify-center bg-gray-100" style={{ height: "500px" }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Memuat peta...</p>
        </div>
      </div>
    );
  }

  // Accuracy color
  const getAccuracyColor = (acc: number): string => {
    if (acc < 10) return "#10b981";
    if (acc < 20) return "#3b82f6";
    if (acc < 50) return "#f59e0b";
    return "#ef4444";
  };

  // GPS status text
  const getGPSStatusText = (): string => {
    if (!hasGPS) return "❌ GPS Tidak Aktif";
    if (accuracy < 10) return "🟢 GPS Presisi Tinggi";
    if (accuracy < 20) return "🔵 GPS Akurat";
    if (accuracy < 50) return "🟠 GPS Cukup Baik";
    return "🔴 GPS Kurang Presisi";
  };

  return (
    <div className="rounded-xl overflow-hidden border-2 border-blue-200 shadow-lg" style={{ height: "500px", width: "100%", position: "relative" }}>
      {typeof window !== "undefined" && (
        <MapContainer
          center={position}
          zoom={zoom}
          style={{ height: "100%", width: "100%", zIndex: 0 }}
          zoomControl={true}
          scrollWheelZoom={true}
          attributionControl={true}
          preferCanvas={true}
          whenReady={() => {
            console.log("GPSMap ready");
          }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={20}
          />

          {/* KMZ Overlay */}
          <MapWithKMZ 
            kmzFileUrl={kmzFileUrl} 
            currentPosition={latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null}
            completedPoints={completedPoints}
            onPointComplete={onPointComplete}
          />

        {/* Show marker & accuracy circle only if GPS is active */}
        {hasGPS && latitude !== null && longitude !== null && (
          <>
            {/* Accuracy Circle */}
            {accuracy > 0 && (
              <Circle
                center={position}
                radius={accuracy}
                pathOptions={{
                  color: getAccuracyColor(accuracy),
                  fillColor: getAccuracyColor(accuracy),
                  fillOpacity: 0.15,
                  weight: 2,
                }}
              />
            )}

            {/* User Position Marker */}
            <Marker position={position} icon={DefaultIcon}>
              <Popup>
                <div className="text-sm min-w-[200px]">
                  <p className="font-bold mb-2 text-base">📍 Posisi Anda</p>
                  
                  <div className="space-y-1">
                    <div>
                      <p className="text-xs text-gray-500">Latitude:</p>
                      <p className="font-mono text-xs font-bold">{latitude.toFixed(7)}</p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-gray-500">Longitude:</p>
                      <p className="font-mono text-xs font-bold">{longitude.toFixed(7)}</p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-gray-500">Akurasi:</p>
                      <p className="font-bold text-xs">±{accuracy.toFixed(1)} meter</p>
                    </div>
                    
                    <div className="pt-2 border-t mt-2">
                      <p className="text-xs font-semibold">{getGPSStatusText()}</p>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        <MapUpdater center={position} zoom={zoom} />
        </MapContainer>
      )}

      {/* Accuracy Indicator Overlay */}
      {hasGPS && (
        <div className="absolute top-2 left-2 bg-white/95 backdrop-blur px-3 py-1.5 rounded-lg shadow-md text-xs font-bold z-[1000]">
          <span
            className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
              accuracy < 10
                ? "bg-green-500"
                : accuracy < 20
                ? "bg-blue-500"
                : accuracy < 50
                ? "bg-orange-500"
                : "bg-red-500"
            }`}
          ></span>
          ±{accuracy.toFixed(1)}m
        </div>
      )}

      {/* No GPS Indicator */}
      {!hasGPS && (
        <div className="absolute top-2 left-2 right-2 bg-yellow-100 border border-yellow-400 px-3 py-2 rounded-lg shadow-md text-xs font-semibold z-[1000] text-center">
          ⚠️ GPS Belum Aktif - Aktifkan GPS untuk melihat posisi Anda
        </div>
      )}
    </div>
  );
}

export default GPSMap;
