/**
 * @file mavlinkStore.ts
 * @module stores/mavlinkStore
 * @description Svelte writable stores that hold live telemetry state received
 * from the flight controller via MAVLink.
 *
 * All stores are updated centrally in `src/routes/+layout.svelte` by the
 * MAVLink log parser. Components subscribe reactively using `$storeName`.
 *
 * Default values represent a safe "not yet connected" state so the UI renders
 * sensibly before the first MAVLink message arrives.
 */

import { writable } from 'svelte/store';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A single ArduPilot/MAVLink parameter as received in a PARAM_VALUE message.
 * @see https://mavlink.io/en/services/parameter.html
 */
export interface Parameter {
  /** Parameter name (up to 16 chars, null-padding stripped). */
  param_id: string;
  /** Current numeric value, decoded to the correct type range. */
  param_value: number;
  /** MAV_PARAM_TYPE enum value (1=uint8 … 10=double). */
  param_type: number;
  /** Total number of parameters on the FC (from PARAM_VALUE). */
  param_count: number;
  /** Index of this parameter in the FC's parameter list. */
  param_index: number;
}

/**
 * Optional display metadata for a parameter (sourced from ArduPilot parameter
 * definitions or a bundled metadata JSON file).
 */
export interface ParameterMeta {
  min?: number;
  max?: number;
  increment?: number;
  description?: string;
  units?: string;
}

// ─── Connection ──────────────────────────────────────────────────────────────

/** `true` when the MAVLink device is connected and sending telemetry. */
export const onlineStore = writable<boolean>(false);

// ─── Vehicle identity ─────────────────────────────────────────────────────────

/**
 * Autopilot firmware name from HEARTBEAT.autopilot.
 * @example 'ARDUPILOTMEGA', 'PX4'
 */
export const mavModelStore = writable<string>('UNKNOWN');

/**
 * Vehicle type name from HEARTBEAT.type.
 * @example 'Quadrotor', 'Fixed Wing', 'Ground Rover'
 */
export const mavTypeStore = writable<string>('Unknown');

// ─── Flight state ────────────────────────────────────────────────────────────

/** `true` when the vehicle is armed (motors live). */
export const mavArmedStateStore = writable<boolean>(false);

/**
 * MAV_STATE name from HEARTBEAT.systemStatus.
 * Only stable operational states are accepted (STANDBY, ACTIVE, CRITICAL, …).
 */
export const mavStateStore = writable<string>('Unknown');

/**
 * Current flight mode name, resolved from HEARTBEAT.customMode.
 * Uses the appropriate enum for the detected vehicle type (CopterMode /
 * PlaneMode / RoverMode).
 */
export const mavModeStore = writable<string>('Unknown');

// ─── Position & navigation ───────────────────────────────────────────────────

/**
 * GPS position from GLOBAL_POSITION_INT.
 * Default is Atlanta, GA — the app's initial map center.
 */
export const mavLocationStore = writable<{ lat: number; lng: number }>({
  lat: 33.79105092934356,
  lng: -84.37130870603511,
});

/**
 * GPS quality from GPS_RAW_INT.
 * `total` = visible satellites, `hdop` = horizontal dilution of precision.
 */
export const mavSatelliteStore = writable<{ total: number; hdop: number }>({
  total: 0,
  hdop: 999.0,
});

/**
 * Compass heading in degrees (0–359) from GLOBAL_POSITION_INT.hdg.
 * Default points north-northwest — cosmetic only.
 */
export const mavHeadingStore = writable<number>(320);

/**
 * Relative altitude above home in metres from GLOBAL_POSITION_INT.relativeAlt.
 */
export const mavAltitudeStore = writable<number>(0);

/**
 * 3D ground speed in m/s, derived from GLOBAL_POSITION_INT vx/vy/vz vectors.
 */
export const mavSpeedStore = writable<number>(0);

/**
 * Pitch angle in degrees from ATTITUDE.pitch (converted from radians).
 * Positive = nose up.
 */
export const mavPitchStore = writable<number>(0);

/**
 * Roll angle in degrees from ATTITUDE.roll (converted from radians).
 * Positive = right wing down.
 */
export const mavRollStore = writable<number>(0);

/**
 * Battery remaining percentage from BATTERY_STATUS.batteryRemaining.
 * `null` until the first BATTERY_STATUS message is received.
 */
export const mavBatteryStore = writable<number | null>(null);

// ─── Logs & parameters ────────────────────────────────────────────────────────

/**
 * Sliding window of the last 1 000 decoded MAVLink log strings.
 * Format: `MSG_NAME(magic)::ISO::sysid=X,compid=Y::{JSON}`
 * Used by the Event Log page for display and download.
 */
export const mavlinkLogStore = writable<string[]>([]);

/**
 * All received parameters keyed by `param_id`.
 * Populated incrementally as PARAM_VALUE messages arrive.
 */
export const mavlinkParamStore = writable<Record<string, Parameter>>({});

// ─── Gimbal / camera ─────────────────────────────────────────────────────────

/**
 * Gimbal tilt (pitch) in degrees from MOUNT_STATUS.pointingA (centidegrees).
 * Range: -90 (straight down) to 0 (level forward).
 */
export const mavGimbalTiltStore = writable<number>(0);

/**
 * Gimbal pan (yaw) in degrees from MOUNT_STATUS.pointingB (centidegrees).
 * Range: -180 to +180.
 */
export const mavGimbalPanStore = writable<number>(0);

/**
 * Camera zoom multiplier. Updated by GimbalControl when a zoom command is sent.
 * Range: 1.0× – 10.0×.
 */
export const mavGimbalZoomStore = writable<number>(1.0);

/**
 * Combined gimbal state — single store for components that need all fields.
 * Kept in sync with the individual stores by the MOUNT_STATUS handler in
 * `+layout.svelte`. `zoom` is updated by the GimbalControl component.
 */
export const mavGimbalStore = writable<{
  pitch: number;
  roll: number;
  yaw: number;
  zoom: number;
}>({ pitch: 0, roll: 0, yaw: 0, zoom: 1.0 });

// ─── Arm guard ───────────────────────────────────────────────────────────────

/**
 * Optimistic arm state while a COMPONENT_ARM_DISARM command is in flight.
 *
 * - `null`  → no pending command; `mavArmedStateStore` reflects the real FC state.
 * - `true`  → arm command sent, waiting for COMMAND_ACK.
 * - `false` → disarm command sent, waiting for COMMAND_ACK.
 *
 * The HEARTBEAT handler skips `mavArmedStateStore` updates while this is non-null
 * to prevent race conditions between the optimistic UI and incoming heartbeats.
 */
export const mavPendingArmStore = writable<boolean | null>(null);
