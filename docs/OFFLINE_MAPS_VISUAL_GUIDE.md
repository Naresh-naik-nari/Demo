# Offline Maps - Visual Guide

## Quick Access

The offline maps downloader is accessible from any map view in the GCS.

```
┌─────────────────────────────────────────────────────┐
│  Map View (Dashboard or Mission Planner)            │
│                                                      │
│  ┌────────────────────────────────────┐  ┌──────┐  │
│  │                                    │  │ [📥] │  │ ← Download Button
│  │                                    │  │ [🔒] │  │
│  │         Map Display Area           │  │ [⛶]  │  │
│  │                                    │  └──────┘  │
│  │        (OpenStreetMap or           │            │
│  │         Google Satellite)          │            │
│  │                                    │            │
│  └────────────────────────────────────┘            │
└─────────────────────────────────────────────────────┘
```

## Workflow Diagram

```
┌──────────────┐
│ Click 📥     │
│ Download     │
│ Button       │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Configure Download Parameters:           │
│                                           │
│ 1. Location Selection                    │
│    ● Current MAV Position                │
│    ○ Custom Coordinates                  │
│                                           │
│ 2. Radius: [━━━━━━━╸━━━] 10 km         │
│                                           │
│ 3. Zoom Levels:                          │
│    Min: 10 [━━━━━━╸━━━━━━━]            │
│    Max: 18 [━━━━━━━━━━━━━╸]            │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Review Statistics:                        │
│                                           │
│  Total Tiles: 25,436                     │
│  Estimated Size: 623.4 MB                │
│  Map Type: OpenStreetMap                 │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Start Download                            │
│                                           │
│ Progress: ▓▓▓▓▓▓▓▓░░░░░░░░  49.0%       │
│ Downloaded 12,450 of 25,436 tiles        │
│                                           │
│     [Cancel Download]                     │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ ✅ Complete!                              │
│                                           │
│ Downloaded 25,436 tiles                  │
│ Maps are now available offline           │
│                                           │
│     [Close]                               │
└──────────────────────────────────────────┘
```

## Coverage Area Visualization

### 10 km Radius (Default)

```
        North
          ↑
          │
    ┌─────┼─────┐
    │     │     │
    │     │     │
West│─────●─────│East  ● = MAV Position
    │  10 km   │       □ = Downloaded Area
    │     │     │
    └─────┼─────┘
          │
          ↓
        South
```

**Coverage Details:**
- Area: ~314 km²
- Typical tiles (zoom 10-18): ~25,000 tiles
- Storage: ~600 MB
- Download time: 5-15 minutes (depending on network)

### 5 km Radius (Minimal)

```
    ┌───┼───┐
    │   │   │
West│───●───│East
    │ 5 km │
    └───┼───┘
```

**Coverage Details:**
- Area: ~78.5 km²
- Typical tiles (zoom 10-18): ~6,000 tiles
- Storage: ~150 MB
- Download time: 2-5 minutes

### 20 km Radius (Extended)

```
        ┌─────────┼─────────┐
        │         │         │
        │         │         │
        │         │         │
West────┼─────────●─────────┼────East
        │      20 km        │
        │         │         │
        │         │         │
        └─────────┼─────────┘
```

**Coverage Details:**
- Area: ~1,256 km²
- Typical tiles (zoom 10-18): ~100,000 tiles
- Storage: ~2.4 GB
- Download time: 20-60 minutes

## Zoom Level Comparison

### Zoom 10 (Wide Area View)

```
┌─────────────────────────────────────────┐
│                                          │
│    ╔════════════════════════╗           │
│    ║  City                  ║           │
│    ║                        ║           │
│    ║   ■ Airport            ║           │
│    ║                        ║           │
│    ║        ○ MAV           ║           │
│    ║                        ║           │
│    ╚════════════════════════╝           │
│                                          │
└─────────────────────────────────────────┘
```
**Scale**: ~150 km per tile
**Use**: Regional overview, long-range navigation

### Zoom 14 (City View)

