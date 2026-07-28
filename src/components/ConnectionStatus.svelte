<script lang="ts">
    import { onlineStore, mavModeStore, mavStateStore, mavArmedStateStore, mavBatteryStore, mavSpeedStore, mavAltitudeStore } from '../stores/mavlinkStore';
    import { darkModeStore, primaryColorStore, secondaryColorStore, tertiaryColorStore } from '../stores/customizationStore';

    $: darkMode       = $darkModeStore;
    $: primaryColor   = $primaryColorStore;
    $: secondaryColor = $secondaryColorStore;
    $: tertiaryColor  = $tertiaryColorStore;
    $: fontColor      = darkMode ? '#ffffff' : '#000000';

    $: isOnline    = $onlineStore;
    $: mavMode     = $mavModeStore;
    $: systemState = $mavStateStore;
    $: isArmed     = $mavArmedStateStore;
    $: battery     = $mavBatteryStore;
    $: speed       = $mavSpeedStore;
    $: altitude    = $mavAltitudeStore;

    $: batteryColor = battery === null ? '#6b7280'
        : battery <= 20  ? '#ef4444'
        : battery <= 50  ? '#f59e0b'
        : '#10b981';

    let armConfirm = false; // show confirm step before arming

    async function toggleArmed() {
        if (!isArmed) {
            // Arm — require a second click to confirm
            if (!armConfirm) {
                armConfirm = true;
                setTimeout(() => { armConfirm = false; }, 3000); // reset after 3s
                return;
            }
        }
        armConfirm = false;
        const param = isArmed ? 0 : 1; // 0 = disarm, 1 = arm
        // param2 = 21196 bypasses ALL pre-arm checks (RC not connected, GPS, etc.)
        // This allows manual arming from GCS without an RC transmitter
        const forceParam = isArmed ? 21196 : 21196;
        await fetch('/api/mavlink/send_command', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'command': 'COMPONENT_ARM_DISARM',
                'params': `${param},${forceParam}`,
                'useCmdLong': 'true',
                'useArduPilotMega': 'false'
            }
        });
    }
</script>

<div
    class="status-bar"
    style="
        --primaryColor: {primaryColor};
        --secondaryColor: {secondaryColor};
        --tertiaryColor: {tertiaryColor};
        --fontColor: {fontColor};
    "
>
    <!-- Connection pill -->
    <div class="pill {isOnline ? 'pill-green' : 'pill-gray'}">
        <i class="fas {isOnline ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
        <span>{isOnline ? 'Connected' : 'Disconnected'}</span>
    </div>

    {#if isOnline}
        <div class="divider"></div>

        <!-- Armed state + toggle button -->
        <div class="armed-group">
            <div class="pill {isArmed ? 'pill-red' : 'pill-gray'}">
                <i class="fas {isArmed ? 'fa-lock-open' : 'fa-lock'}"></i>
                <span>{isArmed ? 'ARMED' : 'DISARMED'}</span>
            </div>
            <button
                class="arm-btn {isArmed ? 'arm-btn-disarm' : armConfirm ? 'arm-btn-confirm' : 'arm-btn-arm'}"
                on:click={toggleArmed}
                title={isArmed ? 'Click to Disarm' : armConfirm ? 'Click again to confirm ARM' : 'Click to Arm'}
            >
                {#if isArmed}
                    <i class="fas fa-lock"></i> Disarm
                {:else if armConfirm}
                    <i class="fas fa-exclamation-triangle"></i> Confirm?
                {:else}
                    <i class="fas fa-lock-open"></i> Arm
                {/if}
            </button>
        </div>
    {:else}
        <div class="divider"></div>
        <span class="hint">Use the plug icon in the sidebar to connect your MAVLink device</span>
    {/if}
</div>

<style>
    .status-bar {
        display: flex;
        align-items: center;
        gap: 0;
        height: 100%;
        width: 100%;
        background-color: var(--primaryColor);
        border-radius: 14px;
        padding: 0 1.2rem;
        color: var(--fontColor);
        overflow: hidden;
        box-sizing: border-box;
    }

    /* pill badges */
    .pill {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.25rem 0.75rem;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 600;
        white-space: nowrap;
        flex-shrink: 0;
    }

    .pill-green {
        background-color: rgba(16, 185, 129, 0.15);
        color: #10b981;
    }

    .pill-red {
        background-color: rgba(239, 68, 68, 0.15);
        color: #ef4444;
    }

    .pill-gray {
        background-color: rgba(107, 114, 128, 0.15);
        color: #9ca3af;
    }

    /* key/value stat items */
    .stat-item {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.82rem;
        white-space: nowrap;
        flex-shrink: 0;
        padding: 0 0.2rem;
    }

    .icon-dim {
        opacity: 0.5;
        font-size: 0.78rem;
        width: 14px;
        text-align: center;
    }

    .label {
        opacity: 0.55;
        font-size: 0.75rem;
    }

    .value {
        font-weight: 600;
        font-size: 0.82rem;
    }

    .value-orange {
        color: #fb923c;
    }

    .unit {
        font-size: 0.7rem;
        opacity: 0.6;
        font-weight: 400;
    }

    /* vertical dividers */
    .divider {
        width: 1px;
        height: 1.4rem;
        background-color: var(--tertiaryColor);
        margin: 0 0.8rem;
        flex-shrink: 0;
        opacity: 0.6;
    }

    .hint {
        font-size: 0.78rem;
        opacity: 0.5;
        font-style: italic;
    }

    /* armed group — pill + button side by side */
    .armed-group {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-shrink: 0;
    }

    .arm-btn {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.2rem 0.65rem;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 700;
        border: none;
        cursor: pointer;
        transition: all 0.15s;
        white-space: nowrap;
    }

    .arm-btn-arm {
        background-color: rgba(239, 68, 68, 0.15);
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.4);
    }
    .arm-btn-arm:hover {
        background-color: rgba(239, 68, 68, 0.3);
    }

    .arm-btn-confirm {
        background-color: rgba(245, 158, 11, 0.2);
        color: #f59e0b;
        border: 1px solid rgba(245, 158, 11, 0.5);
        animation: pulse 0.6s ease-in-out infinite alternate;
    }

    .arm-btn-disarm {
        background-color: rgba(107, 114, 128, 0.15);
        color: #9ca3af;
        border: 1px solid rgba(107, 114, 128, 0.3);
    }
    .arm-btn-disarm:hover {
        background-color: rgba(107, 114, 128, 0.3);
    }

    @keyframes pulse {
        from { opacity: 0.7; }
        to   { opacity: 1;   }
    }

    @media (max-width: 990px) {
        .status-bar {
            border-radius: 10px;
            padding: 0 0.75rem;
            gap: 0;
            overflow-x: auto;
        }

        .pill {
            font-size: 0.72rem;
            padding: 0.2rem 0.55rem;
        }

        .stat-item {
            font-size: 0.75rem;
        }
    }
</style>
