# UDP/Ethernet Connection - Quick Start

## 🚀 Quick Connection Steps

### 1. Click Connect Button
Look for the **plug icon** (🔌) in the left sidebar and click it.

### 2. Select UDP Tab
In the connection modal, click the **UDP** tab (📡 icon).

### 3. Enter Your Flight Controller IP
```
Remote IP: 192.168.1.1  (your FC IP address)
Remote Port: 14550
Local Bind Port: 14550
```

### 4. Click Connect
Done! MAVLink telemetry should start flowing.

---

## 📍 Common Connection Configurations

### WiFi Telemetry Module (Most Common)
```
Type: UDP
Remote IP: 192.168.1.1
Remote Port: 14550
Local Bind Port: 14550
```

### SITL Simulation (Development)
```
Type: UDP
Remote IP: 127.0.0.1
Remote Port: 14550
Local Bind Port: 14551
```

### Listen for Any Connection
```
Type: UDP
Remote IP: 0.0.0.0
Remote Port: 14550
Local Bind Port: 14550
```

---

## 🔧 If Connection Fails

### Check These First:
1. ✅ Is your computer connected to the same network as the FC?
2. ✅ Can you ping the FC? `ping 192.168.1.1`
3. ✅ Is the flight controller powered on?
4. ✅ Is your firewall blocking port 14550?

### Windows Firewall Fix:
```powershell
netsh advfirewall firewall add rule name="MAVLink UDP" dir=in action=allow protocol=UDP localport=14550
```

### Linux Firewall Fix:
```bash
sudo ufw allow 14550/udp
```

---

## 📖 More Help

- **Full Guide**: `docs/UDP_ETHERNET_CONNECTION_GUIDE.md`
- **Troubleshooting**: See the troubleshooting section in the full guide
- **Hardware Setup**: Check your WiFi telemetry module documentation

---

## 🎯 Quick Tips

- Use **UDP for lowest latency** (best for flight operations)
- Use **TCP for reliability** (best for parameter downloads)
- Default MAVLink UDP port is **14550**
- Most WiFi modules create AP at **192.168.1.1** or **192.168.4.1**

---

That's it! You're ready for wireless telemetry! 🎉
