/**
 * @file errors.ts
 * @module lib/server/errors
 * @description Typed error classes for the server-side MAVLink layer.
 *
 * Using typed errors instead of plain `Error` objects gives callers a
 * structured way to distinguish connection failures, command rejections,
 * and validation problems — and produce appropriate HTTP status codes.
 */

// ─── Base ─────────────────────────────────────────────────────────────────────

/**
 * Base class for all Sidak GCS server errors.
 * All derived types set `name` so `instanceof` checks work across module
 * boundaries even after transpilation.
 */
export class GCSError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GCSError';
  }
}

// ─── Connection ──────────────────────────────────────────────────────────────

/**
 * Thrown when a MAVLink transport cannot be opened or has been lost.
 * Maps to HTTP 503 (Service Unavailable).
 */
export class ConnectionError extends GCSError {
  constructor(
    message: string,
    /** The OS-level path or address that failed, if known. */
    public readonly address?: string
  ) {
    super(message);
    this.name = 'ConnectionError';
  }
}

/**
 * Thrown when the OS denies access to a serial port (e.g. in use by another
 * process, insufficient permissions).
 * Maps to HTTP 503.
 */
export class PortAccessDeniedError extends ConnectionError {
  constructor(portPath: string) {
    super(
      `Access denied on ${portPath}. Close any other program using this port and try again.`,
      portPath
    );
    this.name = 'PortAccessDeniedError';
  }
}

/**
 * Thrown when no suitable MAVLink serial port can be found during auto-detection.
 * Maps to HTTP 503.
 */
export class NoPortFoundError extends ConnectionError {
  constructor() {
    super('No MAVLink serial port detected. Connect your flight controller and try again.');
    this.name = 'NoPortFoundError';
  }
}

// ─── Command ─────────────────────────────────────────────────────────────────

/**
 * Thrown when a MAVLink command name cannot be resolved to a known enum value.
 * Maps to HTTP 400 (Bad Request).
 */
export class UnknownCommandError extends GCSError {
  constructor(command: string) {
    super(`Unknown MAVLink command: "${command}"`);
    this.name = 'UnknownCommandError';
  }
}

/**
 * Thrown when the flight controller is not connected and a command is attempted.
 * Maps to HTTP 503.
 */
export class NotConnectedError extends GCSError {
  constructor() {
    super('Not connected to a MAVLink device. Establish a connection first.');
    this.name = 'NotConnectedError';
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Thrown when input parameters fail validation before being forwarded to the FC.
 * Maps to HTTP 400 (Bad Request).
 */
export class ValidationError extends GCSError {
  constructor(
    message: string,
    /** The field name that failed validation. */
    public readonly field?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

/**
 * Maps a GCS error instance to an appropriate HTTP status code.
 *
 * @example
 * } catch (err) {
 *   return new Response((err as Error).message, { status: errorToStatus(err) });
 * }
 */
export function errorToStatus(err: unknown): number {
  if (err instanceof ValidationError || err instanceof UnknownCommandError) return 400;
  if (
    err instanceof PortAccessDeniedError ||
    err instanceof NoPortFoundError ||
    err instanceof NotConnectedError ||
    err instanceof ConnectionError
  ) return 503;
  return 500;
}

/**
 * Returns a plain-text error response with the correct HTTP status code.
 * Logs the full stack to the server console.
 */
export function errorResponse(err: unknown): Response {
  const message = err instanceof Error ? err.message : String(err);
  const status  = errorToStatus(err);
  console.error(`[GCS Error] ${message}`, err instanceof Error ? err.stack : '');
  return new Response(message, { status });
}
