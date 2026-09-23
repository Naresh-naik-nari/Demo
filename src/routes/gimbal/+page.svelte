<script lang="ts">
  import GimbalControl from '../../components/GimbalControl.svelte';
  import LiveFeed from '../../components/LiveFeed.svelte';
  import ConnectionStatus from '../../components/ConnectionStatus.svelte';
  import { secondaryColorStore } from '../../stores/customizationStore';

  $: secondaryColor = $secondaryColorStore;
</script>

<svelte:head>
  <title>Gimbal & Camera Control - GCS</title>
</svelte:head>

<div class="gimbal-page-container h-full flex items-center justify-center min-h-[95vh] p-0">
  <div
    class="gimbal-page w-full grid grid-cols-12 grid-rows-8 gap-4 p-5 rounded-[30px] rounded-l-none overflow-auto h-[90vh] max-h-[720px]"
    style="--secondaryColor: {secondaryColor}"
  >
    <!-- Connection Status -->
    <div class="connection-status-panel col-span-12 row-span-1">
      <ConnectionStatus />
    </div>

    <!-- Live Feed (left side) -->
    <div class="live-feed col-span-6 row-span-7">
      <LiveFeed />
    </div>

    <!-- Gimbal Controls (right side) -->
    <div class="gimbal-controls col-span-6 row-span-7">
      <GimbalControl />
    </div>
  </div>
</div>

<style>
  .gimbal-page-container {
    background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
  }

  .gimbal-page {
    background-color: var(--secondaryColor);
  }

  .connection-status-panel,
  .live-feed,
  .gimbal-controls {
    border-radius: 1rem;
    overflow: hidden;
  }

  /* Mobile Styles */
  @media (max-width: 990px) {
    .gimbal-page-container {
      min-height: fit-content;
      max-height: fit-content;
    }

    .gimbal-page {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 0.7em;
      height: 100%;
      max-height: 100%;
      border-radius: 0;
      overflow: auto;
      padding-bottom: 5em;
    }

    .gimbal-page > * {
      width: 100%;
      display: block;
    }

    .live-feed {
      min-height: 300px;
    }

    .gimbal-controls {
      min-height: 400px;
    }
  }
</style>
