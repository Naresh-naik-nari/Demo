import { SerialPort } from 'serialport';
import { connect, type Socket } from 'net';
import {
    MavLinkPacketSplitter,
    MavLinkPacketParser,
    common,
    ardupilotmega,
    send
} from 'node-mavlink';
import { REGISTRY } from '$lib/server/mavlink-registry';

// ─── Singleton state on globalThis ───────────────────────────────────────────
// Persists across Vite HMR reloads since globalThis survives module re-execution.
declare const globalThis: any;

// HMR cleanup: properly close and release the COM handle on Vite hot reload
if (globalThis.__mav?.port) {
    console.log('♻️ HMR reload — releasing orphaned port...');
    const _p = globalThis.__mav.port;
    try { _p.removeAllListeners(); } catch { /* ignore */ }
    try { globalThis.__mav.reader?.removeAllListeners(); } catch { /* ignore */ }
    globalThis.__mav.port         = null;
    globalThis.__mav.reader       = null;
    globalThis.__mav.online       = false;
    globalThis.__mav.connecting   = false;
    globalThis.__mav.accessDenied = false;
    globalThis.__mav.promise      = null;
    // Stop the USB watcher so it doesn't stack on reload
    if (globalThis.__mav.usbWatchInterval) {
        clearInterval(globalThis.__mav.usbWatchInterval);
        globalThis.__mav.usbWatchInterval = null;
    }
    // Use close() so Windows releases the handle before the module re-runs
    try {
        _p.close(() => { try { _p.destroy(); } catch { /* ignore */ } });
    } catch {
        try { _p.destroy(); } catch { /* ignore */ }
    }
}

if (!globalThis.__mav) {
    globalThis.__mav = {
        port:              null as SerialPort | Socket | null,
        reader:            null as MavLinkPacketParser | null,
        online:            false,
        connecting:        false,
        accessDenied:      false,
        logs:              [] as string[],
        newLogs:           [] as string[],
        promise:           null as Promise<void> | null,
        lastKnownPorts:    [] as string[],  // for USB hotplug detection
        usbWatchInterval:  null as NodeJS.Timeout | null,
    };
}
const S = globalThis.__mav;

