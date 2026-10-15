/**
 * @file mapStore.ts
 * @module stores/mapStore
 * @description Svelte writable stores for the Leaflet 2D map and MapLibre 3D map
 * instances, including waypoint markers, polylines, and view-control state.
 *
 * Leaflet instances (Map, Marker, Polyline) are stored as opaque references.
 * The `L` namespace is client-only, so these stores hold `null` during SSR.
 */

import { writable } from 'svelte/store';

// ─── 2D map (Leaflet) ─────────────────────────────────────────────────────────

/**
 * The active Leaflet `L.Map` instance.
 * Set once `Map.svelte` mounts; `null` before mount or after destroy.
 */
export const mapStore = writable<import('leaflet').Map | null>(null);

/**
 * Waypoint marker map, keyed by the waypoint index in `missionPlanActionsStore`.
 * Used by `Stats.svelte` and `SwathDisplay.svelte` to compute distances and ETAs.
 */
export const markersStore = writable<Map<number, import('leaflet').Marker>>(new Map());

/**
 * Route polyline map, keyed by a `"from-to"` string (e.g. `"0-1"`, `"1-2"`).
 * Cleared and rebuilt whenever the mission plan changes.
 */
export const polylinesStore = writable<Map<string, import('leaflet').Polyline>>(new Map());

/**
 * Name of the currently active tile layer.
 * @example 'OpenStreetMap', 'Satellite', 'DSM'
 */
export const mapTypeStore = writable<string>('OpenStreetMap');

/**
 * The active `L.TileLayer` instance.
 * Replaced when the user switches map type.
 */
export const mapTileLayerStore = writable<import('leaflet').TileLayer | null>(null);

/**
 * Current Leaflet zoom level (integer 1–22).
 * Synced bidirectionally with the map's zoom events.
 * @default 18
 */
export const mapZoomStore = writable<number>(18);

/**
 * When `true`, the map camera automatically follows the drone position.
 * Toggled by the lock/unlock button in `Map.svelte`.
 * @default true
 */
export const lockViewStore = writable<boolean>(true);

// ─── 3D map (MapLibre GL) ─────────────────────────────────────────────────────

/**
 * The active MapLibre GL `Map` instance used by `3DMap.svelte`.
 * `null` before the component mounts.
 */
export const threeDMapStore = writable<unknown>(null);
