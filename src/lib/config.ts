/**
 * @file config.ts
 * @module lib/config
 * @description Centralised access point for all environment variables.
 *
 * Import from here instead of reading `import.meta.env` or `process.env`
 * directly in components and routes. This makes it easy to find every place
 * an env var is used, add validation, or provide defaults in one location.
 *
 * VITE_* variables are client-safe (bundled into the browser bundle).
 * Non-VITE_* variables must only be accessed in server-side code.
 */

// ─── Client-side (VITE_*) ────────────────────────────────────────────────────

/**
 * Port of the video streaming server.
 * Corresponds to `VITE_VIDEO_PORT` in .env.
 * @default '8889'
 */
export const VIDEO_PORT: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VIDEO_PORT) || '8889';

/**
 * URL path segment for the video stream endpoint.
 * Corresponds to `VITE_VIDEO_PATH` in .env.
 * @default 'cam'
 */
export const VIDEO_PATH: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VIDEO_PATH) || 'cam';

/**
 * MapTiler API key for the 3D map view.
 * Corresponds to `VITE_MAPTILER_KEY` in .env.
 * @default '' (map will not render without a valid key)
 */
export const MAPTILER_KEY: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MAPTILER_KEY) || '';

/**
 * Altitude Angel API key for airspace overlay data.
 * Corresponds to `VITE_ALTITUDE_ANGEL_API_KEY` in .env.
 * @default ''
 */
export const ALTITUDE_ANGEL_API_KEY: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ALTITUDE_ANGEL_API_KEY) || '';
