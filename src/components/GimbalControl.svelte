<script lang="ts">
  import { onMount } from 'svelte';
  import { mavGimbalStore } from '../stores/mavlinkStore';
  import {
    darkModeStore,
    primaryColorStore,
    secondaryColorStore,
    tertiaryColorStore
  } from '../stores/customizationStore';

  // Gimbal state
  let gimbalPitch = 0;  // -90 to 0 degrees (down to forward)
  let gimbalRoll = 0;   // -45 to 45 degrees
  let gimbalYaw = 0;    // -180 to 180 degrees
  let zoom = 1;         // 1x to 30x
  let isRecording = false;
  let eoirEnabled = true; // EO/IR toggle
  
  // Input values
  let pitchInput = '';
  let yawInput = '';
  let zoomInput = '';

  $: darkMode = $darkModeStore;
  $: primaryColor = $primaryColorStore;
  $: secondaryColor = $secondaryColorStore;
  $: tertiaryColor = $tertiaryColorStore;
  $: fontColor = darkMode ? '#ffffff' : '#000000';
  $: gimbalData = $mavGimbalStore;

  // Update local state from store
  $: {
    if (gimbalData) {
      gimbalPitch = gimbalData.pitch || 0;
      gimbalRoll = gimbalData.roll || 0;
      gimbalYaw = gimbalData.yaw || 0;
      zoom = gimbalData.zoom || 1;
    }
  }

  async function sendGimbalCommand(pitch: number, roll: number, yaw: number) {
    // MAV_CMD_DO_MOUNT_CONTROL (205)
    // param1: pitch (degrees)
    // param2: roll (degrees)
    // param3: yaw (degrees)
    // param4-6: reserved
    // param7: MAV_MOUNT_MODE (2 = MAVLink targeting angle)
    const response = await fetch(`/api/mavlink/send_command`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'command': 'DO_MOUNT_CONTROL',
        'params': `${pitch},${roll},${yaw},0,0,0,2`,
        'useCmdLong': 'true'
      },
    });
    
    if (response.ok) {
      console.log(`Gimbal set: pitch=${pitch}°, roll=${roll}°, yaw=${yaw}°`);
    } else {
      console.error('Failed to set gimbal position');
    }
  }

  async function setZoom(zoomLevel: number) {
    // MAV_CMD_SET_CAMERA_ZOOM (531)
    // param1: zoom type (0=step, 1=continuous, 2=range, 3=focal length)
    // param2: zoom value
    const response = await fetch(`/api/mavlink/send_command`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'command': 'SET_CAMERA_ZOOM',
        'params': `2,${zoomLevel},0,0,0,0,0`,
        'useCmdLong': 'true'
      },
    });
    
    if (response.ok) {
      console.log(`Zoom set to ${zoomLevel}x`);
      zoom = zoomLevel;
    } else {
      console.error('Failed to set zoom');
    }
  }

  async function toggleRecording() {
    // MAV_CMD_VIDEO_START_CAPTURE (2500) or STOP (2501)
    const command = isRecording ? 'VIDEO_STOP_CAPTURE' : 'VIDEO_START_CAPTURE';
    
    const response = await fetch(`/api/mavlink/send_command`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'command': command,
        'params': isRecording ? '0,0,0,0,0,0,0' : '0,1,0,0,0,0,0', // param2=1 for status interval
        'useCmdLong': 'true'
      },
    });
    
    if (response.ok) {
      isRecording = !isRecording;
      console.log(isRecording ? 'Recording started' : 'Recording stopped');
    } else {
      console.error('Failed to toggle recording');
    }
  }

  async function captureImage() {
    // MAV_CMD_IMAGE_START_CAPTURE (2000)
    // param1: reserved
    // param2: capture interval (0 for single image)
    // param3: total images (1 for single)
    const response = await fetch(`/api/mavlink/send_command`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'command': 'IMAGE_START_CAPTURE',
        'params': '0,0,1,0,0,0,0',
        'useCmdLong': 'true'
      },
    });
    
    if (response.ok) {
      console.log('Image captured');
    } else {
      console.error('Failed to capture image');
    }
  }

  async function gimbalCenter() {
    await sendGimbalCommand(0, 0, 0);
  }

  async function gimbalDown() {
    await sendGimbalCommand(-90, 0, gimbalYaw);
  }

  function handleSetPosition() {
    const pitch = parseFloat(pitchInput);
    const yaw = parseFloat(yawInput);
    
    if (!isNaN(pitch) && pitch >= -90 && pitch <= 90) {
      gimbalPitch = pitch;
    }
    
    if (!isNaN(yaw) && yaw >= -180 && yaw <= 180) {
      gimbalYaw = yaw;
    }
    
    sendGimbalCommand(gimbalPitch, gimbalRoll, gimbalYaw);
    
    // Clear inputs
    pitchInput = '';
    yawInput = '';
  }

  function handleSetZoom() {
    const zoomLevel = parseFloat(zoomInput);
    
    if (!isNaN(zoomLevel) && zoomLevel >= 1 && zoomLevel <= 30) {
      setZoom(zoomLevel);
      zoomInput = '';
    }
  }

  // Incremental controls
  async function adjustPitch(delta: number) {
    gimbalPitch = Math.max(-90, Math.min(90, gimbalPitch + delta));
    await sendGimbalCommand(gimbalPitch, gimbalRoll, gimbalYaw);
  }

  async function adjustYaw(delta: number) {
    gimbalYaw = ((gimbalYaw + delta + 180) % 360) - 180; // Keep in -180 to 180 range
    await sendGimbalCommand(gimbalPitch, gimbalRoll, gimbalYaw);
  }

  async function adjustZoom(delta: number) {
    const newZoom = Math.max(1, Math.min(30, zoom + delta));
    await setZoom(newZoom);
  }
