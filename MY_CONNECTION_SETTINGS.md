# My UDP Connection Settings

## Current Configuration

```
Connection Type: UDP
Remote IP:       192.168.0.7
Remote Port:     8234
Local Bind Port: 14550
```

## What These Mean

- **Remote IP (192.168.0.7)**: Your flight controller's IP address
- **Remote Port (8234)**: Port where FC is sending MAVLink data
- **Local Bind Port (14550)**: Port where GCS listens for data

## Quick Actions

### Connect
1. Click the plug icon (🔌) in sidebar
2. Select UDP tab
3. Enter settings above
4. Click Connect

### If Connection Fails

**Check 1: Can you reach the FC?**
```bash
ping 192.168.0.7
```

**Check 2: Is port 8234 correct?**
Most systems use port 14550. Double-check your FC configuration.

**Check 3: Firewall blocking?**
```powershell
netsh advfirewall firewall add rule name="MAVLink" dir=in action=allow protocol=UDP localport=14550
```

**Check 4: Port already in use?**
Just click Disconnect and Connect again - the code now handles this automatically.

## Status Indicators

| Console Message | Meaning |
|----------------|---------|
| `🌐 Connecting to...` | Starting connection |
| `🔌 UDP socket bound...` | Socket listening |
| `💓 Sent initial heartbeat...` | GCS announcing presence |
| `⚠️ No MAVLink data...` | Waiting for telemetry |
| `✅ Receiving MAVLink data...` | Connected and online! |

## Troubleshooting

### Not receiving data after 10 seconds?

1. **Verify FC is sending to correct IP**
   - Your GCS computer IP should match FC destination
   - Use `ipconfig` to check your IP

2. **Check FC telemetry settings**
   - ArduPilot: `SERIALx_PROTOCOL = 2` (MAVLink2)
   - Destination: Your computer's IP
   - Port: 14550

3. **Try different ports**
   - Common alternatives: 14550, 14551, 5760, 5762

4. **Network issue?**
   - Ping FC: `ping 192.168.0.7`
   - Check subnet masks match
   - Disable VPN if active

### Connection keeps timing out?

The FC might not be configured to send MAVLink over UDP. Check:
- Serial port protocol setting
- Telemetry output enabled
- Network module firmware

## Notes

**Port 8234:** This is non-standard. Most MAVLink systems use 14550. 
- If you control the FC, consider changing to 14550
- Makes it easier to work with other GCS software

**Bandwidth:** UDP MAVLink typically uses ~5-10 KB/s
- WiFi should handle this easily
- 2.4GHz better range, 5GHz better bandwidth

---

*Save this file with your specific settings for quick reference!*
