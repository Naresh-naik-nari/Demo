/**
 * @file geo.ts
 * @module lib/utils/geo
 * @description Geospatial utility functions (distance, bearing, speed calculation).
 * Pure functions — no store dependencies.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371;

// ─── Distance ────────────────────────────────────────────────────────────────

/**
 * Calculates the great-circle distance between two lat/lng points
 * using the Haversine formula.
 *
 * @returns Distance in kilometres
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const a =
    Math.pow(Math.sin(dLat / 2), 2) +
    Math.pow(Math.sin(dLon / 2), 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);

  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Calculates the great-circle distance in metres.
 *
 * @returns Distance in metres
 */
export function haversineDistanceM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return haversineDistanceKm(lat1, lon1, lat2, lon2) * 1000;
}

// ─── Speed ───────────────────────────────────────────────────────────────────

/**
 * Calculates 3D speed from NED velocity components (cm/s → m/s).
 * Used when parsing `GLOBAL_POSITION_INT` MAVLink messages.
 *
 * @param vx - X velocity in cm/s
 * @param vy - Y velocity in cm/s
 * @param vz - Z velocity in cm/s
 * @returns Speed in m/s, rounded to 2 decimal places
 */
export function velocityToSpeed(vx: number, vy: number, vz: number): number {
  const speed = Math.sqrt((vx / 100) ** 2 + (vy / 100) ** 2 + (vz / 100) ** 2);
  return parseFloat(speed.toFixed(2));
}

// ─── Parsing helpers ─────────────────────────────────────────────────────────

/**
 * Parses lat/lon integers (×1e7) into a `{ lat, lng }` object.
 * Returns `null` if either value is missing or zero.
 */
export function parseLocation(
  lat: string | null,
  lon: string | null
): { lat: number; lng: number } | null {
  if (!lat || !lon) return null;
  const latNum = parseFloat(lat) / 1e7;
  const lngNum = parseFloat(lon) / 1e7;
  // Reject (0, 0) which indicates an uninitialized GPS
  if (latNum === 0 && lngNum === 0) return null;
  return { lat: latNum, lng: lngNum };
}
