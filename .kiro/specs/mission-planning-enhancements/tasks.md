# Implementation Plan: Mission Planning Enhancements

## Overview

Extends the existing SvelteKit + Leaflet + MAVLink GCS with ten capability areas: map-click waypoint placement (with drag, tooltip, and home-guard), FC mission upload/download with sync status, home position display and control, altitude reference mode selector, auto-grid survey generation, global default altitude, waypoint distance measurement, mission size validation, mission reset/rewind FC parameter controls, and visual distinction for spline waypoints. All work builds on existing stores, components, and utilities — no new frameworks.

---

## Tasks

- [ ] 1. Extend stores and add utility modules
  - [ ] 1.1 Add `frame`, `fcSyncStatusStore`, `defaultAltStore`, and waypoint-limit constants to `missionPlanStore.ts`
    - Add optional `frame?: number | null` field to `MissionPlanItem` interface
    - Export `FcSyncStatus` type and `fcSyncStatusStore` writable (initial value `'GCS_Ahead'`)
    - Export `defaultAltStore` writable (initial value `50`, restore from `localStorage` key `missionDefaultAlt` on module load, fallback to `50` for invalid/out-of-range values)
    - Export `FC_WAYPOINT_LIMIT = 650` and `FC_WAYPOINT_WARNING_THRESHOLD = 586` constants
    - Wire a `missionPlanActionsStore.subscribe` side-effect that sets `fcSyncStatusStore` to `'GCS_Ahead'` on any change (the upload/download handlers will override this to `'Synced'`)
    - _Requirements: 2.7, 4.1, 4.2, 4.3, 6.1, 6.2, 6.4, 8.1, 8.3_

  - [ ] 1.2 Create `src/lib/utils/missionParams.ts`
    - Implement and export `setBit0(currentValue: number, enable: boolean): number`
    - Implement and export `getBit0(value: number): boolean`
    - _Requirements: 9.4_

  - [ ] 1.3 Create `src/lib/utils/surveyGrid.ts`
    - Define and export `SurveyGridParams` and `SurveyGridResult` interfaces
    - Implement and export `generateSurveyGrid(params: SurveyGridParams): SurveyGridResult`
    - Algorithm: rotate bounding box to `angleRad`, sweep boustrophedon parallel lines at `spacingM` intervals, clip each line to the polygon, rotate back to geographic coordinates; alternate sweep direction; collect turn waypoints at each line end
    - Return `{ waypoints, lineCount }`; empty `waypoints` if polygon has < 3 non-collinear vertices or zero area
    - _Requirements: 5.2, 5.3, 5.8_

  - [ ] 1.4 Write unit tests for `missionParams.ts`
    - `setBit0(0b1010, true)` → `0b1011`
    - `setBit0(0b1011, false)` → `0b1010`
    - `getBit0(0b1001)` → `true`
    - `getBit0(0b1000)` → `false`
    - _Requirements: 9.4_

  - [ ] 1.5 Write unit tests for `surveyGrid.ts`
    - Triangle polygon with known coverage produces non-empty waypoints
    - `spacingM = 1` produces more waypoints than `spacingM = 100` for the same polygon
    - Spacing wider than polygon width produces exactly two waypoints
    - Grid > 650 waypoints is detected (lineCount check)
    - _Requirements: 5.2, 5.3_

- [ ] 2. Checkpoint — Ensure store extensions compile and utility unit tests pass
  - Run `npx svelte-check` and `npx vitest --run` to confirm no type errors or failing tests.

