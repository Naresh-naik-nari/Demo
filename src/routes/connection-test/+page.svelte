<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { darkModeStore, primaryColorStore, secondaryColorStore, tertiaryColorStore } from '../../stores/customizationStore';
    
    let logs: string[] = [];
    let isConnected = false;
    let isConnecting = false;
    let connectionError = '';
    let messageCount = 0;
    let intervalId: NodeJS.Timeout;
    let autoScroll = true;
    
    $: darkMode = $darkModeStore;
    $: primaryColor = $primaryColorStore;
    $: secondaryColor = $secondaryColorStore;
    $: tertiaryColor = $tertiaryColorStore;
    $: textColor = $darkModeStore ? '#ffffff' : '#000000';
    
    async function testConnection() {
        isConnecting = true;
        connectionError = '';
        
        try {
            addLog('Testing MAVLink connection...');
            const response = await fetch('/api/mavlink/heartbeat', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
            });
            
            if (response.ok) {
                const data = await response.json();
                isConnected = true;
                
                if (data && data.length > 0) {
                    addLog(`✅ Connection successful! Received ${data.length} messages`);
                    messageCount += data.length;
                    
                    // Log first few messages
                    data.slice(0, 5).forEach((msg: string) => {
                        addLog(`📨 ${msg}`);
                    });
                    
                    if (data.length > 5) {
                        addLog(`... and ${data.length - 5} more messages`);
                    }
                } else {
                    addLog('⏳ Connection established, waiting for data...');
                }
            } else {
                const errorText = await response.text();
                connectionError = errorText;
                addLog(`❌ Connection failed: ${errorText}`);
                isConnected = false;
            }
        } catch (err: any) {
            connectionError = err.message;
            addLog(`❌ Error: ${err.message}`);
            isConnected = false;
        } finally {
            isConnecting = false;
        }
    }
    
    async function startMonitoring() {
        addLog('🔄 Starting continuous monitoring...');
        intervalId = setInterval(async () => {
            try {
                const response = await fetch('/api/mavlink/heartbeat', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.length > 0) {
                        isConnected = true;
                        messageCount += data.length;
                        addLog(`📊 Received ${data.length} messages (Total: ${messageCount})`);
                        
                        // Show latest message types
                        const messageTypes = new Set(
                            data.map((msg: string) => msg.split('(')[0])
                        );
                        addLog(`   Types: ${Array.from(messageTypes).join(', ')}`);
                    }
                }
            } catch (err: any) {
                addLog(`⚠️ Monitoring error: ${err.message}`);
            }
        }, 2000);
    }
    
    function stopMonitoring() {
        if (intervalId) {
            clearInterval(intervalId);
            addLog('⏹️ Monitoring stopped');
        }
    }
    
    function addLog(message: string) {
        const timestamp = new Date().toLocaleTimeString();
        logs = [...logs, `[${timestamp}] ${message}`];
        
        if (autoScroll) {
            setTimeout(() => {
                const logContainer = document.getElementById('log-container');
                if (logContainer) {
                    logContainer.scrollTop = logContainer.scrollHeight;
                }
            }, 10);
        }
    }
    
    function clearLogs() {
        logs = [];
        messageCount = 0;
        addLog('📝 Logs cleared');
    }
    
    function copyLogs() {
        const logText = logs.join('\n');
        navigator.clipboard.writeText(logText);
        addLog('📋 Logs copied to clipboard');
    }
    
    onMount(() => {
        addLog('🚀 Connection Test Tool initialized');
        addLog('ℹ️ Click "Test Connection" to check USB connection');
        addLog(`ℹ️ Environment: ${import.meta.env.MODE}`);
    });
    
    onDestroy(() => {
        stopMonitoring();
    });
</script>

<svelte:head>
    <title>Connection Test - Ground Control</title>
</svelte:head>

