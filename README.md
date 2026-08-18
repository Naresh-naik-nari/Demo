# Sidak Ground Control Station (GCS)

A modern, feature-rich Ground Control Station built with SvelteKit for MAVLink-based drones and UAVs.

## Features

- 🎮 **Real-time Control** - Direct MAVLink communication for live telemetry and control
- 🗺️ **Dual Map Views** - OpenStreetMap and Google Satellite imagery
- 📡 **Offline Maps** - Pre-download tiles for operation without internet connectivity
- 🎯 **Mission Planning** - Create and manage waypoint-based missions
- 📹 **Live Video Feed** - Real-time video streaming from drone camera
- 📊 **Telemetry Display** - Comprehensive flight data visualization
- 🔐 **User Authentication** - Secure login and session management
- 🌓 **Dark Mode** - Full dark/light theme support

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or pnpm
- Serial port access for MAVLink connection

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

### Building for Production

```bash
npm run build
```

You can preview the production build with `npm run preview`.

## Offline Maps

The GCS includes a powerful offline maps feature that allows operation in areas without internet connectivity.

### Quick Start

1. Click the **Download** icon (📥) on the map
2. Configure download radius (default: 10 km)
3. Select zoom levels (10-18 recommended)
4. Click "Download" and wait for completion

### Key Features

- **Automatic caching**: All viewed tiles are cached automatically
- **Pre-download**: Download entire mission areas before deployment
- **10 km radius**: Default coverage suitable for most operations
- **Dual map support**: Works with both OpenStreetMap and Satellite imagery

See [Offline Maps Guide](./docs/OFFLINE_MAPS_GUIDE.md) for detailed documentation.

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Video feed configuration
VITE_VIDEO_PORT=8889
VITE_VIDEO_PATH=cam

# Database (optional)
DATABASE_URL=file:./src/data.db
```

### Serial Port Connection

Use the plug icon in the sidebar to connect to your MAVLink device via USB/Serial.

## Documentation

- [Offline Maps Guide](./docs/OFFLINE_MAPS_GUIDE.md) - Detailed offline maps documentation
- [Quick Start Guide](./QUICK_START.md) - Getting started with the GCS
- [Software Requirements Specification](./docs/SRS_ISO12207_Sidak_GCS.md) - ISO 12207 SRS
- [Architectural Design Document](./docs/ADD_ISO12207_Sidak_GCS.md) - ISO 12207 ADD
- [Verification & Validation Plan](./docs/SVVP_IEEE1012_Sidak_GCS.md) - IEEE 1012 SVVP

## Technology Stack

- **Frontend**: SvelteKit, Tailwind CSS
- **Maps**: Leaflet, MapLibre GL
- **MAVLink**: node-mavlink
- **Authentication**: Lucia Auth
- **Database**: LibSQL (SQLite)

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

[Your License Here]

## Support

For issues and questions, please open an issue on GitHub or contact the development team.
