<script lang="ts">
  import { onMount } from 'svelte';
  import { mavLocationStore } from '../stores/mavlinkStore';
  import { mapTypeStore } from '../stores/mapStore';
  import { darkModeStore, primaryColorStore, secondaryColorStore, tertiaryColorStore } from '../stores/customizationStore';

  export let isOpen = false;
  export let onDownloadComplete: ((center: { lat: number; lng: number }, radius: number) => void) | null = null;

  $: darkMode = $darkModeStore;
  $: primaryColor = $primaryColorStore;
  $: secondaryColor = $secondaryColorStore;
  $: tertiaryColor = $tertiaryColorStore;
  $: fontColor = darkMode ? '#ffffff' : '#000000';
  $: mavLocation = $mavLocationStore;
  $: mapType = $mapTypeStore;

  let radiusKm = 10;
  let minZoom = 10;
  let maxZoom = 18;
  let downloadProgress = 0;
  let totalTiles = 0;
  let downloadedTiles = 0;
  let isDownloading = false;
  let downloadStatus = '';
  let useCurrentLocation = true;
  let customLat: number = 0;
  let customLng: number = 0;
  let cacheInfo: any = null;
  let loadingCacheInfo = false;

  // Calculate tile bounds for a given radius
  function getTileBounds(lat: number, lng: number, radiusKm: number, zoom: number) {
    const earthRadius = 6378.137; // km
    const latRadian = (lat * Math.PI) / 180;
    
    // Calculate degrees per km
    const degPerKmLat = 1 / 111.32;
    const degPerKmLng = 1 / (111.32 * Math.cos(latRadian));
    
    // Calculate bounds
    const latDelta = radiusKm * degPerKmLat;
    const lngDelta = radiusKm * degPerKmLng;
    
    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLng = lng - lngDelta;
    const maxLng = lng + lngDelta;
    
    // Convert to tile coordinates
    const n = Math.pow(2, zoom);
    
    function latToTile(lat: number) {
      return Math.floor((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2 * n);
    }
    
    function lngToTile(lng: number) {
      return Math.floor(((lng + 180) / 360) * n);
    }
    
    return {
      minX: lngToTile(minLng),
      maxX: lngToTile(maxLng),
      minY: latToTile(maxLat),
      maxY: latToTile(minLat),
    };
  }

  function calculateTotalTiles() {
    const lat = useCurrentLocation ? mavLocation.lat : customLat;
    const lng = useCurrentLocation ? mavLocation.lng : customLng;
    
    let total = 0;
    for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
      const bounds = getTileBounds(lat, lng, radiusKm, zoom);
      const tilesX = bounds.maxX - bounds.minX + 1;
      const tilesY = bounds.maxY - bounds.minY + 1;
      total += tilesX * tilesY;
    }
    totalTiles = total;
  }

  async function downloadTiles() {
    const lat = useCurrentLocation ? mavLocation.lat : customLat;
    const lng = useCurrentLocation ? mavLocation.lng : customLng;
    
    if (!lat || !lng) {
      downloadStatus = 'Error: Invalid location';
      return;
    }
    
    isDownloading = true;
    downloadedTiles = 0;
    downloadStatus = 'Downloading tiles...';
    
    calculateTotalTiles();
    
    const tileBase = mapType === 'OpenStreetMap' ? '/api/tiles' : '/api/tiles/google';
    
    try {
      for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
        const bounds = getTileBounds(lat, lng, radiusKm, zoom);
        
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
          for (let y = bounds.minY; y <= bounds.maxY; y++) {
            if (!isDownloading) {
              downloadStatus = 'Download cancelled';
              return;
            }
            
            try {
              const url = `${tileBase}/${zoom}/${x}/${y}.png`;
              const response = await fetch(url);
              
              if (response.ok) {
                // Tile is now cached on server
                downloadedTiles++;
                downloadProgress = (downloadedTiles / totalTiles) * 100;
                downloadStatus = `Downloaded ${downloadedTiles} of ${totalTiles} tiles (${downloadProgress.toFixed(1)}%)`;
              }
            } catch (error) {
              console.warn(`Failed to download tile ${zoom}/${x}/${y}`);
            }
            
            // Small delay to prevent overwhelming the server
            if (downloadedTiles % 10 === 0) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        }
      }
      
      downloadStatus = `✅ Complete! Downloaded ${downloadedTiles} tiles for offline use.`;
      
      // Notify parent component
      if (onDownloadComplete) {
        onDownloadComplete({ lat, lng }, radiusKm);
      }
    } catch (error: any) {
      downloadStatus = `Error: ${error.message}`;
    } finally {
      isDownloading = false;
    }
  }

  function cancelDownload() {
    isDownloading = false;
    downloadStatus = 'Download cancelled by user';
  }

  function closeModal() {
    if (!isDownloading) {
      isOpen = false;
    }
  }

  async function loadCacheInfo() {
    loadingCacheInfo = true;
    try {
      const response = await fetch('/api/tiles/cache-info');
      if (response.ok) {
        cacheInfo = await response.json();
      }
    } catch (error) {
      console.error('Failed to load cache info:', error);
    } finally {
      loadingCacheInfo = false;
    }
  }

  $: if (isOpen) {
    calculateTotalTiles();
    loadCacheInfo();
  }
