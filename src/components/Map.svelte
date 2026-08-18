<script lang="ts">
  import { onMount } from 'svelte';
  import '@fortawesome/fontawesome-free/css/all.min.css';
  import {
    mapStore,
    markersStore,
    polylinesStore,
    mapTypeStore,
    mapTileLayerStore,
    mapZoomStore,
    lockViewStore,
  } from '../stores/mapStore';
  import { mavLocationStore, mavHeadingStore, mavAltitudeStore } from '../stores/mavlinkStore';
  import {
    missionPlanActionsStore,
    type MissionPlanActions,
    missionIndexStore
  } from '../stores/missionPlanStore';
  import { get } from 'svelte/store';
  import Modal from './Modal.svelte';
  import OfflineMapDownloader from './OfflineMapDownloader.svelte';

  export let hideOverlay: boolean = false;
  export let mavLocation: L.LatLng | { lat: number; lng: number };
  export let id: string | null = null;
  import {
    darkModeStore,
    primaryColorStore,
    secondaryColorStore,
    tertiaryColorStore
  } from '../stores/customizationStore';
  
  let showOfflineDownloader = false;

  let L: typeof import('leaflet');
  let leafletMap: any = get(mapStore);
  let mapType: string = get(mapTypeStore);
  let currentTileLayer = get(mapTileLayerStore);
  let zoom = get(mapZoomStore);

  // Cursor grid reference display
  let cursorLat: number | null = null;
  let cursorLng: number | null = null;

  function toGridRef(lat: number, lng: number): string {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    const latAbs = Math.abs(lat);
    const lngAbs = Math.abs(lng);
    const latDeg = Math.floor(latAbs);
    const lngDeg = Math.floor(lngAbs);
    const latMin = ((latAbs - latDeg) * 60).toFixed(4);
    const lngMin = ((lngAbs - lngDeg) * 60).toFixed(4);
    return `${latDeg}°${latMin}'${latDir}  ${lngDeg}°${lngMin}'${lngDir}`;
  }

  let actions: MissionPlanActions = {};
  let action_types = [
    'NAV_WAYPOINT', 'NAV_SPLINE_WAYPOINT', 'NAV_TAKEOFF', 'NAV_RETURN_TO_LAUNCH', 'NAV_GUIDED_ENABLE', 'NAV_LAND',
    'NAV_LOITER_TIME', 'NAV_LOITER_TURNS', 'NAV_LOITER_UNLIM', 'NAV_PAYLOAD_PLACE', 'DO_WINCH', 'DO_GRIPPER', 'DO_SET_CAM_TRIGG_DIST',
    'DO_SET_SERVO', 'DO_REPEAT_SERVO', 'DO_DIGICAM_CONFIGURE', 'DO_DIGICAM_CONTROL', 'DO_FENCE_ENABLE',
    'DO_ENGINE_CONTROL', 'CONDITION_DELAY', 'CONDITION_CHANGE_ALT', 'CONDITION_DISTANCE', 'CONDITION_YAW'
  ];
  let action_markers = [
    'map/waypoint.png', 'map/spline-waypoint.png', 'map/takeoff.png', 'map/rtl.png', 'map/guided_enable.png', 'map/land.png',
    'map/loiter.png', 'map/loiter.png', 'map/loiter.png', 'map/do_winch.png', 'map/do_winch.png', 'map/gripper.png', 'map/camera.png',
    'map/do_set_servo.png', 'map/do_repeat_servo.png', 'map/camera.png', 'map/camera.png', 'map/do_fence_enable.png',
    'map/do_engine_control.png', 'map/delay.png', 'map/condition_change_alt.png', 'map/condition_distance.png', 'map/condition_yaw.png'
  ];
  let icons: L.Icon[] = [];
  let markers: Map<number, L.Marker> = get(markersStore);
  let polylines: Map<string, L.Polyline> = get(polylinesStore);
  let mavHeading: number = 0;
  let mavMarker: L.Marker;
  let isDragging = false;
  let darkMode = get(darkModeStore);
  let downloadedRadius: number | null = null;
  let downloadedCenter: { lat: number; lng: number } | null = null;
  let radiusCircle: L.Circle | null = null;

  $: darkMode = $darkModeStore;
  $: primaryColor = $primaryColorStore;
  $: secondaryColor = $secondaryColorStore;
  $: tertiaryColor = $tertiaryColorStore;
  $: fontColor = darkMode ? '#ffffff' : '#000000';
  $: lockView = $lockViewStore;
  $: zoom = $mapZoomStore;

  $: leafletMap = $mapStore;
  $: mapType = $mapTypeStore;
  $: currentTileLayer = $mapTileLayerStore;
  $: mavHeading = $mavHeadingStore,
        updateMAVMarker();
  $: mavLocation = $mavLocationStore,
        updateMAVMarker();

  $: actions = $missionPlanActionsStore,
    removeAllMarkers(),
    updateMAVMarker(),
    Object.keys(actions).forEach((index) => {
      updateMap(Number(index));
    });

  $: markers = $markersStore,
    Object.keys(actions).forEach((index) => {
      updateMap(Number(index));
    });

  $: polylines = $polylinesStore,
    Object.keys(actions).forEach((index) => {
      updateMap(Number(index));
    });

  onMount(async () => {
    try {
      L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (id !== null) initializeLeafletMap(id);
      else initializeLeafletMap();
    } catch (error) {
      console.error('Script loading failed', error);
    }

    document.addEventListener('fullscreenchange', () => {
      setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 1000);
    });

    icons = action_markers.map((marker) => {
      return L.icon({
        iconUrl: marker,
        iconSize: [45, 45],
        iconAnchor: [23, 40],
        popupAnchor: [0, -45],
        shadowSize: [41, 41]
      });
    });

    Object.keys(actions).forEach((index) => { updateMap(Number(index)); });

    document.addEventListener('fullscreenchange', (e) => {
      if (!document.fullscreenElement && window.location.href.includes('dashboard')) hideOverlay = true;
      setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 1000);
    });
    document.addEventListener('mousedown', () => { isDragging = true });
    document.addEventListener('mouseup', () => { isDragging = false });
    document.addEventListener('touchstart', () => { isDragging = true });
    document.addEventListener('touchend', () => { isDragging = false });
    let zoomIn = document.querySelector('.leaflet-control-zoom-in');
    let zoomOut = document.querySelector('.leaflet-control-zoom-out');
    if (zoomIn) zoomIn.addEventListener('click', () => { updateZoom(1) });
    if (zoomOut) zoomOut.addEventListener('click', () => { updateZoom(-1) });
    let map = get(mapStore);
    map?.on('zoom', () => { mapZoomStore.set(map.getZoom()); });
  });

  function updateZoom(delta: number) {
    zoom += delta;
    mapZoomStore.set(zoom);
  }

  function initializeLeafletMap(id: string = 'map') {
    leafletMap = L.map(id).setView(mavLocation, zoom);
    if (mapType.toLowerCase() === 'openstreetmap') {
      currentTileLayer = L.tileLayer('/api/tiles/{z}/{x}/{y}.png', {
          minZoom: 0, maxZoom: 20,
          attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
        }).addTo(leafletMap);
      mapType = 'OpenStreetMap';
    } else {
      currentTileLayer = L.tileLayer('/api/tiles/google/{z}/{x}/{y}.png', {
          minZoom: 0, maxZoom: 20,
          attribution: 'Map data &copy; <a href="https://www.google.com/maps">Google Maps</a>'
        }).addTo(leafletMap);
      mapType = 'Satellite';
    }
    mapTypeStore.set(mapType);
    mapTileLayerStore.set(currentTileLayer);

    if (darkMode) {
      if (mapType.toLowerCase() !== 'satellite') document.getElementById('map')!.classList.add('dark');
      // @ts-ignore
      document.querySelector('.bg')!.style.background = "url('bg-map.webp') no-repeat center center fixed";
      primaryColorStore.set('#1c1c1e');
    } else {
      // @ts-ignore
      document.querySelector('.bg')!.style.background = "url('bg-map-light.webp') no-repeat center center fixed";
      primaryColorStore.set('#ffffff');
    }

    if (hideOverlay) Array.from(document.querySelectorAll('.map-btn i')).forEach((el: any) => el.style.fontSize = 'small');
    updateMAVMarker();

    const locationDisplay = document.querySelector('#location-display')!;
    function updateLocationDisplay() {
      const gridRef = toGridRef(mavLocation.lat, mavLocation.lng);
      locationDisplay.innerHTML = `<span title="MAV coordinates">📍 ${gridRef}</span> &nbsp;|&nbsp; Yaw: ${mavHeading}° &nbsp;|&nbsp; Alt: ${get(mavAltitudeStore).toFixed(1)}m`;
    }
    updateLocationDisplay();
    mavLocationStore.subscribe(location => { mavLocation = location; updateLocationDisplay(); });

    // Update cursor grid reference on mouse move
    leafletMap.on('mousemove', (e: L.LeafletMouseEvent) => {
      cursorLat = e.latlng.lat;
      cursorLng = e.latlng.lng;
    });
    leafletMap.on('mouseout', () => { cursorLat = null; cursorLng = null; });

    leafletMap.on('click', (e: L.LeafletMouseEvent) => {
      if (Object.keys(actions).length > 1) {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;
        const index = Object.keys(actions).length;
        const action = { type: 'NAV_WAYPOINT', lat, lon, alt: null, notes: '', param1: null, param2: null, param3: null, param4: null };
        actions[index] = action;
        missionPlanActionsStore.set(actions);
        updateMap(index);
      }
    });

    // @ts-ignore
    if (hideOverlay) document.querySelector('.leaflet-control-attribution')!.style.display = 'none';
    // @ts-ignore
    else document.querySelector('.leaflet-control-attribution')!.style.display = 'inline-flex';

    mapStore.set(leafletMap);
    mavLocationStore.set(mavLocation);
  }

  function toggleMap() {
    if (currentTileLayer) currentTileLayer.remove();
    const map = document.getElementById('map')!;
    if (leafletMap && mapType.toLowerCase() === 'openstreetmap') {
      mapType = 'Satellite';
      map.classList.remove('dark');
      map.classList.add('satellite');
      currentTileLayer = L.tileLayer('/api/tiles/google/{z}/{x}/{y}.png', {
        minZoom: 0, maxZoom: 20,
        attribution: 'Map data &copy; <a href="https://www.google.com/maps">Google Maps</a>'
      }).addTo(leafletMap);
    } else if (leafletMap) {
      mapType = 'OpenStreetMap';
      if (darkMode) map.classList.add('dark');
      map.classList.remove('satellite');
      currentTileLayer = L.tileLayer('/api/tiles/{z}/{x}/{y}.png', {
        minZoom: 0, maxZoom: 20,
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
      }).addTo(leafletMap);
    }
    mapTypeStore.set(mapType);
    mapTileLayerStore.set(currentTileLayer);
    // @ts-ignore
    if (hideOverlay) document.querySelector('.leaflet-control-attribution')!.style.display = 'none';
    // @ts-ignore
    else document.querySelector('.leaflet-control-attribution')!.style.display = 'inline-flex';
  }

  function toggleLockView() {
    lockView = !lockView;
    lockViewStore.set(lockView);
  }

  function showDownloadedArea(center: { lat: number; lng: number }, radiusKm: number) {
    // Remove existing circle if any
    if (radiusCircle && leafletMap) {
      leafletMap.removeLayer(radiusCircle);
    }
    
    if (L && leafletMap) {
      // Create circle overlay showing downloaded area
      radiusCircle = L.circle([center.lat, center.lng], {
        radius: radiusKm * 1000, // Convert km to meters
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
        weight: 2,
        dashArray: '5, 10'
      });
      
      radiusCircle.addTo(leafletMap);
      
      // Add popup
      radiusCircle.bindPopup(`
        <strong>Downloaded Area</strong><br>
        Radius: ${radiusKm} km<br>
        Center: ${center.lat.toFixed(6)}°, ${center.lng.toFixed(6)}°<br>
        <em>Maps available offline in this area</em>
      `);
      
      downloadedCenter = center;
      downloadedRadius = radiusKm;
    }
  }

  function clearDownloadedArea() {
    if (radiusCircle && leafletMap) {
      leafletMap.removeLayer(radiusCircle);
      radiusCircle = null;
      downloadedCenter = null;
      downloadedRadius = null;
    }
  }

  function toggleFullScreen(element: HTMLElement) {
    if (window.location.href.includes('dashboard')) hideOverlay = !hideOverlay;
    if (!document.fullscreenElement) {
      element.requestFullscreen().catch(err => {
        new Modal({
          target: document.body,
          props: { title: 'Error', content: `Error attempting to enable full-screen mode: ${err.message} (${err.name})`, isOpen: true, confirmation: false, notification: true },
        });
      });
      setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 1000);
    } else {
      document.exitFullscreen();
      setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 1000);
    }
    // @ts-ignore
    if (hideOverlay) document.querySelector('.leaflet-control-attribution')!.style.display = 'none';
    // @ts-ignore
    else document.querySelector('.leaflet-control-attribution')!.style.display = 'inline-flex';
  }

  function handleFullScreen() {
    const el = document.querySelector('.map-container');
    if (el instanceof HTMLElement) toggleFullScreen(el);
  }

  function removeAllMarkers() {
    markers.forEach((marker) => {
      if (leafletMap?.hasLayer(marker) && marker.getLatLng() !== mavLocation) {
        leafletMap.removeLayer(marker);
      }
    });
    markers.clear();
    polylines.forEach(polyline => {
      if (leafletMap?.hasLayer(polyline)) leafletMap.removeLayer(polyline);
    });
    polylines.clear();
    markersStore.set(markers);
    polylinesStore.set(polylines);
  }

  function removeConnectedPolylines(index: number) {
    const connectedKeys = Array.from(polylines.keys()).filter(key => {
      const [startIndex, endIndex] = key.split('-').map(Number);
      return startIndex === index || endIndex === index;
    });
    connectedKeys.forEach(key => {
      const polyline = polylines.get(key);
      if (polyline) {
        if (leafletMap?.hasLayer(polyline)) leafletMap.removeLayer(polyline);
        polylines.delete(key);
      }
    });
  }

  function removePolyline(start: L.LatLng, end: L.LatLng) {
    const key = generatePolylineKey(start, end);
    const polylineToRemove = polylines.get(key);
    if (polylineToRemove) {
      if (leafletMap?.hasLayer(polylineToRemove)) leafletMap.removeLayer(polylineToRemove);
      polylines.delete(key);
    }
  }

  function addPolyline(start: L.LatLng, end: L.LatLng) {
    const key = generatePolylineKey(start, end);
    removePolyline(start, end);
    const latlngs: L.LatLngExpression[] = [start, end];
    const polyline = L.polyline(latlngs, { color: 'red' });
    leafletMap?.addLayer(polyline);
    polylines.set(key, polyline);
  }

  function generatePolylineKey(start: L.LatLng, end: L.LatLng): string {
    const startLatLng = [start.lat, start.lng].join(',');
    const endLatLng = [end.lat, end.lng].join(',');
    return [startLatLng, endLatLng].sort().join('-');
  }

  async function updateMap(index: number) {
    const action = actions[index];
    if (markers.has(index)) leafletMap?.removeLayer(markers.get(index)!);
    if (index !== 0) {
      if (L && leafletMap && action) {
        const { type, lat, lon } = action;
        const iconIndex = action_types.indexOf(type);
        if (!isNaN(lat) && !isNaN(lon) && iconIndex >= 0) {
          const marker = L.marker([lat, lon], { icon: icons[iconIndex] }).bindPopup(`${index} - ${type}`);
          try { leafletMap.addLayer(marker); } catch (e) { return; }
          markers.set(index, marker);
        }
      }
      removeConnectedPolylines(index);
      updateMarkersAndPolylines();
    }
  }

  function updateMarkersAndPolylines(reindex: boolean = false) {
    if (reindex) {
      const lastMarker = markers.get(Object.keys(actions).length + 1);
      if (lastMarker) {
        leafletMap?.removeLayer(lastMarker);
        markers.delete(Object.keys(actions).length + 1);
      }
      markers.forEach((marker, index) => {
        const action = actions[index];
        marker.bindPopup(`${index} - ${action.type}`);
      });
    }

    polylines.forEach(polyline => {
      if (leafletMap?.hasLayer(polyline)) leafletMap.removeLayer(polyline);
    });
    polylines.clear();

    const markerEntries = Array.from(markers.entries()).sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < markerEntries.length - 1; i++) {
      const [currentIndex, currentMarker] = markerEntries[i];
      const [, nextMarker] = markerEntries[i + 1];
      let [prevIndex, prevMarker] = markerEntries[i];
      if (i > 0) [prevIndex, prevMarker] = markerEntries[i - 1];
      if (currentMarker && nextMarker && currentIndex >= get(missionIndexStore)) {
        addPolyline(currentMarker.getLatLng(), nextMarker.getLatLng());
      }
      if (currentIndex < get(missionIndexStore) && prevMarker) {
        removePolyline(prevMarker.getLatLng(), currentMarker.getLatLng());
      }
    }

    if (markerEntries.length > 0 && get(mapStore)) {
      const mavLoc = get(mavLocationStore)!;
      const firstUnreached = markerEntries.find(([index]) => index === get(missionIndexStore));
      if (mavLoc && firstUnreached) addPolyline(mavLoc as L.LatLng, firstUnreached[1].getLatLng());
    }
  }

  function updateMAVMarker() {
    if (leafletMap && mavLocation) {
      let img = new Image();
      img.src = '/map/here.png';
      try { L.icon } catch (e) { return; }
      img.onload = () => {
        let canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        let ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.translate(img.width / 2, img.height / 2);
          ctx.rotate((mavHeading) * Math.PI / 180);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          ctx.save();
          let icon = L.icon({
            iconUrl: canvas.toDataURL(),
            iconSize: [45, 45],
            iconAnchor: [23, 20],
            popupAnchor: [0, -15],
            shadowSize: [41, 41]
          });
          if (mavMarker) leafletMap.removeLayer(mavMarker);
          mavMarker = L.marker(mavLocation as L.LatLng, { icon }).bindPopup('MAV is here: ' + mavLocation.lat + ', ' + mavLocation.lng);
          leafletMap.addLayer(mavMarker);
          updateMarkersAndPolylines();
          if (lockView) leafletMap.setView(mavLocation as L.LatLng, get(mapZoomStore));
        }
      };
    }
  }
