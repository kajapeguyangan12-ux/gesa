"use client";

import { useEffect, useState } from "react";
import L from "leaflet";
import JSZip from "jszip";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layerGroup, setLayerGroup] = useState<L.LayerGroup | null>(null);

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  };

  const loadKMZFile = async () => {
    if (!map || !kmzFileUrl) return;

    setLoading(true);
    setError(null);

    try {
      console.log("[KMZ] Loading KMZ file from:", kmzFileUrl);
      
      const proxyUrl = `/api/proxy-kmz?url=${encodeURIComponent(kmzFileUrl)}`;
      console.log("[KMZ] Using proxy URL:", proxyUrl);
      
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[KMZ] Proxy response error:", response.status, errorText);
        
        const kabupatenName = kmzFileUrl.split('/').pop()?.replace('.kmz', '').replace(/_/g, ' ') || 'Unknown';
        throw new Error(`KMZ file tidak dapat dimuat untuk ${kabupatenName}. Pastikan file KMZ valid dan dapat diakses.`);
      }
      
      console.log("[KMZ] Fetch successful, parsing KMZ...");
      const buffer = await response.arrayBuffer();
      
      if (buffer.byteLength < 100) {
        throw new Error("KMZ file terlalu kecil atau korup");
      }

      const zip = await JSZip.loadAsync(buffer);
      console.log("[KMZ] KMZ loaded, searching for KML files...");
      
      const kmlFiles = Object.keys(zip.files).filter(filename => 
        filename.toLowerCase().endsWith('.kml')
      );
      
      if (kmlFiles.length === 0) {
        throw new Error("Tidak ada file KML yang ditemukan di KMZ");
      }

      const kmlFile = kmlFiles[0];
      const kmlContent = await zip.files[kmlFile].async("string");
      console.log("[KMZ] KML content loaded, parsing XML...");
      
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(kmlContent, "text/xml");
      
      const parseError = xmlDoc.getElementsByTagName("parsererror");
      if (parseError.length > 0) {
        throw new Error("Invalid KML format in KMZ file");
      }

      const placemarks = xmlDoc.getElementsByTagName("Placemark");
      
      if (placemarks.length === 0) {
        console.warn("[KMZ] No placemarks found in KML file");
        return;
      }

      // Clear existing layers
      if (layerGroup) {
        try {
          layerGroup.clearLayers();
          layerGroup.remove();
        } catch (error) {
          console.warn("[KMZ] Error clearing existing layers:", error);
        }
      }

      // Validate map is ready before adding layers
      if (!map || !map.getContainer()) {
        console.warn("[KMZ] Map is not ready, skipping KMZ loading");
        return;
      }

      const newLayerGroup = L.layerGroup().addTo(map);

      for (let i = 0; i < placemarks.length; i++) {
        try {
          const placemark = placemarks[i];
          const name =
            placemark.getElementsByTagName("name")[0]?.textContent ||
            `Titik Tugas ${i + 1}`;
          const description =
            placemark.getElementsByTagName("description")[0]?.textContent || "";

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
            .filter((coord): coord is [number, number] => !isNaN(coord[0]) && !isNaN(coord[1]));

          console.log(`[KMZ] Placemark "${name}":`, {
            totalCoords: coordPairs.length,
            isPolygon: coordPairs.length >= 3 && coordPairs[0] && coordPairs[coordPairs.length - 1] && coordPairs[0][0] === coordPairs[coordPairs.length - 1][0] && coordPairs[0][1] === coordPairs[coordPairs.length - 1][1],
            firstCoord: coordPairs[0],
            lastCoord: coordPairs[coordPairs.length - 1],
            sampleCoords: coordPairs.slice(0, 3)
          });

          if (coordPairs.length === 0) {
            console.warn("No valid coordinates found for placemark:", name);
            continue;
          }

          if (coordPairs.length === 1) {
            // Single point - add marker
            const [lat, lng] = coordPairs[0];
            const pointId = `point_${lat}_${lng}`;
            const isCompleted = completedPoints.includes(pointId);
            
            let distance = Infinity;
            let isNearby = false;
            
            if (currentPosition) {
              distance = calculateDistance(currentPosition.lat, currentPosition.lng, lat, lng);
              isNearby = distance <= 100;
            }

            const markerColor = isCompleted ? "#22C55E" : isNearby ? "#F59E0B" : "#10B981";
            
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
                    ">
                      ${isCompleted ? 
                        '<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' :
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>'
                      }
                    </div>
                  </div>
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
                `}
                
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
                
                <div style="padding-top: 10px; border-top: 1px solid #E5E7EB; font-size: 10px; color: #9CA3AF; text-align: center;">
                  📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}
                </div>
              </div>
            `;
            
            marker.bindPopup(popupContent);
            newLayerGroup.addLayer(marker);
          } else if (coordPairs.length >= 2) {
            // Multiple points - add polyline or polygon
            const isPolygon =
              coordPairs.length >= 3 &&
              coordPairs[0][0] === coordPairs[coordPairs.length - 1][0] &&
              coordPairs[0][1] === coordPairs[coordPairs.length - 1][1];

            const validCoords = coordPairs.filter(coord => 
              coord && 
              typeof coord[0] === 'number' && 
              typeof coord[1] === 'number' && 
              !isNaN(coord[0]) && 
              !isNaN(coord[1])
            );

            if (isPolygon && validCoords.length >= 3) {
              // Create polygon
              const polygon = L.polygon(validCoords as L.LatLngExpression[], {
                color: "#059669",
                fillColor: "#10B981",
                fillOpacity: 0.4,
                weight: 3,
              });

              polygon.bindPopup(`
                <div style="padding: 12px; min-width: 200px;">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <div style="background-color: #10B981; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                        <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6z"/>
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
            } else if (validCoords.length >= 2) {
              // Create polyline
              const polyline = L.polyline(validCoords as L.LatLngExpression[], {
                color: "#10B981",
                weight: 4,
              });

              polyline.bindPopup(`
                <div style="padding: 12px; min-width: 200px;">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <div style="background-color: #10B981; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error("[KMZ] Error details:", errorMessage);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKMZFile();

    return () => {
      if (layerGroup) {
        layerGroup.clearLayers();
        layerGroup.remove();
      }
    };
  }, [map, kmzFileUrl]);

  // Show error notification on map if KMZ fails to load
  if (error && map) {
    const ErrorControl = L.Control.extend({
      onAdd: function() {
        const div = L.DomUtil.create('div', 'kmz-error-notification');
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
            <div style="font-weight: bold; margin-bottom: 4px;">⚠️ KMZ Tidak Dimuat</div>
            <div>${error}</div>
          </div>
        `;
        return div;
      }
    });
    
    const errorNotification = new ErrorControl({ position: 'topright' });
    errorNotification.addTo(map);
    
    setTimeout(() => {
      map.removeControl(errorNotification);
    }, 10000);
  }

  return null;
}
