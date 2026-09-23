import { SerialPort } from 'serialport';
import { connect, type Socket } from 'net';
import { createSocket, type Socket as UDPSocket } from 'dgram';
import * as mavlink from 'node-mavlink';
import { REGISTRY } from '$lib/server/mavlink-registry';

// Destructure after import for better HMR compatibility
const { MavLinkPacketSplitter, MavLinkPacketParser, MavLinkProtocolV2, common, minimal, ardupilotmega, send } = mavlink;

// Create a protocol instance for serializing messages (system ID 255 = GCS, component ID 190 = ground control)
const protocol = new MavLinkProtocolV2(255, 190);

// ─── Types ────────────────────────────────────────────────────────────────────
type ConnectionType = 'serial' | 'tcp' | 'udp';
type PortType = SerialPort | Socket | UDPSocket | null;

// ─── Singleton state on globalThis ───────────────────────────────────────────
// Persists across Vite HMR reloads since globalThis survives module re-execution.
declare const globalThis: any;

// HMR cleanup: properly close and release the COM handle on Vite hot reload
if (globalThis.__mav?.port) {
    console.log('♻️ HMR reload — releasing orphaned port...');
    const _p = globalThis.__mav.port;
    const _connType = globalThis.__mav.connectionType;
    try { _p.removeAllListeners(); } catch { /* ignore */ }
    try { globalThis.__mav.reader?.removeAllListeners(); } catch { /* ignore */ }
    
    // Clear heartbeat interval if it exists
    if (globalThis.__mav.heartbeatInterval) {
        clearInterval(globalThis.__mav.heartbeatInterval);
        globalThis.__mav.heartbeatInterval = null;
    }
    
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
        if (_connType === 'serial') {
            _p.close(() => { try { _p.destroy(); } catch { /* ignore */ } });
        } else if (_connType === 'tcp') {
            _p.destroy();
        } else if (_connType === 'udp') {
            _p.close();
        }
    } catch {
        try { _p.destroy?.(); } catch { /* ignore */ }
        try { _p.close?.(); } catch { /* ignore */ }
    }
}

if (!globalThis.__mav) {
    globalThis.__mav = {
        port:              null as PortType,
        reader:            null as MavLinkPacketParser | null,
        online:            false,
        connecting:        false,
        accessDenied:      false,
        logs:              [] as string[],
        newLogs:           [] as string[],
        promise:           null as Promise<void> | null,
        lastKnownPorts:    [] as string[],  // for USB hotplug detection
        usbWatchInterval:  null as NodeJS.Timeout | null,
        connectionType:    'serial' as ConnectionType,
        udpRemoteHost:     null as string | null,
        udpRemotePort:     null as number | null,
        udpSeq:            0,  // UDP sequence number
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
                    await forceConnect({ type: 'serial' });
                } catch {
                    // Silent — not every new USB device is a flight controller
                }
            }
        } catch { /* ignore scan errors */ }
    }, 2000);
    console.log('👀 USB hotplug watcher started');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getPort()   { return S.port as PortType; }
function getReader() { return S.reader as MavLinkPacketParser | null; }

