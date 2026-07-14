# Quick Start Guide - USB Connection

## ✅ Your Setup

**Detected Devices:**
- ✨ **COM47**: Cube Orange+ Mavlink ← **Use this one!**
- COM48: Cube Orange+ SLCAN
- COM3: Intel AMT

## 🚀 Getting Started

### 1. Verify Configuration

Your `.env` file is already configured:
```env
USB_SERIAL_PORT=COM47
USB_BAUD_RATE=115200
```

### 2. Start the Application

The server is already running at:
- **Local**: http://localhost:5173/
- **Network**: http://192.168.0.108:5173/

### 3. Check Connection

1. Open http://localhost:5173/ in your browser
2. Navigate to the **Dashboard**
3. You should see telemetry data from your Cube Orange+:
   - GPS position
   - Battery status
   - Flight mode
   - Altitude and heading

## 🔧 Useful Commands

```bash
# List available serial ports
npm run list-ports

# Start development server
npm run dev

# Check for errors
npm run check
```

## 📊 Testing the Connection

### From the Browser Console:

Open Developer Tools (F12) and check the Network tab or Console for:
- MAVLink message logs
- Connection status messages

### Expected Data:

Once connected, you should receive MAVLink messages:
- `HEARTBEAT` - Flight controller is alive
- `GPS_RAW_INT` - GPS data
- `ATTITUDE` - Orientation data
- `GLOBAL_POSITION_INT` - Position data
- `SYS_STATUS` - Battery and system status

## ⚠️ Troubleshooting

### No Data Received?

1. **Check if device is powered on**
   - Cube Orange+ needs to be powered
   - USB alone may not be sufficient

2. **Verify the port**
   ```bash
   npm run list-ports
   ```

3. **Check if another app is using the port**
   - Close Mission Planner
   - Close QGroundControl
   - Close any other GCS software

4. **Try a different USB cable**
   - Some cables are charge-only
   - Use a data-capable USB cable

5. **Check baud rate**
   - Default is 115200
   - Verify in your flight controller settings

### Connection Error?

If you see "Error connecting to MAVLink server":
1. Restart the development server
2. Check the `.env` file has correct port
3. Try unplugging and replugging the USB

## 📱 Application Features

Once connected, you can:
- **Dashboard**: View real-time telemetry
- **Mission Planner**: Create and upload missions
- **Parameters**: View and modify flight controller parameters
- **Event Log**: Monitor MAVLink messages
- **Controls**: Send commands to the vehicle

## 🔄 Switching Modes

### USB Mode (Current)
```env
USB_SERIAL_PORT=COM47
```

### Simulator Mode (SITL)
Remove or comment out the USB_SERIAL_PORT line:
```env
# USB_SERIAL_PORT=COM47
```

### Different USB Port
```env
USB_SERIAL_PORT=COM48  # For SLCAN
```

## 📖 More Information

- Full documentation: See `USB_CONNECTION.md`
- MAVLink protocol: https://mavlink.io/
- Cube Orange+: https://docs.cubepilot.org/

## 🎯 Next Steps

1. ✅ Configuration complete
2. ✅ Server running
3. 📱 Open http://localhost:5173/ in your browser
4. 🚁 Start receiving telemetry data!

---

**Status**: 🟢 Ready to connect to Cube Orange+ on COM47
