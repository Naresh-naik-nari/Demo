# DSM Quick Start Guide

## What is DSM?
Defense Series Maps (DSM) provides military-grade mapping with:
- ✅ High-resolution satellite imagery
- ✅ Tactical overlays and military grids
- ✅ Secure, classification-aware data
- ✅ Real-time or near-real-time updates

## Setup (5 Minutes)

### 1. Get Your DSM Server URL
Contact your G6/S6 or GIS team for:
- WMS endpoint URL (for DSM base maps)
- Tile server URL (for DSM-Tactical and DSM-Satellite)
- Authentication credentials (if required)

### 2. Configure Map URLs
Edit `src/components/Map.svelte` (around line 40):

```javascript
const mapLayers = {
  'DSM': {
    url: 'https://YOUR_SERVER.mil/geoserver/wms?',  // ← Update this
    type: 'wms',
    layers: 'dsm:tactical_map',                      // ← Update this
    // ... rest stays the same
  },
  'DSM-Tactical': {
    url: 'https://YOUR_SERVER.mil/tiles/tactical/{z}/{x}/{y}.png',  // ← Update this
    // ... rest stays the same
  },
  'DSM-Satellite': {
    url: 'https://YOUR_SERVER.mil/tiles/satellite/{z}/{x}/{y}.png',  // ← Update this
    // ... rest stays the same
  }
};
```

### 3. Test the Connection
1. Save the file
2. Refresh your browser
3. Click the map toggle button (🗺️) until you see "DSM" in the attribution
4. If tiles don't load, check browser console (F12) for errors

## Usage

### Toggle Between Maps
Click the **Map Toggle** button (🗺️) to cycle through:
1. OpenStreetMap → 2. Satellite → 3. **DSM** → 4. **DSM-Tactical** → 5. **DSM-Satellite**

### Best Practices
- **DSM**: Use for general tactical planning with military grid overlays
- **DSM-Tactical**: Use for detailed mission planning with threat zones
- **DSM-Satellite**: Use for reconnaissance and target identification

### Grid References
Hover over the map to see:
- **MGRS Coordinates**: Military Grid Reference System
- **Lat/Lon**: Decimal degrees
- **MAV Position**: Current drone location with heading and altitude

## Common Server URLs

### GeoServer (Most Common)
```
WMS: https://geoserver.yourdomain.mil/geoserver/wms?
Layers: workspace:layer_name
```

### ArcGIS Server
```
WMTS: https://arcgis.yourdomain.mil/arcgis/rest/services/DSM/MapServer
```

### Direct Tile Server
```
XYZ: https://tiles.yourdomain.mil/dsm/{z}/{x}/{y}.png
```

## Troubleshooting

### Problem: "Failed to load DSM tiles"
**Solution**: 
1. Check if you're on the military network (VPN/SIPRNET)
2. Verify the URL is correct (copy/paste from your GIS team)
3. Check browser console for CORS or authentication errors

### Problem: "Blank white tiles"
**Solution**:
1. The layer name might be wrong - check with your GIS team
2. Your credentials might be expired - re-authenticate
3. The server might be down - contact support

### Problem: "Mixed content" error
**Solution**:
- DSM server must use HTTPS (not HTTP)
- Update the URL from `http://` to `https://`

### Problem: Tiles load slowly
**Solution**:
1. Reduce `maxZoom` to limit detail level
2. Enable offline mode and download mission area first
3. Use tactical layer instead of satellite (smaller file sizes)

## Security Reminders

⚠️ **CLASSIFICATION**: DSM data is typically FOUO/SECRET
- Use only on authorized systems
- Follow OPSEC when sharing screens
- Disable screen recording during missions
- Clear browser cache after sensitive operations

## Need Help?

1. **Technical Support**: Contact your G6/S6 signal unit
2. **GIS Support**: Reach out to your GIS/mapping team
3. **Network Issues**: Contact DISA help desk
4. **Authorization**: Speak with your security officer (S2)

## Example Configurations

### For US Military (CONUS)
```javascript
url: 'https://geoservices.nga.mil/geoserver/wms?'
layers: 'nga:tactical_map_conus'
```

### For NATO Operations
```javascript
url: 'https://nato-geoint.int/wms?'
layers: 'nato:combined_map'
```

### For Local/Regional Servers
```javascript
url: 'https://192.168.1.100/tiles/{z}/{x}/{y}.png'  // Internal IP
```

---

**Last Updated**: February 2025
**Compatibility**: SvelteKit-based GCS v1.0+