```
┌─────────────────────────────────────────┐
│    ╔══════════════╗                     │
│    ║ District     ║                     │
│    ║              ║                     │
│    ║  ┌Streets┐   ║                     │
│    ║  │  ○ MAV│   ║                     │
│    ║  └───────┘   ║                     │
│    ║              ║                     │
│    ╚══════════════╝                     │
└─────────────────────────────────────────┘
```
**Scale**: ~10 km per tile
**Use**: Urban navigation, mission planning

### Zoom 18 (Detail View)

```
┌─────────────────────────────────────────┐
│ ╔════════════════════════════════════╗  │
│ ║ Building   │  Road  │   Trees     ║  │
│ ║ ┌────────┐ │        │   ○ MAV    ║  │
│ ║ │        │ │        │   🌳🌳     ║  │
│ ║ └────────┘ │        │            ║  │
│ ╚════════════════════════════════════╝  │
└─────────────────────────────────────────┘
```
**Scale**: ~600 m per tile
**Use**: Detailed obstacle avoidance, precision landing

## Map Type Comparison

### OpenStreetMap View
```
┌─────────────────────────────────────────┐
│ Features:                                │
│ • Road networks (detailed)               │
│ • Building outlines                      │
│ • Points of interest                     │
│ • Terrain contours (limited)             │
│ • Water bodies                           │
│                                          │
│ Best for:                                │
│ ✓ Urban navigation                       │
│ ✓ Road-based missions                    │
│ ✓ Understanding infrastructure           │
└─────────────────────────────────────────┘
```

### Google Satellite View
```
┌─────────────────────────────────────────┐
│ Features:                                │
│ • True aerial imagery                    │
│ • Terrain features (visual)              │
│ • Vegetation patterns                    │
│ • Ground conditions                      │
│ • Obstacle identification                │
│                                          │
│ Best for:                                │
│ ✓ Off-road navigation                    │
│ ✓ Agricultural surveys                   │
│ ✓ Search and rescue                      │
│ ✓ Terrain analysis                       │
└─────────────────────────────────────────┘
```

## Step-by-Step Visual Tutorial

### Step 1: Open Map View
```
Dashboard → [Map Section]
    or
Mission Planner → [Map Panel]
```

### Step 2: Locate Download Button
```
Top-right corner of map:
┌──────┐
│ [⛶]  │ ← Fullscreen
│ [🔒] │ ← Lock view to MAV
│ [📥] │ ← DOWNLOAD (Click here!)
└──────┘
```

### Step 3: Choose Location
```
Option A: Current MAV Position
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
☑ Use Current MAV Location
📍 33.425520°, -111.940060°


Option B: Custom Coordinates
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
☐ Use Current MAV Location

Latitude:  [ 40.758896  ]
Longitude: [-73.985130  ]
```

### Step 4: Set Radius
```
Radius (km): 10 km

1 km  ▯━━━━━━━━▓━━━━━━━━━━━━━▯ 50 km
       ↑
   Drag slider to adjust
```

### Step 5: Configure Zoom
```
Min Zoom: 10
▯━━━━━━━━━━▓━━━━━━━▯ (1-18)

Max Zoom: 18
▯━━━━━━━━━━━━━━━━━▓▯ (1-18)

Tip: Lower min zoom for faster download
     Higher max zoom for more detail
```

### Step 6: Review & Download
```
┌─────────────┬─────────────┐
│ 📊 Total    │ 💾 Est. Size│
│   25,436    │   623.4 MB  │
└─────────────┴─────────────┘

           [Download 25,436 Tiles]
```

### Step 7: Monitor Progress
```
Downloading tiles...

▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░  49.0%

Downloaded 12,450 of 25,436 tiles

Time remaining: ~8 minutes

                [Cancel]
```

### Step 8: Completion
```
✅ Complete!

Downloaded 25,436 tiles for offline use.

Your maps are now available offline
within a 10 km radius.

                 [Close]
```

## Usage Scenarios

### Scenario 1: Pre-Mission Download
```
Timeline: Day Before Mission
━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Review mission plan coordinates
2. Open offline map downloader
3. Enter mission area coordinates
4. Set 15 km radius (includes alternates)
5. Download zoom 12-18
6. Verify download complete
7. Test offline mode

Result: ✅ Confident offline operation
```

