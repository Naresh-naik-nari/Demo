# Telemetry Not Displaying - Complete Debug Guide

## Current Status
✅ UDP connection established  
✅ Heartbeats sending  
❌ Telemetry data not displaying in frontend

## Data Flow Overview

```
Flight Controller (192.168.0.7:14550)
          ↓ UDP packets
    [mavlink.ts] 
          ↓ Parse & log
    S.logs[] + S.newLogs[]
          ↓ API endpoint
    /api/mavlink/heartbeat (called every 1.1s)
          ↓ Returns newLogs
    [+layout.svelte] checkOnlineStatus()
          ↓ Process logs
    messageHandlers{}
          ↓ Update stores
    Frontend displays data
```

## Debug Steps

### Step 1: Check if UDP is Receiving Data

**Open terminal in project directory:**
```bash
node test-udp.js
```

**Wait 15-20 seconds, then press Ctrl+C**

**Expected output:**
- If you see `📦 Packet #1 received` → FC is sending ✅
- If you see `⏳ Still waiting...` → FC NOT sending ❌

**If NO packets:**
- Flight controller not configured properly
- See "FC Configuration" section below

**If packets ARE received:**
- Continue to Step 2

---

### Step 2: Check Server Console Logs

**In the terminal running `npm run dev`**, look for these messages:

```
📦 UDP received 39 bytes          ← Socket received data ✅
📨 Parsed packet: msgid=0...       ← Parser decoded MAVLink ✅
✅ Logged: HEARTBEAT               ← Added to S.newLogs ✅
```

**What to check:**

| Log Message | What It Means | If Missing |
|-------------|---------------|------------|
| `📦 UDP received` | Socket got data | Check FC sending |
| `📨 Parsed packet` | MAVLink decoded | Check packet format |
| `✅ Logged: [TYPE]` | Added to logs array | Check REGISTRY |
| `⚠️ Unknown message ID` | Message not in REGISTRY | Add to registry |

**If you see all three** (📦, 📨, ✅):
- Server is receiving and logging correctly ✅
- Continue to Step 3

**If you see 📦 but NOT 📨:**
- Packet splitter/parser issue
- Data might not be valid MAVLink

**If you see 📨 but NOT ✅:**
- Message ID not in REGISTRY
- Look for `⚠️ Unknown message ID: X`

---

### Step 3: Check API Endpoint Response

**Open Chrome DevTools → Network tab**

1. Filter by: `heartbeat`
2. Click on a `/api/mavlink/heartbeat` request
3. Check the Response tab

**Expected response:**
```json
{
  "logs": [
    "HEARTBEAT(0)::2024-08-26T...::sysid=1,compid=1::{...}",
    "GLOBAL_POSITION_INT(33)::2024-08-26T...::sysid=1,compid=1::{...}",
    "GPS_RAW_INT(24)::2024-08-26T...::sysid=1,compid=1::{...}"
  ],
  "portOpen": true,
  "online": true
}
```

**What to check:**

| Field | Expected | If Wrong |
|-------|----------|----------|
| `logs` | Array with entries | If empty → logs not being collected |
| `portOpen` | `true` | If `false` → socket not connected |
| `online` | `true` | If `false` → no data received yet |

**If `logs` array is EMPTY:**
- Server receiving data but `newLogs` not being sent
- Check mavlink.ts line 835: `export const newLogs = S.newLogs`
- Continue to Step 4

**If `logs` array HAS data:**
- API is working correctly ✅
- Issue is in frontend parsing
- Continue to Step 5

---

### Step 4: Check newLogs Export

**File:** `src/lib/server/mavlink.ts` (line 835)

```typescript
export const newLogs = S.newLogs as string[];
```

**Also check the heartbeat endpoint:**
**File:** `src/routes/api/mavlink/[type]/+server.ts` (line 26)

```typescript
case 'heartbeat':
    const logsToSend = newLogs.splice(0);  // This empties newLogs!
    return new Response(JSON.stringify({ 
        logs: logsToSend, 
        portOpen: status.portOpen, 
        online: status.online 
    }));
```

**Note:** `newLogs.splice(0)` removes all items from the array after reading them. This is correct behavior - logs are sent once then cleared.

**If newLogs is always empty:**
- Check `_attachReaderUDP()` function (line 597-631)
- Verify both `S.logs.push(entry)` and `S.newLogs.push(entry)` are being called

