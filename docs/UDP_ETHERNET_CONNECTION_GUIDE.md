# UDP/Ethernet Connection Guide

## Overview

The Ground Control Station now supports connecting to flight controllers via UDP and TCP over Ethernet or WiFi, in addition to traditional USB/Serial connections.

## Connection Types

### 1. Serial (USB)
- **Use Case**: Direct USB connection to flight controller
- **Port**: COM port (Windows) or /dev/tty* (Linux/Mac)
- **Baud Rate**: Typically 57600 or 115200
- **Latency**: Lowest
- **Range**: Cable length only

### 2. TCP (Ethernet/WiFi)
- **Use Case**: Reliable connection over network
- **Port**: Typically 5760
- **Pros**: Connection-oriented, reliable
- **Cons**: Slight overhead
- **Range**: Network-dependent

### 3. UDP (Ethernet/WiFi) ⭐ Recommended for Wireless
- **Use Case**: Low-latency wireless telemetry
- **Port**: Typically 14550 (MAVLink standard)
- **Pros**: Lowest latency, standard MAVLink protocol
- **Cons**: Connectionless (packet loss possible)
- **Range**: WiFi range (~100m typical)

---

## Quick Start - UDP Connection

### Step 1: Configure Your Flight Controller

Most flight controllers need to be configured to send MAVLink over UDP. Here are common setups:

#### ArduPilot (Pixhawk, Cube, etc.)
```
SERIAL2_PROTOCOL = 2 (MAVLink 2)
SERIAL2_BAUD = 921600
```

Then connect a WiFi telemetry module (e.g., ESP32, mRo Nexus) to TELEM2 port.

#### PX4
```
MAV_1_CONFIG = TELEM 2
MAV_1_MODE = Normal
SER_TEL2_BAUD = 921600
```

### Step 2: Connect WiFi Telemetry Hardware

Common hardware options:
- **ESP32 WiFi Module** (ArduPilot firmware)
- **mRo Nexus**
- **Holybro WiFi Telemetry**
- **RFD900x with Ethernet**

### Step 3: Connect from GCS

1. Click the **Connect** button (plug icon) in sidebar
2. Select **UDP** tab
3. Enter flight controller IP address (e.g., `192.168.1.1`)
4. Keep default port `14550`
5. Click **Connect**

---

## Connection Configurations

### UDP - WiFi Telemetry (Most Common)

```
Connection Type: UDP
Remote IP: 192.168.1.1
Remote Port: 14550
Local Bind Port: 14550
```

**What this does:**
- Listens on port 14550 for incoming MAVLink packets
- Sends commands to flight controller at 192.168.1.1:14550

### UDP - SITL Simulation

```
Connection Type: UDP
Remote IP: 127.0.0.1
Remote Port: 14550
Local Bind Port: 14551
```

**What this does:**
- Connects to ArduPilot SITL running locally
- Uses different bind port to avoid conflicts

### UDP - Broadcast (Listen All)

```
Connection Type: UDP
Remote IP: 0.0.0.0
Remote Port: 14550
Local Bind Port: 14550
```

**What this does:**
- Listens for MAVLink from any IP address
- Useful when FC IP is unknown or DHCP

### TCP - Reliable Connection

```
Connection Type: TCP
Host: 192.168.1.1
Port: 5760
```

**What this does:**
- Establishes TCP connection
- Better for file transfers, parameter downloads
- Slightly higher latency than UDP

---

## Network Setup Examples

### Example 1: ESP32 WiFi Access Point

**Flight Controller:** ESP32 creates WiFi AP
- **SSID**: `ArduPilot`
- **Password**: `ardupilot`
- **FC IP**: `192.168.4.1`

**GCS Connection:**
```
Type: UDP
Host: 192.168.4.1
Port: 14550
```

### Example 2: Home Network

**Flight Controller:** Connected to home WiFi via WiFi telemetry
- **FC IP**: `192.168.1.100` (assigned by router)

**GCS Connection:**
```
Type: UDP
Host: 192.168.1.100
Port: 14550
```

**Tip:** Set static IP on flight controller WiFi module to avoid IP changes.

### Example 3: Direct Ethernet

**Flight Controller:** Connected via Ethernet to Raspberry Pi
- **Pi IP**: `192.168.2.2`
- **GCS IP**: `192.168.2.1`

**GCS Connection:**
```
Type: TCP (more reliable over wired)
Host: 192.168.2.2
Port: 5760
```

---

## Troubleshooting

### Problem: Cannot connect

**Check:**
1. Flight controller WiFi module powered on?
2. GCS computer connected to same network?
3. Can you ping the FC IP? `ping 192.168.1.1`
4. Firewall blocking port 14550?
5. Correct IP address entered?

**Solution:**
```powershell
# Windows - Test connectivity
ping 192.168.1.1

# Check if port is listening
Test-NetConnection -ComputerName 192.168.1.1 -Port 14550
```

### Problem: Connection drops frequently

**Causes:**
- WiFi interference
- Distance too far from flight controller
- Weak WiFi signal

**Solutions:**
- Move closer to vehicle
- Use external WiFi antenna on GCS
- Switch to 5GHz WiFi if supported
- Reduce telemetry stream rate in FC

### Problem: High latency

**Check:**
- Network ping time: should be < 50ms
- WiFi signal strength
- Other devices on network

**Solution:**
- Use UDP instead of TCP
- Reduce telemetry rate on FC
- Use 5GHz WiFi band
- Reduce distance to vehicle

### Problem: Firewall blocking connection

**Windows:**
```powershell
# Allow incoming UDP on port 14550
netsh advfirewall firewall add rule name="MAVLink UDP" dir=in action=allow protocol=UDP localport=14550
```

