/**
 * @file notificationCountStore.ts
 * @module stores/notificationCountStore
 * @description Tracks the number of active toast notifications currently
 * rendered in the DOM.
 *
 * `Notification.svelte` increments this on mount and decrements on destroy.
 * The count is used to position stacked notifications without them overlapping.
 */

import { writable } from 'svelte/store';

/**
 * Count of currently visible toast notifications.
 * Used internally by `Notification.svelte` to compute vertical offsets.
 */
export const notificationCountStore = writable<number>(0);
