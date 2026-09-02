// Test script to check and set ArduPilot stream rate parameters (SR0_*)
// Run with: node test-stream-params.js

const dgram = require('dgram');
const { MavLinkPacketSplitter, MavLinkPacketParser, MavLinkProtocolV2 } = require('node-mavlink');
const { common } = require('node-mavlink');

const FC_IP = '192.168.0.7';
const FC_PORT = 8234;
const BIND_PORT = 14551; // Different from GCS so we don't conflict

const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
const splitter = new MavLinkPacketSplitter();
const reader = new MavLinkPacketParser();
const protocol = new MavLinkProtocolV2();

let seq = 0;
const paramsReceived = {};
const targetParams = [
    'SR0_POSITION', 'SR0_EXTRA1', 'SR0_EXTRA2', 'SR0_EXT_STAT',
    'SR0_RAW_SENS', 'SR0_RC_CHAN', 'SR0_PARAMS'
];

splitter.pipe(reader);

socket.on('message', (msg) => {
    splitter.write(msg);
});

reader.on('data', (packet) => {
    if (packet.header.msgid === 22) { // PARAM_VALUE
        const data = packet.protocol.data(packet.payload, common.ParamValue);
        const paramId = data.paramId.replace(/\u0000/g, '').trim();
        paramsReceived[paramId] = data.paramValue;
        
        if (targetParams.includes(paramId)) {
            console.log(`✅ ${paramId} = ${data.paramValue} Hz`);
            
            // If it's 0, offer to set it
            if (data.paramValue === 0) {
                console.log(`   ⚠️  This is 0 — no telemetry will stream! Setting to 4 Hz...`);
                setTimeout(() => setParam(paramId, 4, data.paramType), 500);
            }
        }
        
        // Check if we got all params
        const receivedCount = targetParams.filter(p => paramsReceived[p] !== undefined).length;
        if (receivedCount === targetParams.length) {
            console.log(`\n✅ All ${targetParams.length} SR0 parameters checked`);
            setTimeout(() => {
                console.log('\n📡 Requesting data streams again...');
                requestStreams();
            }, 2000);
        }
    }
    
    if (packet.header.msgid === 77) { // COMMAND_ACK
        const data = packet.protocol.data(packet.payload, common.CommandAck);
        const resultNames = {0:'ACCEPTED', 1:'TEMP_REJECTED', 2:'DENIED', 3:'UNSUPPORTED', 4:'FAILED'};
        console.log(`📨 COMMAND_ACK: cmd=${data.command} result=${resultNames[data.result] || data.result}`);
    }
});

socket.bind(BIND_PORT, '0.0.0.0', () => {
    console.log(`🔌 Bound to port ${BIND_PORT}`);
    console.log(`📡 Connecting to FC at ${FC_IP}:${FC_PORT}...\n`);
    
    // Send heartbeat
    const hb = new minimal.Heartbeat();
    hb.type = 6; hb.autopilot = 8; hb.baseMode = 0; hb.customMode = 0;
    hb.systemStatus = 4; hb.mavlinkVersion = 3;
    sendMsg(hb);
    
    setTimeout(() => {
        console.log('📋 Requesting SR0_* parameters...\n');
        requestParams();
    }, 1000);
    
    // Keep alive
    setInterval(() => sendMsg(new minimal.Heartbeat()), 1000);
});

function sendMsg(msg) {
    const buf = protocol.serialize(msg, seq++);
    socket.send(buf, FC_PORT, FC_IP);
}

function requestParams() {
    const req = new common.ParamRequestList();
    req.targetSystem = 1;
    req.targetComponent = 1;
    sendMsg(req);
}

function setParam(id, value, type) {
    const set = new common.ParamSet();
    set.targetSystem = 1;
    set.targetComponent = 1;
    set.paramId = id;
    set.paramValue = value;
    set.paramType = type;
    sendMsg(set);
    console.log(`   📝 Sent PARAM_SET: ${id} = ${value}`);
}

function requestStreams() {
    const msgs = [
        { id: 0, us: 1000000, name: 'HEARTBEAT' },
        { id: 33, us: 250000, name: 'GLOBAL_POSITION_INT' },
        { id: 24, us: 250000, name: 'GPS_RAW_INT' },
        { id: 1, us: 500000, name: 'SYS_STATUS' },
    ];
    
    msgs.forEach(({ id, us, name }) => {
        const cmd = new common.CommandLong();
        cmd.targetSystem = 1;
        cmd.targetComponent = 1;
        cmd.command = 511; // SET_MESSAGE_INTERVAL
        cmd._param1 = id;
        cmd._param2 = us;
        sendMsg(cmd);
        console.log(`   📡 SET_MESSAGE_INTERVAL: ${name} @ ${1000000/us} Hz`);
    });
}

setTimeout(() => {
    console.log('\n❌ Timeout after 30s — closing');
    process.exit(0);
}, 30000);
