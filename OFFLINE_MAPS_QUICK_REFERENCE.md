m  # Offline Maps - Quick Reference Card

> **Purpose**: Pre-download map tiles for operation without internet

---

## 🚀 Quick Start (30 seconds)

1. **Click** 📥 Download button (top-right of map)
2. **Keep** defaults (10 km, zoom 10-18, current location)
3. **Click** "Download" button
4. **Wait** ~10 minutes
5. **Done!** Circle shows offline coverage

---

## 📍 Button Locations

```
Dashboard → Map Section → Top-Right → 📥 Icon
Mission Planner → Map Panel → Top-Right → 📥 Icon
```

---

## ⚙️ Default Settings (Recommended)

| Setting | Default | Purpose |
|---------|---------|---------|
| **Location** | Current MAV | Where you are now |
| **Radius** | 10 km | ~314 km² coverage |
| **Min Zoom** | 10 | Wide area view |
| **Max Zoom** | 18 | Building-level detail |
| **Estimated Size** | ~600 MB | For both defaults |
| **Estimated Time** | 10-15 min | On typical connection |

---

## 🎯 Common Scenarios

### Before Mission (Recommended)
```
When: 24 hours before
Radius: 15 km (includes alternates)
Zoom: 10-18 (full detail)
Map: Both OSM + Satellite
```

### Emergency Quick
```
When: Need it NOW
Radius: 5 km (minimal)
Zoom: 14-16 (just enough detail)
Map: Satellite only
```

### Extended Operation
```
When: Week-long deployment
Radius: 20-30 km (wide coverage)
Zoom: 10-18 (complete)
Map: Both (redundancy)
```

---

## 📊 Storage Guide

| Radius | Zoom Levels | Storage | Download Time |
|--------|-------------|---------|---------------|
| 5 km | 14-16 | ~40 MB | 2 min |
| 10 km | 10-18 | ~600 MB | 12 min ⭐ |
| 20 km | 10-18 | ~2.4 GB | 45 min |
| 50 km | 10-18 | ~15 GB | 4 hours |

⭐ = Recommended default

---

## ⌨️ Step-by-Step

### Step 1: Open Downloader
- Look for **📥 icon** on map (top-right)
- Click it

### Step 2: Configure
- ☑ Use Current MAV Location (checked by default)
- Radius slider: **10 km** (default is fine)
- Min Zoom: **10** (default is fine)
- Max Zoom: **18** (default is fine)

### Step 3: Review
- Check **Total Tiles** count
- Check **Estimated Size** 
- Verify **Map Type** (OSM or Satellite)
- Review **Cache Status** (what's already downloaded)

### Step 4: Download
- Click **"Download X,XXX Tiles"** button
- Watch progress bar
- Wait for completion (~10 min)

### Step 5: Verify
- Look for **✅ Complete!** message
- See **blue circle** on map showing coverage
- Close modal

### Step 6: Test Offline
- **Disable WiFi/Ethernet**
- Pan around map in blue circle
- Tiles should load instantly
- Outside circle: transparent tiles (expected)

---

## 🔍 What You'll See

### During Download
```
Downloading tiles...

▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░  49.0%

Downloaded 12,450 of 25,436 tiles

         [Cancel]
```

### After Completion
```
✅ Complete!

Downloaded 25,436 tiles for offline use.

Map shows blue circle = offline area

         [Close]
```

### On Map
```
┌─────────────────────────────┐
│                             │
│       ╭─────────╮           │
│     ╭─────────────╮         │
│    │    ○ MAV      │        │
│     ╰─────────────╯         │ ← Blue circle
│       ╰─────────╯           │   (offline area)
│                             │
└─────────────────────────────┘
```

---

## 🛠️ Controls

| Button | Location | Function |
|--------|----------|----------|
| **📥** | Top-right map | Open downloader |
| **👁** | Top-right map | Hide blue circle |
| **Cancel** | Modal | Stop download |
| **Close** | Modal | Exit dialog |
| **Download** | Modal | Start download |

---

## ⚠️ Important Notes

### ✅ DO
- Download **before** going to field
- Include **buffer area** (2-5 km extra)
- Test **offline mode** before mission
- Check **storage space** available
- Download for **both map types** (OSM + Satellite)

### ❌ DON'T  
- Download during mission (waste time)
- Set radius too large unnecessarily (waste space)
- Forget to verify completion
- Assume auto-update (re-download periodically)
- Ignore storage warnings

---

## 🔧 Troubleshooting

### Problem: Download is slow
**Solution**: Lower max zoom or reduce radius

### Problem: Out of disk space
**Solution**: Clear old cache or reduce parameters

### Problem: Tiles not showing offline
**Check**: 
1. Is download complete? (look for ✅)
2. Correct map type selected?
3. Within blue circle area?

### Problem: Progress bar stuck
**Solution**: Cancel and restart download

---

## 💡 Pro Tips

1. **Auto-caching**: Every tile you view gets cached automatically
2. **Both maps**: Download OSM + Satellite for redundancy
3. **Buffer zone**: Add 5 km to your mission radius
4. **Test first**: Always test offline before field deployment
5. **Redownload**: Update cache every 3-6 months for map updates
6. **Night downloads**: Do large downloads overnight
7. **Circle indicator**: Blue circle = guaranteed offline coverage
8. **Hide circle**: Click 👁 button if circle in the way

---

## 📱 Mobile Quick Reference

**Touch**: Tap 📥 icon  
**Zoom slider**: Drag with finger  
**Radius slider**: Drag with finger  
**Inputs**: Use number keyboard  
**Progress**: Full-width bar  
**All features**: Same as desktop  

---

## 🌍 Coverage Examples

### 5 km Radius
- Small town
- Single neighborhood
- Emergency landing area
- Quick mission

### 10 km Radius ⭐ (Default)
- Medium city
- Multiple districts
- Standard mission
- **Recommended**

### 20 km Radius
- Large city
- Multiple towns
- Extended mission
- Search area

### 50 km Radius
- Metropolitan area
- Regional coverage
- Multi-day expedition
- Complete survey

---

## 📞 Need Help?

**User Guide**: `docs/OFFLINE_MAPS_GUIDE.md`  
**Visual Guide**: `docs/OFFLINE_MAPS_VISUAL_GUIDE.md`  
**Tech Details**: `OFFLINE_MAPS_FEATURE.md`  

**Support**: Open GitHub issue or contact dev team

---

## ✅ Checklist Before Field Deployment

```
Pre-Deployment Checklist:
━━━━━━━━━━━━━━━━━━━━━━
☐ Mission coordinates identified
☐ Offline maps downloaded (10+ km radius)
☐ Blue circle visible on map
☐ Both OSM + Satellite downloaded
☐ Tested offline mode (WiFi disabled)
☐ Verified tiles load within circle
☐ Storage has space for data logs
☐ Cache info shows correct tile count
☐ Alternative landing sites included
☐ Backup device has same cache (optional)
```

---

## 🎯 Remember

**Key Concept**: Download a circle around your mission area before going offline. The blue circle shows where maps work without internet.

**Default is Perfect**: 10 km radius with zoom 10-18 covers 99% of missions.

**Test Offline**: Always disable internet and verify maps load before field deployment.

---

**Last Updated**: August 18, 2026  
**Version**: 1.0  
**Print this page** for quick reference in the field! 📄