/** Connect via UDP (Ethernet/WiFi) */
async function connectUDP(host: string, port: number, bindPort?: number): Promise<void> {
    // bindPort is the LOCAL port we listen on (GCS side).
    // port is the REMOTE port on the FC we send heartbeats/commands to.
    // Default to 14550 if no bindPort specified.
    const actualBindPort = bindPort ?? 14550;

    console.log(`🌐 Connecting to FC at ${host}:${port} via UDP (listening on local port ${actualBindPort})...`);
    console.log(`   Received bindPort=${bindPort}, using actualBindPort=${actualBindPort}`);
    
    const udpSocket = createSocket({ type: 'udp4', reuseAddr: true });
    S.port = udpSocket;
    S.connectionType = 'udp';
    S.udpRemoteHost = host;
    S.udpRemotePort = port;
    
    return new Promise<void>((resolve, reject) => {
        let resolved = false;
        
        const timeout = setTimeout(() => {
            // For UDP, don't fail the connection - just mark as ready
            // The device might not be sending data yet, or we need to send heartbeat first
            if (!resolved) {
                console.log(`⚠️ No MAVLink data received after 10s - continuing anyway (UDP is connectionless)`);
                S.online = false; // Will be set to true when data arrives
                resolved = true;
                resolve();
            }
        }, 10000);
        
        udpSocket.on('error', (err) => {
            clearTimeout(timeout);
            if (!resolved) {
                resolved = true;
                reject(err);
            }
        });
        
        udpSocket.on('message', (msg) => {
            if (!resolved) {
                clearTimeout(timeout);
                console.log(`✅ Receiving MAVLink data via UDP from ${host}:${port}`);
                S.online = true;
                resolved = true;
                resolve();
            } else if (!S.online) {
                // First message after timeout
                console.log(`✅ Receiving MAVLink data via UDP from ${host}:${port}`);
                S.online = true;
            }
        });
        
        // Bind to local port with error handling
        try {
            udpSocket.bind(actualBindPort, '0.0.0.0', () => {
                console.log(`🔌 UDP socket bound to port ${actualBindPort} - listening for MAVLink packets`);
                
                // Send initial heartbeat to announce our presence
                // This helps the flight controller know where to send data
                setTimeout(() => {
                    try {
                        const heartbeat = createHeartbeat();
                        const buffer = protocol.serialize(heartbeat, 0); // Sequence number 0 for first message
                        udpSocket.send(buffer, port, host, (err) => {
                            if (err) {
                                console.warn('⚠️ Failed to send initial heartbeat:', err.message);
                            } else {
                                console.log(`💓 Sent initial heartbeat to ${host}:${port}`);
                            }
                        });
                    } catch (err) {
                        console.warn('⚠️ Could not send initial heartbeat:', (err as Error).message);
                    }
                }, 500); // Wait 500ms after bind before sending
            });
        } catch (err) {
            clearTimeout(timeout);
            if (!resolved) {
                resolved = true;
                reject(err);
            }
        }
    });
}

