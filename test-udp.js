#!/usr/bin/env node

/**
 * UDP MAVLink Test Utility - Complete Data Reception Test
 * Tests if ALL expected telemetry data is being received
 */

const dgram = require('dgram');

// Configuration
const LOCAL_PORT = 14550;
const FC_IP = '192.168.0.7';
const FC_PORT = 14550;

console.log('═══════════════════════════════════════════════════════════');
console.log('🧪 MAVLink UDP Complete Data Reception Test');
console.log('═══════════════════════════════════════════════════════════\n');
console.log('Configuration:');
console.log(`  Listening on: 0.0.0.0:${LOCAL_PORT}`);
console.log(`  FC Address: ${FC_IP}:${FC_PORT}\n`);

// Create UDP socket
const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

let packetCount = 0;
let lastPacketTime = null;
let messageStats = {};

// Expected message types for complete telemetry
const EXPECTED_MESSAGES = {
    0: 'HEARTBEAT',
    1: 'SYS_STATUS',
    24: 'GPS_RAW_INT',
    30: 'ATTITUDE',
    33: 'GLOBAL_POSITION_INT',
    74: 'VFR_HUD',
    77: 'COMMAND_ACK',
    147: 'BATTERY_STATUS',
    253: 'STATUSTEXT'
};

// Track which messages we've received
const receivedMessages = new Set();

// Handle incoming messages
socket.on('message', (msg, rinfo) => {
    packetCount++;
    lastPacketTime = new Date();
    
    // Check if it looks like MAVLink
    if (msg.length > 0) {
        const firstByte = msg[0];
        
        if (firstByte === 0xFD && msg.length >= 10) {
            // MAVLink v2
            const msgId = msg.readUInt16LE(7) | (msg[9] << 16);
            const sysId = msg[5];
            const compId = msg[6];
            const payloadLen = msg[1];
            
            // Track this message type
            if (!messageStats[msgId]) {
                messageStats[msgId] = {
                    count: 0,
                    name: EXPECTED_MESSAGES[msgId] || `UNKNOWN_${msgId}`,
                    lastSeen: null
                };
            }
            messageStats[msgId].count++;
            messageStats[msgId].lastSeen = new Date();
            receivedMessages.add(msgId);
            
            // Show first packet of each type
            if (messageStats[msgId].count === 1) {
                console.log(`\n🆕 NEW MESSAGE TYPE #${msgId}: ${messageStats[msgId].name}`);
                console.log(`   From: ${rinfo.address}:${rinfo.port}`);
                console.log(`   System ID: ${sysId}, Component ID: ${compId}`);
                console.log(`   Payload: ${payloadLen} bytes`);
                
                // Parse some key data
                if (msgId === 0) { // HEARTBEAT
                    parseHeartbeat(msg);
                } else if (msgId === 33) { // GLOBAL_POSITION_INT
                    parseGlobalPosition(msg);
                } else if (msgId === 24) { // GPS_RAW_INT
                    parseGPSRaw(msg);
                } else if (msgId === 147) { // BATTERY_STATUS
                    parseBattery(msg);
                }
            }
            
        } else if (firstByte === 0xFE && msg.length >= 6) {
            // MAVLink v1
            const msgId = msg[5];
            const sysId = msg[3];
            const compId = msg[4];
            
            if (!messageStats[msgId]) {
                messageStats[msgId] = {
                    count: 0,
                    name: EXPECTED_MESSAGES[msgId] || `UNKNOWN_${msgId}`,
                    lastSeen: null
                };
            }
            messageStats[msgId].count++;
            messageStats[msgId].lastSeen = new Date();
            receivedMessages.add(msgId);
            
            if (messageStats[msgId].count === 1) {
                console.log(`\n🆕 NEW MESSAGE TYPE #${msgId}: ${messageStats[msgId].name} (MAVLink v1)`);
                console.log(`   From: ${rinfo.address}:${rinfo.port}`);
                console.log(`   System ID: ${sysId}, Component ID: ${compId}`);
            }
        } else {
            console.log(`\n⚠️  Non-MAVLink packet (first byte: 0x${firstByte.toString(16).padStart(2, '0')})`);
        }
    }
});

