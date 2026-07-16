"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type PemkabMapPoint = {
  id: string;
  label: string;
  subtitle?: string;
  status?: string;
  latitude: number;
  longitude: number;
  meta?: Record<string, string | number | undefined>;
};

function FitBounds({ points }: { points: PemkabMapPoint[] }) {
  const map = useMap();

  useEffect(() => {
    const valid = points.filter((point) => point.latitude && point.longitude);
    if (valid.length === 0) {
      map.setView([-8.46, 115.17], 10);
      return;
    }
    if (valid.length === 1) {
      map.setView([valid[0].latitude, valid[0].longitude], 15);
      return;
    }
    const bounds = L.latLngBounds(valid.map((point) => [point.latitude, point.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [34, 34], maxZoom: 16 });
  }, [map, points]);

  return null;
}

function markerColor(status?: string) {
  const normalized = (status || "").toLowerCase();
  if (["new", "pending", "belum", "belum-dimulai"].some((item) => normalized.includes(item))) return "#dc2626";
  if (["diproses", "proses", "progress"].some((item) => normalized.includes(item))) return "#f59e0b";
  if (["selesai", "valid", "menyala", "done"].some((item) => normalized.includes(item))) return "#059669";
  if (["ditolak", "reject"].some((item) => normalized.includes(item))) return "#7f1d1d";
  return "#0284c7";
}

function makeIcon(color: string, label: string) {
  return L.divIcon({
    html: `<div style="width:32px;height:32px;border-radius:999px;background:${color};border:4px solid white;box-shadow:0 10px 22px rgba(15,23,42,.25);display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:11px;">${label}</div>`,
    className: "pemkab-marker",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

export default function PemkabLeafletMap({ title, points }: { title: string; points: PemkabMapPoint[] }) {
  const [ready, setReady] = useState(false);
  const validPoints = useMemo(() => points.filter((point) => point.latitude && point.longitude), [points]);

  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    });
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="flex h-full items-center justify-center bg-slate-50 text-xs text-slate-500">Memuat peta...</div>;
  }

  return (
    <div className="relative h-full min-h-[270px] overflow-hidden rounded-sm border border-gray-300 bg-white">
      <div className="absolute left-0 right-0 top-0 z-[500] bg-white/90 py-2 text-center text-xs font-bold">{title}</div>
      <MapContainer center={[-8.46, 115.17]} zoom={10} style={{ height: "100%", minHeight: 270, width: "100%" }} scrollWheelZoom>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBounds points={validPoints} />
        {validPoints.map((point, index) => (
          <Marker key={`${point.id}-${index}`} position={[point.latitude, point.longitude]} icon={makeIcon(markerColor(point.status), String(index + 1))}>
            <Popup>
              <div className="min-w-[210px] p-2">
                <div className="text-sm font-black text-slate-950">{point.label}</div>
                {point.subtitle ? <div className="mt-1 text-xs text-slate-500">{point.subtitle}</div> : null}
                <div className="mt-2 space-y-1 text-xs text-slate-700">
                  {point.status ? <div>Status: <b>{point.status}</b></div> : null}
                  {Object.entries(point.meta || {}).map(([key, value]) =>
                    value === undefined || value === "" ? null : (
                      <div key={key}>
                        {key}: <b>{value}</b>
                      </div>
                    )
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {validPoints.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 z-[450] flex items-center justify-center bg-white/65 px-6 text-center">
          <div>
            <div className="text-sm font-black text-slate-800">Belum ada marker koordinat</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">Peta geografis sudah aktif, tetapi data pada filter ini belum punya latitude/longitude.</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
