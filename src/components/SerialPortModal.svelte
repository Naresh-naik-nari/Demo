<script lang="ts">
  import { onMount } from 'svelte';
  import {
    darkModeStore,
    primaryColorStore,
    secondaryColorStore,
    tertiaryColorStore
  } from '../stores/customizationStore';

  export let isOpen = false;
  export let onClose: () => void;
  export let onSelectPort: (port: string) => void;

  interface SerialPortInfo {
    path: string;
    manufacturer?: string;
    serialNumber?: string;
  }

  let ports: SerialPortInfo[] = [];
  let loading = true;
  let selectedPortPath: string | null = null;

  $: darkMode = $darkModeStore;
  $: primaryColor = $primaryColorStore;
  $: secondaryColor = $secondaryColorStore;
  $: tertiaryColor = $tertiaryColorStore;
  $: fontColor = darkMode ? '#ffffff' : '#000000';

  async function loadPorts() {
    loading = true;
    try {
      const response = await fetch('/api/mavlink/list_ports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        ports = await response.json();
      } else {
        console.error('Failed to load ports:', response.status);
      }
    } catch (error) {
      console.error('Error loading ports:', error);
    } finally {
      loading = false;
    }
  }

  function handleSelectPort(portPath: string) {
    selectedPortPath = portPath;
  }

  async function handleConnect() {
    if (!selectedPortPath) return;
    try {
      const response = await fetch('/api/mavlink/select_port', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'port': selectedPortPath }
      });
      if (response.ok) {
        onSelectPort(selectedPortPath);
        onClose();
      }
    } catch (error) {
      console.error('Error selecting port:', error);
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }

  onMount(() => { if (isOpen) loadPorts(); });
  $: if (isOpen) loadPorts();
</script>

{#if isOpen}
<div
  class="modal-backdrop"
  on:click={handleBackdropClick}
  on:keydown={(e) => e.key === 'Escape' && onClose()}
  role="button"
  tabindex="0"
>
  <div class="modal-content" style="--primaryColor: {primaryColor}; --secondaryColor: {secondaryColor}; --tertiaryColor: {tertiaryColor}; --fontColor: {fontColor};">
    <div class="modal-header">
      <h2 class="text-2xl font-bold">Select Serial Port</h2>
      <button class="close-btn" on:click={onClose} aria-label="Close">
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="modal-body">
      {#if loading}
        <div class="loading">
          <i class="fas fa-spinner fa-spin"></i> Scanning for ports...
        </div>
      {:else if ports.length === 0}
        <div class="no-ports">
          <i class="fas fa-exclamation-triangle"></i>
          <p>No serial ports detected</p>
          <p class="text-sm mt-2">Please connect your USB device and try again</p>
          <button class="refresh-btn mt-4" on:click={loadPorts}>
            <i class="fas fa-refresh"></i> Refresh
          </button>
        </div>
      {:else}
        <div class="ports-list">
          {#each ports as port}
            <button
              class="port-item {selectedPortPath === port.path ? 'selected' : ''}"
              on:click={() => handleSelectPort(port.path)}
            >
              <div class="port-icon"><i class="fas fa-usb"></i></div>
              <div class="port-info">
                <div class="port-path">{port.path}</div>
                {#if port.manufacturer}
                  <div class="port-detail">{port.manufacturer}</div>
                {/if}
                {#if port.serialNumber}
                  <div class="port-detail">S/N: {port.serialNumber}</div>
                {/if}
              </div>
              {#if selectedPortPath === port.path}
                <i class="fas fa-check-circle selected-icon"></i>
              {/if}
            </button>
          {/each}
        </div>
        <div class="actions">
          <button class="refresh-btn" on:click={loadPorts}>
            <i class="fas fa-refresh"></i> Refresh
          </button>
          <button class="connect-btn" on:click={handleConnect} disabled={!selectedPortPath}>
            <i class="fas fa-plug"></i> Connect
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>
{/if}

<style>
  .modal-backdrop {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background-color: rgba(0,0,0,0.7);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000;
  }
  .modal-content {
    background-color: var(--primaryColor);
    color: var(--fontColor);
    border: 2px solid var(--secondaryColor);
    border-radius: 12px;
    min-width: 400px; max-width: 600px; max-height: 80vh;
    display: flex; flex-direction: column;
    box-shadow: 0 10px 40px rgba(0,0,0,0.4);
  }
  .modal-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1.5rem;
    border-bottom: 2px solid var(--secondaryColor);
  }
  .close-btn {
    background: none; border: none; color: var(--fontColor);
    font-size: 1.5rem; cursor: pointer; padding: 0.5rem;
    opacity: 0.7; transition: opacity 0.2s;
  }
  .close-btn:hover { opacity: 1; }
  .modal-body { padding: 1.5rem; overflow-y: auto; }
  .loading { text-align: center; padding: 2rem; font-size: 1.1rem; }
  .no-ports { text-align: center; padding: 2rem; }
  .no-ports i { font-size: 3rem; color: #f59e0b; margin-bottom: 1rem; display: block; }
  .ports-list { max-height: 400px; overflow-y: auto; margin-bottom: 1rem; }
  .port-item {
    display: flex; align-items: center; gap: 1rem;
    padding: 1rem; margin-bottom: 0.5rem;
    background-color: var(--secondaryColor);
    border: 2px solid transparent; border-radius: 8px;
    cursor: pointer; transition: all 0.2s;
    width: 100%; text-align: left; color: var(--fontColor);
  }
  .port-item:hover { background-color: var(--tertiaryColor); border-color: #3b82f6; }
  .port-item.selected { background-color: var(--tertiaryColor); border-color: #10b981; }
  .port-icon { font-size: 2rem; color: #3b82f6; }
  .port-info { flex: 1; }
  .port-path { font-weight: bold; font-size: 1.1rem; margin-bottom: 0.25rem; }
  .port-detail { font-size: 0.85rem; opacity: 0.7; }
  .selected-icon { font-size: 1.5rem; color: #10b981; }
  .actions { display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1rem; }
  .refresh-btn, .connect-btn {
    padding: 0.75rem 1.5rem; border-radius: 6px;
    font-weight: 600; cursor: pointer; transition: all 0.2s; border: none;
  }
  .refresh-btn { background-color: var(--tertiaryColor); color: var(--fontColor); }
  .refresh-btn:hover { opacity: 0.8; }
  .connect-btn { background-color: #10b981; color: white; }
  .connect-btn:hover:not(:disabled) { background-color: #059669; }
  .connect-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  @media (max-width: 640px) {
    .modal-content { min-width: unset; width: 90vw; max-height: 90vh; }
  }
</style>
