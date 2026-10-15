/**
 * @file customizationStore.ts
 * @module stores/customizationStore
 * @description User-preference stores for UI appearance (colours, dark mode,
 * audio notifications). Values are applied as CSS custom properties on each
 * `.dashboard` element and toggled as `body.dark-mode` for global overrides.
 *
 * Light-mode colour overrides are applied in `+layout.svelte → toggleDarkMode()`.
 */

import { writable } from 'svelte/store';

// ─── Audio ────────────────────────────────────────────────────────────────────

/**
 * When `true`, warning and error notifications are also read aloud via the
 * Web Speech API (`speechSynthesis`).
 *
 * Note: Intentional typo preserved for backwards compatibility — renaming this
 * would require updating all subscribers. Prefer `audoNotificationStore` as-is.
 */
export const audoNotificationStore = writable<boolean>(true);

// ─── Theme ────────────────────────────────────────────────────────────────────

/**
 * `true` = dark mode (default), `false` = light mode.
 * Controls `body.dark-mode` class and drives the CSS custom property values below.
 */
export const darkModeStore = writable<boolean>(true);

/**
 * Primary background colour used for dashboard panels and nav.
 * Dark default: `#1c1c1e` | Light: `#ffffff` (set by `toggleDarkMode`).
 */
export const primaryColorStore = writable<string>('#1c1c1e');

/**
 * Secondary background used for inset cards and table rows.
 * Dark default: `#121212` | Light: `#e7e9ef`.
 */
export const secondaryColorStore = writable<string>('#121212');

/**
 * Tertiary background used for separators, borders, and hover states.
 * Dark default: `#2d2d2d` | Light: `#d7d7d7`.
 */
export const tertiaryColorStore = writable<string>('#2d2d2d');
