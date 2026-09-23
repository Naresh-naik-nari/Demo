# Defense Series Maps (DSM) Configuration Guide

## Overview
Your GCS now supports Defense Series Maps (DSM) for military-grade tactical planning and operations. DSM provides high-resolution satellite imagery and tactical overlays.

## Map Layers Available

### 1. OpenStreetMap (Default)
- Standard civilian mapping
- Offline tile support
- Good for general navigation

### 2. Google Satellite
- High-resolution satellite imagery
- Global coverage
- Real-time updates

### 3. DSM (Defense Series Maps)
- **Type**: WMS (Web Map Service)
- **Use Case**: Tactical base maps with military grid reference system
- **Resolution**: Variable, typically 1:50,000 to 1:250,000 scale
- **Features**: Military installations, restricted areas, elevation contours

### 4. DSM-Tactical
- **Type**: XYZ Tile Service
- **Use Case**: Mission planning with tactical overlays
- **Resolution**: Up to 1:24,000 scale
- **Features**: Detailed terrain analysis, line-of-sight, threat zones

### 5. DSM-Satellite
- **Type**: XYZ Tile Service  
- **Use Case**: High-resolution reconnaissance imagery
- **Resolution**: Sub-meter accuracy
- **Features**: Real-time or near-real-time satellite feeds

## Configuration

### Step 1: Update DSM Server URLs

Edit `src/components/Map.svelte` and find the `mapLayers` object (around line 40):

```javascript
const mapLayers = {
  'DSM': {
    url: 'https://your-dsm-server.mil/geoserver/wms?',  // ← Replace with your WMS endpoint
    type: 'wms',
    layers: 'dsm:tactical_map',                          // ← Replace with your layer name
    format: 'image/png',
    transparent: true,
    attribution: 'Defense Series Maps',
    maxZoom: 18
  },
  'DSM-Tactical': {
    url: 'https://your-dsm-server.mil/tiles/tactical/{z}/{x}/{y}.png',  // ← Replace
    attribution: 'DSM Tactical',
    maxZoom: 18
  },
  'DSM-Satellite': {
    url: 'https://your-dsm-server.mil/tiles/satellite/{z}/{x}/{y}.png', // ← Replace
    attribution: 'DSM Satellite',
    maxZoom: 19
  }
};
```

### Step 2: Authentication (if required)

If your DSM server requires authentication, you'll need to add credentials:

#### Option A: URL Parameters (Less Secure)
```javascript
url: 'https://your-dsm-server.mil/tiles/{z}/{x}/{y}.png?token=YOUR_API_KEY'
```

#### Option B: HTTP Headers (More Secure)
Add headers to the tile layer configuration:

```javascript
'DSM': {
  url: 'https://your-dsm-server.mil/geoserver/wms?',
  type: 'wms',
  layers: 'dsm:tactical_map',
  format: 'image/png',
  transparent: true,
  attribution: 'Defense Series Maps',
  maxZoom: 18,
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'X-API-Key': 'YOUR_API_KEY'
  }
}
```

Then modify the `loadMapLayer` function to include headers.

### Step 3: Offline DSM Support

If you need offline DSM tiles:

1. Download tiles using the built-in offline downloader
2. Store them in `static/map/dsm/{z}/{x}/{y}.png`
3. Update the URL to point to local storage:

```javascript
'DSM-Tactical': {
  url: '/map/dsm/{z}/{x}/{y}.png',
  attribution: 'DSM Tactical (Offline)',
  maxZoom: 18
}
```

## Usage

### Switching Map Layers
- **In UI**: Click the map toggle button (🗺️) to cycle through layers
- **Order**: OpenStreetMap → Satellite → DSM → DSM-Tactical → DSM-Satellite → OpenStreetMap

### Keyboard Shortcuts
- Press `M` to toggle map layers (if implemented)
- Use mouse wheel to zoom in/out
- Click and drag to pan

### Grid Reference Display
The GCS displays coordinates in Military Grid Reference System (MGRS) format when using DSM layers.

## Security Considerations

⚠️ **IMPORTANT**: DSM data is classified and export-controlled

1. **Access Control**: Only authorized personnel with proper security clearance
2. **Network Security**: Use VPN or secure military network (SIPRNET/JWICS)
3. **Data Handling**: Follow OPSEC procedures for mission planning
4. **Offline Maps**: Encrypt downloaded tiles if storing on portable devices
5. **Logging**: Disable coordinate logging when operating in sensitive areas

## Common DSM Server Endpoints

### GeoServer (WMS)
```javascript
url: 'https://geoserver.yourdomain.mil/geoserver/wms?'
layers: 'workspace:layer_name'
```

### ArcGIS Server (WMTS)
```javascript
url: 'https://arcgis.yourdomain.mil/arcgis/rest/services/DSM/MapServer/WMTS'
layer: 'DSM:TacticalMap'
```

### MapProxy
```javascript
url: 'https://mapproxy.yourdomain.mil/wmts/dsm/{TileMatrixSet}/{TileMatrix}/{TileCol}/{TileRow}.png'
```

## Troubleshooting

### Maps Not Loading
1. Check browser console (F12) for CORS errors
2. Verify DSM server URL is correct
3. Confirm network connectivity to military network
4. Check authentication credentials

### Slow Performance
1. Reduce `maxZoom` value to decrease tile requests
2. Enable tile caching on server side
3. Use offline tiles for mission areas

### Mixed Content Errors
- DSM server must use HTTPS if your GCS uses HTTPS
- Update URLs from `http://` to `https://`

## Support

For DSM server configuration assistance:
- Contact your G6/S6 (Signal/IT) personnel
- Refer to your organization's GIS/mapping team
- Check military network documentation (DISA, NGA)

## Compliance

This feature complies with:
- NATO STANAG 2211 (Geodesy and Geomatics)
- DoD 8570.01-M (IA Workforce)
- NIST SP 800-53 (Security Controls)
- ITAR/EAR export control regulations