---

### Step 5: Check Frontend Log Processing

**File:** `src/routes/+layout.svelte`

**Check `checkOnlineStatus()` function (line 154):**

```typescript
async function checkOnlineStatus() {
    const response = await fetch('/api/mavlink/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
        const data = await response.json();
        const mavLogs: string[] = Array.isArray(data) ? data : (data.logs ?? []);
        
        console.log('Received logs:', mavLogs.length);  // ADD THIS DEBUG LINE
        
        if (mavLogs.length > 0) {
            mavLogs.forEach((log: string) => {
                getLogs(log.replace(/\\"/g, '"') + '\n');
            });
        }
    }
}
```

**Add a debug line to see if logs are arriving:**

1. Open `src/routes/+layout.svelte`
2. Find line 171 (inside `checkOnlineStatus`)
3. Add: `console.log('📥 Received logs:', mavLogs.length, mavLogs);`
4. Save the file
5. Open browser console
6. Watch for the debug output every 1.1 seconds

**Expected:**
```
📥 Received logs: 5 [Array of log strings]
```

**If you see this:**
- Frontend IS receiving logs ✅
- Continue to Step 6

**If you DON'T see this:**
- Frontend not calling API
- OR API not responding
- Check network tab for errors

---

### Step 6: Check Message Parsing

**Check `getLogs()` function (line 573):**

```typescript
async function getLogs(text: string) {
    logs = logs.slice(-1000);
    if (!text || logs.includes(text)) return;  // Duplicate check
    
    logs = [...logs, text];
    mavlinkLogStore.set(logs);
    
    console.log('🔍 Processing log:', text);  // ADD THIS DEBUG LINE
    
    // Find which message type this is and process it
    for (const [messageType, handler] of Object.entries(messageHandlers)) {
        if (text.includes(messageType)) {
            console.log('✅ Matched handler:', messageType);  // ADD THIS DEBUG LINE
            handler(text);
            break;
        }
    }
}
```

**Add debug lines:**

1. Line 577: `console.log('🔍 Processing log:', text);`
2. Line 583: `console.log('✅ Matched handler:', messageType);`

**Expected output in browser console:**
```
🔍 Processing log: HEARTBEAT(0)::2024-08-26...
✅ Matched handler: HEARTBEAT

🔍 Processing log: GLOBAL_POSITION_INT(33)::...
✅ Matched handler: GLOBAL_POSITION_INT
```

**If you see the processing logs:**
- Message handlers ARE being called ✅
- Continue to Step 7

**If you DON'T see matched handler:**
- Log format might be wrong
- Check if text includes message type name

---

### Step 7: Check Specific Message Handlers

**Example: GLOBAL_POSITION_INT handler (line 334)**

Add debug output to see extracted values:

```typescript
GLOBAL_POSITION_INT: (text: string) => {
    console.log('📍 GPS Position handler called');  // ADD THIS
    
    const lat = extractValue(text, 'lat');
    const lon = extractValue(text, 'lon');
    console.log('📍 Extracted:', { lat, lon });  // ADD THIS
    
    const position = parseLocation(lat, lon);
    if (position) {
        console.log('📍 Setting position:', position);  // ADD THIS
        mavLocationStore.set(position);
    }
    
    // ... rest of handler
}
```

**Do the same for other key handlers:**
- `HEARTBEAT` (line 366)
- `BATTERY_STATUS` (line 491)
- `GPS_RAW_INT` (line 350)

---

### Step 8: Check Svelte Store Updates

**Add a reactive statement in `+layout.svelte`:**

```typescript
// Add this near line 100 (after store declarations)
$: if ($mavLocationStore) {
    console.log('🗺️ Location store updated:', $mavLocationStore);
}

$: if ($mavBatteryStore) {
    console.log('🔋 Battery store updated:', $mavBatteryStore);
}

$: if ($mavAltitudeStore) {
    console.log('📏 Altitude store updated:', $mavAltitudeStore);
}
```

**Expected in console:**
```
🗺️ Location store updated: {lat: 33.79105, lng: -84.37130}
🔋 Battery store updated: 95
📏 Altitude store updated: 125.3
```

**If stores ARE updating:**
- Data is flowing correctly ✅
- Issue is in UI components not reading stores
- Check Dashboard components

