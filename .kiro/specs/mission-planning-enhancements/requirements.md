# Requirements Document

## Introduction

This document defines the requirements for the **Mission Planning Enhancements** feature of Sidak GCS — a SvelteKit-based drone Ground Control Station for ArduPilot-compatible vehicles. The current mission planner allows operators to manually enter waypoints, configure MAVLink commands, and execute basic arm/takeoff/auto missions. This feature closes the gap between Sidak GCS and ArduPilot Mission Planner's documented mission planning capabilities, improving operational safety, efficiency, and alignment with ArduPilot standards.

The enhancements are grouped into ten capability areas, each mapped to a gap in the current `MissionPlan.svelte` + `missionPlanStore.ts` + `ManageMissionPlans.svelte` implementation.

---

## Glossary

- **Mission_Planner**: The Sidak GCS mission planning UI, consisting of `MissionPlan.svelte`, `ManageMissionPlans.svelte`, and their associated backend API routes.
- **Map_Component**: The `Map.svelte` Leaflet-based map component that renders waypoint markers and polylines.
- **FC**: Flight Controller — the ArduPilot-compatible autopilot connected via MAVLink over serial/UDP.
- **MAVLink**: The lightweight messaging protocol used between Sidak GCS and the FC.
- **Waypoint**: A single `MissionPlanItem` entry in the `missionPlanActionsStore` at index ≥ 1.
- **Home_Position**: The index-0 entry in `missionPlanActionsStore`, representing the arming/takeoff location.
- **GCS_DB**: The SQLite database accessed via `/api/mission/*` endpoints, used to persist mission plans on the GCS device.
- **FC_EEPROM**: Non-volatile memory on the FC that stores the uploaded mission plan, accessible via MAVLink `MISSION_ITEM_INT` messages.
- **Default_Alt**: A globally configured altitude value (in metres) applied to new waypoints when no explicit altitude is specified by the operator.
- **Altitude_Reference**: The reference frame for a waypoint altitude — one of `RELATIVE` (relative to home), `ABSOLUTE` (AMSL), or `TERRAIN` (AGL via terrain data).
- **Spline_Waypoint**: A `NAV_SPLINE_WAYPOINT` MAVLink command that instructs the FC to fly a smooth curved path through the waypoint instead of a straight-line approach.
- **Auto_Grid**: An automatically generated grid of parallel survey flight lines covering a user-defined polygon, used for mapping or photogrammetry missions.
- **Survey_Polygon**: A set of operator-placed vertices on the map defining the area to be covered by an Auto_Grid mission.
- **MIS_RESTART**: An ArduPilot parameter controlling whether a mission restarts from the beginning after completion (1 = restart, 0 = hold at last waypoint).
- **MIS_OPTIONS**: An ArduPilot parameter bitmask controlling mission behaviour options such as resuming after disarm.
- **Operator**: The authenticated GCS user commanding the drone.

---

## Requirements

### Requirement 1: Map-Click Waypoint Placement

**User Story:** As an Operator, I want to place waypoints by clicking on the map, so that I can quickly define mission routes without manually typing coordinates.

#### Acceptance Criteria

1. WHEN the Operator clicks on the Map_Component while a mission plan is active (index 0 exists), THE Mission_Planner SHALL add a new Waypoint at the clicked latitude and longitude.
2. WHEN a Waypoint is added via map click, THE Mission_Planner SHALL populate the waypoint's latitude and longitude fields from the click coordinates and apply the current Default_Alt to the waypoint's altitude field; IF Default_Alt is not set, THEN THE Mission_Planner SHALL apply an altitude of 0 meters to the waypoint's altitude field.
3. WHEN a Waypoint marker on the Map_Component is dragged to a new position, THE Mission_Planner SHALL update the corresponding waypoint's latitude and longitude in `missionPlanActionsStore` to the marker's new position.
4. WHEN the Operator drags a Waypoint marker, THE Map_Component SHALL update the connecting polylines on each drag-move event to reflect the marker's current position during the drag.
5. IF the Operator clicks on the map before a Home_Position (index 0) exists, THEN THE Mission_Planner SHALL display a warning notification indicating that a Home_Position must be set before adding waypoints, and the notification SHALL automatically dismiss after 5 seconds.
6. WHILE a waypoint drag is in progress, THE Map_Component SHALL display the current latitude and longitude of the dragged marker, each to 6 decimal places, as a tooltip rendered within 16 pixels of the marker.
7. IF the Operator attempts to add a Waypoint when the mission plan already contains 99 waypoints, THEN THE Mission_Planner SHALL reject the addition and display a notification indicating the maximum waypoint limit has been reached.