- [ ] 3. Implement `MissionPlan.svelte` toolbar enhancements
  - [ ] 3.1 Add Default Alt input to the mission toolbar
    - Import and bind `defaultAltStore`; render a numeric input (1–500 m) in the toolbar
    - On blur: clamp to boundary value, persist valid values to `localStorage['missionDefaultAlt']`, show/clear an inline validation message
    - On init: load from `localStorage`; if invalid, set to 50 and show validation message
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6_

  - [ ] 3.2 Add waypoint counter badge and FC sync status badge to the toolbar
    - Counter badge: `"${count} / 650 waypoints"` derived reactively from `missionCountStore`; apply yellow styling when `count >= FC_WAYPOINT_WARNING_THRESHOLD`; remove yellow when count drops below threshold
    - Sync status badge: coloured dot + label driven by `fcSyncStatusStore` (`Synced` = green, `GCS_Ahead` = amber, `FC_Ahead` = blue)
    - _Requirements: 2.7, 2.8, 2.9, 8.1, 8.2, 8.6_

  - [ ] 3.3 Add total mission distance display to the toolbar
    - Compute segment distances reactively from `missionPlanActionsStore` using `haversineDistanceM`
    - Sum all segment distances for the total; display rounded to nearest whole metre
    - Show `0 m` when fewer than two waypoints exist
    - Skip segments where either waypoint has `lat` outside [−90, 90] or `lon` outside [−180, 180]; mark those segments as "unavailable"
    - Update within 200 ms of any waypoint coordinate change (Svelte reactivity handles this automatically)
    - _Requirements: 7.3, 7.4, 7.6_

  - [ ] 3.4 Add Home Position row (index 0) to the waypoint list
    - Render index-0 entry as a dedicated "Home" row at the top with a house icon and fixed label
    - Show editable lat, lon, alt fields that call `updateLat` / `updateLon` / `updateAltitude` for index 0
    - Add "Set Home to Current Location" button: reads `mavLocationStore`; updates index 0 lat/lon; shows error notification if `mavLocationStore` is null/zero
    - Guard the delete action on index 0: show confirmation dialog warning that all waypoints will be cleared; on confirm call `removeAllActions`; on cancel dismiss dialog unchanged
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.7, 3.8, 3.9_

  - [ ] 3.5 Add altitude reference mode selector to each waypoint row
    - Add a `<select>` per waypoint row with options `RELATIVE` (3), `ABSOLUTE` (0), `TERRAIN` (10)
    - On change, write the corresponding MAVLink frame integer to `actions[index].frame` and call `missionPlanActionsStore.set`
    - Default newly created waypoints to `frame = 3`
    - Show warning notification on `TERRAIN` selection
    - On store write failure, revert selector and show error notification
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

  - [ ] 3.6 Add segment distance display to the waypoint list rows
    - Render computed segment distance (in metres, rounded) alongside the separator between consecutive waypoint rows
    - Mark segment as "—" when either adjacent waypoint has out-of-range coordinates
    - _Requirements: 7.1, 7.2, 7.6_

  - [ ] 3.7 Add "Spline" badge to `NAV_SPLINE_WAYPOINT` rows
    - Render a small "Spline" badge immediately to the right of the action type selector when `actions[index].type === 'NAV_SPLINE_WAYPOINT'`
    - _Requirements: 10.4_

  - [ ] 3.8 Enforce 650-waypoint cap in `addAction` and map-click handler
    - In `addAction`: if `Object.keys(actions).length >= FC_WAYPOINT_LIMIT + 1` (index 0 is home), reject and show error notification
    - Wire same guard into the Map.svelte click handler (via store subscription or exported helper)
    - _Requirements: 8.3_

- [ ] 4. Checkpoint — Ensure toolbar and row enhancements render correctly
  - Run `npx svelte-check` to confirm no type errors in updated components.