<div class="connection-test-container" style="--primaryColor: {primaryColor}; --secondaryColor: {secondaryColor}; --tertiaryColor: {tertiaryColor}; --textColor: {textColor}">
    <div class="test-panel">
        <div class="panel-header">
            <h2>🔌 USB Connection Test</h2>
            <div class="connection-badge" class:connected={isConnected} class:connecting={isConnecting}>
                {#if isConnected}
                    <i class="fas fa-check-circle"></i> Connected
                {:else if isConnecting}
                    <i class="fas fa-spinner fa-spin"></i> Connecting...
                {:else}
                    <i class="fas fa-circle"></i> Disconnected
                {/if}
            </div>
        </div>
        
        <div class="info-section">
            <h3>Current Configuration</h3>
            <div class="info-grid">
                <div class="info-item">
                    <i class="fas fa-usb"></i>
                    <div>
                        <strong>Serial Port</strong>
                        <p>COM47 (Cube Orange+ Mavlink)</p>
                    </div>
                </div>
                <div class="info-item">
                    <i class="fas fa-tachometer-alt"></i>
                    <div>
                        <strong>Baud Rate</strong>
                        <p>115200</p>
                    </div>
                </div>
                <div class="info-item">
                    <i class="fas fa-envelope"></i>
                    <div>
                        <strong>Messages Received</strong>
                        <p>{messageCount}</p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="button-group">
            <button 
                class="btn btn-primary" 
                on:click={testConnection}
                disabled={isConnecting}
            >
                <i class="fas fa-plug"></i>
                Test Connection
            </button>
            
            <button 
                class="btn btn-success" 
                on:click={startMonitoring}
                disabled={intervalId !== undefined}
            >
                <i class="fas fa-play"></i>
                Start Monitoring
            </button>
            
            <button 
                class="btn btn-warning" 
                on:click={stopMonitoring}
                disabled={!intervalId}
            >
                <i class="fas fa-stop"></i>
                Stop Monitoring
            </button>
            
            <button 
                class="btn btn-secondary" 
                on:click={clearLogs}
            >
                <i class="fas fa-trash"></i>
                Clear Logs
            </button>
            
            <button 
                class="btn btn-secondary" 
                on:click={copyLogs}
            >
                <i class="fas fa-copy"></i>
                Copy Logs
            </button>
        </div>
        
        <div class="log-section">
            <div class="log-header">
                <h3>Connection Logs</h3>
                <label class="auto-scroll">
                    <input type="checkbox" bind:checked={autoScroll} />
                    Auto-scroll
                </label>
            </div>
            <div id="log-container" class="log-container">
                {#each logs as log}
                    <div class="log-entry">{log}</div>
                {/each}
            </div>
        </div>
        
        {#if connectionError}
            <div class="error-section">
                <h3><i class="fas fa-exclamation-triangle"></i> Error Details</h3>
                <pre>{connectionError}</pre>
            </div>
        {/if}
        
        <div class="help-section">
            <h3>Troubleshooting Tips</h3>
            <ul>
                <li>✓ Ensure Cube Orange+ is connected to USB port COM47</li>
                <li>✓ Make sure the flight controller is powered on</li>
                <li>✓ Close any other ground control software (Mission Planner, QGroundControl)</li>
                <li>✓ Check the .env file has USB_SERIAL_PORT=COM47</li>
                <li>✓ Verify baud rate is set to 115200</li>
                <li>✓ Try unplugging and replugging the USB cable</li>
            </ul>
        </div>
    </div>
</div>

<style>
    .connection-test-container {
        min-height: 95vh;
        padding: 2rem;
        background: var(--secondaryColor);
    }
    
    .test-panel {
        max-width: 1200px;
        margin: 0 auto;
        background: var(--primaryColor);
        border-radius: 16px;
        padding: 2rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
        flex-wrap: wrap;
        gap: 1rem;
    }
    
    .panel-header h2 {
        margin: 0;
        color: var(--textColor);
    }
    
    .connection-badge {
        padding: 0.5rem 1rem;
        border-radius: 20px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: #6b7280;
        color: white;
    }
    
    .connection-badge.connected {
        background: #10b981;
    }
    
    .connection-badge.connecting {
        background: #f59e0b;
    }
    
    .info-section {
        margin-bottom: 2rem;
    }
    
    .info-section h3 {
        color: var(--textColor);
        margin-bottom: 1rem;
    }
    
    .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
    }
    
    .info-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        background: var(--tertiaryColor);
        border-radius: 8px;
    }
    
    .info-item i {
        font-size: 2rem;
        color: var(--textColor);
        opacity: 0.7;
    }
    
    .info-item strong {
        display: block;
        color: var(--textColor);
        margin-bottom: 0.25rem;
    }
    
    .info-item p {
        margin: 0;
        color: var(--textColor);
        opacity: 0.8;
    }
    
    .button-group {
        display: flex;
        gap: 1rem;
        margin-bottom: 2rem;
        flex-wrap: wrap;
    }
    
    .btn {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        transition: all 0.2s;
    }
    
    .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .btn-primary {
        background: #3b82f6;
        color: white;
    }
    
    .btn-primary:hover:not(:disabled) {
        background: #2563eb;
    }
    
    .btn-success {
        background: #10b981;
        color: white;
    }
    
    .btn-success:hover:not(:disabled) {
        background: #059669;
    }
    
    .btn-warning {
        background: #f59e0b;
        color: white;
    }
    
    .btn-warning:hover:not(:disabled) {
        background: #d97706;
    }
    
    .btn-secondary {
        background: #6b7280;
        color: white;
    }
    
    .btn-secondary:hover:not(:disabled) {
        background: #4b5563;
    }
    
    .log-section {
        margin-bottom: 2rem;
    }
    
    .log-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }
    
    .log-header h3 {
        margin: 0;
        color: var(--textColor);
    }
    
    .auto-scroll {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--textColor);
        cursor: pointer;
    }
    
    .log-container {
        background: var(--tertiaryColor);
        border-radius: 8px;
        padding: 1rem;
        height: 400px;
        overflow-y: auto;
        font-family: 'Courier New', monospace;
        font-size: 0.9rem;
    }
    
    .log-entry {
        padding: 0.25rem 0;
        color: var(--textColor);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .error-section {
        margin-bottom: 2rem;
        padding: 1rem;
        background: rgba(239, 68, 68, 0.1);
        border-left: 4px solid #ef4444;
        border-radius: 8px;
    }
    
    .error-section h3 {
        color: #ef4444;
        margin-bottom: 0.5rem;
    }
    
    .error-section pre {
        margin: 0;
        color: var(--textColor);
        overflow-x: auto;
    }
    
    .help-section {
        padding: 1rem;
        background: var(--tertiaryColor);
        border-radius: 8px;
    }
    
    .help-section h3 {
        color: var(--textColor);
        margin-bottom: 1rem;
    }
    
    .help-section ul {
        margin: 0;
        padding-left: 1.5rem;
        color: var(--textColor);
    }
    
    .help-section li {
        margin: 0.5rem 0;
    }
    
    /* Scrollbar styling */
    .log-container::-webkit-scrollbar {
        width: 8px;
    }
    
    .log-container::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.1);
    }
    
    .log-container::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
    }
    
    @media (max-width: 768px) {
        .connection-test-container {
            padding: 1rem;
        }
        
        .test-panel {
            padding: 1rem;
        }
        
        .button-group {
            flex-direction: column;
        }
        
        .btn {
            width: 100%;
            justify-content: center;
        }
        
        .info-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
