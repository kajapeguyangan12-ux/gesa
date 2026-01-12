"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ========================================
// FIX: Leaflet Icon Issue in Next.js
// ========================================
let StartIcon: L.Icon<L.IconOptions> | undefined;
let EndIcon: L.Icon<L.IconOptions> | undefined;
let WaypointIcon: L.Icon<L.IconOptions> | undefined;

if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  
  L.Icon.Default.mergeOptions({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
  
  // Start point (green marker)
  StartIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  // End point (red marker)
  EndIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  // Waypoint (blue marker)
  WaypointIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [20, 33],
    iconAnchor: [10, 33],
    popupAnchor: [1, -28],
    shadowSize: [33, 33],
  });
}

// ========================================
// Component: MapUpdater (Auto center & zoom to fit path)
// ========================================
interface MapUpdaterProps {
  path: Array<{lat: number, lng: number}>;
}

function MapUpdater({ path }: MapUpdaterProps) {
  const map = useMap();

  useEffect(() => {
    if (map && path.length > 0) {
      const bounds = L.latLngBounds(path.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [path, map]);

  return null;
}

// ========================================
// Component: TrackingHistoryMap
// ========================================
export interface TrackingHistoryMapProps {
  trackingPath: Array<{lat: number, lng: number, timestamp?: number}>;
}

function TrackingHistoryMap({ trackingPath }: TrackingHistoryMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Default location (Medan, Indonesia)
  const defaultPosition: [number, number] = [3.5952, 98.6722];
  
  // Calculate center based on tracking path
  const center: [number, number] = 
    trackingPath.length > 0
      ? [
          trackingPath.reduce((sum, p) => sum + p.lat, 0) / trackingPath.length,
          trackingPath.reduce((sum, p) => sum + p.lng, 0) / trackingPath.length,
        ]
      : defaultPosition;

  const zoom = trackingPath.length > 0 ? 14 : 12;

  // Prepare polyline coordinates
  const polylineCoords: [number, number][] = trackingPath.map(p => [p.lat, p.lng]);

  // Client-side mounting
  useEffect(() => {
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      const timer = setTimeout(() => {
        setIsMounted(true);
        setTimeout(() => setIsReady(true), 100);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!isMounted || !isReady) {
    return (
      <div className="rounded-xl overflow-hidden border-2 border-purple-200 shadow-lg flex items-center justify-center bg-gray-100" style={{ height: "500px" }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Memuat peta tracking...</p>
        </div>
      </div>
    );
  }

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return "N/A";
    try {
      return new Date(timestamp).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    } catch (error) {
      return "N/A";
    }
  };

  return (
    <div className="rounded-xl overflow-hidden border-2 border-purple-200 shadow-lg" style={{ height: "500px" }}>
      {typeof window !== "undefined" && trackingPath.length > 0 && (
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
          zoomControl={true}
          preferCanvas={true}
        >
          <MapUpdater path={trackingPath} />
          
          {/* Base Map Layer */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Tracking Polyline (path) */}
          <Polyline
            positions={polylineCoords}
            color="#EF4444"
            weight={4}
            opacity={0.8}
          />

          {/* Start Point Marker */}
          {trackingPath.length > 0 && (
            <Marker position={[trackingPath[0].lat, trackingPath[0].lng]} icon={StartIcon}>
              <Popup>
                <div className="p-1">
                  <h3 className="font-bold text-green-700 text-sm mb-1">🏁 Titik Mulai</h3>
                  <p className="text-xs text-gray-600">
                    {formatTime(trackingPath[0].timestamp)}
                  </p>
                  <p className="text-[10px] text-gray-500 font-mono">
                    {trackingPath[0].lat.toFixed(6)}, {trackingPath[0].lng.toFixed(6)}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* End Point Marker */}
          {trackingPath.length > 1 && (
            <Marker 
              position={[trackingPath[trackingPath.length - 1].lat, trackingPath[trackingPath.length - 1].lng]} 
              icon={EndIcon}
            >
              <Popup>
                <div className="p-1">
                  <h3 className="font-bold text-red-700 text-sm mb-1">🏁 Titik Akhir</h3>
                  <p className="text-xs text-gray-600">
                    {formatTime(trackingPath[trackingPath.length - 1].timestamp)}
                  </p>
                  <p className="text-[10px] text-gray-500 font-mono">
                    {trackingPath[trackingPath.length - 1].lat.toFixed(6)}, {trackingPath[trackingPath.length - 1].lng.toFixed(6)}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Waypoint Markers (every 5th point to avoid clutter) */}
          {trackingPath.slice(1, -1).map((point, index) => {
            // Show only every 5th waypoint
            if ((index + 1) % 5 !== 0) return null;
            
            return (
              <Marker 
                key={index} 
                position={[point.lat, point.lng]} 
                icon={WaypointIcon}
              >
                <Popup>
                  <div className="p-1">
                    <h3 className="font-bold text-blue-700 text-sm mb-1">📍 Waypoint #{index + 1}</h3>
                    <p className="text-xs text-gray-600">
                      {formatTime(point.timestamp)}
                    </p>
                    <p className="text-[10px] text-gray-500 font-mono">
                      {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      )}

      {trackingPath.length === 0 && (
        <div className="h-full flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <p className="text-gray-600 font-medium">Tidak ada data tracking</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default TrackingHistoryMap;
export { TrackingHistoryMap };