### Scenario 2: Emergency Area Mapping
```
Timeline: Immediate Need
━━━━━━━━━━━━━━━━━━━━━━━

1. Get disaster area coordinates
2. Download 20 km radius
3. Use zoom 14-18 for detail
4. Priority: Satellite imagery
5. Deploy to field immediately

Result: ✅ Maps available on arrival
```

### Scenario 3: Extended Expedition
```
Timeline: Week Before Deployment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Map entire research area (50 km)
2. Download both OSM + Satellite
3. Include all zoom levels
4. Verify cache integrity
5. Export cache to backup drive

Result: ✅ Complete offline capability
```

## Storage Planning Guide

### Minimal Setup (Emergency Only)
```
Configuration:
- Radius: 5 km
- Zoom: 14-16
- Type: Satellite only

Storage: ~50 MB
Download: ~2 min
Coverage: Basic navigation
```

### Standard Setup (Recommended)
```
Configuration:
- Radius: 10 km
- Zoom: 10-18
- Type: Both OSM + Satellite

Storage: ~1.2 GB
Download: ~15 min
Coverage: Full operational capability
```

### Extended Setup (Long-term Operations)
```
Configuration:
- Radius: 20 km
- Zoom: 10-18
- Type: Both OSM + Satellite

Storage: ~4.8 GB
Download: ~45 min
Coverage: Extended area with backups
```

### Maximum Setup (Expedition)
```
Configuration:
- Radius: 50 km
- Zoom: 10-18
- Type: Both OSM + Satellite

Storage: ~30 GB
Download: ~4 hours
Coverage: Entire regional area
```

## Troubleshooting Visual Guide

### Issue: Download Stuck

```
Symptom:
━━━━━━━━━━
Progress bar not moving
Same tile count for >1 minute

Solution:
━━━━━━━━━━
1. Cancel download
2. Check internet connection
3. Reduce zoom levels
4. Restart download
```

### Issue: Out of Space

```
Symptom:
━━━━━━━━━━
Error: Insufficient disk space

Solution:
━━━━━━━━━━
1. Check available storage:
   Windows: C:\...\tile-cache\
   
2. Clear old tiles:
   Settings → Clear Cache
   
3. Reduce download parameters:
   - Lower radius
   - Fewer zoom levels
```

### Issue: Tiles Not Showing Offline

```
Symptom:
━━━━━━━━━━
Blank map when offline

Solution:
━━━━━━━━━━
1. Verify download completed (✅)
2. Check correct map type selected
3. Ensure within downloaded radius
4. Restart GCS application
```

## Performance Tips

### Fast Download Strategy
```
Priority 1: Essential Zoom Levels
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Download 14-16 first (minimal size)
Provides basic navigation quickly

Priority 2: Add Detail
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Download 17-18 later
Adds fine detail when time permits

Priority 3: Context
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Download 10-13 last
Wide-area overview (optional)
```

### Storage Optimization
```
Strategy A: Single Map Type
━━━━━━━━━━━━━━━━━━━━━━━
Choose OSM OR Satellite only
Saves 50% storage

Strategy B: Selective Zoom
━━━━━━━━━━━━━━━━━━━━━━━
Skip zoom 10-12 (low detail)
Skip zoom 18 (huge size)
Use zoom 13-17 only

Strategy C: Precise Radius
━━━━━━━━━━━━━━━━━━━━━━━
Calculate exact mission area
Don't over-download
```

## Advanced Features

### Multi-Area Download
```
Coming Soon:
━━━━━━━━━━━━
1. Mission Area Alpha (10 km)
2. Mission Area Bravo (15 km)  
3. Emergency Landing Sites (5 km each)

Total coverage: Multiple discrete areas
```

### Scheduled Downloads
```
Coming Soon:
━━━━━━━━━━━━
Schedule: Tonight 2:00 AM
Radius: 20 km
Zoom: 10-18
Auto-start: ✓

Benefit: Download during off-peak hours
```

### Smart Caching
```
Coming Soon:
━━━━━━━━━━━━
Auto-delete tiles older than 90 days
Keep most-used tiles
Compress tiles for 50% storage savings
```

---

**Last Updated**: 2026-08-18  
**Version**: 1.0  
**For**: Sidak Ground Control Station
