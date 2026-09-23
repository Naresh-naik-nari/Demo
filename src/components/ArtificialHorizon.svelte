<script lang="ts">
  import { onMount } from 'svelte';
  import { mavHeadingStore } from '../stores/mavlinkStore';
  import {
    darkModeStore,
    primaryColorStore,
    secondaryColorStore,
    tertiaryColorStore
  } from '../stores/customizationStore';

  export let pitch: number = 0;  // degrees, positive = nose up
  export let roll: number = 0;   // degrees, positive = right wing down
  export let heading: number = 0; // degrees
  export let size: 'small' | 'medium' | 'large' = 'medium';

  $: mavHeading = $mavHeadingStore;
  $: darkMode = $darkModeStore;
  $: primaryColor = $primaryColorStore;
  $: secondaryColor = $secondaryColorStore;
  $: tertiaryColor = $tertiaryColorStore;
  $: fontColor = darkMode ? '#ffffff' : '#000000';

  // Update heading from store
  $: heading = mavHeading;

  // Size configurations
  const sizes = {
    small: { width: 150, height: 150, scale: 0.7 },
    medium: { width: 200, height: 200, scale: 1 },
    large: { width: 300, height: 300, scale: 1.3 }
  };

  $: sizeConfig = sizes[size];

  // Calculate pitch offset for display (pixels per degree)
  $: pitchOffset = pitch * 2.5; // 2.5 pixels per degree

  // Helper to get cardinal direction
  function getCardinalDirection(degrees: number): string {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((degrees % 360) / 45)) % 8;
    return directions[index];
  }
</script>

