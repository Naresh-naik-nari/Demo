#!/usr/bin/env python3
"""
UDP MAVLink Test Utility
Tests if the flight controller is sending MAVLink data
"""

import socket
import time
import sys
from datetime import datetime

# Configuration
LOCAL_PORT = 14550
FC_IP = '192.168.0.7'
FC_PORT = 14550

print('🧪 MAVLink UDP Test Utility\n')
print('Configuration:')
print(f'  Listening on: 0.0.0.0:{LOCAL_PORT}')
print(f'  FC Address: {FC_IP}:{FC_PORT}\n')

# Create UDP socket
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

try:
    sock.bind(('0.0.0.0', LOCAL_PORT))
    print(f'✅ Socket bound to port {LOCAL_PORT}')
except Exception as e:
    print(f'❌ Failed to bind socket: {e}')
    sys.exit(1)

print('\n💓 Sending initial heartbeat to announce GCS presence...\n')

# Simple MAVLink v2 heartbeat
def send_heartbeat():
    """Send a MAVLink v2 HEARTBEAT message"""
    heartbeat = bytes([
        0xFD,       # STX (MAVLink v2)
        0x09,       # Payload length
        0x00,       # Incompat flags
        0x00,       # Compat flags
        0x00,       # Sequence
        0xFF,       # System ID (255 = GCS)
        0xBE,       # Component ID (190 = GCS)
        0x00, 0x00, 0x00, # Message ID (0 = HEARTBEAT)
        # Payload (9 bytes):
        0x00, 0x00, 0x00, 0x00, # custom_mode
        0x06,       # type (MAV_TYPE_GCS)
        0x08,       # autopilot (MAV_AUTOPILOT_INVALID)
        0x00,       # base_mode
        0x04,       # system_status (MAV_STATE_ACTIVE)
        0x03,       # mavlink_version
        # CRC (placeholder - would need proper calculation)
        0x00, 0x00
    ])
    
    try:
        sock.sendto(heartbeat, (FC_IP, FC_PORT))
    except Exception as e:
        print(f'❌ Failed to send heartbeat: {e}')

# Send initial heartbeat
send_heartbeat()

print('👂 Listening for MAVLink packets...')
print('   (Press Ctrl+C to stop)\n')

# Set socket to non-blocking for timeout
sock.settimeout(1.0)

packet_count = 0
last_packet_time = None
start_time = time.time()
last_status_time = start_time
last_heartbeat_time = start_time

# Common MAVLink message IDs
MSG_NAMES = {
    0: 'HEARTBEAT',
    33: 'GLOBAL_POSITION_INT',
    24: 'GPS_RAW_INT',
    147: 'BATTERY_STATUS',
    77: 'COMMAND_ACK',
    30: 'ATTITUDE',
    32: 'LOCAL_POSITION_NED'
}

try:
    while True:
        current_time = time.time()
        
        # Send heartbeat every 1 second
        if current_time - last_heartbeat_time >= 1.0:
            send_heartbeat()
            last_heartbeat_time = current_time
        
        # Show status every 5 seconds
        if current_time - last_status_time >= 5.0:
            if packet_count == 0:
                elapsed = int(current_time - start_time)
                print(f'⏳ Still waiting for packets... ({elapsed}s elapsed)')
            else:
                time_since = int(current_time - last_packet_time) if last_packet_time else 0
                print(f'📊 Status: {packet_count} packets received (last: {time_since}s ago)')
            last_status_time = current_time
        
        try:
            # Receive packet (with timeout)
            data, addr = sock.recvfrom(4096)
            
            packet_count += 1
            last_packet_time = current_time
            
            print(f'\n📦 Packet #{packet_count} received:')
            print(f'   From: {addr[0]}:{addr[1]}')
            print(f'   Size: {len(data)} bytes')
            
            if len(data) > 0:
                first_byte = data[0]
                
                if first_byte == 0xFD:
                    print(f'   ✅ MAVLink v2 packet detected!')
                    if len(data) >= 10:
                        # Extract message ID (little-endian, 24-bit)
                        msg_id = data[7] | (data[8] << 8) | (data[9] << 16)
                        print(f'   Message ID: {msg_id}')
                        
                        if msg_id in MSG_NAMES:
                            print(f'   Message Type: {MSG_NAMES[msg_id]}')
                
                elif first_byte == 0xFE:
                    print(f'   ✅ MAVLink v1 packet detected!')
                    if len(data) >= 6:
                        msg_id = data[5]
                        print(f'   Message ID: {msg_id}')
                        if msg_id in MSG_NAMES:
                            print(f'   Message Type: {MSG_NAMES[msg_id]}')
                
                else:
                    print(f'   ⚠️  Not MAVLink (first byte: 0x{first_byte:02x})')
                
                # Show first 20 bytes in hex
                hex_dump = ' '.join(f'{b:02x}' for b in data[:20])
                if len(data) > 20:
                    hex_dump += '...'
                print(f'   Hex: {hex_dump}')
        
        except socket.timeout:
            # No data received, continue loop
            pass

except KeyboardInterrupt:
    print('\n\n📊 Test Summary:')
    print(f'   Total packets received: {packet_count}')
    print(f'   Test duration: {int(time.time() - start_time)}s')
    
    if packet_count == 0:
        print('\n❌ No packets received!')
        print('\n🔍 Possible issues:')
        print('   1. Flight controller not powered on')
        print('   2. FC not configured to send MAVLink over UDP')
        print('   3. FC sending to wrong IP address')
        print('   4. FC sending to wrong port (not 14550)')
        print('   5. Network connectivity issue')
        print('   6. Firewall blocking UDP port')
        print('\n💡 Next steps:')
        print('   1. Check your computer IP: ipconfig')
        print('   2. Configure FC to send to that IP')
        print('   3. Use port 14550 (standard)')
        print('   4. Reboot flight controller')
    else:
        print('\n✅ Connection working! Telemetry is being received.')
        print('\n💡 If GCS still shows no data:')
        print('   - The issue is in the GCS frontend parsing')
        print('   - Check browser console for errors')
        print('   - Verify /api/mavlink/heartbeat endpoint is being called')
    
    sock.close()
    sys.exit(0)
