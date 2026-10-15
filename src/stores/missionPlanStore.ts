/**
 * @file missionPlanStore.ts
 * @module stores/missionPlanStore
 * @description Svelte writable stores for the currently loaded mission plan
 * and its execution progress.
 *
 * A "mission plan" is an ordered map of MAVLink waypoint actions. It lives in
 * memory here and is persisted to SQLite via `/api/mission/*` endpoints.
 * The flight controller receives the plan via `/api/mavlink/load_mission`.
 */

import { writable } from 'svelte/store';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A single waypoint action in a mission plan.
 * Mirrors a MAVLink MISSION_ITEM_INT message with extra GCS metadata.
 */
export interface MissionPlanItem {
  /** MAVLink command name (e.g. 'NAV_WAYPOINT', 'NAV_TAKEOFF'). */
  type: string;
  /** Latitude in decimal degrees. */
  lat: number;
  /** Longitude in decimal degrees. */
  lon: number;
  /** Altitude in metres (relative to home). `null` = use current altitude. */
  alt: number | null;
  /** Free-text operator notes (GCS-only, not uploaded to FC). */
  notes: string;
  /** MAVLink param1 – param4 for the command. `null` = not used. */
  param1: number | null;
  param2: number | null;
  param3: number | null;
  param4: number | null;
  /** Allows dynamic string-index access (e.g. `item['param1']`). */
  [key: string]: unknown;
}

/**
 * The full mission plan as a numeric-keyed object.
 * Index 0 is always the takeoff point (home); subsequent indices are waypoints.
 */
export type MissionPlanActions = Record<number, MissionPlanItem>;

// ─── Stores ───────────────────────────────────────────────────────────────────

/** Human-readable title of the currently loaded mission plan. Empty string = no plan. */
export const missionPlanTitleStore = writable<string>('');

/**
 * The waypoint actions of the currently loaded mission plan.
 * Updated by map clicks (new waypoints) and by loading from the DB.
 * Synced to the flight controller via `/api/mavlink/load_mission`.
 */
export const missionPlanActionsStore = writable<MissionPlanActions>({});

/**
 * Total number of waypoints in the loaded plan (derived from `missionPlanActionsStore`).
 * Updated reactively in `+layout.svelte`:
 * `$: missionCountStore.set(Object.keys($missionPlanActionsStore).length - 1)`
 */
export const missionCountStore = writable<number>(0);

/**
 * Index of the waypoint the vehicle is currently flying toward.
 * Updated from MISSION_CURRENT MAVLink messages.
 */
export const missionIndexStore = writable<number>(0);

/**
 * `true` when all waypoints have been reached (MISSION_ITEM_REACHED at last index).
 * Initialised to `false` (no mission running). Reset to `false` when a new
 * mission is loaded or started.
 */
export const missionCompleteStore = writable<boolean>(false);
