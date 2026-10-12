/**
 * @file mavlink.ts
 * @module lib/api/mavlink
 * @description Shared client-side API helpers for all MAVLink interactions.
 *
 * Import these instead of writing inline fetch calls in each component.
 * Every function throws on HTTP errors so callers can handle them uniformly.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConnectionConfig {
  type: 'serial' | 'tcp' | 'udp';
  port?: string;
  host?: string;
  portNumber?: number;
  bindPort?: number;
}

export interface ConnectionStatus {
  connected: boolean;
  portOpen: boolean;
  online: boolean;
  connecting: boolean;
  type: 'serial' | 'tcp' | 'udp';
  udpHost: string | null;
  udpPort: number | null;
}

export interface HeartbeatResponse {
  logs: string[];
  portOpen: boolean;
  online: boolean;
}

// ─── Error class ─────────────────────────────────────────────────────────────

export class MavlinkApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly endpoint: string
  ) {
    super(message);
    this.name = 'MavlinkApiError';
  }
}

// ─── Internal helper ─────────────────────────────────────────────────────────

async function checkResponse(res: Response, endpoint: string): Promise<Response> {
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new MavlinkApiError(text, res.status, endpoint);
  }
  return res;
}

// ─── Connection ──────────────────────────────────────────────────────────────

/**
 * Initiates a MAVLink connection (serial, TCP or UDP).
 * The server persists the connection for the lifetime of the Node process.
 */
export async function connect(config: ConnectionConfig): Promise<ConnectionStatus> {
  const res = await fetch('/api/mavlink/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  await checkResponse(res, 'connect');
  return res.json();
}

/** Closes the active MAVLink connection. */
export async function disconnect(): Promise<void> {
  const res = await fetch('/api/mavlink/disconnect', { method: 'POST' });
  await checkResponse(res, 'disconnect');
}

/** Returns current connection status without side effects. */
export async function getStatus(): Promise<ConnectionStatus> {
  const res = await fetch('/api/mavlink/status', { method: 'POST' });
  await checkResponse(res, 'status');
  return res.json();
}

/**
 * Polls for new MAVLink log lines and connection status.
 * Called by the layout on a 1.1 s interval.
 */
export async function heartbeat(): Promise<HeartbeatResponse> {
  const res = await fetch('/api/mavlink/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) return { logs: [], portOpen: false, online: false };
  return res.json();
}

/** Returns available serial ports on the server host. */
export async function listPorts(): Promise<{ path: string; manufacturer?: string; vendorId?: string; productId?: string }[]> {
  const res = await fetch('/api/mavlink/list_ports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  await checkResponse(res, 'list_ports');
  return res.json();
}

// ─── Commands ────────────────────────────────────────────────────────────────

/**
 * Sends a MAVLink command to the flight controller.
 *
 * @param command - MAVLink command name (e.g. 'DO_SET_MODE', 'COMPONENT_ARM_DISARM')
 * @param params  - Comma-separated parameter string (e.g. '1,4') or array of numbers
 * @param useCmdLong - Whether to use COMMAND_LONG instead of COMMAND_INT
 * @param useArduPilotMega - Whether to use the ArduPilotMega dialect
 */
export async function sendCommand(
  command: string,
  params: string | number[] = '',
  useCmdLong = false,
  useArduPilotMega = false
): Promise<void> {
  const paramsStr = Array.isArray(params) ? params.join(',') : params;
  const res = await fetch('/api/mavlink/send_command', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      command,
      params: paramsStr,
      useCmdLong: String(useCmdLong),
      useArduPilotMega: String(useArduPilotMega)
    }
  });
  await checkResponse(res, 'send_command');
}

/**
 * Sets the drone's local position target (GUIDED mode).
 */
export async function setPositionLocal(x: number, y: number, z: number): Promise<void> {
  const res = await fetch('/api/mavlink/set_position_local', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      x: String(x),
      y: String(y),
      z: String(z)
    }
  });
  await checkResponse(res, 'set_position_local');
}

/**
 * Commands the drone to a specific altitude (meters, relative AGL).
 */
export async function setAltitude(altitudeMeters: number): Promise<void> {
  const res = await fetch('/api/mavlink/set_altitude', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      altitude: String(altitudeMeters)
    }
  });
  await checkResponse(res, 'set_altitude');
}

// ─── Mission ─────────────────────────────────────────────────────────────────

/** Clears all mission items from the flight controller. */
export async function clearMission(): Promise<void> {
  const res = await fetch('/api/mavlink/clear_mission', {
    method: 'POST',
    headers: { 'content-type': 'application/json' }
  });
  await checkResponse(res, 'clear_mission');
}

/** Uploads mission items to the flight controller. */
export async function loadMission(actions: object): Promise<void> {
  const res = await fetch('/api/mavlink/load_mission', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      actions: JSON.stringify(actions)
    }
  });
  await checkResponse(res, 'load_mission');
}

// ─── Parameters ──────────────────────────────────────────────────────────────

/** Requests the full parameter list from the flight controller. */
export async function requestParams(): Promise<void> {
  const res = await fetch('/api/mavlink/request_params', {
    method: 'POST',
    headers: { 'content-type': 'application/json' }
  });
  await checkResponse(res, 'request_params');
}

/**
 * Writes a single parameter to the flight controller.
 *
 * @param id    - Parameter ID (≤16 chars, will be null-padded on server)
 * @param value - Numeric value (will be type-clamped)
 * @param type  - MAVLink param type (1=uint8 … 10=double)
 */
export async function writeParam(id: string, value: number, type: number): Promise<void> {
  // Remove any surrounding quotes that may have been introduced by JSON parsing
  const cleanId = id.replace(/^"|"$/g, '');
  const res = await fetch('/api/mavlink/write_param', {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      id: cleanId,
      value: String(value),
      type: String(type)
    }
  });
  await checkResponse(res, 'write_param');
}
