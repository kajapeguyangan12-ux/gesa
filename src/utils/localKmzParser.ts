import JSZip from "jszip";
import type { ParsedTaskGeometries } from "@/utils/taskNavigation";

const emptyGeometries: ParsedTaskGeometries = {
  polygons: [],
  polylines: [],
  points: [],
};

function decodeXmlBuffer(buffer: ArrayBuffer): string {
  const decoders = ["utf-8", "utf-16le", "utf-16be"];
  for (const encoding of decoders) {
    try {
      const decoded = new TextDecoder(encoding as BufferEncoding, { fatal: false }).decode(buffer);
      const trimmed = decoded.replace(/^\uFEFF/, "").trim();
      if (trimmed.includes("<kml") || trimmed.includes("<Document") || trimmed.includes("<Placemark")) {
        return trimmed;
      }
    } catch {
      // Try next decoder.
    }
  }

  return new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "").trim();
}

function normalizeKmlNamespaces(kmlText: string): string {
  let normalized = kmlText.replace(/^\uFEFF/, "").trim();

  const hasSchemaLocation = /xsi:schemaLocation\s*=/.test(normalized);
  const hasXsiNamespace = /xmlns:xsi\s*=/.test(normalized);

  if (hasSchemaLocation && !hasXsiNamespace) {
    normalized = normalized.replace(
      /<kml\b([^>]*)>/i,
      '<kml$1 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
    );
  }

  return normalized;
}

function parseKmlText(kmlText: string): ParsedTaskGeometries {
  const parser = new DOMParser();
  const sanitizedText = normalizeKmlNamespaces(kmlText);
  const xmlDoc = parser.parseFromString(sanitizedText, "text/xml");
  const parseError = xmlDoc.getElementsByTagName("parsererror");

  if (parseError.length > 0) {
    const fallbackText = sanitizedText
      .replace(/\s+/g, " ")
      .slice(0, 240);
    const detail = parseError[0]?.textContent?.trim();
    throw new Error(
      detail
        ? `Format KML tidak valid: ${detail}`
        : `Format KML tidak valid. Cuplikan: ${fallbackText}`
    );
  }

  const placemarks = xmlDoc.getElementsByTagName("Placemark");
  if (placemarks.length === 0) {
    return emptyGeometries;
  }

  const geometries: ParsedTaskGeometries = {
    polygons: [],
    polylines: [],
    points: [],
  };

  for (let index = 0; index < placemarks.length; index += 1) {
    const placemark = placemarks[index];
    const name = placemark.getElementsByTagName("name")[0]?.textContent?.trim() || `Titik ${index + 1}`;
    const coordinatesText = placemark.getElementsByTagName("coordinates")[0]?.textContent?.trim();

    if (!coordinatesText) continue;

    const coordinates = coordinatesText
      .split(/\s+/)
      .map((coordinate) => {
        const [lng, lat] = coordinate.split(",").map(Number);
        return { lat, lng };
      })
      .filter((coordinate) => Number.isFinite(coordinate.lat) && Number.isFinite(coordinate.lng));

    if (coordinates.length === 0) continue;

    if (coordinates.length === 1) {
      geometries.points.push({ name, coordinate: coordinates[0] });
      continue;
    }

    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    const isPolygon = coordinates.length >= 3 && first.lat === last.lat && first.lng === last.lng;

    if (isPolygon) {
      geometries.polygons.push({ name, coordinates });
      continue;
    }

    geometries.polylines.push({ name, coordinates });
  }

  return geometries;
}

export async function parseLocalKmzOrKml(file: File): Promise<ParsedTaskGeometries> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".kml")) {
    const text = decodeXmlBuffer(await file.arrayBuffer());
    return parseKmlText(text);
  }

  if (!fileName.endsWith(".kmz")) {
    throw new Error("File harus berformat .kmz atau .kml.");
  }

  const buffer = await file.arrayBuffer();
  if (buffer.byteLength < 100) {
    throw new Error("File KMZ terlalu kecil atau korup.");
  }

  const zip = await JSZip.loadAsync(buffer);
  const kmlFiles = Object.keys(zip.files).filter((filename) => filename.toLowerCase().endsWith(".kml"));

  if (kmlFiles.length === 0) {
    throw new Error("Tidak ada file KML di dalam KMZ.");
  }

  const kmlBuffer = await zip.files[kmlFiles[0]].async("arraybuffer");
  const kmlText = decodeXmlBuffer(kmlBuffer);
  return parseKmlText(kmlText);
}
