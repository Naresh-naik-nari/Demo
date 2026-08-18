# Offline Maps Guide

## Overview

The Ground Control Station (GCS) includes an **Offline Maps** feature that allows you to pre-download map tiles for use when internet connectivity is unavailable. This is crucial for field operations where reliable internet access cannot be guaranteed.

## Features

- **10 km Radius Coverage**: Download tiles within a configurable radius (1-50 km) around any location
- **Multiple Zoom Levels**: Select which zoom levels to cache (1-18)
- **Dual Map Support**: Works with both OpenStreetMap and Google Satellite imagery
- **Automatic Caching**: All viewed tiles are automatically cached for future offline use
- **Custom Locations**: Download maps for any location, not just current MAV position
- **Progress Tracking**: Real-time progress indicator during download

## How It Works

### Automatic Caching

Every map tile you view in the GCS is automatically cached on the server in the `tile-cache/` directory. This means normal usage of the map gradually builds up an offline cache without any manual intervention.

### Pre-Download for Offline Use

For planned missions or operations in areas with no connectivity, you can pre-download all tiles within a specific radius:

1. **Open the Map** - Navigate to the Dashboard or Mission Planner
2. **Click Download Button** - Click the download icon (📥) on the map controls
3. **Configure Download**:
   - Select location (current MAV position or custom coordinates)
   - Set radius (default: 10 km, max: 50 km)
   - Choose zoom levels (default: 10-18)
   - Verify estimated tile count and size
4. **Start Download** - Click "Download" and wait for completion
5. **Use Offline** - Maps within the downloaded area will work without internet

## Storage Requirements

Approximate storage per zoom level (10 km radius):

| Zoom Level | Tiles | Approx. Size |
|------------|-------|--------------|
| 10         | ~16   | 0.4 MB       |
| 12         | ~64   | 1.6 MB       |
| 14         | ~256  | 6.4 MB       |
| 16         | ~1024 | 25.6 MB      |
| 18         | ~4096 | 102.4 MB     |

**Full download (zoom 10-18, 10 km radius)**: ~140 MB

## Technical Details

### Cache Directory Structure

```
tile-cache/
├── [z]/           # OpenStreetMap tiles
│   └── [x]/
│       └── [y].png
└── google/        # Google Satellite tiles
    └── [z]/
        └── [x]/
            └── [y].jpg
```

### Tile Sources

**OpenStreetMap** tiles are fetched from (in priority order):
1. Wikimedia Maps
2. CARTO Positron
3. Stadia Maps OSM

**Google Satellite** tiles are fetched from Google Maps tile servers.

### Fallback Behavior

When offline and a tile is not cached:
- A transparent placeholder tile is served
- No error is shown to the user
- Adjacent cached tiles remain visible

## Best Practices

### For Mission Planning

1. **Download before departure** - Pre-download the mission area with at least 2 km buffer
2. **Include alternate landing sites** - Download tiles for emergency landing areas
3. **Use appropriate zoom levels**:
   - Zoom 12-14: Wide area overview
   - Zoom 16-18: Detailed terrain features

### For Field Operations

1. **Test offline mode** - Disconnect internet and verify tiles load correctly
2. **Monitor storage** - Check available disk space before large downloads
3. **Update periodically** - Re-download tiles every few months for map updates

### Performance Tips

- **Lower zoom levels first** - Download zoom 10-14 initially for faster coverage
- **Avoid excessive radius** - A 50 km radius at zoom 18 requires ~400,000 tiles (~10 GB)
- **Batch downloads** - For large areas, download in multiple sessions

## Limitations

- **No real-time updates**: Cached tiles do not reflect real-time changes
- **Storage dependent**: Large areas require significant disk space
- **Server load**: Downloading hundreds of thousands of tiles can take hours
- **Map updates**: Cached tiles are not automatically updated when source maps change

## Troubleshooting

### Download is slow
- Reduce the radius or maximum zoom level
- Check network connectivity
- Try downloading during off-peak hours

### Tiles not showing offline
- Verify tiles were actually downloaded (check tile-cache directory)
- Ensure correct map type is selected (OpenStreetMap vs Satellite)
- Check browser console for errors

### Out of disk space
- Clear old cached tiles: `rm -rf tile-cache/`
- Reduce download radius or zoom levels
- Monitor available storage before downloading

## API Endpoints

The offline maps feature uses these endpoints:

- `GET /api/tiles/{z}/{x}/{y}.png` - OpenStreetMap tiles
- `GET /api/tiles/google/{z}/{x}/{y}.png` - Google Satellite tiles

Both endpoints:
- Serve cached tiles instantly if available
- Fetch and cache tiles on first request
- Return transparent placeholder if all sources fail

## Command-Line Cache Management

### Check cache size
```bash
du -sh tile-cache/
```

### Clear entire cache
```bash
rm -rf tile-cache/
```

### Clear specific map type
```bash
rm -rf tile-cache/google/  # Clear satellite tiles only
```

### Clear specific zoom level
```bash
rm -rf tile-cache/18/      # Clear zoom 18 only
```

## Security Considerations

- Tile downloads respect source server rate limits
- User-Agent headers identify requests as coming from the GCS
- No authentication tokens or API keys are cached
- All tiles are stored server-side (not in browser)

## Future Enhancements

Potential improvements for future versions:

- [ ] Scheduled downloads (download overnight before mission)
- [ ] Differential updates (only download new/changed tiles)
- [ ] Compression (reduce storage requirements)
- [ ] Cache expiration (auto-delete old tiles)
- [ ] Multi-area downloads (save multiple mission areas)
- [ ] Export/import cache (share tiles between GCS instances)

---

**Version**: 1.0  
**Last Updated**: 2026  
**Maintainer**: Sidak GCS Development Team
