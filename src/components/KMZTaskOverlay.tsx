"use client";

import { useEffect, useState } from "react";
import L from "leaflet";

interface KMZTaskOverlayProps {
  map: L.Map | null;
  kmzFileUrl?: string;
  currentPosition?: { lat: number; lng: number } | null;
  completedPoints?: string[];
  onPointComplete?: (pointId: string, pointName: string, lat: number, lng: number) => void;
}

export default function KMZTaskOverlay({ 
  map, 
  kmzFileUrl, 
  currentPosition,
  completedPoints = [],
  onPointComplete 
}: KMZTaskOverlayProps) {
  const [layerGroup, setLayerGroup] = useState<L.LayerGroup | null>(null);
  const [loading, setLoading] = useState(false);

  // Calculate distance between two points in meters
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  useEffect(() => {
    if (!map || !kmzFileUrl) return;

    // Clean up previous layer if exists
    if (layerGroup) {
      layerGroup.clearLayers();
      layerGroup.remove();
      setLayerGroup(null);
    }

    const loadKMZFile = async () => {
      setLoading(true);
      try {
        console.log("[KMZ] Loading KMZ file from:", kmzFileUrl);
        
        // Fetch KMZ file using proxy to avoid CORS issues
        const proxyUrl = `/api/proxy-kmz?url=${encodeURIComponent(kmzFileUrl)}`;
        console.log("[KMZ] Using proxy URL:", proxyUrl);
        
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch KMZ: ${response.statusText}`);
        }
        
        console.log("[KMZ] Fetch successful, parsing KMZ...");
        const arrayBuffer = await response.arrayBuffer();

        // Parse KMZ
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();
        const contents = await zip.loadAsync(arrayBuffer);

        // Find KML file in the archive
        const kmlFile = Object.keys(contents.files).find((name) =>
          name.endsWith(".kml")
        );

        if (!kmlFile) {
          console.error("No KML file found in KMZ archive");
          return;
        }

        const kmlText = await contents.files[kmlFile].async("text");

        // Parse KML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(kmlText, "text/xml");

        // Extract placemarks
        const placemarks = xmlDoc.getElementsByTagName("Placemark");
        const newLayerGroup = L.layerGroup().addTo(map);

        for (let i = 0; i < placemarks.length; i++) {
          try {
            const placemark = placemarks[i];
            const name =
              placemark.getElementsByTagName("name")[0]?.textContent ||
              `Titik Tugas ${i + 1}`;
            const description =
              placemark.getElementsByTagName("description")[0]?.textContent || "";

            // Get coordinates
            const coordinates = placemark
              .getElementsByTagName("coordinates")[0]
              ?.textContent?.trim();

            if (!coordinates) {
              console.warn("No coordinates found for placemark:", name);
              continue;
            }

            const coordPairs = coordinates
              .split(/\s+/)
              .map((coord) => {
                const [lng, lat] = coord.split(",").map(Number);
                return [lat, lng] as [number, number];
              })
              .filter((coord): coord is [number, number] => !isNaN(coord[0]) && !isNaN(coord[1])); // Filter out invalid coordinates

            if (coordPairs.length === 0) {
              console.warn("No valid coordinates found for placemark:", name);
              continue;
            }

            if (coordPairs.length === 1) {
              // Single point - add marker for task location
              const [lat, lng] = coordPairs[0];
              const pointId = `point_${lat}_${lng}`;
              const isCompleted = completedPoints.includes(pointId);
              
              // Calculate distance if current position is available
              let distance = Infinity;
              // Testing Mode: Always show as nearby to enable completion button
              let isNearby = true; // Set to true for testing, change to: distance <= 100 for production
              
              if (currentPosition) {
                distance = calculateDistance(currentPosition.lat, currentPosition.lng, lat, lng);
                // isNearby = distance <= 100; // Uncomment this for production mode
              }

              const markerColor = isCompleted ? "#22C55E" : isNearby ? "#F59E0B" : "#10B981";
              const labelText = isCompleted ? "✓ SELESAI" : isNearby ? "DI LOKASI" : "TUGAS";
              
              const marker = L.marker([lat, lng], {
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
                        ${isNearby && !isCompleted ? 'animation: pulse 2s infinite;' : ''}
                      ">
                        ${isCompleted ? 
                          '<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' :
                          '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>'
                        }
                      </div>
                      <div style="
                        position: absolute;
                        top: -28px;
                        left: 50%;
                        transform: translateX(-50%);
                        background-color: ${markerColor};
                        color: white;
                        padding: 3px 10px;
                        border-radius: 6px;
                        font-size: 10px;
                        font-weight: 700;
                        white-space: nowrap;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                      ">
                        ${labelText}
                      </div>
                    </div>
                    <style>
                      @keyframes pulse {
                        0%, 100% { opacity: 1; transform: scale(1); }
                        50% { opacity: 0.8; transform: scale(1.1); }
                      }
                    </style>
                  `,
                  iconSize: [36, 36],
                  iconAnchor: [18, 36],
                }),
              });

              const popupContent = `
                <div style="padding: 12px; min-width: 240px;">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                    <div style="background-color: ${markerColor}; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
                      ${isCompleted ? 
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' :
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>'
                      }
                    </div>
                    <div style="flex: 1;">
                      <div style="font-weight: 700; color: ${markerColor}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">${isCompleted ? '✓ SELESAI' : 'LOKASI TUGAS'}</div>
                      <div style="font-size: 10px; color: #6B7280; margin-top: 2px;">${isCompleted ? 'Sudah dikunjungi' : 'Belum dikunjungi'}</div>
                    </div>
                  </div>
                  
                  <h3 style="font-weight: 700; margin-bottom: 4px; color: #1F2937; font-size: 15px;">${name}</h3>
                  ${
                    description
                      ? `<p style="font-size: 12px; color: #6B7280; margin: 0 0 12px 0; line-height: 1.5;">${description}</p>`
                      : ""
                  }
                  
                  ${isCompleted ? `
                    <div style="background: linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%); padding: 14px; border-radius: 10px; margin-bottom: 12px; text-align: center; border: 2px solid #10B981; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);">
                      <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#059669">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                        <span style="color: #047857; font-size: 14px; font-weight: 800;">TITIK SUDAH SELESAI</span>
                      </div>
                      <div style="background: white; padding: 6px 12px; border-radius: 6px; margin-top: 8px;">
                        <span style="color: #059669; font-size: 11px; font-weight: 600;">✓ Petugas sudah pernah ke titik ini</span>
                      </div>
                    </div>
                  ` : `
                    <div style="background: #FEF3C7; padding: 10px; border-radius: 8px; margin-bottom: 12px; text-align: center; border: 2px dashed #F59E0B;">
                      <div style="color: #D97706; font-size: 12px; font-weight: 700; margin-bottom: 4px;">📍 Belum Dikunjungi</div>
                      <div style="color: #92400E; font-size: 11px;">Klik tombol selesai setelah tiba di lokasi</div>
                    </div>
                    
                    ${onPointComplete ? `
                      <button 
                        onclick="window.completeTaskPoint('${pointId}', '${name.replace(/'/g, "\\'")}',${ lat}, ${lng})"
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
                          transition: all 0.3s;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          gap: 8px;
                        "
                        onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 16px rgba(16, 185, 129, 0.5)'"
                        onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.4)'"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                        Selesaikan Titik Ini
                      </button>
                    ` : ''}
                  `}
                  
                  <div style="padding-top: 10px; border-top: 1px solid #E5E7EB; font-size: 10px; color: #9CA3AF; text-align: center;">
                    📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}
                  </div>
                </div>
              `;
              
              marker.bindPopup(popupContent);

              newLayerGroup.addLayer(marker);
            } else if (coordPairs.length >= 2) {
              // Multiple points - add polyline or polygon with green color
              const isPolygon =
                coordPairs.length >= 3 &&
                coordPairs[0][0] === coordPairs[coordPairs.length - 1][0] &&
                coordPairs[0][1] === coordPairs[coordPairs.length - 1][1];

              if (isPolygon) {
                const polygon = L.polygon(coordPairs as L.LatLngExpression[], {
                  color: "#10B981",
                  fillColor: "#10B981",
                  fillOpacity: 0.2,
                  weight: 3,
                  dashArray: "10, 5",
                });

                polygon.bindPopup(`
                  <div style="padding: 12px; min-width: 200px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                      <div style="background-color: #10B981; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-center;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                          <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                        </svg>
                      </div>
                      <span style="font-weight: 700; color: #10B981; font-size: 11px;">AREA TUGAS</span>
                    </div>
                    <h3 style="font-weight: 600; margin-bottom: 8px; color: #1F2937; font-size: 14px;">${name}</h3>
                    ${
                      description
                        ? `<p style="font-size: 12px; color: #6B7280; margin: 0; line-height: 1.5;">${description}</p>`
                        : ""
                    }
                  </div>
                `);

                newLayerGroup.addLayer(polygon);
              } else {
                const polyline = L.polyline(coordPairs as L.LatLngExpression[], {
                  color: "#10B981",
                  weight: 4,
                  dashArray: "10, 5",
                });

                polyline.bindPopup(`
                  <div style="padding: 12px; min-width: 200px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                      <div style="background-color: #10B981; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-center;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                          <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>
                        </svg>
                      </div>
                      <span style="font-weight: 700; color: #10B981; font-size: 11px;">RUTE TUGAS</span>
                    </div>
                    <h3 style="font-weight: 600; margin-bottom: 8px; color: #1F2937; font-size: 14px;">${name}</h3>
                    ${
                      description
                        ? `<p style="font-size: 12px; color: #6B7280; margin: 0; line-height: 1.5;">${description}</p>`
                        : ""
                    }
                  </div>
                `);

                newLayerGroup.addLayer(polyline);
              }
            }
          } catch (error) {
            console.error("Error processing placemark:", error);
          }
        }

        setLayerGroup(newLayerGroup);
        console.log("[KMZ] Successfully loaded and displayed KMZ with", placemarks.length, "placemarks");
        setLoading(false);
      } catch (error) {
        console.error("[KMZ] Error loading KMZ file:", error);
        if (error instanceof Error) {
          console.error("[KMZ] Error details:", error.message);
        }
        setLoading(false);
      }
    };

    loadKMZFile();

    return () => {
      if (layerGroup) {
        layerGroup.clearLayers();
        layerGroup.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, kmzFileUrl]);

  return null; // This is an overlay component, no UI needed
}
