/**
 * @file parser.ts
 * @module lib/mavlink/parser
 * @description MAVLink log-line parser: routes decoded packet strings from the
 * heartbeat endpoint to the correct Svelte store.
 *
 * The server encodes every decoded MAVLink packet as a single formatted string:
 *   `MSG_NAME(magic)::ISO::sysid=X,compid=Y::{JSON_payload}`
 *
 * This module parses those strings and writes to the matching stores.
 * It is deliberately free of Svelte component concerns — pure business logic.
 *
 * Usage (from +layout.svelte):
 *   import { processLogLine } from '$lib/mavlink/parser';
 *   processLogLine(logString, { showNotification, rtllState });
 */

import { get } from 'svelte/store';
import { MavType, MavState, MavAutopilot } from 'mavlink-mappings/dist/lib/minimal';
import { MavCmd, MavResult } from 'mavlink-mappings/dist/lib/common';
import { CopterMode, PlaneMode, RoverMode } from 'mavlink-mappings/dist/lib/ardupilotmega';

import {
    mavPitchStore,
    mavRollStore,
    mavLocationStore,
    mavHeadingStore,
    mavAltitudeStore,
    mavSpeedStore,
    mavSatelliteStore,
    mavTypeStore,
    mavModelStore,
    mavStateStore,
    mavArmedStateStore,
    mavModeStore,
    mavPendingArmStore,
    mavBatteryStore,
    mavGimbalTiltStore,
    mavGimbalPanStore,
    mavGimbalStore,
    mavlinkParamStore,
    type Parameter,
} from '$lib/../stores/mavlinkStore';
import { missionIndexStore, missionCompleteStore, missionPlanActionsStore } from '$lib/../stores/missionPlanStore';
import type { NotificationConfig } from '$lib/utils/notifications';

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageHandler = (text: string) => void;

export interface ParserContext {
    /** Show a toast notification from any handler that needs user feedback. */
    showNotification: (config: NotificationConfig) => void;
    /**
     * Mutable RTLL trigger flag — stored outside the parser so its value
     * persists across calls. Pass an object so mutations are reflected
     * in the caller:  `const rtll = { triggered: false }; parseContext.rtllState = rtll`
     */
    rtllState: { triggered: boolean };
}

// ─── Low-level helpers ────────────────────────────────────────────────────────

/**
 * Extracts a single named field value from a JSON-serialised MAVLink log string.
 *
 * Handles:
 *  - Quoted strings:   `"key":"value"`
 *  - Numeric values:   `"key":-1.5e-3`
 *
 * Returns `''` (empty string) if the key is not found.
 */
