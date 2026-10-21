<script lang="ts">
  import {
    missionPlanTitleStore,
    missionCountStore,
    missionIndexStore,
    missionCompleteStore
  } from '../stores/missionPlanStore';
  import {
    mavModelStore,
    mavTypeStore,
    mavStateStore,
    mavModeStore,
    mavAltitudeStore,
    mavSpeedStore,
    mavBatteryStore,
    mavArmedStateStore,
    mavLocationStore,
    mavlinkParamStore,
    mavSatelliteStore
  } from '../stores/mavlinkStore';
  import { darkModeStore, primaryColorStore, secondaryColorStore, tertiaryColorStore } from '../stores/customizationStore';
  import { markersStore } from '../stores/mapStore';
  import { get } from 'svelte/store';

  import Modal from './Modal.svelte';
  import Notification from './Notification.svelte';
  import type { LatLng } from 'leaflet';
  import { sendCommand, writeParam } from '$lib/api/mavlink';
  import { encodeParameterValue } from '$lib/utils/parameters';

  // ── Flight Time ───────────────────────────────────────────────────────────
  let flightStartTime: number | null = null;
  let flightElapsedSec = 0;
  let flightTimerInterval: ReturnType<typeof setInterval> | null = null;

  function formatFlightTime(secs: number): string {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  // Start timer on arm, stop on disarm
  $: if ($mavArmedStateStore && !flightStartTime) {
    flightStartTime = Date.now();
    flightTimerInterval = setInterval(() => {
      flightElapsedSec = Math.floor((Date.now() - flightStartTime!) / 1000);
    }, 1000);
  } else if (!$mavArmedStateStore && flightStartTime) {
    if (flightTimerInterval) { clearInterval(flightTimerInterval); flightTimerInterval = null; }
    flightStartTime = null;
  }

  // Estimate remaining flight time from battery consumption rate
  function estimateRemainingTime(battery: number | null, elapsedSec: number): string {
    if (battery === null || battery <= 0 || elapsedSec < 30) return '--:--:--';
    const consumed = 100 - battery;
    if (consumed <= 0) return '--:--:--';
    const secPerPercent = elapsedSec / consumed;
    return formatFlightTime(Math.floor(battery * secPerPercent));
  }

  export let mavModel: string = get(mavModelStore);
  export let mavType: string = get(mavTypeStore);
  export let isArmed: boolean = get(mavArmedStateStore)
  export let speed: number = get(mavSpeedStore);
  export let altitude: number = get(mavAltitudeStore);
  export let systemState: string = get(mavStateStore);
  export let batteryStatus: number | null = get(mavBatteryStore);
  export let mavMode: string = get(mavModeStore);

  let markers = get(markersStore);
  let progressSamples: { progress: number, timestamp: number }[] = [];

  $: darkMode = $darkModeStore;
  $: primaryColor = $primaryColorStore;
  $: secondaryColor = darkMode ? $tertiaryColorStore : $secondaryColorStore;
  $: tertiaryColor = $tertiaryColorStore;
  $: fontColor = darkMode ? '#ffffff' : '#000000';
  $: mavModel = $mavModelStore;
  $: mavType = $mavTypeStore;
  $: isArmed = $mavArmedStateStore;
  $: systemState = $mavStateStore;
  $: mavMode = $mavModeStore;
  $: batteryStatus = $mavBatteryStore;
  $: altitude = $mavAltitudeStore;
  $: speed = $mavSpeedStore;
  $: missionPlanTitle = $missionPlanTitleStore;
  $: mavLocation = $mavLocationStore;
  $: missionProgress = getMissionProgress($missionIndexStore, $missionCountStore, $mavLocationStore as L.LatLng);
  $: missionLoaded = $missionPlanTitleStore !== '';
  $: markers = $markersStore;
  $: eta = calculateETA(missionProgress, $mavLocationStore);
  $: remainingDistance = calculateRemainingDistance($missionIndexStore, $mavLocationStore, $markersStore);

  function getMissionProgress(index: number, count: number, mavLocation: L.LatLng): number {
    let progress: number = 0;
    let nextMarkerLocation: L.LatLng = { lat: 0, lng: 0 } as L.LatLng;
    let prevMarkerLocation: L.LatLng = { lat: 0, lng: 0 } as L.LatLng;
    if (markers.get(index) !== undefined) nextMarkerLocation = markers.get(index)!.getLatLng();
    if (markers.get(index - 1) !== undefined) prevMarkerLocation = markers.get(index - 1)!.getLatLng();
    if (nextMarkerLocation.lat !== 0 && nextMarkerLocation.lng !== 0 && prevMarkerLocation.lat !== 0 && prevMarkerLocation.lng !== 0) {
      let distanceToNext = haversine(mavLocation.lat, mavLocation.lng, nextMarkerLocation.lat, nextMarkerLocation.lng);
      let distanceToPrev = haversine(mavLocation.lat, mavLocation.lng, prevMarkerLocation.lat, prevMarkerLocation.lng);
      let totalDistance = distanceToNext + distanceToPrev;
      progress = (distanceToPrev / totalDistance);
    }
    let section = ((1 / count) * 100) * (index - 1);
    progress = progress * ((1 / count) * 100);
    progress = parseFloat((Math.min(section + progress, 100)).toFixed(2));
    if (systemState === 'STANDBY') progress = 0;
    addSample(progress, Date.now());
    return progress;
  }

  function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
    // distance between latitudes
    // and longitudes
    let dLat = (lat2 - lat1) * Math.PI / 180.0;
    let dLon = (lon2 - lon1) * Math.PI / 180.0;
        
    // convert to radians
    lat1 = (lat1) * Math.PI / 180.0;
    lat2 = (lat2) * Math.PI / 180.0;
      
    // apply formulae
    let a = Math.pow(Math.sin(dLat / 2), 2) + 
                Math.pow(Math.sin(dLon / 2), 2) * 
                Math.cos(lat1) * 
                Math.cos(lat2);
    let rad = 6371;
    let c = 2 * Math.asin(Math.sqrt(a));
    return rad * c;
  }

  function addSample(progress: number, timestamp: number) {
    progressSamples.push({ progress, timestamp });
    
    // Keep only the latest 2 samples
    if (progressSamples.length > 2) {
      progressSamples.shift();
    }
  }

  function calculateETA(currentProgress: number, location: LatLng | { lat: number; lng: number; }): string {
    if (progressSamples.length < 2) {
      return "00:00:00"; // Not enough samples
    }
    
    // Get the last two samples
    const [{ progress: progress1, timestamp: time1 }, { progress: progress2, timestamp: time2 }] = progressSamples;

    // Calculate the progress rate (progress per second)
    let progressRate = (progress2 - progress1) / ((time2 - time1) / 1000);

    if (progressRate < 0) {
      progressRate = 1; // Avoid division by zero
    }
    
    // Calculate the remaining progress to reach 100%
    const remainingProgress = 100 - currentProgress;

    // Calculate the remaining time in seconds
    const remainingTimeSeconds = (remainingProgress / progressRate);

    // Convert remaining time to hours, minutes, and seconds
    const hours = Math.floor(remainingTimeSeconds / 3600);
    const minutes = Math.floor((remainingTimeSeconds % 3600) / 60);
    const seconds = Math.floor(remainingTimeSeconds % 60);

    // Format the time as HH:MM:SS
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
      return "00:00:00";
    }
    
    const formattedTime = [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0')
    ].join(':');

    return formattedTime;
  }

  function calculateRemainingDistance(index: number, mavLocation: any, markers: Map<number, L.Marker>): number {
    let totalDistance = 0;
    
    // Calculate total distance from current position to end through remaining waypoints
    let currentPos = mavLocation;
    for (let i = index; i <= markers.size; i++) {
        const nextMarker = markers.get(i);
        if (nextMarker) {
            const nextPos = nextMarker.getLatLng();
            totalDistance += haversine(currentPos.lat, currentPos.lng, nextPos.lat, nextPos.lng);
            currentPos = nextPos;
        }
    }
    
    return parseFloat((totalDistance * 1000).toFixed(2)); // Returns distance in meters
  }

  async function sendMavlinkCommand(command: string, params: string = '', useCmdLong = false, useArduPilotMega = false) {
    try {
      await sendCommand(command, params, useCmdLong, useArduPilotMega);
    } catch (err) {
      console.error(`[Stats] sendMavlinkCommand failed (${command}):`, err);
    }
  }

  async function writeParameter(id: string, value: number, type: number) {
    try {
      await writeParam(id, encodeParameterValue(value, type), type);
    } catch (err: any) {
      console.error('[Stats] writeParameter failed:', err.message);
    }
  }

  function confirmCalibration() {
    let modal = new Modal({
      target: document.body,
      props: {
        title: 'Sensor Calibration',
        content: 'Are you sure you want to calibrate the sensors? If so please manually specify the current heading (direction) of the MAV in degrees.',
        inputs: [
          {
            type: 'number',
            placeholder: 'Current Heading',
            required: true,
          }
        ],
        isOpen: true,
        confirmation: true,
        notification: false,
        onConfirm: async () => {
          const heading = isNaN(parseInt(modal.inputValues![0])) ? 0 : modal.inputValues![0];
          await sendMavlinkCommand('FIXED_MAG_CAL_YAW', `${heading},0,${mavLocation.lat},${mavLocation.lng}`, 'true');
          await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
          await sendMavlinkCommand('PREFLIGHT_CALIBRATION', '0,0,0,0,4,0,0', true);
          modal.$destroy();
        }
      }
    });
  }

  function stopMission() {
    let modal = new Modal({
      target: document.body,
      props: {
        title: 'Stop Mission',
        content: 'Are you sure you want to stop the mission?',
        isOpen: true,
        confirmation: true,
        notification: false,
        onConfirm: async () => {
          await sendMavlinkCommand('DO_SET_MODE', '1,6', true); // 6 is RTL
          modal.$destroy();
          const notification = new Notification({
            target: document.body,
            props: {
              title: 'Mission Stopped',
              content: 'The mission has been stopped.<br>Returning to launch.',
              type: 'info',
            }
          });
          setTimeout(() => notification.$destroy(), 10000);
        },
      }
    });
  }

  function pauseMission() {
    let modal = new Modal({
      target: document.body,
      props: {
        title: 'Pause Mission',
        content: 'Are you sure you want to pause the mission?',
        isOpen: true,
        confirmation: true,
        notification: false,
        onConfirm: async () => {
          await sendMavlinkCommand('DO_SET_MODE', '1,4', true); // 4 is GUIDED
          modal.$destroy();
          const notification = new Notification({
            target: document.body,
            props: {
              title: 'Mission Paused',
              content: 'The mission has been paused.',
              type: 'info',
            }
          });
          setTimeout(() => notification.$destroy(), 10000);
        },
      }
    });
  }

  async function startMission() {
    const params = get(mavlinkParamStore);
    const RTL_ALT_CM_DEFAULT = 1500;
    const rtlAltParam   = params['RTL_ALT'];
    const rtlClimbParam = params['RTL_CLIMB_MIN'];
    const currentRtlAltM = rtlAltParam
      ? encodeParameterValue(rtlAltParam.param_value, rtlAltParam.param_type) / 100
      : RTL_ALT_CM_DEFAULT / 100;

    if (!missionLoaded) {
      const n = new Notification({ target: document.body, props: { title: 'No Mission Loaded', content: 'Please save and load a mission plan before starting.', type: 'warning' } });
      setTimeout(() => n.$destroy(), 6000);
      return;
    }

    let modal = new Modal({
      target: document.body,
      props: {
        title: '🚀 Arm & Start Mission',
        content:
          `<b>Mission:</b> ${missionPlanTitle}<br><br>` +
          `Sequence:<br>` +
          `1. Set RTL_ALT (safety altitude on return)<br>` +
          `2. Arm the vehicle<br>` +
          `3. Issue NAV_TAKEOFF<br>` +
          `4. Switch to AUTO mode<br><br>` +
          `Specify RTL_ALT in <b>metres</b>. Consider obstacles on the return path.`,
        isOpen: true,
        confirmation: true,
        notification: false,
        inputs: [
          {
            type: 'number',
            placeholder: `RTL_ALT: ${currentRtlAltM} m`,
            required: true,
          }
        ],
        onConfirm: async () => {
          // Read inputValues BEFORE destroying the modal — $destroy() clears props
          const rtlAltInput = modal.inputValues?.[0];
          modal.$destroy();
          missionIndexStore.set(1);
          missionCompleteStore.set(false);

          const rtlAltValueCm = parseInt(rtlAltInput ?? String(currentRtlAltM)) * 100;
          await writeParameter('RTL_ALT', rtlAltValueCm, rtlAltParam?.param_type ?? 6);
          if (rtlClimbParam) {
            await writeParameter('RTL_CLIMB_MIN', 0, rtlClimbParam.param_type);
          }

          if (get(mavStateStore) === 'STANDBY') {
            await sendMavlinkCommand('DO_SET_MODE', '1,4', true); // GUIDED
            await new Promise(resolve => setTimeout(resolve, 300));
            await writeParam('ARMING_CHECK', 0, 6);
            await new Promise(resolve => setTimeout(resolve, 200));
            await sendMavlinkCommand('COMPONENT_ARM_DISARM', '1,21196', true);
            // Wait for arm ACK (up to 5 s) instead of fixed delay
            const armed = await waitForArmed(5000);
            await writeParam('ARMING_CHECK', 1, 6);
            if (!armed) {
              const n = new Notification({ target: document.body, props: { title: 'Arm Failed', content: 'Vehicle did not confirm armed. Check STATUSTEXT messages.', type: 'error' } });
              setTimeout(() => n.$destroy(), 8000);
              return;
            }
            await sendMavlinkCommand('NAV_TAKEOFF', '0,0,0,0,0,0,10', true);
            // Wait for altitude (up to 15 s) before switching to AUTO
            await waitForAltitude(8, 15000);
          }
          await sendMavlinkCommand('DO_SET_MODE', '1,3', true); // AUTO

          const n = new Notification({ target: document.body, props: { title: '✅ Mission Started', content: `${missionPlanTitle} is now running in AUTO mode.`, type: 'success' } });
          setTimeout(() => n.$destroy(), 8000);
        },
      }
    });
  }

  /** Polls mavArmedStateStore until armed or timeout. */
  async function waitForArmed(timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (get(mavArmedStateStore)) return true;
      await new Promise(r => setTimeout(r, 200));
    }
    return get(mavArmedStateStore);
  }

  /** Polls mavAltitudeStore until altitude reached or timeout. */
  async function waitForAltitude(targetAltM: number, timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (get(mavAltitudeStore) >= targetAltM) return true;
      await new Promise(r => setTimeout(r, 300));
    }
    return false;
  }

  function releasePayload() {
    let modal = new Modal({
      target: document.body,
      props: {
        title: 'Confirm Release Payload',
        content: 'Are you sure you want to release the payload?\nUse caution and ensure the drop zone is clear.',
        isOpen: true,
        confirmation: true,
        notification: false,
        onConfirm: async () => {
          if (mavMode !== 'GUIDED') {
            await sendMavlinkCommand('DO_SET_MODE', '1,4', true);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          await sendMavlinkCommand('DO_SET_SERVO', '9,1050', true); // Release servo
          await new Promise((resolve) => setTimeout(resolve, 500));
          await sendMavlinkCommand('DO_SET_SERVO', '9,1950', true); // Open servo
          modal.$destroy();
        },
      }
    });
  }

  function initTakeoff() {
    let modal = new Modal({
      target: document.body,
      props: {
        title: 'Confirm Takeoff',
        content: 'Are you sure you want to initiate takeoff? If so please specify the altitude.',
        isOpen: true,
        confirmation: true,
        notification: false,
        inputs: [
          {
            type: 'number',
            placeholder: 'Altitude (m)',
            required: true,
          }
        ],
        onConfirm: async () => {
          // Read inputValues BEFORE any await — async gaps can cause $destroy to be called
          const takeoffAlt = parseInt(modal.inputValues?.[0] ?? '10') || 10;
          if (mavMode !== 'GUIDED') {
            await sendMavlinkCommand('DO_SET_MODE', '1,4', true);
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          await writeParam('ARMING_CHECK', 0, 6);
          await new Promise(resolve => setTimeout(resolve, 200));
          await sendMavlinkCommand('COMPONENT_ARM_DISARM', '1,21196', true);
          await new Promise(resolve => setTimeout(resolve, 1000));
          await writeParam('ARMING_CHECK', 1, 6);
          await sendMavlinkCommand('NAV_TAKEOFF', `0,0,0,0,0,0,${takeoffAlt}`, true);
          modal.$destroy();
        },
      }
    });
  }
  
  function initLanding() {
    let modal = new Modal({
      target: document.body,
      props: {
        title: 'Confirm Landing',
        content: 'Are you sure you want to land the MAV?',
        isOpen: true,
        confirmation: true,
        notification: false,
        onConfirm: async () => {
          await sendMavlinkCommand('DO_SET_MODE', '1,9', true); // 9 is LAND mode
          modal.$destroy();
        },
      }
    });
  }
  
  function checkMode(target: string, mode: string) {
    return target.includes(mode);
  }

  // ── ArduCopter flight modes ───────────────────────────────────────────────
  // Source: https://ardupilot.org/copter/docs/flight-modes.html
  // Mode numbers from CopterMode enum in mavlink-mappings/dist/lib/ardupilotmega
  //
  // Columns:
  //   label      — enum name returned by HEARTBEAT.customMode via CopterMode[]
  //   mode       — integer value sent in DO_SET_MODE param2
  //   gpsRequired— true = vehicle must have 3D GPS lock + HDOP < 2.0 to enter
  //   altCtrl    — true = autopilot holds altitude automatically
  //   posCtrl    — true = autopilot holds horizontal position automatically
  //   description— one-line summary from ArduPilot docs
  //   warning    — shown in the confirmation dialog if non-empty
  interface FlightMode {
    label: string;
    mode: number;
    gpsRequired: boolean;
    altCtrl: boolean;
    posCtrl: boolean;
    description: string;
    warning?: string;
  }

  const FLIGHT_MODES: FlightMode[] = [
    // ── Basic / manual ────────────────────────────────────────────────────────
    {
      label: 'STABILIZE', mode: 0,
      gpsRequired: false, altCtrl: false, posCtrl: false,
      description: 'Self-levels roll & pitch; manual throttle and altitude.',
    },
    {
      label: 'ACRO', mode: 1,
      gpsRequired: false, altCtrl: false, posCtrl: false,
      description: 'Rate-controlled; sticks control rotation rate, no auto-level.',
      warning: 'Most difficult mode. Vehicle will not self-level when sticks are released.',
    },
    {
      label: 'ALT_HOLD', mode: 2,
      gpsRequired: false, altCtrl: true, posCtrl: false,
      description: 'Holds altitude automatically; manual roll, pitch and yaw.',
    },
    {
      label: 'SPORT', mode: 13,
      gpsRequired: false, altCtrl: true, posCtrl: false,
      description: 'Rate-controlled stabilize + altitude hold. Holds attitude on stick release.',
    },
    {
      label: 'DRIFT', mode: 11,
      gpsRequired: true, altCtrl: false, posCtrl: false,
      description: 'Plane-like coordinated turns; autopilot handles roll during yaw inputs.',
    },
    {
      label: 'FLIP', mode: 14,
      gpsRequired: false, altCtrl: false, posCtrl: false,
      description: 'Executes an automated flip then returns to previous mode.',
      warning: 'Requires at least 10 m of altitude. Vehicle will flip immediately on entry.',
    },

    // ── GPS position-hold ─────────────────────────────────────────────────────
    {
      label: 'LOITER', mode: 5,
      gpsRequired: true, altCtrl: true, posCtrl: true,
      description: 'Holds altitude and position using GPS. Sticks adjust position.',
    },
    {
      label: 'POSHOLD', mode: 16,
      gpsRequired: true, altCtrl: true, posCtrl: true,
      description: 'Like Loiter but sticks directly control lean angle instead of speed.',
    },
    {
      label: 'CIRCLE', mode: 7,
      gpsRequired: true, altCtrl: true, posCtrl: true,
      description: 'Orbits a point CIRCLE_RADIUS_M metres in front of the vehicle.',
    },
    {
      label: 'FLOWHOLD', mode: 22,
      gpsRequired: false, altCtrl: true, posCtrl: true,
      description: 'Position hold using optical flow sensor — no GPS required.',
    },

    // ── Autonomous ────────────────────────────────────────────────────────────
    {
      label: 'AUTO', mode: 3,
      gpsRequired: true, altCtrl: true, posCtrl: true,
      description: 'Executes pre-programmed waypoint mission stored in the FC.',
    },
    {
      label: 'GUIDED', mode: 4,
      gpsRequired: true, altCtrl: true, posCtrl: true,
      description: 'Navigates to single points commanded by GCS in real time.',
    },
    {
      label: 'GUIDED_NOGPS', mode: 20,
      gpsRequired: false, altCtrl: false, posCtrl: false,
      description: 'Guided mode accepting only attitude targets — no GPS required.',
    },
    {
      label: 'BRAKE', mode: 17,
      gpsRequired: true, altCtrl: true, posCtrl: true,
      description: 'Stops the vehicle as quickly as possible. No pilot input accepted.',
    },
    {
      label: 'FOLLOW', mode: 23,
      gpsRequired: true, altCtrl: true, posCtrl: true,
      description: 'Follows another vehicle broadcasting its MAVLink position.',
    },
    {
      label: 'ZIGZAG', mode: 24,
      gpsRequired: true, altCtrl: true, posCtrl: true,
      description: 'Semi-autonomous back-and-forth sweeps for crop spraying.',
    },

    // ── Return / landing ──────────────────────────────────────────────────────
    {
      label: 'RTL', mode: 6,
      gpsRequired: true, altCtrl: true, posCtrl: true,
      description: 'Returns above home at RTL_ALT_M, loiters, then lands.',
    },
    {
      label: 'SMART_RTL', mode: 21,
      gpsRequired: true, altCtrl: true, posCtrl: true,
      description: 'RTL but retraces the outbound path to avoid obstacles.',
    },
    {
      label: 'LAND', mode: 9,
      gpsRequired: false, altCtrl: true, posCtrl: false,
      description: 'Descends straight down and auto-disarms on touchdown.',
    },
    {
      label: 'AUTO_RTL', mode: 27,
      gpsRequired: true, altCtrl: true, posCtrl: true,
      description: 'RTL initiated from within a mission (AUTO mode sub-state).',
    },

    // ── Advanced / special ────────────────────────────────────────────────────
    {
      label: 'AUTOTUNE', mode: 15,
      gpsRequired: false, altCtrl: true, posCtrl: false,
      description: 'Automated pitch/roll PID tuning procedure. Fly away from obstacles.',
      warning: 'Vehicle will make sudden automated movements to measure response. Maintain safe distance.',
    },
    {
      label: 'THROW', mode: 18,
      gpsRequired: true, altCtrl: true, posCtrl: true,
      description: 'Arm, then throw the vehicle; motors start at apex of throw.',
      warning: 'Dangerous — do not stand near an armed vehicle. Motors start automatically.',
    },
    {
      label: 'AVOID_ADSB', mode: 19,
      gpsRequired: true, altCtrl: true, posCtrl: true,
      description: 'Automatic avoidance of manned aircraft via ADS-B. Not pilot-selectable.',
      warning: 'This mode should only be engaged by the autopilot via ADS-B failsafe, not manually.',
    },
    {
      label: 'SYSTEMID', mode: 25,
      gpsRequired: false, altCtrl: false, posCtrl: false,
      description: 'Special diagnostic mode for system identification and modelling.',
      warning: 'For advanced users and developers only. Vehicle responds to automated test inputs.',
    },
    {
      label: 'AUTOROTATE', mode: 26,
      gpsRequired: true, altCtrl: true, posCtrl: true,
      description: 'Emergency autorotation for traditional helicopters (SITL only).',
      warning: 'Helicopter-only mode. Has no effect on multirotors.',
    },
  ];

  // Group modes for the dropdown UI
  const MODE_GROUPS: { group: string; modes: FlightMode[] }[] = [
    {
      group: 'Manual',
      modes: FLIGHT_MODES.filter(m => ['STABILIZE','ACRO','SPORT','DRIFT','FLIP'].includes(m.label)),
    },
    {
      group: 'Altitude Hold',
      modes: FLIGHT_MODES.filter(m => ['ALT_HOLD','FLOWHOLD'].includes(m.label)),
    },
    {
      group: 'Position Hold',
      modes: FLIGHT_MODES.filter(m => ['LOITER','POSHOLD','CIRCLE'].includes(m.label)),
    },
    {
      group: 'Autonomous',
      modes: FLIGHT_MODES.filter(m => ['AUTO','GUIDED','GUIDED_NOGPS','BRAKE','FOLLOW','ZIGZAG'].includes(m.label)),
    },
    {
      group: 'Return / Land',
      modes: FLIGHT_MODES.filter(m => ['RTL','SMART_RTL','LAND','AUTO_RTL'].includes(m.label)),
    },
    {
      group: 'Advanced',
      modes: FLIGHT_MODES.filter(m => ['AUTOTUNE','THROW','AVOID_ADSB','SYSTEMID','AUTOROTATE'].includes(m.label)),
    },
  ];

  let modeDropdownOpen = false;

  /**
   * Requests a flight mode change via DO_SET_MODE.
   * Shows a confirmation dialog for modes with a warning, and validates
   * GPS requirements against current satellite state before switching.
   */
  async function setFlightMode(flightMode: FlightMode) {
    modeDropdownOpen = false;

    const { label, mode, gpsRequired, warning } = flightMode;

    // GPS check — warn if mode needs position but GPS quality is insufficient
    const { total: sats, hdop } = get(mavSatelliteStore);
    if (gpsRequired && (sats < 6 || hdop > 2.0)) {
      const modal = new Modal({
        target: document.body,
        props: {
          title: `⚠️ GPS Required — ${label}`,
          content: `${label} requires a good GPS lock (≥6 satellites, HDOP &lt; 2.0).<br><br>Current: <b>${sats} sats, HDOP ${hdop.toFixed(2)}</b>.<br><br>Switching anyway may cause unexpected behaviour.`,
          isOpen: true,
          confirmation: true,
          notification: false,
          onConfirm: async () => {
            modal.$destroy();
            await doSetMode(mode, label);
          },
          onCancel: () => modal.$destroy(),
        },
      });
      return;
    }

    // Warning confirmation for dangerous / advanced modes
    if (warning) {
      const modal = new Modal({
        target: document.body,
        props: {
          title: `Switch to ${label}?`,
          content: `${warning}`,
          isOpen: true,
          confirmation: true,
          notification: false,
          onConfirm: async () => {
            modal.$destroy();
            await doSetMode(mode, label);
          },
          onCancel: () => modal.$destroy(),
        },
      });
      return;
    }

    await doSetMode(mode, label);
  }

  async function doSetMode(modeNum: number, label: string) {
    try {
      await sendMavlinkCommand('DO_SET_MODE', `1,${modeNum}`, true);
      console.log(`[Stats] Flight mode → ${label} (${modeNum})`);
    } catch (err) {
      console.error('[Stats] setFlightMode failed:', err);
    }
  }

  // ARM / DISARM — 2-click confirm to prevent accidents
  let armConfirmStep = false;
  let armConfirmTimer: ReturnType<typeof setTimeout> | null = null;

  async function armVehicle() {
    if (!armConfirmStep) {
      armConfirmStep = true;
      if (armConfirmTimer) clearTimeout(armConfirmTimer);
      armConfirmTimer = setTimeout(() => { armConfirmStep = false; }, 3000);
      return;
    }
    armConfirmStep = false;
    if (armConfirmTimer) { clearTimeout(armConfirmTimer); armConfirmTimer = null; }
    // Only switch to GUIDED when arming from the ground (STANDBY).
    // If the vehicle is already airborne (ACTIVE/CRITICAL) do NOT override the
    // current mode — the pilot may have deliberately selected LOITER or another mode.
    if (get(mavStateStore) === 'STANDBY' || get(mavStateStore) === 'Unknown') {
      await sendMavlinkCommand('DO_SET_MODE', '1,4', true); // GUIDED for ground arming
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    // Disable pre-arm checks and wait for FC to apply the param
    await writeParam('ARMING_CHECK', 0, 6);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Arm with up to 3 retries
    let statsArmed = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      await sendMavlinkCommand('COMPONENT_ARM_DISARM', '1,21196', true);
      // Wait up to 3s for arm confirmation
      const start = Date.now();
      while (Date.now() - start < 3000) {
        if (get(mavArmedStateStore)) { statsArmed = true; break; }
        await new Promise(r => setTimeout(r, 200));
      }
      if (statsArmed) break;
      console.warn(`[Stats] Arm attempt ${attempt} failed, retrying...`);
      await new Promise(r => setTimeout(r, 500));
    }

    // Restore ARMING_CHECK regardless of result
    await writeParam('ARMING_CHECK', 1, 6);

    if (!statsArmed) {
      const n = new Notification({
        target: document.body,
        props: {
          title: 'Arming Failed',
          content: 'Vehicle did not arm after 3 attempts. Check pre-arm errors on the FC.',
          type: 'error',
        }
      });
      setTimeout(() => n.$destroy(), 8000);
    }
  }

  async function disarmVehicle() {
    if (!armConfirmStep) {
      armConfirmStep = true;
      if (armConfirmTimer) clearTimeout(armConfirmTimer);
      armConfirmTimer = setTimeout(() => { armConfirmStep = false; }, 3000);
      return;
    }
    armConfirmStep = false;
    if (armConfirmTimer) { clearTimeout(armConfirmTimer); armConfirmTimer = null; }
    await sendMavlinkCommand('COMPONENT_ARM_DISARM', '0,21196', true);
  }
</script>

<div
  class="stats p-4 rounded-2xl flex flex-col space-y-2 h-full overflow-y-auto overflow-x-hidden text-sm"
  style="--primaryColor: {primaryColor}; --secondaryColor: {secondaryColor}; --tertiaryColor: {tertiaryColor}; --fontColor: {fontColor};"
>
  <div class="h-full flex flex-col justify-evenly">
    <div class="grid grid-cols-2 gap-2">
      <div class="relative flex items-center gap-1">
        <span>Mode:</span>
        <div class="mode-dropdown relative">
          <button
            class="mode-toggle flex items-center gap-1 text-orange-400 font-medium"
            on:click={() => modeDropdownOpen = !modeDropdownOpen}
            aria-haspopup="listbox"
            aria-expanded={modeDropdownOpen}
            title="Change flight mode"
          >
            {mavMode}
            <i class="fas fa-chevron-{modeDropdownOpen ? 'up' : 'down'} text-[9px] opacity-70"></i>
          </button>

          {#if modeDropdownOpen}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div class="mode-backdrop fixed inset-0 z-10" on:click={() => modeDropdownOpen = false}></div>
            <ul class="mode-list absolute left-0 z-20 mt-1 py-1 rounded-xl shadow-lg min-w-[11rem] max-h-80 overflow-y-auto" role="listbox">
              {#each MODE_GROUPS as { group, modes }}
                <li class="mode-group-label px-3 pt-2 pb-0.5 text-[8px] uppercase tracking-widest opacity-50 font-bold select-none">{group}</li>
                {#each modes as fm}
                  <li role="option" aria-selected={mavMode === fm.label} title={fm.description}>
                    <button
                      class="mode-item w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2
                        {mavMode === fm.label ? 'mode-item-active' : ''}"
                      on:click={() => setFlightMode(fm)}
                    >
                      <span class="flex items-center gap-1">
                        {#if fm.gpsRequired}
                          <i class="fas fa-satellite text-[8px] opacity-50" title="GPS required"></i>
                        {/if}
                        {#if fm.warning}
                          <i class="fas fa-exclamation-triangle text-[8px] text-yellow-400" title={fm.warning}></i>
                        {/if}
                        {fm.label}
                      </span>
                      {#if mavMode === fm.label}
                        <i class="fas fa-check text-[9px] text-blue-400"></i>
                      {/if}
                    </button>
                  </li>
                {/each}
              {/each}
            </ul>
          {/if}
        </div>
      </div>
    </div>
    <hr class="my-3" />
      <div class="w-full mb-2">Loaded Mission Plan:
        <span class="text-[#66e1ff] {darkMode ? '' : 'brightness-90'}" title={missionPlanTitle}>
          {missionPlanTitle || 'No mission plan loaded.'}
        </span>
      </div>
      <div class="flex flex-col items-center justify-end">
        <div class="w-full">
          <span>
            Mission Progress: {systemState === 'Unknown' ? '--' : mavMode === 'AUTO' ? missionProgress : 0}% (ETA {eta})
            <span class="text-[#66e1ff]"> {mavMode === 'AUTO' ? (parseFloat(remainingDistance.toFixed(2)) || 0) : 0} m remaining</span>
          </span>
          <div class="progress-bar rounded-full h-2.5 mt-3">
            <div class="progress-bar-inner h-2.5 rounded-full" style="width: {mavMode === 'AUTO' ? missionProgress : 0}%;"></div>
          </div>
        </div>
        <div class="button-container mt-6">
          <div class="relative group">
            <button class="circular-button" on:click={confirmCalibration}>
              <i class="far fa-compass text-[#ffa704] fa-spin"></i>
              <div class="tooltip text-white">Calibrate Sensors</div>
            </button>
          </div>
          <div class="relative group">
            <button class="circular-button" on:click={releasePayload}>
              <i class="fas fa-parachute-box"></i>
              <div class="tooltip text-white">Release Payload</div>
            </button>
          </div>
          {#if systemState === 'STANDBY'}
            <div class="relative group flex flex-col items-center">
              <button class="circular-button" on:click={initTakeoff} disabled={checkMode('AUTO', mavMode)}>
                <i class="fas fa-plane-departure"></i>
                <div class="tooltip text-white">Initiate Takeoff</div>
              </button>
            </div>
          {:else}
            <div class="relative group flex flex-col items-center">
              <button class="circular-button" on:click={initLanding} disabled={checkMode('AUTO', mavMode) || checkMode('LAND', mavMode)}>
                <i class="fas fa-plane-arrival"></i>
                <div class="tooltip text-white">Initiate Landing</div>
              </button>
            </div>
          {/if}
          {#if !checkMode('AUTO', mavMode) || systemState === 'STANDBY'}
            <div class="relative group">
              <button
                class="circular-button" on:click={startMission}
                disabled={checkMode('AUTO', mavMode) && systemState !== 'STANDBY' || !missionLoaded}
              >
                <i class="fas fa-play"></i>
                <div class="tooltip text-white">Start/Resume Mission</div>
              </button>
            </div>
          {:else}
            <div class="relative group">
              <button
                class="circular-button" on:click={pauseMission}
                disabled={!checkMode('AUTO', mavMode) || !missionLoaded}
              >
                <i class="fas fa-pause"></i>
                <div class="tooltip text-white">Pause Mission (POSHOLD)</div>
              </button>
            </div>
          {/if}
          <div class="relative group">
            <button
              class="circular-button" on:click={stopMission}
              disabled={!checkMode('AUTO', mavMode) || !missionLoaded}
            >
              <i class="fas fa-stop text-red-400"></i>
              <div class="tooltip text-white">Stop Mission (RTL)</div>
            </button>
          </div>
        </div>
      </div>
  </div>
</div>

<style>
  .stats {
    background-color: var(--primaryColor);
    color: var(--fontColor);
  }

  hr {
    border: 1px solid var(--secondaryColor);
  }

  .progress-bar {
    background-color: var(--tertiaryColor);
  }

  .progress-bar-inner {
    background: linear-gradient(45deg, #4c75af 25%, transparent 25%, transparent 50%, #66e1ff 50%, #66e1ff 75%, transparent 75%, transparent);
    background-size: 30px 30px;
    animation: progress-bar 1s linear infinite;
    transition: width 0.3s;
  }

  @keyframes progress-bar {
    from {
      background-position: 0 0;
    }
    to {
      background-position: 30px 0;
    }
  }

  .button-container {
    display: inline-flex;
    justify-content: center;
    width: 100%;
    margin-top: 1.5rem;
  }

  .circular-button {
    width: 3rem;
    height: 3rem;
    margin-inline: 0.6em;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: var(--tertiaryColor);
    color: white;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background-color 0.3s;
    position: relative;
  }

  .circular-button:hover {
    filter: brightness(1.1);
  }

  .tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    border-radius: 0.25rem;
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s, visibility 0.3s, transform 0.3s;
  }

  .circular-button:hover .tooltip {
    opacity: 1;
    visibility: visible;
    transform: translateX(-50%) translateY(-0.5rem);
  }

  button:disabled, button:disabled:hover {
    background-color: #b5bcc5;
    filter: brightness(0.7);
    cursor: not-allowed;
  }

  /* Mode dropdown */
  .mode-toggle {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    line-height: inherit;
  }

  .mode-toggle:hover {
    opacity: 0.8;
  }

  .mode-list {
    background-color: var(--primaryColor);
    border: 1px solid var(--tertiaryColor);
    max-height: 320px;
    overflow-y: auto;
  }

  .mode-group-label {
    color: var(--fontColor);
    pointer-events: none;
  }

  .mode-item {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--fontColor);
    transition: background-color 0.15s;
  }

  .mode-item:hover {
    background-color: var(--tertiaryColor);
  }

  .mode-item-active {
    color: #fb923c; /* orange-400 */
  }
</style>