**Linux:**
```bash
# Allow incoming UDP on port 14550
sudo ufw allow 14550/udp
```

---

## Port Reference

| Port | Protocol | Use Case |
|------|----------|----------|
| 14550 | UDP | MAVLink standard (primary) |
| 14551 | UDP | MAVLink secondary |
| 5760 | TCP | MAVLink TCP |
| 5762 | UDP | MAVLink camera |
| 5763 | UDP | MAVLink gimbal |

---

## Advanced Configuration

### Bidirectional UDP

For two-way UDP communication:

**Flight Controller side:**
```
SERIAL2_PROTOCOL = 2
NET_ENABLE = 1
NET_P1_TYPE = 1 (UDP Client)
NET_P1_IP0 = 192
NET_P1_IP1 = 168
NET_P1_IP2 = 1
NET_P1_IP3 = 100  (GCS IP)
NET_P1_PORT = 14550
```

**GCS side:**
```
Type: UDP
Host: 192.168.1.1  (FC IP)
Port: 14550
Bind Port: 14550
```

### Multiple GCS Instances

You can connect multiple GCS computers by:
1. Using different bind ports on each GCS
2. Flight controller broadcasts to all

**GCS 1:**
```
Bind Port: 14550
```

**GCS 2:**
```
Bind Port: 14551
```

---

## Performance Comparison

| Connection | Latency | Reliability | Range | Setup |
|------------|---------|-------------|-------|-------|
| USB Serial | ~10ms | ✅ Excellent | Cable only | ⭐ Easy |
| TCP/IP | ~20-50ms | ✅ Excellent | Network | ⭐⭐ Medium |
| UDP/IP | ~15-30ms | ⭐⭐ Good | Network | ⭐⭐ Medium |
| WiFi (UDP) | ~20-100ms | ⭐ Variable | ~100m | ⭐⭐⭐ Complex |

---

## Best Practices

### For Flight Operations
1. **Test connection before flight** - Verify stable connection
2. **Check signal strength** - Ensure strong WiFi signal
3. **Have backup** - Keep USB cable as failsafe
4. **Monitor latency** - Watch for connection degradation
5. **Set geofence** - Limit range to WiFi coverage

### For Development
1. **Use UDP for SITL** - Lowest latency for simulation
2. **Use TCP for parameter tuning** - More reliable for large transfers
3. **Use localhost** - Faster than network when possible

### For Long Range
1. **Use 900MHz telemetry** - Better range than WiFi
2. **Lower data rate** - Improves range
3. **Directional antennas** - Extend WiFi range

---

## Security Considerations

### WiFi Security
- Use WPA2 or WPA3 for AP mode
- Change default passwords
- Use VPN for internet-based connections
- Firewall rules to limit access

### Network Isolation
- Use dedicated network for drone operations
- Avoid public WiFi
- Consider VPN for remote operations

---

## Hardware Recommendations

### WiFi Telemetry Modules

**Budget ($20-40):**
- ESP32 with ArduPilot firmware
- Basic 2.4GHz, ~50m range

**Mid-Range ($50-100):**
- mRo Nexus
- Holybro WiFi Telemetry
- 2.4/5GHz dual-band

**Professional ($150+):**
- RFD900x with Ethernet bridge
- Long-range (10+ km)
- Frequency hopping

### Network Hardware

**Router for Field Ops:**
- Portable travel router
- Battery powered
- Supports multiple devices

**Antennas:**
- External WiFi antenna for GCS laptop
- Directional antennas for long range

---

## Example Setups

### Setup 1: Basic WiFi Telemetry
```
Hardware:
- Pixhawk flight controller
- ESP32 WiFi module on TELEM2
- Laptop with WiFi

Connection:
1. ESP32 creates AP "ArduPilot"
2. Connect laptop to "ArduPilot" WiFi
3. GCS connects to 192.168.4.1:14550 UDP
```

### Setup 2: Home Network
```
Hardware:
- Flight controller with WiFi
- Home router (192.168.1.1)
- FC static IP: 192.168.1.100

Connection:
1. FC connects to home WiFi
2. GCS on same network
3. Connect to 192.168.1.100:14550 UDP
```

### Setup 3: Companion Computer
```
Hardware:
- Flight controller
- Raspberry Pi (companion)
- Ethernet cable between FC and Pi
- Pi on WiFi network

Connection:
1. FC sends MAVLink to Pi via serial
2. Pi runs mavlink-router
3. GCS connects to Pi IP:14550 UDP
```

---

## Testing Your Connection

### 1. Ping Test
```powershell
# Windows/Linux
ping 192.168.1.1
```
**Expected:** < 50ms response time

### 2. Port Test
```powershell
# Windows
Test-NetConnection -ComputerName 192.168.1.1 -Port 14550
```

### 3. MAVLink Test
```bash
# Using mavproxy
mavproxy.py --master=udp:192.168.1.1:14550
```

### 4. Packet Capture
```bash
# Wireshark filter
udp.port == 14550
```

---

## Quick Reference Card

```
┌─────────────────────────────────────┐
│ UDP Connection (Most Common)        │
├─────────────────────────────────────┤
│ Type: UDP                           │
│ Host: 192.168.1.1                   │
│ Port: 14550                         │
│ Bind: 14550                         │
└─────────────────────────────────────┘

Common IPs:
• 192.168.1.1   - WiFi AP mode
• 192.168.4.1   - ESP32 default
• 127.0.0.1     - SITL localhost
• 0.0.0.0       - Listen all

Common Ports:
• 14550 - MAVLink UDP (standard)
• 5760  - MAVLink TCP
• 5762  - Camera stream
```

---

**Version:** 1.0  
**Last Updated:** 2026-08-18  
**For:** Sidak Ground Control Station

**Need Help?** Check the troubleshooting section or contact support.
