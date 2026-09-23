<script lang="ts">
  import { onMount } from 'svelte';
  import {
    darkModeStore,
    primaryColorStore,
    secondaryColorStore,
    tertiaryColorStore,
  } from '../stores/customizationStore';
  import { mapStore } from '../stores/mapStore';
  import { get } from 'svelte/store';

  export let onClose: () => void;
  export let isOpen: boolean = false;

  let darkMode = get(darkModeStore);
  let primaryColor = get(primaryColorStore);
  let secondaryColor = get(secondaryColorStore);
  let tertiaryColor = get(tertiaryColorStore);
  let fontColor = darkMode ? '#ffffff' : '#000000';

  $: darkMode = $darkModeStore;
  $: primaryColor = $primaryColorStore;
  $: secondaryColor = $secondaryColorStore;
  $: tertiaryColor = $tertiaryColorStore;
  $: fontColor = darkMode ? '#ffffff' : '#000000';

  let fileInput: HTMLInputElement;
  let uploadedFile: File | null = null;
  let layerName: string = '';
  let opacity: number = 0.7;
  let uploadStatus: string = '';
  let uploadedLayers: any[] = [];
  let selectedFormat: string = 'auto';

  // Supported formats
  const supportedFormats = [
    { value: 'auto', label: 'Auto-detect', extensions: '*' },
    { value: 'geotiff', label: 'GeoTIFF', extensions: '.tif, .tiff' },
    { value: 'dted', label: 'DTED2 (Elevation)', extensions: '.dt0, .dt1, .dt2' },
    { value: 'shapefile', label: 'Shapefile', extensions: '.shp, .dbf, .shx' },
    { value: 'dem', label: 'DEM (Digital Elevation)', extensions: '.dem, .asc' },
    { value: 'kml', label: 'KML/KMZ', extensions: '.kml, .kmz' },
    { value: 'gpx', label: 'GPX', extensions: '.gpx' },
    { value: 'geojson', label: 'GeoJSON', extensions: '.json, .geojson' },
    { value: 'mbtiles', label: 'MBTiles', extensions: '.mbtiles' },
  ];

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      uploadedFile = target.files[0];
      if (!layerName) {
        layerName = uploadedFile.name.replace(/\.[^/.]+$/, '');
      }
      uploadStatus = `Selected: ${uploadedFile.name} (${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)`;
    }
  }

  async function handleUpload() {
    if (!uploadedFile) {
      uploadStatus = '❌ Please select a file first';
      return;
    }

    if (!layerName.trim()) {
      uploadStatus = '❌ Please enter a layer name';
      return;
    }

    uploadStatus = '⏳ Uploading and processing...';

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('layerName', layerName);
      formData.append('opacity', opacity.toString());
      formData.append('format', selectedFormat);

      const response = await fetch('/api/maps/upload', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        uploadStatus = `✅ Layer uploaded successfully: ${layerName}`;
        
        // Add to map
        addLayerToMap(result);
        
        // Reset form
        uploadedFile = null;
        layerName = '';
        if (fileInput) fileInput.value = '';
        
        // Refresh uploaded layers list
        await loadUploadedLayers();
      } else {
        const error = await response.text();
        uploadStatus = `❌ Upload failed: ${error}`;
      }
    } catch (err: any) {
      uploadStatus = `❌ Error: ${err.message}`;
      console.error('Upload error:', err);
    }
  }

  function addLayerToMap(layerData: any) {
    const leafletMap = get(mapStore);
    if (!leafletMap || typeof window === 'undefined') return;

    const L = (window as any).L;
    if (!L) return;

    try {
      let layer: any;

      switch (layerData.type) {
        case 'geotiff':
        case 'dted':
        case 'dem':
          // Raster overlay
          layer = L.imageOverlay(layerData.url, layerData.bounds, {
            opacity: opacity,
            attribution: `Custom Layer: ${layerName}`
          }).addTo(leafletMap);
          break;

        case 'geojson':
        case 'kml':
        case 'gpx':
          // Vector overlay
          layer = L.geoJSON(layerData.data, {
            style: {
              color: '#ff7800',
              weight: 2,
              opacity: opacity
            }
          }).addTo(leafletMap);
          leafletMap.fitBounds(layer.getBounds());
          break;

        case 'mbtiles':
          // Tile layer
          layer = L.tileLayer(layerData.url, {
            maxZoom: 18,
            attribution: `Custom Layer: ${layerName}`,
            opacity: opacity
          }).addTo(leafletMap);
          break;
      }

      if (layer) {
        uploadedLayers.push({
          name: layerName,
          type: layerData.type,
          layer: layer,
          opacity: opacity
        });
        uploadedLayers = uploadedLayers; // Trigger reactivity
      }
    } catch (err) {
      console.error('Error adding layer to map:', err);
      uploadStatus = `❌ Error displaying layer: ${(err as Error).message}`;
    }
  }

  function removeLayer(index: number) {
    const item = uploadedLayers[index];
    const leafletMap = get(mapStore);
    if (leafletMap && item.layer) {
      leafletMap.removeLayer(item.layer);
    }
    uploadedLayers.splice(index, 1);
    uploadedLayers = uploadedLayers;
  }

  function toggleLayerVisibility(index: number) {
    const item = uploadedLayers[index];
    const leafletMap = get(mapStore);
    if (!leafletMap || !item.layer) return;

    if (leafletMap.hasLayer(item.layer)) {
      leafletMap.removeLayer(item.layer);
      item.visible = false;
    } else {
      item.layer.addTo(leafletMap);
      item.visible = true;
    }
    uploadedLayers = uploadedLayers;
  }

  function updateLayerOpacity(index: number, newOpacity: number) {
    const item = uploadedLayers[index];
    if (item.layer && item.layer.setOpacity) {
      item.layer.setOpacity(newOpacity);
      item.opacity = newOpacity;
      uploadedLayers = uploadedLayers;
    }
  }

  async function loadUploadedLayers() {
    try {
      const response = await fetch('/api/maps/list');
      if (response.ok) {
        const layers = await response.json();
        // Handle existing layers
      }
    } catch (err) {
      console.error('Error loading layers:', err);
    }
  }

  onMount(() => {
    loadUploadedLayers();
  });

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }
</script>

