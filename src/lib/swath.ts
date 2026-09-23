/**
 * Swath/Footprint Calculator for Camera Coverage
 * Calculates ground coverage area based on camera FOV, altitude, and gimbal angle
 */

export interface SwathParams {
  altitude: number;        // meters above ground
  cameraTilt: number;      // degrees (-90 to 0, negative is down)
  fovHorizontal: number;   // degrees
  fovVertical: number;     // degrees
  heading: number;         // UAV heading in degrees
  latitude: number;
  longitude: number;
}

export interface SwathCorners {
  topLeft: { lat: number; lng: number };
  topRight: { lat: number; lng: number };
  bottomRight: { lat: number; lng: number };
  bottomLeft: { lat: number; lng: number };
  center: { lat: number; lng: number };
  area: number; // square meters
}

/**
 * Calculate camera ground footprint
 * Based on altitude, camera FOV, and gimbal tilt angle
 */
export function calculateSwath(params: SwathParams): SwathCorners {
  const {
    altitude,
    cameraTilt,
    fovHorizontal,
    fovVertical,
    heading,
    latitude,
    longitude
  } = params;

  // Convert angles to radians
  const tiltRad = (cameraTilt * Math.PI) / 180;
  const fovHRad = (fovHorizontal * Math.PI) / 180;
  const fovVRad = (fovVertical * Math.PI) / 180;
  const headingRad = (heading * Math.PI) / 180;

  // Calculate slant range to ground (distance from camera to footprint center)
  // When camera is tilted down (negative angle), calculate distance to ground
  const effectiveTilt = Math.abs(tiltRad);
  const slantRange = altitude / Math.cos(effectiveTilt);

  // Calculate ground distance from drone to footprint center
  const groundDistance = altitude * Math.tan(effectiveTilt);

  // Calculate footprint dimensions at ground level
  // Width (perpendicular to flight direction)
  const footprintWidth = 2 * slantRange * Math.tan(fovHRad / 2);
  
  // Length (along flight direction)
  const footprintLength = 2 * slantRange * Math.tan(fovVRad / 2);

  // Calculate footprint center (offset from drone position)
  const centerLat = latitude + (groundDistance * Math.cos(headingRad)) / 111320; // meters to degrees lat
  const centerLng = longitude + (groundDistance * Math.sin(headingRad)) / (111320 * Math.cos(latitude * Math.PI / 180)); // meters to degrees lng

  // Calculate corner offsets from center
  const halfWidth = footprintWidth / 2;
  const halfLength = footprintLength / 2;

  // Calculate corners in local coordinate system, then rotate by heading
  const corners = [
    { x: -halfWidth, y: halfLength },   // top left
    { x: halfWidth, y: halfLength },    // top right
    { x: halfWidth, y: -halfLength },   // bottom right
    { x: -halfWidth, y: -halfLength }   // bottom left
  ];

  // Rotate and translate corners
  const rotatedCorners = corners.map(corner => {
    // Rotate by heading
    const rotX = corner.x * Math.cos(headingRad) - corner.y * Math.sin(headingRad);
    const rotY = corner.x * Math.sin(headingRad) + corner.y * Math.cos(headingRad);

    // Convert to lat/lng
    const lat = centerLat + (rotY / 111320);
    const lng = centerLng + (rotX / (111320 * Math.cos(centerLat * Math.PI / 180)));

    return { lat, lng };
  });

  // Calculate area in square meters
  const area = footprintWidth * footprintLength;

  return {
    topLeft: rotatedCorners[0],
    topRight: rotatedCorners[1],
    bottomRight: rotatedCorners[2],
    bottomLeft: rotatedCorners[3],
    center: { lat: centerLat, lng: centerLng },
    area
  };
}

/**
 * Calculate coverage for survey/mapping mission
 * Returns array of swaths for a given flight path
 */
export function calculateSurveySwaths(
  waypoints: { lat: number; lng: number }[],
  altitude: number,
  cameraTilt: number,
  fovHorizontal: number,
  fovVertical: number,
  overlapPercent: number = 30 // percentage of overlap between swaths
): SwathCorners[] {
  const swaths: SwathCorners[] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const current = waypoints[i];
    const next = waypoints[i + 1];

    // Calculate heading between waypoints
    const dLat = next.lat - current.lat;
    const dLng = next.lng - current.lng;
    const heading = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;

    // Calculate swath at this waypoint
    const swath = calculateSwath({
      altitude,
      cameraTilt,
      fovHorizontal,
      fovVertical,
      heading,
      latitude: current.lat,
      longitude: current.lng
    });

    swaths.push(swath);
  }

  return swaths;
}

/**
 * Calculate optimal waypoint spacing for survey mission
 * to achieve desired overlap percentage
 */
export function calculateWaypointSpacing(
  altitude: number,
  fovVertical: number,
  cameraTilt: number,
  overlapPercent: number
): number {
  // Calculate footprint length
  const tiltRad = Math.abs((cameraTilt * Math.PI) / 180);
  const fovVRad = (fovVertical * Math.PI) / 180;
  const slantRange = altitude / Math.cos(tiltRad);
  const footprintLength = 2 * slantRange * Math.tan(fovVRad / 2);

  // Calculate spacing for desired overlap
  const overlap = (overlapPercent / 100) * footprintLength;
  const spacing = footprintLength - overlap;

  return spacing;
}

/**
 * Format swath data for display
 */
export function formatSwathInfo(swath: SwathCorners): string {
  const areaSqKm = (swath.area / 1_000_000).toFixed(3);
  const areaHectares = (swath.area / 10_000).toFixed(2);

  return `Coverage Area: ${areaSqKm} km² (${areaHectares} hectares)`;
}
