/**
 * @file authStore.ts
 * @module stores/authStore
 * @description Client-side authentication state.
 *
 * `loggedInStore` drives navigation guards in `+layout.svelte`. It is set to
 * `true` after a successful login and back to `false` on logout or session
 * timeout (10 minutes of inactivity tracked via the `lastActivity` cookie).
 *
 * Server-side route protection is handled separately in `+layout.server.ts`
 * via the Lucia session cookie, which is the authoritative source of truth.
 * This client store is only used for immediate UI reactions (nav visibility,
 * redirect-before-fetch).
 */

import { writable } from 'svelte/store';

/**
 * `true` when the user has an active session in this tab.
 * Updated by `+layout.svelte` after login / logout / activity timeout.
 */
export const loggedInStore = writable<boolean>(false);
