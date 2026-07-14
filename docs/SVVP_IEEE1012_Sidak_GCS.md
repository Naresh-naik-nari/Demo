# Software Verification and Validation Plan (SVVP)
## Sidak Ground Control Station (GCS)
### Conforming to IEEE 1012-2016 — Standard for System, Software, and Hardware Verification and Validation

---

**Document ID:** SGCS-SVVP-001  
**Version:** 1.0  
**Date:** 2026-07-13  
**Status:** Draft  
**SRS Reference:** CGCS-SRS-001 (ISO/IEC 12207)  
**Prepared by:** [Author Name]  
**Reviewed by:** [Reviewer Name]  
**Approved by:** [Approver Name]  

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Definitions and Abbreviations](#2-definitions-and-abbreviations)
3. [References](#3-references)
4. [V&V Overview](#4-vv-overview)
5. [V&V Life Cycle Activities](#5-vv-life-cycle-activities)
6. [Test Environment and Tools](#6-test-environment-and-tools)
7. [Feature Test Cases](#7-feature-test-cases)
   - 7.1 Authentication and Authorization
   - 7.2 MAVLink Communication
   - 7.3 Telemetry Display
   - 7.4 Safety Alerts and Notifications
   - 7.5 Mission Planning
   - 7.6 Manual Vehicle Control
   - 7.7 Vehicle Parameter Management
   - 7.8 External Integrations
   - 7.9 Event Log
   - 7.10 User Interface and Usability
   - 7.11 Performance
   - 7.12 Security
   - 7.13 Reliability
   - 7.14 Build and Deployment
8. [Regression Testing](#8-regression-testing)
9. [Acceptance Criteria](#9-acceptance-criteria)
10. [V&V Reporting](#10-vv-reporting)
11. [Traceability Matrix](#11-traceability-matrix)

---

## 1. Purpose

This Software Verification and Validation Plan (SVVP) is prepared in accordance with **IEEE 1012-2016** — *IEEE Standard for System, Software, and Hardware Verification and Validation*. It defines the processes, activities, tasks, methods, responsibilities, and criteria for verifying and validating every feature of the **Sidak Ground Control Station (GCS)**.

**Verification** confirms that the software correctly implements its specified requirements ("Are we building the product right?").  
**Validation** confirms that the software satisfies its intended use and stakeholder needs ("Are we building the right product?").

This plan covers all integrity levels of the Sidak GCS including authentication, MAVLink communication, telemetry display, safety alerts, mission planning, manual control, parameter management, external integrations, event logging, UI/UX, performance, security, reliability, and deployment.

---

## 2. Definitions and Abbreviations

| Term | Definition |
|------|------------|
| **SVVP** | Software Verification and Validation Plan |
| **SRS** | Software Requirements Specification (CGCS-SRS-001) |
| **V&V** | Verification and Validation |
| **TC** | Test Case |
| **FR** | Functional Requirement |
| **NFR** | Non-Functional Requirement |
| **UAV** | Unmanned Aerial Vehicle |
| **GCS** | Ground Control Station |
| **MAVLink** | Micro Air Vehicle Link protocol |
| **HMR** | Hot Module Replacement (Vite development feature) |
| **HDOP** | Horizontal Dilution of Precision |
| **HLS** | HTTP Live Streaming |
| **RTL** | Return to Launch |
| **COM** | Serial communications port (Windows) |
| **DUT** | Device Under Test (the flight controller hardware) |
| **PASS** | Test case produces the expected result |
| **FAIL** | Test case does not produce the expected result |
| **N/A** | Not applicable in the current test environment |

---

## 3. References

| ID | Document |
|----|----------|
| R-01 | IEEE 1012-2016: Standard for System, Software, and Hardware Verification and Validation |
| R-02 | CGCS-SRS-001: Sidak GCS Software Requirements Specification (ISO/IEC 12207) |
| R-03 | MAVLink v2 Protocol Reference — mavlink.io |
| R-04 | ArduPilot Parameter Protocol — ardupilot.org |
| R-05 | SvelteKit Documentation — kit.svelte.dev |
| R-06 | Lucia v3 Authentication — lucia-auth.com |
| R-07 | Open-Meteo API — open-meteo.com |

---

## 4. V&V Overview

### 4.1 Organization

V&V activities are performed by the following roles:

| Role | Responsibilities |
|------|-----------------|
| V&V Lead | Plans, schedules, and reports all V&V activities |
| Test Engineer | Executes test cases, records results |
| UAV Operator (SME) | Validates operational correctness of flight features |
| Security Reviewer | Executes security and penetration tests |
| Developer | Resolves defects; supports integration test setup |

### 4.2 V&V Integrity Level

Per IEEE 1012-2016 §4.3, the Sidak GCS is classified as **Integrity Level 2** (moderate risk — operational errors may lead to loss of the UAV or mission failure, but not loss of human life). All mandatory V&V tasks for Integrity Level 2 are included.

### 4.3 Test Types Used

| Type | Description |
|------|-------------|
| **Unit Test** | Individual TypeScript functions in isolation |
| **Integration Test** | Interactions between server API, MAVLink layer, and database |
| **System Test** | End-to-end features tested through the browser UI |
| **Performance Test** | Timing and throughput measurements |
| **Security Test** | Authentication bypass attempts and header injection checks |
| **Acceptance Test** | Final validation by the UAV Operator stakeholder |
| **Regression Test** | Re-execution of critical tests after each change |

---

## 5. V&V Life Cycle Activities

Per IEEE 1012-2016 §7, V&V tasks are mapped to software life cycle phases:

| Life Cycle Phase | V&V Activity |
|-----------------|--------------|
| Requirements | Review SRS for completeness, consistency, and testability |
| Design | Verify API contracts, database schema, store interfaces |
| Implementation | Code inspection, ESLint, TypeScript compilation |
| Unit Testing | Test individual functions (MAVLink parser, auth, DB queries) |
| Integration Testing | Test API routes + MAVLink layer + database together |
| System Testing | Full end-to-end browser-based feature tests (Section 7) |
| Acceptance Testing | Operator validation of all operational features |
| Maintenance | Regression testing after each change (Section 8) |

---

## 6. Test Environment and Tools

### 6.1 Hardware

| Item | Specification |
|------|--------------|
| Ground Station PC | Windows 10/11, x64, Node.js ≥ 18 installed |
| Flight Controller (DUT) | Cube Orange+ with ArduCopter firmware, or SITL simulator |
| USB Cable | USB-A to Micro-B, capable of data transfer |
| Display | 1920×1080 minimum (for UI tests) |
| Tablet (optional) | For 768px viewport usability tests |

### 6.2 Software

| Tool | Purpose |
|------|---------|
| Node.js ≥ 18 | Runtime environment |
| `npm run dev` | Development server for manual testing |
| `npm run build` | Production build verification |
| Chrome DevTools | Network timing, console inspection, cookie inspection |
| Mission Planner (ArduPilot) | Baseline reference for MAVLink command verification |
| ArduPilot SITL | Software-in-the-loop simulator when hardware unavailable |
| Postman / curl | API endpoint testing without browser |
| SQLite Browser | Database state inspection |
| Stopwatch / DevTools Performance | Timing measurements |

### 6.3 Test Data

- Clean SQLite database (deleted `src/data.db`) for auth bootstrap tests
- Pre-populated database with at least one user and three saved mission plans
- Simulated MAVLink log strings for unit testing message parsers
- JSON file with 10 vehicle parameters for import test

---

## 7. Feature Test Cases

> **Notation:**  
> Each test case follows IEEE 1012-2016 format:  
> `TC-[FEATURE]-[NNN]` | Requirement | Type | Preconditions | Steps | Expected Result | Pass Criterion

---

### 7.1 Authentication and Authorization

---

**TC-AUTH-001 — Redirect unauthenticated user**  
- **Requirement:** FR-001, FR-002  
- **Type:** System Test  
- **Preconditions:** Server running; no session cookie in browser  
- **Steps:**  
  1. Open browser to `http://localhost:5173/dashboard`  
- **Expected Result:** Browser redirects to `/login`  
- **Pass Criterion:** URL bar shows `/login`; dashboard content not rendered

---

**TC-AUTH-002 — First-time admin bootstrap**  
- **Requirement:** FR-003  
- **Type:** System Test  
- **Preconditions:** Delete `src/data.db`; restart server  
- **Steps:**  
  1. Navigate to `http://localhost:5173/login`  
- **Expected Result:** Automatic redirect to `/register`  
- **Pass Criterion:** Registration form is displayed

---

**TC-AUTH-003 — User registration**  
- **Requirement:** FR-003, FR-004  
- **Type:** System Test  
- **Preconditions:** Clean database; on `/register` page  
- **Steps:**  
  1. Enter username `sidak_admin` and password `Test@1234`  
  2. Submit form  
- **Expected Result:** Account created; redirect to `/login`  
- **Pass Criterion:** Login succeeds with the same credentials; `password_hash` in DB is an Argon2 string (starts with `$argon2`)

---

**TC-AUTH-004 — Successful login and session cookie**  
- **Requirement:** FR-001, FR-005  
- **Type:** System Test  
- **Preconditions:** User exists in database  
- **Steps:**  
  1. Navigate to `/login`  
  2. Enter valid credentials; submit  
  3. Open Chrome DevTools → Application → Cookies  
- **Expected Result:** Session cookie is present; user is redirected to `/dashboard`  
- **Pass Criterion:** Lucia session cookie name present; dashboard loads

---

**TC-AUTH-005 — Login failure with wrong password**  
- **Requirement:** FR-001  
- **Type:** System Test  
- **Preconditions:** User exists  
- **Steps:**  
  1. Navigate to `/login`  
  2. Enter correct username and wrong password; submit  
- **Expected Result:** Error message displayed; user stays on `/login`  
- **Pass Criterion:** No session cookie set; user remains on `/login`

---

**TC-AUTH-006 — Session inactivity timeout**  
- **Requirement:** FR-006  
- **Type:** System Test  
- **Preconditions:** Logged in; set system clock forward 11 minutes OR wait  
- **Steps:**  
  1. Log in successfully  
  2. Perform no user interactions for 10 minutes and 5 seconds  
- **Expected Result:** User is automatically redirected to `/login`  
- **Pass Criterion:** Redirect occurs; session cookie is cleared

---

**TC-AUTH-007 — Inactivity timer reset on interaction**  
- **Requirement:** FR-007  
- **Type:** System Test  
- **Preconditions:** Logged in  
- **Steps:**  
  1. Wait 9 minutes without interaction  
  2. Move the mouse  
  3. Wait another 9 minutes  
- **Expected Result:** User is NOT logged out after the mouse movement  
- **Pass Criterion:** Session still active 9 minutes after the mouse event

---

**TC-AUTH-008 — Logout clears session**  
- **Requirement:** FR-008  
- **Type:** System Test  
- **Preconditions:** Logged in  
- **Steps:**  
  1. Click the Logout button in the navigation  
  2. Check cookies in DevTools  
  3. Attempt to navigate to `/dashboard`  
- **Expected Result:** Session cookie cleared; redirect to `/login`  
- **Pass Criterion:** `/dashboard` is inaccessible after logout

---

### 7.2 MAVLink Communication

---

**TC-MAV-001 — Manual port selection and connection**  
- **Requirement:** FR-010, FR-012  
- **Type:** System Test  
- **Preconditions:** Flight controller connected via USB; logged in  
- **Steps:**  
  1. Click the USB plug icon in the navigation bar  
  2. Serial port modal appears; select the correct COM port  
  3. Click Connect  
- **Expected Result:** Connection established; icon changes to connected state  
- **Pass Criterion:** Nav icon shows green connected indicator; server logs show `✅ Port initialized successfully`

---

**TC-MAV-002 — Auto port detection (CubePilot)**  
- **Requirement:** FR-011  
- **Type:** System Test  
- **Preconditions:** CubePilot (VID `2DAE`) connected; `USB_SERIAL_PORT` not set in `.env`  
- **Steps:**  
  1. Remove `USB_SERIAL_PORT` from `.env`; restart server  
  2. Click Connect  
- **Expected Result:** System auto-selects the CubePilot port  
- **Pass Criterion:** Server logs show the CubePilot port path selected without manual input

---

**TC-MAV-003 — Environment variable port override**  
- **Requirement:** FR-011, FR-013  
- **Type:** Integration Test  
- **Preconditions:** `.env` contains `USB_SERIAL_PORT=COM5` and `USB_BAUD_RATE=57600`  
- **Steps:**  
  1. Start the server  
  2. Initiate connection  
- **Expected Result:** Server attempts to open `COM5` at 57600 baud  
- **Pass Criterion:** Server log shows `Opening COM5 at 57600 baud`

---

**TC-MAV-004 — MAVLink packet parsing**  
- **Requirement:** FR-014  
- **Type:** Integration Test  
- **Preconditions:** Connected to flight controller or SITL  
- **Steps:**  
  1. Monitor event log for 30 seconds  
- **Expected Result:** HEARTBEAT, GLOBAL_POSITION_INT, and GPS_RAW_INT messages appear in the log  
- **Pass Criterion:** At least 3 different MAVLink message types decoded and logged

---

**TC-MAV-005 — Heartbeat polling interval**  
- **Requirement:** FR-015  
- **Type:** Integration Test  
- **Preconditions:** Server running; connected  
- **Steps:**  
  1. Open Chrome DevTools → Network  
  2. Filter by `/api/mavlink/heartbeat`  
  3. Observe for 10 requests  
- **Expected Result:** Requests fire approximately every 1.1 seconds  
- **Pass Criterion:** Interval between consecutive requests is 0.9–1.3 seconds

---

**TC-MAV-006 — Disconnect on demand**  
- **Requirement:** FR-016  
- **Type:** System Test  
- **Preconditions:** Currently connected  
- **Steps:**  
  1. Click the USB disconnect icon in the nav bar  
- **Expected Result:** Connection closed; icon reverts to disconnected state  
- **Pass Criterion:** Server logs `✅ Connection closed`; nav icon shows disconnected

---

**TC-MAV-007 — COM port released after disconnect (Windows)**  
- **Requirement:** FR-017  
- **Type:** System Test  
- **Preconditions:** Windows OS; connected  
- **Steps:**  
  1. Disconnect via the UI  
  2. Wait 1 second  
  3. Open another application (e.g., Mission Planner) and connect to the same COM port  
- **Expected Result:** Third-party application can open the COM port without error  
- **Pass Criterion:** No "port in use" error in the third-party application

---

**TC-MAV-008 — HMR persistence**  
- **Requirement:** FR-018  
- **Type:** Integration Test  
- **Preconditions:** Connected in dev mode (`npm run dev`)  
- **Steps:**  
  1. Save any `.svelte` or `.ts` source file to trigger HMR  
- **Expected Result:** MAVLink connection remains active after the page reload  
- **Pass Criterion:** Heartbeat continues; no reconnection required; server logs do NOT show `Opening` again

---

**TC-MAV-009 — Log buffer limit**  
- **Requirement:** FR-019  
- **Type:** Unit Test  
- **Preconditions:** Application running  
- **Steps:**  
  1. Inject 1100 simulated MAVLink log entries via the `getLogs()` function  
  2. Inspect the `logs` array length  
- **Expected Result:** Array is capped at 1000 entries (oldest trimmed)  
- **Pass Criterion:** `logs.length === 1000`

---

### 7.3 Telemetry Display

---

**TC-TEL-001 — GPS position display**  
- **Requirement:** FR-020  
- **Type:** System Test  
- **Preconditions:** Connected; flight controller has GPS lock  
- **Steps:**  
  1. Navigate to `/dashboard`  
  2. Observe the GPS coordinates widget  
- **Expected Result:** Latitude and longitude shown; values match DUT's reported position  
- **Pass Criterion:** Displayed coordinates match Mission Planner reference within 0.00001°

---

**TC-TEL-002 — Relative altitude display**  
- **Requirement:** FR-021  
- **Type:** System Test  
- **Preconditions:** Connected  
- **Steps:**  
  1. Record altitude shown in Stats widget  
  2. Arm the drone and take off to 10 m (or simulate in SITL)  
  3. Re-record altitude  
- **Expected Result:** Altitude increases from ~0 m to ~10 m  
- **Pass Criterion:** Displayed altitude changes by 9–11 m during 10 m ascent

---

**TC-TEL-003 — Ground speed calculation**  
- **Requirement:** FR-022  
- **Type:** Integration Test  
- **Preconditions:** SITL running with known velocity vector (vx=5, vy=0, vz=0)  
- **Steps:**  
  1. Inject `GLOBAL_POSITION_INT` log: `"vx":"500","vy":"0","vz":"0"`  
  2. Observe speed widget  
- **Expected Result:** Speed displayed as 5.00 m/s  
- **Pass Criterion:** Speed = sqrt(5² + 0² + 0²) = 5.00 m/s ± 0.05

---

**TC-TEL-004 — Heading display**  
- **Requirement:** FR-023  
- **Type:** System Test  
- **Preconditions:** Connected; vehicle heading known  
- **Steps:**  
  1. Point vehicle due North (hdg = 0° or 360°)  
  2. Observe heading in compass widget  
- **Expected Result:** Compass shows 0° / 360°  
- **Pass Criterion:** Displayed heading within ±5° of actual

---

**TC-TEL-005 — Satellite count and HDOP**  
- **Requirement:** FR-024  
- **Type:** System Test  
- **Preconditions:** Connected; GPS lock acquired  
- **Steps:**  
  1. Observe satellite count and HDOP value in Stats widget  
- **Expected Result:** Satellite count > 0; HDOP < 10  
- **Pass Criterion:** Values non-zero and update within 2 seconds of receiving `GPS_RAW_INT`

---

**TC-TEL-006 — Battery percentage display**  
- **Requirement:** FR-025  
- **Type:** Integration Test  
- **Preconditions:** Connected  
- **Steps:**  
  1. Inject `BATTERY_STATUS` log with `"batteryRemaining":"75"`  
  2. Observe battery widget  
- **Expected Result:** Battery shows 75%  
- **Pass Criterion:** Displayed value = 75%

---

**TC-TEL-007 — HEARTBEAT data display**  
- **Requirement:** FR-026  
- **Type:** System Test  
- **Preconditions:** Connected to ArduCopter flight controller  
- **Steps:**  
  1. Observe vehicle type, mode, state, armed status in Stats widget  
- **Expected Result:** Shows "Quadrotor" (or correct type), current flight mode, system state, and armed/disarmed  
- **Pass Criterion:** All four fields populated and consistent with DUT

---

**TC-TEL-008 — Live map marker update**  
- **Requirement:** FR-027  
- **Type:** System Test  
- **Preconditions:** Connected; GPS lock  
- **Steps:**  
  1. Move the vehicle 10 m to the East  
  2. Observe the map marker on the dashboard  
- **Expected Result:** Map marker moves East  
- **Pass Criterion:** Marker position updates within 2 seconds of physical movement

---

**TC-TEL-009 — Offline overlay**  
- **Requirement:** FR-028  
- **Type:** System Test  
- **Preconditions:** Logged in; no flight controller connected  
- **Steps:**  
  1. Navigate to `/dashboard` while disconnected  
- **Expected Result:** Offline overlay component rendered over the dashboard  
- **Pass Criterion:** `<Offline>` component visible; telemetry widgets not showing stale data as live

---

### 7.4 Safety Alerts and Notifications

---

**TC-SAF-001 — Battery warning at 50%**  
- **Requirement:** FR-030, FR-031  
- **Type:** Integration Test  
- **Preconditions:** Connected; battery currently at 100%  
- **Steps:**  
  1. Inject `BATTERY_STATUS` log with `"batteryRemaining":"49"`  
- **Expected Result:** Warning toast notification appears with battery alert message  
- **Pass Criterion:** Toast visible; classified as `warning` (yellow); message mentions battery percentage

---

**TC-SAF-002 — Battery error at 20%**  
- **Requirement:** FR-030, FR-031  
- **Type:** Integration Test  
- **Preconditions:** Connected; battery alert index at 20% threshold  
- **Steps:**  
  1. Inject `BATTERY_STATUS` log with `"batteryRemaining":"19"`  
- **Expected Result:** Error toast notification appears  
- **Pass Criterion:** Toast classified as `error` (red)

---

**TC-SAF-003 — Battery thresholds: all 5 levels**  
- **Requirement:** FR-030  
- **Type:** Integration Test  
- **Preconditions:** Fresh session (alert index reset to 0)  
- **Steps:**  
  1. Sequentially inject battery values: 49, 19, 14, 9, 4  
- **Expected Result:** 5 separate toast notifications appear for thresholds 50%, 20%, 15%, 10%, 5%  
- **Pass Criterion:** Exactly 5 alerts fired; no duplicate for same threshold

---

**TC-SAF-004 — COMMAND_ACK success notification**  
- **Requirement:** FR-032  
- **Type:** Integration Test  
- **Steps:**  
  1. Inject `COMMAND_ACK` log with result `ACCEPTED`  
- **Expected Result:** Success toast appears  
- **Pass Criterion:** Toast type is `success`; command name shown

---

**TC-SAF-005 — COMMAND_ACK failure notification**  
- **Requirement:** FR-032  
- **Type:** Integration Test  
- **Steps:**  
  1. Inject `COMMAND_ACK` log with result `FAILED`  
- **Expected Result:** Error toast appears  
- **Pass Criterion:** Toast type is `error`; result name shown

---

**TC-SAF-006 — STATUSTEXT severity mapping**  
- **Requirement:** FR-033  
- **Type:** Integration Test  
- **Steps:**  
  1. Inject STATUSTEXT with severity `2` → expect `error` toast  
  2. Inject STATUSTEXT with severity `4` → expect `warning` toast  
  3. Inject STATUSTEXT with severity `6` → expect `info` toast  
- **Pass Criterion:** Each toast type matches the severity mapping in FR-033

---

**TC-SAF-007 — Waypoint reached notification**  
- **Requirement:** FR-034  
- **Type:** System Test  
- **Preconditions:** Active mission loaded  
- **Steps:**  
  1. Fly to waypoint 1 (or simulate MISSION_ITEM_REACHED)  
- **Expected Result:** Success toast: "Waypoint Reached" with coordinates  
- **Pass Criterion:** Toast shows correct waypoint index and type

---

**TC-SAF-008 — Audio notification on warning**  
- **Requirement:** FR-035  
- **Type:** System Test  
- **Preconditions:** Audio notifications enabled  
- **Steps:**  
  1. Inject a battery warning notification  
- **Expected Result:** Web Speech API speaks the notification content  
- **Pass Criterion:** Audible speech output heard; no console errors

---

**TC-SAF-009 — Toggle audio notifications**  
- **Requirement:** FR-036  
- **Type:** System Test  
- **Steps:**  
  1. Click the audio toggle in the nav bar (disable)  
  2. Inject a warning  
  3. Click toggle again (enable)  
  4. Inject another warning  
- **Expected Result:** No audio on step 2; audio on step 4  
- **Pass Criterion:** Audio absent/present matching toggle state

---

**TC-SAF-010 — Toast auto-dismiss**  
- **Requirement:** NFR-033  
- **Type:** System Test  
- **Steps:**  
  1. Trigger any notification  
  2. Do not interact with the toast  
- **Expected Result:** Toast disappears after 10 seconds  
- **Pass Criterion:** Toast gone within 10–11 seconds

---

### 7.5 Mission Planning

---

**TC-MIS-001 — Add waypoint on map**  
- **Requirement:** FR-040, FR-041, FR-042  
- **Type:** System Test  
- **Preconditions:** Logged in; on `/mission-planner`  
- **Steps:**  
  1. Click on the map to place a WAYPOINT  
  2. Set altitude to 30 m, notes to "Test WP"  
- **Expected Result:** Waypoint appears on map and in mission table  
- **Pass Criterion:** Row added to table with correct lat, lon, alt, type

---

**TC-MIS-002 — All supported mission item types**  
- **Requirement:** FR-041  
- **Type:** System Test  
- **Steps:**  
  1. In the mission table, change the type dropdown for a row to each of: TAKEOFF, LAND, RTL, LOITER_UNLIM, SPLINE_WAYPOINT, DO_SET_SERVO, DO_REPEAT_SERVO, DO_WINCH, CONDITION_DELAY, CONDITION_DISTANCE, CONDITION_YAW, CONDITION_CHANGE_ALT, DO_FENCE_ENABLE, DO_ENGINE_CONTROL, GUIDED_ENABLE, CAMERA_IMAGE_CAPTURED  
- **Expected Result:** Each type selectable without error  
- **Pass Criterion:** All 17 types available in dropdown; no console errors on selection

---

**TC-MIS-003 — Mission item field capture**  
- **Requirement:** FR-042  
- **Type:** System Test  
- **Steps:**  
  1. Create a WAYPOINT item  
  2. Set lat, lon, alt, param1, param2, param3, param4, and notes  
  3. Save the mission  
  4. Reload and inspect saved data  
- **Expected Result:** All 9 fields persisted correctly  
- **Pass Criterion:** Loaded mission item contains all entered values unchanged

---

**TC-MIS-004 — Save mission to database**  
- **Requirement:** FR-043  
- **Type:** Integration Test  
- **Steps:**  
  1. Create a 3-waypoint mission  
  2. Click Save with title "Test Mission Alpha"  
  3. Open SQLite browser; query `SELECT * FROM mission WHERE title='Test Mission Alpha'`  
- **Expected Result:** Row present in database with correct JSON actions  
- **Pass Criterion:** Database row exists; `actions` JSON contains 3 items

---

**TC-MIS-005 — List and load saved missions**  
- **Requirement:** FR-043  
- **Type:** System Test  
- **Steps:**  
  1. Navigate to mission management panel  
  2. Verify "Test Mission Alpha" appears in the list  
  3. Click Load  
- **Expected Result:** Mission loaded into the planner; waypoints shown on map  
- **Pass Criterion:** `isLoaded = 1` in DB; mission table populated

---

**TC-MIS-006 — Delete mission**  
- **Requirement:** FR-043  
- **Type:** Integration Test  
- **Steps:**  
  1. Load a mission  
  2. Click Delete on "Test Mission Alpha"  
  3. Query database  
- **Expected Result:** Mission removed from database and list  
- **Pass Criterion:** No row with title "Test Mission Alpha" in DB

---

**TC-MIS-007 — Upload mission to flight controller**  
- **Requirement:** FR-044  
- **Type:** System Test  
- **Preconditions:** Connected to DUT or SITL; mission loaded  
- **Steps:**  
  1. Click Upload/Send to vehicle  
  2. Monitor server logs  
- **Expected Result:** Server sends MISSION_COUNT then sequential MISSION_ITEM_INT messages  
- **Pass Criterion:** Server logs show `MISSION_COUNT` followed by one `MISSION_ITEM_INT` per waypoint; DUT Mission Planner shows the uploaded mission

---

**TC-MIS-008 — Clear mission on vehicle**  
- **Requirement:** FR-045  
- **Type:** System Test  
- **Preconditions:** Mission uploaded to DUT  
- **Steps:**  
  1. Click Clear Mission  
- **Expected Result:** MISSION_CLEAR_ALL sent; vehicle's mission cleared  
- **Pass Criterion:** DUT Mission Planner shows empty mission list after clear

---

**TC-MIS-009 — Mission progress tracking**  
- **Requirement:** FR-046, FR-047  
- **Type:** System Test  
- **Preconditions:** Mission loaded and started  
- **Steps:**  
  1. Observe the mission progress indicator during flight  
  2. Allow vehicle to reach each waypoint  
- **Expected Result:** Current waypoint index increments; completion indicator appears after last waypoint  
- **Pass Criterion:** Index matches DUT's MISSION_CURRENT; completion shown at last item

---

**TC-MIS-010 — ETA calculation**  
- **Requirement:** FR-048  
- **Type:** System Test  
- **Preconditions:** Mission loaded; vehicle connected  
- **Steps:**  
  1. Load a 2-waypoint mission (10 km apart) at 10 m/s  
  2. Observe ETA display  
- **Expected Result:** ETA ≈ 1000 seconds (haversine distance / speed)  
- **Pass Criterion:** ETA within ±5% of calculated value

---

### 7.6 Manual Vehicle Control

---

**TC-CTL-001 — Takeoff command**  
- **Requirement:** FR-050  
- **Type:** System Test  
- **Preconditions:** Connected; vehicle armed (SITL recommended)  
- **Steps:**  
  1. Click the Takeoff button; enter altitude 5 m  
  2. Confirm  
- **Expected Result:** Vehicle takes off to 5 m  
- **Pass Criterion:** COMMAND_ACK shows ACCEPTED; altitude rises to ~5 m in telemetry

---

**TC-CTL-002 — Land command**  
- **Requirement:** FR-050  
- **Type:** System Test  
- **Preconditions:** Vehicle airborne  
- **Steps:**  
  1. Click Land button  
- **Expected Result:** Vehicle descends and lands  
- **Pass Criterion:** COMMAND_ACK ACCEPTED for NAV_LAND; altitude returns to ~0 m

---

**TC-CTL-003 — Return to Launch (RTL)**  
- **Requirement:** FR-050  
- **Type:** System Test  
- **Preconditions:** Vehicle airborne  
- **Steps:**  
  1. Click RTL button  
- **Expected Result:** Vehicle returns to home position  
- **Pass Criterion:** Flight mode changes to RTL in telemetry

---

**TC-CTL-004 — Start / Pause / Stop mission**  
- **Requirement:** FR-051  
- **Type:** System Test  
- **Preconditions:** Mission loaded and uploaded  
- **Steps:**  
  1. Click Start Mission → observe vehicle begins autonomous flight  
  2. Click Pause → observe vehicle enters LOITER  
  3. Click Resume → observe vehicle continues  
  4. Click Stop  
- **Expected Result:** Vehicle responds to each command appropriately  
- **Pass Criterion:** COMMAND_ACK ACCEPTED for each; flight mode changes accordingly

---

**TC-CTL-005 — D-Pad directional control**  
- **Requirement:** FR-052  
- **Type:** System Test  
- **Preconditions:** Vehicle airborne in GUIDED mode  
- **Steps:**  
  1. Click Forward on the D-Pad  
  2. Click Left  
  3. Click Backward  
  4. Click Right  
- **Expected Result:** Vehicle moves in each commanded direction  
- **Pass Criterion:** GPS position changes consistently with each D-Pad input

---

**TC-CTL-006 — Altitude increment/decrement**  
- **Requirement:** FR-053  
- **Type:** System Test  
- **Preconditions:** Vehicle airborne in GUIDED mode  
- **Steps:**  
  1. Click Altitude Up button  
  2. Click Altitude Down button  
- **Expected Result:** Altitude increases and decreases by configured step  
- **Pass Criterion:** Telemetry altitude changes in correct direction after each click

---

**TC-CTL-007 — Rotate left and right**  
- **Requirement:** FR-054  
- **Type:** System Test  
- **Preconditions:** Vehicle airborne  
- **Steps:**  
  1. Click Rotate Left  
  2. Click Rotate Right  
- **Expected Result:** Heading changes in commanded direction  
- **Pass Criterion:** Heading decreases (left) and increases (right) in telemetry

---

**TC-CTL-008 — Payload release (gripper)**  
- **Requirement:** FR-055  
- **Type:** System Test  
- **Preconditions:** Gripper/servo configured on DUT  
- **Steps:**  
  1. Click Release Payload button  
- **Expected Result:** COMMAND_ACK received for DO_GRIPPER command  
- **Pass Criterion:** ACCEPTED result in acknowledgment notification

---

**TC-CTL-009 — Sensor calibration commands**  
- **Requirement:** FR-056  
- **Type:** System Test  
- **Steps:**  
  1. Click Calibrate Accelerometer  
  2. Click Calibrate Compass  
  3. Click Calibrate Barometer  
- **Expected Result:** COMMAND_ACK received for each calibration  
- **Pass Criterion:** Each returns ACCEPTED or IN_PROGRESS; STATUSTEXT messages appear

---

**TC-CTL-010 — Max speed and altitude settings**  
- **Requirement:** FR-057  
- **Type:** System Test  
- **Steps:**  
  1. Set max speed to 8 m/s  
  2. Set max altitude to 50 m  
  3. Issue a move command  
- **Expected Result:** Parameters written to vehicle; vehicle respects limits  
- **Pass Criterion:** PARAM_SET acknowledged; vehicle does not exceed limits in SITL

---

### 7.7 Vehicle Parameter Management

---

**TC-PAR-001 — Parameter request on connection**  
- **Requirement:** FR-060  
- **Type:** Integration Test  
- **Preconditions:** Connected to DUT  
- **Steps:**  
  1. Connect to flight controller  
  2. Wait 5 seconds  
  3. Navigate to `/parameters`  
- **Expected Result:** Parameter table populated with vehicle parameters  
- **Pass Criterion:** At least 10 parameters loaded and displayed

---

**TC-PAR-002 — Parameter search**  
- **Requirement:** FR-061  
- **Type:** System Test  
- **Steps:**  
  1. Navigate to `/parameters`  
  2. Type "ARMING" in the search field  
- **Expected Result:** Table filtered to show only parameters containing "ARMING"  
- **Pass Criterion:** Only matching rows visible; others hidden

---

**TC-PAR-003 — Parameter inline edit and write**  
- **Requirement:** FR-062, FR-063  
- **Type:** System Test  
- **Preconditions:** Parameters loaded  
- **Steps:**  
  1. Click edit on parameter `PILOT_SPEED_UP` (or any float param)  
  2. Change value to 250  
  3. Click Save  
  4. Check server logs  
- **Expected Result:** PARAM_SET sent; server log shows 16-char null-padded ID  
- **Pass Criterion:** Log shows `Parameter written: PILOT_SPEED_UP\0\0\0\0, value: 250`; DUT confirms value

---

**TC-PAR-004 — Export parameters to JSON**  
- **Requirement:** FR-064  
- **Type:** System Test  
- **Steps:**  
  1. Navigate to `/parameters`  
  2. Click Export  
- **Expected Result:** JSON file downloaded containing all loaded parameters  
- **Pass Criterion:** Downloaded file is valid JSON; contains all parameter IDs and values

---

**TC-PAR-005 — Import parameters from JSON**  
- **Requirement:** FR-065  
- **Type:** System Test  
- **Preconditions:** Valid parameter JSON file available  
- **Steps:**  
  1. Click Import; select the JSON file  
  2. Confirm bulk write  
- **Expected Result:** Each parameter in the JSON is written to the vehicle  
- **Pass Criterion:** PARAM_SET sent for each parameter; COMMAND_ACK received for each

---

### 7.8 External Integrations

---

**TC-EXT-001 — Weather data fetch and display**  
- **Requirement:** FR-070, FR-071  
- **Type:** System Test  
- **Preconditions:** GPS lock; internet access  
- **Steps:**  
  1. Navigate to `/dashboard` or `/mission-planner`  
  2. Observe the Weather widget  
- **Expected Result:** Temperature, wind speed, and precipitation probability displayed  
- **Pass Criterion:** All three fields show numeric values; no "N/A" or error state

---

**TC-EXT-002 — Weather refresh interval**  
- **Requirement:** FR-071  
- **Type:** Integration Test  
- **Steps:**  
  1. Open Network tab in DevTools  
  2. Monitor `open-meteo.com` requests for 3 minutes  
- **Expected Result:** Request fires at most once per 60 seconds  
- **Pass Criterion:** Requests appear every 55–65 seconds

---

**TC-EXT-003 — Reverse geocoding (location name)**  
- **Requirement:** FR-072  
- **Type:** System Test  
- **Preconditions:** GPS coordinates available  
- **Steps:**  
  1. Observe the location name in the Weather or Controls widget  
- **Expected Result:** Human-readable place name displayed (city/town)  
- **Pass Criterion:** Non-empty string shown; matches the expected region for the GPS coordinates

---

**TC-EXT-004 — Altitude Angel airspace overlay**  
- **Requirement:** FR-073  
- **Type:** System Test  
- **Preconditions:** Valid Altitude Angel API key in `.env`; on `/mission-planner`  
- **Steps:**  
  1. Pan/zoom the mission planning map  
- **Expected Result:** Airspace restriction zones overlaid on the map  
- **Pass Criterion:** GeoJSON features visible as colored polygons on the map

---

**TC-EXT-005 — Live video feed (HLS)**  
- **Requirement:** FR-074  
- **Type:** System Test  
- **Preconditions:** Valid HLS stream URL configured  
- **Steps:**  
  1. Navigate to dashboard; observe LiveFeed component  
  2. Enter HLS stream URL  
- **Expected Result:** Video plays in the LiveFeed widget  
- **Pass Criterion:** Video frames visible; no console errors from hls.js

---

**TC-EXT-006 — Weather widget graceful offline handling**  
- **Requirement:** FR-070  
- **Type:** System Test  
- **Preconditions:** Disconnect internet access  
- **Steps:**  
  1. Observe Weather widget behavior  
- **Expected Result:** Last known values retained or empty state shown; no application crash  
- **Pass Criterion:** Application remains functional; no unhandled exceptions

---

### 7.9 Event Log

---

**TC-LOG-001 — Real-time log display**  
- **Requirement:** FR-080  
- **Type:** System Test  
- **Preconditions:** Connected; on `/event-log`  
- **Steps:**  
  1. Observe the log panel for 30 seconds  
- **Expected Result:** New MAVLink messages appear as they arrive  
- **Pass Criterion:** Log entries added at least once per 2 seconds while connected

---

**TC-LOG-002 — Filter by message type**  
- **Requirement:** FR-081  
- **Type:** System Test  
- **Steps:**  
  1. Enable the TIMESYNC filter  
  2. Observe the log  
- **Expected Result:** TIMESYNC messages hidden from view  
- **Pass Criterion:** No TIMESYNC entries visible while filter active

---

**TC-LOG-003 — Keyword search and highlight**  
- **Requirement:** FR-082  
- **Type:** System Test  
- **Steps:**  
  1. Type "HEARTBEAT" in the search field  
- **Expected Result:** Matching entries highlighted; non-matching entries dimmed or hidden  
- **Pass Criterion:** "HEARTBEAT" text visually highlighted in matching rows

---

**TC-LOG-004 — Download event log**  
- **Requirement:** FR-083  
- **Type:** System Test  
- **Steps:**  
  1. Populate log with several messages  
  2. Click Download  
- **Expected Result:** Text file downloaded containing all current log entries  
- **Pass Criterion:** Downloaded file contains the same entries visible in the UI

---

**TC-LOG-005 — Clear event log**  
- **Requirement:** FR-084  
- **Type:** System Test  
- **Steps:**  
  1. Populate log with messages  
  2. Click Clear  
- **Expected Result:** Log panel emptied  
- **Pass Criterion:** Zero entries visible after clear; new messages continue to appear

---

### 7.10 User Interface and Usability

---

**TC-UI-001 — Navigation sidebar present on all protected routes**  
- **Requirement:** UIR-001  
- **Type:** System Test  
- **Steps:**  
  1. Navigate to `/dashboard`, `/mission-planner`, `/event-log`, `/parameters`  
- **Expected Result:** Sidebar with all navigation icons visible on each page  
- **Pass Criterion:** All 6 icons (Dashboard, Mission, Event Log, Parameters, Connect, Logout) present

---

**TC-UI-002 — Sidebar hidden on auth pages**  
- **Requirement:** UIR-001  
- **Type:** System Test  
- **Steps:**  
  1. Navigate to `/login` and `/register`  
- **Expected Result:** Sidebar navigation not displayed  
- **Pass Criterion:** `.desktop-nav` element has `display: none`

---

**TC-UI-003 — Dark mode toggle**  
- **Requirement:** NFR-030  
- **Type:** System Test  
- **Steps:**  
  1. Click the dark/light mode toggle button  
  2. Toggle back  
- **Expected Result:** UI switches between dark and light themes  
- **Pass Criterion:** Background color and text color change on both toggles; map tile style updates

---

**TC-UI-004 — Responsive layout at 768px**  
- **Requirement:** NFR-031  
- **Type:** System Test  
- **Steps:**  
  1. Open DevTools → Device Toolbar  
  2. Set viewport to 768px width  
  3. Navigate to all pages  
- **Expected Result:** No horizontal scroll; content fits within viewport  
- **Pass Criterion:** No `overflow-x` scroll; all critical controls accessible

---

**TC-UI-005 — Mobile navigation**  
- **Requirement:** UIR-001  
- **Type:** System Test  
- **Steps:**  
  1. Set viewport width to 600px  
  2. Click the hamburger menu icon  
- **Expected Result:** Mobile nav links expand  
- **Pass Criterion:** All navigation links visible in mobile nav drawer

---

**TC-UI-006 — Connection status indicator**  
- **Requirement:** NFR-032  
- **Type:** System Test  
- **Steps:**  
  1. Connect to flight controller; observe nav icon  
  2. Disconnect; observe nav icon  
- **Expected Result:** Icon is green when connected; reverts to default when disconnected  
- **Pass Criterion:** CSS class `.connected` applied when connected; removed when disconnected

---

### 7.11 Performance

---

**TC-PER-001 — Heartbeat response time**  
- **Requirement:** NFR-001  
- **Type:** Performance Test  
- **Steps:**  
  1. Open Chrome DevTools → Network  
  2. Measure the time from request to response for `/api/mavlink/heartbeat` over 30 consecutive requests  
- **Expected Result:** All responses return within 500 ms  
- **Pass Criterion:** Mean response time < 500 ms; no response exceeds 1000 ms

---

**TC-PER-002 — Telemetry data latency**  
- **Requirement:** NFR-002  
- **Type:** Performance Test  
- **Steps:**  
  1. Record timestamp when a MAVLink packet is received (server log)  
  2. Record timestamp when the UI widget updates  
- **Expected Result:** UI update occurs within 2 seconds of packet receipt  
- **Pass Criterion:** Delta between server receipt and UI update ≤ 2 seconds

---

**TC-PER-003 — Memory: log buffer cap**  
- **Requirement:** NFR-003  
- **Type:** Unit Test  
- **Steps:**  
  1. Inject 1500 log entries via `getLogs()`  
  2. Inspect `mavlinkLogStore` value  
- **Expected Result:** Store holds ≤ 1000 entries  
- **Pass Criterion:** Array length = 1000

---

**TC-PER-004 — Mission upload time (50 waypoints)**  
- **Requirement:** NFR-004  
- **Type:** Performance Test  
- **Steps:**  
  1. Create a 50-waypoint mission  
  2. Start a timer; click Upload  
  3. Stop timer when final MISSION_ACK received  
- **Expected Result:** Upload completes within 5 seconds  
- **Pass Criterion:** Total time ≤ 5 seconds (50 × 250 ms + overhead = ~13 s theoretical; verify actual vs spec)

> **Note:** The 250 ms per-item delay means 50 items ≈ 12.5 s. If NFR-004 (5 s for 50 items) conflicts with implementation, raise as a defect against the SRS for review.

---

### 7.12 Security

---

**TC-SEC-001 — Unauthenticated API access**  
- **Requirement:** NFR-020  
- **Type:** Security Test  
- **Steps:**  
  1. Clear all cookies in the browser  
  2. Use curl: `curl -X POST http://localhost:5173/api/mavlink/heartbeat`  
- **Expected Result:** 401 or redirect response  
- **Pass Criterion:** Response status is 401 or 302; no MAVLink data returned

---

**TC-SEC-002 — Session cookie security flag**  
- **Requirement:** NFR-021  
- **Type:** Code Inspection  
- **Steps:**  
  1. Inspect `src/lib/server/auth.ts`  
  2. Verify `secure: !dev` in session cookie attributes  
- **Expected Result:** Secure flag set to `true` in production  
- **Pass Criterion:** `secure: !dev` present in Lucia adapter config

---

**TC-SEC-003 — Password stored as hash**  
- **Requirement:** NFR-022  
- **Type:** Integration Test  
- **Steps:**  
  1. Register a new user with password `TestPass123`  
  2. Open `src/data.db` in SQLite Browser  
  3. Read `password_hash` column for the new user  
- **Expected Result:** Value begins with `$argon2` — not plaintext  
- **Pass Criterion:** No plaintext password stored

---

**TC-SEC-004 — API key not exposed to client**  
- **Requirement:** NFR-023  
- **Type:** Security Test  
- **Steps:**  
  1. Open browser DevTools → Sources  
  2. Search JavaScript bundles for the Altitude Angel API key value  
- **Expected Result:** API key not present in any client-side bundle  
- **Pass Criterion:** Zero occurrences of the API key string in browser-loaded JS

---

**TC-SEC-005 — MAVLink command parameter validation**  
- **Requirement:** NFR-024  
- **Type:** Security Test  
- **Steps:**  
  1. Send POST to `/api/mavlink/set_position_local` with headers `x=abc`, `y=0`, `z=0`  
- **Expected Result:** Server returns HTTP 400 (Invalid coordinates)  
- **Pass Criterion:** Response status 400; no command dispatched to MAVLink

---

**TC-SEC-006 — SQL injection prevention**  
- **Requirement:** NFR-022 (secure coding)  
- **Type:** Security Test  
- **Steps:**  
  1. Attempt login with username: `' OR '1'='1`  
- **Expected Result:** Login fails; no data leaked  
- **Pass Criterion:** Error response; DB integrity intact

---

### 7.13 Reliability

---

**TC-REL-001 — HMR does not drop MAVLink connection**  
- **Requirement:** NFR-010  
- **Type:** Integration Test  
- **Steps:**  
  1. Connect to flight controller in dev mode  
  2. Save a `.svelte` source file to trigger HMR  
  3. Observe heartbeat logs  
- **Expected Result:** Heartbeat continues without interruption  
- **Pass Criterion:** No `Opening port` in server log after HMR; online status remains true

---

**TC-REL-002 — Port close event handling**  
- **Requirement:** NFR-011  
- **Type:** Integration Test  
- **Steps:**  
  1. Connect to flight controller  
  2. Physically unplug the USB cable  
  3. Wait for next heartbeat cycle  
- **Expected Result:** System transitions to disconnected state within one heartbeat  
- **Pass Criterion:** `onlineStore` set to `false`; offline overlay appears within ~2 seconds

---

**TC-REL-003 — Port error does not crash server**  
- **Requirement:** NFR-012  
- **Type:** Integration Test  
- **Steps:**  
  1. Connect; forcibly send an invalid byte sequence to the serial port  
- **Expected Result:** Error logged to console; server process continues  
- **Pass Criterion:** Server remains responsive after error; heartbeat API still returns 200

---

**TC-REL-004 — Mission persistence across server restart**  
- **Requirement:** FR-043  
- **Type:** System Test  
- **Steps:**  
  1. Save a mission "Persistence Test"  
  2. Stop the server (`Ctrl+C`)  
  3. Restart server (`npm run dev`)  
  4. Navigate to mission list  
- **Expected Result:** "Persistence Test" still appears in the list  
- **Pass Criterion:** Mission present in DB and UI after restart

---

### 7.14 Build and Deployment

---

**TC-BLD-001 — Production build completes without errors**  
- **Requirement:** NFR-040, NFR-041  
- **Type:** Build Verification  
- **Steps:**  
  1. Run `npm run build` in project root  
- **Expected Result:** Build exits with code 0; no errors referencing `node-mavlink` or `serialport` in browser bundles  
- **Pass Criterion:** Exit code 0; no browser-side chunk references native Node modules

---

**TC-BLD-002 — TypeScript compilation clean**  
- **Requirement:** NFR-042  
- **Type:** Static Analysis  
- **Steps:**  
  1. Run `npm run check`  
- **Expected Result:** No TypeScript errors  
- **Pass Criterion:** Exit code 0; zero error diagnostics

---

**TC-BLD-003 — ESLint clean**  
- **Requirement:** NFR-043  
- **Type:** Static Analysis  
- **Steps:**  
  1. Run `npm run lint`  
- **Expected Result:** No lint errors  
- **Pass Criterion:** Exit code 0

---

**TC-BLD-004 — Cross-platform: Linux build**  
- **Requirement:** NFR-050  
- **Type:** Portability Test  
- **Steps:**  
  1. Clone repository on an Ubuntu 22.04 machine  
  2. Run `npm install` then `npm run build`  
- **Expected Result:** Build succeeds; server starts with `node build`  
- **Pass Criterion:** No platform-specific errors; server responds to HTTP requests

---

**TC-BLD-005 — Adapter-node deployment**  
- **Requirement:** NFR-051  
- **Type:** System Test  
- **Steps:**  
  1. Run `npm run build`  
  2. Run `node build/index.js`  
  3. Navigate to `http://localhost:3000`  
- **Expected Result:** Application runs in production mode  
- **Pass Criterion:** Login page loads; all features functional

---

## 8. Regression Testing

Per IEEE 1012-2016 §7.3.6, the following test cases SHALL be re-executed after every code change that affects the corresponding subsystem:

| Change Type | Mandatory Regression Tests |
|------------|---------------------------|
| Auth code change | TC-AUTH-001 through TC-AUTH-008 |
| MAVLink layer change | TC-MAV-001, TC-MAV-004, TC-MAV-006, TC-MAV-008 |
| Mission API change | TC-MIS-004, TC-MIS-007, TC-MIS-008 |
| Store / telemetry change | TC-TEL-001, TC-TEL-006, TC-TEL-009 |
| Any change | TC-BLD-001, TC-BLD-002, TC-BLD-003 |
| UI change | TC-UI-003, TC-UI-004 |
| Security-related change | TC-SEC-001 through TC-SEC-005 |

A regression test run must be completed and all cases must PASS before merging any pull request to the main branch.

---

## 9. Acceptance Criteria

Per IEEE 1012-2016 §5.3.5, the system is considered accepted when **all** of the following conditions are met:

1. All **System Test** cases in Section 7 achieve PASS status
2. All **Security Test** cases achieve PASS status
3. Zero **Critical** or **High** severity defects remain open
4. Build verification tests TC-BLD-001, TC-BLD-002, and TC-BLD-003 all PASS
5. UAV Operator SME has signed off on TC-CTL-001 through TC-CTL-004 (flight commands)
6. Performance test TC-PER-001 meets the 500 ms criterion

> **Defect Severity Classification:**  
> - **Critical:** Data loss, security breach, server crash, or inability to arm/disarm UAV  
> - **High:** Feature completely non-functional, mission upload failure, auth bypass  
> - **Medium:** Feature partially working, UI rendering error on main pages  
> - **Low:** Cosmetic issue, minor labeling, non-blocking warning

---

## 10. V&V Reporting

### 10.1 Test Execution Record

Each test execution shall be recorded with:

| Field | Description |
|-------|-------------|
| Test Case ID | e.g., TC-AUTH-001 |
| Date Executed | Date of execution |
| Tester | Name/role |
| Environment | OS, browser version, Node.js version, hardware |
| Result | PASS / FAIL / BLOCKED / N/A |
| Actual Result | What actually happened |
| Defect ID | Link to issue tracker if FAIL |
| Notes | Any relevant observations |

### 10.2 Test Summary Report

A Test Summary Report shall be produced at the end of each test cycle containing:

- Total test cases: executed, passed, failed, blocked, N/A
- Defect summary by severity
- Coverage against SRS requirements (traceability)
- Outstanding risks
- Recommendation: Accept / Reject / Conditional Accept

---

## 11. Traceability Matrix

Maps every test case to its SRS requirement, feature, test type, and execution phase.

| Test Case | SRS Requirement | Feature | Test Type | Phase |
|-----------|----------------|---------|-----------|-------|
| TC-AUTH-001 | FR-001, FR-002 | Authentication | System | System Test |
| TC-AUTH-002 | FR-003 | Authentication | System | System Test |
| TC-AUTH-003 | FR-003, FR-004 | Authentication | System | System Test |
| TC-AUTH-004 | FR-001, FR-005 | Authentication | System | System Test |
| TC-AUTH-005 | FR-001 | Authentication | System | System Test |
| TC-AUTH-006 | FR-006 | Authentication | System | System Test |
| TC-AUTH-007 | FR-007 | Authentication | System | System Test |
| TC-AUTH-008 | FR-008 | Authentication | System | Acceptance |
| TC-MAV-001 | FR-010, FR-012 | MAVLink | System | System Test |
| TC-MAV-002 | FR-011 | MAVLink | System | System Test |
| TC-MAV-003 | FR-011, FR-013 | MAVLink | Integration | Integration Test |
| TC-MAV-004 | FR-014 | MAVLink | Integration | Integration Test |
| TC-MAV-005 | FR-015 | MAVLink | Integration | Integration Test |
| TC-MAV-006 | FR-016 | MAVLink | System | System Test |
| TC-MAV-007 | FR-017 | MAVLink | System | System Test |
| TC-MAV-008 | FR-018 | MAVLink | Integration | Integration Test |
| TC-MAV-009 | FR-019 | MAVLink | Unit | Unit Test |
| TC-TEL-001 | FR-020 | Telemetry | System | System Test |
| TC-TEL-002 | FR-021 | Telemetry | System | System Test |
| TC-TEL-003 | FR-022 | Telemetry | Integration | Integration Test |
| TC-TEL-004 | FR-023 | Telemetry | System | System Test |
| TC-TEL-005 | FR-024 | Telemetry | System | System Test |
| TC-TEL-006 | FR-025 | Telemetry | Integration | Integration Test |
| TC-TEL-007 | FR-026 | Telemetry | System | System Test |
| TC-TEL-008 | FR-027 | Telemetry | System | Acceptance |
| TC-TEL-009 | FR-028 | Telemetry | System | System Test |
| TC-SAF-001 | FR-030, FR-031 | Safety Alerts | Integration | Integration Test |
| TC-SAF-002 | FR-030, FR-031 | Safety Alerts | Integration | Integration Test |
| TC-SAF-003 | FR-030 | Safety Alerts | Integration | Integration Test |
| TC-SAF-004 | FR-032 | Safety Alerts | Integration | Integration Test |
| TC-SAF-005 | FR-032 | Safety Alerts | Integration | Integration Test |
| TC-SAF-006 | FR-033 | Safety Alerts | Integration | Integration Test |
| TC-SAF-007 | FR-034 | Safety Alerts | System | Acceptance |
| TC-SAF-008 | FR-035 | Safety Alerts | System | System Test |
| TC-SAF-009 | FR-036 | Safety Alerts | System | System Test |
| TC-SAF-010 | NFR-033 | Safety Alerts | System | System Test |
| TC-MIS-001 | FR-040, FR-041, FR-042 | Mission Planning | System | System Test |
| TC-MIS-002 | FR-041 | Mission Planning | System | System Test |
| TC-MIS-003 | FR-042 | Mission Planning | System | System Test |
| TC-MIS-004 | FR-043 | Mission Planning | Integration | Integration Test |
| TC-MIS-005 | FR-043 | Mission Planning | System | System Test |
| TC-MIS-006 | FR-043 | Mission Planning | Integration | Integration Test |
| TC-MIS-007 | FR-044 | Mission Planning | System | Acceptance |
| TC-MIS-008 | FR-045 | Mission Planning | System | Acceptance |
| TC-MIS-009 | FR-046, FR-047 | Mission Planning | System | Acceptance |
| TC-MIS-010 | FR-048 | Mission Planning | System | System Test |
| TC-CTL-001 | FR-050 | Manual Control | System | Acceptance |
| TC-CTL-002 | FR-050 | Manual Control | System | Acceptance |
| TC-CTL-003 | FR-050 | Manual Control | System | Acceptance |
| TC-CTL-004 | FR-051 | Manual Control | System | Acceptance |
| TC-CTL-005 | FR-052 | Manual Control | System | Acceptance |
| TC-CTL-006 | FR-053 | Manual Control | System | System Test |
| TC-CTL-007 | FR-054 | Manual Control | System | System Test |
| TC-CTL-008 | FR-055 | Manual Control | System | System Test |
| TC-CTL-009 | FR-056 | Manual Control | System | System Test |
| TC-CTL-010 | FR-057 | Manual Control | System | System Test |
| TC-PAR-001 | FR-060 | Parameters | Integration | Integration Test |
| TC-PAR-002 | FR-061 | Parameters | System | System Test |
| TC-PAR-003 | FR-062, FR-063 | Parameters | System | System Test |
| TC-PAR-004 | FR-064 | Parameters | System | System Test |
| TC-PAR-005 | FR-065 | Parameters | System | System Test |
| TC-EXT-001 | FR-070 | External APIs | System | System Test |
| TC-EXT-002 | FR-071 | External APIs | Integration | Integration Test |
| TC-EXT-003 | FR-072 | External APIs | System | System Test |
| TC-EXT-004 | FR-073 | External APIs | System | System Test |
| TC-EXT-005 | FR-074 | External APIs | System | System Test |
| TC-EXT-006 | FR-070 | External APIs | System | System Test |
| TC-LOG-001 | FR-080 | Event Log | System | System Test |
| TC-LOG-002 | FR-081 | Event Log | System | System Test |
| TC-LOG-003 | FR-082 | Event Log | System | System Test |
| TC-LOG-004 | FR-083 | Event Log | System | System Test |
| TC-LOG-005 | FR-084 | Event Log | System | System Test |
| TC-UI-001 | UIR-001 | UI/Usability | System | System Test |
| TC-UI-002 | UIR-001 | UI/Usability | System | System Test |
| TC-UI-003 | NFR-030 | UI/Usability | System | System Test |
| TC-UI-004 | NFR-031 | UI/Usability | System | System Test |
| TC-UI-005 | UIR-001 | UI/Usability | System | System Test |
| TC-UI-006 | NFR-032 | UI/Usability | System | System Test |
| TC-PER-001 | NFR-001 | Performance | Performance | System Test |
| TC-PER-002 | NFR-002 | Performance | Performance | System Test |
| TC-PER-003 | NFR-003 | Performance | Unit | Unit Test |
| TC-PER-004 | NFR-004 | Performance | Performance | System Test |
| TC-SEC-001 | NFR-020 | Security | Security | System Test |
| TC-SEC-002 | NFR-021 | Security | Inspection | Design Review |
| TC-SEC-003 | NFR-022 | Security | Integration | Integration Test |
| TC-SEC-004 | NFR-023 | Security | Security | System Test |
| TC-SEC-005 | NFR-024 | Security | Security | System Test |
| TC-SEC-006 | NFR-022 | Security | Security | System Test |
| TC-REL-001 | NFR-010 | Reliability | Integration | Integration Test |
| TC-REL-002 | NFR-011 | Reliability | Integration | Integration Test |
| TC-REL-003 | NFR-012 | Reliability | Integration | Integration Test |
| TC-REL-004 | FR-043 | Reliability | System | System Test |
| TC-BLD-001 | NFR-040, NFR-041 | Build | Build | Build Verification |
| TC-BLD-002 | NFR-042 | Build | Static Analysis | Build Verification |
| TC-BLD-003 | NFR-043 | Build | Static Analysis | Build Verification |
| TC-BLD-004 | NFR-050 | Build | Portability | System Test |
| TC-BLD-005 | NFR-051 | Build | System | Acceptance |

---

**Total Test Cases: 80**  
**Requirements Covered: FR-001–FR-084, NFR-001–NFR-051, UIR-001–UIR-004, HIR-001–HIR-003, SIR-001–SIR-006, CIR-001–CIR-003**

---

*End of Document*