{#if isOpen}
<div
  class="modal-backdrop"
  on:click={handleBackdropClick}
  style="--primaryColor: {primaryColor}; --secondaryColor: {secondaryColor}; --tertiaryColor: {tertiaryColor}; --fontColor: {fontColor};"
>
  <div class="modal-container" on:click|stopPropagation>
    <div class="modal-header">
      <h2 class="modal-title">
        <i class="fas fa-layer-group"></i>
        Upload Map Layers
      </h2>
      <button class="close-btn" on:click={onClose}>
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="modal-body">
      <!-- Format Selection -->
      <div class="form-group">
        <label for="format-select">Map Format</label>
        <select id="format-select" bind:value={selectedFormat} class="format-select">
          {#each supportedFormats as format}
            <option value={format.value}>{format.label} ({format.extensions})</option>
          {/each}
        </select>
        <span class="input-hint">Select the format of your map file</span>
      </div>

      <!-- File Upload -->
      <div class="form-group">
        <label for="file-upload">Select File</label>
        <input
          id="file-upload"
          type="file"
          bind:this={fileInput}
          on:change={handleFileSelect}
          accept=".tif,.tiff,.dt0,.dt1,.dt2,.shp,.dem,.asc,.kml,.kmz,.gpx,.json,.geojson,.mbtiles"
          class="file-input"
        />
        <span class="input-hint">Supported: TIFF, DTED2, SHP, DEM, KML, GPX, GeoJSON, MBTiles</span>
      </div>

      <!-- Layer Name -->
      <div class="form-group">
        <label for="layer-name">Layer Name</label>
        <input
          id="layer-name"
          type="text"
          bind:value={layerName}
          placeholder="Enter layer name"
          class="text-input"
        />
      </div>

      <!-- Opacity Control -->
      <div class="form-group">
        <label for="opacity-slider">Opacity: {(opacity * 100).toFixed(0)}%</label>
        <input
          id="opacity-slider"
          type="range"
          min="0"
          max="1"
          step="0.1"
          bind:value={opacity}
          class="opacity-slider"
        />
      </div>

      <!-- Upload Status -->
      {#if uploadStatus}
        <div class="upload-status" class:success={uploadStatus.includes('✅')} class:error={uploadStatus.includes('❌')}>
          {uploadStatus}
        </div>
      {/if}

      <!-- Upload Button -->
      <button class="upload-btn" on:click={handleUpload} disabled={!uploadedFile}>
        <i class="fas fa-cloud-upload-alt"></i>
        Upload Layer
      </button>

      <!-- Uploaded Layers List -->
      {#if uploadedLayers.length > 0}
        <div class="layers-list">
          <h3>Active Layers</h3>
          {#each uploadedLayers as layer, index}
            <div class="layer-item">
              <button class="visibility-btn" on:click={() => toggleLayerVisibility(index)}>
                <i class="fas {layer.visible !== false ? 'fa-eye' : 'fa-eye-slash'}"></i>
              </button>
              <span class="layer-name">{layer.name}</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={layer.opacity}
                on:input={(e) => {
                  const target = e.target;
                  if (target instanceof HTMLInputElement) {
                    updateLayerOpacity(index, parseFloat(target.value));
                  }
                }}
                class="layer-opacity"
              />
              <button class="remove-btn" on:click={() => removeLayer(index)}>
                <i class="fas fa-trash"></i>
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="btn btn-secondary" on:click={onClose}>
        Close
      </button>
    </div>
  </div>
</div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
  }

  .modal-container {
    background: var(--primaryColor);
    color: var(--fontColor);
    border-radius: 12px;
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--secondaryColor);
  }

  .modal-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--fontColor);
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0.5rem;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .close-btn:hover {
    opacity: 1;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.9rem;
  }

  .format-select,
  .text-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--secondaryColor);
    border-radius: 6px;
    background: var(--secondaryColor);
    color: var(--fontColor);
    font-size: 1rem;
  }

  .file-input {
    width: 100%;
    padding: 0.75rem;
    border: 2px dashed var(--secondaryColor);
    border-radius: 6px;
    cursor: pointer;
  }

  .input-hint {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .opacity-slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--secondaryColor);
    outline: none;
    cursor: pointer;
  }

  .upload-status {
    padding: 0.75rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    background: var(--secondaryColor);
  }

  .upload-status.success {
    background: rgba(34, 197, 94, 0.2);
    border-left: 4px solid #22c55e;
  }

  .upload-status.error {
    background: rgba(239, 68, 68, 0.2);
    border-left: 4px solid #ef4444;
  }

  .upload-btn {
    width: 100%;
    padding: 1rem;
    background: var(--tertiaryColor);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: opacity 0.2s;
  }

  .upload-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .upload-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .layers-list {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid var(--secondaryColor);
  }

  .layers-list h3 {
    font-size: 1rem;
    margin-bottom: 1rem;
  }

  .layer-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--secondaryColor);
    border-radius: 6px;
    margin-bottom: 0.5rem;
  }

  .visibility-btn,
  .remove-btn {
    background: none;
    border: none;
    color: var(--fontColor);
    cursor: pointer;
    padding: 0.5rem;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .visibility-btn:hover,
  .remove-btn:hover {
    opacity: 1;
  }

  .layer-name {
    flex: 1;
    font-size: 0.9rem;
  }

  .layer-opacity {
    width: 100px;
  }

  .modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--secondaryColor);
    display: flex;
    justify-content: flex-end;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .btn-secondary {
    background: var(--secondaryColor);
    color: var(--fontColor);
  }

  .btn:hover {
    opacity: 0.9;
  }
</style>