---

### Requirement 2: FC Mission Upload and Download

**User Story:** As an Operator, I want explicit "Write to FC" and "Read from FC" controls, so that I can reliably synchronise the mission between the GCS and the flight controller's non-volatile memory.

#### Acceptance Criteria

1. WHEN the Operator activates the "Write to FC" action, THE Mission_Planner SHALL upload all waypoints from the active mission plan store to the flight controller's non-volatile memory.
2. WHEN the FC upload completes successfully, THE Mission_Planner SHALL display a success notification confirming the number of waypoints written to the FC.
3. IF the FC upload fails because the flight controller does not acknowledge within 30 seconds, or the upload request returns an error response, THEN THE Mission_Planner SHALL display an error notification indicating the cause of the failure and SHALL NOT modify the locally stored mission plan.
4. WHEN the Operator activates the "Read from FC" action, THE Mission_Planner SHALL request the mission stored in the flight controller's non-volatile memory and replace the active mission plan store contents with the downloaded waypoints.
5. WHEN the FC download completes successfully, THE Mission_Planner SHALL display a notification showing the number of waypoints received from the FC.
6. IF the FC download fails because the flight controller does not respond within 30 seconds, returns an error, or sends zero waypoints when the stored count is greater than zero, THEN THE Mission_Planner SHALL display an error notification indicating the cause of the failure and SHALL preserve the existing active mission plan store contents without modification.
7. WHEN the Operator edits, adds, or removes a waypoint after the last successful FC upload or download, THE Mission_Planner SHALL set the sync status to `GCS_Ahead`.
8. WHEN a "Write to FC" operation completes successfully, THE Mission_Planner SHALL set the sync status to `Synced`.
9. WHEN a "Read from FC" operation completes successfully, THE Mission_Planner SHALL set the sync status to `Synced`.
10. WHILE a "Write to FC" or "Read from FC" operation is in progress, THE Mission_Planner SHALL disable the "Write to FC" and "Read from FC" controls until the operation completes or fails.

---

### Requirement 3: Home Position Display and Control

**User Story:** As an Operator, I want to see and configure the Home Position within the mission plan UI, so that I can verify the takeoff point before executing a mission.

#### Acceptance Criteria

1. THE Mission_Planner SHALL display the Home_Position (index 0 of `missionPlanActionsStore`) as a distinct row at the top of the waypoint list, differentiated from normal Waypoints by a dedicated home icon and the fixed label "Home".
2. WHEN a Home_Position exists, THE Map_Component SHALL render a dedicated home marker at the Home_Position's coordinates using a different icon type than the icons used for Waypoint markers.
3. WHEN the Operator activates the "Set Home to Current Location" action and `mavLocationStore` contains a valid latitude and longitude fix, THE Mission_Planner SHALL update the Home_Position's latitude and longitude to the current values from `mavLocationStore`.
4. IF the Operator activates the "Set Home to Current Location" action and `mavLocationStore` does not contain a valid location fix, THEN THE Mission_Planner SHALL display an error message indicating that the current location is unavailable and leave the Home_Position unchanged.
5. WHEN the Operator edits the Home_Position's latitude, longitude, or altitude fields, THE Mission_Planner SHALL update index 0 of `missionPlanActionsStore` with the new value.
6. WHEN the Operator edits the Home_Position's latitude or longitude fields, THE Map_Component SHALL re-render the home marker at the updated coordinates.
7. IF the Operator attempts to delete the Home_Position row, THEN THE Mission_Planner SHALL display a confirmation dialog warning that confirming will clear the entire mission plan, and SHALL take no removal action until the Operator responds to the dialog.
8. IF the Operator confirms deletion in the Home_Position confirmation dialog, THEN THE Mission_Planner SHALL remove all entries from `missionPlanActionsStore` and remove all markers from the Map_Component.
9. IF the Operator cancels deletion in the Home_Position confirmation dialog, THEN THE Mission_Planner SHALL dismiss the dialog and leave `missionPlanActionsStore` unchanged.