- [ ] 5. Implement `Map.svelte` enhancements
  - [ ] 5.1 Extend `addPolyline` to support dashed orange style for spline segments
    - Update `addPolyline` signature to accept `opts?: { dashed?: boolean; color?: string }`
    - When drawing polylines in `updateMarkersAndPolylines`, check if either endpoint waypoint has type `NAV_SPLINE_WAYPOINT`; if so, pass `{ dashed: true, color: 'orange' }` (8px dash, 6px gap via Leaflet `dashArray: '8, 6'`)
    - Update within 100 ms of type change (Svelte reactivity)
    - _Requirements: 10.2, 10.3_

  - [ ] 5.2 Render Home Position (index 0) with a dedicated DivIcon
    - In `updateMap`, detect `index === 0` and use a `L.divIcon` with a house SVG instead of the standard waypoint icon
    - Re-render the home marker when index-0 lat/lon fields are edited
    - _Requirements: 3.2, 3.6_

  - [ ] 5.3 Add drag support to waypoint markers with live polyline update and tooltip
    - On marker creation (index ≠ 0), set `draggable: true`
    - On `dragmove`: update `actions[index].lat/lon`, call `missionPlanActionsStore.set`, call `updateMarkersAndPolylines()`, and update/show a Leaflet tooltip displaying `lat` and `lng` each to 6 decimal places within 16 px of the marker
    - On `dragend`: hide tooltip, persist final coordinates to store
    - _Requirements: 1.3, 1.4, 1.6_

  - [ ] 5.4 Guard map-click handler with home-position check and waypoint limit
    - Before adding a waypoint on map click: check `Object.keys(actions).length > 1` (home + at least one waypoint definition already exists at index 0); if index 0 is absent, show 5-second auto-dismiss warning notification
    - Apply `defaultAltStore` value to the new waypoint's `alt` field; if `defaultAltStore` is null/0 apply 0
    - Apply `frame = 3` to the new waypoint
    - Reject click if `Object.keys(actions).length > FC_WAYPOINT_LIMIT` and show error notification
    - _Requirements: 1.1, 1.2, 1.5, 1.7, 4.3, 6.3_

  - [ ] 5.5 Add survey polygon-drawing mode to `Map.svelte`
    - Add `export let surveyMode: boolean = false` prop and `polygonVertices: L.LatLng[]` local state
    - When `surveyMode` is true, redirect Leaflet click events to accumulate `polygonVertices` and render a dashed preview polygon (`polygonPreviewLayer`)
    - Polygon completes on double-click or click on first vertex (snap ≤ 20 px)
    - On cancel (Escape key or `onCancel` callback), remove `polygonPreviewLayer`, clear `polygonVertices`, exit survey mode
    - On complete with ≥ 3 vertices: emit the polygon to `SurveyGridPanel.svelte` via a callback prop
    - On complete with < 3 non-collinear vertices or zero area: show error notification, return to polygon-drawing mode
    - _Requirements: 5.1, 5.7, 5.8_

  - [ ] 5.6 Render survey grid preview lines and waypoints on the map
    - After `generateSurveyGrid` returns results, render grid lines as a `L.LayerGroup` (`gridPreviewLayer`) on the map
    - Remove `gridPreviewLayer` when survey mode exits or grid is confirmed/cancelled
    - _Requirements: 5.5_

  - [ ] 5.7 Write property test for map-click waypoint coordinate storage (Property 1)
    - **Property 1: Map-click waypoint stores correct coordinates**
    - **Validates: Requirements 1.1, 1.2**
    - Use `fast-check` to generate arbitrary valid lat/lng pairs and `Default_Alt` values; assert resulting store entry matches
    - _Tag: Feature: mission-planning-enhancements, Property 1_

  - [ ] 5.8 Write property test for drag-update coordinate consistency (Property 2)
    - **Property 2: Drag updates store coordinates**
    - **Validates: Requirements 1.3**
    - Use `fast-check` to generate arbitrary waypoint index and new lat/lng; assert store entry equals drag-end coordinates
    - _Tag: Feature: mission-planning-enhancements, Property 2_

  - [ ] 5.9 Write property test for survey grid containment (Property 11)
    - **Property 11: Survey grid waypoints lie within the survey polygon**
    - **Validates: Requirements 5.2**
    - Use `fast-check` to generate polygons (≥ 3 non-collinear vertices) and spacing values in [1, 500]; assert every generated waypoint is within or on the polygon boundary
    - _Tag: Feature: mission-planning-enhancements, Property 11_

