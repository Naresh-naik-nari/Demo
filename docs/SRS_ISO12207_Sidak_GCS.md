# Software Requirements Specification
## Sidak Ground Control Station (GCS)
### Conforming to ISO/IEC 12207:2017 — Software Life Cycle Processes

---

**Document ID:** CGCS-SRS-001  
**Version:** 1.0  
**Date:** 2026-07-11  
**Status:** Draft  
**Prepared by:** [Author Name]  
**Reviewed by:** [Reviewer Name]  
**Approved by:** [Approver Name]

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Context](#2-system-context)
3. [Stakeholders and User Classes](#3-stakeholders-and-user-classes)
4. [System Overview](#4-system-overview)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Interface Requirements](#7-interface-requirements)
8. [Constraints and Assumptions](#8-constraints-and-assumptions)
9. [Process Requirements (ISO/IEC 12207)](#9-process-requirements-iso-iec-12207)
10. [Verification and Validation Criteria](#10-verification-and-validation-criteria)
11. [Traceability Matrix](#11-traceability-matrix)
12. [Glossary](#12-glossary)

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the functional and non-functional requirements for the **Sidak Ground Control Station (GCS)** software system. It is produced in accordance with **ISO/IEC 12207:2017** — *Systems and software engineering — Software life cycle processes* — specifically the Stakeholder Needs and Requirements Definition Process (6.4.1) and the Software Requirements Analysis Process (6.4.2).

This document serves as the authoritative reference for design, development, testing, and validation activities throughout the software life cycle.

### 1.2 Scope

The Sidak GCS is a web-based application that provides real-time monitoring, manual control, and autonomous mission management for unmanned aerial vehicles (UAVs) communicating via the MAVLink protocol. The system runs as a SvelteKit server-side application on a ground station computer connected to a flight controller over USB serial.

**In scope:**
- Real-time telemetry display
- USB serial MAVLink communication
- Mission planning, uploading, and tracking
- User authentication and session management
- Vehicle parameter read/write
- Weather and airspace integration

**Out of scope:**
- Flight controller firmware
- Radio telemetry hardware
- Live video encoding/streaming infrastructure

### 1.3 Definitions, Acronyms, and Abbreviations

See Section 12 — Glossary.

### 1.4 References

| Reference | Document |
|-----------|----------|
| ISO/IEC 12207:2017 | Systems and software engineering — Software life cycle processes |
| MAVLink v2 | Micro Air Vehicle Message Marshalling Library, mavlink.io |
| ArduPilot | Open-source autopilot firmware, ardupilot.org |
| RFC 2119 | Key words for use in RFCs to indicate requirement levels |

### 1.5 Requirement Notation

Requirements use the following keywords per RFC 2119:
- **SHALL** — mandatory requirement
- **SHOULD** — recommended but not mandatory
- **MAY** — optional capability

Each requirement is identified by a unique ID in the format `[CATEGORY]-[NNN]` (e.g., `FR-001`).

---

## 2. System Context

### 2.1 System Boundary

```
┌─────────────────────────────────────────────────────────┐
│                   Sidak GCS (Browser)                   │
│  Dashboard │ Mission Planner │ Event Log │ Parameters    │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP (SvelteKit SSR)
┌────────────────────────▼────────────────────────────────┐
│               Sidak GCS (Node.js Server)                │
│  Auth (Lucia) │ MAVLink Layer │ Mission CRUD │ SQLite DB  │
└──────┬────────────────────────────────┬─────────────────┘
       │ USB Serial                     │ HTTPS
┌──────▼──────┐                ┌────────▼────────────────┐
│ Flight Ctrl │                │ External APIs            │
│ (CubePilot) │                │ Open-Meteo │ Altitude    │
│ MAVLink v2  │                │ Weather    │ Angel       │
└─────────────┘                └─────────────────────────┘
```

### 2.2 Operating Environment

- **Server OS:** Windows 10/11 (primary), Linux (secondary)
- **Runtime:** Node.js ≥ 18, served via SvelteKit adapter-node
- **Client:** Modern web browser (Chrome, Edge, Firefox) on the same local machine or local network
- **Hardware:** USB-connected ArduPilot-compatible flight controller (tested: Cube Orange+)
- **Network:** Local only; no public internet exposure required for core functions

---

## 3. Stakeholders and User Classes

Per ISO/IEC 12207 §6.4.1, all stakeholders whose needs shape requirements are identified below.

| Stakeholder | Role | Primary Concerns |
|-------------|------|-----------------|
| UAV Operator | Primary user; flies the vehicle | Real-time telemetry, manual controls, safety alerts |
| Mission Planner | Designs and uploads autonomous missions | Waypoint editing, mission upload reliability |
| System Administrator | Manages user accounts | Authentication, session security |
| Safety Officer | Monitors flight safety | Battery alerts, airspace awareness, connection status |
| Developer / Maintainer | Maintains and extends the software | Code quality, build process, documentation |

---

## 4. System Overview

The Sidak GCS consists of six primary subsystems:

| Subsystem | Description |
|-----------|-------------|
| **Authentication** | Session-based login/logout with cookie management and inactivity timeout |
| **MAVLink Communication** | USB serial connection, packet parsing, command dispatch, heartbeat polling |
| **Telemetry Display** | Real-time visualization of GPS position, altitude, speed, heading, battery, mode |
| **Mission Management** | Interactive map-based mission planner; CRUD persistence; upload to flight controller |
| **Parameter Management** | Read all vehicle parameters; inline edit and write back to flight controller |
| **External Data** | Weather (Open-Meteo), airspace awareness (Altitude Angel), reverse geocoding (Nominatim) |

---

## 5. Functional Requirements

### 5.1 Authentication and Authorization

| ID | Requirement |
|----|-------------|
| FR-001 | The system SHALL require a valid username and password to access any protected route. |
| FR-002 | The system SHALL redirect unauthenticated users to `/login`. |
| FR-003 | The system SHALL support first-time admin registration when no user exists in the database. |
| FR-004 | The system SHALL hash passwords using Argon2 before storage. |
| FR-005 | The system SHALL issue a session cookie upon successful authentication using Lucia v3. |
| FR-006 | The system SHALL invalidate sessions and log out users after 10 minutes of inactivity. |
| FR-007 | The system SHALL refresh the inactivity timer on mouse movement, keyboard input, click, or scroll events. |
| FR-008 | The system SHALL provide a logout action that clears the session cookie. |

---

### 5.2 MAVLink Communication

| ID | Requirement |
|----|-------------|
| FR-010 | The system SHALL connect to a MAVLink-capable flight controller via USB serial port. |
| FR-011 | The system SHALL auto-detect the serial port with the following priority: (1) `USB_SERIAL_PORT` environment variable, (2) CubePilot VID `2DAE` MAVLink port, (3) any CubePilot port, (4) first non-Intel USB serial port. |
| FR-012 | The system SHALL allow the operator to manually select a serial port from a list of available ports. |
| FR-013 | The system SHALL support configurable baud rate via the `USB_BAUD_RATE` environment variable (default: 115200). |
| FR-014 | The system SHALL parse incoming MAVLink v2 packets using the combined `minimal`, `common`, and `ardupilotmega` dialects. |
| FR-015 | The system SHALL poll the flight controller for new MAVLink data at approximately 1-second intervals. |
| FR-016 | The system SHALL allow the operator to disconnect the serial port on demand. |
| FR-017 | The system SHALL release the COM port handle within 800 ms of a disconnect request (to support Windows COM port reuse). |
| FR-018 | The system SHALL persist the MAVLink connection state across Vite HMR reloads using `globalThis`. |
| FR-019 | The system SHALL log the last 1000 MAVLink messages in memory and send new messages to the client on each heartbeat. |

---

### 5.3 Telemetry Display

| ID | Requirement |
|----|-------------|
| FR-020 | The system SHALL display the vehicle's GPS coordinates (latitude, longitude) updated from `GLOBAL_POSITION_INT` messages. |
| FR-021 | The system SHALL display the vehicle's relative altitude in metres, derived from `GLOBAL_POSITION_INT.relativeAlt`. |
| FR-022 | The system SHALL display the vehicle's ground speed in m/s, computed as the vector magnitude of vx, vy, vz. |
| FR-023 | The system SHALL display the vehicle's heading in degrees (0–360), derived from `GLOBAL_POSITION_INT.hdg`. |
| FR-024 | The system SHALL display satellite count and HDOP from `GPS_RAW_INT` messages. |
| FR-025 | The system SHALL display battery remaining percentage from `BATTERY_STATUS` messages. |
| FR-026 | The system SHALL display vehicle type, autopilot model, system state, flight mode, and armed status from `HEARTBEAT` messages. |
| FR-027 | The system SHALL update the vehicle marker position on the map in real time as GPS data changes. |
| FR-028 | The system SHALL provide an offline overlay when the MAVLink connection is not established. |

---

### 5.4 Safety Alerts and Notifications

| ID | Requirement |
|----|-------------|
| FR-030 | The system SHALL issue a warning notification when battery level drops below 50%, 20%, 15%, 10%, and 5%. |
| FR-031 | Battery alerts at ≤20% SHALL be classified as errors; alerts above 20% SHALL be classified as warnings. |
| FR-032 | The system SHALL display notifications for all received `COMMAND_ACK` messages, classified as success, warning, or error based on the result code. |
| FR-033 | The system SHALL display `STATUSTEXT` messages with severity mapping: levels 0–3 as error, level 4 as warning, levels 5+ as info. |
| FR-034 | The system SHALL display a success notification when each mission waypoint is reached (`MISSION_ITEM_REACHED`). |
| FR-035 | The system SHALL support optional audio notifications using the Web Speech API for warning and error severity events. |
| FR-036 | The system SHALL allow the operator to toggle audio notifications on or off from the navigation bar. |

---

### 5.5 Mission Planning

| ID | Requirement |
|----|-------------|
| FR-040 | The system SHALL provide an interactive map interface for creating and editing mission waypoints. |
| FR-041 | The system SHALL support the following MAVLink mission item types as a minimum: `WAYPOINT`, `TAKEOFF`, `LAND`, `RTL`, `LOITER_UNLIM`, `SPLINE_WAYPOINT`, `DO_SET_SERVO`, `DO_REPEAT_SERVO`, `DO_WINCH`, `CONDITION_DELAY`, `CONDITION_DISTANCE`, `CONDITION_YAW`, `CONDITION_CHANGE_ALT`, `DO_FENCE_ENABLE`, `DO_ENGINE_CONTROL`, `GUIDED_ENABLE`, `CAMERA_IMAGE_CAPTURED`. |
| FR-042 | Each mission item SHALL capture: type, latitude, longitude, altitude, param1–param4, and optional notes. |
| FR-043 | The system SHALL persist mission plans to a local SQLite database with save, update, load, unload, list, and delete operations. |
| FR-044 | The system SHALL upload the active mission plan to the flight controller as a MAVLink mission sequence (`MISSION_COUNT` followed by sequential `MISSION_ITEM_INT` messages with 250 ms inter-item delay). |
| FR-045 | The system SHALL clear all mission items on the flight controller on request (`MISSION_CLEAR_ALL`). |
| FR-046 | The system SHALL track the currently active mission waypoint index via `MISSION_CURRENT` messages and display mission progress. |
| FR-047 | The system SHALL indicate mission completion when the final waypoint is reached. |
| FR-048 | The system SHALL display estimated time of arrival (ETA) for the active mission using haversine distance calculations. |

---

### 5.6 Manual Vehicle Control

| ID | Requirement |
|----|-------------|
| FR-050 | The system SHALL provide takeoff, land, and return-to-launch (RTL) commands. |
| FR-051 | The system SHALL support starting, pausing, and stopping an autonomous mission. |
| FR-052 | The system SHALL provide a directional pad (D-Pad) for manual GUIDED-mode position control using `SET_POSITION_TARGET_LOCAL_NED`. |
| FR-053 | The system SHALL provide altitude increment and decrement controls. |
| FR-054 | The system SHALL provide left and right rotation commands. |
| FR-055 | The system SHALL provide a payload release (gripper) command. |
| FR-056 | The system SHALL provide sensor calibration commands (accelerometer, compass, barometer). |
| FR-057 | The system SHALL allow the operator to set a maximum speed and maximum altitude for manual operations. |

---

### 5.7 Vehicle Parameter Management

| ID | Requirement |
|----|-------------|
| FR-060 | The system SHALL request all vehicle parameters from the flight controller on connection (`PARAM_REQUEST_LIST`). |
| FR-061 | The system SHALL display all received parameters in a searchable, sortable table. |
| FR-062 | The system SHALL allow the operator to edit a parameter value inline and write it to the flight controller (`PARAM_SET`). |
| FR-063 | Parameter IDs sent via `PARAM_SET` SHALL be null-padded to exactly 16 characters per the MAVLink parameter protocol. |
| FR-064 | The system SHALL support export of the full parameter set to a JSON file. |
| FR-065 | The system SHALL support import of parameters from a JSON file with bulk write capability. |

---

### 5.8 External Integrations

| ID | Requirement |
|----|-------------|
| FR-070 | The system SHALL fetch and display current weather data (temperature, wind speed, precipitation probability) from the Open-Meteo API at the vehicle's GPS coordinates. |
| FR-071 | Weather data SHALL be refreshed at intervals of no longer than 60 seconds. |
| FR-072 | The system SHALL display a human-readable location name via reverse geocoding using the Nominatim/OpenStreetMap API. |
| FR-073 | The system SHALL fetch airspace awareness data from the Altitude Angel API and overlay it on the mission planning map. |
| FR-074 | The system SHALL support a live video feed display via HLS streaming using hls.js. |

---

### 5.9 Event Log

| ID | Requirement |
|----|-------------|
| FR-080 | The system SHALL provide a dedicated event log page displaying all received MAVLink messages in real time. |
| FR-081 | The system SHALL support filtering the log by message type (TIMESYNC, PARAM_VALUE, GLOBAL_POSITION_INT, BATTERY_STATUS). |
| FR-082 | The system SHALL support keyword search and highlight within the log. |
| FR-083 | The system SHALL allow the operator to download the full event log as a text file. |
| FR-084 | The system SHALL allow the operator to clear the displayed event log. |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| ID | Requirement |
|----|-------------|
| NFR-001 | The heartbeat polling cycle SHALL complete within 500 ms under normal operating conditions. |
| NFR-002 | The telemetry display SHALL reflect new MAVLink data within 2 seconds of receipt. |
| NFR-003 | The in-memory log buffer SHALL be limited to 1000 entries to prevent unbounded memory growth. |
| NFR-004 | Mission item upload to the flight controller SHALL complete within 5 seconds for missions of up to 50 waypoints. |

### 6.2 Reliability

| ID | Requirement |
|----|-------------|
| NFR-010 | The MAVLink connection state SHALL survive server-side Vite HMR reloads without requiring manual reconnection. |
| NFR-011 | On an unexpected port close, the system SHALL update connection state to disconnected within one heartbeat cycle. |
| NFR-012 | The system SHALL log all port errors to the server console without crashing the server process. |

### 6.3 Security

| ID | Requirement |
|----|-------------|
| NFR-020 | All protected routes SHALL reject unauthenticated requests, enforced at the server hook level. |
| NFR-021 | Session cookies SHALL be marked `Secure` in production environments. |
| NFR-022 | Passwords SHALL never be stored in plaintext; only Argon2 hashes SHALL be persisted. |
| NFR-023 | The Altitude Angel API key SHALL be stored in environment variables and never exposed to the client. |
| NFR-024 | MAVLink command parameters received via HTTP headers SHALL be validated (type and range) before dispatch. |

### 6.4 Usability

| ID | Requirement |
|----|-------------|
| NFR-030 | The UI SHALL support both dark mode and light mode, toggleable at runtime. |
| NFR-031 | The UI SHALL be responsive and functional on screen widths down to 768 px (tablet). |
| NFR-032 | The navigation bar SHALL clearly indicate the current connection status with a visual indicator. |
| NFR-033 | All notification toasts SHALL auto-dismiss after 10 seconds unless interacted with. |

### 6.5 Maintainability

| ID | Requirement |
|----|-------------|
| NFR-040 | Node.js-native packages (`node-mavlink`, `serialport`) SHALL be excluded from browser bundling via Vite `optimizeDeps.exclude` and `ssr.external` configuration. |
| NFR-041 | Server-only modules SHALL reside exclusively under `src/lib/server/` to enforce SvelteKit module isolation. |
| NFR-042 | The system SHALL use TypeScript throughout server and client code. |
| NFR-043 | ESLint configuration SHALL be enforced on all `.ts` and `.svelte` files. |

### 6.6 Portability

| ID | Requirement |
|----|-------------|
| NFR-050 | The server SHALL run on Windows and Linux without code changes. |
| NFR-051 | The application SHALL be deployable using `@sveltejs/adapter-node` without modification to source code. |

---

## 7. Interface Requirements

### 7.1 User Interface

| ID | Requirement |
|----|-------------|
| UIR-001 | The application SHALL provide a persistent sidebar navigation with icons for: Dashboard, Mission Planner, Event Log, Vehicle Parameters, USB Connect/Disconnect, and Logout. |
| UIR-002 | The dashboard SHALL display telemetry panels (Stats, Compass, Controls, LiveFeed, Map) in a responsive grid layout. |
| UIR-003 | The mission planner SHALL display an interactive map occupying the primary view area with a collapsible mission table panel. |
| UIR-004 | The serial port selection dialog SHALL list all available system COM ports with path and description. |

### 7.2 Hardware Interface

| ID | Requirement |
|----|-------------|
| HIR-001 | The system SHALL interface with the flight controller via a USB serial connection at a configurable baud rate. |
| HIR-002 | The system SHALL support CubePilot USB Vendor ID `2DAE` for auto-detection. |
| HIR-003 | The system SHALL release the serial port handle fully before allowing reconnection. |

### 7.3 Software Interface

| ID | Requirement |
|----|-------------|
| SIR-001 | The MAVLink layer SHALL use `node-mavlink ^2.0.7` for packet parsing and serialization. |
| SIR-002 | The database layer SHALL use `libsql ^0.5.0` with a local SQLite file at `./src/data.db`. |
| SIR-003 | Authentication SHALL use Lucia v3 with the `@lucia-auth/adapter-sqlite` adapter. |
| SIR-004 | The weather integration SHALL call `https://api.open-meteo.com` with the vehicle GPS coordinates as query parameters. |
| SIR-005 | The airspace integration SHALL call `https://api.altitudeangel.com/v2/mapdata/geojson` with an `X-Api-Key` header. |
| SIR-006 | The map SHALL use Leaflet `^1.9.4` with OpenStreetMap and satellite tile layers. |

### 7.4 Communication Interface

| ID | Requirement |
|----|-------------|
| CIR-001 | All client-to-server communication SHALL use HTTP POST requests to the SvelteKit API routes. |
| CIR-002 | The heartbeat endpoint SHALL return a JSON response containing `{ logs: string[], portOpen: boolean, online: boolean }`. |
| CIR-003 | MAVLink command parameters SHALL be passed as HTTP request headers. |

---

## 8. Constraints and Assumptions

### 8.1 Constraints

- The application currently supports a single concurrent flight controller connection.
- The SQLite database file is local to the server; no multi-node deployment is supported.
- Video streaming requires an external HLS stream source; the GCS does not provide encoding.
- The Altitude Angel API requires a separate API key provisioned externally.

### 8.2 Assumptions

- The flight controller uses ArduPilot firmware and supports MAVLink v2.
- The ground station has a physical USB connection to the flight controller.
- The operator's browser and the Node.js server run on the same machine or local network.
- The `USB_SERIAL_PORT` and `USB_BAUD_RATE` environment variables are set in a `.env` file at project root.

---

## 9. Process Requirements (ISO/IEC 12207)

This section maps ISO/IEC 12207:2017 life cycle processes to activities required for this project.

### 9.1 Agreement Processes (§6.1)

| Process | Activity |
|---------|----------|
| Acquisition (6.1.1) | Define acceptance criteria based on this SRS before commencing development. Verify the system against FR and NFR items prior to delivery. |
| Supply (6.1.2) | Maintain this SRS as the contractual baseline. Track all requirement changes through version control. |

### 9.2 Organizational Project-Enabling Processes (§6.2)

| Process | Activity |
|---------|----------|
| Infrastructure Management (6.2.2) | Provision Node.js ≥18 runtime, SQLite, and USB driver environment on the development and deployment machine. |
| Portfolio Management (6.2.3) | Maintain a project backlog aligned with requirements in this document. |
| Human Resource Management (6.2.4) | Assign roles: developer, tester, operator SME, safety reviewer. |
| Quality Management (6.2.5) | Apply ESLint, TypeScript checks, and manual test plans derived from Section 10. |
| Knowledge Management (6.2.6) | Maintain documentation in `/docs`; keep `README.md` and `QUICK_START.md` updated at each release. |

### 9.3 Technical Processes (§6.4)

| ISO/IEC 12207 Process | Activity for Sidak GCS |
|-----------------------|------------------------|
| **Stakeholder Needs & Requirements Definition (6.4.1)** | Conduct operator interviews; validate FR-001 through FR-084 with UAV operators prior to development start. |
| **System Requirements Analysis (6.4.2)** | Decompose stakeholder needs into the functional and non-functional requirements defined in Sections 5 and 6. |
| **System Architecture Definition (6.4.3)** | Document the three-tier architecture (Browser → SvelteKit Server → Flight Controller / External APIs) and its component decomposition. |
| **System Design (6.4.4)** | Define API contract for all `/api/mavlink/[type]` and `/api/mission/[type]` endpoints. Define database schema. Define Svelte store interfaces. |
| **System Analysis (6.4.5)** | Perform risk analysis for MAVLink communication loss, COM port conflicts on Windows, and session security. |
| **Software Implementation (6.4.6)** | Develop all components per TypeScript and SvelteKit conventions. Enforce `src/lib/server/` isolation for server-only code. |
| **Software Integration (6.4.7)** | Integrate MAVLink communication, authentication, mission management, and telemetry display subsystems. Verify inter-component data flow via stores. |
| **Software Qualification Testing (6.4.8)** | Execute test cases derived from the verification criteria in Section 10. |
| **Software Installation (6.4.9)** | Provide installation procedure in `QUICK_START.md` covering Node.js setup, `.env` configuration, database initialization, and `npm run build`. |
| **Software Acceptance Support (6.4.10)** | Conduct acceptance testing with UAV operator against all FR items. Obtain sign-off before operational deployment. |

### 9.4 Software-Specific Processes (§7)

| ISO/IEC 12207 Process | Activity for Sidak GCS |
|-----------------------|------------------------|
| **Software Requirements Analysis (7.1.2)** | Verify that all requirements are complete, unambiguous, testable, and traceable (see Section 11). |
| **Software Architectural Design (7.1.3)** | Document SvelteKit route structure, Svelte store dependency graph, and MAVLink singleton lifetime. |
| **Software Detailed Design (7.1.4)** | Specify function signatures, state machine for serial connection (`idle → connecting → connected → disconnected`), and Svelte component props/events. |
| **Software Construction (7.1.5)** | Apply secure coding patterns: parameterized SQLite queries, input validation on all API headers, environment variable isolation for secrets. |
| **Software Integration Testing (7.1.6)** | Test the complete heartbeat polling loop, mission upload sequence, and parameter read/write cycle against a physical or simulated flight controller. |
| **Software Qualification Testing (7.1.7)** | Test all FR and NFR items. Document pass/fail results. |
| **Software Maintenance (7.1.8)** | Apply a change control process for any modification post-deployment. Update this SRS for scope changes. |

---

## 10. Verification and Validation Criteria

Per ISO/IEC 12207 §7.1.7, the following criteria define how each requirement category will be verified.

### 10.1 Authentication (FR-001 to FR-008)

| Test ID | Requirement | Method | Pass Criterion |
|---------|-------------|--------|----------------|
| VT-001 | FR-001, FR-002 | Manual | Navigating to `/dashboard` without a session redirects to `/login`. |
| VT-002 | FR-003 | Manual | On a clean database, `/login` redirects to `/register`. |
| VT-003 | FR-004 | Code Inspection | `password_hash` column in `user` table contains Argon2 hash, not plaintext. |
| VT-004 | FR-005 | Manual | Successful login sets a session cookie; `document.cookie` contains the Lucia session name. |
| VT-005 | FR-006 | Manual | After 10 minutes without activity, the user is redirected to `/login`. |
| VT-006 | FR-007 | Manual | Performing a mouse movement resets the inactivity timer. |

### 10.2 MAVLink Communication (FR-010 to FR-019)

| Test ID | Requirement | Method | Pass Criterion |
|---------|-------------|--------|----------------|
| VT-010 | FR-010, FR-012 | Manual | Serial port modal lists available ports; selecting one opens the connection. |
| VT-011 | FR-011 | Manual | With a CubePilot connected and no `USB_SERIAL_PORT` env var set, the system auto-connects to the correct port. |
| VT-012 | FR-013 | Manual | Setting `USB_BAUD_RATE=57600` in `.env` and connecting verifies the baud rate in server logs. |
| VT-013 | FR-015 | Manual | Server logs show heartbeat activity at ~1-second intervals. |
| VT-014 | FR-016, FR-017 | Manual | Clicking Disconnect closes the port; re-plugging the USB device and reconnecting succeeds without a COM port conflict. |
| VT-015 | FR-018 | Manual | Saving a source file (triggering HMR) does not drop the active MAVLink connection. |
| VT-016 | FR-019 | Code Inspection | `logs` array is capped at 1000 entries in `getLogs()`. |

### 10.3 Telemetry Display (FR-020 to FR-028)

| Test ID | Requirement | Method | Pass Criterion |
|---------|-------------|--------|----------------|
| VT-020 | FR-020 to FR-027 | Manual | With a live flight controller, all telemetry widgets (GPS, altitude, speed, heading, satellites, battery, mode, armed state) show live values within 2 seconds. |
| VT-021 | FR-028 | Manual | Disconnecting the USB shows the Offline overlay. |

### 10.4 Mission Planning (FR-040 to FR-048)

| Test ID | Requirement | Method | Pass Criterion |
|---------|-------------|--------|----------------|
| VT-040 | FR-040, FR-041, FR-042 | Manual | Create a mission with TAKEOFF, WAYPOINT, and LAND items; all fields are editable. |
| VT-041 | FR-043 | Manual | Save, list, load, and delete a mission plan; verify persistence across server restart. |
| VT-042 | FR-044, FR-045 | Manual | Upload a 3-waypoint mission to the flight controller; verify in flight controller GCS log. Clear mission; verify cleared. |
| VT-043 | FR-046, FR-047 | Manual | Start an autonomous mission; verify waypoint index increments and completion notification appears. |

### 10.5 Non-Functional Requirements

| Test ID | Requirement | Method | Pass Criterion |
|---------|-------------|--------|----------------|
| VT-050 | NFR-001 | Performance Test | Average heartbeat round-trip time < 500 ms over 30 cycles. |
| VT-051 | NFR-020 | Penetration Test | Direct GET/POST to any `/api/` route without session cookie returns 401 or redirect. |
| VT-052 | NFR-030, NFR-031 | Manual | Toggle dark/light mode; load on 768px-wide viewport — no layout overflow. |
| VT-053 | NFR-040, NFR-041 | Build Verification | `npm run build` completes without errors referencing `node-mavlink` or `serialport` in browser bundles. |

---

## 11. Traceability Matrix

Maps each functional requirement to its source stakeholder need, implementing component, and verification test.

| Requirement ID | Stakeholder | Implementing Component | Verification |
|---------------|-------------|----------------------|--------------|
| FR-001–FR-008 | Administrator | `hooks.server.ts`, `auth.ts`, `/login`, `/register` | VT-001–VT-006 |
| FR-010–FR-019 | UAV Operator | `mavlink.ts`, `/api/mavlink/[type]`, `SerialPortModal.svelte` | VT-010–VT-016 |
| FR-020–FR-028 | UAV Operator | `+layout.svelte` (messageHandlers), `Stats.svelte`, `ConnectionStatus.svelte`, `Map.svelte`, `Compass.svelte` | VT-020–VT-021 |
| FR-030–FR-036 | Safety Officer | `+layout.svelte` (battery alerts), `Notification.svelte` | VT-020 |
| FR-040–FR-048 | Mission Planner | `MissionPlan.svelte`, `MissionPlanSettings.svelte`, `ManageMissionPlans.svelte`, `/api/mission/[type]`, `missionPlanStore.ts` | VT-040–VT-043 |
| FR-050–FR-057 | UAV Operator | `Stats.svelte`, `Controls.svelte`, `DPad.svelte` | Manual |
| FR-060–FR-065 | UAV Operator | `/parameters`, `mavlinkParamStore.ts`, `/api/mavlink/write_param` | Manual |
| FR-070–FR-074 | UAV Operator, Safety Officer | `Weather.svelte`, `LiveFeed.svelte`, `/api/altitudeangel.ts` | Manual |
| FR-080–FR-084 | UAV Operator | `/event-log` | Manual |
| NFR-001–NFR-004 | Developer | `+layout.svelte` (polling), `mavlink.ts` | VT-050 |
| NFR-020–NFR-024 | Administrator | `hooks.server.ts`, `db.ts`, `auth.ts`, `vite.config.ts` | VT-051, VT-053 |
| NFR-030–NFR-033 | UAV Operator | `customizationStore.ts`, `+layout.svelte`, CSS | VT-052 |
| NFR-040–NFR-043 | Developer | `vite.config.ts`, `src/lib/server/` structure | VT-053 |

---

## 12. Glossary

| Term | Definition |
|------|------------|
| **ArduPilot** | Open-source autopilot software suite supporting fixed-wing, multicopter, and rover vehicles. |
| **BAUD_RATE** | Serial communication speed; default 115200 bits per second for MAVLink over USB. |
| **CubePilot** | Manufacturer of the Cube Orange+ flight controller; USB VID `2DAE`. |
| **GCS** | Ground Control Station — the software interface used to monitor and control a UAV from the ground. |
| **HDOP** | Horizontal Dilution of Precision — a measure of GPS positional accuracy (lower is better). |
| **HLS** | HTTP Live Streaming — an adaptive bitrate streaming protocol used for live video. |
| **HMR** | Hot Module Replacement — a Vite development feature that updates modules without full page reload. |
| **Lucia** | A session-based authentication library for TypeScript web applications (v3). |
| **MAVLink** | Micro Air Vehicle Link — a lightweight, header-only message marshalling library for micro air vehicles. |
| **Mission Item** | A single instruction in an autonomous flight plan (e.g., WAYPOINT, TAKEOFF, LAND). |
| **Nominatim** | OpenStreetMap's geocoding service; used for reverse geocoding GPS coordinates to place names. |
| **RTL** | Return to Launch — a MAVLink command instructing the vehicle to return to its home position. |
| **SerialPort** | Node.js library providing access to hardware serial (COM) ports. |
| **SvelteKit** | A full-stack web framework built on Svelte, providing SSR, routing, and API endpoints. |
| **UAV** | Unmanned Aerial Vehicle — a drone operated remotely or autonomously. |
| **VID** | USB Vendor ID — a 16-bit number identifying a USB device manufacturer. |

---

*End of Document*