// ─── USB Hotplug watcher ──────────────────────────────────────────────────────
// Polls serial ports every 2s — when a new port appears, auto-connects if
// it looks like a flight controller and we're not already connected.
if (!S.usbWatchInterval) {
    // Seed lastKnownPorts with current ports so we don't treat existing
    // ports as "new" on first run
    SerialPort.list().then((ports: any[]) => {
        S.lastKnownPorts = ports.map((p: any) => p.path);
    }).catch(() => {});

    S.usbWatchInterval = setInterval(async () => {
        // Skip if already connected or connecting
        if (S.port || S.connecting || S.online) return;

        try {
            const ports = await SerialPort.list();
            const currentPaths: string[] = ports.map((p: any) => p.path);

            // Find genuinely new ports (plugged in since last scan)
            const newPorts = currentPaths.filter(
                (p: string) => !S.lastKnownPorts.includes(p)
            );

            S.lastKnownPorts = currentPaths;

            if (newPorts.length > 0) {
                console.log(`🔌 New USB device detected: ${newPorts.join(', ')} — attempting auto-connect...`);
                // Small delay to let Windows finish enumerating the device
                await new Promise(r => setTimeout(r, 1500));
                try {
                    await forceConnect();
                } catch {
                    // Silent — not every new USB device is a flight controller
                }
            }
        } catch { /* ignore scan errors */ }
    }, 2000);
    console.log('👀 USB hotplug watcher started');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getPort()   { return S.port as SerialPort | Socket | null; }
function getReader() { return S.reader as MavLinkPacketParser | null; }

/**
 * Auto-detect the best MAVLink port:
 * 1. Use USB_SERIAL_PORT env var if set
 * 2. Known flight controller vendor IDs (CubePilot, Pixhawk, mRo, HolyBro, etc.)
 * 3. Any USB serial port that's not a system/Intel device
 */
async function detectPort(): Promise<string | null> {
    const envPort = process.env.USB_SERIAL_PORT;
    if (envPort) return envPort;

    try {
        const ports = await SerialPort.list();

        // Known flight controller vendor IDs
        const knownVIDs: Record<string, string> = {
            '2dae': 'CubePilot',       // Cube Orange, Cube Black, etc.
            '26ac': 'Pixhawk/3DR',     // Pixhawk 1, 2, 4, 6
            '1209': 'mRo / generic',   // mRo Pixracer, Pixhawk
            '0483': 'STMicro/HolyBro', // Pixhawk 4, 5, 6 (STM32 DFU)
            '27ac': 'Pixhawk',         // Some Pixhawk variants
            '2e68': 'Foxeer',
            '1fc9': 'NXP FMUK66',
            '16d0': 'mRo',
            '04b4': 'Cypress/Auterion',
        };

        // Priority 1: Known FC by vendor ID — prefer MAVLink-named port if multiple
        for (const [vid, name] of Object.entries(knownVIDs)) {
            const mavlinkPort = ports.find(p =>
                p.vendorId?.toLowerCase() === vid &&
                (p as any).friendlyName?.toLowerCase().includes('mavlink')
            );
            if (mavlinkPort) {
                console.log(`🔍 Detected ${name} MAVLink port: ${mavlinkPort.path}`);
                return mavlinkPort.path;
            }

            const anyPort = ports.find(p => p.vendorId?.toLowerCase() === vid);
            if (anyPort) {
                console.log(`🔍 Detected ${name} port: ${anyPort.path}`);
                return anyPort.path;
            }
        }

        // Priority 2: Any USB serial port that isn't a system device
        const systemManufacturers = ['intel', 'microsoft', 'generic', 'prolific bluetooth'];
        const usbPort = ports.find(p =>
            (p.pnpId?.toUpperCase().startsWith('USB') || p.locationId) &&
            !systemManufacturers.some(m => p.manufacturer?.toLowerCase().includes(m))
        );
        if (usbPort) {
            console.log(`🔍 Using USB serial port: ${usbPort.path} (${usbPort.manufacturer ?? 'unknown manufacturer'})`);
            return usbPort.path;
        }

        // Priority 3: Any available port (last resort)
        if (ports.length > 0) {
            console.log(`🔍 Falling back to first available port: ${ports[0].path}`);
            return ports[0].path;
        }

    } catch (e) {
        console.error('Port detection failed:', e);
    }
    return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Called by Connect button — opens the port */
async function forceConnect(portOverride?: string): Promise<void> {
    if (S.connecting) {
        console.log('⏳ Already connecting...');
        return S.promise ?? Promise.resolve();
    }
    if (getPort() && getReader()) {
        console.log('✅ Already connected');
        return;
    }
    if (portOverride) {
        process.env.USB_SERIAL_PORT = portOverride;
        S.accessDenied = false;
    }

    S.promise = _openPort().finally(() => { S.promise = null; });
    return S.promise;
}

/** Called by Disconnect button */
async function forceDisconnect(): Promise<void> {
    await _closePort();
}

/** Called by heartbeat — only reads data, never opens port */
async function initializePort(): Promise<void> {
    if (getPort() && getReader()) await requestStatus();
}

/** Alias for API backward compat */
async function closeExistingConnection(): Promise<void> {
    await _closePort();
}

function getConnectionStatus() {
    return {
        connected:  !!(getPort() && getReader() && S.online),
        portOpen:   !!(getPort()),
        online:     S.online as boolean,
        connecting: S.connecting as boolean,
    };
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function _openPort(): Promise<void> {
    S.connecting = true;

    let portPath: string | null = null;
    try {
        portPath = await detectPort();
        if (!portPath) throw new Error('No MAVLink serial port found. Connect your device and try again.');

        const baudRate = parseInt(process.env.USB_BAUD_RATE || '115200');
        console.log(`🔌 Opening ${portPath} at ${baudRate} baud...`);

        const sp = new SerialPort({ path: portPath, baudRate, lock: false, autoOpen: false });
        S.port = sp;

        // Open the port
        await new Promise<void>((resolve, reject) => {
            sp.open((err) => {
                if (err) reject(new Error(`Cannot open ${portPath}: ${err.message}`));
                else resolve();
            });
        });
        console.log(`✅ ${portPath} opened — waiting for MAVLink data...`);

        // Wait up to 10s for first byte
        await new Promise<void>((resolve) => {
            const t = setTimeout(() => {
                console.warn(`⚠️ No data from ${portPath} after 10s — port open but silent`);
                resolve();
            }, 10_000);
            sp.once('data', () => { clearTimeout(t); resolve(); });
            sp.once('error', () => { clearTimeout(t); resolve(); });
        });

        _attachReader();
        _attachListeners();
        console.log(`✅ Port initialized successfully (${portPath})`);

    } catch (err) {
        S.connecting = false;
        try { (S.port as any)?.destroy(); } catch { /* ignore */ }
        S.port = null;
        S.reader = null;
        S.online = false;
        const errMsg = (err as Error).message?.toLowerCase() ?? '';
        if (errMsg.includes('access denied')) {
            S.accessDenied = true;
            console.error(`❌ Access denied on ${portPath} — another program is using this port. Close it and reconnect.`);
        } else if (errMsg.includes('file not found') || errMsg.includes('does not exist')) {
            // Device unplugged mid-connect — clear stale env var so watcher picks the right port next time
            if (process.env.USB_SERIAL_PORT === portPath) {
                process.env.USB_SERIAL_PORT = '';
            }
            console.error(`❌ Port ${portPath} not found — device may have been unplugged.`);
        } else {
            console.error(`❌ Failed to initialize port:`, err);
        }
        throw err;
    }

    S.connecting = false;
}

async function _closePort(): Promise<void> {
    // Always reset state flags regardless of whether port is open
    S.accessDenied = false;
    S.connecting = false;

    const p = S.port;
    S.port = null;
    if (!p) return;
    console.log('🔌 Closing connection...');
    p.removeAllListeners();
    S.reader?.removeAllListeners();
    S.reader = null;
    S.online = false;

    // Use close() first — it flushes and properly releases the Windows COM handle.
    // destroy() alone does not reliably release the handle on Windows.
    await new Promise<void>((resolve) => {
        try {
            (p as SerialPort).close((err) => {
                if (err) console.warn('⚠️ Close warning:', err.message);
                try { (p as any).destroy(); } catch { /* ignore */ }
                resolve();
            });
        } catch {
            try { (p as any).destroy(); } catch { /* ignore */ }
            resolve();
        }
    });

    // Extra buffer for Windows to release the handle before any reconnect attempt
    await new Promise(r => setTimeout(r, 1500));
    console.log('✅ Connection closed');
}

function _attachReader(): void {
    S.reader = S.port!
        .pipe(new MavLinkPacketSplitter())
        .pipe(new MavLinkPacketParser());

    S.reader.on('data', (packet: any) => {
        S.online = true;
        const clazz = REGISTRY[packet.header.msgid];
        if (clazz) {
            const data = clazz ? packet.protocol.data(packet.payload, clazz) : null;
            if (!data) return;
            const sysId  = packet.header.systemId;
            const compId = packet.header.componentId;
            const entry = `${clazz.MSG_NAME}(${clazz.MAGIC_NUMBER})::${new Date().toISOString()}::sysid=${sysId},compid=${compId}::${JSON.stringify(convertBigIntToNumber(data))}`;
            S.logs.push(entry);
            S.newLogs.push(entry);
            if (entry.includes('_ACK') && !entry.includes('"command":512')) console.log(entry);
        }
    });
}

function _attachListeners(): void {
    S.port!.on('close', () => {
        console.log('⚠️ Port closed');
        S.port = null;
        S.reader = null;
        S.online = false;
        S.logs.push('MAVLink connection closed');
    });
    S.port!.on('error', (err: Error) => {
        console.error('❌ Port error:', err.message);
    });
}

// ─── MAVLink commands ─────────────────────────────────────────────────────────

async function requestStatus() {
    const p = getPort(); if (!p || !getReader()) { S.online = false; return; }
    for (const id of [common.GlobalPositionInt.MSG_ID, common.GpsRawInt.MSG_ID, common.MissionCurrent.MSG_ID, common.BatteryStatus.MSG_ID]) {
        const r = new common.RequestMessageCommand();
        r.targetSystem = 1; r.targetComponent = 1; r.messageId = id; r.responseTarget = 1;
        await send(p, r);
    }
}

async function requestParameters() {
    const p = getPort(); if (!p || !getReader()) { S.online = false; return; }
    const r = new common.ParamRequestList();
    r.targetSystem = 1; r.targetComponent = 1;
    await send(p, r);
}

async function writeParameter(id: string, value: number, type: number) {
    const p = getPort(); if (!p || !getReader()) { S.online = false; return; }
    const r = new common.ParamSet();
    r.targetSystem = 1; r.targetComponent = 1; r.paramId = id; r.paramValue = value; r.paramType = type;
    await send(p, r);
}

async function sendMavlinkCommand(command: string, params: number[], useCmdLong = false, useArduPilotMega = false) {
    const p = getPort(); if (!p || !getReader()) { S.online = false; return; }
    let msg: common.CommandInt | common.CommandLong;
    if (useCmdLong) msg = new common.CommandLong();
    else { msg = new common.CommandInt(); msg.frame = 0; }
    msg.targetSystem = 1; msg.targetComponent = 1;
    if (useArduPilotMega) msg.command = parseInt(`${ardupilotmega.MavCmd[command as keyof typeof ardupilotmega.MavCmd]}`);
    else msg.command = common.MavCmd[command as keyof typeof common.MavCmd];
    params.forEach((v, i) => { if (v) (msg as any)[`_param${i + 1}`] = v; });
    await send(p, msg);
}

async function setMissionCount(numItems: number) {
    const p = getPort(); if (!p || !getReader()) { S.online = false; return; }
    const m = new common.MissionCount();
    m.targetSystem = 1; m.targetComponent = 1; m.count = numItems; m.opaqueId = 0;
    await send(p, m);
    await new Promise(r => setTimeout(r, 250));
}

async function loadMissionItem(item: any, index: number) {
    const p = getPort(); if (!p || !getReader()) { S.online = false; return; }
    const m = new common.MissionItemInt();
    m.targetSystem = 1; m.targetComponent = 1; m.seq = index; m.frame = 3;
    m.command = common.MavCmd[`${item.type}` as keyof typeof common.MavCmd];
    m.current = index === 0 ? 1 : 0; m.autocontinue = 1;
    if (item.param1 !== null) m.param1 = item.param1;
    if (item.param2 !== null) m.param2 = item.param2;
    if (item.param3 !== null) m.param3 = item.param3;
    if (item.param4 !== null) m.param4 = item.param4;
    m.x = Number((item.lat * 1e7).toFixed(0));
    m.y = Number((item.lon * 1e7).toFixed(0));
    m.z = item.alt ?? 0; m.missionType = 0;
    await send(p, m);
}

async function clearAllMissionItems() {
    const p = getPort(); if (!p || !getReader()) { S.online = false; return; }
    const m = new common.MissionClearAll();
    m.targetSystem = 1; m.targetComponent = 1;
    await send(p, m);
}

async function setPositionLocal(x: number, y: number, z: number) {
    const p = getPort(); if (!p || !getReader()) { S.online = false; return; }
    const m = new common.SetPositionTargetLocalNed();
    m.timeBootMs = 0; m.targetSystem = 1; m.targetComponent = 1;
    m.coordinateFrame = 1; (m as any).typeMask = 0b011111111000;
    m.x = x; m.y = y; m.z = z; m.yawRate = 0;
    await send(p, m);
}

function convertBigIntToNumber(obj: any): any {
    if (typeof obj === 'bigint') return Number(obj);
    if (Array.isArray(obj)) return obj.map(convertBigIntToNumber);
    if (obj !== null && typeof obj === 'object')
        return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, convertBigIntToNumber(v)]));
    return obj;
}

// ─── Exports ──────────────────────────────────────────────────────────────────
export {
    initializePort,
    forceConnect,
    forceDisconnect,
    closeExistingConnection,
    getConnectionStatus,
    detectPort,
    requestStatus,
    requestParameters,
    writeParameter,
    sendMavlinkCommand,
    setMissionCount,
    loadMissionItem,
    clearAllMissionItems,
    setPositionLocal,
    common,
};

export const logs    = S.logs    as string[];
export const newLogs = S.newLogs as string[];
