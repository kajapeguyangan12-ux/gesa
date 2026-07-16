"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type ReportSummary = { total: number; new: number; diproses: number; selesai: number; ditolak: number };

export type OMApjMapPoint = {
  id: string;
  idTitik: string;
  namaTitik: string;
  namaJalan: string;
  kabupaten: string;
  dayaLampu: string;
  group: string;
  latitude: number;
  longitude: number;
  reports: ReportSummary;
};

export type OMApjMapGroup = {
  id: string;
  name: string;
  total: number;
  withCoordinate: number;
  reports: ReportSummary;
  points: OMApjMapPoint[];
};

function FitBounds({ points }: { points: Array<{ latitude: number; longitude: number }> }) {
  const map = useMap();

  useEffect(() => {
    const valid = points.filter((point) => point.latitude && point.longitude);
    if (valid.length === 0) {
      map.setView([-8.46, 115.17], 11);
      return;
    }
    if (valid.length === 1) {
      map.setView([valid[0].latitude, valid[0].longitude], 16);
      return;
    }
    const bounds = L.latLngBounds(valid.map((point) => [point.latitude, point.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
  }, [map, points]);

  return null;
}

function makeIcon(color: string, label: string) {
  return L.divIcon({
    html: `<div style="min-width:34px;height:34px;border-radius:999px;background:${color};border:4px solid white;box-shadow:0 10px 22px rgba(15,23,42,.25);display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:12px;padding:0 8px;">${label}</div>`,
    className: "om-apj-marker",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16],
  });
}

function pointColor(point: OMApjMapPoint) {
  if (point.reports.diproses > 0) return "#f59e0b";
  if (point.reports.new > 0) return "#dc2626";
  if (point.reports.selesai > 0) return "#059669";
  return "#0284c7";
}

export default function OMApjLeafletMap({
  groups,
  selectedGroup,
  onSelectGroup,
}: {
  groups: OMApjMapGroup[];
  selectedGroup: OMApjMapGroup | null;
  onSelectGroup: (groupId: string) => void;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    });
    setReady(true);
  }, []);

  const groupMarkers = useMemo(
    () =>
      groups
        .map((group) => {
          const valid = group.points.filter((point) => point.latitude && point.longitude);
          if (valid.length === 0) return null;
          return {
            group,
            latitude: valid.reduce((sum, point) => sum + point.latitude, 0) / valid.length,
            longitude: valid.reduce((sum, point) => sum + point.longitude, 0) / valid.length,
          };
        })
        .filter(Boolean) as Array<{ group: OMApjMapGroup; latitude: number; longitude: number }>,
    [groups]
  );

  const activePoints = selectedGroup?.points.filter((point) => point.latitude && point.longitude) || [];
  const boundsPoints = selectedGroup ? activePoints : groupMarkers;

  if (!ready) {
    return <div className="flex h-full items-center justify-center bg-slate-50 text-sm text-slate-500">Memuat peta O&M...</div>;
  }

  return (
    <MapContainer center={[-8.46, 115.17]} zoom={11} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitBounds points={boundsPoints} />

      {!selectedGroup
        ? groupMarkers.map(({ group, latitude, longitude }) => (
            <Marker key={group.id} position={[latitude, longitude]} icon={makeIcon("#0f766e", String(group.total))}>
              <Popup>
                <div className="min-w-[220px] p-2">
                  <div className="text-sm font-black text-slate-950">{group.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{group.total} titik APJ, {group.withCoordinate} punya koordinat</div>
                  <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[11px]">
                    <span className="rounded bg-red-50 px-2 py-1 text-red-700">Baru {group.reports.new}</span>
                    <span className="rounded bg-amber-50 px-2 py-1 text-amber-700">Proses {group.reports.diproses}</span>
                    <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">Selesai {group.reports.selesai}</span>
                  </div>
                  <button type="button" onClick={() => onSelectGroup(group.id)} className="mt-3 w-full rounded-xl bg-teal-600 px-3 py-2 text-xs font-bold text-white">
                    Buka Grup
                  </button>
                </div>
              </Popup>
            </Marker>
          ))
        : activePoints.map((point, index) => (
            <Marker key={`${point.id}-${point.idTitik}`} position={[point.latitude, point.longitude]} icon={makeIcon(pointColor(point), String(index + 1))}>
              <Popup>
                <div className="min-w-[220px] p-2">
                  <div className="text-sm font-black text-slate-950">{point.idTitik}</div>
                  <div className="mt-1 text-xs text-slate-500">{point.namaJalan || point.namaTitik}</div>
                  <div className="mt-2 space-y-1 text-xs">
                    <div>Daya: <b>{point.dayaLampu}</b></div>
                    <div>Area: <b>{point.kabupaten}</b></div>
                    <div>Laporan: <b>{point.reports.total}</b></div>
                  </div>
                  <a href={`/om/apj-point/${encodeURIComponent(point.idTitik)}/manage`} className="mt-3 block rounded-xl bg-slate-950 px-3 py-2 text-center text-xs font-bold text-white">
                    Kelola APJ
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}
    </MapContainer>
  );
}
