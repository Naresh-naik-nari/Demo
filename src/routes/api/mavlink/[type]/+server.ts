/**
 * @file +server.ts
 * @route POST /api/mavlink/[type]
 * @description Single POST handler that routes all MAVLink operations from the
 * client to the server-side MAVLink singleton. The `type` path parameter
 * selects the operation; each case validates its inputs and returns a typed
 * JSON or plain-text response.
 */

import type { RequestHandler } from '@sveltejs/kit';
import { errorResponse } from '$lib/server/errors';
import {
    initializePort,
    forceConnect,
    forceDisconnect,
    getConnectionStatus,
    requestParameters,
    writeParameter,
    sendMavlinkCommand,
    setMissionCount,
    loadMissionItem,
    clearAllMissionItems,
    setPositionLocal,
    setAltitudeGlobal,
    newLogs,
} from '$lib/server/mavlink';

// ─── Shared response helpers ──────────────────────────────────────────────────

const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

const text = (message: string, status = 200) =>
    new Response(message, { status });

const badRequest = (message: string) => text(message, 400);

// ─── Handler ─────────────────────────────────────────────────────────────────

export const POST: RequestHandler = async (event): Promise<Response> => {
    const { type } = event.params;

    switch (type) {

        // ── Heartbeat / status ─────────────────────────────────────────────
        case 'heartbeat': {
            try {
                await initializePort();
                const status = getConnectionStatus();
                // Drain new logs atomically (splice mutates S.newLogs in place)
                const logsToSend = newLogs.splice(0);
                return json({ logs: logsToSend, portOpen: status.portOpen, online: status.online });
            } catch (err) {
                console.error('[heartbeat]', err);
                return json({ logs: [], portOpen: false, online: false });
            }
        }

        case 'status': {
            return json(getConnectionStatus());
        }

        // ── Connection management ──────────────────────────────────────────
        case 'connect': {
            try {
                const body = await event.request.json();
                const { type: connType, port, host, portNumber, bindPort } = body;

                if (!connType) return badRequest('Connection type not specified');

                await forceConnect({ type: connType, port, host, portNumber, bindPort });
                return json(getConnectionStatus());
            } catch (err) {
                return errorResponse(err);
            }
        }

        case 'select_port': {
            const portPath = event.request.headers.get('port');
            if (!portPath) return badRequest('Port not specified');
            try {
                await forceConnect({ type: 'serial', port: portPath });
                return json(getConnectionStatus());
            } catch (err) {
                // Return current status + error so the UI can display it
                return json({ ...getConnectionStatus(), error: (err as Error).message });
            }
        }

        case 'disconnect': {
            try {
                await forceDisconnect();
            } catch {
                // Disconnect errors are non-fatal — always return disconnected state
            }
            return json({ connected: false, portOpen: false, online: false });
        }

        case 'list_ports': {
            try {
                const { SerialPort } = await import('serialport');
                const portList = await SerialPort.list();
                return json(portList);
            } catch (err) {
                console.error('[list_ports]', err);
                return json([]);
            }
        }

        // ── Commands ───────────────────────────────────────────────────────
        case 'send_command': {
            const command = event.request.headers.get('command');
            if (!command) return badRequest('Command not provided');

            const paramsHeader = event.request.headers.get('params');
            const params: number[] = paramsHeader
                ? paramsHeader.split(',').map((p) => parseFloat(p))
                : [];

            const useCmdLong      = event.request.headers.get('useCmdLong')      === 'true';
            const useArduPilotMega = event.request.headers.get('useArduPilotMega') === 'true';

            try {
                await sendMavlinkCommand(command, params, useCmdLong, useArduPilotMega);
                console.log(`[send_command] ${command} params=[${params}]`);
                return text(`MAVLink command sent: ${command}, params: [${params}]`);
            } catch (err) {
                return errorResponse(err);
            }
        }

        // ── Mission ────────────────────────────────────────────────────────
        case 'clear_mission': {
            try {
                await clearAllMissionItems();
                return text('MAVLink missions cleared');
            } catch (err) {
                return errorResponse(err);
            }
        }

        case 'load_mission': {
            const actionsHeader = event.request.headers.get('actions');
            if (!actionsHeader) return badRequest('Actions not provided');

            try {
                const actions = JSON.parse(actionsHeader);
                const count   = Object.keys(actions).length;
                await setMissionCount(count);

                // Upload items sequentially with a small delay to avoid overwhelming the FC
                for (const [key, val] of Object.entries(actions)) {
                    await new Promise<void>((resolve) => setTimeout(resolve, 250));
                    await loadMissionItem(val, parseInt(key));
                }

                return text('MAVLink mission loaded');
            } catch (err) {
                return errorResponse(err);
            }
        }

        // ── Position / altitude ────────────────────────────────────────────
        case 'set_position_local': {
            const x = parseInt(event.request.headers.get('x') ?? '');
            const y = parseInt(event.request.headers.get('y') ?? '');
            const z = parseInt(event.request.headers.get('z') ?? '');

            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                return badRequest('Invalid coordinates — x, y, z must be integers');
            }

            try {
                await setPositionLocal(x, y, z);
                return text(`Local position set: x=${x}, y=${y}, z=${z}`);
            } catch (err) {
                return errorResponse(err);
            }
        }

        case 'set_altitude': {
            const altMeters = parseFloat(event.request.headers.get('altitude') ?? '');
            if (isNaN(altMeters) || altMeters < 0) {
                return badRequest('Invalid altitude — must be a non-negative number');
            }

            try {
                await setAltitudeGlobal(altMeters);
                return text(`Altitude target set: ${altMeters} m`);
            } catch (err) {
                return errorResponse(err);
            }
        }

        // ── Parameters ─────────────────────────────────────────────────────
        case 'request_params': {
            try {
                await requestParameters();
                return text('Parameters requested');
            } catch (err) {
                return errorResponse(err);
            }
        }

        case 'write_param': {
            const id    = event.request.headers.get('id');
            const value = parseFloat(event.request.headers.get('value') ?? '');
            const ptype = parseInt(event.request.headers.get('type')  ?? '');

            if (!id)              return badRequest('Parameter id not provided');
            if (isNaN(value))     return badRequest('Invalid parameter value');
            if (isNaN(ptype))     return badRequest('Invalid parameter type');

            try {
                // Null-pad id to 16 chars per MAVLink spec:
                // https://mavlink.io/en/services/parameter.html#parameter-names
                const processedId = id.padEnd(16, '\0');
                await writeParameter(processedId, value, ptype);
                console.log(`[write_param] ${processedId} = ${value} (type ${ptype})`);
                return text(`Parameter written: ${processedId} = ${value}`);
            } catch (err) {
                return errorResponse(err);
            }
        }

        // ── Fallthrough ────────────────────────────────────────────────────
        default:
            return badRequest(`Unknown MAVLink operation: "${type}"`);
    }
};