// Parse HEARTBEAT message
function parseHeartbeat(msg) {
    if (msg.length < 19) return;
    const customMode = msg.readUInt32LE(10);
    const type = msg[14];
    const autopilot = msg[15];
    const baseMode = msg[16];
    const systemStatus = msg[17];
    const mavlinkVersion = msg[18];
    
    console.log(`   → Type: ${type}, Autopilot: ${autopilot}`);
    console.log(`   → Armed: ${(baseMode & 128) ? 'YES' : 'NO'}, Status: ${systemStatus}`);
}

// Parse GLOBAL_POSITION_INT
function parseGlobalPosition(msg) {
    if (msg.length < 38) return;
    const lat = msg.readInt32LE(14) / 1e7;
    const lon = msg.readInt32LE(18) / 1e7;
    const alt = msg.readInt32LE(22) / 1000;
    const relAlt = msg.readInt32LE(26) / 1000;
    const vx = msg.readInt16LE(30) / 100;
    const vy = msg.readInt16LE(32) / 100;
    const hdg = msg.readUInt16LE(36) / 100;
    
    console.log(`   → Lat: ${lat.toFixed(6)}°, Lon: ${lon.toFixed(6)}°`);
    console.log(`   → Alt: ${alt.toFixed(1)}m, Heading: ${hdg.toFixed(1)}°`);
    console.log(`   → Speed: ${Math.sqrt(vx*vx + vy*vy).toFixed(1)} m/s`);
}

// Parse GPS_RAW_INT
function parseGPSRaw(msg) {
    if (msg.length < 40) return;
    const fixType = msg[18];
    const sats = msg[19];
    const eph = msg.readUInt16LE(28) / 100;
    
    const fixTypes = ['No Fix', 'No Fix', '2D', '3D', 'DGPS', 'RTK Float', 'RTK Fixed'];
    console.log(`   → GPS: ${fixTypes[fixType] || 'Unknown'}, Satellites: ${sats}`);
    console.log(`   → HDOP: ${eph.toFixed(2)}`);
}

// Parse BATTERY_STATUS
function parseBattery(msg) {
    if (msg.length < 46) return;
    const remaining = msg[41];
    const voltage = msg.readInt16LE(14) / 1000;
    const current = msg.readInt16LE(16) / 100;
    
    console.log(`   → Battery: ${remaining}%, Voltage: ${voltage.toFixed(2)}V`);
    console.log(`   → Current: ${current.toFixed(2)}A`);
}

// Handle errors
socket.on('error', (err) => {
    console.error(`\n❌ Socket error: ${err.message}`);
    socket.close();
    process.exit(1);
});

// Bind to port
socket.bind(LOCAL_PORT, () => {
    console.log(`✅ Socket bound to port ${LOCAL_PORT}`);
    console.log('\n💓 Sending initial heartbeat to announce GCS presence...\n');
    
    // Send a simple MAVLink heartbeat to announce our presence
    // This helps the FC know where to send data
    sendHeartbeat();
    
    // Send heartbeat every 1 second
    setInterval(sendHeartbeat, 1000);
    
    console.log('👂 Listening for MAVLink packets...');
    console.log('   (Press Ctrl+C to stop)\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Expected Messages for Complete Telemetry:');
    for (const [id, name] of Object.entries(EXPECTED_MESSAGES)) {
        console.log(`   [  ] ${name.padEnd(25)} (ID: ${id})`);
    }
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Show status every 5 seconds
    setInterval(() => {
        console.clear();
        showStatus();
    }, 5000);
});

const startTime = Date.now();

