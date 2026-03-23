export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface TaskPolygonGeometry {
  name: string;
  coordinates: LatLngPoint[];
}

export interface TaskLineGeometry {
  name: string;
  coordinates: LatLngPoint[];
}

export interface TaskPointGeometry {
  name: string;
  coordinate: LatLngPoint;
}

export interface ParsedTaskGeometries {
  polygons: TaskPolygonGeometry[];
  polylines: TaskLineGeometry[];
  points: TaskPointGeometry[];
}

export interface TaskNavigationInfo {
  hasTaskGeometry: boolean;
  geometryType: "polygon" | "polyline" | "point" | null;
  taskName: string;
  isInsidePolygon: boolean | null;
  distanceToTargetMeters: number | null;
  nearestCoordinate: LatLngPoint | null;
}

const EARTH_RADIUS_METERS = 6371e3;
const METERS_PER_DEGREE_LAT = 111320;

export function getDistanceMeters(from: LatLngPoint, to: LatLngPoint): number {
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

function normalizePolygon(polygon: LatLngPoint[]): LatLngPoint[] {
  if (polygon.length < 3) return polygon;
  const first = polygon[0];
  const last = polygon[polygon.length - 1];
  if (first.lat === last.lat && first.lng === last.lng) {
    return polygon.slice(0, -1);
  }
  return polygon;
}

export function isPointInsidePolygon(point: LatLngPoint, polygon: LatLngPoint[]): boolean {
  const normalizedPolygon = normalizePolygon(polygon);
  if (normalizedPolygon.length < 3) return false;

  let isInside = false;
  for (let i = 0, j = normalizedPolygon.length - 1; i < normalizedPolygon.length; j = i++) {
    const current = normalizedPolygon[i];
    const previous = normalizedPolygon[j];

    const intersects =
      current.lat > point.lat !== previous.lat > point.lat &&
      point.lng <
        ((previous.lng - current.lng) * (point.lat - current.lat)) / (previous.lat - current.lat || Number.EPSILON) +
          current.lng;

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
}

function toCartesian(point: LatLngPoint, referenceLat: number) {
  const metersPerDegreeLng = Math.cos((referenceLat * Math.PI) / 180) * 111320;
  return {
    x: point.lng * metersPerDegreeLng,
    y: point.lat * METERS_PER_DEGREE_LAT,
  };
}

function toLatLng(point: { x: number; y: number }, referenceLat: number): LatLngPoint {
  const metersPerDegreeLng = Math.cos((referenceLat * Math.PI) / 180) * 111320;
  return {
    lat: point.y / METERS_PER_DEGREE_LAT,
    lng: point.x / metersPerDegreeLng,
  };
}

function getNearestPointOnSegment(point: LatLngPoint, start: LatLngPoint, end: LatLngPoint) {
  const referenceLat = point.lat;
  const pointXY = toCartesian(point, referenceLat);
  const startXY = toCartesian(start, referenceLat);
  const endXY = toCartesian(end, referenceLat);

  const deltaX = endXY.x - startXY.x;
  const deltaY = endXY.y - startXY.y;
  const segmentLengthSquared = deltaX * deltaX + deltaY * deltaY;

  if (segmentLengthSquared === 0) {
    return {
      coordinate: start,
      distanceMeters: getDistanceMeters(point, start),
    };
  }

  const projection =
    ((pointXY.x - startXY.x) * deltaX + (pointXY.y - startXY.y) * deltaY) / segmentLengthSquared;
  const clampedProjection = Math.max(0, Math.min(1, projection));

  const nearestXY = {
    x: startXY.x + clampedProjection * deltaX,
    y: startXY.y + clampedProjection * deltaY,
  };
  const nearestCoordinate = toLatLng(nearestXY, referenceLat);

  return {
    coordinate: nearestCoordinate,
    distanceMeters: getDistanceMeters(point, nearestCoordinate),
  };
}

export function findNearestPointOnPolyline(point: LatLngPoint, coordinates: LatLngPoint[]) {
  if (coordinates.length === 0) {
    return { coordinate: null, distanceMeters: null };
  }

  if (coordinates.length === 1) {
    return {
      coordinate: coordinates[0],
      distanceMeters: getDistanceMeters(point, coordinates[0]),
    };
  }

  let nearestCoordinate: LatLngPoint | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const nearest = getNearestPointOnSegment(point, coordinates[index], coordinates[index + 1]);
    if (nearest.distanceMeters < nearestDistance) {
      nearestDistance = nearest.distanceMeters;
      nearestCoordinate = nearest.coordinate;
    }
  }

  return {
    coordinate: nearestCoordinate,
    distanceMeters: Number.isFinite(nearestDistance) ? nearestDistance : null,
  };
}

export function findNearestPointOnPolygonEdge(point: LatLngPoint, polygon: LatLngPoint[]) {
  const normalizedPolygon = normalizePolygon(polygon);
  if (normalizedPolygon.length < 2) {
    return {
      coordinate: normalizedPolygon[0] ?? null,
      distanceMeters: normalizedPolygon[0] ? getDistanceMeters(point, normalizedPolygon[0]) : null,
    };
  }

  let nearestCoordinate: LatLngPoint | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < normalizedPolygon.length; index += 1) {
    const current = normalizedPolygon[index];
    const next = normalizedPolygon[(index + 1) % normalizedPolygon.length];
    const nearest = getNearestPointOnSegment(point, current, next);

    if (nearest.distanceMeters < nearestDistance) {
      nearestDistance = nearest.distanceMeters;
      nearestCoordinate = nearest.coordinate;
    }
  }

  return {
    coordinate: nearestCoordinate,
    distanceMeters: Number.isFinite(nearestDistance) ? nearestDistance : null,
  };
}