</script>

<style lang="css">
  .map-container {
    position: relative;
    height: 100%;
    width: 100%;
  }

  #map {
    height: 100%;
    width: 100%;
    position: absolute;
    top: 0;
    left: 0;
  }

  #map {
    display: block;
  }

  #map-toggle {
    z-index: 10;
    background-color: var(--secondaryColor);
    border: 2px solid var(--primaryColor);
  }

  #map-toggle > * {
    color: var(--fontColor);
  }

  .map-btn {
    color: var(--fontColor);
    background-color: var(--secondaryColor);
    border: 2px solid var(--primaryColor);
    opacity: 0.95;
  }

  .map-btn:hover {
    opacity: 0.7;
  }
  #location-display {
    position: absolute;
    bottom: 10px;
    left: 10px;
    background: rgba(255,255,255,0.8);
    padding: 5px;
    border-radius: 4px;
    z-index: 1000;
  }

  .cursor-grid-ref {
    position: absolute;
    bottom: 10px;
    right: 10px;
    background: rgba(0,0,0,0.6);
    color: #00ff88;
    font-family: 'Courier New', monospace;
    font-size: 0.72rem;
    padding: 4px 10px;
    border-radius: 6px;
    z-index: 1000;
    pointer-events: none;
    display: flex;
    align-items: center;
    gap: 6px;
    backdrop-filter: blur(2px);
  }