</script>

<div class="gimbal-control rounded-2xl p-6"
  style="--primaryColor: {primaryColor}; --secondaryColor: {secondaryColor}; --tertiaryColor: {tertiaryColor}; --fontColor: {fontColor};">
  
  <!-- Header with EO/IR Toggle -->
  <div class="header flex justify-between items-center mb-6">
    <h3 class="text-lg font-bold">
      <i class="fas fa-camera"></i>
      Gimbal & Camera Control
    </h3>
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2">
        <span class="text-sm">EO/IR</span>
        <label class="switch">
          <input type="checkbox" bind:checked={eoirEnabled} />
          <span class="slider"></span>
        </label>
        <span class="text-xs" class:text-green-400={eoirEnabled} class:text-gray-500={!eoirEnabled}>
          {eoirEnabled ? 'ON' : 'OFF'}
        </span>
      </div>
    </div>
  </div>

  <div class="grid-container">
    <!-- Current Status -->
    <div class="status-panel panel">
      <h4 class="panel-title">Current Position</h4>
      <div class="status-grid">
        <div class="status-item">
          <span class="status-label">Pitch:</span>
          <span class="status-value">{gimbalPitch.toFixed(1)}°</span>
        </div>
        <div class="status-item">
          <span class="status-label">Yaw:</span>
          <span class="status-value">{gimbalYaw.toFixed(1)}°</span>
        </div>
        <div class="status-item">
          <span class="status-label">Zoom:</span>
          <span class="status-value">{zoom.toFixed(1)}x</span>
        </div>
        <div class="status-item">
          <span class="status-label">Roll:</span>
          <span class="status-value">{gimbalRoll.toFixed(1)}°</span>
        </div>
      </div>
    </div>

    <!-- Pan/Tilt Controls -->
    <div class="control-panel panel">
      <h4 class="panel-title">Pan/Tilt</h4>
      <div class="joystick-container">
        <!-- Tilt Up -->
        <button class="joystick-btn tilt-up" on:click={() => adjustPitch(5)} title="Tilt Up 5°">
          <i class="fas fa-chevron-up"></i>
        </button>
        
        <!-- Center Control -->
        <div class="joystick-center-row">
          <!-- Pan Left -->
          <button class="joystick-btn pan-left" on:click={() => adjustYaw(-15)} title="Pan Left 15°">
            <i class="fas fa-chevron-left"></i>
          </button>
          
          <!-- Center Button -->
          <button class="joystick-btn center" on:click={gimbalCenter} title="Center Gimbal">
            <i class="fas fa-bullseye"></i>
          </button>
          
          <!-- Pan Right -->
          <button class="joystick-btn pan-right" on:click={() => adjustYaw(15)} title="Pan Right 15°">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
        
        <!-- Tilt Down -->
        <button class="joystick-btn tilt-down" on:click={() => adjustPitch(-5)} title="Tilt Down 5°">
          <i class="fas fa-chevron-down"></i>
        </button>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <button class="quick-btn" on:click={gimbalCenter}>
          <i class="fas fa-crosshairs"></i> Center
        </button>
        <button class="quick-btn" on:click={gimbalDown}>
          <i class="fas fa-arrow-down"></i> Down
        </button>
      </div>
    </div>

    <!-- Zoom Controls -->
    <div class="zoom-panel panel">
      <h4 class="panel-title">Zoom Control</h4>
      <div class="zoom-controls">
        <button class="zoom-btn" on:click={() => adjustZoom(-1)} title="Zoom Out">
          <i class="fas fa-search-minus"></i>
        </button>
        
        <div class="zoom-display">
          <div class="zoom-value">{zoom.toFixed(1)}x</div>
          <input 
            type="range" 
            min="1" 
            max="30" 
            step="0.5"
            value={zoom}
            on:input={(e) => setZoom(parseFloat(e.currentTarget.value))}
            class="zoom-slider"
          />
        </div>
        
        <button class="zoom-btn" on:click={() => adjustZoom(1)} title="Zoom In">
          <i class="fas fa-search-plus"></i>
        </button>
      </div>
    </div>

    <!-- Recording Controls -->
    <div class="recording-panel panel">
      <h4 class="panel-title">Recording</h4>
      <div class="recording-controls">
        <button 
          class="record-btn"
          class:recording={isRecording}
          on:click={toggleRecording}
        >
          <i class="fas {isRecording ? 'fa-stop' : 'fa-circle'}"></i>
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
        
        <button class="capture-btn" on:click={captureImage}>
          <i class="fas fa-camera"></i>
          Capture Image
        </button>
      </div>
    </div>

    <!-- Manual Input Panel -->
    <div class="manual-panel panel">
      <h4 class="panel-title">Manual Input</h4>
      <div class="manual-inputs">
        <div class="input-group">
          <label>Pitch (-90° to 90°)</label>
          <div class="input-row">
            <input 
              type="number" 
              bind:value={pitchInput}
              placeholder="0"
              min="-90"
              max="90"
              step="1"
            />
          </div>
        </div>
        
        <div class="input-group">
          <label>Yaw (-180° to 180°)</label>
          <div class="input-row">
            <input 
              type="number" 
              bind:value={yawInput}
              placeholder="0"
              min="-180"
              max="180"
              step="1"
            />
          </div>
        </div>
        
        <div class="input-group">
          <label>Zoom (1x to 30x)</label>
          <div class="input-row">
            <input 
              type="number" 
              bind:value={zoomInput}
              placeholder="1"
              min="1"
              max="30"
              step="0.5"
            />
          </div>
        </div>
        
        <button class="set-btn" on:click={() => {
          handleSetPosition();
          handleSetZoom();
        }}>
          <i class="fas fa-check"></i> Apply
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .gimbal-control {
    background-color: var(--primaryColor);
    color: var(--fontColor);
    height: 100%;
  }

  .header {
    border-bottom: 2px solid var(--tertiaryColor);
    padding-bottom: 1rem;
  }

  .grid-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .panel {
    background-color: var(--secondaryColor);
    border: 1px solid var(--tertiaryColor);
    border-radius: 1rem;
    padding: 1.5rem;
  }

  .panel-title {
    font-size: 0.9rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: var(--fontColor);
    opacity: 0.8;
  }

  /* Status Panel */
  .status-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .status-label {
    font-size: 0.85rem;
    opacity: 0.7;
  }

  .status-value {
    font-size: 1.1rem;
    font-weight: 600;
    color: #4e94f7;
  }

  /* Joystick Controls */
  .joystick-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .joystick-center-row {
    display: flex;
    gap: 0.5rem;
  }

  .joystick-btn {
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 0.5rem;
    background-color: var(--tertiaryColor);
    color: white;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .joystick-btn:hover {
    background-color: #4e94f7;
    transform: scale(1.05);
  }

  .joystick-btn:active {
    transform: scale(0.95);
  }

  .joystick-btn.center {
    background-color: #374151;
  }

  /* Quick Actions */
  .quick-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
  }

  .quick-btn {
    flex: 1;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    background-color: var(--tertiaryColor);
    color: white;
    border: none;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
  }

  .quick-btn:hover {
    background-color: #4e94f7;
  }

  /* Zoom Controls */
  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .zoom-btn {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.5rem;
    background-color: var(--tertiaryColor);
    color: white;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .zoom-btn:hover {
    background-color: #4e94f7;
  }

  .zoom-display {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .zoom-value {
    text-align: center;
    font-size: 1.5rem;
    font-weight: 600;
    color: #4e94f7;
  }

  .zoom-slider {
    width: 100%;
    height: 0.5rem;
    border-radius: 0.25rem;
    background: var(--tertiaryColor);
    outline: none;
    -webkit-appearance: none;
  }

  .zoom-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    background: #4e94f7;
    cursor: pointer;
  }

  .zoom-slider::-moz-range-thumb {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    background: #4e94f7;
    cursor: pointer;
    border: none;
  }

  /* Recording Controls */
  .recording-controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .record-btn, .capture-btn {
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .record-btn {
    background-color: #ef4444;
    color: white;
  }

  .record-btn.recording {
    background-color: #dc2626;
    animation: pulse 1.5s infinite;
  }

  .record-btn:hover {
    background-color: #dc2626;
  }

  .capture-btn {
    background-color: var(--tertiaryColor);
    color: white;
  }

  .capture-btn:hover {
    background-color: #4e94f7;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  /* Manual Input Panel */
  .manual-inputs {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .input-group label {
    font-size: 0.85rem;
    opacity: 0.8;
  }

  .input-row {
    display: flex;
    gap: 0.5rem;
  }

  .input-row input {
    flex: 1;
    padding: 0.5rem;
    border-radius: 0.5rem;
    border: 1px solid var(--tertiaryColor);
    background-color: var(--primaryColor);
    color: var(--fontColor);
    font-size: 0.9rem;
  }

  .input-row input:focus {
    outline: none;
    border-color: #4e94f7;
  }

  .set-btn {
    padding: 0.75rem;
    border-radius: 0.5rem;
    background-color: #4e94f7;
    color: white;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  .set-btn:hover {
    background-color: #3b82f6;
  }

  /* EO/IR Toggle Switch */
  .switch {
    position: relative;
    display: inline-block;
    width: 3rem;
    height: 1.5rem;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #374151;
    transition: 0.4s;
    border-radius: 1.5rem;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 1.1rem;
    width: 1.1rem;
    left: 0.2rem;
    bottom: 0.2rem;
    background-color: white;
    transition: 0.4s;
    border-radius: 50%;
  }

  input:checked + .slider {
    background-color: #4e94f7;
  }

  input:checked + .slider:before {
    transform: translateX(1.5rem);
  }

  /* Responsive */
  @media (max-width: 1200px) {
    .grid-container {
      grid-template-columns: 1fr;
    }
  }
</style>
