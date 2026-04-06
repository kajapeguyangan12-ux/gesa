"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import JSZip from "jszip";
import { analyzeTaskNavigation, type ParsedTaskGeometries, type TaskNavigationInfo } from "@/utils/taskNavigation";

interface KMZTaskOverlayProps {
  map: L.Map | null;
  kmzFileUrl?: string;
  currentPosition?: { lat: number; lng: number } | null;
  completedPoints?: string[];
  onPointComplete?: (pointId: string, pointName: string, lat: number, lng: number) => void;
  onTaskNavigationInfoChange?: (info: TaskNavigationInfo | null) => void;
  fitBoundsOnLoad?: boolean;
}

const emptyGeometries: ParsedTaskGeometries = {
  polygons: [],
  polylines: [],
  points: [],
};

export default function KMZTaskOverlay({
  map,
  kmzFileUrl,
  currentPosition,
  completedPoints = [],
  onPointComplete,
  onTaskNavigationInfoChange,
  fitBoundsOnLoad = false,
}: KMZTaskOverlayProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedGeometries, setParsedGeometries] = useState<ParsedTaskGeometries>(emptyGeometries);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const currentPositionRef = useRef(currentPosition);
  const lastNavigationSignatureRef = useRef("");

  const waitForMapReady = (leafletMap: L.Map) =>
    new Promise<void>((resolve) => {
      if ((leafletMap as L.Map & { _loaded?: boolean })._loaded) {
        resolve();
        return;
      }

      leafletMap.whenReady(() => resolve());
    });

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    if (!kmzFileUrl) {
      setParsedGeometries(emptyGeometries);
      onTaskNavigationInfoChange?.(null);
    }
  }, [kmzFileUrl, onTaskNavigationInfoChange]);

  useEffect(() => {
    currentPositionRef.current = currentPosition;
  }, [currentPosition]);

  useEffect(() => {
    const info = analyzeTaskNavigation(currentPosition, parsedGeometries);
    const nextSignature = JSON.stringify(info);
    if (lastNavigationSignatureRef.current === nextSignature) {
      return;
    }

    lastNavigationSignatureRef.current = nextSignature;
    onTaskNavigationInfoChange?.(info);
  }, [currentPosition, onTaskNavigationInfoChange, parsedGeometries]);

  useEffect(() => {
    const loadKMZFile = async () => {
      if (!map || !kmzFileUrl) return;

      setLoading(true);
      setError(null);

      try {
        await waitForMapReady(map);

        const proxyUrl = `/api/proxy-kmz?url=${encodeURIComponent(kmzFileUrl)}`;
        const response = await fetch(proxyUrl);

        if (!response.ok) {
          const kabupatenName = kmzFileUrl.split("/").pop()?.replace(".kmz", "").replace(/_/g, " ") || "Unknown";
          throw new Error(`KMZ file tidak dapat dimuat untuk ${kabupatenName}. Pastikan file KMZ valid dan dapat diakses.`);
        }

        const buffer = await response.arrayBuffer();
        if (buffer.byteLength < 100) {
          throw new Error("KMZ file terlalu kecil atau korup");
        }

        const zip = await JSZip.loadAsync(buffer);
        const kmlFiles = Object.keys(zip.files).filter((filename) => filename.toLowerCase().endsWith(".kml"));

        if (kmlFiles.length === 0) {
          throw new Error("Tidak ada file KML yang ditemukan di KMZ");
        }

        const kmlContent = await zip.files[kmlFiles[0]].async("string");
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(kmlContent, "text/xml");
        const parseError = xmlDoc.getElementsByTagName("parsererror");

        if (parseError.length > 0) {
          throw new Error("Format KML pada KMZ tidak valid");
        }

        const placemarks = xmlDoc.getElementsByTagName("Placemark");
        if (placemarks.length === 0) {
          setParsedGeometries(emptyGeometries);
          setLoading(false);
          return;
        }

        if (layerGroupRef.current) {
          try {
            layerGroupRef.current.clearLayers();
            layerGroupRef.current.remove();
          } catch (layerError) {
            console.warn("Gagal membersihkan layer KMZ sebelumnya:", layerError);
          } finally {
            layerGroupRef.current = null;
          }
        }

        const nextLayerGroup = L.featureGroup();
        const nextBounds = L.latLngBounds([]);
        const nextGeometries: ParsedTaskGeometries = {
          polygons: [],
          polylines: [],
          points: [],
        };

        for (let index = 0; index < placemarks.length; index += 1) {
          try {
            const placemark = placemarks[index];
            const name = placemark.getElementsByTagName("name")[0]?.textContent || `Titik Tugas ${index + 1}`;
            const description = placemark.getElementsByTagName("description")[0]?.textContent || "";
            const coordinatesText = placemark.getElementsByTagName("coordinates")[0]?.textContent?.trim();

            if (!coordinatesText) {
              continue;
            }

            const coordinates = coordinatesText
              .split(/\s+/)
              .map((coordinate) => {
                const [lng, lat] = coordinate.split(",").map(Number);
                return { lat, lng };
              })
              .filter((coordinate) => Number.isFinite(coordinate.lat) && Number.isFinite(coordinate.lng));

            if (coordinates.length === 0) {
              continue;
            }

            if (coordinates.length === 1) {
              const coordinate = coordinates[0];
              const pointId = `point_${coordinate.lat}_${coordinate.lng}`;
              const isCompleted = completedPoints.includes(pointId);

              let distance = Number.POSITIVE_INFINITY;
              let isNearby = false;

              if (currentPositionRef.current) {
                distance = calculateDistance(currentPositionRef.current.lat, currentPositionRef.current.lng, coordinate.lat, coordinate.lng);
                isNearby = distance <= 100;
              }

              const markerColor = isCompleted ? "#22C55E" : isNearby ? "#F59E0B" : "#10B981";

              const marker = L.marker([coordinate.lat, coordinate.lng], {
                icon: L.divIcon({
                  className: "custom-task-marker",
                  html: `
                    <div style="position: relative;">
                      <div style="
                        background-color: ${markerColor};
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        border: 4px solid white;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                      ">
                        ${
                          isCompleted
                            ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
                            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>'
                        }
                      </div>
                    </div>
                  `,
                  iconSize: [36, 36],
                  iconAnchor: [18, 36],
                }),
              });

              marker.bindPopup(`
                <div style="padding: 12px; min-width: 240px;">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                    <div style="background-color: ${markerColor}; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
                      ${
                        isCompleted
                          ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
                          : '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>'
                      }
                    </div>
                    <div style="flex: 1;">
                      <div style="font-weight: 700; color: ${markerColor}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">${isCompleted ? "SELESAI" : "LOKASI TUGAS"}</div>
                      <div style="font-size: 10px; color: #6B7280; margin-top: 2px;">${isCompleted ? "Sudah dikunjungi" : "Belum dikunjungi"}</div>
                    </div>
                  </div>
                  <h3 style="font-weight: 700; margin-bottom: 4px; color: #1F2937; font-size: 15px;">${name}</h3>
                  ${
                    description
                      ? `<p style="font-size: 12px; color: #6B7280; margin: 0 0 12px 0; line-height: 1.5;">${description}</p>`
                      : ""
                  }
                  ${
                    onPointComplete
                      ? `
                        <button
                          onclick="window.completeTaskPoint('${pointId}', '${name.replace(/'/g, "\\'")}', ${coordinate.lat}, ${coordinate.lng})"
                          style="
                            width: 100%;
                            background: linear-gradient(135deg, #10B981 0%, #059669 100%);
                            color: white;
                            border: none;
                            padding: 16px;
                            border-radius: 12px;
                            font-weight: 800;
                            font-size: 16px;
                            cursor: pointer;
                            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
                            margin-bottom: 12px;
                          "
                        >
                          Selesaikan Titik Ini
                        </button>
                      `
                      : ""
                  }
                  <div style="padding-top: 10px; border-top: 1px solid #E5E7EB; font-size: 10px; color: #9CA3AF; text-align: center;">
                    ${coordinate.lat.toFixed(6)}, ${coordinate.lng.toFixed(6)}
                  </div>
                </div>
              `);

              nextLayerGroup.addLayer(marker);
              nextBounds.extend([coordinate.lat, coordinate.lng]);
              nextGeometries.points.push({ name, coordinate });
              continue;
            }

            const first = coordinates[0];
            const last = coordinates[coordinates.length - 1];
            const isPolygon = coordinates.length >= 3 && first.lat === last.lat && first.lng === last.lng;

            if (isPolygon) {
              const polygon = L.polygon(
                coordinates.map((coordinate) => [coordinate.lat, coordinate.lng] as L.LatLngExpression),
                {
                  color: "#059669",
                  fillColor: "#10B981",
                  fillOpacity: 0.32,
                  weight: 3,
                }
              );

              polygon.bindPopup(`
                <div style="padding: 12px; min-width: 200px;">
                  <div style="font-weight: 700; color: #10B981; font-size: 11px; margin-bottom: 6px;">AREA TUGAS</div>
                  <h3 style="font-weight: 600; margin-bottom: 8px; color: #1F2937; font-size: 14px;">${name}</h3>
                  ${
                    description
                      ? `<p style="font-size: 12px; color: #6B7280; margin: 0; line-height: 1.5;">${description}</p>`
                      : ""
                  }
                </div>
              `);

              if (nextLayerGroup && nextLayerGroup.addLayer && typeof nextLayerGroup.addLayer === "function") {
                nextLayerGroup.addLayer(polygon);
                coordinates.forEach((coordinate) => nextBounds.extend([coordinate.lat, coordinate.lng]));
                nextGeometries.polygons.push({ name, coordinates });
              }
              continue;
            }

            const polyline = L.polyline(
              coordinates.map((coordinate) => [coordinate.lat, coordinate.lng] as L.LatLngExpression),
              {
                color: "#10B981",
                weight: 4,
              }
            );

            polyline.bindPopup(`
              <div style="padding: 12px; min-width: 200px;">
                <div style="font-weight: 700; color: #10B981; font-size: 11px; margin-bottom: 6px;">RUTE TUGAS</div>
                <h3 style="font-weight: 600; margin-bottom: 8px; color: #1F2937; font-size: 14px;">${name}</h3>
                ${
                  description
                    ? `<p style="font-size: 12px; color: #6B7280; margin: 0; line-height: 1.5;">${description}</p>`
                    : ""
                }
              </div>
            `);

            nextLayerGroup.addLayer(polyline);
            coordinates.forEach((coordinate) => nextBounds.extend([coordinate.lat, coordinate.lng]));
            nextGeometries.polylines.push({ name, coordinates });
          } catch (placemarkError) {
            console.error("Error processing placemark:", placemarkError);
          }
        }

        map.invalidateSize(false);
        await waitForMapReady(map);
        nextLayerGroup.addTo(map);
        layerGroupRef.current = nextLayerGroup;
        setParsedGeometries(nextGeometries);

        if (fitBoundsOnLoad && nextBounds.isValid()) {
          map.fitBounds(nextBounds, {
            padding: [24, 24],
            maxZoom: 17,
            animate: false,
          });
        }

        setLoading(false);
      } catch (loadError) {
        console.error("[KMZ] Error loading KMZ file:", loadError);
        setParsedGeometries(emptyGeometries);
        setError(loadError instanceof Error ? loadError.message : "Unknown error occurred");
        setLoading(false);
      }
    };

    void loadKMZFile();

    return () => {
      if (layerGroupRef.current) {
        try {
          layerGroupRef.current.clearLayers();
          layerGroupRef.current.remove();
        } catch (layerError) {
          console.warn("Gagal membersihkan layer KMZ saat unmount:", layerError);
        } finally {
          layerGroupRef.current = null;
        }
      }
    };
  }, [fitBoundsOnLoad, map, kmzFileUrl, completedPoints, onPointComplete]);

  useEffect(() => {
    if (!error || !map) return;

    const ErrorControl = L.Control.extend({
      onAdd() {
        const div = L.DomUtil.create("div", "kmz-error-notification");
        div.innerHTML = `
          <div style="
            background: #FEE2E2;
            border: 1px solid #FCA5A5;
            border-radius: 8px;
            padding: 12px;
            margin: 10px;
            max-width: 300px;
            font-size: 12px;
            color: #991B1B;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          ">
            <div style="font-weight: bold; margin-bottom: 4px;">KMZ Tidak Dimuat</div>
            <div>${error}</div>
          </div>
        `;
        return div;
      },
    });

    const errorNotification = new ErrorControl({ position: "topright" });
    errorNotification.addTo(map);

    const timeoutId = window.setTimeout(() => {
      map.removeControl(errorNotification);
    }, 10000);

    return () => {
      window.clearTimeout(timeoutId);
      map.removeControl(errorNotification);
    };
  }, [error, map]);

  if (loading) {
    return null;
  }

  return null;
}