**If stores NOT updating:**
- Handlers not setting values
- Go back to Step 7

---

## Quick Debug Script

**Add this to `src/routes/+layout.svelte` temporarily:**

```typescript
// Add after onMount() around line 647
setInterval(() => {
    console.log('🎯 Current State:', {
        online: $onlineStore,
        serialConnected,
        location: $mavLocationStore,
        battery: $mavBatteryStore,
        altitude: $mavAltitudeStore,
        heading: $mavHeadingStore,
        armed: $mavArmedStateStore,
        logsCount: logs.length
    });
}, 5000);
```

This will print the complete state every 5 seconds.

---

## Common Issues & Solutions

### Issue 1: Logs arrive but stores don't update

**Cause:** `extractValue()` not finding keys in log text

**Solution:** Check log format. Should be:
```
HEARTBEAT(0)::2024-08-26T12:00:00::sysid=1,compid=1::{"type":6,"autopilot":3,...}
```

**Fix:** Verify JSON structure matches what `extractValue()` expects

---

### Issue 2: Duplicate logs being ignored

**Cause:** Line 575 checks `logs.includes(text)`

**Solution:** This is intentional to prevent duplicates. If no new data, this is correct.

---

### Issue 3: Message type not matched

**Cause:** Log text doesn't include message type name

**Solution:** Check that log format is:
```
MESSAGE_TYPE(id)::timestamp::system::data
```

The message type name MUST be at the start

---

### Issue 4: Values are 0 or null

**Cause:** Division/parsing errors in handlers

**Example:**
```typescript
const lat = parseInt(extractValue(text, 'lat') || '0') / 1e7;
```

If `lat` is a string or null, this becomes 0.

**Solution:** Add null checks:
```typescript
const latStr = extractValue(text, 'lat');
if (!latStr) return;
const lat = parseInt(latStr) / 1e7;
```

---

## Flight Controller Configuration

If `test-udp.js` shows NO packets received, configure FC:

### ArduPilot Parameters:

```
NET_ENABLE = 1
NET_IPADDR = 192.168.0.7
NET_NETMASK = 255.255.255.0
NET_P1_IP = [YOUR_COMPUTER_IP]      # Run: ipconfig to find
NET_P1_PORT = 14550
NET_P1_PROTOCOL = 2                  # MAVLink 2
SERIAL1_PROTOCOL = 2                 # Enable MAVLink on telemetry port
```

### Find Your Computer IP:

```bash
ipconfig
```

Look for: **IPv4 Address** (e.g., 192.168.0.100)

### Reboot FC After Changes!

---

## Complete Test Procedure

**Run this in order:**

1. ✅ Run `node test-udp.js` → Verify FC sending packets
2. ✅ Check server console → See `📦 UDP received` messages  
3. ✅ Check DevTools Network → See `/api/mavlink/heartbeat` with logs
4. ✅ Add debug logs to `getLogs()` → Verify handlers called
5. ✅ Add debug to message handlers → Verify values extracted
6. ✅ Add reactive statements → Verify stores updating
7. ✅ Check Dashboard components → Verify UI reading stores

---

## Final Checklist

- [ ] `test-udp.js` shows packets received
- [ ] Server console shows `📦 UDP received`
- [ ] Server console shows `📨 Parsed packet`
- [ ] Server console shows `✅ Logged: [TYPE]`
- [ ] API endpoint returns `logs` array with data
- [ ] Browser console shows `📥 Received logs`
- [ ] Browser console shows `🔍 Processing log`
- [ ] Browser console shows `✅ Matched handler`
- [ ] Browser console shows store updates
- [ ] Dashboard displays the data

---

## If ALL Steps Pass But Still No Display

**Check the Dashboard components:**

1. `src/routes/dashboard/+page.svelte`
2. `src/components/Stats.svelte`
3. `src/components/Map.svelte`
4. `src/components/ConnectionStatus.svelte`

**Verify they are:**
- Importing the correct stores
- Using `$storeName` syntax to read values
- Not filtering/hiding data based on conditions

---

## Contact Info

If you've completed all steps and found where the issue is, report:

1. Which step failed?
2. What was the console output?
3. What were the store values?
4. Screenshots of DevTools Network tab

This will help pinpoint the exact problem!
