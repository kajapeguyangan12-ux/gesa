"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type OMTaskMapPoint = {
  idTitik: string;
  namaTitik?: string;
  namaJalan?: string;
  dayaLampu?: string;
  latitude?: number;
  longitude?: number;
};

function hasCoordinate(point: OMTaskMapPoint) {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && point.latitude !== 0 && point.longitude !== 0;
}

function FitTaskBounds({ points }: { points: OMTaskMapPoint[] }) {
  const map = useMap();

  useEffect(() => {
    const coordinates = points.map((point) => [point.latitude as number, point.longitude as number] as [number, number]);
    if (coordinates.length === 1) {
      map.setView(coordinates[0], 17);
    } else if (coordinates.length > 1) {
      map.fitBounds(L.latLngBounds(coordinates), { padding: [30, 30], maxZoom: 17 });
    }
  }, [map, points]);

  return null;
}

function markerIcon(index: number, selected: boolean) {
  return L.divIcon({
    html: `<div style="width:36px;height:36px;border-radius:999px;background:${selected ? "#dc2626" : "#0284c7"};border:4px solid white;box-shadow:0 8px 20px rgba(15,23,42,.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:12px;">${index + 1}</div>`,
    className: "om-task-point-marker",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

export default function OMTaskPointMap({
  points,
  selectedPointId,
  onSelectPoint,
}: {
  points: OMTaskMapPoint[];
  selectedPointId?: string;
  onSelectPoint: (idTitik: string) => void;
}) {
  const validPoints = useMemo(() => points.filter(hasCoordinate), [points]);

  if (validPoints.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 p-5 text-center text-xs text-slate-500">
        Titik dalam tugas ini belum memiliki koordinat peta.
      </div>
    );
  }

  return (
    <MapContainer center={[validPoints[0].latitude as number, validPoints[0].longitude as number]} zoom={15} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitTaskBounds points={validPoints} />
      {validPoints.map((point, index) => {
        const selected = point.idTitik === selectedPointId;
        const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}`;
        return (
          <Marker
            key={point.idTitik}
            position={[point.latitude as number, point.longitude as number]}
            icon={markerIcon(index, selected)}
            eventHandlers={{ click: () => onSelectPoint(point.idTitik) }}
          >
            <Popup>
              <div className="min-w-[210px] p-1">
                <div className="text-sm font-black text-slate-950">{point.idTitik}</div>
                <div className="mt-1 text-xs text-slate-600">{point.namaJalan || point.namaTitik || "Titik APJ"}</div>
                <div className="mt-1 text-xs text-slate-600">Daya: <b>{point.dayaLampu || "-"}</b></div>
                <button type="button" onClick={() => onSelectPoint(point.idTitik)} className="mt-3 w-full rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white">
                  Pilih Titik Ini
                </button>
                <a href={navigationUrl} target="_blank" rel="noreferrer" className="mt-2 block rounded-lg border border-slate-300 px-3 py-2 text-center text-xs font-bold text-slate-800">
                  Buka Navigasi
                </a>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