<div class="artificial-horizon-container" 
  style="--width: {sizeConfig.width}px; --height: {sizeConfig.height}px; --scale: {sizeConfig.scale}; --fontColor: {fontColor};">
  
  <!-- Outer frame -->
  <div class="horizon-frame">
    <!-- Rotating horizon (roll) -->
    <div class="horizon-rotate" style="transform: rotate({roll}deg);">
      <!-- Sky and ground with pitch -->
      <div class="horizon-translate" style="transform: translateY({pitchOffset}px);">
        <!-- Sky -->
        <div class="sky"></div>
        
        <!-- Horizon line -->
        <div class="horizon-line">
          <div class="horizon-tick left"></div>
          <div class="horizon-tick right"></div>
        </div>
        
        <!-- Ground -->
        <div class="ground"></div>

        <!-- Pitch ladder -->
        <div class="pitch-ladder">
          {#each [-30, -20, -10, 0, 10, 20, 30] as pitchMark}
            <div class="pitch-mark" style="top: {50 - (pitchMark * 2.5 / 10)}%;">
              {#if pitchMark !== 0}
                <span class="pitch-label left">{Math.abs(pitchMark)}°</span>
                <div class="pitch-line" class:dashed={pitchMark % 20 !== 0}></div>
                <span class="pitch-label right">{Math.abs(pitchMark)}°</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Fixed aircraft symbol (center) -->
    <div class="aircraft-symbol">
      <div class="aircraft-wing left"></div>
      <div class="aircraft-center"></div>
      <div class="aircraft-wing right"></div>
    </div>

    <!-- Roll indicators (fixed) -->
    <div class="roll-indicators">
      <!-- Roll scale marks -->
      {#each [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60] as rollMark}
        <div class="roll-mark" 
          style="transform: rotate({rollMark}deg);"
          class:major={rollMark % 30 === 0}>
          <div class="roll-tick" class:large={rollMark % 30 === 0}></div>
          {#if rollMark % 30 === 0 && rollMark !== 0}
            <span class="roll-label">{Math.abs(rollMark)}</span>
          {/if}
        </div>
      {/each}
      
      <!-- Roll pointer (rotates with aircraft) -->
      <div class="roll-pointer" style="transform: rotate({roll}deg);">
        <div class="roll-arrow"></div>
      </div>
    </div>

    <!-- Fixed center dot -->
    <div class="center-dot"></div>
  </div>

  <!-- Info displays -->
  <div class="info-display">
    <div class="info-item pitch-display">
      <span class="info-label">PITCH</span>
      <span class="info-value">{pitch.toFixed(1)}°</span>
    </div>
    <div class="info-item roll-display">
      <span class="info-label">ROLL</span>
      <span class="info-value">{roll.toFixed(1)}°</span>
    </div>
    <div class="info-item heading-display">
      <span class="info-label">HDG</span>
      <span class="info-value">{heading.toFixed(0)}° {getCardinalDirection(heading)}</span>
    </div>
  </div>
</div>

<style>
  .artificial-horizon-container {
    position: relative;
    width: var(--width);
    height: var(--height);
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: 'Courier New', monospace;
    user-select: none;
  }

  .horizon-frame {
    position: relative;
    width: calc(var(--width) * 0.9);
    height: calc(var(--width) * 0.9);
    border-radius: 50%;
    overflow: hidden;
    background: #000;
    border: 3px solid #333;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5), inset 0 0 30px rgba(0, 0, 0, 0.8);
  }

  .horizon-rotate {
    position: absolute;
    width: 300%;
    height: 300%;
    top: -100%;
    left: -100%;
    transition: transform 0.3s ease-out;
  }

  .horizon-translate {
    position: relative;
    width: 100%;
    height: 100%;
    transition: transform 0.3s ease-out;
  }

  .sky {
    position: absolute;
    width: 100%;
    height: 50%;
    background: linear-gradient(to bottom, #0066cc 0%, #4da6ff 100%);
    top: 0;
  }

  .ground {
    position: absolute;
    width: 100%;
    height: 50%;
    background: linear-gradient(to bottom, #8B4513 0%, #654321 100%);
    bottom: 0;
  }

  .horizon-line {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 3px;
    background: #fff;
    transform: translateY(-50%);
    box-shadow: 0 0 5px rgba(255, 255, 255, 0.8);
  }

  .horizon-tick {
    position: absolute;
    width: 40px;
    height: 3px;
    background: #fff;
    top: 50%;
    transform: translateY(-50%);
  }

  .horizon-tick.left {
    left: 0;
  }

  .horizon-tick.right {
    right: 0;
  }

  /* Pitch ladder */
  .pitch-ladder {
    position: absolute;
    width: 100%;
    height: 200%;
    top: -50%;
  }

  .pitch-mark {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 80%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pitch-line {
    flex: 1;
    height: 2px;
    background: #fff;
    max-width: 30%;
    margin: 0 10px;
  }

  .pitch-line.dashed {
    background: repeating-linear-gradient(
      to right,
      #fff 0px,
      #fff 8px,
      transparent 8px,
      transparent 16px
    );
  }

  .pitch-label {
    color: #fff;
    font-size: calc(10px * var(--scale));
    font-weight: bold;
    text-shadow: 0 0 3px #000;
    min-width: 30px;
    text-align: center;
  }

  /* Aircraft symbol */
  .aircraft-symbol {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    z-index: 10;
  }

  .aircraft-wing {
    width: calc(50px * var(--scale));
    height: 4px;
    background: #ffcc00;
    box-shadow: 0 0 5px rgba(255, 204, 0, 0.8);
  }

  .aircraft-center {
    width: calc(12px * var(--scale));
    height: calc(12px * var(--scale));
    background: #ffcc00;
    border: 2px solid #000;
    border-radius: 50%;
    margin: 0 -2px;
    box-shadow: 0 0 8px rgba(255, 204, 0, 1);
  }

  .center-dot {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 6px;
    height: 6px;
    background: #ff0;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    z-index: 11;
    box-shadow: 0 0 5px #ff0;
  }

  /* Roll indicators */
  .roll-indicators {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
  }

  .roll-mark {
    position: absolute;
    top: 3%;
    left: 50%;
    transform-origin: 50% calc(var(--width) * 0.45);
    height: calc(var(--width) * 0.45);
  }

  .roll-tick {
    width: 2px;
    height: 10px;
    background: #fff;
    margin: 0 auto;
  }

  .roll-tick.large {
    height: 15px;
    width: 3px;
    background: #ffcc00;
  }

  .roll-label {
    display: block;
    text-align: center;
    color: #fff;
    font-size: calc(9px * var(--scale));
    font-weight: bold;
    margin-top: 2px;
    text-shadow: 0 0 3px #000;
  }

  .roll-pointer {
    position: absolute;
    top: 1%;
    left: 50%;
    transform-origin: 50% calc(var(--width) * 0.45);
    transition: transform 0.3s ease-out;
  }

  .roll-arrow {
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 12px solid #ffcc00;
    margin-left: -8px;
    filter: drop-shadow(0 0 3px rgba(255, 204, 0, 0.8));
  }

  /* Info displays */
  .info-display {
    display: flex;
    gap: 15px;
    margin-top: 10px;
    justify-content: center;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(0, 0, 0, 0.7);
    padding: 5px 10px;
    border-radius: 5px;
    border: 1px solid #333;
    min-width: 70px;
  }

  .info-label {
    font-size: calc(9px * var(--scale));
    color: #999;
    font-weight: bold;
    margin-bottom: 2px;
  }

  .info-value {
    font-size: calc(13px * var(--scale));
    color: #4da6ff;
    font-weight: bold;
  }

  .heading-display .info-value {
    color: #ffcc00;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .info-display {
      flex-direction: column;
      gap: 5px;
    }
  }
</style>
