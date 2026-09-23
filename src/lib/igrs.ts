/**
 * Indian Grid Reference System (IGRS) Converter
 * Converts WGS84 lat/lon coordinates to Indian Grid Reference System
 * 
 * IGRS is based on Lambert Conformal Conic projection with Everest 1956 datum
 * India is divided into zones (I, IIA, IIB, IIIA, IIIB, IVA, IVB)
 */

export interface IGRSCoordinate {
    zone: string;
    easting: number;
    northing: number;
    gridRef: string;
}

// IGRS Zone definitions (approximate)
const IGRS_ZONES = {
    'I': { latMin: 8, latMax: 13, lonMin: 68, lonMax: 80, centralMeridian: 74 },
    'IIA': { latMin: 13, latMax: 18, lonMin: 68, lonMax: 77, centralMeridian: 72.5 },
    'IIB': { latMin: 13, latMax: 18, lonMin: 77, lonMax: 90, centralMeridian: 83.5 },
    'IIIA': { latMin: 18, latMax: 24, lonMin: 68, lonMax: 77, centralMeridian: 72.5 },
    'IIIB': { latMin: 18, latMax: 24, lonMin: 77, lonMax: 90, centralMeridian: 83.5 },
    'IVA': { latMin: 24, latMax: 32, lonMin: 68, lonMax: 80, centralMeridian: 74 },
    'IVB': { latMin: 24, latMax: 32, lonMin: 80, lonMax: 92, centralMeridian: 86 },
};

/**
 * Determine which IGRS zone a coordinate falls into
 */
function determineZone(lat: number, lon: number): string | null {
    for (const [zone, bounds] of Object.entries(IGRS_ZONES)) {
        if (lat >= bounds.latMin && lat < bounds.latMax && 
            lon >= bounds.lonMin && lon < bounds.lonMax) {
            return zone;
        }
    }
    return null;
}

/**
 * Convert WGS84 to IGRS grid reference
 * 
 * Note: This is a simplified conversion. Production systems should use
 * proper geodetic transformation libraries (proj4js, GDAL, etc.)
 */
export function latLonToIGRS(lat: number, lon: number): IGRSCoordinate | null {
    const zone = determineZone(lat, lon);
    if (!zone) {
        return null;
    }

    const zoneBounds = IGRS_ZONES[zone as keyof typeof IGRS_ZONES];
    
    // Simplified Lambert Conformal Conic projection
    // For accurate results, use a proper projection library
    
    // Central meridian for the zone
    const centralMeridian = zoneBounds.centralMeridian;
    const standardParallel1 = zoneBounds.latMin + 2;
    const standardParallel2 = zoneBounds.latMax - 2;
    
    // Convert to radians
    const phi = lat * Math.PI / 180;
    const lambda = lon * Math.PI / 180;
    const phi1 = standardParallel1 * Math.PI / 180;
    const phi2 = standardParallel2 * Math.PI / 180;
    const lambda0 = centralMeridian * Math.PI / 180;
    
    // Earth radius (Everest 1956 ellipsoid)
    const a = 6377301.243;  // semi-major axis
    const e = 0.0818140773; // eccentricity
    
    // Simplified calculation (this is approximate!)
    const n = Math.sin(phi1);
    const F = Math.cos(phi1) * Math.pow(Math.tan(Math.PI / 4 + phi1 / 2), n) / n;
    const rho = a * F / Math.pow(Math.tan(Math.PI / 4 + phi / 2), n);
    const theta = n * (lambda - lambda0);
    
    const easting = rho * Math.sin(theta) + 500000;  // False easting: 500km
    const northing = rho * Math.cos(theta) + 500000; // False northing: 500km
    
    // Format grid reference (e.g., "IIIA 0123 4567")
    const gridRef = formatGridRef(zone, easting, northing);
    
    return {
        zone,
        easting: Math.round(easting),
        northing: Math.round(northing),
        gridRef
    };
}

/**
 * Format IGRS coordinates as a grid reference string
 * Format: "ZONE 4-digit-easting 4-digit-northing"
 * Example: "IIIA 5123 6789"
 */
function formatGridRef(zone: string, easting: number, northing: number): string {
    // Get 100m precision (truncate to 4 digits)
    const e = Math.floor(easting / 100) % 10000;
    const n = Math.floor(northing / 100) % 10000;
    
    const eStr = e.toString().padStart(4, '0');
    const nStr = n.toString().padStart(4, '0');
    
    return `${zone} ${eStr} ${nStr}`;
}

/**
 * Convert IGRS grid reference back to lat/lon (approximate)
 */
export function igrsToLatLon(zone: string, easting: number, northing: number): { lat: number; lon: number } | null {
    const zoneBounds = IGRS_ZONES[zone as keyof typeof IGRS_ZONES];
    if (!zoneBounds) {
        return null;
    }
    
    // Inverse transformation (simplified)
    const centralMeridian = zoneBounds.centralMeridian;
    const centralParallel = (zoneBounds.latMin + zoneBounds.latMax) / 2;
    
    // Remove false easting/northing
    const x = easting - 500000;
    const y = northing - 500000;
    
    // Approximate inverse (this is very simplified!)
    const lat = centralParallel + (y / 111000);  // ~111km per degree
    const lon = centralMeridian + (x / (111000 * Math.cos(lat * Math.PI / 180)));
    
    return { lat, lon };
}

/**
 * Format coordinates in multiple Indian systems
 */
export function formatIndianCoordinates(lat: number, lon: number): {
    igrs: string | null;
    ddm: string;      // Degrees Decimal Minutes
    dms: string;      // Degrees Minutes Seconds
    decimal: string;  // Decimal Degrees
} {
    // IGRS
    const igrs = latLonToIGRS(lat, lon);
    
    // Decimal Degrees
    const decimal = `${lat.toFixed(6)}°N, ${lon.toFixed(6)}°E`;
    
    // Degrees Decimal Minutes
    const latDeg = Math.floor(Math.abs(lat));
    const latMin = ((Math.abs(lat) - latDeg) * 60).toFixed(4);
    const lonDeg = Math.floor(Math.abs(lon));
    const lonMin = ((Math.abs(lon) - lonDeg) * 60).toFixed(4);
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    const ddm = `${latDeg}°${latMin}'${latDir}, ${lonDeg}°${lonMin}'${lonDir}`;
    
    // Degrees Minutes Seconds
    const latMinInt = Math.floor((Math.abs(lat) - latDeg) * 60);
    const latSec = (((Math.abs(lat) - latDeg) * 60 - latMinInt) * 60).toFixed(2);
    const lonMinInt = Math.floor((Math.abs(lon) - lonDeg) * 60);
    const lonSec = (((Math.abs(lon) - lonDeg) * 60 - lonMinInt) * 60).toFixed(2);
    const dms = `${latDeg}°${latMinInt}'${latSec}"${latDir}, ${lonDeg}°${lonMinInt}'${lonSec}"${lonDir}`;
    
    return {
        igrs: igrs ? igrs.gridRef : null,
        ddm,
        dms,
        decimal
    };
}
