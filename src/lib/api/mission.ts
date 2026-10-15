/**
 * @file mission.ts
 * @module lib/api/mission
 * @description Shared client-side API helpers for mission plan persistence.
 *
 * All mission CRUD operations go through these functions instead of raw
 * fetch calls scattered across components. Throws `MissionApiError` on
 * HTTP errors so callers can handle them uniformly.
 */

import type { MissionPlanActions } from '$lib/../stores/missionPlanStore';

// ─── Error class ─────────────────────────────────────────────────────────────

export class MissionApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly endpoint: string
  ) {
    super(message);
    this.name = 'MissionApiError';
  }
}

// ─── Internal helper ─────────────────────────────────────────────────────────

async function checkResponse(res: Response, endpoint: string): Promise<Response> {
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new MissionApiError(text, res.status, endpoint);
  }
  return res;
}

const POST = (headers: Record<string, string> = {}) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MissionRecord {
  id: string;
  title: string;
  actions: string; // JSON-encoded MissionPlanActions
  isLoaded: number; // 1 = loaded, 0 = not loaded
}

// ─── API calls ────────────────────────────────────────────────────────────────

/** Returns all saved mission plans from the database. */
export async function listMissions(): Promise<MissionRecord[]> {
  const res = await fetch('/api/mission/list', POST());
  await checkResponse(res, 'list');
  return res.json();
}

/**
 * Saves a new mission plan. Marks it as loaded (isLoaded=1).
 * Throws if the title already exists — call `updateMission` instead.
 */
export async function saveMission(title: string, actions: MissionPlanActions): Promise<void> {
  const res = await fetch('/api/mission/save', POST({
    title,
    actions: JSON.stringify(actions),
  }));
  await checkResponse(res, 'save');
}

/** Updates an existing mission plan's actions. */
export async function updateMission(title: string, actions: MissionPlanActions): Promise<void> {
  const res = await fetch('/api/mission/update', POST({
    title,
    actions: JSON.stringify(actions),
  }));
  await checkResponse(res, 'update');
}

/** Marks a mission as the active loaded plan (sets isLoaded=1 for this title). */
export async function loadMissionRecord(title: string): Promise<void> {
  const res = await fetch('/api/mission/load', POST({ title }));
  await checkResponse(res, 'load');
}

/** Clears the isLoaded flag from all missions. */
export async function unloadAllMissions(): Promise<void> {
  const res = await fetch('/api/mission/unload', POST());
  await checkResponse(res, 'unload');
}

/** Deletes a mission plan by title. */
export async function deleteMission(title: string): Promise<void> {
  const res = await fetch('/api/mission/delete', POST({ title }));
  await checkResponse(res, 'delete');
}

/** Returns true if a mission with the given title already exists. */
export async function missionExists(title: string): Promise<boolean> {
  const res = await fetch('/api/mission/checkExists', POST({ title }));
  await checkResponse(res, 'checkExists');
  const data = await res.json();
  return Array.isArray(data) ? data.length > 0 : false;
}

/**
 * Saves or updates a mission (upsert). Automatically calls `saveMission` for
 * new titles and `updateMission` for existing ones.
 */
export async function upsertMission(title: string, actions: MissionPlanActions): Promise<void> {
  const exists = await missionExists(title);
  if (exists) {
    await updateMission(title, actions);
  } else {
    await saveMission(title, actions);
  }
}