- [ ] 6. Create `SurveyGridPanel.svelte` component
  - [ ] 6.1 Implement `SurveyGridPanel.svelte` floating panel
    - Render as an overlay on `Map.svelte` when `surveyMode` is active
    - Inputs: line spacing (1–500 m, default 50), flight angle (0–359°, default 0), entry vertex (`first` / `last`, default `first`)
    - "Confirm" button: calls `generateSurveyGrid` with the survey polygon and inputs; if result > 650 waypoints shows confirmation dialog (proceed / discard); on proceed appends waypoints to `missionPlanActionsStore` with current `defaultAltStore` and `frame = 3`; exits survey mode
    - "Cancel" button: calls `onCancel` prop; exits survey mode without modifying store
    - _Requirements: 5.2, 5.3, 5.4, 5.6, 5.7_

- [ ] 7. Checkpoint — Ensure map enhancements and survey panel compile and behave correctly
  - Run `npx svelte-check` and confirm no regressions.

- [ ] 8. Implement `MissionPlanSettings.svelte` enhancements
  - [ ] 8.1 Add "Write to FC" and "Read from FC" buttons with sync guard
    - Import `loadMission` and a new `readMissionFromFC` helper (or inline the fetch)
    - "Write to FC": if waypoint count > 650, cancel and show error notification; otherwise call `loadMission(actions)` with a 30-second timeout; on success set `fcSyncStatusStore` to `'Synced'` and show success notification with waypoint count; on failure show error notification; leave local store unchanged on failure
    - "Read from FC": request mission from FC; on success replace `missionPlanActionsStore` with downloaded waypoints and set `fcSyncStatusStore` to `'Synced'`; show notification with received count; on zero-count or error show error notification and preserve existing store
    - Disable both buttons while an operation is in progress
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8, 2.9, 2.10, 8.4_

  - [ ] 8.2 Add "Survey Grid" toggle button
    - Toggle `surveyMode` prop on the `Map.svelte` instance (via a shared store `surveyModeStore` or prop binding)
    - _Requirements: 5.1_

  - [ ] 8.3 Add "Mission Restart" toggle (MIS_RESTART)
    - On mount/FC connect, read `mavlinkParamStore['MIS_RESTART']`; reflect current value in toggle state; default to off if absent
    - On toggle: call `writeParam('MIS_RESTART', newValue, type)`; on success show 5-second auto-dismiss notification; on failure (FC disconnected or write error) revert toggle and show error notification
    - _Requirements: 9.1, 9.2, 9.3, 9.6, 9.7_

  - [ ] 8.4 Add "Continue after Disarm" toggle (MIS_OPTIONS bit 0)
    - On mount/FC connect, read `mavlinkParamStore['MIS_OPTIONS']`; use `getBit0` to derive toggle state
    - On toggle: use `setBit0(currentValue, newState)` to produce new bitmask; call `writeParam('MIS_OPTIONS', newBitmask, type)`; on success show 5-second auto-dismiss notification; on failure revert toggle and show error notification
    - _Requirements: 9.4, 9.5, 9.6, 9.7_

  - [ ] 8.5 Write property test for MIS_OPTIONS bit 0 manipulation preserves other bits (Property 20)
    - **Property 20: MIS_OPTIONS bit 0 manipulation preserves other bits**
    - **Validates: Requirements 9.4**
    - Use `fast-check` to generate arbitrary 16-bit integers and boolean enable values; assert `result & 1 === b ? 1 : 0` and `result & ~1 === v & ~1`
    - _Tag: Feature: mission-planning-enhancements, Property 20_

  - [ ] 8.6 Write property test for failed FC parameter write reverts toggle (Property 21)
    - **Property 21: Failed FC parameter write reverts toggle state**
    - **Validates: Requirements 9.6, 9.7**
    - Mock `writeParam` to throw; assert toggle reverts to its pre-change state for both `MIS_RESTART` and `MIS_OPTIONS`
    - _Tag: Feature: mission-planning-enhancements, Property 21_

