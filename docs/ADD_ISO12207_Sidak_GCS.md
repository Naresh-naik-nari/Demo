# Software Architectural Design Document (ADD)
## Sidak Ground Control Station (GCS)
### Conforming to ISO/IEC 12207:2017 — Software Architectural Design Process (§6.4.4)

---

**Document ID:** SGCS-ADD-001  
**Version:** 1.0  
**Date:** 2026-07-13  
**Status:** Draft  
**SRS Reference:** CGCS-SRS-001  
**SVVP Reference:** SGCS-SVVP-001  
**Prepared by:** [Author Name]  
**Reviewed by:** [Reviewer Name]  
**Approved by:** [Approver Name]

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Architectural Goals and Constraints](#2-architectural-goals-and-constraints)
3. [System Context and Boundaries](#3-system-context-and-boundaries)
4. [Architectural Viewpoints](#4-architectural-viewpoints)
   - 4.1 Logical View
   - 4.2 Process View
   - 4.3 Development View
   - 4.4 Physical Deployment View
   - 4.5 Data View
5. [Component Descriptions](#5-component-descriptions)
   - 5.1 Browser Tier
   - 5.2 Server Tier
   - 5.3 Persistence Tier
   - 5.4 External Services
6. [Interface Design](#6-interface-design)
   - 6.1 Client–Server API
   - 6.2 MAVLink Hardware Interface
   - 6.3 External API Interfaces
7. [Data Flow Diagrams](#7-data-flow-diagrams)
8. [State Machines](#8-state-machines)
9. [Security Architecture](#9-security-architecture)
10. [Error Handling and Fault Tolerance](#10-error-handling-and-fault-tolerance)
11. [Architectural Decisions and Rationale](#11-architectural-decisions-and-rationale)
12. [Traceability to Requirements](#12-traceability-to-requirements)
13. [Glossary](#13-glossary)

---

## 1. Introduction

### 1.1 Purpose

This Software Architectural Design Document (ADD) defines the architectural structure of the **Sidak Ground Control Station (GCS)**. It is produced in conformance with **ISO/IEC 12207:2017** — specifically the *Software Architectural Design Process* (§6.4.4), which requires the software architecture to:

- Transform verified software requirements into a defined architecture
- Describe the top-level software components and their interfaces
- Ensure all requirements are allocated to architectural components
- Identify and document key architectural decisions and their rationale

### 1.2 Scope

This document covers the complete architecture of the Sidak GCS, including:
- Three-tier web application structure (Browser, Node.js Server, Persistence)
- SvelteKit routing and SSR architecture
- MAVLink communication subsystem
- Authentication and session management
- Client-side reactive state management
- Database schema and persistence strategy
- External service integrations
- Security boundaries and data flows

### 1.3 Architectural Approach

The Sidak GCS follows a **three-tier server-rendered web application** pattern:

| Tier | Technology | Role |
|------|-----------|------|
| **Presentation** | Svelte 4, Tailwind CSS, Leaflet | UI rendering, reactive state |
| **Application** | SvelteKit (Node.js), TypeScript | SSR, API routing, MAVLink layer, auth |
| **Persistence** | SQLite (libsql) | Users, sessions, mission plans |

The application is **deployed as a single Node.js process** that serves both the web UI and handles all backend logic including direct USB serial communication.

### 1.4 References

| ID | Document |
|----|----------|
| R-01 | CGCS-SRS-001 — Sidak GCS Software Requirements Specification |
| R-02 | SGCS-SVVP-001 — Sidak GCS Verification and Validation Plan |
| R-03 | ISO/IEC 12207:2017 — Software Life Cycle Processes |
| R-04 | SvelteKit Documentation — kit.svelte.dev |
| R-05 | MAVLink v2 Protocol — mavlink.io |
| R-06 | Lucia v3 — lucia-auth.com |
| R-07 | node-mavlink ^2.0.7 — npm |

---

## 2. Architectural Goals and Constraints

### 2.1 Architectural Goals

| Goal | Description |
|------|-------------|
| **Real-time responsiveness** | Telemetry data must update in the UI within 2 seconds of receipt |
| **Connection resilience** | MAVLink serial state must survive Vite HMR reloads in development |
| **Server-side isolation** | Native Node.js modules (serialport, node-mavlink) must never reach browser bundles |
| **Unified deployment** | Single Node.js process serves UI, API, and hardware interface |
| **Secure by default** | Authentication enforced at server hook level before any route handler executes |
| **Maintainability** | Clear separation: server-only code under `src/lib/server/`, client stores under `src/stores/` |

### 2.2 Constraints

| Constraint | Source |
|-----------|--------|
| Single USB serial connection at a time | Hardware (one flight controller) |
| Windows COM port requires explicit release before reconnection | OS constraint |
| SQLite is single-file, local only | No multi-instance deployment |
| node-mavlink uses Node.js Streams — cannot run in browser | Runtime constraint |
| Vite pre-bundler attempts to bundle all imports | Build tool behavior — requires explicit exclusions |
| SvelteKit `src/lib/server/` enforces server-only module boundary | Framework constraint |

---

## 3. System Context and Boundaries

```
╔══════════════════════════════════════════════════════════════════╗
║                    SYSTEM BOUNDARY                               ║
║                                                                  ║
║  ┌─────────────────────────────────────────────────────────┐    ║
║  │              BROWSER (Svelte SPA)                        │    ║
║  │  /login  /dashboard  /mission-planner                   │    ║
║  │  /event-log  /parameters  /notifications                │    ║
║  └──────────────────────┬──────────────────────────────────┘    ║
║                         │ HTTP / SSR                             ║
║  ┌──────────────────────▼──────────────────────────────────┐    ║
║  │            SVELTEKIT SERVER (Node.js)                    │    ║
║  │                                                          │    ║
║  │  hooks.server.ts ──► Route Guards (Auth)                 │    ║
║  │                                                          │    ║
║  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │    ║
║  │  │  Auth Layer │  │ MAVLink Layer│  │  Mission CRUD │  │    ║
║  │  │  (Lucia v3) │  │ (singleton)  │  │  (SQLite)     │  │    ║
║  │  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │    ║
║  │         │                │                   │           │    ║
║  │  ┌──────▼────────────────▼───────────────────▼───────┐  │    ║
║  │  │              SQLite Database (libsql)               │  │    ║
║  │  │    user │ session │ mission                         │  │    ║
║  │  └─────────────────────────────────────────────────────┘  │    ║
║  └──────────────────────────────┬──────────────────────────┘    ║
║                                 │ USB Serial                     ║
╚═════════════════════════════════╪════════════════════════════════╝
                                  │
              ┌───────────────────▼──────────────────┐
              │   Flight Controller (CubePilot)       │
              │   ArduPilot Firmware — MAVLink v2      │
              └──────────────────────────────────────┘

  External (Internet):
  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐
  │  Open-Meteo  │  │  Altitude Angel  │  │  Nominatim/OSM   │
  │  Weather API │  │  Airspace API    │  │  Geocoding API   │
  └──────────────┘  └──────────────────┘  └──────────────────┘
```

### 3.1 External Interfaces Summary

| External Actor | Protocol | Direction | Purpose |
|---------------|----------|-----------|---------|
| Browser Client | HTTP/SSR | Bidirectional | UI serving and API calls |
| Flight Controller | USB Serial / MAVLink v2 | Bidirectional | Telemetry receive, command send |
| Open-Meteo API | HTTPS/JSON | Inbound | Weather data |
| Altitude Angel API | HTTPS/GeoJSON | Inbound | Airspace restriction data |
| Nominatim/OSM API | HTTPS/JSON | Inbound | Reverse geocoding |
| HLS Video Source | HTTPS/HLS | Inbound | Live video stream |
| OpenStreetMap Tiles | HTTPS | Inbound | Map tile images (proxied) |

---

## 4. Architectural Viewpoints

### 4.1 Logical View

The logical view describes the software decomposition into subsystems and their responsibilities.

```
┌──────────────────────────────────────────────────────────────────┐
│                        BROWSER TIER                              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   +layout.svelte (Root Shell)               │ │
│  │  • Navigation (desktop + mobile)                           │ │
│  │  • Heartbeat polling loop (1.1s interval)                  │ │
│  │  • MAVLink log parser & message dispatcher                 │ │
│  │  • Battery alert logic                                     │ │
│  │  • Session inactivity timer                                │ │
│  │  • Dark/light theme controller                             │ │
│  └─────────────┬──────────────────────────────────────────────┘ │
│                │ Svelte stores (reactive state)                  │
│  ┌─────────────▼──────────────────────────────────────────────┐ │
│  │                   SVELTE STORE LAYER                        │ │
│  │  mavlinkStore    missionPlanStore    authStore              │ │
│  │  mapStore        customizationStore  notificationCountStore │ │
│  └─────────────┬──────────────────────────────────────────────┘ │
│                │                                                 │
│  ┌─────────────▼──────────────────────────────────────────────┐ │
│  │                     PAGE COMPONENTS                         │ │
│  │  /dashboard        /mission-planner    /event-log           │ │
│  │  /parameters       /login              /register            │ │
│  │  /notifications    /connection-test                         │ │
│  └─────────────┬──────────────────────────────────────────────┘ │
│                │                                                 │
│  ┌─────────────▼──────────────────────────────────────────────┐ │
│  │                   UI COMPONENTS                             │ │
│  │  ConnectionStatus  Stats        Controls    DPad            │ │
│  │  Map               3DMap        Compass     LiveFeed        │ │
│  │  MissionPlan       MissionPlanSettings      Weather         │ │
│  │  ManageMissionPlans SerialPortModal  Modal  Notification    │ │
│  │  Offline                                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                        SERVER TIER                               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               hooks.server.ts (Request Interceptor)      │   │
│  │  • Redirect '/' → '/login'                               │   │
│  │  • Validate Lucia session cookie on every request        │   │
│  │  • Attach user/session to event.locals                   │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                              │                                   │
│  ┌────────────┐  ┌───────────▼────────────┐  ┌──────────────┐  │
│  │  auth.ts   │  │  API Route Handlers     │  │  db.ts       │  │
│  │  Lucia v3  │  │  /api/mavlink/[type]    │  │  libsql      │  │
│  │  LibSQL    │  │  /api/mission/[type]    │  │  SQLite      │  │
│  │  Adapter   │  │  /api/auth/[type]       │  │  3 tables    │  │
│  └────────────┘  │  /api/tiles/[z]/[x]/[y]│  └──────────────┘  │
│                  │  /api/altitudeangel.ts  │                    │
│                  └───────────┬────────────┘                    │
│                              │                                   │
│  ┌───────────────────────────▼────────────────────────────┐    │
│  │                mavlink.ts (Singleton)                    │    │
│  │  globalThis.__mav  { port, reader, online, logs, ... }  │    │
│  │  SerialPort → MavLinkPacketSplitter → MavLinkPacketParser│   │
│  │  REGISTRY (minimal + common + ardupilotmega)            │    │
│  └────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

### 4.2 Process View

The process view describes runtime behavior and concurrency.

```
BROWSER PROCESS
├── Main thread
│   ├── Svelte reactive runtime (store subscriptions, DOM updates)
│   ├── setInterval: checkOnlineStatus() — every 1100 ms
│   ├── setInterval: syncSerialStatus() — every 3000 ms
│   ├── setInterval: session cookie check — every 1000 ms
│   └── Event listeners: mousemove, keydown, click, scroll
│
└── Web Speech API (async, fires on warning/error notifications)

NODE.JS SERVER PROCESS (single-threaded event loop)
├── HTTP request handler (SvelteKit adapter-node)
│   ├── hooks.server.ts handle() — runs on every request
│   ├── Page SSR handlers (+page.server.ts)
│   └── API route handlers (+server.ts)
│       ├── POST /api/mavlink/heartbeat  ← called every ~1.1s by browser
│       ├── POST /api/mavlink/[command]
│       ├── POST /api/mission/[action]
│       └── POST /api/auth/[action]
│
├── SerialPort (libuv async I/O — non-blocking)
│   ├── Readable stream → MavLinkPacketSplitter → MavLinkPacketParser
│   ├── 'data' event → packet decoded → appended to globalThis.__mav.logs
│   ├── 'close' event → state reset
│   └── 'error' event → logged, state reset
│
└── globalThis.__mav (shared mutable singleton across HMR boundaries)
    ├── port: SerialPort | null
    ├── reader: MavLinkPacketParser | null
    ├── online: boolean
    ├── connecting: boolean
    ├── logs: string[] (last 1000 entries, persistent)
    └── newLogs: string[] (since last heartbeat, consumed on read)
```

---

### 4.3 Development View

The development view describes the source code organisation.

```
MY_GCS/
├── src/
│   ├── app.html                   # HTML shell template
│   ├── app.css                    # Global styles (Tailwind base)
│   ├── app.d.ts                   # SvelteKit ambient type declarations
│   ├── hooks.server.ts            # Global server request interceptor
│   │
│   ├── lib/
│   │   ├── index.ts               # Public lib re-exports
│   │   ├── weathercodes.json      # WMO weather interpretation codes
│   │   └── server/                ◄── SERVER-ONLY boundary (SvelteKit enforced)
│   │       ├── auth.ts            # Lucia v3 instance + adapter
│   │       ├── db.ts              # libsql SQLite connection + schema init
│   │       ├── mavlink.ts         # MAVLink singleton (serial + parser)
│   │       └── mavlink-registry.ts# MAVLink packet registry (minimal+common+ardupilot)
│   │
│   ├── stores/                    ◄── CLIENT + SERVER readable (Svelte writable)
│   │   ├── authStore.ts
│   │   ├── customizationStore.ts
│   │   ├── mapStore.ts
│   │   ├── mavlinkStore.ts
│   │   ├── missionPlanStore.ts
│   │   └── notificationCountStore.ts
│   │
│   ├── components/                ◄── CLIENT-ONLY Svelte components
│   │   ├── ConnectionStatus.svelte
│   │   ├── Controls.svelte
│   │   ├── Compass.svelte
│   │   ├── DPad.svelte
│   │   ├── LiveFeed.svelte
│   │   ├── ManageMissionPlans.svelte
│   │   ├── Map.svelte
│   │   ├── MissionPlan.svelte
│   │   ├── MissionPlanSettings.svelte
│   │   ├── Modal.svelte
│   │   ├── Notification.svelte
│   │   ├── Offline.svelte
│   │   ├── SerialPortModal.svelte
│   │   ├── Stats.svelte
│   │   ├── Weather.svelte
│   │   ├── 3DMap.svelte
│   │   └── global.d.ts
│   │
│   └── routes/
│       ├── +layout.svelte         # Root shell (nav, polling, message parsing)
│       ├── login/                 # +page.svelte, +page.server.ts
│       ├── register/              # +page.svelte, +page.server.ts
│       ├── dashboard/             # +page.svelte
│       ├── mission-planner/       # +page.svelte
│       ├── event-log/             # +page.svelte
│       ├── parameters/            # +page.svelte, stores.ts
│       ├── notifications/         # +page.svelte
│       ├── connection-test/       # +page.svelte
│       └── api/
│           ├── auth/[type]/       # +server.ts (login, register, checkAdmin)
│           ├── mavlink/[type]/    # +server.ts (heartbeat, commands, ports)
│           ├── mission/[type]/    # +server.ts (save, load, list, delete, ...)
│           ├── tiles/[z]/[x]/[y]/ # +server.ts (OSM tile proxy)
│           └── altitudeangel.ts   # Airspace API proxy
│
├── static/                        # Static assets (logo, map icons, bg images)
├── vite.config.ts                 # Vite: optimizeDeps.exclude, ssr.external
├── package.json
├── tsconfig.json
└── docs/                          # Architecture, SRS, SVVP documents
```

**Module Boundary Rule (enforced by SvelteKit):**
> Any file under `src/lib/server/` is inaccessible from `+page.svelte` or any client-side component. Attempting to import it will throw a build error. This is the primary mechanism preventing native Node.js modules (`serialport`, `node-mavlink`) from entering browser bundles.

---

### 4.4 Physical Deployment View

```
┌─────────────────────────────────────────────────────────────┐
│                  Ground Station Computer                     │
│  OS: Windows 10/11 or Ubuntu 22.04                          │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Node.js Process (port 5173 dev / 3000 prod)        │     │
│  │  ├── SvelteKit HTTP server                          │     │
│  │  ├── SQLite file: ./src/data.db                     │     │
│  │  └── SerialPort handle (COM port or /dev/ttyUSB*)   │     │
│  └────────────────────────┬───────────────────────────┘     │
│                           │ USB (Serial)                     │
│  ┌────────────────────────▼───────────────────────────┐     │
│  │  CubePilot USB-Serial Adapter (VID: 2DAE)           │     │
│  └────────────────────────┬───────────────────────────┘     │
│                           │ UART                             │
│  ┌────────────────────────▼───────────────────────────┐     │
│  │  Cube Orange+ Flight Controller                     │     │
│  │  ArduCopter Firmware — MAVLink v2                   │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Browser (Chrome / Edge / Firefox)                  │     │
│  │  Connects to http://localhost:5173 (or :3000)       │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              │ HTTPS (optional — internet)
          ┌───────────────────┼─────────────────────┐
          ▼                   ▼                       ▼
  api.open-meteo.com  api.altitudeangel.com  nominatim.openstreetmap.org
```

**Deployment modes:**

| Mode | Command | Port | Notes |
|------|---------|------|-------|
| Development | `npm run dev` | 5173 | HMR enabled; `globalThis` preserves MAVLink state |
| Production | `npm run build` then `node build` | 3000 | No HMR; single compiled bundle |

---

### 4.5 Data View

#### Database Schema (SQLite — `src/data.db`)

```sql
-- User accounts
CREATE TABLE user (
    id           TEXT NOT NULL PRIMARY KEY,   -- Random alphanumeric ID
    username     TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL               -- Argon2id hash
);

-- Authentication sessions (Lucia v3)
CREATE TABLE session (
    id         TEXT    NOT NULL PRIMARY KEY,  -- Session token
    expires_at INTEGER NOT NULL,              -- Unix timestamp
    user_id    TEXT    NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id)
);

-- Saved mission plans
CREATE TABLE mission (
    id       TEXT    NOT NULL PRIMARY KEY,    -- Random alphanumeric ID
    title    TEXT    NOT NULL,
    actions  JSON    NOT NULL,                -- MissionPlanActions serialised to JSON
    isLoaded BOOLEAN NOT NULL                 -- 1 = active, 0 = stored
);
```

#### Mission Actions JSON Schema

```json
{
  "0": {
    "type": "TAKEOFF",
    "lat": 33.791050,
    "lon": -84.371308,
    "alt": 10,
    "notes": "Launch point",
    "param1": null,
    "param2": null,
    "param3": null,
    "param4": null
  },
  "1": {
    "type": "WAYPOINT",
    "lat": 33.792000,
    "lon": -84.370000,
    "alt": 30,
    "notes": "Survey point A",
    "param1": 0,
    "param2": 0,
    "param3": 0,
    "param4": 0
  }
}
```

---

## 5. Component Descriptions

### 5.1 Browser Tier

#### 5.1.1 Root Shell — `+layout.svelte`

**Role:** Central nervous system of the client application. Every page renders inside this layout.

| Responsibility | Implementation |
|---------------|----------------|
| Navigation bar (desktop + mobile) | Rendered directly; visibility toggled by route path |
| Heartbeat polling | `setInterval(checkOnlineStatus, 1100)` — POSTs to `/api/mavlink/heartbeat` |
| MAVLink log parsing | `getLogs(text)` → `messageHandlers` map → store updates |
| Battery alert logic | Reactive `$:` statement watching `mavBatteryStore`; alert thresholds [50,20,15,10,5] |
| Session timeout | `setInterval(checkCookieInterval, 1000)` checking `lastActivity` cookie |
| Dark/light mode | `toggleDarkMode()` updates `customizationStore` values + DOM classes |
| Serial port modal | `showPortModal` flag; delegates to `SerialPortModal.svelte` |
| Offline overlay | `<Offline>` conditionally rendered when `!online && !isAuthPage` |

**MAVLink Message Dispatch Table:**

| MAVLink Message | Handler | Stores Updated |
|----------------|---------|----------------|
| `GLOBAL_POSITION_INT` | Location, altitude, speed, heading | `mavLocationStore`, `mavAltitudeStore`, `mavSpeedStore`, `mavHeadingStore` |
| `GPS_RAW_INT` | Satellite count, HDOP | `mavSatelliteStore` |
| `HEARTBEAT` | Type, model, state, mode, armed | `mavTypeStore`, `mavModelStore`, `mavStateStore`, `mavModeStore`, `mavArmedStateStore` |
| `MISSION_CURRENT` | Active waypoint index | `missionIndexStore` |
| `MISSION_ITEM_REACHED` | Waypoint reached toast | `missionCompleteStore` (on last item) |
| `BATTERY_STATUS` | Battery % | `mavBatteryStore` |
| `COMMAND_ACK` | Command result toast | none |
| `STATUSTEXT` | Status message toast | none |
| `PARAM_VALUE` | Parameter value update | `mavlinkParamStore` |

---

#### 5.1.2 Svelte Store Layer

All stores use Svelte `writable`. They are the single source of truth for client-side state.

**`mavlinkStore.ts`**

| Store | Type | Purpose |
|-------|------|---------|
| `onlineStore` | `boolean` | Is the flight controller connected and sending data? |
| `mavLocationStore` | `{lat, lng}` | Current GPS position |
| `mavAltitudeStore` | `number` | Relative altitude (m) |
| `mavSpeedStore` | `number` | Ground speed (m/s) |
| `mavHeadingStore` | `number` | Heading (degrees, 0–360) |
| `mavSatelliteStore` | `{total, hdop}` | GPS satellite count and accuracy |
| `mavBatteryStore` | `number\|null` | Battery remaining (%) |
| `mavTypeStore` | `string` | Vehicle type (e.g., Quadrotor) |
| `mavModelStore` | `string` | Autopilot type (e.g., ARDUPILOTMEGA) |
| `mavStateStore` | `string` | System state (e.g., ACTIVE) |
| `mavModeStore` | `string` | Flight mode (e.g., LOITER, GUIDED) |
| `mavArmedStateStore` | `boolean` | Armed/disarmed |
| `mavlinkLogStore` | `string[]` | Full log buffer (max 1000) |
| `mavlinkParamStore` | `{[id]: Parameter}` | All vehicle parameters |

**`missionPlanStore.ts`**

| Store | Type | Purpose |
|-------|------|---------|
| `missionPlanTitleStore` | `string` | Name of active mission |
| `missionPlanActionsStore` | `MissionPlanActions` | Indexed waypoint map |
| `missionCountStore` | `number` | Total waypoints (derived) |
| `missionIndexStore` | `number` | Currently active waypoint index |
| `missionCompleteStore` | `boolean` | Has the mission finished? |

**`mapStore.ts`**

| Store | Type | Purpose |
|-------|------|---------|
| `mapStore` | `L.Map\|null` | Leaflet map instance |
| `markersStore` | `Map<number, L.Marker>` | Waypoint markers by index |
| `polylinesStore` | `Map<string, L.Polyline>` | Route lines |
| `mapTypeStore` | `string` | "OpenStreetMap" or "Satellite" |
| `mapZoomStore` | `number` | Current zoom level |
| `lockViewStore` | `boolean` | Auto-pan to vehicle position |

**`customizationStore.ts`** — Theme colors and audio notification toggle  
**`authStore.ts`** — `loggedInStore: boolean` (client-side flag; server validates via cookie)  
**`notificationCountStore.ts`** — Unread notification badge count

---

#### 5.1.3 Page Components

| Route | File | Key Components Used |
|-------|------|-------------------|
| `/dashboard` | `+page.svelte` | ConnectionStatus, Stats, Controls, Map, Compass, LiveFeed |
| `/mission-planner` | `+page.svelte` | Map, Weather, Compass, MissionPlan, MissionPlanSettings, ManageMissionPlans |
| `/event-log` | `+page.svelte` | Direct log rendering with filter/search controls |
| `/parameters` | `+page.svelte` | Inline table with search, edit, import/export |
| `/login` | `+page.svelte` | Login form; `+page.server.ts` handles auth action |
| `/register` | `+page.svelte` | Registration form; `+page.server.ts` handles action |
| `/notifications` | `+page.svelte` | Notification history |

---

### 5.2 Server Tier

#### 5.2.1 Request Interceptor — `hooks.server.ts`

Executes before every route handler. Responsibilities:

1. Redirect `/` → `/login` (302)
2. Read `lucia.sessionCookieName` cookie from request
3. Call `lucia.validateSession(sessionId)`
4. If valid + fresh: rotate session cookie (sliding expiry)
5. If invalid: set blank cookie (clears stale token)
6. Attach `event.locals.user` and `event.locals.session` for downstream handlers

```
Request →[hooks.server.ts]→ Route Handler
              │
              ├── No cookie → locals.user = null (route may redirect)
              ├── Valid session → locals.user = { username } 
              └── Invalid session → blank cookie set, locals.user = null
```

---

#### 5.2.2 MAVLink Layer — `src/lib/server/mavlink.ts`

The most critical server component. Implemented as a **module-level singleton** persisted on `globalThis.__mav` to survive Vite HMR reloads.

**Singleton State Object:**

```typescript
globalThis.__mav = {
    port:       SerialPort | Socket | null,
    reader:     MavLinkPacketParser | null,
    online:     boolean,
    connecting: boolean,
    logs:       string[],    // permanent history
    newLogs:    string[],    // consumed on each heartbeat
    promise:    Promise<void> | null  // in-flight connect operation
}
```

**Connection State Machine:**

```
           ┌──────────┐
           │   IDLE   │ ◄─────────────────────────────────────┐
           └────┬─────┘                                        │
                │ forceConnect() called                         │
                ▼                                               │
        ┌───────────────┐   Port not found                     │
        │  DETECTING    │─────────────────────────────────────►│
        │  (detectPort) │                                       │
        └───────┬───────┘                                       │
                │ Port path found                               │
                ▼                                               │
        ┌───────────────┐   sp.open() error                    │
        │  CONNECTING   │─────────────────────────────────────►│
        │ (S.connecting)│                                       │
        └───────┬───────┘                                       │
                │ Port opened + data received                   │
                ▼                                               │
        ┌───────────────┐   USB unplugged / 'close' event      │
        │   CONNECTED   │─────────────────────────────────────►│
        │  (S.online)   │                                       │
        └───────┬───────┘   forceDisconnect() called           │
                └───────────────────────────────────────────────┘
```

**Port Auto-Detection Priority:**
1. `process.env.USB_SERIAL_PORT` (explicit override)
2. CubePilot VID `2DAE` + friendly name contains "mavlink"
3. Any CubePilot VID `2DAE` port
4. First USB serial port not from Intel (non-AMT)

**Data Pipeline:**
```
SerialPort (raw bytes)
    → MavLinkPacketSplitter    (frames MAVLink v2 packets)
    → MavLinkPacketParser      (emits decoded packet objects)
    → 'data' event handler
        → REGISTRY lookup by msgid
        → packet.protocol.data(payload, clazz)  (deserialize)
        → convertBigIntToNumber(data)
        → format as log string: "MSG_NAME(MAGIC)::ISO_TS::JSON"
        → push to S.logs and S.newLogs
```

**Public API:**

| Function | Called By | Effect |
|----------|----------|--------|
| `forceConnect(portOverride?)` | POST /api/mavlink/select_port | Opens serial port |
| `forceDisconnect()` | POST /api/mavlink/disconnect | Closes port, 800ms Windows delay |
| `initializePort()` | POST /api/mavlink/heartbeat | Polls if connected; requests status |
| `getConnectionStatus()` | Multiple endpoints | Returns `{connected, portOpen, online, connecting}` |
| `detectPort()` | `forceConnect` | Auto-detects best COM port |
| `sendMavlinkCommand(cmd, params, useLong, useAPM)` | POST /api/mavlink/send_command | Sends CommandInt or CommandLong |
| `requestStatus()` | `initializePort` | Requests GPS, battery, mission messages |
| `requestParameters()` | POST /api/mavlink/request_params | Sends PARAM_REQUEST_LIST |
| `writeParameter(id, value, type)` | POST /api/mavlink/write_param | Sends PARAM_SET (16-char padded ID) |
| `setMissionCount(n)` | POST /api/mavlink/load_mission | Sends MISSION_COUNT |
| `loadMissionItem(item, index)` | POST /api/mavlink/load_mission | Sends MISSION_ITEM_INT |
| `clearAllMissionItems()` | POST /api/mavlink/clear_mission | Sends MISSION_CLEAR_ALL |
| `setPositionLocal(x, y, z)` | POST /api/mavlink/set_position_local | Sends SET_POSITION_TARGET_LOCAL_NED |

---

#### 5.2.3 Authentication Layer — `src/lib/server/auth.ts`

```
Lucia v3
  └── LibSQLAdapter
        ├── user table (id, username, password_hash)
        └── session table (id, expires_at, user_id)

Session lifecycle:
  Login → lucia.createSession() → sessionCookie set
  Request → lucia.validateSession() → fresh sessions rotated
  Logout → lucia.invalidateSession() → blank cookie set
  Inactivity (client) → lastActivity cookie expires → client redirects
```

Password hashing: `@node-rs/argon2` (Argon2id, memory-hard, native bindings)

---

#### 5.2.4 API Route Handlers

**`/api/mavlink/[type]` — POST**

| type | Action |
|------|--------|
| `heartbeat` | `initializePort()` + return `newLogs.splice(0)` + status |
| `send_command` | Parse headers → `sendMavlinkCommand()` |
| `clear_mission` | `clearAllMissionItems()` |
| `load_mission` | `setMissionCount()` + sequential `loadMissionItem()` with 250ms delay |
| `set_position_local` | Validate x/y/z → `setPositionLocal()` |
| `request_params` | `requestParameters()` |
| `write_param` | Pad ID to 16 chars → `writeParameter()` |
| `list_ports` | `SerialPort.list()` → JSON |
| `select_port` | `forceConnect(portPath)` |
| `disconnect` | `forceDisconnect()` |
| `status` | `getConnectionStatus()` → JSON |

**`/api/mission/[type]` — POST**

| type | SQL Action |
|------|-----------|
| `save` | INSERT into mission |
| `load` | UPDATE SET isLoaded=1 WHERE title=? |
| `unload` | UPDATE SET isLoaded=0 (all) |
| `checkExists` | SELECT WHERE title=? |
| `update` | UPDATE SET actions=? WHERE title=? |
| `list` | SELECT * FROM mission |
| `delete` | DELETE WHERE title=? |

**`/api/auth/[type]` — POST**  
login / register / checkAdmin

**`/api/tiles/[z]/[x]/[y]` — GET**  
Proxies OSM tile requests from the browser to avoid CORS issues. Sets a `SidakGCS/1.0` User-Agent header.

**`/api/altitudeangel.ts` — GET**  
Proxies Altitude Angel `/v2/mapdata/geojson` with `X-Api-Key` header injected server-side.

---

### 5.3 Persistence Tier

#### 5.3.1 Database: SQLite via libsql

| Property | Value |
|----------|-------|
| Engine | SQLite (synchronous, file-based) |
| Library | `libsql ^0.5.0` (synchronous API) |
| File path | `./src/data.db` (relative to process CWD) |
| Initialization | Auto-creates tables via `CREATE TABLE IF NOT EXISTS` on server start |
| Query pattern | Prepared statements via `db.prepare(sql).run(params)` / `.all()` |
| Multi-instance | Not supported (single-file lock) |

#### 5.3.2 In-Memory State: `globalThis.__mav`

MAVLink runtime state is NOT persisted to disk. It lives in `globalThis.__mav` for the duration of the server process. This enables:
- HMR resilience (module re-execution re-uses the same object)
- Zero-latency access in API handlers (no DB round-trip for telemetry)

**Volatility:** All in-memory state (logs, connection) is lost on full server restart.

---

### 5.4 External Services

| Service | URL | Auth | Data Format | Used By |
|---------|-----|------|------------|---------|
| Open-Meteo | `api.open-meteo.com/v1/forecast` | None | JSON | `Weather.svelte` |
| Nominatim | `nominatim.openstreetmap.org/reverse` | None | JSON | `Weather.svelte` |
| Altitude Angel | `api.altitudeangel.com/v2/mapdata/geojson` | X-Api-Key header | GeoJSON | `/api/altitudeangel.ts` proxy |
| OpenStreetMap Tiles | `tile.openstreetmap.org/{z}/{x}/{y}.png` | None | PNG | `/api/tiles/[z]/[x]/[y]` proxy |
| HLS Stream Source | Operator-configured URL | N/A | HLS | `LiveFeed.svelte` (hls.js) |

**API Key Security:** The Altitude Angel API key is stored in the `.env` file and injected server-side in the proxy route. It is never included in any client-side bundle or HTTP response body.

---

## 6. Interface Design

### 6.1 Client–Server API

All API calls use `HTTP POST`. Parameters are passed via request headers (not body) for simplicity.

#### Common Response Patterns

| Case | HTTP Status | Body |
|------|------------|------|
| Success (data) | 200 | JSON `{ ... }` with `Content-Type: application/json` |
| Success (text) | 200 | Plain text message |
| Invalid input | 400 | Error description string |
| Server error | 500 | Error stack trace string |

#### Heartbeat Contract

**Request:** `POST /api/mavlink/heartbeat`  
**Response:**
```json
{
  "logs": ["HEARTBEAT(0)::2026-07-13T12:00:00.000Z::{...}", "..."],
  "portOpen": true,
  "online": true
}
```
**Response Header:** `isProduction: "true"` or `"false"`

#### Mission Load Contract

**Request:** `POST /api/mavlink/load_mission`  
**Headers:** `actions: <JSON-stringified MissionPlanActions>`  
The server:
1. Calls `setMissionCount(Object.keys(actions).length)`
2. Waits 250ms
3. Iterates entries, calling `loadMissionItem(val, index)` with 250ms delay between each

---

### 6.2 MAVLink Hardware Interface

| Parameter | Value |
|-----------|-------|
| Protocol | MAVLink v2 |
| Transport | USB Serial (CDC/ACM) |
| Default Baud Rate | 115200 |
| Target System | 1 |
| Target Component | 1 |
| Dialects | minimal + common + ardupilotmega |
| Framing | `MavLinkPacketSplitter` (STX + header + payload + CRC) |

**Command Types Used:**

| MAVLink Message | Direction | Purpose |
|----------------|-----------|---------|
| `HEARTBEAT` | RX | Vehicle state |
| `GLOBAL_POSITION_INT` | RX | GPS position |
| `GPS_RAW_INT` | RX | Satellite info |
| `BATTERY_STATUS` | RX | Battery level |
| `MISSION_CURRENT` | RX | Active waypoint |
| `MISSION_ITEM_REACHED` | RX | Waypoint completion |
| `PARAM_VALUE` | RX | Parameter telemetry |
| `STATUSTEXT` | RX | Status messages |
| `COMMAND_ACK` | RX | Command confirmation |
| `CommandInt` | TX | Standard commands |
| `CommandLong` | TX | Extended commands |
| `MISSION_COUNT` | TX | Begin mission upload |
| `MISSION_ITEM_INT` | TX | Individual waypoint |
| `MISSION_CLEAR_ALL` | TX | Clear mission |
| `PARAM_REQUEST_LIST` | TX | Request all params |
| `PARAM_SET` | TX | Write single param |
| `SET_POSITION_TARGET_LOCAL_NED` | TX | Manual position control |
| `RequestMessageCommand` | TX | Request specific message |

---

### 6.3 External API Interfaces

#### Open-Meteo

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude={lat}
  &longitude={lon}
  &current_weather=true
  &hourly=precipitation_probability,windspeed_10m,temperature_2m
```

#### Altitude Angel (proxied via `/api/altitudeangel.ts`)

```
GET https://api.altitudeangel.com/v2/mapdata/geojson
  ?{forwarded query params from client}
Header: X-Api-Key: {ALTITUDE_ANGEL_API_KEY from env}
```

#### Nominatim Reverse Geocoding

```
GET https://nominatim.openstreetmap.org/reverse
  ?lat={lat}&lon={lon}&format=json
```

---

## 7. Data Flow Diagrams

### 7.1 Telemetry Data Flow (Primary Path)

```
Flight Controller
    │ MAVLink v2 packets (USB Serial)
    ▼
SerialPort (Node.js stream)
    │ raw bytes
    ▼
MavLinkPacketSplitter
    │ framed packets
    ▼
MavLinkPacketParser
    │ 'data' event: { header.msgid, payload, protocol }
    ▼
REGISTRY[msgid] lookup → clazz
    │
    ▼
packet.protocol.data(payload, clazz) → telemetry object
    │
    ▼
convertBigIntToNumber(data) → plain JS object
    │
    ▼
Format: "MSG_NAME(MAGIC)::ISO_TS::JSON_DATA"
    │
    ├──► S.logs.push(entry)      [permanent history]
    └──► S.newLogs.push(entry)   [consumed on next heartbeat]
                │
                │ (every ~1100ms via browser polling)
                ▼
    POST /api/mavlink/heartbeat
    Response: { logs: newLogs.splice(0), portOpen, online }
                │
                ▼
    +layout.svelte: getLogs(text)
                │
                ▼
    messageHandlers[messageType](text)
                │
        ┌───────┼──────────────────────────────┐
        ▼       ▼                              ▼
  mavLocation  mavBattery              mavArmedState
  Store        Store          ...      Store
        │
        ▼
  UI Components (reactive via $store syntax)
```

---

### 7.2 Mission Upload Flow

```
Operator (browser)
    │ Click "Upload Mission"
    ▼
MissionPlanSettings.svelte
    │ POST /api/mavlink/load_mission
    │ Header: actions = JSON.stringify(missionPlanActionsStore)
    ▼
+server.ts (load_mission handler)
    │
    ├── setMissionCount(n)
    │       └── send(port, MissionCount { count: n })
    │       └── await 250ms
    │
    └── forEach waypoint with 250ms delay:
            └── loadMissionItem(item, index)
                    └── build MissionItemInt
                    └── m.x = lat * 1e7, m.y = lon * 1e7
                    └── send(port, MissionItemInt)
    │
    ▼
Response: "MAVLink mission loaded" (200)
    │
    ▼
Flight Controller processes MISSION_COUNT + MISSION_ITEM_INT sequence
    │
    ▼
MISSION_ACK received (visible in event log)
```

---

### 7.3 Authentication Flow

```
Browser: Navigate to /login
    │
    ▼
hooks.server.ts: No valid session cookie
    → event.locals.user = null
    │
    ▼
/login +page.server.ts: load() checks if admin exists
    → GET /api/auth/checkAdmin
    → if no user: redirect to /register
    │
    ▼
User submits credentials
    │
    ▼
/api/auth/login +server.ts
    │
    ├── db.prepare("SELECT * FROM user WHERE username=?")
    ├── verify(password, hash) via @node-rs/argon2
    ├── lucia.createSession(userId)
    └── Set-Cookie: lucia session cookie
    │
    ▼
Browser: Redirects to /dashboard
    │
    ▼
hooks.server.ts on subsequent requests:
    → lucia.validateSession(cookie)
    → Attach user to event.locals
    → Route handlers have access to event.locals.user
```

---

## 8. State Machines

### 8.1 MAVLink Connection State Machine

```
States:
  IDLE        — No port, no reader; system at rest
  CONNECTING  — S.connecting = true; port open in progress
  CONNECTED   — Port open + reader attached; S.online may be false (no data yet)
  ONLINE      — Port open + reader attached + S.online = true (data flowing)
  ERROR       — Port open failed; resources cleaned up; transitions to IDLE

Transitions:
  IDLE ──[forceConnect()]──────────────────────► CONNECTING
  CONNECTING ──[detectPort() fails]────────────► IDLE (throws error)
  CONNECTING ──[sp.open() fails]───────────────► IDLE (throws error)
  CONNECTING ──[sp.open() success]─────────────► CONNECTED
  CONNECTED ──[first MAVLink packet received]──► ONLINE
  CONNECTED ──[10s timeout, no data]───────────► CONNECTED (stays; warning logged)
  ONLINE ──[forceDisconnect()]─────────────────► IDLE
  ONLINE ──['close' event on port]─────────────► IDLE
  ONLINE ──['error' event on port]─────────────► IDLE (error logged)
  CONNECTING ──[already connecting]────────────► CONNECTING (returns existing promise)
  ONLINE ──[forceConnect() called]─────────────► ONLINE (no-op, already connected)
```

### 8.2 Session State Machine

```
States:
  UNAUTHENTICATED  — No valid session cookie
  AUTHENTICATED    — Valid session cookie; user in event.locals
  EXPIRED          — Session cookie invalid or past expiry

Transitions:
  UNAUTHENTICATED ──[valid login]──────────────► AUTHENTICATED
  AUTHENTICATED ──[lucia validates session]────► AUTHENTICATED (cookie rotated if fresh)
  AUTHENTICATED ──[10min inactivity (client)]──► UNAUTHENTICATED (client redirect)
  AUTHENTICATED ──[logout action]──────────────► UNAUTHENTICATED
  AUTHENTICATED ──[session expires server-side]► EXPIRED
  EXPIRED ──[next request]─────────────────────► UNAUTHENTICATED (blank cookie set)
```

### 8.3 Mission State Machine

```
States:
  EMPTY       — No mission loaded; missionPlanActionsStore = {}
  PLANNED     — Mission defined in store; not uploaded to vehicle
  UPLOADED    — Mission sent to flight controller
  ACTIVE      — Mission running (missionIndexStore > 0)
  COMPLETE    — missionCompleteStore = true (last waypoint reached)

Transitions:
  EMPTY ──[add first waypoint]──────────────────► PLANNED
  PLANNED ──[upload to vehicle]─────────────────► UPLOADED
  PLANNED ──[clear all]──────────────────────────► EMPTY
  UPLOADED ──[start mission]────────────────────► ACTIVE
  ACTIVE ──[MISSION_CURRENT increments]──────────► ACTIVE
  ACTIVE ──[last MISSION_ITEM_REACHED]───────────► COMPLETE
  ACTIVE ──[stop/RTL command]────────────────────► UPLOADED
  COMPLETE ──[clear mission]─────────────────────► EMPTY
  UPLOADED ──[load different mission]────────────► PLANNED
```

---

## 9. Security Architecture

### 9.1 Defence-in-Depth Layers

```
Layer 1: Transport
  • Local-only deployment (no public internet exposure by default)
  • HTTPS recommended for LAN deployment (adapter-node + reverse proxy)

Layer 2: Authentication (hooks.server.ts)
  • Every HTTP request passes through the server hook
  • Session validated before any route handler runs
  • Invalid/missing session → locals.user = null
  • Protected routes check event.locals.user and redirect if null

Layer 3: Password Storage
  • Argon2id (memory-hard, side-channel resistant)
  • Implemented via @node-rs/argon2 (native binding, not pure JS)
  • No plaintext or reversible hash ever stored

Layer 4: Session Management (Lucia v3)
  • Opaque session token (random, unguessable)
  • Stored in HttpOnly cookie
  • Secure flag enabled in production (!dev)
  • Sessions stored in SQLite with expiry timestamp
  • Sliding expiry: fresh sessions rotated on each request

Layer 5: API Input Validation
  • MAVLink command params validated (isNaN checks) before dispatch
  • Unknown MAVLink types return HTTP 400
  • SQL queries use prepared statements (parameterized) — no string concatenation

Layer 6: Secret Isolation
  • Altitude Angel API key: env var only, never in response body or client bundle
  • Serial port config (USB_SERIAL_PORT, USB_BAUD_RATE): server-only env vars
  • Vite define{} exposes only USB_SERIAL_PORT and USB_BAUD_RATE — not API keys

Layer 7: Module Boundary
  • src/lib/server/ enforced by SvelteKit — impossible to import in browser code
  • Vite ssr.external + optimizeDeps.exclude prevents native modules in browser
```

### 9.2 Known Security Limitations

| Limitation | Risk | Mitigation |
|-----------|------|-----------|
| Single admin user (no RBAC) | Any authenticated user has full control | Acceptable for single-operator GCS; add roles if multi-user required |
| Session timeout is client-side only | Browser JS can be bypassed | Server session expiry in SQLite provides server-side enforcement |
| API keys in `.env` file on disk | File system read access exposes key | Restrict OS file permissions on `.env`; use secrets manager for production |
| No CSRF protection on POST routes | Potential CSRF on API routes | Mitigated by local-only deployment; add CSRF tokens if exposing to network |
| MAVLink commands authenticated but not authorized | Any logged-in user can arm/fly | Acceptable for single-operator; add command permission tiers if needed |

---

## 10. Error Handling and Fault Tolerance

### 10.1 MAVLink Communication Errors

| Failure | Detection | Response |
|---------|----------|----------|
| COM port not found | `detectPort()` returns null | Throw error with user-friendly message; transition to IDLE |
| Port open failure | `sp.open()` callback has err | Destroy port; transition to IDLE; propagate error to API response |
| No MAVLink data for 10s | Timeout in `_openPort` | Warning logged; connection stays open (port open but silent) |
| Unexpected port close | `'close'` event on SerialPort | State reset (port=null, reader=null, online=false); next heartbeat detects offline |
| Port error event | `'error'` event on SerialPort | Error logged to console; server process continues |
| HMR reload (dev) | Module re-execution detected | `globalThis.__mav.port.destroy()` called; singleton reset cleanly |

### 10.2 Database Errors

All database operations are wrapped in try/catch blocks in API route handlers. On failure:
- HTTP 500 returned with error stack trace (for debugging)
- Database connection itself is persistent (libsql synchronous driver)

### 10.3 External API Errors

| Service | Failure Mode | Handling |
|---------|-------------|----------|
| Open-Meteo | Network error | Weather widget shows last known values or empty state; no crash |
| Altitude Angel | Auth failure (bad API key) | Map overlay absent; no crash; console error |
| Nominatim | Rate limit | Geocoding result absent; location name not displayed |
| HLS stream | Stream unavailable | hls.js error event; video widget shows error state |

### 10.4 Browser-Side Errors

| Error | Handling |
|-------|----------|
| Heartbeat fetch fails | `onlineStore.set(false)`; offline overlay shown |
| Mission API error | Console error logged; user notified via toast |
| Web Speech API unavailable | Audio notifications silently disabled |
| Leaflet map error | Map widget shows fallback; other widgets unaffected |

---

## 11. Architectural Decisions and Rationale

Per ISO/IEC 12207 §6.4.4, each significant architectural decision is documented with its rationale and alternatives considered.

---

**AD-001 — SvelteKit as the full-stack framework**

| | |
|-|-|
| **Decision** | Use SvelteKit (Svelte 4) for both SSR and client-side rendering |
| **Rationale** | SvelteKit provides native SSR with TypeScript, enforced server/client module boundaries (`src/lib/server/`), API routes co-located with pages, and file-based routing. The `$lib/server/` boundary makes it structurally impossible to accidentally expose Node.js code to the browser. |
| **Alternatives** | React + Express (no enforced boundary), Next.js (heavier), plain Node.js + Vanilla JS (no reactivity) |
| **Trade-offs** | Svelte's ecosystem is smaller than React's; Svelte 5 migration will require work |

---

**AD-002 — `globalThis.__mav` singleton for MAVLink state**

| | |
|-|-|
| **Decision** | Persist MAVLink connection state on `globalThis` rather than in module scope |
| **Rationale** | Vite HMR re-executes all modules on file save. If state were in module scope, the serial port would be dropped and the COM handle orphaned on every HMR reload. `globalThis` survives module re-execution; the HMR guard at module top explicitly cleans up the old port before re-assigning. |
| **Alternatives** | External process/microservice for serial (complex, over-engineered); Redis/IPC (overkill for single-machine deployment) |
| **Trade-offs** | `globalThis` is a global mutable singleton; must be carefully guarded in multi-instance deployments (which are not supported) |

---

**AD-003 — Heartbeat polling (pull) instead of WebSocket (push)**

| | |
|-|-|
| **Decision** | Browser polls `/api/mavlink/heartbeat` every 1.1 seconds |
| **Rationale** | SvelteKit's adapter-node supports standard HTTP well. WebSockets require additional setup and streaming adapter configuration. Polling at 1.1s gives adequate telemetry latency (< 2s) without the complexity of persistent WebSocket connections. The server collects `newLogs` between polls and flushes on each heartbeat. |
| **Alternatives** | WebSocket (lower latency, higher complexity), Server-Sent Events (unidirectional, simpler than WS) |
| **Trade-offs** | 1.1s polling interval means telemetry may lag up to ~2s; acceptable for GCS usage. If real-time responsiveness < 500ms is required, WebSocket should replace this. |

---

**AD-004 — SQLite (libsql) for persistence**

| | |
|-|-|
| **Decision** | Use a local SQLite file for users, sessions, and mission storage |
| **Rationale** | The GCS operates on a single ground station machine. SQLite requires no separate database server, has zero configuration, and persists data reliably in a single file. `libsql` provides a synchronous API suitable for SvelteKit's server handlers. |
| **Alternatives** | PostgreSQL (server required, overkill), IndexedDB (browser-only), JSON file (no ACID) |
| **Trade-offs** | No multi-node or multi-user concurrent write support; acceptable for single-operator GCS |

---

**AD-005 — Vite `optimizeDeps.exclude` + `ssr.external` for native modules**

| | |
|-|-|
| **Decision** | Explicitly exclude `node-mavlink`, `serialport`, and `@serialport/bindings-cpp` from Vite's pre-bundler and mark them as SSR externals |
| **Rationale** | Vite pre-bundling attempts to inline all imports into browser-compatible chunks. `serialport` uses native C++ bindings via `@serialport/bindings-cpp` that cannot run in a browser. Without exclusion, Vite generates a broken `chunk-XXXXXX.js` that throws at runtime. `ssr.external` tells the SSR runtime to `require()` these as Node.js externals rather than bundling them. |
| **Alternatives** | Moving all imports into dynamic `import()` calls (fragile), using a separate backend process (over-engineered) |
| **Trade-offs** | These packages must be available on the deployment machine; they are not inlined into the build output |

---

**AD-006 — Lucia v3 for session management**

| | |
|-|-|
| **Decision** | Use Lucia v3 with LibSQLAdapter for session-based authentication |
| **Rationale** | Lucia provides a well-structured, framework-agnostic session management layer with TypeScript-first design. It integrates directly with libsql/SQLite via the LibSQLAdapter, keeping the stack consistent. Session cookies with sliding expiry are more appropriate than JWTs for a local GCS application. |
| **Alternatives** | Manual session management (error-prone), JWT tokens (stateless, harder to invalidate), Passport.js (Express-centric) |
| **Trade-offs** | Lucia v3 is a relatively new library; the API changed significantly from v2 |

---

**AD-007 — Parameter commands via HTTP headers**

| | |
|-|-|
| **Decision** | MAVLink API endpoints receive parameters as HTTP request headers, not request body |
| **Rationale** | This was an early design choice that simplified client-side fetch calls (no body serialization required). Headers are parsed directly in route handlers. |
| **Alternatives** | JSON request body (more standard, supports larger payloads) |
| **Trade-offs** | HTTP headers have size limits; not suitable for large payloads. Acceptable for MAVLink commands (all params are small scalars). Future refactor should migrate to JSON body for correctness. |

---

## 12. Traceability to Requirements

Per ISO/IEC 12207 §6.4.4, each functional requirement must be allocated to one or more architectural components.

| SRS Requirement | Allocated Architectural Component(s) |
|----------------|--------------------------------------|
| FR-001–FR-002 | `hooks.server.ts` (redirect + auth check) |
| FR-003 | `/api/auth/checkAdmin`, `/register` page |
| FR-004 | `auth.ts` (`@node-rs/argon2` hash on register) |
| FR-005 | `auth.ts` (`lucia.createSession`), `hooks.server.ts` (cookie set) |
| FR-006 | `+layout.svelte` (`checkCookieInterval`, `lastActivity` cookie) |
| FR-007 | `+layout.svelte` (event listeners: mousemove, keydown, click, scroll) |
| FR-008 | `/api/auth/logout` handler, `handleLogout()` in `+layout.svelte` |
| FR-010 | `mavlink.ts` (`_openPort`, `SerialPort`) |
| FR-011 | `mavlink.ts` (`detectPort()`) |
| FR-012 | `SerialPortModal.svelte`, `/api/mavlink/list_ports`, `/api/mavlink/select_port` |
| FR-013 | `mavlink.ts` (`process.env.USB_BAUD_RATE`), `vite.config.ts` (`define`) |
| FR-014 | `mavlink.ts` (`MavLinkPacketSplitter`, `MavLinkPacketParser`, `REGISTRY`) |
| FR-015 | `+layout.svelte` (`setInterval(checkOnlineStatus, 1100)`) |
| FR-016 | `/api/mavlink/disconnect`, `mavlink.ts` (`forceDisconnect`) |
| FR-017 | `mavlink.ts` (`_closePort`, `setTimeout(resolve, 800)`) |
| FR-018 | `mavlink.ts` (`globalThis.__mav`, HMR cleanup guard) |
| FR-019 | `mavlink.ts` (`S.newLogs.splice(0)` in heartbeat), `+layout.svelte` (`logs.slice(-1000)`) |
| FR-020 | `+layout.svelte` (`GLOBAL_POSITION_INT` handler), `mavLocationStore` |
| FR-021 | `+layout.svelte` (`relativeAlt / 1000`), `mavAltitudeStore` |
| FR-022 | `+layout.svelte` (`calculateSpeed`), `mavSpeedStore` |
| FR-023 | `+layout.svelte` (`hdg / 100`), `mavHeadingStore` |
| FR-024 | `+layout.svelte` (`GPS_RAW_INT` handler), `mavSatelliteStore` |
| FR-025 | `+layout.svelte` (`BATTERY_STATUS` handler), `mavBatteryStore` |
| FR-026 | `+layout.svelte` (`HEARTBEAT` handler), mavTypeStore + mavModelStore + mavStateStore + mavModeStore + mavArmedStateStore |
| FR-027 | `Map.svelte` (subscribes to `mavLocationStore`) |
| FR-028 | `Offline.svelte`, `+layout.svelte` (conditional render) |
| FR-030–FR-031 | `+layout.svelte` (battery alert reactive statement) |
| FR-032 | `+layout.svelte` (`COMMAND_ACK` handler, `showNotification`) |
| FR-033 | `+layout.svelte` (`STATUSTEXT` handler) |
| FR-034 | `+layout.svelte` (`MISSION_ITEM_REACHED` handler) |
| FR-035 | `+layout.svelte` (`SpeechSynthesisUtterance`) |
| FR-036 | `+layout.svelte` (`toggleAudioNotifications`), `customizationStore` |
| FR-040 | `Map.svelte` (Leaflet interactive map) |
| FR-041–FR-042 | `MissionPlan.svelte`, `missionPlanStore.ts` |
| FR-043 | `/api/mission/[type]` +server.ts, `db.ts` (mission table) |
| FR-044 | `/api/mavlink/load_mission`, `mavlink.ts` (`setMissionCount`, `loadMissionItem`) |
| FR-045 | `/api/mavlink/clear_mission`, `mavlink.ts` (`clearAllMissionItems`) |
| FR-046 | `+layout.svelte` (`MISSION_CURRENT` handler), `missionIndexStore` |
| FR-047 | `+layout.svelte` (`MISSION_ITEM_REACHED` + final index check), `missionCompleteStore` |
| FR-048 | `Stats.svelte` (haversine ETA calculation) |
| FR-050–FR-057 | `Stats.svelte`, `Controls.svelte`, `DPad.svelte`, `/api/mavlink/send_command` |
| FR-060 | `+layout.svelte` (`requestParameters()` on mount), `/api/mavlink/request_params` |
| FR-061–FR-065 | `/parameters` +page.svelte, `mavlinkParamStore`, `/api/mavlink/write_param` |
| FR-070–FR-072 | `Weather.svelte` (Open-Meteo + Nominatim fetch) |
| FR-073 | `/api/altitudeangel.ts` proxy, `Map.svelte` (GeoJSON overlay) |
| FR-074 | `LiveFeed.svelte` (hls.js) |
| FR-080–FR-084 | `/event-log` +page.svelte, `mavlinkLogStore` |
| NFR-001–NFR-002 | Heartbeat polling design (AD-003), `mavlink.ts` async stream |
| NFR-003 | `+layout.svelte` (`logs.slice(-1000)`) |
| NFR-010 | `globalThis.__mav` singleton (AD-002) |
| NFR-020 | `hooks.server.ts` session validation on every request |
| NFR-021 | `auth.ts` (`secure: !dev`) |
| NFR-022 | `auth.ts` (`@node-rs/argon2`), `db.ts` prepared statements |
| NFR-023 | `/api/altitudeangel.ts` server-side proxy |
| NFR-030–NFR-031 | `customizationStore.ts`, `+layout.svelte`, Tailwind responsive classes |
| NFR-040–NFR-041 | `vite.config.ts` (`optimizeDeps.exclude`, `ssr.external`), `src/lib/server/` boundary |
| NFR-042–NFR-043 | `tsconfig.json`, `eslint.config.js` |
| NFR-050–NFR-051 | `vite.config.ts`, `@sveltejs/adapter-node` |

---

## 13. Glossary

| Term | Definition |
|------|------------|
| **ADD** | Architectural Design Document |
| **Argon2id** | Memory-hard password hashing algorithm; variant combining Argon2i and Argon2d |
| **COM Port** | Windows serial communications port identifier (e.g., COM3) |
| **globalThis** | JavaScript global object shared across all module executions in a Node.js process |
| **HMR** | Hot Module Replacement — Vite feature that updates modules in-place without full restart |
| **libsql** | Synchronous SQLite driver for Node.js (used in Sidak GCS) |
| **Lucia v3** | TypeScript session management library with adapter-based persistence |
| **MAVLink Registry** | Map of message ID to message class, used for packet deserialisation |
| **MavLinkPacketParser** | node-mavlink transform stream that decodes framed packets into JS objects |
| **MavLinkPacketSplitter** | node-mavlink transform stream that frames raw serial bytes into MAVLink packets |
| **newLogs** | Array of MAVLink log strings accumulated since the last heartbeat poll; consumed (spliced) on each heartbeat |
| **SvelteKit** | Full-stack web framework built on Svelte providing SSR, routing, and API endpoints |
| **SSR** | Server-Side Rendering — page HTML generated on the server before delivery to browser |
| **singleton** | Design pattern ensuring only one instance of a resource exists; used for MAVLink serial connection |
| **Vite** | Frontend build tool and dev server used by SvelteKit |
| **writable** | Svelte store primitive providing a subscribable, mutable reactive value |

---

