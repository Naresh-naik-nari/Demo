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
  export let onConnect: (config: ConnectionConfig) => void;

  interface SerialPortInfo {
    path: string;
    manufacturer?: string;
    serialNumber?: string;
    vendorId?: string;
    productId?: string;
  }

  interface ConnectionConfig {
    type: 'serial' | 'tcp' | 'udp';
    port?: string;
    host?: string;
    portNumber?: number;
    bindPort?: number;
  }

  let connectionType: 'serial' | 'tcp' | 'udp' = 'serial';
  let ports: SerialPortInfo[] = [];
  let loading = true;
  let selectedPortPath: string | null = null;
  
  // Network settings
  let tcpHost = '192.168.1.100';
  let tcpPort = 5760;
  let udpHost = '192.168.1.100';
  let udpPort = 14550;
  let udpBindPort = 14550;

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
    let config: ConnectionConfig;
    
    if (connectionType === 'serial') {
      if (!selectedPortPath) return;
      config = { type: 'serial', port: selectedPortPath };
    } else if (connectionType === 'tcp') {
      config = { type: 'tcp', host: tcpHost, portNumber: tcpPort };
    } else {
      config = { type: 'udp', host: udpHost, portNumber: udpPort, bindPort: udpBindPort };
    }
    
    try {
      const response = await fetch('/api/mavlink/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (response.ok) {
        onConnect(config);
        onClose();
      } else {
        const error = await response.text();
        alert(`Connection failed: ${error}`);
      }
    } catch (error) {
      console.error('Error connecting:', error);
      alert(`Connection error: ${error}`);
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }

  onMount(() => { if (isOpen && connectionType === 'serial') loadPorts(); });
  $: if (isOpen && connectionType === 'serial') loadPorts();
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
        <i class="fas fa-plug"></i>
        Connect to Vehicle
      </h2>
      <button class="close-btn" on:click={onClose}>
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="modal-body">
      <!-- Connection Type Tabs -->
      <div class="connection-tabs">
        <button 
          class="tab-btn" 
          class:active={connectionType === 'serial'}
          on:click={() => connectionType = 'serial'}
        >
          <i class="fas fa-usb"></i>
          Serial (USB)
        </button>
        <button 
          class="tab-btn" 
          class:active={connectionType === 'tcp'}
          on:click={() => connectionType = 'tcp'}
        >
          <i class="fas fa-network-wired"></i>
          TCP
        </button>
        <button 
          class="tab-btn" 
          class:active={connectionType === 'udp'}
          on:click={() => connectionType = 'udp'}
        >
          <i class="fas fa-broadcast-tower"></i>
          UDP
        </button>
      </div>

      <!-- Serial Connection -->
      {#if connectionType === 'serial'}
        <div class="connection-content">
          <p class="hint">
            <i class="fas fa-info-circle"></i>
            Select a serial port to connect to your flight controller
          </p>
          
          {#if loading}
            <div class="loading">
              <i class="fas fa-spinner fa-spin"></i>
              Scanning ports...
            </div>
          {:else if ports.length === 0}
            <div class="no-ports">
              <i class="fas fa-exclamation-triangle"></i>
              <p>No serial ports detected</p>
              <p class="hint">Connect your flight controller and click refresh</p>
              <button class="btn btn-secondary" on:click={loadPorts}>
                <i class="fas fa-sync-alt"></i>
                Refresh
              </button>
            </div>
          {:else}
            <div class="port-list">
              {#each ports as port}
                <div 
                  class="port-item" 
                  class:selected={selectedPortPath === port.path}
                  on:click={() => handleSelectPort(port.path)}
                >
                  <div class="port-icon">
                    <i class="fas fa-microchip"></i>
                  </div>
                  <div class="port-details">
                    <div class="port-path">{port.path}</div>
                    {#if port.manufacturer}
                      <div class="port-manufacturer">{port.manufacturer}</div>
                    {/if}
                    {#if port.vendorId}
                      <div class="port-id">VID: {port.vendorId} {port.productId ? `PID: ${port.productId}` : ''}</div>
                    {/if}
                  </div>
                  {#if selectedPortPath === port.path}
                    <i class="fas fa-check-circle selected-icon"></i>
                  {/if}
                </div>
              {/each}
            </div>
            <button class="refresh-btn" on:click={loadPorts}>
              <i class="fas fa-sync-alt"></i>
              Refresh Ports
            </button>
          {/if}
        </div>
      {/if}

      <!-- TCP Connection -->
      {#if connectionType === 'tcp'}
        <div class="connection-content">
          <p class="hint">
            <i class="fas fa-info-circle"></i>
            Connect via TCP/IP to a flight controller on your network
          </p>
          
          <div class="network-form">
            <div class="form-group">
              <label for="tcp-host">IP Address / Hostname</label>
              <input 
                id="tcp-host"
                type="text" 
                bind:value={tcpHost}
                placeholder="192.168.1.100"
                class="network-input"
              />
            </div>
            
            <div class="form-group">
              <label for="tcp-port">Port</label>
              <input 
                id="tcp-port"
                type="number" 
                bind:value={tcpPort}
                placeholder="5760"
                class="network-input"
              />
            </div>
          </div>

          <div class="preset-connections">
            <p class="preset-label">Common Configurations:</p>
            <button class="preset-btn" on:click={() => { tcpHost = '192.168.1.1'; tcpPort = 5760; }}>
              WiFi Telemetry (192.168.1.1:5760)
            </button>
            <button class="preset-btn" on:click={() => { tcpHost = '127.0.0.1'; tcpPort = 5760; }}>
              Localhost SITL (127.0.0.1:5760)
            </button>
          </div>
        </div>
      {/if}

      <!-- UDP Connection -->
      {#if connectionType === 'udp'}
        <div class="connection-content">
          <p class="hint">
            <i class="fas fa-info-circle"></i>
            Connect via UDP to a flight controller or simulation
          </p>
          
          <div class="network-form">
            <div class="form-group">
              <label for="udp-host">Remote IP Address</label>
              <input 
                id="udp-host"
                type="text" 
                bind:value={udpHost}
                placeholder="192.168.1.100"
                class="network-input"
              />
              <span class="input-hint">IP address of the flight controller</span>
            </div>
            
            <div class="form-group">
              <label for="udp-port">Remote Port</label>
              <input 
                id="udp-port"
                type="number" 
                bind:value={udpPort}
                placeholder="14550"
                class="network-input"
              />
              <span class="input-hint">Port the flight controller is sending to</span>
            </div>

            <div class="form-group">
              <label for="udp-bind-port">Local Bind Port</label>
              <input 
                id="udp-bind-port"
                type="number" 
                bind:value={udpBindPort}
                placeholder="14550"
                class="network-input"
              />
              <span class="input-hint">Port to listen on (usually 14550)</span>
            </div>
          </div>

          <div class="preset-connections">
            <p class="preset-label">Common Configurations:</p>
            <button class="preset-btn" on:click={() => { udpHost = '192.168.1.1'; udpPort = 14550; udpBindPort = 14550; }}>
              WiFi Telemetry (192.168.1.1:14550)
            </button>
            <button class="preset-btn" on:click={() => { udpHost = '127.0.0.1'; udpPort = 14550; udpBindPort = 14551; }}>
              SITL (127.0.0.1:14550 → 14551)
            </button>
            <button class="preset-btn" on:click={() => { udpHost = '0.0.0.0'; udpPort = 14550; udpBindPort = 14550; }}>
              Listen All (0.0.0.0:14550)
            </button>
          </div>
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="btn btn-secondary" on:click={onClose}>
        Cancel
      </button>
      <button 
        class="btn btn-primary" 
        on:click={handleConnect}
        disabled={connectionType === 'serial' && !selectedPortPath}
      >
        <i class="fas fa-plug"></i>
        Connect
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
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
  }

  .modal-container {
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

  .modal-body {
    padding: 1.5rem;
    color: var(--fontColor);
  }

  .connection-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    border-bottom: 2px solid var(--tertiaryColor);
  }

  .tab-btn {
    flex: 1;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    border-bottom: 3px solid transparent;
    color: var(--fontColor);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 0.95rem;
    opacity: 0.6;
    transition: all 0.2s;
  }

  .tab-btn:hover {
    opacity: 0.8;
  }

  .tab-btn.active {
    opacity: 1;
    border-bottom-color: #3b82f6;
  }

  .connection-content {
    min-height: 200px;
  }

  .hint {
    font-size: 0.9rem;
    opacity: 0.8;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    font-size: 1.1rem;
  }

  .loading i {
    margin-right: 0.5rem;
  }

  .no-ports {
    text-align: center;
    padding: 2rem;
  }

  .no-ports i {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .port-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .port-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--secondaryColor);
    border: 2px solid var(--tertiaryColor);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .port-item:hover {
    border-color: #3b82f6;
  }

  .port-item.selected {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.1);
  }

  .port-icon {
    font-size: 1.5rem;
    color: #3b82f6;
  }

  .port-details {
    flex: 1;
  }

  .port-path {
    font-weight: 600;
    font-size: 1rem;
    margin-bottom: 0.25rem;
  }

  .port-manufacturer {
    font-size: 0.85rem;
    opacity: 0.8;
  }

  .port-id {
    font-size: 0.75rem;
    opacity: 0.6;
    font-family: monospace;
  }

  .selected-icon {
    color: #10b981;
    font-size: 1.25rem;
  }

  .refresh-btn {
    width: 100%;
    padding: 0.75rem;
    background: var(--secondaryColor);
    border: 1px solid var(--tertiaryColor);
    border-radius: 8px;
    color: var(--fontColor);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: opacity 0.2s;
  }

  .refresh-btn:hover {
    opacity: 0.8;
  }

  .network-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .network-input {
    padding: 0.75rem;
    background: var(--secondaryColor);
    border: 2px solid var(--tertiaryColor);
    border-radius: 8px;
    color: var(--fontColor);
    font-size: 1rem;
    transition: border-color 0.2s;
  }

  .network-input:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .input-hint {
    font-size: 0.8rem;
    opacity: 0.6;
  }

  .preset-connections {
    background: var(--secondaryColor);
    padding: 1rem;
    border-radius: 8px;
  }

  .preset-label {
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    opacity: 0.8;
  }

  .preset-btn {
    width: 100%;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    background: var(--primaryColor);
    border: 1px solid var(--tertiaryColor);
    border-radius: 6px;
    color: var(--fontColor);
    cursor: pointer;
    text-align: left;
    font-size: 0.9rem;
    transition: all 0.2s;
  }

  .preset-btn:last-child {
    margin-bottom: 0;
  }

  .preset-btn:hover {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.1);
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

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--tertiaryColor);
    color: var(--fontColor);
  }

  .btn-secondary:hover {
    opacity: 0.8;
  }

  @media (max-width: 768px) {
    .modal-container {
      max-width: 100%;
      margin: 0;
      border-radius: 0;
    }

    .connection-tabs {
      flex-direction: column;
    }

    .tab-btn {
      border-bottom: none;
      border-left: 3px solid transparent;
    }

    .tab-btn.active {
      border-left-color: #3b82f6;
      border-bottom-color: transparent;
    }
  }
</style>
