# Telemetry Data Not Showing - Debug Guide

## Current Status

✅ **UDP Connection Working**
- Socket binds successfully
- Initial heartbeat sends successfully  
- Periodic heartbeats sending every 1 second
- No more "serialize" errors

❓ **Telemetry Data Not Arriving**
- Connection established but no MAVLink packets from flight controller
- Frontend stores remain empty

---

## Diagnostic Logging Added

Enhanced logging has been added to track UDP packet flow:

```typescript
// In _attachReaderUDP():
📦 UDP received X bytes     // Raw UDP packet received
📨 Parsed packet: msgid=... // Successfully parsed MAVLink packet
✅ Logged: MESSAGE_NAME     // Message added to store
⚠️ Unknown message ID: X    // Message ID not in registry
```

---

## How to Debug

### 1. **Restart the Dev Server**

Stop and restart to load the new diagnostic code:

```bash
# Stop server (Ctrl+C)
npm run dev
```

### 2. **Connect via UDP**

1. Click Connect button
2. Enter your settings:
   ```
   Type: UDP
   Remote IP: 192.168.0.7
   Remote Port: 8234
   Local Bind Port: 14550 (or auto)
   ```
3. Click Connect

### 3. **Check Console Output**

Look for these patterns in the server console:

#### ✅ **Good - Packets Arriving:**
```
🌐 Connecting to 192.168.0.7:8234 via UDP...
🔌 UDP socket bound to port 56700
💓 Sent initial heartbeat to 192.168.0.7:8234
📦 UDP received 39 bytes
📨 Parsed packet: msgid=0, sysid=1, compid=1
✅ Logged: HEARTBEAT
📦 UDP received 71 bytes
📨 Parsed packet: msgid=33, sysid=1, compid=1
✅ Logged: GLOBAL_POSITION_INT
```

#### ⚠️ **Problem - No Packets:**
```
🌐 Connecting to 192.168.0.7:8234 via UDP...
🔌 UDP socket bound to port 56700
💓 Sent initial heartbeat to 192.168.0.7:8234
⚠️ No MAVLink data received after 10s - continuing anyway
✅ UDP socket ready - waiting for MAVLink telemetry
(no more output - no packets received)
```

---

## Common Issues & Fixes

### Issue 1: No UDP Packets Received

**Symptom:** No `📦 UDP received X bytes` messages

**Possible Causes:**

1. **Flight Controller Not Sending**
   - FC not configured to send MAVLink over UDP
   - Wrong protocol on telemetry port
   - UDP output disabled

   **Fix:**
   - Check FC parameters: `SERIALx_PROTOCOL = 2` (MAVLink2)
   - Check UDP output is enabled
   - Verify telemetry port configuration

2. **Wrong Destination IP**
   - FC sending to different IP than GCS
   
   **Fix:**
   - Find your computer's IP: `ipconfig` (Windows) or `ifconfig` (Linux)
   - Configure FC to send to that IP
   - Ensure same subnet (e.g., both 192.168.0.X)

3. **Wrong Port**
   - FC sending to different port
   - Port 8234 is non-standard (most systems use 14550)
   
   **Fix:**
   - Check FC destination port configuration
   - Try standard port 14550:
     ```
     Remote Port: 14550
     Local Bind Port: 14550
     ```

4. **Firewall Blocking**
   - Windows firewall blocking UDP
   
   **Fix:**
   ```powershell
   netsh advfirewall firewall add rule name="MAVLink UDP" dir=in action=allow protocol=UDP localport=14550
   ```

5. **Network Issue**
   - Not on same network
   - Cannot reach FC
   
   **Fix:**
   ```bash
   ping 192.168.0.7
   ```
   Should get replies. If not, network connectivity problem.

### Issue 2: Packets Received But Not Parsed

**Symptom:** See `📦 UDP received` but no `📨 Parsed packet`

**Possible Causes:**

1. **Wrong MAVLink Version**
   - FC sending MAVLink v1, GCS expecting v2
   - Corrupted packets

   **Check:**
   - Look for parser errors in console
   - First byte of packet should be `0xFD` (MAVLink v2) or `0xFE` (MAVLink v1)

2. **Packet Corruption**
   - Network issues
   - Wrong packet format

### Issue 3: Packets Parsed But Not Logged

**Symptom:** See `📨 Parsed packet` but no `✅ Logged`

**Possible Causes:**

