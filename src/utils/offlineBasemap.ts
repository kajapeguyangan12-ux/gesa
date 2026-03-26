import type { ParsedTaskGeometries } from "@/utils/taskNavigation";

const BASEMAP_CACHE_NAME = "gesa-basemap-v1";
const TILE_URL_TEMPLATE = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const SUBDOMAINS = ["a", "b", "c"];
const DEFAULT_ZOOMS = [15, 16, 17];
const MAX_TILE_COUNT = 220;
const BUFFER_METERS = 450;

interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

function getEmptyBounds(): Bounds | null {
  return null;
}

function extendBounds(bounds: Bounds | null, lat: number, lng: number): Bounds {
  if (!bounds) {
    return { minLat: lat, maxLat: lat, minLng: lng, maxLng: lng };
  }

  return {
    minLat: Math.min(bounds.minLat, lat),
    maxLat: Math.max(bounds.maxLat, lat),
    minLng: Math.min(bounds.minLng, lng),
    maxLng: Math.max(bounds.maxLng, lng),
  };
}

function getTaskBounds(geometries: ParsedTaskGeometries): Bounds | null {
  let bounds = getEmptyBounds();

  geometries.polygons.forEach((polygon) => {
    polygon.coordinates.forEach((coordinate) => {
      bounds = extendBounds(bounds, coordinate.lat, coordinate.lng);
    });
  });

  geometries.polylines.forEach((polyline) => {
    polyline.coordinates.forEach((coordinate) => {
      bounds = extendBounds(bounds, coordinate.lat, coordinate.lng);
    });
  });

  geometries.points.forEach((point) => {
    bounds = extendBounds(bounds, point.coordinate.lat, point.coordinate.lng);
  });

  return bounds;
}

function expandBounds(bounds: Bounds): Bounds {
  const latBuffer = BUFFER_METERS / 111320;
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const lngBuffer = BUFFER_METERS / Math.max(Math.cos((centerLat * Math.PI) / 180) * 111320, 1);

  return {
    minLat: bounds.minLat - latBuffer,
    maxLat: bounds.maxLat + latBuffer,
    minLng: bounds.minLng - lngBuffer,
    maxLng: bounds.maxLng + lngBuffer,
  };
}

function lngToTileX(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** zoom);
}

function latToTileY(lat: number, zoom: number): number {
  const radians = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * 2 ** zoom);
}

function buildTileUrls(bounds: Bounds, zooms: number[] = DEFAULT_ZOOMS, maxTiles = MAX_TILE_COUNT): string[] {
  const urls: string[] = [];

  for (const zoom of zooms) {
    const minX = lngToTileX(bounds.minLng, zoom);
    const maxX = lngToTileX(bounds.maxLng, zoom);
    const minY = latToTileY(bounds.maxLat, zoom);
    const maxY = latToTileY(bounds.minLat, zoom);

    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const subdomain = SUBDOMAINS[(x + y) % SUBDOMAINS.length];
        urls.push(
          TILE_URL_TEMPLATE.replace("{s}", subdomain)
            .replace("{z}", String(zoom))
            .replace("{x}", String(x))
            .replace("{y}", String(y))
        );

        if (urls.length >= maxTiles) {
          return urls;
        }
      }
    }
  }

  return urls;
}

async function cacheTileUrl(cache: Cache, url: string): Promise<void> {
  const request = new Request(url, { mode: "no-cors" });
  const cached = await cache.match(request);
  if (cached) return;

  const response = await fetch(request);
  await cache.put(request, response);
}

export async function prepareOfflineBasemapForTask(geometries: ParsedTaskGeometries): Promise<{ prepared: boolean; tileCount: number }> {
  if (typeof window === "undefined" || !("caches" in window)) {
    return { prepared: false, tileCount: 0 };
  }

  const rawBounds = getTaskBounds(geometries);
  if (!rawBounds) {
    return { prepared: false, tileCount: 0 };
  }

  const bounds = expandBounds(rawBounds);
  const tileUrls = buildTileUrls(bounds);
  if (tileUrls.length === 0) {
    return { prepared: false, tileCount: 0 };
  }

  const cache = await window.caches.open(BASEMAP_CACHE_NAME);

  for (const url of tileUrls) {
    try {
      await cacheTileUrl(cache, url);
    } catch (error) {
      console.error("Gagal cache tile basemap:", url, error);
    }
  }

  return { prepared: true, tileCount: tileUrls.length };
}
