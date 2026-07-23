<script lang="ts">
  import '@fortawesome/fontawesome-free/css/all.min.css';
  import { onMount, onDestroy } from 'svelte';
  import Modal from './Modal.svelte';
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
    mavGimbalZoomStore
  } from '../stores/mavlinkStore';

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
  // The stream is cross-origin (MediaMTX, port configured via VITE_VIDEO_PORT in .env),
  // so captureStream() on the iframe is blocked by the browser's same-origin policy.
  // which lets the user pick the browser tab/window to record.
  let isRecording   = false;
  let mediaRecorder: MediaRecorder | null = null;
  let recordedChunks: Blob[] = [];
  let recordingDuration = 0;
  let recordingTimer: ReturnType<typeof setInterval> | null = null;

  function formatDuration(s: number) {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
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
      recordingTimer = setInterval(() => { recordingDuration += 1; }, 1000);
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
    const blob = new Blob(recordedChunks, { type: recordedChunks[0].type });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const ts   = new Date().toISOString().replace(/[:.]/g, '-');
    a.href     = url;
    a.download = `gcs-recording-${ts}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    recordedChunks = [];
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

    // Check production flag via same-origin API (no CORS issue)
    fetch('/api/mavlink/heartbeat', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      .then((res) => { if (res.ok) isProduction = res.headers.get('isProduction') === 'true'; })
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
    </div>

    <!-- ── Live badge ── -->
    <div class="tab absolute top-2 left-2 bg-[#f24e4eb9] text-[#ffffff] text-md px-2 py-1 rounded-full z-40">Live Feed</div>

    <!-- ── Caution text ── -->
    <div class="caution-text opacity-[50%] text-md absolute bottom-2 left-2 bg-[#252525cf] px-2 py-1 mr-[0.5em] rounded-full z-40">
      Use Caution: The feed may be slightly delayed.
    </div>

    <!-- ── Controls toolbar ── -->
    <div class="toolbar absolute top-2 right-2 flex gap-1 z-40">
      <!-- Photo capture -->
      <button class="tb-btn" title="Capture Photo" on:click={capturePhoto}>
        <i class="fas fa-camera"></i>
      </button>

      <!-- Record toggle -->
      {#if isRecording}
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
</style>