---

### Requirement 4: Altitude Reference Mode Selector

**User Story:** As an Operator, I want to select the altitude reference mode for each waypoint, so that the FC interprets altitudes correctly relative to the intended datum.

#### Acceptance Criteria

1. THE Mission_Planner SHALL provide an altitude reference selector on each Waypoint row with the options `RELATIVE`, `ABSOLUTE`, and `TERRAIN`.
2. WHEN an altitude reference mode is selected for a Waypoint, THE Mission_Planner SHALL store the selected mode in the waypoint's `frame` field within `missionPlanActionsStore` using the corresponding MAVLink frame integer (`MAV_FRAME_GLOBAL_RELATIVE_ALT` = 3, `MAV_FRAME_GLOBAL` = 0, `MAV_FRAME_GLOBAL_TERRAIN_ALT` = 10).
3. WHEN a new Waypoint is created (via map click or the "Add Action" button), THE Mission_Planner SHALL default its altitude reference to `RELATIVE` by setting `frame = 3` in `missionPlanActionsStore`.
4. WHEN a mission is uploaded to the FC, THE Mission_Planner SHALL include the `frame` field value for each Waypoint in the upload payload without modification.
5. WHEN the Operator selects `TERRAIN` as the altitude reference for any Waypoint, THE Mission_Planner SHALL display a warning notification stating that terrain-following requires FC terrain data to be configured.
6. IF writing the updated `frame` value to `missionPlanActionsStore` fails, THEN THE Mission_Planner SHALL revert the altitude reference selector to its previous value and display an error notification.

---

### Requirement 5: Auto-Grid / Survey Pattern Generation

**User Story:** As an Operator, I want to define a polygon on the map and have the system generate a survey grid automatically, so that I can plan area-coverage missions without manually placing dozens of waypoints.

#### Acceptance Criteria

1. WHEN the Operator activates the "Survey Grid" tool, THE Map_Component SHALL enter polygon-drawing mode, allowing the Operator to place vertices by clicking on the map, and SHALL complete the polygon when the Operator double-clicks the final vertex or clicks the first vertex.
2. WHEN the Operator completes the Survey_Polygon (minimum 3 vertices), THE Mission_Planner SHALL compute a grid of parallel flight lines covering the polygon at a user-specified line spacing (in metres), including turn waypoints at each line end, and SHALL replace any previously computed Auto_Grid for the same polygon if re-generation is triggered.
3. WHEN generating the Auto_Grid, THE Mission_Planner SHALL accept the following inputs: line spacing (1–500 metres), flight angle (0–359 degrees), and entry/exit direction (first or last vertex).
4. WHEN the Auto_Grid is generated, THE Mission_Planner SHALL append the resulting waypoints to `missionPlanActionsStore`, applying the current Default_Alt to all generated Waypoints.
5. WHEN the Auto_Grid is generated, THE Map_Component SHALL render the survey grid lines and resulting Waypoints on the map for Operator review before upload.
6. IF the computed Auto_Grid would produce more than 650 waypoints, THEN THE Mission_Planner SHALL display a warning stating the waypoint count exceeds the FC limit, and SHALL require the Operator to confirm before adding the waypoints; IF the Operator declines the confirmation, THEN THE Mission_Planner SHALL discard the computed grid without modifying `missionPlanActionsStore`.
7. WHEN the Operator cancels polygon drawing before completing the polygon, THE Map_Component SHALL remove all partially placed vertices and exit polygon-drawing mode without modifying `missionPlanActionsStore`.
8. IF the completed Survey_Polygon has zero area or fewer than 3 non-collinear vertices, THEN THE Mission_Planner SHALL display an error notification, discard the polygon, and return to polygon-drawing mode.

