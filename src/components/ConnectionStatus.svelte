<script lang="ts">
    import { onlineStore, mavArmedStateStore, mavPendingArmStore } from '../stores/mavlinkStore';
    import { darkModeStore, primaryColorStore, secondaryColorStore, tertiaryColorStore } from '../stores/customizationStore';
    import { get } from 'svelte/store';

    $: darkMode       = $darkModeStore;
    $: primaryColor   = $primaryColorStore;
    $: secondaryColor = $secondaryColorStore;
    $: tertiaryColor  = $tertiaryColorStore;
    $: fontColor      = darkMode ? '#ffffff' : '#000000';

    $: isOnline = $onlineStore;

    // Use pending state for immediate UI feedback, fall back to actual FC state
    $: isArmed = $mavPendingArmStore !== null ? $mavPendingArmStore : $mavArmedStateStore;

    // Confirm step — required for BOTH arm and disarm to prevent accidents
    let confirmStep = false;
    let confirmTimeout: ReturnType<typeof setTimeout> | null = null;
    let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
    let isPending = false;

    function resetConfirm() {
        confirmStep = false;
        if (confirmTimeout) { clearTimeout(confirmTimeout); confirmTimeout = null; }
    }

    async function toggleArmed() {
        if (isPending) return; // don't allow double-click while waiting

        // First click — show confirm step
        if (!confirmStep) {
            confirmStep = true;
            if (confirmTimeout) clearTimeout(confirmTimeout);
            confirmTimeout = setTimeout(resetConfirm, 3000); // auto-reset after 3s
            return;
        }

        // Second click — confirmed, send command
        resetConfirm();
        isPending = true;

        // Read the ACTUAL FC state (not pending) to decide what to send
        const actuallyArmed = get(mavArmedStateStore);
        const arming = !actuallyArmed;
        const param  = arming ? 1 : 0;

        // Optimistically update UI immediately
        mavPendingArmStore.set(arming);

        // Safety fallback — if no COMMAND_ACK in 5s, release the lock
        if (pendingTimeout) clearTimeout(pendingTimeout);
        pendingTimeout = setTimeout(() => {
            mavPendingArmStore.set(null);
            isPending = false;
        }, 5000);

        try {
            await fetch('/api/mavlink/send_command', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'command': 'COMPONENT_ARM_DISARM',
                    'params': `${param},21196`,
                    'useCmdLong': 'true',
                    'useArduPilotMega': 'false'
                }
            });
        } catch {
            // Network error — revert
            mavPendingArmStore.set(null);
            isPending = false;
            if (pendingTimeout) clearTimeout(pendingTimeout);
        }
    }

    // Clear isPending when COMMAND_ACK clears the pending store
    $: if ($mavPendingArmStore === null) isPending = false;
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

            <!-- Status pill -->
            <div class="pill {isArmed ? 'pill-red' : 'pill-gray'}">
                <i class="fas {isArmed ? 'fa-lock-open' : 'fa-lock'}"></i>
                <span>{isArmed ? 'ARMED' : 'DISARMED'}</span>
            </div>

            <!-- Action button -->
            <button
                class="arm-btn {isPending ? 'arm-btn-pending' : confirmStep ? 'arm-btn-confirm' : isArmed ? 'arm-btn-disarm' : 'arm-btn-arm'}"
                on:click={toggleArmed}
                disabled={isPending}
                title={isPending ? 'Waiting for flight controller...' : confirmStep ? 'Click again to confirm' : isArmed ? 'Click to Disarm' : 'Click to Arm'}
            >
                {#if isPending}
                    <i class="fas fa-spinner fa-spin"></i> Waiting...
                {:else if confirmStep}
                    <i class="fas fa-exclamation-triangle"></i> Confirm {isArmed ? 'Disarm' : 'Arm'}?
                {:else if isArmed}
                    <i class="fas fa-lock"></i> Disarm
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

    /* armed group */
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
        border: 1px solid transparent;
        cursor: pointer;
        transition: all 0.15s;
        white-space: nowrap;
    }

    .arm-btn:disabled {
        cursor: not-allowed;
        opacity: 0.7;
    }

    /* Arm button — red */
    .arm-btn-arm {
        background-color: rgba(239, 68, 68, 0.15);
        color: #ef4444;
        border-color: rgba(239, 68, 68, 0.4);
    }
    .arm-btn-arm:hover {
        background-color: rgba(239, 68, 68, 0.3);
    }

    /* Disarm button — gray */
    .arm-btn-disarm {
        background-color: rgba(107, 114, 128, 0.15);
        color: #9ca3af;
        border-color: rgba(107, 114, 128, 0.3);
    }
    .arm-btn-disarm:hover {
        background-color: rgba(107, 114, 128, 0.3);
    }

    /* Confirm step — amber, pulsing */
    .arm-btn-confirm {
        background-color: rgba(245, 158, 11, 0.2);
        color: #f59e0b;
        border-color: rgba(245, 158, 11, 0.5);
        animation: pulse 0.6s ease-in-out infinite alternate;
    }

    /* Pending/waiting — blue */
    .arm-btn-pending {
        background-color: rgba(59, 130, 246, 0.15);
        color: #60a5fa;
        border-color: rgba(59, 130, 246, 0.3);
    }

    @keyframes pulse {
        from { opacity: 0.7; }
        to   { opacity: 1;   }
    }

    @media (max-width: 990px) {
        .status-bar {
            border-radius: 10px;
            padding: 0 0.75rem;
            overflow-x: auto;
        }
        .pill { font-size: 0.72rem; padding: 0.2rem 0.55rem; }
        .arm-btn { font-size: 0.68rem; }
    }
</style>
