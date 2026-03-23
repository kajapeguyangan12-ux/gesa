"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type KontruksiStatus = "belum-dimulai" | "berjalan" | "selesai" | "terkendala";

interface KontruksiPoint {
  id: string;
  title: string;
  type: "existing" | "propose";
  latitude: number;
  longitude: number;
  zona: string;
  idTitik: string;
  statusKontruksi: KontruksiStatus;
  updatedAt: any;
}

interface MapsKontruksiValidMapProps {
  points: KontruksiPoint[];
  statusLabels: Record<KontruksiStatus, string>;
}

export default function MapsKontruksiValidMap({
  points,
  statusLabels,
}: MapsKontruksiValidMapProps) {
  const [isReady, setIsReady] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);

  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    });
    setIsReady(true);
  }, []);

  const colorByStatus: Record<KontruksiStatus, string> = {
    "belum-dimulai": "#9CA3AF",
    "berjalan": "#F59E0B",
    "selesai": "#10B981",
    "terkendala": "#EF4444",
  };

  const getCustomIcon = (status: KontruksiStatus) => {
    const iconHtml = `<div style="background-color: ${colorByStatus[status]}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`;
    return L.divIcon({
      html: iconHtml,
      className: "custom-marker",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12],
    });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "-";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "-";
    }
  };

  if (!isReady) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="w-16 h-16 border-4 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <MapContainer
        center={[-8.46, 115.17]}
        zoom={11}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {points.map((point) => (
          <Marker
            key={point.id}
            position={[point.latitude, point.longitude]}
            icon={getCustomIcon(point.statusKontruksi)}
          >
            <Popup>
              <div className="p-2 min-w-[220px] max-w-[280px]">
                <h4 className="font-bold text-gray-900 mb-1 text-sm">{point.title}</h4>
                <div className="text-xs text-gray-500 mb-2">
                  {point.type === "existing" ? "Survey Existing" : "Survey APJ Propose"}
                </div>
                <div className="space-y-1 text-xs">
                  <div>
                    <span className="text-gray-500">ID Titik</span>
                    <div className="font-medium text-gray-800">{point.idTitik}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Zona</span>
                    <div className="font-medium text-gray-800">{point.zona}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Status</span>
                    <div className="font-medium text-gray-800">
                      {statusLabels[point.statusKontruksi]}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Update</span>
                    <div className="font-medium text-gray-800">{formatDate(point.updatedAt)}</div>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 z-[1000] transition-all duration-200">
        <button
          onClick={() => setLegendOpen(!legendOpen)}
          className="w-full flex items-center justify-between gap-2 p-3 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-bold text-gray-900">Legenda</span>
          </div>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${legendOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {legendOpen && (
          <div className="px-4 pb-4">
            <div className="space-y-2">
              {(Object.keys(statusLabels) as KontruksiStatus[]).map((status) => (
                <div key={status} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: colorByStatus[status] }}
                  ></div>
                  <span className="text-sm text-gray-700">{statusLabels[status]}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">Klik marker untuk melihat detail</p>
          </div>
        )}
      </div>
    </>
  );
}