/** Connect via TCP (Ethernet/WiFi) */
async function connectTCP(host: string, port: number): Promise<void> {
    console.log(`🌐 Connecting to ${host}:${port} via TCP...`);
    
    return new Promise<void>((resolve, reject) => {
        const tcpSocket = connect(port, host);
        S.port = tcpSocket;
        S.connectionType = 'tcp';
        
        const timeout = setTimeout(() => {
            tcpSocket.destroy();
            reject(new Error(`TCP connection timeout after 10s`));
        }, 10000);
        
        tcpSocket.on('connect', () => {
            clearTimeout(timeout);
            console.log(`✅ TCP connected to ${host}:${port}`);
            resolve();
        });
        
        tcpSocket.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

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

/** 
 * Connect to MAVLink device
 * @param options Connection options
 * - For Serial: { type: 'serial', port?: string }
 * - For TCP: { type: 'tcp', host: string, port: number }
 * - For UDP: { type: 'udp', host: string, port: number, bindPort?: number }
 */
async function forceConnect(options?: {
    type?: ConnectionType;
    port?: string;
    host?: string;
    portNumber?: number;
    bindPort?: number;
}): Promise<void> {
    if (S.connecting) {
        console.log('⏳ Already connecting...');
        return S.promise ?? Promise.resolve();
    }
    if (getPort() && getReader()) {
        console.log('✅ Already connected');
        return;
    }
    
    const connectionType = options?.type || 'serial';
    
    if (connectionType === 'serial') {
        if (options?.port) {
            process.env.USB_SERIAL_PORT = options.port;
            S.accessDenied = false;
        }
        S.promise = _openPortSerial().finally(() => { S.promise = null; });
    } else if (connectionType === 'tcp') {
        if (!options?.host || !options?.portNumber) {
            throw new Error('TCP connection requires host and port');
        }
        S.promise = _openPortTCP(options.host, options.portNumber).finally(() => { S.promise = null; });
    } else if (connectionType === 'udp') {
        if (!options?.host || !options?.portNumber) {
            throw new Error('UDP connection requires host and port');
        }
        S.promise = _openPortUDP(options.host, options.portNumber, options.bindPort).finally(() => { S.promise = null; });
    }
    
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
        type:       S.connectionType as ConnectionType,
        udpHost:    S.udpRemoteHost,
        udpPort:    S.udpRemotePort,
    };
}

// ─── Internal - Serial ────────────────────────────────────────────────────────

async function _openPortSerial(): Promise<void> {
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

// ─── Internal - TCP/UDP ───────────────────────────────────────────────────────

async function _openPortTCP(host: string, port: number): Promise<void> {
    S.connecting = true;
    S.connectionType = 'tcp';
    
    try {
        await connectTCP(host, port);
        _attachReaderTCP();
        _attachListenersTCP();
        console.log(`✅ TCP connection established to ${host}:${port}`);
    } catch (err) {
        S.connecting = false;
        S.port = null;
        S.reader = null;
        S.online = false;
        console.error(`❌ Failed to connect via TCP:`, err);
        throw err;
    }
    
    S.connecting = false;
}

async function _openPortUDP(host: string, port: number, bindPort?: number): Promise<void> {
    S.connecting = true;
    S.connectionType = 'udp';
    
    // Close any existing connection first
    if (S.port && S.connectionType === 'udp') {
        console.log('🔄 Closing existing UDP connection before reconnecting...');
        try {
            (S.port as UDPSocket).close();
            S.port = null;
            S.reader = null;
            await new Promise(r => setTimeout(r, 100)); // Wait for socket to fully close
        } catch (err) {
            console.warn('⚠️ Error closing existing socket:', (err as Error).message);
        }
    }
    
    try {
        await connectUDP(host, port, bindPort);
        
        // Check if connection was closed during the wait (timeout triggered _closePort)
        if (!S.port) {
            throw new Error('Connection closed during UDP bind — no data received from FC');
        }
        
        _attachReaderUDP();
        _attachListenersUDP();
        console.log(`✅ UDP socket ready - waiting for MAVLink telemetry from ${host}:${port}`);
        
        // Send periodic heartbeats to maintain connection
        let heartbeatSeq = 1; // Start from 1 since initial heartbeat was 0
        const heartbeatInterval = setInterval(() => {
            if (!S.port) {
                clearInterval(heartbeatInterval);
                return;
            }
            
            try {
                const heartbeat = createHeartbeat();
                const buffer = protocol.serialize(heartbeat, heartbeatSeq);
                heartbeatSeq = (heartbeatSeq + 1) % 256; // Wrap at 256
                (S.port as UDPSocket).send(buffer, port, host);
            } catch (err) {
                console.warn('⚠️ Heartbeat send failed:', (err as Error).message);
            }
        }, 1000); // Send heartbeat every second
        
        // Store the interval so it can be cleared on disconnect
        (S as any).heartbeatInterval = heartbeatInterval;
        
    } catch (err) {
        S.connecting = false;
        if (S.port) {
            try { (S.port as UDPSocket).close(); } catch {}
        }
        S.port = null;
        S.reader = null;
        S.online = false;
        console.error(`❌ Failed to connect via UDP:`, err);
        throw err;
    }
    
    S.connecting = false;
}

async function _closePort(): Promise<void> {
    // Always reset state flags regardless of whether port is open
    S.accessDenied = false;
    S.connecting = false;
    S.udpRemoteHost = null;
    S.udpRemotePort = null;

    // Clean up heartbeat interval if it exists
    if ((S as any).heartbeatInterval) {
        clearInterval((S as any).heartbeatInterval);
        (S as any).heartbeatInterval = null;
    }

    const p = S.port;
    const connType = S.connectionType;
    S.port = null;
    if (!p) return;
    
    console.log(`🔌 Closing ${connType} connection...`);
    p.removeAllListeners();
    S.reader?.removeAllListeners();
    S.reader = null;
    S.online = false;

    if (connType === 'serial') {
        // SerialPort specific close
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
        await new Promise(r => setTimeout(r, 1500));
    } else if (connType === 'tcp') {
        // TCP socket close
        (p as Socket).destroy();
    } else if (connType === 'udp') {
        // UDP socket close
        (p as UDPSocket).close();
    }

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

function _attachReaderTCP(): void {
    // TCP uses streams just like serial
    _attachReader();
}

function _attachReaderUDP(): void {
    // Safety check: if port was closed during bind, abort
    if (!S.port) {
        console.warn('⚠️ _attachReaderUDP called but S.port is null — socket was closed');
        return;
    }

    const splitter = new MavLinkPacketSplitter();
    S.reader = new MavLinkPacketParser();
    splitter.pipe(S.reader);

    // Rate-limit counters — log a summary every 5 s instead of every packet
    let udpBytesTotal   = 0;
    let udpPacketTotal  = 0;
    let udpParseTotal   = 0;
    let udpUnknownIds   = new Set<number>();
    let paramCount      = 0;
    let firstDataSeen   = false;
    let seenMsgTypes    = new Set<string>(); // track unique message types received

    const statsTimer = setInterval(() => {
        if (udpPacketTotal === 0) return;
        console.log(
            `📡 UDP stats (5s): ${udpPacketTotal} packets | ${udpBytesTotal} bytes | ` +
            `${udpParseTotal} decoded | params rx: ${paramCount}` +
            (udpUnknownIds.size ? ` | unknown msgids: [${[...udpUnknownIds].join(',')}]` : '')
        );
        udpBytesTotal  = 0;
        udpPacketTotal = 0;
        udpParseTotal  = 0;
        udpUnknownIds  = new Set();
        paramCount     = 0;
    }, 5000);

    // Clean up timer when socket closes (guarded against null)
    const udpPort = S.port as UDPSocket | null;
    if (udpPort) {
        udpPort.once('close', () => clearInterval(statsTimer));
        udpPort.on('message', (msg) => {
            udpBytesTotal += msg.length;
            udpPacketTotal++;
            splitter.write(msg);
        });
    } else {
        // Socket was closed before we got here — clean up timer immediately
        clearInterval(statsTimer);
        return;
    }

    S.reader.on('data', (packet: any) => {
        if (!firstDataSeen) {
            firstDataSeen = true;
            // Correct header fields: sysid / compid / msgid (node-mavlink uses lowercase)
            const sysId  = packet.header.sysid;
            const compId = packet.header.compid;
            const msgId  = packet.header.msgid;
            console.log(`✅ First MAVLink packet decoded — sysid=${sysId} compid=${compId} msgid=${msgId}`);

            // Immediately request full telemetry streams from the FC.
            // ArduPilot won't stream anything except heartbeats until we ask.
            // Send REQUEST_DATA_STREAM for every stream type at 4 Hz.
            setTimeout(() => _requestAllDataStreams(), 200);
        }

        S.online = true;

        const clazz = REGISTRY[packet.header.msgid];
        if (!clazz) {
            udpUnknownIds.add(packet.header.msgid);
            return;
        }

        const data = packet.protocol.data(packet.payload, clazz);
        if (!data) return;

        udpParseTotal++;

        // Log each NEW message type we see (once only) so we know what the FC is streaming
        if (!seenMsgTypes.has(clazz.MSG_NAME)) {
            seenMsgTypes.add(clazz.MSG_NAME);
            console.log(`🆕 New message type from FC: ${clazz.MSG_NAME} (msgid=${packet.header.msgid})`);
        }

        // Use correct header property names (sysid / compid, not systemId / componentId)
        const sysId  = packet.header.sysid;
        const compId = packet.header.compid;
        const entry  = `${clazz.MSG_NAME}(${clazz.MAGIC_NUMBER})::${new Date().toISOString()}::sysid=${sysId},compid=${compId}::${JSON.stringify(convertBigIntToNumber(data))}`;
        S.logs.push(entry);
        S.newLogs.push(entry);

        // Always log ACKs (infrequent, important for arm/command debugging)
        if (clazz.MSG_NAME === 'COMMAND_ACK') {
            const ackCmd    = (data as any).command ?? '?';
            const ackResult = (data as any).result  ?? '?';
            // Map result codes: 0=ACCEPTED, 1=TEMP_REJECTED, 2=DENIED, 3=UNSUPPORTED, 4=FAILED, 5=IN_PROGRESS
            const resultNames: Record<number, string> = { 0:'ACCEPTED', 1:'TEMP_REJECTED', 2:'DENIED', 3:'UNSUPPORTED', 4:'FAILED', 5:'IN_PROGRESS' };
            const resultStr = resultNames[ackResult] ?? `UNKNOWN(${ackResult})`;
            // cmd 511 = SET_MESSAGE_INTERVAL, cmd 66 = REQUEST_DATA_STREAM
            const cmdNames: Record<number, string> = { 511:'SET_MESSAGE_INTERVAL', 66:'REQUEST_DATA_STREAM', 400:'COMPONENT_ARM_DISARM', 176:'DO_SET_MODE' };
            const cmdStr = cmdNames[ackCmd] ?? `CMD_${ackCmd}`;
            // Only log non-stream-request ACKs (SET_MESSAGE_INTERVAL responses are just noise)
            if (ackCmd !== 511) {
                console.log(`📨 COMMAND_ACK: ${cmdStr} → ${resultStr}`);
            }
        }

        // Track param receive progress
        if (clazz.MSG_NAME === 'PARAM_VALUE') {
            paramCount++;
            const paramIndex = (data as any).paramIndex ?? 0;
            const paramTotal = (data as any).paramCount ?? 0;
            if (paramIndex === 0 || paramIndex % 100 === 0 || paramIndex === paramTotal - 1) {
                const paramId = ((data as any).paramId ?? '').replace(/\u0000/g, '');
                console.log(`📋 PARAM_VALUE [${paramIndex}/${paramTotal}]: ${paramId} = ${(data as any).paramValue}`);
            }
        }

        // Log STATUSTEXT messages (always relevant, low frequency)
        if (clazz.MSG_NAME === 'STATUSTEXT') {
            const text = ((data as any).text ?? '').replace(/\u0000/g, '');
            const sev  = (data as any).severity ?? '';
            console.log(`📢 STATUSTEXT sev=${sev}: ${text}`);
        }
    });

    S.reader.on('error', (err: Error) => {
        console.error('❌ UDP parser error:', err.message);
    });
}

/**
 * Ask the FC to start streaming all telemetry using SET_MESSAGE_INTERVAL (MAVCmd 511).
 * This is the modern ArduPilot 4.x API — REQUEST_DATA_STREAM (MSG_ID 66) was deprecated.
 * Each call sets a specific message type to stream at the given interval (microseconds).
 */
async function _requestAllDataStreams(): Promise<void> {
    if (!getPort() || !getReader()) return;

    // Message ID → interval in microseconds (250000 = 4 Hz, 500000 = 2 Hz, 100000 = 10 Hz)
    const messages: { msgId: number; intervalUs: number; name: string }[] = [
        { msgId:  0,  intervalUs: 1000000, name: 'HEARTBEAT'           },  // 1 Hz (already streaming, confirm)
        { msgId:  1,  intervalUs:  500000, name: 'SYS_STATUS'          },  // 2 Hz — battery, sensors
        { msgId:  24, intervalUs:  250000, name: 'GPS_RAW_INT'         },  // 4 Hz
        { msgId:  30, intervalUs:  250000, name: 'ATTITUDE'            },  // 4 Hz
        { msgId:  32, intervalUs:  250000, name: 'LOCAL_POSITION_NED'  },  // 4 Hz
        { msgId:  33, intervalUs:  250000, name: 'GLOBAL_POSITION_INT' },  // 4 Hz
        { msgId:  42, intervalUs:  500000, name: 'MISSION_CURRENT'     },  // 2 Hz
        { msgId:  74, intervalUs:  500000, name: 'VFR_HUD'             },  // 2 Hz — airspeed, heading, throttle
        { msgId: 147, intervalUs:  500000, name: 'BATTERY_STATUS'      },  // 2 Hz
    ];

    console.log('📡 Requesting telemetry streams via SET_MESSAGE_INTERVAL...');
    let successCount = 0;
    for (const { msgId, intervalUs, name } of messages) {
        try {
            const cmd = new common.CommandLong();
            cmd.targetSystem    = 1;
            cmd.targetComponent = 1;
            cmd.command         = 511; // MAV_CMD_SET_MESSAGE_INTERVAL
            (cmd as any)._param1 = msgId;       // Message ID to stream
            (cmd as any)._param2 = intervalUs;  // Interval in microseconds (-1 = disable, 0 = default)
            (cmd as any)._param3 = 0;
            (cmd as any)._param4 = 0;
            (cmd as any)._param5 = 0;
            (cmd as any)._param6 = 0;
            (cmd as any)._param7 = 0;
            await _send(cmd);
            successCount++;
            await new Promise(r => setTimeout(r, 30));
        } catch (err) {
            console.warn(`⚠️ SET_MESSAGE_INTERVAL failed for ${name} (${msgId}):`, (err as Error).message);
        }
    }

    // Also try the legacy REQUEST_DATA_STREAM as a fallback for older firmware
    try {
        const ds = new common.RequestDataStream();
        ds.targetSystem    = 1;
        ds.targetComponent = 1;
        ds.reqStreamId     = 0;   // ALL streams
        ds.reqMessageRate  = 4;   // 4 Hz
        ds.startStop       = 1;
        await _send(ds);
    } catch { /* older firmware may not support it — ignore */ }

    console.log(`✅ Sent ${successCount} stream requests — telemetry should begin flowing`);
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

function _attachListenersTCP(): void {
    (S.port as Socket).on('close', () => {
        console.log('⚠️ TCP connection closed');
        S.port = null;
        S.reader = null;
        S.online = false;
        S.logs.push('MAVLink TCP connection closed');
    });
    
    (S.port as Socket).on('error', (err: Error) => {
        console.error('❌ TCP error:', err.message);
        S.online = false;
    });
}

function _attachListenersUDP(): void {
    (S.port as UDPSocket).on('close', () => {
        console.log('⚠️ UDP connection closed');
        S.port = null;
        S.reader = null;
        S.online = false;
        S.logs.push('MAVLink UDP connection closed');
    });
    
    (S.port as UDPSocket).on('error', (err: Error) => {
        console.error('❌ UDP error:', err.message);
        S.online = false;
    });
}

// ─── MAVLink commands ─────────────────────────────────────────────────────────

/** Create a heartbeat message safely */
function createHeartbeat(): any {
    try {
        // Heartbeat is in the minimal module, not common
        const HeartbeatClass = minimal.Heartbeat;
        
        if (!HeartbeatClass) {
            console.error('Heartbeat class not found. minimal =', typeof minimal, Object.keys(minimal || {}));
            throw new Error('Heartbeat class not available in minimal module');
        }
        
        const hb = new HeartbeatClass();
        hb.type = 6; // MAV_TYPE_GCS
        hb.autopilot = 8; // MAV_AUTOPILOT_INVALID
        hb.baseMode = 0;
        hb.customMode = 0;
        hb.systemStatus = 4; // MAV_STATE_ACTIVE
        hb.mavlinkVersion = 3;
        
        return hb;
    } catch (err) {
        console.error('Failed to create heartbeat:', err);
        console.error('minimal type:', typeof minimal);
        console.error('minimal.Heartbeat type:', typeof minimal?.Heartbeat);
        throw err;
    }
}

async function _send(message: any): Promise<void> {
    const p = getPort();
    if (!p || !getReader()) {
        S.online = false;
        throw new Error('Not connected');
    }
    
    if (S.connectionType === 'udp' && S.udpRemoteHost && S.udpRemotePort) {
        // UDP requires manual serialization using protocol
        try {
            // Use protocol.serialize with a sequence number
            const seq = (S as any).udpSeq || 0;
            (S as any).udpSeq = (seq + 1) % 256; // Increment sequence number, wrap at 256
            
            const buffer = protocol.serialize(message, seq);
            (p as UDPSocket).send(buffer, S.udpRemotePort, S.udpRemoteHost);
        } catch (err) {
            console.error('Failed to serialize/send UDP message:', err);
            throw err;
        }
    } else {
        // Serial and TCP use streams with the send utility
        await send(p as any, message);
    }
}

async function requestStatus() {
    const p = getPort(); if (!p || !getReader()) { S.online = false; return; }
    // REQUEST_DATA_STREAM is the reliable way to get continuous telemetry from ArduPilot.
    // Only send it occasionally (not every heartbeat) — use a cooldown flag.
    const now = Date.now();
    const lastRequest: number = (S as any).lastStreamRequest ?? 0;
    if (now - lastRequest < 30000) return; // Re-request at most every 30s
    (S as any).lastStreamRequest = now;
    await _requestAllDataStreams();
}

async function requestParameters() {
    const p = getPort(); if (!p || !getReader()) { S.online = false; return; }
    const r = new common.ParamRequestList();
    r.targetSystem = 1; r.targetComponent = 1;
    await _send(r);
}

async function writeParameter(id: string, value: number, type: number) {
    const p = getPort(); if (!p || !getReader()) { S.online = false; return; }
    const r = new common.ParamSet();
    r.targetSystem = 1; r.targetComponent = 1; r.paramId = id; r.paramValue = value; r.paramType = type;
    await _send(r);
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
    await _send(msg);
}

async function setMissionCount(numItems: number) {
    const p = getPort(); if (!p || !getReader()) { S.online = false; return; }
    const m = new common.MissionCount();
    m.targetSystem = 1; m.targetComponent = 1; m.count = numItems; m.opaqueId = 0;
    await _send(m);
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
    await _send(m);
}

async function clearAllMissionItems() {
    const p = getPort(); if (!p || !getReader()) { S.online = false; return; }
    const m = new common.MissionClearAll();
    m.targetSystem = 1; m.targetComponent = 1;
    await _send(m);
}

async function setPositionLocal(x: number, y: number, z: number) {
    const p = getPort(); if (!p || !getReader()) { S.online = false; return; }
    const m = new common.SetPositionTargetLocalNed();
    m.timeBootMs = 0; m.targetSystem = 1; m.targetComponent = 1;
    m.coordinateFrame = 1; (m as any).typeMask = 0b011111111000;
    m.x = x; m.y = y; m.z = z; m.yawRate = 0;
    await _send(m);
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
