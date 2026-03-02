"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import dynamic from "next/dynamic";

// Dynamic import for KMZTaskOverlay
const KMZTaskOverlay = dynamic(() => import("./KMZTaskOverlay"), { ssr: false });

// ========================================
// FIX: Leaflet Icon Issue in Next.js
// ========================================
let DefaultIcon: L.Icon<L.IconOptions> | undefined;
let ExistingIcon: L.Icon<L.IconOptions> | undefined;

if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  
  L.Icon.Default.mergeOptions({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
  
  // Icon for existing surveys (green marker)
  ExistingIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
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
    if (map && center && map.getContainer()) {
      try {
        map.setView(center, zoom, { animate: true, duration: 1 });
      } catch (error) {
        // Ignore errors when map is not ready
        console.warn('Map not ready for setView:', error);
      }
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
// Component: SurveyExistingMap
// ========================================
export interface SurveyData {
  id: string;
  latitude: number;
  longitude: number;
  namaJalan: string;
  namaGang?: string;
  keteranganTiang: string;
  surveyorName: string;
  createdAt: any;
  status: string;
}

export interface SurveyExistingMapProps {
  surveyData: SurveyData[];
  kmzFileUrl?: string;
  currentPosition?: { lat: number; lng: number } | null;
  completedPoints?: string[];
  onPointComplete?: (pointId: string, pointName: string, lat: number, lng: number) => void;
}

function SurveyExistingMap({ surveyData, kmzFileUrl, currentPosition, completedPoints, onPointComplete }: SurveyExistingMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Default location (Medan, Indonesia)
  const defaultPosition: [number, number] = [3.5952, 98.6722];
  
  // Calculate center based on survey data
  const center: [number, number] = 
    surveyData.length > 0
      ? [
          surveyData.reduce((sum, s) => sum + s.latitude, 0) / surveyData.length,
          surveyData.reduce((sum, s) => sum + s.longitude, 0) / surveyData.length,
        ]
      : defaultPosition;

  const zoom = surveyData.length > 0 ? 13 : 12;

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
      <div className="rounded-xl overflow-hidden border-2 border-green-200 shadow-lg flex items-center justify-center bg-gray-100" style={{ height: "550px" }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Memuat peta survey...</p>
        </div>
      </div>
    );
  }

  // Format date
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

  return (
    <div className="rounded-xl overflow-hidden border-2 border-green-200 shadow-lg" style={{ height: "550px" }}>
      {typeof window !== "undefined" && (
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
          zoomControl={true}
          preferCanvas={true}
          whenReady={() => {
            console.log("SurveyExistingMap ready");
          }}
        >
          <MapUpdater center={center} zoom={zoom} />
          
          {/* Base Map Layer */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* KMZ Overlay */}
          <MapWithKMZ 
            kmzFileUrl={kmzFileUrl} 
            currentPosition={currentPosition}
            completedPoints={completedPoints}
            onPointComplete={onPointComplete}
          />

        {/* Markers for each survey */}
        {surveyData.map((survey) => (
          <Marker
            key={survey.id}
            position={[survey.latitude, survey.longitude]}
            icon={ExistingIcon}
          >
            <Popup>
              <div className="p-2" style={{ minWidth: "200px" }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <h3 className="font-bold text-gray-900 text-sm">Survey Existing</h3>
                </div>
                
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-gray-600 font-semibold">Lokasi:</span>
                    <p className="text-gray-900 font-medium">
                      {survey.namaJalan}
                      {survey.namaGang && ` - ${survey.namaGang}`}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-gray-600 font-semibold">Kepemilikan:</span>
                    <p className="text-gray-900">{survey.keteranganTiang}</p>
                  </div>
                  
                  <div>
                    <span className="text-gray-600 font-semibold">Surveyor:</span>
                    <p className="text-gray-900">{survey.surveyorName}</p>
                  </div>
                  
                  <div>
                    <span className="text-gray-600 font-semibold">Waktu:</span>
                    <p className="text-gray-900">{formatDate(survey.createdAt)}</p>
                  </div>
                  
                  <div>
                    <span className="text-gray-600 font-semibold">Status:</span>
                    <span className={`ml-1 px-2 py-0.5 rounded text-xs font-medium ${
                      survey.status === "valid" 
                        ? "bg-green-100 text-green-700" 
                        : survey.status === "revisi"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {survey.status === "valid" ? "Valid" : survey.status === "revisi" ? "Revisi" : "Menunggu"}
                    </span>
                  </div>
                  
                  <div className="pt-1 border-t border-gray-200">
                    <span className="text-gray-600 font-semibold">Koordinat:</span>
                    <p className="text-gray-700 font-mono text-[10px]">
                      {survey.latitude.toFixed(6)}, {survey.longitude.toFixed(6)}
                    </p>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
        </MapContainer>
      )}
    </div>
  );
}

export default SurveyExistingMap;
