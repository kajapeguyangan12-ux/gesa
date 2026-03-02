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
let ProposeIcon: L.Icon<L.IconOptions> | undefined;

if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  
  L.Icon.Default.mergeOptions({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
  
  // Icon for APJ propose surveys (blue marker)
  ProposeIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
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
// Component: SurveyAPJProposeMap
// ========================================
export interface SurveyData {
  id: string;
  latitude: number;
  longitude: number;
  idTitik: string;
  namaJalan: string;
  dayaLampu: string;
  surveyorName: string;
  createdAt: any;
  status: string;
}

export interface SurveyAPJProposeMapProps {
  surveyData: SurveyData[];
  kmzFileUrl?: string;
  currentPosition?: { lat: number; lng: number } | null;
  completedPoints?: string[];
  onPointComplete?: (pointId: string, pointName: string, lat: number, lng: number) => void;
}

function SurveyAPJProposeMap({ surveyData, kmzFileUrl, currentPosition, completedPoints, onPointComplete }: SurveyAPJProposeMapProps) {
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
      <div className="rounded-xl overflow-hidden border-2 border-blue-200 shadow-lg flex items-center justify-center bg-gray-100" style={{ height: "550px" }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
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
    <div className="rounded-xl overflow-hidden border-2 border-blue-200 shadow-lg" style={{ height: "550px" }}>
      {typeof window !== "undefined" && (
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
          zoomControl={true}
          preferCanvas={true}
          whenReady={() => {
            console.log("SurveyAPJProposeMap ready");
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
            icon={ProposeIcon}
          >
            <Popup>
              <div className="p-1 min-w-[200px]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-blue-700 text-sm">Survey APJ Propose</h3>
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                    {survey.status}
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-start gap-1.5">
                    <svg className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                    <div>
                      <p className="text-gray-500 text-[10px]">ID Titik</p>
                      <p className="font-semibold text-gray-800">{survey.idTitik || "N/A"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <svg className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <div>
                      <p className="text-gray-500 text-[10px]">Lokasi</p>
                      <p className="font-semibold text-gray-800">{survey.namaJalan}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <svg className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <div>
                      <p className="text-gray-500 text-[10px]">Daya Lampu</p>
                      <p className="font-semibold text-gray-800">{survey.dayaLampu || "N/A"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <svg className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <div>
                      <p className="text-gray-500 text-[10px]">Surveyor</p>
                      <p className="font-semibold text-gray-800">{survey.surveyorName}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <svg className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <p className="text-gray-500 text-[10px]">Tanggal Survey</p>
                      <p className="font-semibold text-gray-800">{formatDate(survey.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <svg className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    <div>
                      <p className="text-gray-500 text-[10px]">Koordinat</p>
                      <p className="font-mono text-[10px] text-gray-700">
                        {survey.latitude.toFixed(6)}, {survey.longitude.toFixed(6)}
                      </p>
                    </div>
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

export default SurveyAPJProposeMap;