</style>

<div class="map-container" style="--primaryColor: {primaryColor}; --secondaryColor: {secondaryColor}; --tertiaryColor: {tertiaryColor}; --fontColor: {fontColor};">
  <div id={id !== null ? id : 'map'} class="relative h-full rounded-2xl z-0"></div>
  {#if downloadedCenter && downloadedRadius}
    <button class="map-btn absolute top-[9.4rem] right-2 text-[#ffffff] bg-opacity-75 p-2 px-[13px] rounded-full" on:click={clearDownloadedArea} title="Hide Downloaded Area"> 
      <i class="fas fa-eye-slash"></i>
    </button>
  {/if}
  <button class="map-btn absolute top-[6.6rem] right-2 text-[#ffffff] bg-opacity-75 p-2 px-[13px] rounded-full" on:click={() => showOfflineDownloader = true} title="Download Offline Maps"> 
    <i class="fas fa-download"></i>
  </button>
  <button class="map-btn absolute top-[3.8rem] right-2 text-[#ffffff] bg-opacity-75 p-2 {lockView ? 'px-[15px]' : 'px-[13px]'} rounded-full" on:click={toggleLockView}> 
    <i class="fas {lockView ? 'fa-lock' : 'fa-lock-open'}"></i>
  </button>
  <button class="map-btn absolute top-3 right-2 text-[#ffffff] bg-opacity-75 p-2 px-[14px] rounded-full" on:click={handleFullScreen}>
    <i class="fas fa-expand"></i>
  </button>
  <label id="map-toggle" class="flex justify-center cursor-pointer my-2 absolute top-1 right-2 left-2 w-fit m-auto rounded-3xl p-2 pl-3 text-sm items-center" style={!hideOverlay ? 'display: flex;' : 'display: none;'}>
    <input type="checkbox" value="" class="sr-only peer" on:click={toggleMap}>
    <span class="text-white flex items-center gap-2">
      <i class="fas fa-map"></i>
      <span>{mapType}</span>
    </span>
    <div class="relative w-11 h-6 ml-3 rounded-full transition-colors peer-focus:outline-none" class:bg-blue-500={mapType === 'OpenStreetMap'} class:bg-green-500={mapType === 'Satellite'}>
      <div class="absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-all duration-300" style:transform={mapType === 'OpenStreetMap' ? 'translateX(0)' : 'translateX(100%)'}></div>
    </div>
  </label>
  <div id="location-display" class="text-black text-sm" style={!hideOverlay ? 'display: block;' : 'display: none;'}></div>
  <!-- Cursor grid reference -->
  {#if !hideOverlay && cursorLat !== null && cursorLng !== null}
    <div class="cursor-grid-ref" style="--primaryColor: {primaryColor}; --fontColor: {fontColor};">
      <i class="fas fa-crosshairs" style="opacity:0.7;"></i>
      {toGridRef(cursorLat, cursorLng)}
    </div>
  {/if}
</div>

<OfflineMapDownloader 
  bind:isOpen={showOfflineDownloader} 
  onDownloadComplete={(center, radius) => showDownloadedArea(center, radius)}
/>
