import { writable } from 'svelte/store';

export const loading = writable(false);
export const success = writable<string | null>(null);
export const error = writable<string | null>(null);
