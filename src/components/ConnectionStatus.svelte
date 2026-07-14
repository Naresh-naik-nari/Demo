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

        <!-- Armed state -->
        <div class="pill {isArmed ? 'pill-red' : 'pill-gray'}">
            <i class="fas {isArmed ? 'fa-lock-open' : 'fa-lock'}"></i>
            <span>{isArmed ? 'ARMED' : 'DISARMED'}</span>
        </div>

        <div class="divider"></div>

        <!-- Flight mode -->
        <div class="stat-item">
            <i class="fas fa-sliders-h icon-dim"></i>
            <span class="label">Mode</span>
            <span class="value value-orange">{mavMode}</span>
        </div>

        <div class="divider"></div>

        <!-- System state -->
        <div class="stat-item">
            <i class="fas fa-microchip icon-dim"></i>
            <span class="label">State</span>
            <span class="value">{systemState}</span>
        </div>

        <div class="divider"></div>

        <!-- Speed -->
        <div class="stat-item">
            <i class="fas fa-gauge-high icon-dim"></i>
            <span class="label">Speed</span>
            <span class="value">{speed} <span class="unit">m/s</span></span>
        </div>

        <div class="divider"></div>

        <!-- Altitude -->
        <div class="stat-item">
            <i class="fas fa-arrow-up-from-ground icon-dim"></i>
            <span class="label">Alt</span>
            <span class="value">{altitude} <span class="unit">m</span></span>
        </div>

        <div class="divider"></div>

        <!-- Battery -->
        <div class="stat-item">
            <i class="fas fa-battery-half icon-dim" style="color: {batteryColor}"></i>
            <span class="label">Battery</span>
            <span class="value" style="color: {batteryColor}">
                {battery !== null ? battery + '%' : '--'}
            </span>
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
