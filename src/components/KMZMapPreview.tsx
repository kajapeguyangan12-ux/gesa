"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface KMZMapPreviewProps {
  file: File | null;
  height?: string;
}

export default function KMZMapPreview({ file, height = "300px" }: KMZMapPreviewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapData, setMapData] = useState<any>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map only once
    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [-6.2088, 106.8456], // Default to Jakarta
        zoom: 12,
        zoomControl: true,
        attributionControl: false,
        preferCanvas: true, // Better performance for mobile
      });

      // Add tile layer with better mobile performance
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        minZoom: 5,
        updateWhenIdle: true, // Update tiles only when map stops moving
        updateWhenZooming: false, // Don't update while zooming
        keepBuffer: 2, // Keep minimal tile buffer for performance
      }).addTo(map);

      mapRef.current = map;
    }

    return () => {
      // Cleanup on unmount
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!file || !mapRef.current) {
      setMapData(null);
      return;
    }

    const parseKMZFile = async () => {
      setLoading(true);
      setError(null);

      try {
        const reader = new FileReader();

        reader.onload = async (e) => {
          const result = e.target?.result;
          if (!result) return;

          try {
            let kmlText = "";

            if (file.name.endsWith(".kmz")) {
              // Parse KMZ (compressed KML)
              const JSZip = (await import("jszip")).default;
              const zip = new JSZip();
              const contents = await zip.loadAsync(result as ArrayBuffer);
              
              // Find KML file in the archive
              const kmlFile = Object.keys(contents.files).find(
                (name) => name.endsWith(".kml")
              );
              
              if (!kmlFile) {
                throw new Error("No KML file found in KMZ archive");
              }
              
              kmlText = await contents.files[kmlFile].async("text");
            } else {
              // Parse KML directly
              kmlText = result as string;
            }

            // Parse KML and extract coordinates
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(kmlText, "text/xml");
            
            // Extract placemarks
            const placemarks = xmlDoc.getElementsByTagName("Placemark");
            const features: any[] = [];
            const bounds = L.latLngBounds([]);

            for (let i = 0; i < placemarks.length; i++) {
              const placemark = placemarks[i];
              const name = placemark.getElementsByTagName("name")[0]?.textContent || `Point ${i + 1}`;
              const description = placemark.getElementsByTagName("description")[0]?.textContent || "";
              
              // Get coordinates (Point, LineString, or Polygon)
              const coordinates = placemark.getElementsByTagName("coordinates")[0]?.textContent?.trim();
              
              if (coordinates) {
                const coordPairs = coordinates.split(/\s+/).map((coord) => {
                  const [lng, lat] = coord.split(",").map(Number);
                  return [lat, lng];
                });

                features.push({
                  name,
                  description,
                  coordinates: coordPairs,
                });

                // Add to bounds
                coordPairs.forEach(([lat, lng]) => {
                  bounds.extend([lat, lng]);
                });
              }
            }

            if (features.length === 0) {
              throw new Error("No valid coordinates found in file");
            }

            setMapData({ features, bounds });
            setLoading(false);
          } catch (err) {
            console.error("Error parsing file:", err);
            setError("Error parsing KMZ/KML file. Please check the file format.");
            setLoading(false);
          }
        };

        reader.onerror = () => {
          setError("Error reading file");
          setLoading(false);
        };

        if (file.name.endsWith(".kmz")) {
          reader.readAsArrayBuffer(file);
        } else {
          reader.readAsText(file);
        }
      } catch (err) {
        console.error("Error loading file:", err);
        setError("Error loading file");
        setLoading(false);
      }
    };

    parseKMZFile();
  }, [file]);

  // Render markers/polygons on map
  useEffect(() => {
    if (!mapData || !mapRef.current) return;

    const map = mapRef.current;
    const layerGroup = L.layerGroup().addTo(map);

    try {
      mapData.features.forEach((feature: any, index: number) => {
        const { name, description, coordinates } = feature;

        if (coordinates.length === 1) {
          // Single point - add marker
          const [lat, lng] = coordinates[0];
          const marker = L.marker([lat, lng], {
            icon: L.divIcon({
              className: "custom-marker",
              html: `<div style="background-color: #3B82F6; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            }),
          });

          marker.bindPopup(`
            <div style="padding: 8px; min-width: 150px;">
              <h3 style="font-weight: 600; margin-bottom: 4px; color: #1F2937;">${name}</h3>
              ${description ? `<p style="font-size: 12px; color: #6B7280; margin: 0;">${description}</p>` : ""}
            </div>
          `);

          layerGroup.addLayer(marker);
        } else {
          // Multiple points - add polyline or polygon
          const isPolygon = coordinates[0][0] === coordinates[coordinates.length - 1][0] &&
                           coordinates[0][1] === coordinates[coordinates.length - 1][1];

          if (isPolygon) {
            const polygon = L.polygon(coordinates, {
              color: "#3B82F6",
              fillColor: "#3B82F6",
              fillOpacity: 0.2,
              weight: 2,
            });

            polygon.bindPopup(`
              <div style="padding: 8px; min-width: 150px;">
                <h3 style="font-weight: 600; margin-bottom: 4px; color: #1F2937;">${name}</h3>
                ${description ? `<p style="font-size: 12px; color: #6B7280; margin: 0;">${description}</p>` : ""}
              </div>
            `);

            layerGroup.addLayer(polygon);
          } else {
            const polyline = L.polyline(coordinates, {
              color: "#3B82F6",
              weight: 3,
            });

            polyline.bindPopup(`
              <div style="padding: 8px; min-width: 150px;">
                <h3 style="font-weight: 600; margin-bottom: 4px; color: #1F2937;">${name}</h3>
                ${description ? `<p style="font-size: 12px; color: #6B7280; margin: 0;">${description}</p>` : ""}
              </div>
            `);

            layerGroup.addLayer(polyline);
          }
        }
      });

      // Fit map to bounds with padding
      if (mapData.bounds.isValid()) {
        map.fitBounds(mapData.bounds, {
          padding: [30, 30],
          maxZoom: 16,
          animate: false, // Disable animation for better performance
        });
      }
    } catch (err) {
      console.error("Error rendering features:", err);
    }

    return () => {
      layerGroup.clearLayers();
      layerGroup.remove();
    };
  }, [mapData]);

  if (!file) {
    return (
      <div
        style={{ height }}
        className="rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50"
      >
        <div className="text-center px-4">
          <svg
            className="w-12 h-12 text-gray-400 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <p className="text-sm text-gray-500">Upload file KMZ/KML untuk melihat preview peta</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{ height }}
        className="rounded-xl border-2 border-red-200 flex items-center justify-center bg-red-50"
      >
        <div className="text-center px-4">
          <svg
            className="w-12 h-12 text-red-400 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-red-600 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border-2 border-purple-200 shadow-lg z-0">
      <div
        ref={mapContainerRef}
        style={{ height }}
        className="w-full z-0"
      />
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Memuat peta...</p>
          </div>
        </div>
      )}
      {mapData && !loading && (
        <div className="absolute top-3 right-3 bg-white px-3 py-1.5 rounded-lg shadow-md text-xs font-medium text-gray-700 z-10">
          {mapData.features.length} titik
        </div>
      )}
    </div>
  );
}
