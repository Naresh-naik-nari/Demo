/**
 * @file notifications.ts
 * @module lib/utils/notifications
 * @description Utility for showing programmatic toast notifications and
 * optional text-to-speech alerts from anywhere in the application.
 *
 * Usage:
 *   import { showNotification } from '$lib/utils/notifications';
 *   showNotification({ title: 'Done', content: 'Mission saved.', type: 'success' });
 */

import Notification from '$lib/../components/Notification.svelte';
import { get } from 'svelte/store';
import { audoNotificationStore } from '$lib/../stores/customizationStore';

export type NotificationType = 'success' | 'warning' | 'error' | 'info';

export interface NotificationConfig {
  /** Short title displayed at the top of the toast */
  title: string;
  /** Body text — supports limited HTML (e.g. `<br>`) */
  content: string;
  /** Visual style / severity of the notification */
  type: NotificationType;
  /** Auto-dismiss duration in milliseconds (default: 10 000) */
  duration?: number;
}

/**
 * Programmatically mounts a Notification component at `document.body`,
 * and optionally speaks the content via the Web Speech API.
 *
 * Safe to call before DOM is ready (no-op server-side due to Svelte SSR guards).
 */
export function showNotification(config: NotificationConfig): void {
  if (typeof document === 'undefined') return; // SSR guard

  const notification = new Notification({
    target: document.body,
    props: {
      title: config.title,
      content: config.content,
      type: config.type
    }
  });

  const audioEnabled = get(audoNotificationStore);
  if (audioEnabled && (config.type === 'warning' || config.type === 'error')) {
    const utterance = new SpeechSynthesisUtterance(config.content);
    speechSynthesis.speak(utterance);
  }

  setTimeout(() => notification.$destroy(), config.duration ?? 10_000);
}
