import JSZip from "jszip";
import type { ParsedTaskGeometries } from "@/utils/taskNavigation";

const emptyGeometries: ParsedTaskGeometries = {
  polygons: [],
  polylines: [],
  points: [],
};

export async function loadParsedTaskGeometries(kmzFileUrl?: string): Promise<ParsedTaskGeometries> {
  if (!kmzFileUrl) {
    return emptyGeometries;
  }

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
    return emptyGeometries;
  }

  const nextGeometries: ParsedTaskGeometries = {
    polygons: [],
    polylines: [],
    points: [],
  };

  for (let index = 0; index < placemarks.length; index += 1) {
    const placemark = placemarks[index];
    const name = placemark.getElementsByTagName("name")[0]?.textContent || `Titik Tugas ${index + 1}`;
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
      nextGeometries.points.push({ name, coordinate: coordinates[0] });
      continue;
    }

    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    const isPolygon = coordinates.length >= 3 && first.lat === last.lat && first.lng === last.lng;

    if (isPolygon) {
      nextGeometries.polygons.push({ name, coordinates });
      continue;
    }

    nextGeometries.polylines.push({ name, coordinates });
  }

  return nextGeometries;
}
