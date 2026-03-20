"use client";

import { useEffect, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type LeafletDefaultProto = L.Icon.Default & { _getIconUrl?: unknown };

if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as LeafletDefaultProto)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

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

interface SurveyPraExistingSubmittedMapProps {
  surveyData: SubmittedSurveyMapData[];
}

function Recenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 0.8 });
  }, [center, zoom, map]);

  return null;
}

export default function SurveyPraExistingSubmittedMap({ surveyData }: SurveyPraExistingSubmittedMapProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 120);
    return () => clearTimeout(timer);
  }, []);

  const defaultCenter: [number, number] = [-8.541, 115.125];
  const center: [number, number] = surveyData.length
    ? [
        surveyData.reduce((sum, item) => sum + item.latitude, 0) / surveyData.length,
        surveyData.reduce((sum, item) => sum + item.longitude, 0) / surveyData.length,
      ]
    : defaultCenter;

  const zoom = surveyData.length ? 13 : 10;

  const duplicateCounter = new Map<string, number>();
  const markerData = surveyData.map((survey) => {
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

  const formatDate = (value: SubmittedSurveyMapData["createdAt"]) => {
    if (!value) return "-";
    if (typeof value === "object" && value !== null && "toDate" in value && typeof value.toDate === "function") {
      return value.toDate().toLocaleString("id-ID");
    }
    if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
      return "-";
    }
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("id-ID");
  };

  if (!ready) {
    return (
      <div className="flex h-[460px] items-center justify-center rounded-2xl border border-emerald-200 bg-slate-100">
        <div className="text-center">
          <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-600" />
          <p className="text-sm text-slate-500">Memuat peta survey...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-200 shadow-sm" style={{ height: "460px" }}>
      <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter center={center} zoom={zoom} />
        {markerData.map((survey) => (
          <Marker key={survey.id} position={[survey.markerLatitude, survey.markerLongitude]}>
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
      </MapContainer>
    </div>
  );
}