- [ ] 9. Checkpoint — Ensure settings enhancements compile and FC sync flow is correct
  - Run `npx svelte-check` and `npx vitest --run` to confirm no regressions.

- [ ] 10. Add property-based tests for mission plan logic and validation
  - [ ] 10.1 Write property test for successful FC upload notification contains waypoint count (Property 3)
    - **Property 3: Successful FC upload notification contains waypoint count**
    - **Validates: Requirements 2.2**
    - Mock `loadMission` to succeed; assert success notification text includes the waypoint count N
    - _Tag: Feature: mission-planning-enhancements, Property 3_

  - [ ] 10.2 Write property test for failed FC upload preserves local store (Property 4)
    - **Property 4: Failed FC upload preserves local store**
    - **Validates: Requirements 2.3**
    - Mock `loadMission` to throw; assert `missionPlanActionsStore` contents are byte-for-byte identical before and after
    - _Tag: Feature: mission-planning-enhancements, Property 4_

  - [ ] 10.3 Write property test for edit after sync transitions to GCS_Ahead (Property 5)
    - **Property 5: Edit after sync transitions to GCS_Ahead**
    - **Validates: Requirements 2.7**
    - Set `fcSyncStatusStore` to `'Synced'`; perform any mutation to `missionPlanActionsStore`; assert `fcSyncStatusStore` is `'GCS_Ahead'`
    - _Tag: Feature: mission-planning-enhancements, Property 5_

  - [ ] 10.4 Write property test for successful FC operation sets status to Synced (Property 6)
    - **Property 6: Successful FC operation sets status to Synced**
    - **Validates: Requirements 2.8, 2.9**
    - Mock both write and read FC operations to succeed; assert `fcSyncStatusStore` is `'Synced'` after each
    - _Tag: Feature: mission-planning-enhancements, Property 6_

  - [ ] 10.5 Write property test for Set Home copies mavLocation exactly (Property 7)
    - **Property 7: Set Home copies mavLocation exactly**
    - **Validates: Requirements 3.3**
    - Use `fast-check` to generate valid `{ lat, lng }` values; set `mavLocationStore` to them; activate "Set Home to Current Location"; assert `missionPlanActionsStore[0].lat` and `.lon` equal the generated values
    - _Tag: Feature: mission-planning-enhancements, Property 7_

  - [ ] 10.6 Write property test for Home field edits reflected in store (Property 8)
    - **Property 8: Home field edits are reflected in the store**
    - **Validates: Requirements 3.5**
    - Use `fast-check` to generate numeric lat/lon/alt values; simulate input change; assert `missionPlanActionsStore[0]` contains the new values
    - _Tag: Feature: mission-planning-enhancements, Property 8_

  - [ ] 10.7 Write property test for altitude frame selector maps to correct MAVLink integer (Property 9)
    - **Property 9: Altitude frame selector maps to correct MAVLink integer**
    - **Validates: Requirements 4.1, 4.2**
    - Parametric test: `['RELATIVE', 3], ['ABSOLUTE', 0], ['TERRAIN', 10]`; assert `frameToMavlink(mode) === expected`
    - _Tag: Feature: mission-planning-enhancements, Property 9_

  - [ ] 10.8 Write property test for new waypoints default to RELATIVE frame (Property 10)
    - **Property 10: New waypoints default to RELATIVE frame**
    - **Validates: Requirements 4.3**
    - Simulate both map-click and "Add Action" waypoint creation; assert `frame === 3` on the resulting store entry
    - _Tag: Feature: mission-planning-enhancements, Property 10_

  - [ ] 10.9 Write property test for default alt persistence and restoration (Property 12)
    - **Property 12: Default alt is persisted and restored**
    - **Validates: Requirements 6.2, 6.4**
    - Use `fast-check` to generate values in [1, 500]; set `defaultAltStore`, assert `localStorage['missionDefaultAlt']` equals the value; re-init store, assert it restores to the same value
    - _Tag: Feature: mission-planning-enhancements, Property 12_

  - [ ] 10.10 Write property test for new waypoints use current default altitude (Property 13)
    - **Property 13: New waypoints use current default altitude**
    - **Validates: Requirements 6.2, 6.3**
    - Use `fast-check` to generate values in [1, 500]; set `defaultAltStore`; create waypoint; assert `alt === v`
    - _Tag: Feature: mission-planning-enhancements, Property 13_

  - [ ] 10.11 Write property test for invalid stored default altitude resolves to 50 m (Property 14)
    - **Property 14: Invalid stored default altitude resolves to 50 m**
    - **Validates: Requirements 6.4**
    - Use `fast-check` to generate values outside [1, 500] or non-numeric strings; set `localStorage['missionDefaultAlt']`; re-init store; assert `defaultAltStore` is `50`
    - _Tag: Feature: mission-planning-enhancements, Property 14_

  - [ ] 10.12 Write property test for segment distance matches Haversine formula (Property 15)
    - **Property 15: Segment distance matches Haversine formula**
    - **Validates: Requirements 7.1**
    - Use `fast-check` to generate consecutive waypoint coordinate pairs; assert displayed distance equals `Math.round(haversineDistanceM(lat1, lon1, lat2, lon2))`
    - _Tag: Feature: mission-planning-enhancements, Property 15_

  - [ ] 10.13 Write property test for total distance equals sum of segment distances (Property 16)
    - **Property 16: Total distance equals sum of segment distances**
    - **Validates: Requirements 7.4**
    - Use `fast-check` to generate mission plans with N ≥ 2 waypoints; assert total equals sum of all (N − 1) segment distances
    - _Tag: Feature: mission-planning-enhancements, Property 16_

  - [ ] 10.14 Write property test for out-of-range coordinates produce unavailable distance (Property 17)
    - **Property 17: Out-of-range coordinates produce unavailable distance**
    - **Validates: Requirements 7.6**
    - Use `fast-check` to generate `lat` outside [−90, 90] or `lon` outside [−180, 180]; assert connected segment distances are marked unavailable
    - _Tag: Feature: mission-planning-enhancements, Property 17_

  - [ ] 10.15 Write property test for waypoint counter format is always correct (Property 18)
    - **Property 18: Waypoint counter format is always correct**
    - **Validates: Requirements 8.1**
    - Use `fast-check` to generate N in [0, 650]; assert counter text equals `"${N} / 650 waypoints"`
    - _Tag: Feature: mission-planning-enhancements, Property 18_

  - [ ] 10.16 Write property test for store count never exceeds 650 (Property 19)
    - **Property 19: Store count never exceeds 650**
    - **Validates: Requirements 8.3**
    - Attempt to add waypoints beyond 650; assert `missionPlanActionsStore` entry count remains at 651 (index 0 home + 650 waypoints) and no new entry is appended
    - _Tag: Feature: mission-planning-enhancements, Property 19_

- [ ] 11. Final checkpoint — Ensure all tests pass
  - Run `npx vitest --run` and `npx svelte-check`; confirm all property tests, unit tests, and type checks pass. Ask the user if any questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- `fast-check` must be added as a dev dependency: `npm install --save-dev fast-check@^3`
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical milestones
- Property tests validate universal correctness properties; unit tests validate specific examples and edge cases
- The `frame` field defaults to `null` on existing missions and is treated as `3` (RELATIVE) at read time for backward compatibility

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "1.5"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "5.1", "5.2"] },
    { "id": 3, "tasks": ["5.3", "5.4", "5.5", "6.1", "8.1", "8.2", "8.3", "8.4"] },
    { "id": 4, "tasks": ["5.6", "5.7", "5.8", "5.9", "8.5", "8.6"] },
    { "id": 5, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "10.6", "10.7", "10.8", "10.9", "10.10", "10.11", "10.12", "10.13", "10.14", "10.15", "10.16"] }
  ]
}
```