---

### Requirement 6: Global Default Altitude

**User Story:** As an Operator, I want to set a global default altitude that is automatically applied to new waypoints, so that I do not have to type the same altitude value repeatedly.

#### Acceptance Criteria

1. THE Mission_Planner SHALL provide a "Default Alt" numeric input field in the mission toolbar, accepting integer or decimal values from 1 to 500 metres inclusive.
2. WHEN the Operator changes the Default_Alt value to a value within the 1–500 metre range, THE Mission_Planner SHALL persist the new value to browser `localStorage` under the key `missionDefaultAlt` and pre-fill the altitude field of all subsequently created Waypoints with that value within the same session.
3. WHEN a new Waypoint is created via map click or the "Add Action" button, THE Mission_Planner SHALL pre-fill the waypoint's altitude field with the current Default_Alt value shown in the toolbar.
4. WHEN the Mission_Planner is initialised and a `missionDefaultAlt` entry exists in `localStorage` with a value within the 1–500 metre range, THE Mission_Planner SHALL restore the Default_Alt field to that stored value; IF the stored value is outside the 1–500 metre range or is non-numeric, THEN THE Mission_Planner SHALL set the Default_Alt field to 50 metres and display an inline validation message adjacent to the Default_Alt field indicating the stored value was invalid, clearing the message once the Operator modifies the field.
5. IF the Operator moves focus away from the Default_Alt field and the entered value is outside the 1–500 metre range or is non-numeric, THEN THE Mission_Planner SHALL reset the field to the nearest boundary value (1 if below, 500 if above) and display an inline validation message adjacent to the Default_Alt field indicating the valid range; THE Mission_Planner SHALL clear the inline validation message when the field value is within the 1–500 metre range.
6. WHEN the Mission_Planner is initialised and no `missionDefaultAlt` entry exists in `localStorage`, THE Mission_Planner SHALL set the Default_Alt field to a default value of 50 metres.

---

### Requirement 7: Waypoint Distance Measurement

**User Story:** As an Operator, I want to see the distance between consecutive waypoints, so that I can estimate flight time and verify the mission layout before upload.

#### Acceptance Criteria

1. THE Mission_Planner SHALL display the great-circle distance in metres, rounded to the nearest whole metre, between each consecutive pair of Waypoints alongside the connecting row separator in the waypoint list.
2. WHEN a Waypoint's latitude or longitude is changed, THE Mission_Planner SHALL recalculate and update the distance displayed for all segments connected to that Waypoint within 200 milliseconds.
3. IF the mission contains fewer than two Waypoints, THEN THE Mission_Planner SHALL display a total mission distance of 0 metres in the mission toolbar.
4. THE Mission_Planner SHALL display the total mission distance, rounded to the nearest whole metre, as the sum of all segment distances in the mission toolbar, and SHALL update this total within 200 milliseconds of any Waypoint addition, removal, or coordinate change.
5. WHEN the Operator hovers over a polyline on the Map_Component, THE Map_Component SHALL display a tooltip showing the distance of that segment in metres, rounded to the nearest whole metre.
6. IF a Waypoint's latitude value is outside the range −90.0 to 90.0 degrees or longitude value is outside the range −180.0 to 180.0 degrees, THEN THE Mission_Planner SHALL not calculate a distance for any segment connected to that Waypoint and SHALL indicate that the segment distance is unavailable.

---

### Requirement 8: Mission Size Validation

**User Story:** As an Operator, I want the GCS to warn me when my mission exceeds FC waypoint limits, so that I can reduce the plan before uploading to prevent partial or failed uploads.

#### Acceptance Criteria

