<script lang="ts">
  import '@fortawesome/fontawesome-free/css/all.min.css';
  import { onMount, onDestroy } from 'svelte';
  import Modal from './Modal.svelte';
  import { sendCommand, setAltitude, heartbeat as mavHeartbeat } from '$lib/api/mavlink';

  import ArtificialHorizon from './ArtificialHorizon.svelte';

  import {
    darkModeStore,
    primaryColorStore,
    secondaryColorStore,
    tertiaryColorStore
  } from '../stores/customizationStore';
  import {
    mavLocationStore,
    mavAltitudeStore,
    mavHeadingStore,
    mavGimbalTiltStore,
    mavGimbalPanStore,
    mavGimbalZoomStore,
    mavPitchStore,
    mavRollStore
  } from '../stores/mavlinkStore';

  // PFD overlay state — toggled by the expand button inside ArtificialHorizon
  let pfdExpanded = false;

  // Video feed URL built from .env variables (VITE_ prefix = exposed to client)
  const VIDEO_PORT = import.meta.env.VITE_VIDEO_PORT ?? '8889';
  const VIDEO_PATH = import.meta.env.VITE_VIDEO_PATH ?? 'cam';
  $: feedUrl = typeof window !== 'undefined'
    ? `http://${window.location.hostname}:${VIDEO_PORT}/${VIDEO_PATH}`
    : '';

  $: darkMode       = $darkModeStore;
  $: primaryColor   = $primaryColorStore;
  $: secondaryColor = $secondaryColorStore;
  $: tertiaryColor  = $tertiaryColorStore;
  $: fontColor      = darkMode ? '#ffffff' : '#000000';

  // Reactive telemetry
  $: mavLocation   = $mavLocationStore;
  $: altitude      = $mavAltitudeStore;
  $: heading       = $mavHeadingStore;
  $: gimbalTilt    = $mavGimbalTiltStore;
  $: gimbalPan     = $mavGimbalPanStore;
  $: gimbalZoom    = $mavGimbalZoomStore;
  $: pitch         = $mavPitchStore;
  $: roll          = $mavRollStore;

  // Format lat/lng to grid reference style (degrees + decimal minutes)
  function toGridRef(lat: number, lng: number): string {
    const latDir  = lat  >= 0 ? 'N' : 'S';
    const lngDir  = lng  >= 0 ? 'E' : 'W';
    const latAbs  = Math.abs(lat);
    const lngAbs  = Math.abs(lng);
    const latDeg  = Math.floor(latAbs);
    const lngDeg  = Math.floor(lngAbs);
    const latMin  = ((latAbs - latDeg) * 60).toFixed(4);
    const lngMin  = ((lngAbs - lngDeg) * 60).toFixed(4);
    return `${latDeg}°${latMin}'${latDir}  ${lngDeg}°${lngMin}'${lngDir}`;
  }

  function bearingLabel(deg: number): string {
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  // ── Recording ────────────────────────────────────────────────────────────────
  let isRecording   = false;
  let mediaRecorder: MediaRecorder | null = null;
  let recordedChunks: Blob[] = [];
  let recordingDuration = 0;
  let recordingTimer: ReturnType<typeof setInterval> | null = null;

  // SRT telemetry log — one entry per second while recording
  interface SrtEntry {
    index: number;
    startSec: number;
    lat: number; lng: number;
    alt: number; heading: number;
    tilt: number; pan: number; zoom: number;
  }
  let srtEntries: SrtEntry[] = [];

  function formatDuration(s: number) {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
  }

  // Format a time as SRT timestamp: HH:MM:SS,mmm
  function srtTimestamp(totalSec: number): string {
    const h   = Math.floor(totalSec / 3600).toString().padStart(2, '0');
    const m   = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    const s   = Math.floor(totalSec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s},000`;
  }

  function buildSrtContent(entries: SrtEntry[]): string {
    return entries.map(e => {
      const start = srtTimestamp(e.startSec);
      const end   = srtTimestamp(e.startSec + 1);
      const lat   = e.lat.toFixed(6);
      const lng   = e.lng.toFixed(6);
      return [
        e.index,
        `${start} --> ${end}`,
        `LAT:${lat} LNG:${lng} ALT:${e.alt.toFixed(1)}m`,
        `HDG:${e.heading.toFixed(1)}° TILT:${e.tilt.toFixed(1)}° PAN:${e.pan.toFixed(1)}° ZOOM:${e.zoom.toFixed(1)}x`,
        ''
      ].join('\n');
    }).join('\n');
  }

  async function startRecording() {
    try {
      // Use Screen Capture API — user selects the browser tab with the feed
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
        preferCurrentTab: true   // Chrome 109+ hint to pre-select current tab
      });

      recordedChunks = [];
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
      mediaRecorder.onstop = saveRecording;

      // Auto-stop when user ends the screen share via browser UI
      stream.getVideoTracks()[0].onended = () => stopRecording();

      mediaRecorder.start(1000);
      isRecording = true;
      recordingDuration = 0;
      srtEntries = [];
      recordingTimer = setInterval(() => {
        recordingDuration += 1;
        // Capture one telemetry frame per second for SRT
        srtEntries.push({
          index:    recordingDuration,
          startSec: recordingDuration - 1,
          lat:      typeof mavLocation.lat === 'function' ? (mavLocation as any).lat() : mavLocation.lat,
          lng:      typeof mavLocation.lng === 'function' ? (mavLocation as any).lng() : mavLocation.lng,
          alt:      altitude,
          heading:  heading,
          tilt:     gimbalTilt,
          pan:      gimbalPan,
          zoom:     gimbalZoom
        });
      }, 1000);
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        showError(`Failed to start recording: ${err.message}`);
      }
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      // Stop all tracks so the browser removes the screen-share indicator
      mediaRecorder.stream?.getTracks().forEach(t => t.stop());
    }
    if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null; }
    isRecording = false;
  }

  function saveRecording() {
    if (recordedChunks.length === 0) return;
    const ts   = new Date().toISOString().replace(/[:.]/g, '-');

    // Save video file
    const blob = new Blob(recordedChunks, { type: recordedChunks[0].type });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `gcs-recording-${ts}.webm`;
    a.click();
    URL.revokeObjectURL(url);

    // Save SRT telemetry subtitle file
    if (srtEntries.length > 0) {
      const srtContent = buildSrtContent(srtEntries);
      const srtBlob    = new Blob([srtContent], { type: 'text/plain' });
      const srtUrl     = URL.createObjectURL(srtBlob);
      const srtA       = document.createElement('a');
      srtA.href        = srtUrl;
      srtA.download    = `gcs-recording-${ts}.srt`;
      srtA.click();
      URL.revokeObjectURL(srtUrl);
    }

    recordedChunks = [];
    srtEntries = [];
  }

  // ── Photo capture ─────────────────────────────────────────────────────────────
  // Captures the OSD overlay as a PNG (the iframe content itself is cross-origin
  // and cannot be drawn to canvas, so we snapshot just the OSD parameters).
  async function capturePhoto() {
    const container = document.getElementById('live-feed-container');
    if (!container) return;

    const canvas  = document.createElement('canvas');
    const rect    = container.getBoundingClientRect();
    canvas.width  = rect.width  || 1280;
    canvas.height = rect.height || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dark background (represents the video area)
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw OSD parameters
    drawOSDOnCanvas(ctx, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const ts   = new Date().toISOString().replace(/[:.]/g, '-');
      a.href     = url;
      a.download = `gcs-telemetry-${ts}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  function drawOSDOnCanvas(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.save();
    ctx.font      = `${Math.round(h * 0.022)}px monospace`;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(8, 8, 320, 130);
    ctx.fillStyle = '#00ff88';
    const lines = [
      `COORD  ${toGridRef(mavLocation.lat, mavLocation.lng)}`,
      `ALT    ${altitude.toFixed(1)} m`,
      `BEAR   ${heading.toFixed(1)}° ${bearingLabel(heading)}`,
      `TILT   ${gimbalTilt.toFixed(1)}°   PAN  ${gimbalPan.toFixed(1)}°`,
      `ZOOM   ${gimbalZoom.toFixed(1)}x`,
    ];
    lines.forEach((line, i) => ctx.fillText(line, 14, 30 + i * (h * 0.024)));
    ctx.restore();
  }

  // ── Gimbal quick controls ─────────────────────────────────────────────────────
  let showGimbalControls = false;
  // Camera mode toggle: 'photo' | 'video'
  let cameraMode: 'photo' | 'video' = 'video';

  async function sendGimbal(pitchDelta: number, yawDelta: number) {
    const newPitch = Math.max(-90, Math.min(90, gimbalTilt + pitchDelta));
    const newYaw   = ((gimbalPan + yawDelta) % 360 + 360) % 360;
    try {
      await sendCommand('DO_MOUNT_CONTROL', [newPitch, 0, newYaw, 0, 0, 0, 2], true);
    } catch (err) { console.error('[LiveFeed] sendGimbal failed:', err); }
  }

  async function centerGimbal() {
    try {
      await sendCommand('DO_MOUNT_CONTROL', [0, 0, 0, 0, 0, 0, 2], true);
    } catch (err) { console.error('[LiveFeed] centerGimbal failed:', err); }
  }

  async function tiltDown90() {
    try {
      await sendCommand('DO_MOUNT_CONTROL', [-90, 0, gimbalPan, 0, 0, 0, 2], true);
    } catch (err) { console.error('[LiveFeed] tiltDown90 failed:', err); }
  }

  async function adjustZoom(delta: number) {
    const newZoom = Math.max(1, Math.min(30, gimbalZoom + delta));
    try {
      await sendCommand('SET_CAMERA_ZOOM', [2, newZoom, 0, 0, 0, 0, 0], true);
    } catch (err) { console.error('[LiveFeed] adjustZoom failed:', err); }
  }

  async function adjustAltitude(delta: number) {
    const newAlt = Math.max(0, altitude + delta);
    try {
      await setAltitude(newAlt);
    } catch (err) { console.error('[LiveFeed] adjustAltitude failed:', err); }
  }

  // Trigger camera action based on current mode
  function triggerCameraAction() {
    if (cameraMode === 'photo') {
      capturePhoto();
    } else {
      if (isRecording) stopRecording(); else startRecording();
    }
  }

  // ── Fullscreen / rotate ────────────────────────────────────────────────────────
  function toggleFullScreen() {
    const el = document.getElementById('live-feed-container');
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch((err) => showError(`Fullscreen error: ${err.message}`));
    } else {
      document.exitFullscreen();
    }
  }

  let rotated = false;
  function rotateVideo() {
    rotated = !rotated;
    const video = document.getElementById('live-feed-video') as HTMLVideoElement | null;
    const iframe = document.getElementById('live-feed') as HTMLIFrameElement | null;
    const el = video || iframe;
    if (!el) return;
    el.style.transform = rotated
      ? 'translate(-50%, -50%) rotate(180deg)'
      : 'translate(-50%, -50%) rotate(0deg)';
  }

  function showError(msg: string) {
    new Modal({
      target: document.body,
      props: { title: 'Error', content: msg, isOpen: true, confirmation: false, notification: true },
    });
  }

  // ── Mount ────────────────────────────────────────────────────────────────────
  let isProduction = false;

  onMount(() => {
    if (typeof window === 'undefined') return;

    // Check production flag from heartbeat header
    mavHeartbeat()
      .then((data) => { /* heartbeat response doesn't carry isProduction in the typed API */ })
      .catch(() => {});

    // Show iframe when it loads, hide if it errors (no-signal fallback shows instead)
    const liveFeed = document.getElementById('live-feed') as HTMLIFrameElement | null;
    if (liveFeed) {
      liveFeed.addEventListener('load',  () => { liveFeed.style.zIndex = '20'; });
      liveFeed.addEventListener('error', () => { liveFeed.style.zIndex = '0';  });
    }
  });

  onDestroy(() => {
    if (isRecording) stopRecording();
  });
</script>

<!-- ─────────────────────── Template ─────────────────────── -->
<div
  id="live-feed-container"
  class="text-[#ffffff] rounded-2xl h-full relative overflow-hidden"
  style="--primaryColor: {primaryColor}; --secondaryColor: {secondaryColor}; --fontColor: {fontColor};"
>
  <div class="container w-full h-full relative">

    <!-- No-signal fallback -->
    <img id="no-signal" src="no-signal.gif" alt="No Signal" class="absolute top-0 w-full h-full object-cover z-10" />

    <!-- Live feed iframe (cross-origin MediaMTX WebRTC stream) -->
    <iframe
      allowfullscreen
      id="live-feed"
      title="Live Feed"
      src={feedUrl}
      class="feed-el"
      style="z-index:20; pointer-events:none;"
    ></iframe>

    <!-- ── OSD Overlay ── -->
    <div class="osd absolute top-0 left-0 w-full h-full z-30 pointer-events-none">
      <!-- Top-left: coordinates + flight params -->
      <div class="osd-block osd-tl">
        <div class="osd-row"><span class="osd-label">COORD</span><span class="osd-val">{toGridRef(mavLocation.lat, mavLocation.lng)}</span></div>
        <div class="osd-row"><span class="osd-label">ALT</span><span class="osd-val">{altitude.toFixed(1)} m</span></div>
        <div class="osd-row"><span class="osd-label">BEARING</span><span class="osd-val">{heading.toFixed(1)}° {bearingLabel(heading)}</span></div>
      </div>

      <!-- Bottom-left: camera params -->
      <div class="osd-block osd-bl">
        <div class="osd-row"><span class="osd-label">TILT</span><span class="osd-val">{gimbalTilt.toFixed(1)}°</span><span class="osd-sep">|</span><span class="osd-label">PAN</span><span class="osd-val">{gimbalPan.toFixed(1)}°</span></div>
        <div class="osd-row"><span class="osd-label">ZOOM</span><span class="osd-val">{gimbalZoom.toFixed(1)}x</span></div>
      </div>

      <!-- Top-right: recording badge -->
      {#if isRecording}
        <div class="osd-block osd-tr rec-badge">
          <span class="rec-dot">●</span> REC {formatDuration(recordingDuration)}
        </div>
      {/if}

      <!-- Bottom-right: Artificial Horizon + Gimbal controls -->
      <div class="osd-br-panel">
        <!-- Artificial Horizon (mini PFD) — click ⛶ to expand over video -->
        <div class="mini-horizon">
          <ArtificialHorizon
            expanded={pfdExpanded}
            on:toggle={() => (pfdExpanded = !pfdExpanded)}
          />
        </div>

        <!-- Gimbal joystick toggle -->
        <button class="gimbal-toggle-btn" on:click={() => showGimbalControls = !showGimbalControls}
          title={showGimbalControls ? 'Hide Gimbal Controls' : 'Show Gimbal Controls'}>
          <i class="fas fa-camera-rotate"></i>
          <span>{showGimbalControls ? 'Hide' : 'Gimbal'}</span>
        </button>

        <!-- Gimbal d-pad (shown when toggle is on) -->
        {#if showGimbalControls}
          <div class="gimbal-dpad">
            <!-- Status row -->
            <div class="dpad-info">
              <span title="Tilt">↕ {gimbalTilt.toFixed(0)}°</span>
              <span title="Pan">↔ {((gimbalPan % 360 + 360) % 360).toFixed(0)}°</span>
              <span title="Zoom">🔍 {gimbalZoom.toFixed(1)}x</span>
            </div>

            <!-- Pan / Tilt d-pad -->
            <div class="dpad-grid">
              <!-- Tilt up -->
              <button class="dpad-btn" on:click={() => adjustZoom(-1)} title="Zoom Out">
                <i class="fas fa-search-minus"></i>
              </button>
              <button class="dpad-btn" on:click={() => sendGimbal(5, 0)} title="Tilt Up +5°">
                <i class="fas fa-chevron-up"></i>
              </button>
              <button class="dpad-btn" on:click={() => adjustZoom(1)} title="Zoom In">
                <i class="fas fa-search-plus"></i>
              </button>
              <!-- Pan left / Center / Pan right -->
              <button class="dpad-btn" on:click={() => sendGimbal(0, -15)} title="Pan Left 15°">
                <i class="fas fa-chevron-left"></i>
              </button>
              <button class="dpad-btn dpad-center" on:click={centerGimbal} title="Center Gimbal">
                <i class="fas fa-dot-circle"></i>
              </button>
              <button class="dpad-btn" on:click={() => sendGimbal(0, 15)} title="Pan Right 15°">
                <i class="fas fa-chevron-right"></i>
              </button>
              <!-- Tilt down / Look-down / Alt down -->
              <button class="dpad-btn dpad-alt-up" on:click={() => adjustAltitude(5)} title="Altitude +5m">
                <i class="fas fa-arrow-up"></i>
              </button>
              <button class="dpad-btn" on:click={() => sendGimbal(-5, 0)} title="Tilt Down -5°">
                <i class="fas fa-chevron-down"></i>
              </button>
              <button class="dpad-btn dpad-alt-down" on:click={() => adjustAltitude(-5)} title="Altitude -5m">
                <i class="fas fa-arrow-down"></i>
              </button>
            </div>

            <!-- Quick actions row -->
            <div class="dpad-quick">
              <button class="dpad-quick-btn" on:click={tiltDown90} title="Look Straight Down">
                <i class="fas fa-arrows-down-to-line"></i> Nadir
              </button>
              <button class="dpad-quick-btn" on:click={() => sendGimbal(0, 90)} title="Pan Right 90°">
                <i class="fas fa-arrow-rotate-right"></i> +90°
              </button>
              <button class="dpad-quick-btn" on:click={() => sendGimbal(0, -90)} title="Pan Left 90°">
                <i class="fas fa-arrow-rotate-left"></i> -90°
              </button>
              <button class="dpad-quick-btn" on:click={() => sendGimbal(0, 180)} title="Pan 180° (Rear)">
                <i class="fas fa-redo"></i> 180°
              </button>
            </div>

            <!-- Altitude display -->
            <div class="dpad-alt-display">
              <i class="fas fa-mountain"></i>
              ALT: <strong>{altitude.toFixed(1)} m</strong>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- ── Live badge ── -->
    <div class="tab absolute top-2 left-2 bg-[#f24e4eb9] text-[#ffffff] text-md px-2 py-1 rounded-full z-40">Live Feed</div>

    <!-- ── Caution text ── -->
    <div class="caution-text opacity-[50%] text-md absolute bottom-2 left-2 bg-[#252525cf] px-2 py-1 mr-[0.5em] rounded-full z-40">
      Use Caution: The feed may be slightly delayed.
    </div>

    <!-- ── Controls toolbar ── -->
    <div class="toolbar absolute top-2 right-2 flex gap-1 z-40">

      <!-- Camera mode toggle: Photo ↔ Video -->
      <button
        class="tb-btn tb-mode-toggle"
        class:tb-mode-photo={cameraMode === 'photo'}
        class:tb-mode-video={cameraMode === 'video'}
        title="Toggle Photo / Video mode (currently: {cameraMode})"
        on:click={() => cameraMode = cameraMode === 'photo' ? 'video' : 'photo'}
      >
        <i class="fas {cameraMode === 'photo' ? 'fa-image' : 'fa-film'}"></i>
      </button>

      <!-- Single action button: fires capturePhoto or start/stopRecording based on mode -->
      {#if cameraMode === 'photo'}
        <button class="tb-btn" title="Capture Photo" on:click={capturePhoto}>
          <i class="fas fa-camera"></i>
        </button>
      {:else if isRecording}
        <button class="tb-btn tb-btn-rec" title="Stop Recording" on:click={stopRecording}>
          <i class="fas fa-stop-circle"></i>
        </button>
      {:else}
        <button class="tb-btn" title="Start Recording" on:click={startRecording}>
          <i class="fas fa-circle text-red-400"></i>
        </button>
      {/if}

      <!-- Rotate -->
      <button class="tb-btn" title="Rotate 180°" on:click={rotateVideo}>
        <i class="fas fa-sync-alt"></i>
      </button>

      <!-- Fullscreen -->
      <button class="tb-btn" title="Fullscreen" on:click={toggleFullScreen}>
        <i class="fas fa-expand"></i>
      </button>
    </div>

  </div>

  <!-- ── PFD full-overlay (shown when pfdExpanded = true) ── -->
  {#if pfdExpanded}
    <div class="pfd-overlay" role="region" aria-label="Primary Flight Display">
      <ArtificialHorizon
        expanded={pfdExpanded}
        on:toggle={() => (pfdExpanded = !pfdExpanded)}
      />
    </div>
  {/if}

</div>

<!-- ─────────────────────── Styles ─────────────────────── -->
<style>
  #live-feed-container {
    background-color: var(--primaryColor);
    border: 10px solid var(--primaryColor);
  }

  /* shared style for both iframe and video */
  :global(.feed-el) {
    width: 300%;
    height: 300%;
    background-color: #000;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    object-fit: cover;
    border-radius: 0.5rem;
    border: none;
  }

  #no-signal {
    background-color: var(--primaryColor);
  }

  /* ── OSD ── */
  .osd-block {
    position: absolute;
    background: rgba(0, 0, 0, 0.55);
    border-radius: 6px;
    padding: 4px 8px;
    font-family: 'Courier New', monospace;
    font-size: 0.72rem;
    line-height: 1.5;
    color: #00ff88;
    backdrop-filter: blur(2px);
    min-width: 200px;
  }

  .osd-tl { top: 2.6rem; left: 0.5rem; }
  .osd-bl { bottom: 2.4rem; left: 0.5rem; }
  .osd-tr { top: 2.6rem; right: 0.5rem; }

  .osd-row {
    display: flex;
    gap: 0.4rem;
    align-items: baseline;
  }

  .osd-label {
    color: #88ddff;
    font-size: 0.66rem;
    min-width: 48px;
    text-transform: uppercase;
    opacity: 0.9;
  }

  .osd-val {
    color: #00ff88;
    font-weight: 600;
  }

  .osd-sep {
    color: #ffffff44;
    margin: 0 4px;
  }

  /* recording badge */
  .rec-badge {
    color: #ff4444;
    font-weight: 700;
    font-size: 0.75rem;
    min-width: unset;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .rec-dot {
    animation: blink 1s step-start infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }

  /* ── toolbar ── */
  .toolbar {
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  #live-feed-container:hover .toolbar,
  #live-feed-container:hover .caution-text {
    opacity: 1;
  }

  .tb-btn {
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--fontColor);
    background-color: rgb(from var(--primaryColor) r g b / 75%);
    border: none;
    cursor: pointer;
    font-size: 0.85rem;
    transition: opacity 0.2s;
  }

  .tb-btn:hover { opacity: 0.85; }

  .tb-btn-rec {
    background-color: rgba(220, 38, 38, 0.6);
  }

  /* Camera mode toggle button */
  .tb-mode-toggle {
    font-weight: 700;
    border: 2px solid rgba(255,255,255,0.3);
  }

  .tb-mode-photo {
    background-color: rgba(234, 179, 8, 0.6);  /* amber = photo */
    color: #fff;
  }

  .tb-mode-video {
    background-color: rgba(220, 38, 38, 0.5);  /* red = video */
    color: #fff;
  }

  .tab {
    border: 2px solid #3d393980;
  }

  .caution-text {
    color: var(--fontColor);
    background-color: rgb(from var(--primaryColor) r g b / 75%);
    border: 2px solid rgb(from var(--secondaryColor) r g b / 75%);
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  @media (max-width: 990px) {
    #live-feed-container { height: 300px; }
    .osd-block { font-size: 0.6rem; min-width: unset; }
  }

  /* ── Bottom-right OSD panel ── */
  .osd-br-panel {
    position: absolute;
    bottom: 2.4rem;
    right: 0.5rem;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    z-index: 35;
    pointer-events: all;
  }

  /* ── Mini Artificial Horizon ── */
  .mini-horizon {
    width: 220px;
    height: 124px;
    border-radius: 6px;
    overflow: hidden;
    border: 1.5px solid rgba(255,255,255,0.3);
    box-shadow: 0 0 10px rgba(0,0,0,0.6);
    background: #000;
    position: relative;
  }

  /* ── PFD full overlay — covers the entire live-feed container ── */
  .pfd-overlay {
    position: absolute;
    inset: 0;
    z-index: 45;           /* above video (z-20) and OSD (z-30) but below toolbar (z-40)... */
    /* we use z-45 so toolbar stays accessible */
    background: #000;
    display: flex;
  }

  /* ── Gimbal toggle button ── */
  .gimbal-toggle-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 16px;
    border-radius: 16px;
    background: rgba(0,0,0,0.65);
    color: #fff;
    border: 1px solid rgba(255,255,255,0.25);
    font-size: 0.95rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .gimbal-toggle-btn:hover {
    background: rgba(78,148,247,0.75);
  }

  /* ── Gimbal d-pad ── */
  .gimbal-dpad {
    background: rgba(0,0,0,0.72);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 10px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    backdrop-filter: blur(4px);
  }

  .dpad-info {
    display: flex;
    justify-content: space-around;
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
    color: #88ddff;
  }

  .dpad-grid {
    display: grid;
    grid-template-columns: repeat(3, 3.5rem);
    grid-template-rows: repeat(3, 3.5rem);
    gap: 5px;
  }

  .dpad-btn {
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 8px;
    background: rgba(255,255,255,0.12);
    color: #fff;
    border: 1px solid rgba(255,255,255,0.2);
    font-size: 1.3rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }

  .dpad-btn:hover {
    background: rgba(78,148,247,0.7);
  }

  .dpad-btn:active {
    background: rgba(78,148,247,1);
    transform: scale(0.92);
  }

  .dpad-center {
    background: rgba(255,255,255,0.08);
    color: #ffcc00;
  }

  .dpad-center:hover {
    background: rgba(255,204,0,0.4);
  }

  .dpad-alt-up {
    color: #4ade80;
    border-color: rgba(74,222,128,0.3);
  }

  .dpad-alt-up:hover { background: rgba(74,222,128,0.3); }

  .dpad-alt-down {
    color: #f87171;
    border-color: rgba(248,113,113,0.3);
  }

  .dpad-alt-down:hover { background: rgba(248,113,113,0.3); }

  /* Quick action buttons below dpad */
  .dpad-quick {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    margin-top: 4px;
  }

  .dpad-quick-btn {
    padding: 4px 6px;
    border-radius: 6px;
    background: rgba(255,255,255,0.1);
    color: #fff;
    border: 1px solid rgba(255,255,255,0.15);
    font-size: 0.7rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: background 0.15s;
  }

  .dpad-quick-btn:hover {
    background: rgba(78,148,247,0.5);
  }

  /* Altitude display */
  .dpad-alt-display {
    margin-top: 5px;
    text-align: center;
    font-family: 'Courier New', monospace;
    font-size: 0.8rem;
    color: #4ade80;
    background: rgba(0,0,0,0.4);
    padding: 3px 8px;
    border-radius: 6px;
  }
</style>