// Show current status
function showStatus() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🧪 MAVLink UDP Complete Data Reception Test');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`⏱️  Test Duration: ${elapsed}s`);
    console.log(`📦 Total Packets: ${packetCount}`);
    console.log(`📊 Message Types: ${Object.keys(messageStats).length}\n`);
    
    console.log('Message Reception Status:');
    console.log('─────────────────────────────────────────────────────────\n');
    
    // Check each expected message
    for (const [id, name] of Object.entries(EXPECTED_MESSAGES)) {
        const msgId = parseInt(id);
        const received = receivedMessages.has(msgId);
        const icon = received ? '✅' : '❌';
        const count = messageStats[msgId]?.count || 0;
        const status = received ? `${count} received` : 'Not received';
        
        console.log(`${icon} ${name.padEnd(25)} ${status}`);
    }
    
    console.log('\n─────────────────────────────────────────────────────────');
    console.log('Other Messages Received:');
    console.log('─────────────────────────────────────────────────────────\n');
    
    // Show other messages not in expected list
    const otherMessages = Object.keys(messageStats)
        .map(id => parseInt(id))
        .filter(id => !EXPECTED_MESSAGES[id]);
    
    if (otherMessages.length > 0) {
        for (const msgId of otherMessages) {
            const stats = messageStats[msgId];
            console.log(`📨 ${stats.name.padEnd(25)} ${stats.count} received`);
        }
    } else {
        console.log('   (None)');
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('Press Ctrl+C to stop test and see detailed summary');
    console.log('═══════════════════════════════════════════════════════════\n');
}

// Simple MAVLink v2 heartbeat packet
function sendHeartbeat() {
    // MAVLink v2 HEARTBEAT (msgid=0)
    const heartbeat = Buffer.from([
        0xFD,       // STX (MAVLink v2)
        0x09,       // Payload length
        0x00,       // Incompat flags
        0x00,       // Compat flags
        0x00,       // Sequence
        0xFF,       // System ID (255 = GCS)
        0xBE,       // Component ID (190 = GCS)
        0x00, 0x00, 0x00, // Message ID (0 = HEARTBEAT)
        // Payload (9 bytes):
        0x00, 0x00, 0x00, 0x00, // custom_mode
        0x06,       // type (MAV_TYPE_GCS)
        0x08,       // autopilot (MAV_AUTOPILOT_INVALID)
        0x00,       // base_mode
        0x04,       // system_status (MAV_STATE_ACTIVE)
        0x03        // mavlink_version
    ]);
    
    // Calculate and append CRC (simplified - would need proper CRC calculation for real use)
    const crc = Buffer.from([0x00, 0x00]); // Placeholder
    const packet = Buffer.concat([heartbeat, crc]);
    
    socket.send(packet, FC_PORT, FC_IP, (err) => {
        if (err) {
            console.error(`❌ Failed to send heartbeat: ${err.message}`);
        }
    });
}

