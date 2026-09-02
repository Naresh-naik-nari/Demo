# UDP Connection Test Instructions

## Quick Test to See if Flight Controller is Sending Data

I've created two test utilities to help diagnose the UDP connection issue.

---

## Option 1: Node.js Test (Recommended)

### Run the test:
```bash
node test-udp.js
```

### What it does:
- Binds to port 14550 and listens for UDP packets
- Sends heartbeats to your FC every 1 second
- Shows you exactly what packets are received
- Identifies MAVLink packets automatically

---

## Option 2: Python Test (Alternative)

### Run the test:
```bash
python test-udp.py
```

Same functionality as the Node.js version.

---

## What You'll See

### ✅ If FC is Sending Data (GOOD):
```
🧪 MAVLink UDP Test Utility

Configuration:
  Listening on: 0.0.0.0:14550
  FC Address: 192.168.0.7:14550

✅ Socket bound to port 14550

💓 Sending initial heartbeat to announce GCS presence...

👂 Listening for MAVLink packets...
   (Press Ctrl+C to stop)

📦 Packet #1 received:
   From: 192.168.0.7:14550
   Size: 39 bytes
   ✅ MAVLink v2 packet detected!
   Message ID: 0
   Message Type: HEARTBEAT
   Hex: fd 09 00 00 01 01 01 00 00 00...

📦 Packet #2 received:
   From: 192.168.0.7:14550
   Size: 71 bytes
   ✅ MAVLink v2 packet detected!
   Message ID: 33
   Message Type: GLOBAL_POSITION_INT
   Hex: fd 1c 00 00 02 01 01 21 00 00...
```

**This means:** FC is sending data correctly! Issue is in GCS frontend.

---

### ❌ If FC is NOT Sending (BAD):
```
🧪 MAVLink UDP Test Utility

Configuration:
  Listening on: 0.0.0.0:14550
  FC Address: 192.168.0.7:14550

✅ Socket bound to port 14550

💓 Sending initial heartbeat to announce GCS presence...

👂 Listening for MAVLink packets...
   (Press Ctrl+C to stop)

⏳ Still waiting for packets... (5s elapsed)
⏳ Still waiting for packets... (10s elapsed)
⏳ Still waiting for packets... (15s elapsed)

(Press Ctrl+C to stop)

📊 Test Summary:
   Total packets received: 0
   Test duration: 20s

❌ No packets received!
```

**This means:** FC is NOT sending data. Need to configure it.

---

## How to Run the Test

### Step 1: Stop the GCS Dev Server
```bash
# In the terminal running npm run dev, press Ctrl+C
```

### Step 2: Run the Test
```bash
# Choose one:
node test-udp.js
# OR
python test-udp.py
```

### Step 3: Wait 10-20 Seconds

Let it run and watch for packets.

### Step 4: Stop with Ctrl+C

Press `Ctrl+C` to stop and see the summary.

---

## Interpreting Results

### Result A: Packets Received ✅

You see `📦 Packet #X received` messages with MAVLink data.

**What this means:**
- ✅ Network is working
- ✅ FC is sending data
- ✅ GCS is receiving data
- ❌ Issue is in the GCS frontend/parsing

**Next step:**
- Check browser console for JavaScript errors
- Verify `/api/mavlink/heartbeat` endpoint is being called
- Check if data is in the logs but not being displayed

---

### Result B: No Packets Received ❌

You only see `⏳ Still waiting for packets...` and final count is 0.

**What this means:**
- ❌ FC is NOT sending MAVLink over UDP
- OR sending to wrong IP/port
- OR firewall blocking

**Next steps:**

1. **Find Your Computer's IP:**
   ```bash
   ipconfig
   ```
   Look for IPv4 Address (e.g., 192.168.0.100)

2. **Configure Flight Controller:**
   
   Connect to FC with Mission Planner/QGC and set:
   ```
   NET_ENABLE = 1
   NET_IPADDR = 192.168.0.7              # FC's IP
   NET_NETMASK = 255.255.255.0
   NET_P1_IP = [YOUR_COMPUTER_IP]        # From step 1!
   NET_P1_PORT = 14550
   NET_P1_PROTOCOL = 2                   # MAVLink 2
   SERIALx_PROTOCOL = 2                  # Enable MAVLink on telemetry port
   ```

3. **Reboot Flight Controller**

4. **Run Test Again**

---

## Firewall Test

If you get no packets, test if firewall is blocking:

### Windows:
```powershell
# Allow UDP 14550
netsh advfirewall firewall add rule name="MAVLink Test" dir=in action=allow protocol=UDP localport=14550
```

Then run the test again.

---

## Alternative: Use Different Port

If port 14550 doesn't work, try port 8234 (your original port):

### Edit the test file:

**In `test-udp.js` or `test-udp.py`, change:**
```javascript
const LOCAL_PORT = 8234;  // Change from 14550
const FC_PORT = 8234;     // Change from 14550
```

Then run the test again.

---

## Network Connectivity Test

Test if you can reach the FC at all:

```bash
ping 192.168.0.7
```

Should get replies. If not, network issue.

---

## What the Test Proves

| Test Result | What It Means | Where the Problem Is |
|-------------|---------------|----------------------|
| **Packets received** | UDP working, MAVLink arriving | GCS frontend/parsing |
| **No packets** | No data from FC | FC configuration or network |
| **Non-MAVLink packets** | Something else on port | Port conflict |

---

## After Running the Test

**Please report back:**

1. How many packets were received?
2. Were they identified as MAVLink?
3. What message types did you see?
4. What was the source IP and port?

This will tell us exactly where the problem is!

---

## Common Issues & Quick Fixes

### Issue: "Address already in use"
**Solution:** Stop the GCS dev server first (`Ctrl+C` in the terminal running `npm run dev`)

### Issue: "No packets received"
**Solution:** Flight controller not configured. Follow FC configuration steps above.

### Issue: "Permission denied"
**Solution:** Run as administrator (Windows) or with `sudo` (Linux/Mac)

### Issue: Packets from wrong IP
**Solution:** Another device is sending. Check the IP matches your FC (192.168.0.7)

---

**Ready to test? Run one of the commands above and let me know what you see!**
