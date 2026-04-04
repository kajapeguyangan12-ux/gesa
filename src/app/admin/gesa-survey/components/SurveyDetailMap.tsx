"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { loadParsedTaskGeometries } from "@/utils/kmzTaskParser";
import { analyzeTaskNavigation, type ParsedTaskGeometries, type TaskNavigationInfo } from "@/utils/taskNavigation";

export interface SurveyDetailMapProps {
  latitude: number;
  longitude: number;
  accuracy?: number;
  title: string;
  kmzFileUrl?: string;
  onTaskNavigationInfoChange?: (info: TaskNavigationInfo | null) => void;
}

const emptyGeometries: ParsedTaskGeometries = {
  polygons: [],
  polylines: [],
  points: [],
};

let MarkerIcon: L.Icon<L.IconOptions> | undefined;
type LeafletDefaultProto = L.Icon.Default & { _getIconUrl?: unknown };

if (typeof window !== "undefined") {
  delete (L.Icon.Default.prototype as LeafletDefaultProto)._getIconUrl;

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

function FitToTaskBounds({
  latitude,
  longitude,
  geometries,
}: {
  latitude: number;
  longitude: number;
  geometries: ParsedTaskGeometries;
}) {
  const map = useMap();

  useEffect(() => {
    const bounds = L.latLngBounds([[latitude, longitude]]);

    geometries.polygons.forEach((polygon) => {
      polygon.coordinates.forEach((coordinate) => bounds.extend([coordinate.lat, coordinate.lng]));
    });

    geometries.polylines.forEach((polyline) => {
      polyline.coordinates.forEach((coordinate) => bounds.extend([coordinate.lat, coordinate.lng]));
    });

    geometries.points.forEach((point) => {
      bounds.extend([point.coordinate.lat, point.coordinate.lng]);
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [24, 24],
        maxZoom: 17,
        animate: false,
      });
    }
  }, [geometries, latitude, longitude, map]);

  return null;
}

export default function SurveyDetailMap({
  latitude,
  longitude,
  accuracy = 0,
  title,
  kmzFileUrl,
  onTaskNavigationInfoChange,
}: SurveyDetailMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [geometries, setGeometries] = useState<ParsedTaskGeometries>(emptyGeometries);

  const position: [number, number] = [latitude, longitude];

  useEffect(() => {
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      const timer = setTimeout(() => {
        setIsMounted(true);
        setTimeout(() => setIsReady(true), 100);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadGeometries = async () => {
      if (!kmzFileUrl) {
        setGeometries(emptyGeometries);
        return;
      }

      try {
        const parsed = await loadParsedTaskGeometries(kmzFileUrl);
        if (!cancelled) {
          setGeometries(parsed);
        }
      } catch (error) {
        console.error("Gagal memuat polygon tugas di detail map:", error);
        if (!cancelled) {
          setGeometries(emptyGeometries);
        }
      }
    };

    void loadGeometries();

    return () => {
      cancelled = true;
    };
  }, [kmzFileUrl]);

  const navigationInfo = useMemo(
    () => analyzeTaskNavigation({ lat: latitude, lng: longitude }, geometries),
    [geometries, latitude, longitude]
  );

  useEffect(() => {
    onTaskNavigationInfoChange?.(navigationInfo);
  }, [navigationInfo, onTaskNavigationInfoChange]);

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

  const getAccuracyColor = (acc: number): string => {
    if (acc === 0) return "#3b82f6";
    if (acc < 10) return "#10b981";
    if (acc < 20) return "#3b82f6";
    if (acc < 50) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="w-full h-64 lg:h-96 rounded-xl overflow-hidden border-2 border-blue-200 shadow-lg">
      <MapContainer center={position} zoom={18} style={{ height: "100%", width: "100%" }} scrollWheelZoom zoomControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={20}
        />

        {geometries.polygons.map((polygon) => (
          <Polygon
            key={`polygon-${polygon.name}`}
            positions={polygon.coordinates.map((coordinate) => [coordinate.lat, coordinate.lng] as [number, number])}
            pathOptions={{
              color: "#059669",
              fillColor: "#10B981",
              fillOpacity: 0.22,
              weight: 4,
            }}
          >
            <Popup>
              <div className="text-sm font-semibold text-slate-900">{polygon.name}</div>
            </Popup>
          </Polygon>
        ))}

        {geometries.polylines.map((polyline) => (
          <Polyline
            key={`polyline-${polyline.name}`}
            positions={polyline.coordinates.map((coordinate) => [coordinate.lat, coordinate.lng] as [number, number])}
            pathOptions={{
              color: "#2563eb",
              weight: 4,
            }}
          >
            <Popup>
              <div className="text-sm font-semibold text-slate-900">{polyline.name}</div>
            </Popup>
          </Polyline>
        ))}

        {accuracy > 0 ? (
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
        ) : null}

        <Marker position={position} icon={MarkerIcon}>
          <Popup>
            <div className="p-2">
              <h3 className="mb-2 text-sm font-bold text-gray-900">{title}</h3>
              <div className="space-y-1 text-xs">
                <div>
                  <span className="font-semibold text-gray-600">Latitude:</span>
                  <p className="font-mono text-gray-900">{latitude.toFixed(7)}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-600">Longitude:</span>
                  <p className="font-mono text-gray-900">{longitude.toFixed(7)}</p>
                </div>
                {accuracy > 0 ? (
                  <div>
                    <span className="font-semibold text-gray-600">Akurasi:</span>
                    <p className="text-gray-900">+/-{accuracy.toFixed(1)}m</p>
                  </div>
                ) : null}
              </div>
            </div>
          </Popup>
        </Marker>

        <FitToTaskBounds latitude={latitude} longitude={longitude} geometries={geometries} />
      </MapContainer>
    </div>
  );
}