export function analyzeTaskNavigation(
  currentPosition: LatLngPoint | null | undefined,
  geometries: ParsedTaskGeometries | null | undefined
): TaskNavigationInfo | null {
  if (!currentPosition || !geometries) return null;

  if (geometries.polygons.length > 0) {
    let bestPolygon:
      | {
          name: string;
          isInside: boolean;
          coordinate: LatLngPoint | null;
          distanceMeters: number | null;
        }
      | null = null;

    for (const polygon of geometries.polygons) {
      const isInside = isPointInsidePolygon(currentPosition, polygon.coordinates);
      const nearest = findNearestPointOnPolygonEdge(currentPosition, polygon.coordinates);

      if (!bestPolygon) {
        bestPolygon = {
          name: polygon.name,
          isInside,
          coordinate: nearest.coordinate,
          distanceMeters: isInside ? 0 : nearest.distanceMeters,
        };
        continue;
      }

      if (isInside && !bestPolygon.isInside) {
        bestPolygon = {
          name: polygon.name,
          isInside,
          coordinate: nearest.coordinate,
          distanceMeters: 0,
        };
        continue;
      }

      if (isInside === bestPolygon.isInside && (nearest.distanceMeters ?? Number.POSITIVE_INFINITY) < (bestPolygon.distanceMeters ?? Number.POSITIVE_INFINITY)) {
        bestPolygon = {
          name: polygon.name,
          isInside,
          coordinate: nearest.coordinate,
          distanceMeters: isInside ? 0 : nearest.distanceMeters,
        };
      }
    }

    if (bestPolygon) {
      return {
        hasTaskGeometry: true,
        geometryType: "polygon",
        taskName: bestPolygon.name,
        isInsidePolygon: bestPolygon.isInside,
        distanceToTargetMeters: bestPolygon.distanceMeters,
        nearestCoordinate: bestPolygon.coordinate,
      };
    }
  }

  if (geometries.polylines.length > 0) {
    let bestLine:
      | {
          name: string;
          coordinate: LatLngPoint | null;
          distanceMeters: number | null;
        }
      | null = null;

    for (const polyline of geometries.polylines) {
      const nearest = findNearestPointOnPolyline(currentPosition, polyline.coordinates);
      if (!bestLine || (nearest.distanceMeters ?? Number.POSITIVE_INFINITY) < (bestLine.distanceMeters ?? Number.POSITIVE_INFINITY)) {
        bestLine = {
          name: polyline.name,
          coordinate: nearest.coordinate,
          distanceMeters: nearest.distanceMeters,
        };
      }
    }

    if (bestLine) {
      return {
        hasTaskGeometry: true,
        geometryType: "polyline",
        taskName: bestLine.name,
        isInsidePolygon: null,
        distanceToTargetMeters: bestLine.distanceMeters,
        nearestCoordinate: bestLine.coordinate,
      };
    }
  }

  if (geometries.points.length > 0) {
    let bestPoint:
      | {
          name: string;
          coordinate: LatLngPoint;
          distanceMeters: number;
        }
      | null = null;

    for (const taskPoint of geometries.points) {
      const distanceMeters = getDistanceMeters(currentPosition, taskPoint.coordinate);
      if (!bestPoint || distanceMeters < bestPoint.distanceMeters) {
        bestPoint = {
          name: taskPoint.name,
          coordinate: taskPoint.coordinate,
          distanceMeters,
        };
      }
    }

    if (bestPoint) {
      return {
        hasTaskGeometry: true,
        geometryType: "point",
        taskName: bestPoint.name,
        isInsidePolygon: null,
        distanceToTargetMeters: bestPoint.distanceMeters,
        nearestCoordinate: bestPoint.coordinate,
      };
    }
  }

  return {
    hasTaskGeometry: false,
    geometryType: null,
    taskName: "",
    isInsidePolygon: null,
    distanceToTargetMeters: null,
    nearestCoordinate: null,
  };
}