// Clean exit
process.on('SIGINT', () => {
    console.clear();
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 FINAL TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    console.log(`⏱️  Test Duration: ${elapsed}s`);
    console.log(`📦 Total Packets: ${packetCount}`);
    console.log(`📊 Unique Message Types: ${Object.keys(messageStats).length}\n`);
    
    if (packetCount === 0) {
        console.log('❌ NO PACKETS RECEIVED!\n');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🔍 DIAGNOSIS: Flight Controller Not Sending Data');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log('Possible Causes:');
        console.log('  1. ❌ Flight controller not powered on');
        console.log('  2. ❌ FC not configured to send MAVLink over UDP');
        console.log('  3. ❌ FC sending to wrong IP address');
        console.log('  4. ❌ FC sending to wrong port (using 8234 instead of 14550?)');
        console.log('  5. ❌ Network connectivity issue');
        console.log('  6. ❌ Firewall blocking UDP port\n');
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('💡 RECOMMENDED ACTIONS');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log('Step 1: Find your computer\'s IP address');
        console.log('        Run: ipconfig');
        console.log('        Look for: IPv4 Address (e.g., 192.168.0.100)\n');
        
        console.log('Step 2: Configure Flight Controller Parameters');
        console.log('        NET_ENABLE = 1');
        console.log('        NET_IPADDR = 192.168.0.7');
        console.log('        NET_NETMASK = 255.255.255.0');
        console.log('        NET_P1_IP = [YOUR_COMPUTER_IP_FROM_STEP_1]');
        console.log('        NET_P1_PORT = 14550');
        console.log('        NET_P1_PROTOCOL = 2');
        console.log('        SERIALx_PROTOCOL = 2\n');
        
        console.log('Step 3: Reboot flight controller\n');
        console.log('Step 4: Run this test again\n');
        
    } else {
        console.log('✅ PACKETS RECEIVED!\n');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('📋 MESSAGE RECEPTION REPORT');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Count critical messages
        const criticalMessages = [0, 33, 24, 147]; // HEARTBEAT, GLOBAL_POSITION, GPS, BATTERY
        const criticalReceived = criticalMessages.filter(id => receivedMessages.has(id));
        
        console.log('Critical Messages (Required for GCS):');
        for (const id of criticalMessages) {
            const received = receivedMessages.has(id);
            const icon = received ? '✅' : '❌';
            const name = EXPECTED_MESSAGES[id];
            const count = messageStats[id]?.count || 0;
            console.log(`  ${icon} ${name.padEnd(25)} ${received ? count + ' received' : 'NOT RECEIVED'}`);
        }
        
        console.log('\nAll Expected Messages:');
        for (const [id, name] of Object.entries(EXPECTED_MESSAGES)) {
            const msgId = parseInt(id);
            const received = receivedMessages.has(msgId);
            const icon = received ? '✅' : '❌';
            const count = messageStats[msgId]?.count || 0;
            console.log(`  ${icon} ${name.padEnd(25)} ${received ? count + ' received' : 'NOT RECEIVED'}`);
        }
        
        console.log('\nOther Messages:');
        const otherMessages = Object.keys(messageStats)
            .map(id => parseInt(id))
            .filter(id => !EXPECTED_MESSAGES[id]);
        
        if (otherMessages.length > 0) {
            for (const msgId of otherMessages) {
                const stats = messageStats[msgId];
                console.log(`  📨 ${stats.name.padEnd(25)} ${stats.count} received`);
            }
        } else {
            console.log('  (None)');
        }
        
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📈 RECEPTION RATE');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        const packetsPerSecond = (packetCount / elapsed).toFixed(1);
        console.log(`  Average: ${packetsPerSecond} packets/second`);
        
        // Detailed stats
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📊 DETAILED MESSAGE STATISTICS');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        const sortedStats = Object.entries(messageStats)
            .sort((a, b) => b[1].count - a[1].count);
        
        for (const [msgId, stats] of sortedStats) {
            const rate = (stats.count / elapsed).toFixed(2);
            console.log(`  ${stats.name.padEnd(25)} Count: ${stats.count.toString().padStart(6)}  Rate: ${rate} Hz`);
        }
        
        // Final verdict
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🎯 VERDICT');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        if (criticalReceived.length === criticalMessages.length) {
            console.log('✅ ALL CRITICAL MESSAGES RECEIVED!');
            console.log('\nYour UDP connection is working perfectly!');
            console.log('All required telemetry data is flowing from FC to GCS.\n');
            
            console.log('If GCS dashboard still shows no data:');
            console.log('  → The issue is in the GCS frontend/parsing');
            console.log('  → Check browser console for JavaScript errors');
            console.log('  → Verify /api/mavlink/heartbeat is being called');
            console.log('  → Check Event Log page for MAVLink messages\n');
            
        } else {
            console.log('⚠️  PARTIAL DATA RECEPTION');
            console.log(`\nReceived ${criticalReceived.length}/${criticalMessages.length} critical message types.`);
            console.log('\nMissing critical messages:');
            for (const id of criticalMessages) {
                if (!receivedMessages.has(id)) {
                    console.log(`  ❌ ${EXPECTED_MESSAGES[id]} (ID: ${id})`);
                }
            }
            console.log('\nFC may need additional configuration or may not have');
            console.log('certain sensors (e.g., GPS) connected.\n');
        }
    }
    
    console.log('═══════════════════════════════════════════════════════════\n');
    
    socket.close();
    process.exit(0);
});