export function extractValue(text: string, key: string): string {
    // Quoted string value
    const strMatch = text.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`));
    if (strMatch) return strMatch[1].replace(/\u0000/g, '').trim();

    // Numeric value (int, float, negative, scientific notation)
    const numMatch = text.match(new RegExp(`"${key}"\\s*:\\s*(-?[\\d.]+(?:[eE][+-]?\\d+)?)`));
    if (numMatch) return numMatch[1];

    return '';
}

/**
 * Converts MAVLink lat/lon integers (×1e7) to a `{ lat, lng }` object.
 * Returns `null` if either field is missing.
 */
function parseLocationInts(
    lat: string,
    lon: string
): { lat: number; lng: number } | null {
    if (!lat || !lon) return null;
    return {
        lat: parseFloat(lat) / 1e7,
        lng: parseFloat(lon) / 1e7,
    };
}

/**
 * Calculates 3D ground speed (m/s) from NED velocity components (cm/s).
 */
function calculateSpeed(text: string): number {
    const vx = parseInt(extractValue(text, 'vx') || '0') / 100;
    const vy = parseInt(extractValue(text, 'vy') || '0') / 100;
    const vz = parseInt(extractValue(text, 'vz') || '0') / 100;
    return parseFloat(Math.sqrt(vx ** 2 + vy ** 2 + vz ** 2).toFixed(2));
}

/**
 * Decodes a MAVLink parameter value from its raw float representation into
 * the appropriate integer type, clamping to valid range.
 */
function decodeParameterValue(encodedValue: string, paramType: string): number {
    const value = parseFloat(encodedValue);
    const type = parseInt(paramType);
    if (isNaN(value)) {
        console.warn('[parser] Invalid parameter value:', encodedValue);
        return 0;
    }
    switch (type) {
        case 1: return Math.min(255, Math.max(0, Math.round(value)));
        case 2: return Math.min(127, Math.max(-128, Math.round(value)));
        case 3: return Math.min(65535, Math.max(0, Math.round(value)));
        case 4: return Math.min(32767, Math.max(-32768, Math.round(value)));
        case 5: return Math.min(4294967295, Math.max(0, Math.round(value)));
        case 6: return Math.min(2147483647, Math.max(-2147483648, Math.round(value)));
        case 7: case 8:
            console.warn('[parser] 64-bit integers may lose precision in JavaScript');
            return value;
        case 9: case 10: return value;
        default:
            console.warn('[parser] Unknown parameter type:', type);
            return value;
    }
}

// ─── Message handlers ─────────────────────────────────────────────────────────

/**
 * Builds and returns the message handler map, bound to `ctx` so handlers can
 * show notifications and read/write RTLL state.
 */
export function buildMessageHandlers(ctx: ParserContext): Record<string, MessageHandler> {
    const { showNotification, rtllState } = ctx;

    /** Converts SCREAMING_SNAKE to Proper Case. */
    const toProperCase = (str: string): string =>
        str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.substring(1).toLowerCase());

    return {

        // ── Attitude ──────────────────────────────────────────────────────────
        ATTITUDE: (text) => {
            const pitchRaw = extractValue(text, 'pitch');
            const rollRaw  = extractValue(text, 'roll');
            if (pitchRaw !== '') mavPitchStore.set(parseFloat(pitchRaw) * 180 / Math.PI);
            if (rollRaw  !== '') mavRollStore.set(parseFloat(rollRaw)   * 180 / Math.PI);
        },

        // ── Global position ───────────────────────────────────────────────────
        GLOBAL_POSITION_INT: (text) => {
            const lat      = extractValue(text, 'lat');
            const lon      = extractValue(text, 'lon');
            const position = parseLocationInts(lat, lon);
            if (position) mavLocationStore.set(position);

            const heading  = extractValue(text, 'hdg');
            if (heading !== '') mavHeadingStore.set(parseFloat(heading) / 100);

            const altitude = extractValue(text, 'relativeAlt');
            if (altitude !== '') mavAltitudeStore.set(parseFloat(altitude) / 1000);

            mavSpeedStore.set(calculateSpeed(text));
        },

        // ── GPS quality ───────────────────────────────────────────────────────
        GPS_RAW_INT: (text) => {
            const eph        = extractValue(text, 'eph');
            const satellites = extractValue(text, 'satellitesVisible');
            if (eph && satellites) {
                mavSatelliteStore.set({
                    total: parseInt(satellites),
                    hdop: parseFloat(eph) * 1e-2,
                });
            }
        },

        // ── Heartbeat — vehicle identity, state, mode, armed ─────────────────
        HEARTBEAT: (text) => {
            // Only process heartbeats from the flight controller (sysid=1, compid=1).
            // Other components (GPS, gimbal, OSD) also send heartbeats.
            const sysIdMatch  = text.match(/sysid=(\d+)/);
            const compIdMatch = text.match(/compid=(\d+)/);
            if (sysIdMatch && compIdMatch) {
                if (parseInt(sysIdMatch[1]) !== 1 || parseInt(compIdMatch[1]) !== 1) return;
            }

            const validAutopilots = new Set([
                'ARDUPILOTMEGA', 'PX4', 'OPENPILOT', 'GENERIC',
                'SLUGS', 'PPZ', 'UDB', 'FP', 'SMACCMPILOT',
                'AUTOQUAD', 'SMARTAP', 'AIRRAILS', 'REFLEX',
            ]);
            const validTypes = new Set([
                'FIXED_WING', 'QUADROTOR', 'COAXIAL', 'HELICOPTER',
                'HEXAROTOR', 'OCTOROTOR', 'TRICOPTER', 'GROUND_ROVER',
                'SURFACE_BOAT', 'SUBMARINE', 'AIRSHIP', 'FREE_BALLOON',
                'ROCKET', 'VTOL_TAILSITTER_DUOROTOR', 'VTOL_TAILSITTER_QUADROTOR',
                'VTOL_TILTROTOR', 'VTOL_FIXEDROTOR', 'VTOL_TAILSITTER',
                'VTOL_TILTWING', 'DODECAROTOR', 'DECAROTOR', 'GENERIC_MULTIROTOR',
                'GENERIC',
            ]);

            // Vehicle type — set once, from a known valid type
            const typeField = extractValue(text, 'type');
            if (typeField) {
                const typeName = MavType[parseInt(typeField)];
                if (typeName && validTypes.has(typeName) && get(mavTypeStore) === 'Unknown') {
                    mavTypeStore.set(toProperCase(typeName));
                }
            }

            // Autopilot model — set once, skip INVALID/GENERIC unless nothing better
            const model = extractValue(text, 'autopilot');
            if (model) {
                const modelName = MavAutopilot[parseInt(model)];
                const current   = get(mavModelStore);
                if (
                    modelName &&
                    modelName !== 'INVALID' &&
                    validAutopilots.has(modelName) &&
                    (current === 'UNKNOWN' || current === 'GENERIC')
                ) {
                    mavModelStore.set(modelName);
                }
            }

            // System state — only accept stable operational states
            const stateField = extractValue(text, 'systemStatus');
            if (stateField) {
                const stateName    = MavState[parseInt(stateField)];
                const stableStates = new Set([
                    'STANDBY', 'ACTIVE', 'CRITICAL', 'EMERGENCY',
                    'POWEROFF', 'FLIGHT_TERMINATION',
                ]);
                if (stateName && stableStates.has(stateName)) {
                    mavStateStore.set(stateName);
                }
            }

            // Armed state (bit 7 of baseMode) — skip while a command is pending
            const baseMode = extractValue(text, 'baseMode');
            if (baseMode && get(mavPendingArmStore) === null) {
                mavArmedStateStore.set((parseInt(baseMode) & 128) !== 0);
            }

            // Flight mode — resolved from customMode using the vehicle-type enum
            const customMode = extractValue(text, 'customMode');
            if (customMode) {
                const modeNum = parseInt(customMode);
                const vType   = get(mavTypeStore).toUpperCase();
                let modeName: string | undefined;
                if (vType === 'FIXED_WING') {
                    modeName = PlaneMode[modeNum];
                } else if (vType === 'GROUND_ROVER' || vType === 'SURFACE_BOAT') {
                    modeName = RoverMode[modeNum];
                } else {
                    modeName = CopterMode[modeNum];
                }
                if (modeName) mavModeStore.set(modeName);
            }
        },

        // ── Mission progress ──────────────────────────────────────────────────
        MISSION_CURRENT: (text) => {
            const index = extractValue(text, 'seq');
            if (index) missionIndexStore.set(parseInt(index));
        },

        MISSION_ITEM_REACHED: (text) => {
            const index = extractValue(text, 'seq');
            if (!index) return;

            const indexNum = parseInt(index);
            const actions  = get(missionPlanActionsStore);

            if (indexNum === Object.keys(actions).length - 1) {
                missionCompleteStore.set(true);
            }

            const action = actions[indexNum];
            if (action) {
                showNotification({
                    title:   'Waypoint Reached',
                    content: `${index}: ${action.type}<br>lat: ${action.lat} °<br>lng: ${action.lon} °<br>alt: ${action.alt ?? 0} m`,
                    type:    'success',
                });
            }
        },

        // ── Battery — also drives RTLL (see rtll.ts) ─────────────────────────
        BATTERY_STATUS: (text) => {
            const battery = extractValue(text, 'batteryRemaining');
            if (!battery) return;

            const level = parseInt(battery);
            mavBatteryStore.set(level);

            // ── RTLL: Return-To-Launch-with-Loiter on low battery ─────────────
            // Loiter mode requires 3D GPS lock (HDOP < 1.4 to arm).
            // If GPS is degraded, fall straight through to RTL instead of
            // Loiter, since RTL also uses GPS and is the safer fallback.
            // https://ardupilot.org/copter/docs/loiter-mode.html
            const BATT_LOW_THRESHOLD = 20;   // %
            const LOITER_DURATION_MS = 30000; // 30 s loiter before RTL

            if (level <= BATT_LOW_THRESHOLD && get(mavArmedStateStore) && !rtllState.triggered) {
                rtllState.triggered = true;

                const { total: satCount, hdop } = get(mavSatelliteStore);
                const gpsHealthy = satCount >= 6 && hdop < 2.0; // hdop < 1.4 required to arm in Loiter

                if (gpsHealthy) {
                    showNotification({
                        title:    '⚠️ Low Battery — RTLL Activated',
                        content:  `Battery at ${level}%. Entering LOITER for ${LOITER_DURATION_MS / 1000}s then RTL.`,
                        type:     'warning',
                        duration: 8000,
                    });

                    // Switch to LOITER — hold position while crew assesses
                    fetch('/api/mavlink/send_command', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json', command: 'DO_SET_MODE', params: '1,5', useCmdLong: 'true' },
                    });

                    // After loiter duration, switch to RTL if still armed
                    setTimeout(() => {
                        if (get(mavArmedStateStore)) {
                            showNotification({
                                title:    '🏠 RTL Initiated',
                                content:  'Loiter complete. Returning to launch.',
                                type:     'warning',
                                duration: 8000,
                            });
                            fetch('/api/mavlink/send_command', {
                                method: 'POST',
                                headers: { 'content-type': 'application/json', command: 'DO_SET_MODE', params: '1,6', useCmdLong: 'true' },
                            });
                        }
                    }, LOITER_DURATION_MS);
                } else {
                    // GPS insufficient for Loiter — go straight to RTL
                    showNotification({
                        title:    '⚠️ Low Battery — RTL Activated (GPS weak)',
                        content:  `Battery at ${level}%. GPS insufficient for Loiter (${satCount} sats, HDOP ${hdop.toFixed(1)}). Going RTL immediately.`,
                        type:     'error',
                        duration: 10000,
                    });
                    fetch('/api/mavlink/send_command', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json', command: 'DO_SET_MODE', params: '1,6', useCmdLong: 'true' },
                    });
                }
            }

            // Reset RTLL flag when disarmed
            if (!get(mavArmedStateStore)) {
                rtllState.triggered = false;
            }
        },

        // ── Command acknowledgement ───────────────────────────────────────────
        COMMAND_ACK: (text) => {
            const command = extractValue(text, 'command');
            const result  = extractValue(text, 'result');
            if (!command || !result) return;

            const commandName = MavCmd[parseInt(command)];
            const resultName  = MavResult[parseInt(result)];

            // Suppress noisy background telemetry / gimbal ACKs
            if (commandName === 'REQUEST_MESSAGE' || commandName === 'SET_MESSAGE_INTERVAL') return;
            if (['DO_MOUNT_CONTROL', 'SET_CAMERA_ZOOM', 'VIDEO_START_CAPTURE',
                 'VIDEO_STOP_CAPTURE', 'IMAGE_START_CAPTURE'].includes(commandName)) return;

            const isArmCmd = commandName === 'COMPONENT_ARM_DISARM';
            const isArming = text.includes('"_param1":1') || text.includes('"param1":1');

            let notifType: NotificationConfig['type'] = 'success';
            let content = `Command: ${commandName}<br>Result: ${resultName}`;

            if (resultName !== 'ACCEPTED') {
                notifType = (resultName.includes('FAILED') ||
                             resultName.includes('DENIED') ||
                             resultName.includes('UNSUPPORTED')) ? 'error' : 'warning';
                if (isArmCmd) {
                    mavPendingArmStore.set(null);
                    content = `${isArming ? 'Arming' : 'Disarming'} failed: ${resultName}`;
                }
            } else if (isArmCmd) {
                mavArmedStateStore.set(isArming);
                mavPendingArmStore.set(null);
                content    = isArming ? '✅ Vehicle Armed' : '✅ Vehicle Disarmed';
                notifType  = isArming ? 'warning' : 'success';
            }

            showNotification({
                title:   isArmCmd ? (isArming ? 'Arm Command' : 'Disarm Command') : 'Command Acknowledged',
                content,
                type:    notifType,
            });
        },

        // ── Status text from flight controller ────────────────────────────────
        STATUSTEXT: (text) => {
            const severity  = extractValue(text, 'severity');
            const textMatch = text.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            const statusText = textMatch?.[1]?.replace(/\\n/g, ' ').trim();

            if (!severity || !statusText) return;

            // Suppress RC-related warnings — RC is optional in GCS-only operation
            const rcMessages = [
                'rc not found', 'rc failsafe', 'no rc receiver',
                'rc not calibrated', 'rc 3 is not neutral', 'rc dead zone',
                'prearm: rc', 'pre-arm: rc', 'radio failsafe',
            ];
            if (rcMessages.some((m) => statusText.toLowerCase().includes(m))) return;

            const severityLevel = parseInt(severity);
            const notifType: NotificationConfig['type'] =
                severityLevel <= 3 ? 'error' :
                severityLevel === 4 ? 'warning' : 'info';

            showNotification({ title: 'Status Message', content: statusText, type: notifType });
        },

        // ── Parameter values ──────────────────────────────────────────────────
        PARAM_VALUE: (text) => {
            const paramId    = extractValue(text, 'paramId');
            const paramValue = extractValue(text, 'paramValue');
            const paramType  = extractValue(text, 'paramType');

            if (!paramId || paramValue === '' || !paramType) return;

            const param: Parameter = {
                param_id:    paramId,
                param_value: decodeParameterValue(paramValue, paramType),
                param_type:  parseInt(paramType),
                param_count: parseInt(extractValue(text, 'paramCount') || '0'),
                param_index: parseInt(extractValue(text, 'paramIndex') || '0'),
            };
            mavlinkParamStore.update((store) => ({ ...store, [paramId]: param }));
        },

        // ── Gimbal telemetry ──────────────────────────────────────────────────
        MOUNT_STATUS: (text) => {
            const tilt     = extractValue(text, 'pointingA'); // centidegrees
            const pan      = extractValue(text, 'pointingB'); // centidegrees
            const tiltDeg  = tilt !== '' ? parseFloat(tilt) / 100 : null;
            const panDeg   = pan  !== '' ? parseFloat(pan)  / 100 : null;

            if (tiltDeg !== null) mavGimbalTiltStore.set(tiltDeg);
            if (panDeg  !== null) mavGimbalPanStore.set(panDeg);

            mavGimbalStore.update((s) => ({
                ...s,
                pitch: tiltDeg ?? s.pitch,
                yaw:   panDeg  ?? s.yaw,
            }));
        },
    };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Processes a single MAVLink log line: appends it to the log store and routes
 * it to the appropriate message handler.
 *
 * @param text       - Decoded log string from the heartbeat endpoint
 * @param logs       - Mutable reference to the in-memory log array (bounded to 1 000)
 * @param handlers   - Pre-built handler map from `buildMessageHandlers()`
 * @param logStore   - The Svelte writable store to push the log line into
 */
export function processLogLine(
    text: string,
    logs: string[],
    handlers: Record<string, MessageHandler>,
    logStore: { set: (v: string[]) => void }
): void {
    if (!text) return;

    // Bounded sliding window — keep the last 1 000 entries
    const updated = [...logs.slice(-999), text];
    logStore.set(updated);
    // Mutate in place so the caller's reference stays current
    logs.length = 0;
    logs.push(...updated);

    // Dispatch to the first matching handler
    for (const [msgType, handler] of Object.entries(handlers)) {
        if (text.includes(msgType)) {
            handler(text);
            break;
        }
    }
}
