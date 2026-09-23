<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { mapStore } from '../stores/mapStore';
  import { mavLocationStore, mavHeadingStore, mavAltitudeStore, mavGimbalTiltStore } from '../stores/mavlinkStore';
  import { calculateSwath, formatSwathInfo, type SwathCorners } from '../lib/swath';
  import { get } from 'svelte/store';

  export let enabled: boolean = false;
  export let fovHorizontal: number = 73; // degrees (typical action camera)
  export let fovVertical: number = 54;   // degrees
  export let showInfo: boolean = true;

  let L: typeof import('leaflet');
  let swathPolygon: any = null;
  let swathInfo: SwathCorners | null = null;
  let updateInterval: number | null = null;

  // Reactive subscriptions
  $: leafletMap = $mapStore;
  $: mavLocation = $mavLocationStore;
  $: mavHeading = $mavHeadingStore;
  $: mavAltitude = $mavAltitudeStore;
  $: cameraTilt = $mavGimbalTiltStore;

  // Update swath whenever any parameter changes
  $: if (enabled && leafletMap && mavLocation) {
    updateSwath();
  }

  onMount(async () => {
    // Dynamically import Leaflet
    L = await import('leaflet');
    
    // Update swath every 500ms when enabled
    updateInterval = window.setInterval(() => {
      if (enabled) {
        updateSwath();
      }
    }, 500);
  });

  onDestroy(() => {
    removeSwath();
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  });

  function updateSwath() {
    if (!leafletMap || !L) return;

    const lat = typeof mavLocation.lat === 'function' ? mavLocation.lat() : mavLocation.lat;
    const lng = typeof mavLocation.lng === 'function' ? mavLocation.lng() : mavLocation.lng;

    // Don't show swath if altitude is too low (< 5m) or too high (> 500m)
    if (mavAltitude < 5 || mavAltitude > 500) {
      removeSwath();
      return;
    }

    try {
      // Calculate current camera footprint
      swathInfo = calculateSwath({
        altitude: mavAltitude,
        cameraTilt: cameraTilt,
        fovHorizontal: fovHorizontal,
        fovVertical: fovVertical,
        heading: mavHeading,
        latitude: lat,
        longitude: lng
      });

      // Create polygon bounds
      const bounds: [number, number][] = [
        [swathInfo.topLeft.lat, swathInfo.topLeft.lng],
        [swathInfo.topRight.lat, swathInfo.topRight.lng],
        [swathInfo.bottomRight.lat, swathInfo.bottomRight.lng],
        [swathInfo.bottomLeft.lat, swathInfo.bottomLeft.lng]
      ];

      // Remove old polygon
      if (swathPolygon) {
        leafletMap.removeLayer(swathPolygon);
      }

      // Create new polygon
      swathPolygon = L.polygon(bounds, {
        color: '#FFD700',        // Gold border
        fillColor: '#FFD700',    // Gold fill
        fillOpacity: 0.15,       // Semi-transparent
        weight: 2,
        dashArray: '5, 5',       // Dashed line
        className: 'swath-polygon'
      }).addTo(leafletMap);

      // Add center point marker
      const centerMarker = L.circleMarker([swathInfo.center.lat, swathInfo.center.lng], {
        radius: 4,
        color: '#FFD700',
        fillColor: '#FFD700',
        fillOpacity: 0.8,
        weight: 1
      }).addTo(leafletMap);

      // Bind popup with info
      if (showInfo) {
        const popupContent = `
          <div style="font-family: sans-serif; font-size: 12px;">
            <strong>Camera Footprint</strong><br/>
            ${formatSwathInfo(swathInfo)}<br/>
            <small>
              Altitude: ${mavAltitude.toFixed(1)}m<br/>
              Tilt: ${cameraTilt.toFixed(1)}°<br/>
              Heading: ${mavHeading.toFixed(1)}°
            </small>
          </div>
        `;
        swathPolygon.bindPopup(popupContent);
      }

    } catch (error) {
      console.error('Error calculating swath:', error);
      removeSwath();
    }
  }

  function removeSwath() {
    if (swathPolygon && leafletMap) {
      leafletMap.removeLayer(swathPolygon);
      swathPolygon = null;
    }
    swathInfo = null;
  }

  // Watch enabled state
  $: if (!enabled) {
    removeSwath();
  } else if (enabled && leafletMap) {
    updateSwath();
  }
</script>

{#if enabled && swathInfo && showInfo}
  <div class="swath-info-overlay">
    <div class="swath-info-content">
      <div class="swath-title">
        <i class="fas fa-camera"></i>
        Camera Coverage
      </div>
      <div class="swath-stat">
        <span class="label">Area:</span>
        <span class="value">{(swathInfo.area / 10000).toFixed(2)} ha</span>
      </div>
      <div class="swath-stat">
        <span class="label">Width:</span>
        <span class="value">{Math.sqrt(swathInfo.area).toFixed(1)} m</span>
      </div>
      <div class="swath-stat">
        <span class="label">Alt:</span>
        <span class="value">{mavAltitude.toFixed(1)} m</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .swath-info-overlay {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 1000;
    pointer-events: none;
  }

  .swath-info-content {
    background: rgba(0, 0, 0, 0.75);
    color: #FFD700;
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 2px solid #FFD700;
    font-family: monospace;
    font-size: 0.85rem;
    min-width: 160px;
    backdrop-filter: blur(5px);
  }

  .swath-title {
    font-weight: 600;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .swath-stat {
    display: flex;
    justify-content: space-between;
    margin: 0.25rem 0;
    font-size: 0.8rem;
  }

  .swath-stat .label {
    opacity: 0.8;
  }

  .swath-stat .value {
    font-weight: 600;
    color: #FFF;
  }

  :global(.swath-polygon) {
    transition: opacity 0.3s ease;
  }

  :global(.swath-polygon:hover) {
    fill-opacity: 0.3 !important;
  }
</style>