1. THE Mission_Planner SHALL display a waypoint counter in the mission toolbar showing the current Waypoint count and the FC limit in the format "[current] / [limit] waypoints", updated within 500 milliseconds of any Waypoint addition or deletion.
2. WHEN the Waypoint count reaches or exceeds 586 and remains below 651, THE Mission_Planner SHALL display a persistent yellow warning indicator in the mission toolbar that remains visible until the Waypoint count drops below 586 or the mission is cleared.
3. IF the Operator attempts to add a Waypoint when the current Waypoint count is 650 or greater, THEN THE Mission_Planner SHALL reject the addition, leave the mission plan unchanged, and display an error notification indicating the FC limit of 650 waypoints has been reached.
4. IF the Operator attempts to upload a mission when the Waypoint count exceeds 650, THEN THE Mission_Planner SHALL cancel the upload before any data is transmitted to the FC, leave the FC mission storage unchanged, and display an error notification stating the current Waypoint count and the FC limit of 650.
5. THE Mission_Planner SHALL enforce the 650-waypoint limit by default without requiring any Operator configuration, applying this limit from the first Waypoint addition in every session.
6. WHEN the Waypoint count that previously reached or exceeded 586 drops below 586, THE Mission_Planner SHALL remove the yellow warning indicator from the mission toolbar.

---

### Requirement 9: Mission Reset / Rewind Controls

**User Story:** As an Operator, I want to expose MIS_RESTART and MIS_OPTIONS parameters in the mission planner, so that I can control whether the mission restarts after completion without navigating to the full parameters page.

#### Acceptance Criteria

1. THE Mission_Planner SHALL provide a "Mission Restart" toggle that reads and writes the `MIS_RESTART` FC parameter, where a value of 1 means restart on completion and 0 means hold at the last waypoint.
2. WHEN the Mission_Planner is opened and the FC is connected, THE Mission_Planner SHALL reflect the current `MIS_RESTART` parameter value in the "Mission Restart" toggle state; IF the parameter is absent, THEN the toggle SHALL default to the off (0) state.
3. WHEN the Operator changes the "Mission Restart" toggle and the write succeeds, THE Mission_Planner SHALL display a success notification that automatically dismisses after 5 seconds confirming the parameter was updated.
4. THE Mission_Planner SHALL provide a "Continue after Disarm" toggle that reads and writes bit 0 of the `MIS_OPTIONS` FC parameter, preserving all other bits of the bitmask unchanged.
5. WHEN the Operator changes the "Continue after Disarm" toggle and the write succeeds, THE Mission_Planner SHALL display a success notification that automatically dismisses after 5 seconds confirming the change.
6. IF the FC is not connected when the Operator attempts to change either toggle, THEN THE Mission_Planner SHALL display an error notification and SHALL revert the toggle to the state held immediately before the change attempt.
7. IF the FC is connected but the parameter write fails, THEN THE Mission_Planner SHALL display an error notification and SHALL revert the toggle to the state held immediately before the change attempt.

---

### Requirement 10: Visual Distinction for Spline Waypoints

**User Story:** As an Operator, I want spline waypoints to be visually distinct from normal waypoints on the map and in the waypoint list, so that I can immediately identify the flight path curvature of my mission.

#### Acceptance Criteria

1. WHEN a Waypoint has type `NAV_SPLINE_WAYPOINT`, THE Map_Component SHALL render its marker using a spline-specific icon, visually distinct from the icon used for `NAV_WAYPOINT` markers.
2. WHEN a Waypoint has type `NAV_SPLINE_WAYPOINT`, THE Mission_Planner SHALL render the connecting polylines between it and its adjacent Waypoints as dashed lines with an 8px dash and 6px gap in orange, distinct from the solid red lines used for straight-line waypoints.
3. WHEN the Operator changes a Waypoint's type to or from `NAV_SPLINE_WAYPOINT`, THE Map_Component SHALL update the marker icon and polyline style within 100 milliseconds without requiring a page reload.
4. WHEN a `NAV_SPLINE_WAYPOINT` Waypoint row is displayed in the waypoint list, THE Mission_Planner SHALL render a "Spline" badge immediately to the right of the action type selector.