1. **Unknown Message ID**
   - Message not in REGISTRY
   - See `⚠️ Unknown message ID: X`
   
   **Normal** - Not all messages are in the registry, only important ones

2. **Data Extraction Failed**
   - `packet.protocol.data()` returned null
   - Payload doesn't match message definition

### Issue 4: Logged But Not Showing in UI

**Symptom:** See `✅ Logged: HEARTBEAT` but no data in dashboard

**Possible Causes:**

1. **Frontend Not Polling**
   - Heartbeat endpoint not being called
   
   **Check:**
   - Open browser DevTools → Network tab
   - Should see `/api/mavlink/heartbeat` requests every second

2. **Log Processing Issue**
   - Frontend receiving logs but not parsing them
   
   **Check:**
   - Browser console for JavaScript errors
   - Look for message parsing errors

---

## Testing Checklist

- [ ] Server restarted with new diagnostic code
- [ ] Browser hard refreshed (Ctrl+Shift+R)
- [ ] UDP connection established
- [ ] Console shows `📦 UDP received` messages
- [ ] Console shows `📨 Parsed packet` messages  
- [ ] Console shows `✅ Logged:` messages
- [ ] Browser DevTools shows `/api/mavlink/heartbeat` requests
- [ ] Dashboard displays telemetry data

---

## Expected Minimal MAVLink Stream

A working connection should receive at minimum:

1. **HEARTBEAT** (msgid=0) - Every 1 second from FC
2. **GLOBAL_POSITION_INT** (msgid=33) - Position, altitude, speed
3. **GPS_RAW_INT** (msgid=24) - GPS satellites, HDOP
4. **BATTERY_STATUS** (msgid=147) - Battery level
5. **COMMAND_ACK** (msgid=77) - Command acknowledgments

If you see these messages in console but not in UI, the issue is frontend parsing.

If you don't see these messages at all, the issue is network/FC configuration.

---

## What Data Should Show in UI

Once working, you should see:

### Dashboard
- ✅ Connection status (green dot)
- ✅ GPS coordinates
- ✅ Altitude
- ✅ Speed
- ✅ Heading
- ✅ Battery percentage
- ✅ Satellite count
- ✅ Flight mode
- ✅ Armed/Disarmed state

### Map
- ✅ Vehicle marker at current location
- ✅ Vehicle heading indicator
- ✅ Map follows vehicle (if lock enabled)

### Stats Panel
- ✅ All telemetry values updating in real-time

### Event Log
- ✅ MAVLink messages scrolling
- ✅ HEARTBEAT, GLOBAL_POSITION_INT, etc.

---

## Next Steps Based on Console Output

### If you see `📦 UDP received` messages:
✅ Network is working, FC is sending data
→ Check if packets are being parsed

### If you DON'T see `📦 UDP received`:
❌ No data from FC
→ Check FC configuration and network connectivity

### If you see `📨 Parsed packet` but wrong msgid:
→ You're receiving data but maybe not the right messages
→ Check what message IDs you're seeing

### If you see `✅ Logged:` but no UI update:
→ Backend is working, frontend issue
→ Check browser console for errors

---

## Manual Test Commands

### Check if FC is sending anything:
```bash
# Listen on port 14550
nc -ul 14550
```

Should see binary MAVLink data if FC is transmitting.

### Check network path:
```bash
ping 192.168.0.7
```

### Check port availability:
```powershell
netstat -an | findstr :14550
```

---

## Port Configuration Matrix

| Scenario | Remote Port | Local Bind Port | Notes |
|----------|-------------|-----------------|-------|
| **Standard** | 14550 | 14550 | Most common |
| **Your Setup** | 8234 | 14550 | Non-standard, verify FC config |
| **SITL** | 14550 | 14551 | Avoid conflict with SITL |
| **Multiple GCS** | 14550 | 14552+ | Each GCS different port |

---

## Contact Points for Help

After running diagnostics, report:

1. **Console output** showing:
   - Connection messages
   - Any `📦 UDP received` messages
   - Any `📨 Parsed packet` messages
   - Any error messages

2. **Network info:**
   - GCS IP: (run `ipconfig`)
   - FC IP: 192.168.0.7
   - Can ping FC: Yes/No

3. **FC Configuration:**
   - Autopilot: (ArduPilot/PX4/other)
   - Telemetry protocol setting
   - UDP destination IP and port

This will help identify exactly where the data flow breaks down.

---

**Last Updated:** After adding diagnostic logging for UDP telemetry
