"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface SurveyDetailMapProps {
  latitude: number;
  longitude: number;
  accuracy?: number;
  title: string;
}

// Fix Leaflet Icon Issue
let MarkerIcon: L.Icon<L.IconOptions> | undefined;

if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  
  L.Icon.Default.mergeOptions({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
  
  MarkerIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
}

function SurveyDetailMap({ latitude, longitude, accuracy = 0, title }: SurveyDetailMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const position: [number, number] = [latitude, longitude];
  const zoom = 18;

  // Client-side mounting with double check
  useEffect(() => {
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      const timer = setTimeout(() => {
        setIsMounted(true);
        setTimeout(() => setIsReady(true), 100);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, []);

  // Loading state
  if (!isMounted || !isReady) {
    return (
      <div className="w-full h-64 lg:h-96 bg-gray-100 rounded-xl flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-500 text-sm">Memuat peta...</p>
        </div>
      </div>
    );
  }

  // Accuracy color
  const getAccuracyColor = (acc: number): string => {
    if (acc === 0) return "#3b82f6";
    if (acc < 10) return "#10b981";
    if (acc < 20) return "#3b82f6";
    if (acc < 50) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="w-full h-64 lg:h-96 rounded-xl overflow-hidden border-2 border-blue-200 shadow-lg">
      {typeof window !== "undefined" && (
        <MapContainer
          center={position}
          zoom={zoom}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
          zoomControl={true}
          preferCanvas={true}
          whenReady={() => {
            console.log("SurveyDetailMap ready");
          }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={20}
          />

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

          {/* Marker */}
          <Marker position={position} icon={MarkerIcon}>
            <Popup>
              <div className="p-2">
                <h3 className="font-bold text-gray-900 mb-2 text-sm">{title}</h3>
                <div className="space-y-1 text-xs">
                  <div>
                    <span className="text-gray-600 font-semibold">Latitude:</span>
                    <p className="font-mono text-gray-900">{latitude.toFixed(7)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 font-semibold">Longitude:</span>
                    <p className="font-mono text-gray-900">{longitude.toFixed(7)}</p>
                  </div>
                  {accuracy > 0 && (
                    <div>
                      <span className="text-gray-600 font-semibold">Akurasi:</span>
                      <p className="text-gray-900">±{accuracy.toFixed(1)}m</p>
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      )}
    </div>
  );
}

export default SurveyDetailMap;
