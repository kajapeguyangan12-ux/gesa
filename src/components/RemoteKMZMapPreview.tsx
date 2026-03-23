"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import JSZip from "jszip";

interface RemoteKMZMapPreviewProps {
  kmzUrl?: string;
  height?: string;
  tone?: "blue" | "emerald";
}

interface FeatureItem {
  name: string;
  description: string;
  coordinates: [number, number][];
}

export default function RemoteKMZMapPreview({
  kmzUrl,
  height = "320px",
  tone = "blue",
}: RemoteKMZMapPreviewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapData, setMapData] = useState<{ features: FeatureItem[]; bounds: L.LatLngBounds } | null>(null);

  const palette = tone === "emerald"
    ? {
        border: "border-emerald-200",
        badge: "bg-emerald-600",
        line: "#059669",
        fill: "#10B981",
      }
    : {
        border: "border-blue-200",
        badge: "bg-blue-600",
        line: "#2563EB",
        fill: "#3B82F6",
      };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(mapContainerRef.current, {
      center: [-8.54, 115.12],
      zoom: 11,
      zoomControl: true,
      attributionControl: false,
      preferCanvas: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      minZoom: 5,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      if (layerGroupRef.current) {
        layerGroupRef.current.clearLayers();
        layerGroupRef.current.remove();
        layerGroupRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!kmzUrl) {
      setMapData(null);
      return;
    }

    let isCancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/proxy-kmz?url=${encodeURIComponent(kmzUrl)}`);
        if (!response.ok) {
          throw new Error("File KMZ tidak dapat dimuat.");
        }

        const buffer = await response.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);
        const kmlFile = Object.keys(zip.files).find((name) => name.toLowerCase().endsWith(".kml"));

        if (!kmlFile) {
          throw new Error("KML tidak ditemukan di dalam KMZ.");
        }

        const kmlText = await zip.files[kmlFile].async("text");
        const xmlDoc = new DOMParser().parseFromString(kmlText, "text/xml");
        const placemarks = Array.from(xmlDoc.getElementsByTagName("Placemark"));
        const features: FeatureItem[] = [];
        const bounds = L.latLngBounds([]);

        for (const placemark of placemarks) {
          const name = placemark.getElementsByTagName("name")[0]?.textContent || "Area Tugas";
          const description = placemark.getElementsByTagName("description")[0]?.textContent || "";
          const coordinatesText = placemark.getElementsByTagName("coordinates")[0]?.textContent?.trim();

          if (!coordinatesText) {
            continue;
          }

          const coordinates = coordinatesText
            .split(/\s+/)
            .map((coord) => {
              const [lng, lat] = coord.split(",").map(Number);
              return [lat, lng] as [number, number];
            })
            .filter(([lat, lng]) => !Number.isNaN(lat) && !Number.isNaN(lng));

          if (coordinates.length === 0) {
            continue;
          }

          coordinates.forEach(([lat, lng]) => bounds.extend([lat, lng]));
          features.push({ name, description, coordinates });
        }

        if (!features.length) {
          throw new Error("Koordinat valid tidak ditemukan di file tugas.");
        }

        if (!isCancelled) {
          setMapData({ features, bounds });
        }
      } catch (err) {
        if (!isCancelled) {
          const message = err instanceof Error ? err.message : "Gagal membaca preview peta.";
          setError(message);
          setMapData(null);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isCancelled = true;
    };
  }, [kmzUrl]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    if (layerGroupRef.current) {
      layerGroupRef.current.clearLayers();
      layerGroupRef.current.remove();
      layerGroupRef.current = null;
    }

    if (!mapData) {
      return;
    }

    const layerGroup = L.layerGroup().addTo(mapRef.current);
    layerGroupRef.current = layerGroup;

    mapData.features.forEach((feature) => {
      const { coordinates, name, description } = feature;
      const isPolygon = coordinates.length >= 3 && coordinates[0][0] === coordinates[coordinates.length - 1][0] && coordinates[0][1] === coordinates[coordinates.length - 1][1];

      if (coordinates.length === 1) {
        const [lat, lng] = coordinates[0];
        const marker = L.marker([lat, lng]);
        marker.bindPopup(`<div style="padding:8px"><strong>${name}</strong><div style="font-size:12px;color:#64748B">${description}</div></div>`);
        layerGroup.addLayer(marker);
        return;
      }

      if (isPolygon) {
        const polygon = L.polygon(coordinates, {
          color: palette.line,
          fillColor: palette.fill,
          fillOpacity: 0.25,
          weight: 3,
        });
        polygon.bindPopup(`<div style="padding:8px"><strong>${name}</strong><div style="font-size:12px;color:#64748B">${description}</div></div>`);
        layerGroup.addLayer(polygon);
        return;
      }

      const polyline = L.polyline(coordinates, {
        color: palette.line,
        weight: 4,
      });
      polyline.bindPopup(`<div style="padding:8px"><strong>${name}</strong><div style="font-size:12px;color:#64748B">${description}</div></div>`);
      layerGroup.addLayer(polyline);
    });

    if (mapData.bounds.isValid()) {
      mapRef.current.fitBounds(mapData.bounds, { padding: [24, 24], maxZoom: 17, animate: false });
    }
  }, [mapData, palette.fill, palette.line]);

  if (!kmzUrl) {
    return (
      <div style={{ height }} className={`flex items-center justify-center rounded-2xl border-2 border-dashed ${palette.border} bg-slate-50`}>
        <p className="px-4 text-center text-sm text-slate-500">File polygon/titik dari admin belum tersedia.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height }} className="flex items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-4 text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${palette.border} shadow-sm`}>
      <div ref={mapContainerRef} style={{ height }} className="w-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/85">
          <div className="text-center">
            <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-slate-700" />
            <p className="text-sm text-slate-500">Memuat preview tugas...</p>
          </div>
        </div>
      )}
      {mapData && !loading && (
        <div className={`absolute right-3 top-3 rounded-full ${palette.badge} px-3 py-1 text-xs font-semibold text-white`}>
          {mapData.features.length} objek
        </div>
      )}
    </div>
  );
}
