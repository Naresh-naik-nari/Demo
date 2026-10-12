/**
 * @file format.ts
 * @module lib/utils/format
 * @description Pure formatting utilities used across the application.
 * No side effects, no imports from stores — safe to use anywhere.
 */

// ─── Time ─────────────────────────────────────────────────────────────────────

/**
 * Formats a duration in seconds as `HH:MM:SS`.
 *
 * @example formatDuration(3661) // '01:01:01'
 */
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

// ─── String ───────────────────────────────────────────────────────────────────

/**
 * Converts a SCREAMING_SNAKE_CASE or UPPER_CASE string to Proper Case.
 *
 * @example toProperCase('FIXED_WING') // 'Fixed Wing'
 */
export function toProperCase(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
}

// ─── Coordinates ─────────────────────────────────────────────────────────────

/**
 * Converts decimal degrees to a Degrees-Minutes-Seconds string.
 *
 * @example toDMS(33.7490, 'N', 'S') // '33° 44\' 56.40" N'
 */
export function toDMS(decimal: number, posLabel: string, negLabel: string): string {
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const min = Math.floor((abs - deg) * 60);
  const sec = ((abs - deg - min / 60) * 3600).toFixed(2);
  const dir = decimal >= 0 ? posLabel : negLabel;
  return `${deg}° ${min}' ${sec}" ${dir}`;
}

// ─── Battery ─────────────────────────────────────────────────────────────────

/**
 * Returns a Tailwind-compatible color class string based on battery percentage.
 * Used by Stats and ArtificialHorizon components.
 */
export function batteryColorClass(level: number | null): string {
  if (level === null) return 'text-gray-400';
  if (level > 50) return 'text-green-400';
  if (level > 20) return 'text-yellow-400';
  return 'text-red-400';
}