</script>

{#if isOpen}
<div class="modal-overlay" on:click={closeModal}>
  <div class="modal-content" on:click|stopPropagation style="--primaryColor: {primaryColor}; --secondaryColor: {secondaryColor}; --tertiaryColor: {tertiaryColor}; --fontColor: {fontColor};">
    <div class="modal-header">
      <h2 class="modal-title">
        <i class="fas fa-download"></i>
        Download Offline Maps
      </h2>
      <button class="close-btn" on:click={closeModal} disabled={isDownloading}>
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="modal-body">
      <div class="info-box">
        <i class="fas fa-info-circle"></i>
        <p>Pre-download map tiles for offline use. This will cache tiles within the specified radius at multiple zoom levels.</p>
      </div>

      <div class="form-section">
        <label class="form-label">
          <input type="checkbox" bind:checked={useCurrentLocation} disabled={isDownloading} />
          Use Current MAV Location
        </label>
        {#if useCurrentLocation}
          <div class="location-display">
            <i class="fas fa-map-marker-alt"></i>
            {mavLocation.lat.toFixed(6)}°, {mavLocation.lng.toFixed(6)}°
          </div>
        {:else}
          <div class="custom-location">
            <input 
              type="number" 
              bind:value={customLat} 
              placeholder="Latitude" 
              step="0.000001"
              disabled={isDownloading}
            />
            <input 
              type="number" 
              bind:value={customLng} 
              placeholder="Longitude" 
              step="0.000001"
              disabled={isDownloading}
            />
          </div>
        {/if}
      </div>

      <div class="form-section">
        <label class="form-label">
          Radius (km): <strong>{radiusKm} km</strong>
        </label>
        <input 
          type="range" 
          min="1" 
          max="50" 
          bind:value={radiusKm} 
          on:input={calculateTotalTiles}
          disabled={isDownloading}
          class="slider"
        />
      </div>

      <div class="form-section">
        <label class="form-label">Zoom Levels</label>
        <div class="zoom-inputs">
          <div>
            <label>Min: {minZoom}</label>
            <input 
              type="range" 
              min="1" 
              max="18" 
              bind:value={minZoom} 
              on:input={calculateTotalTiles}
              disabled={isDownloading}
              class="slider"
            />
          </div>
          <div>
            <label>Max: {maxZoom}</label>
            <input 
              type="range" 
              min="1" 
              max="18" 
              bind:value={maxZoom} 
              on:input={calculateTotalTiles}
              disabled={isDownloading}
              class="slider"
            />
          </div>
        </div>
      </div>

      <div class="form-section">
        <label class="form-label">Map Type: <strong>{mapType}</strong></label>
        <p class="hint">Tiles will be downloaded for the currently selected map type.</p>
      </div>

      {#if cacheInfo}
        <div class="cache-info-box">
          <div class="cache-info-header">
            <i class="fas fa-database"></i>
            <strong>Current Cache Status</strong>
          </div>
          <div class="cache-stats">
            <div class="cache-stat">
              <span class="cache-label">Total Cached:</span>
              <span class="cache-value">{cacheInfo.totalTiles.toLocaleString()} tiles ({cacheInfo.humanReadable.totalSize})</span>
            </div>
            <div class="cache-stat">
              <span class="cache-label">OpenStreetMap:</span>
              <span class="cache-value">{cacheInfo.osm.tiles.toLocaleString()} tiles ({cacheInfo.humanReadable.osmSize})</span>
            </div>
            <div class="cache-stat">
              <span class="cache-label">Google Satellite:</span>
              <span class="cache-value">{cacheInfo.google.tiles.toLocaleString()} tiles ({cacheInfo.humanReadable.googleSize})</span>
            </div>
          </div>
        </div>
      {:else if loadingCacheInfo}
        <div class="cache-info-box">
          <i class="fas fa-spinner fa-spin"></i> Loading cache information...
        </div>
      {/if}

      <div class="stats-box">
        <div class="stat-item">
          <i class="fas fa-layer-group"></i>
          <div>
            <div class="stat-label">Total Tiles</div>
            <div class="stat-value">{totalTiles.toLocaleString()}</div>
          </div>
        </div>
        <div class="stat-item">
          <i class="fas fa-database"></i>
          <div>
            <div class="stat-label">Estimated Size</div>
            <div class="stat-value">{((totalTiles * 25) / 1024).toFixed(1)} MB</div>
          </div>
        </div>
      </div>

      {#if downloadStatus}
        <div class="status-box" class:success={downloadStatus.includes('Complete')}>
          {downloadStatus}
        </div>
      {/if}

      {#if isDownloading}
        <div class="progress-bar">
          <div class="progress-fill" style="width: {downloadProgress}%"></div>
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      {#if isDownloading}
        <button class="btn btn-danger" on:click={cancelDownload}>
          <i class="fas fa-stop"></i>
          Cancel
        </button>
      {:else}
        <button class="btn btn-secondary" on:click={closeModal}>
          Close
        </button>
        <button class="btn btn-primary" on:click={downloadTiles}>
          <i class="fas fa-download"></i>
          Download {totalTiles.toLocaleString()} Tiles
        </button>
      {/if}
    </div>
  </div>
</div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
  }

  .modal-content {
    background: var(--primaryColor);
    border: 2px solid var(--tertiaryColor);
    border-radius: 16px;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--tertiaryColor);
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--fontColor);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }

  .close-btn {
    background: transparent;
    border: none;
    font-size: 1.5rem;
    color: var(--fontColor);
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .close-btn:hover {
    opacity: 1;
  }

  .close-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .modal-body {
    padding: 1.5rem;
    color: var(--fontColor);
  }

  .info-box {
    background: rgba(59, 130, 246, 0.1);
    border-left: 3px solid #3b82f6;
    padding: 1rem;
    border-radius: 8px;
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .info-box i {
    color: #3b82f6;
    font-size: 1.25rem;
  }

  .info-box p {
    margin: 0;
    font-size: 0.9rem;
    opacity: 0.9;
  }

  .form-section {
    margin-bottom: 1.5rem;
  }

  .form-label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.5rem;
    font-size: 0.95rem;
  }

  .form-label input[type="checkbox"] {
    margin-right: 0.5rem;
  }

  .location-display {
    background: var(--secondaryColor);
    padding: 0.75rem;
    border-radius: 8px;
    font-family: monospace;
    margin-top: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .custom-location {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .custom-location input {
    flex: 1;
    background: var(--secondaryColor);
    border: 1px solid var(--tertiaryColor);
    color: var(--fontColor);
    padding: 0.5rem;
    border-radius: 6px;
    font-size: 0.9rem;
  }

  .slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--tertiaryColor);
    outline: none;
    margin-top: 0.5rem;
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
  }

  .slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    border: none;
  }

  .zoom-inputs {
    display: flex;
    gap: 1rem;
  }

  .zoom-inputs > div {
    flex: 1;
  }

  .zoom-inputs label {
    font-size: 0.85rem;
    opacity: 0.8;
    display: block;
    margin-bottom: 0.25rem;
  }

  .hint {
    font-size: 0.85rem;
    opacity: 0.7;
    margin: 0.5rem 0 0 0;
  }

  .stats-box {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-item {
    flex: 1;
    background: var(--secondaryColor);
    padding: 1rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .stat-item i {
    font-size: 1.5rem;
    color: #3b82f6;
  }

  .stat-label {
    font-size: 0.8rem;
    opacity: 0.7;
    margin-bottom: 0.25rem;
  }

  .stat-value {
    font-size: 1.1rem;
    font-weight: 600;
  }

  .status-box {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid #3b82f6;
    padding: 0.75rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }

  .status-box.success {
    background: rgba(16, 185, 129, 0.1);
    border-color: #10b981;
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: var(--tertiaryColor);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 1rem;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #10b981);
    transition: width 0.3s ease;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid var(--tertiaryColor);
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    border: none;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
    font-size: 0.95rem;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  .btn-secondary {
    background: var(--tertiaryColor);
    color: var(--fontColor);
  }

  .btn-secondary:hover {
    opacity: 0.8;
  }

  .btn-danger {
    background: #ef4444;
    color: white;
  }

  .btn-danger:hover {
    background: #dc2626;
  }

  .cache-info-box {
    background: var(--secondaryColor);
    border: 1px solid var(--tertiaryColor);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .cache-info-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    font-size: 0.95rem;
  }

  .cache-info-header i {
    color: #10b981;
  }

  .cache-stats {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .cache-stat {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    padding: 0.25rem 0;
  }

  .cache-label {
    opacity: 0.7;
  }

  .cache-value {
    font-weight: 600;
    font-family: monospace;
  }

  @media (max-width: 768px) {
    .modal-content {
      max-width: 100%;
      margin: 0;
      border-radius: 0;
    }

    .stats-box {
      flex-direction: column;
    }

    .zoom-inputs {
      flex-direction: column;
    }
  }
</style>
