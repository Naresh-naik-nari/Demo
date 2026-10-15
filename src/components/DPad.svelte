<script lang="ts">
  import { mavModeStore, mavAltitudeStore } from '../stores/mavlinkStore';
  import { get } from 'svelte/store';
  import { primaryColorStore, tertiaryColorStore } from '../stores/customizationStore';
  import { sendCommand, setPositionLocal as apiSetPositionLocal } from '$lib/api/mavlink';

  let altitude: number = get(mavAltitudeStore);

  $: primaryColor = $primaryColorStore;
  $: tertiaryColor = $tertiaryColorStore;
  $: mavMode = $mavModeStore;
  $: altitude = $mavAltitudeStore;

  /** Only GUIDED accepts SET_POSITION_TARGET_LOCAL_NED from the GCS. */
  $: canMove = mavMode === 'GUIDED';

  /**
   * Sends a lateral position offset in the NED frame.
   * z is negative altitude (NED: down is positive) so we negate the current
   * altitude to hold it while moving horizontally.
   * Does NOT auto-switch modes — that would silently override the pilot's chosen mode.
   */
  async function moveLocal(x: number, y: number) {
    if (!canMove) {
      console.warn(`[DPad] Position commands only accepted in GUIDED mode (current: ${mavMode})`);
      return;
    }
    try {
      await apiSetPositionLocal(x, y, -altitude);
    } catch (err) {
      console.error('[DPad] moveLocal failed:', err);
    }
  }
</script>

<div class="dpad-container relative flex items-center justify-center w-48 h-48">
  <nav class="d-pad relative" style="--tertiaryColor: {tertiaryColor}"
    title={canMove ? '' : `Switch to GUIDED mode to use directional controls (current: ${mavMode})`}
  >
    <button class="up" disabled={!canMove} on:click={() => moveLocal(10, 0)}>
      <i class="fas fa-chevron-up"></i>
    </button>
    <button class="right" disabled={!canMove} on:click={() => moveLocal(0, 10)}>
      <i class="fas fa-chevron-right"></i>
    </button>
    <button class="down" disabled={!canMove} on:click={() => moveLocal(-10, 0)}>
      <i class="fas fa-chevron-down"></i>
    </button>
    <button class="left" disabled={!canMove} on:click={() => moveLocal(0, -10)}>
      <i class="fas fa-chevron-left"></i>
    </button>
    <div class="center-circle">
      <span class="move-text">{canMove ? 'Move' : mavMode}</span>
    </div>
  </nav>
</div>

<style>
  .dpad-container {
    width: fit-content;
    margin: auto;
  }

  .d-pad {
    position: relative;
    width: 200px;
    height: 200px;
    border-radius: 50%;
    background: var(--tertiaryColor);
    border: 4px solid var(--secondaryColor);
    overflow: hidden;
  }

  .up, .down, .left, .right {
    width: 30%;
    height: 30%;
    transform: translate(-50%) rotate(45deg);
  }

  .d-pad button {
    position: absolute;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #ffffff;
    font-size: 24px;
    transition: all 0.2s ease;
  }

  .d-pad button i {
    transform: rotate(-45deg);
  }

  .d-pad button.up {
    top: 0;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
  }

  .d-pad button.right {
    top: 50%;
    right: 0;
    transform: translateY(-50%) rotate(45deg);
  }

  .d-pad button.down {
    bottom: 0;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
  }

  .d-pad button.left {
    top: 50%;
    left: 0;
    transform: translateY(-50%) rotate(45deg);
  }

  .d-pad button:hover.up {
    top: -5px;
  }

  .d-pad button:hover.right {
    right: -5px;
  }

  .d-pad button:hover.down {
    bottom: -5px;
  }

  .d-pad button:hover.left {
    left: -5px;
  }

  .d-pad button:hover {
    color: #4e94f7;
  }

  .center-circle {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 60px;
    height: 60px;
    background-color: var(--primaryColor);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .move-text {
    font-size: 10pt;
    color: var(--fontColor);
  }
  
  /* Mobile Styles */
  @media (max-width: 990px) {
    .dpad-container {
      width: auto;
    }

    .d-pad {
      width: 150px;
      height: 150px;
    }

    .d-pad button {
      font-size: 20px;
    }

    .center-circle {
      width: 50px;
      height: 50px;
    }

    .move-text {
      font-size: 1rem;
    }
  }
</style>
