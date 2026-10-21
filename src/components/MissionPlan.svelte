<script lang="ts">
  import { onMount } from 'svelte';
  import { mavLocationStore, mavModeStore, mavStateStore, mavlinkParamStore, mavArmedStateStore, mavAltitudeStore } from '../stores/mavlinkStore';
  import {
    missionPlanTitleStore,
    missionPlanActionsStore,
    missionCompleteStore,
    missionIndexStore,
    type MissionPlanActions
  } from '../stores/missionPlanStore';
  import Modal from './Modal.svelte';
  import { get } from 'svelte/store';
  import Notification from './Notification.svelte';
  import {
    darkModeStore,
    primaryColorStore,
    secondaryColorStore,
    tertiaryColorStore
  } from '../stores/customizationStore';
  import { sendCommand, writeParam } from '$lib/api/mavlink';
  import { encodeParameterValue } from '$lib/utils/parameters';

  export let title: string = '';
  let actions: MissionPlanActions = {};
  let action_types = [
    'NAV_WAYPOINT', 'NAV_SPLINE_WAYPOINT', 'NAV_TAKEOFF', 'NAV_RETURN_TO_LAUNCH', 'NAV_GUIDED_ENABLE', 'NAV_LAND',
    'NAV_LOITER_TIME', 'NAV_LOITER_TURNS', 'NAV_LOITER_UNLIM', 'NAV_PAYLOAD_PLACE', 'DO_WINCH', 'DO_GRIPPER', 'DO_SET_CAM_TRIGG_DIST',
    'DO_SET_SERVO', 'DO_REPEAT_SERVO', 'DO_DIGICAM_CONFIGURE', 'DO_DIGICAM_CONTROL', 'DO_FENCE_ENABLE',
    'DO_ENGINE_CONTROL', 'CONDITION_DELAY', 'CONDITION_CHANGE_ALT', 'CONDITION_DISTANCE', 'CONDITION_YAW'
  ];
  
  $: darkMode = $darkModeStore;
  $: primaryColor = $primaryColorStore;
  $: secondaryColor = darkMode ? $tertiaryColorStore : $secondaryColorStore;
  $: tertiaryColor = $tertiaryColorStore;
  $: fontColor = darkMode ? '#ffffff' : '#000000';
  $: mavLocation = $mavLocationStore;
  $: mavMode = $mavModeStore;
  $: systemState = $mavStateStore;
  $: title = $missionPlanTitleStore;
  $: actions = $missionPlanActionsStore;
  $: missionLoaded = $missionPlanTitleStore !== '';

  onMount(async () => {
    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    function resizeInput() {
      input.style.width = `${input.scrollWidth}px`;
    }
    resizeInput();
      let width = Math.max(140, input.scrollWidth - 88);
      input.style.width = `${width}px`;
    input.addEventListener('input', resizeInput);
  });

  async function sendMavlinkCommand(command: string, params: string = '', useCmdLong = false, useArduPilotMega = false) {
    try {
      await sendCommand(command, params, useCmdLong, useArduPilotMega);
    } catch (err) {
      console.error(`[MissionPlan] sendMavlinkCommand failed (${command}):`, err);
    }
  }

  async function writeParameter(id: string, value: number, type: number) {
    try {
      await writeParam(id, encodeParameterValue(value, type), type);
    } catch (err: any) {
      console.error('[MissionPlan] writeParameter failed:', err.message);
    }
  }

  function stopMission() {
    let modal = new Modal({
      target: document.body,
      props: {
        title: 'Stop Mission',
        content: 'Are you sure you want to stop the flight?',
        isOpen: true,
        confirmation: true,
        notification: false,
        onConfirm: async () => {
          await sendMavlinkCommand('DO_SET_MODE', `${[1, 6]}`, 'true'); // 6 is RTL: see CopterMode enum in /mavlink-mappings/dist/lib/ardupilotmega.ts
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
        content: 'Are you sure you want to pause the flight?',
        isOpen: true,
        confirmation: true,
        notification: false,
        onConfirm: async () => {
          await sendMavlinkCommand('DO_SET_MODE', `${[1, 16]}`, 'true'); // 16 is POSHOLD: see CopterMode enum in /mavlink-mappings/dist/lib/ardupilotmega.ts
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

  // ── Mission execution helpers ─────────────────────────────────────────────

  /**
   * Polls `mavArmedStateStore` until the vehicle confirms armed or the timeout expires.
   * Returns true if armed within the timeout, false if it timed out.
   */
  async function waitForArmed(timeoutMs = 5000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (get(mavArmedStateStore)) return true;
      await new Promise(r => setTimeout(r, 200));
    }
    return get(mavArmedStateStore); // final check
  }

  /**
   * Polls `mavAltitudeStore` until the vehicle reaches at least `targetAltM` metres
   * or the timeout expires. Used to confirm takeoff before switching to AUTO.
   */
  async function waitForAltitude(targetAltM: number, timeoutMs = 15000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (get(mavAltitudeStore) >= targetAltM) return true;
      await new Promise(r => setTimeout(r, 300));
    }
    return false;
  }

  async function startMission() {
    const params        = get(mavlinkParamStore);
    const rtlAltParam   = params['RTL_ALT'];
    const rtlClimbParam = params['RTL_CLIMB_MIN'];
    const currentRtlAltM = rtlAltParam
      ? encodeParameterValue(rtlAltParam.param_value, rtlAltParam.param_type) / 100
      : 15; // safe default: 15 m

    // Check a mission is loaded before showing the dialog
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
          `<b>Mission:</b> ${get(missionPlanTitleStore)}<br><br>` +
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

          // Step 1 — Write RTL_ALT and RTL_CLIMB_MIN
          const rtlAltValueCm = parseInt(rtlAltInput ?? String(currentRtlAltM)) * 100;
          await writeParameter('RTL_ALT', rtlAltValueCm, rtlAltParam?.param_type ?? 6);
          if (rtlClimbParam) {
            await writeParameter('RTL_CLIMB_MIN', 0, rtlClimbParam.param_type);
          }

          if (get(mavStateStore) === 'STANDBY') {
            // Step 2 — Switch to GUIDED (required before arming from GCS)
            await sendMavlinkCommand('DO_SET_MODE', `${[1, 4]}`, true);
            await new Promise(resolve => setTimeout(resolve, 300));

            // Step 2b ? Disable RC failsafes so GCS-only flight works without RC transmitter
            // FS_THR_ENABLE=0: disable RC throttle failsafe
            // RC_OVERRIDE_TIME=-1: GCS override never expires
            await writeParam('FS_THR_ENABLE', 0, 6);
            await writeParam('RC_OVERRIDE_TIME', -1, 9);
            await new Promise(resolve => setTimeout(resolve, 500));

            // Step 3 -- Disable ARMING_CHECK and wait for FC to apply it
            await writeParam('ARMING_CHECK', 0, 6);
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Step 4 -- Arm with up to 3 retries (FC may reject first attempt)
            let armed = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
              await sendMavlinkCommand('COMPONENT_ARM_DISARM', `${[1, 21196]}`, true);
              armed = await waitForArmed(3000);
              if (armed) break;
              console.warn(`[MissionPlan] Arm attempt ${attempt} failed, retrying...`);
              await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Step 5 -- Restore ARMING_CHECK regardless of arm result
            await writeParam('ARMING_CHECK', 1, 6);

            if (!armed) {
              const n = new Notification({
                target: document.body,
                props: {
                  title: 'Arming Failed',
                  content: 'The vehicle did not arm after 3 attempts. Check pre-arm errors in the FC (compass, EKF, RC calibration).',
                  type: 'error',
                }
              });
              setTimeout(() => n.$destroy(), 10000);
              return;
            }

            // Step 6 -- Takeoff to 10 m using current GPS position
            // NAV_TAKEOFF in GUIDED mode needs current lat/lon in param5/6 (?1e7),
            // NOT zeros ? zeros cause Cube Orange to ignore the command.
            const takeoffLoc = get(mavLocationStore);
            const takeoffLat = Math.round(takeoffLoc.lat * 1e7);
            const takeoffLon = Math.round(takeoffLoc.lng * 1e7);
            // params: [pitch_deg, empty, empty, yaw_deg, lat?1e7, lon?1e7, alt_m]
            await sendMavlinkCommand('NAV_TAKEOFF', `${[0, 0, 0, 0, takeoffLat, takeoffLon, 10]}`, false);
            console.log(`[MissionPlan] NAV_TAKEOFF sent: lat=${takeoffLat} lon=${takeoffLon} alt=10m`);

            // Step 7 -- Wait for the vehicle to reach takeoff altitude (up to 20 s)
            await waitForAltitude(8, 20000);
          }

          // Step 9 — Switch to AUTO and begin mission
          await sendMavlinkCommand('DO_SET_MODE', `${[1, 3]}`, true);

          const notification = new Notification({
            target: document.body,
            props: { title: '✅ Mission Started', content: `${get(missionPlanTitleStore)} is now running in AUTO mode.`, type: 'success' }
          });
          setTimeout(() => notification.$destroy(), 8000);
        },
      }
    });
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
          if (mavMode !== 'GUIDED') await sendMavlinkCommand('DO_SET_MODE', `${[1, 4]}`, 'true'); // param2: 4 (GUIDED) see CopterMode enum in /mavlink-mappings/dist/lib/ardupilotmega.ts
          await sendMavlinkCommand('DO_SET_SERVO' , `${[9, 1050]}`); // param2 - 1900: release, 1100: grip
          await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 0.5 seconds
          await sendMavlinkCommand('DO_SET_SERVO' , `${[9, 1950]}`); // param2 - 1900: release, 1100: grip
          modal.$destroy();
        },
      }
    });
  }

  function addAction() {
    mavLocation = get(mavLocationStore)!;
    actions = get(missionPlanActionsStore);

    // Determine the next index
    const newIndex = Object.keys(actions).length;

    let location = { lat: 0, lng: 0 };
    let type = 'NAV_WAYPOINT';
    if (newIndex === 0 || newIndex === 1) type = 'NAV_TAKEOFF';
    if (newIndex === 0 || newIndex === 1) location = mavLocation;
    else location = {
      lat: Object.values(actions)[newIndex - 1].lat,
      lng: Object.values(actions)[newIndex - 1].lon
    };

    // Add new action
    actions = { 
      ...actions, 
      [newIndex]: {
        type: type,
        lat: location.lat,
        lon: location.lng,
        alt: null,
        notes: '',
        param1: null,
        param2: null,
        param3: null,
        param4: null,
      }
    };

    missionPlanActionsStore.set(actions);
    if (newIndex === 0) addAction();
  }

  async function removeAction(id: string) {
    const modal = new Modal({
      target: document.body,
      props: {
        title: "Delete Action",
        content: "Are you sure you want to delete this action?",
        isOpen: true,
        confirmation: true,
        notification: false,
        onConfirm: () => {
          handleRemove(parseInt(id));
          modal.$destroy();
        },
        onCancel: () => {
          modal.$destroy();
        },
      },
    });
  }

  function handleRemove(index: number) {
    // Remove the corresponding DOM element
    const actionElement = document.querySelector(`#action-${index}`) as HTMLSelectElement;
    if (actionElement) {
      actionElement.remove();
    }

    // Remove the specified action
    const { [index]: _, ...remainingActions } = actions;
    actions = remainingActions; // Trigger reactivity by creating a new object

    // Update the map with new action count
    reindexActions(); // Ensure this function handles reindexing correctly
  }

  function reindexActions() {
    const newActions: MissionPlanActions = {};
    Object.values(actions).forEach((action, index) => {
      newActions[index] = action;
    });
    actions = newActions;
    missionPlanActionsStore.set(actions);
  
    // Update UI to reflect new indexes
    updateActionUI();
  }

  function updateActionUI() {
    const actionContainers = document.querySelectorAll('.action-container');
    actionContainers.forEach((container, index) => {
      container.id = `action-${index}`;
      container.querySelector('span')!.textContent = `${index}`;
      container.querySelectorAll('input').forEach((input) => {
        const id = input.id.split('-');
        id[1] = String(index);
        input.id = id.join('-');
      });
      container.querySelectorAll('label').forEach((label) => {
        const id = label.htmlFor.split('-');
        id[1] = String(index);
        label.htmlFor = id.join('-');
      });
      container.querySelectorAll('select').forEach((select) => {
        const id = select.id.split('-');
        id[1] = String(index);
        select.id = id.join('-');
      });
      container.querySelectorAll('button').forEach((button) => {
        const id = button.id.split('-');
        id[1] = String(index);
        button.id = id.join('-');
      });
    });
  }

  function updateTitle(event: Event) {
    const input = event.target as HTMLInputElement;
    title = input.value;
    missionPlanTitleStore.set(title);
  }

  function updateActionType(event: Event) {
    const select = event.target as HTMLSelectElement;
    const index = Number(select.id.split('-')[1]);
    actions[index].type = select.value;
    if (select.value === 'DO_SET_SERVO') {
      actions[index].param1 = 9;
      actions[index].param2 = 1950;
      actions[index].param3 = null;
      actions[index].param4 = null;
    } else if (select.value === 'DO_REPEAT_SERVO') {
      actions[index].param1 = 9;
      actions[index].param2 = 1950;
      actions[index].param3 = 2;
      actions[index].param4 = 1;
    } else {
      actions[index].param1 = null;
      actions[index].param2 = null;
      actions[index].param3 = null;
      actions[index].param4 = null;
    }
    missionPlanActionsStore.set(actions);
  }

  function updateLat(event: Event) {
    const input = event.target as HTMLInputElement;
    const index = Number(input.id.split('-')[1]);
    actions[index].lat = Number(input.value);
    missionPlanActionsStore.set(actions);
  }

  function updateLon(event: Event) {
    const input = event.target as HTMLInputElement;
    const index = Number(input.id.split('-')[1]);
    actions[index].lon = Number(input.value);
    missionPlanActionsStore.set(actions);
  }

  function updateAltitude(event: Event) {
    const input = event.target as HTMLInputElement;
    const index = Number(input.id.split('-')[1]);
    actions[index].alt = Number(input.value);
    missionPlanActionsStore.set(actions);
  }

  function updateNotes(event: Event) {
    const input = event.target as HTMLInputElement;
    const index = Number(input.id.split('-')[1]);
    actions[index].notes = input.value;
    missionPlanActionsStore.set(actions);
  }

  function updateParam(event: Event) {
    const input = event.target as HTMLInputElement;
    const index = Number(input.id.split('-')[1]);
    actions[index][`${input.id.split('-')[0]}`] = Number(input.value);
    missionPlanActionsStore.set(actions);
  }
  
  function checkMode(target: string, mode: string) {
    return target.includes(mode);
  }
</script>

<div
  class="missionPlan p-4 rounded-2xl space-x-4 items-center h-full"
  style="--primaryColor: {primaryColor}; --secondaryColor: {secondaryColor}; --tertiaryColor: {tertiaryColor}; --fontColor: {fontColor};"
>
  <div class="container block">
    <input type="text" class="text-md font-bold mb-2 ml-4 focus:outline-none" placeholder="Untitled Mission" id="mission-plan-title" bind:value={title} on:input={(event) => updateTitle(event)} />
    <div class="mission-btns flex items-center gap-2 float-right text-sm">
      <a href="https://ardupilot.org/planner/docs/common-planning-a-mission-with-waypoints-and-events.html" target="_blank" class="text-[#61cd89] hover:underline mr-2">
        <i class="fas fa-question-circle"></i>
        How do I create a mission plan?
      </a>
      <button class="px-2 py-1 bg-[#588ae7] rounded-lg hover:bg-[#6f9ff9]" on:click={() => {releasePayload()}}>
          <i class="fas fa-parachute-box"></i>
          <div class="tooltip">Release Payload</div>
      </button>
      {#if !checkMode('AUTO', mavMode) || systemState === 'STANDBY'}
        <button class="px-2 py-1 bg-[#55b377] rounded-lg hover:bg-[#61cd89]"
          disabled={checkMode('AUTO', mavMode) && systemState !== 'STANDBY' || !missionLoaded}
          on:click={() => {startMission()}}
        >
          <i class="fas fa-play"></i>
          <div class="tooltip">Start/Resume Mission</div>
        </button>
      {:else}
        <button class="px-2 py-1 bg-[#da864e] rounded-lg hover:bg-[#ff995e]"
          disabled={!checkMode('AUTO', mavMode) || !missionLoaded}
          on:click={() => {pauseMission()}}
        >
          <i class="fas fa-pause"></i>
          <div class="tooltip">Pause Mission (POSHOLD)</div>
        </button>
      {/if}
      <button class="px-2 py-1 bg-[#f87171] rounded-lg hover:bg-[#ff7e7e]"
          disabled={!checkMode('AUTO', mavMode) || !missionLoaded}
          on:click={() => {stopMission()}}
        >
        <i class="fas fa-stop"></i>
        <div class="tooltip">Stop Mission (RTL)</div>
      </button>
    </div>
    <div class="column overflow-auto" id="mission-plan-actions">
      <div class="overflow-auto">
        <hr>
        {#key actions}
          {#each Object.keys(actions) as index}
            {#if Number(index) !== 0 }
              <div id="action-{index}" class="flex items-center action-container">
                  <div class="form-checkbox">
                      <span>{index}</span>
                  </div>
                  <div class="separator"></div>
                  <div class="form-input text-center">
                      <label for="action" class="text-[9pt]">Action Type</label>
                      <a href="https://ardupilot.org/copter/docs/mission-command-list.html" target="_blank" class="text-[#61cd89] ml-1" title="More Information">
                          <i class="fas fa-info-circle text-[9pt]"></i>
                      </a>
                      <select class="mt-1" name="action" id="action-{index}-type" on:change={updateActionType} value={actions[Number(index)].type}>
                      {#each action_types as action_type}
                          <option value="{action_type}">{action_type}</option>
                      {/each}
                      </select>
                      <div class="text-center flex justify-center items-center gap-2 mt-2">
                        <label for="altitude" class="text-[9pt] mr-1">Altitude</label>
                        <input type="number" min="0" max="100" name="altitude" id="altitude-{index}" class="altitude" placeholder="0: current alt" value={String(actions[Number(index)].alt ?? '')} on:change={updateAltitude}>
                        <span class="text-xs text-gray-400">m</span>
                      </div>
                  </div>
                  <div class="separator"></div>
                  <div class="form-input text-center grid gap-1">
                    <h2 class="text-[9pt]">
                      Coordinates
                      <a href="https://www.latlong.net/" target="_blank" class="text-[#61cd89] ml-1" title="Get Coordinates">
                        <i class="fas fa-info-circle"></i>
                      </a>
                    </h2>
                    <div class="flex justify-between items-center gap-1">
                      <span class="text-[8pt] mr-2">Lat</span>
                      <input type="number" step="0.00001" id="lat-{index}" placeholder="eg. 33.749" value={actions[Number(index)].lat} on:change={updateLat} />
                      <span class="text-lg text-gray-400">°</span>
                    </div>
                    <div class="flex justify-between items-center gap-1">
                      <span class="text-[8pt] mr-2">Lon</span>
                      <input type="number" step="0.00001" id="lon-{index}" placeholder="eg. -84.388" value={actions[Number(index)].lon} on:change={updateLon} />
                      <span class="text-lg text-gray-400">°</span>
                    </div>
                  </div>
                  <div class="separator"></div>
                  <div class="form-input text-center grid gap-1">
                    <h2 class="text-[9pt] mb-1">
                      Parameters
                      <a href="https://mavlink.io/en/messages/common.html#mav_commands" target="_blank" class="text-[#61cd89] ml-1" title="More Information">
                        <i class="fas fa-info-circle"></i>
                      </a>
                    </h2>
                    <div class="flex justify-between items-center gap-3">
                      <div class="flex justify-between items-center gap-3">
                        <span class="text-[8pt]">P1</span>
                        <input type="number" id="param1-{index}" placeholder="Empty" value={actions[Number(index)].param1} on:change={updateParam} />
                      </div>
                      <div class="flex justify-between items-center gap-3">
                        <span class="text-[8pt]">P2</span>
                        <input type="number" id="param2-{index}" placeholder="Empty" value={actions[Number(index)].param2} on:change={updateParam} />
                      </div>
                    </div>
                    <div class="flex justify-between items-center gap-3">
                      <div class="flex justify-between items-center gap-3">
                        <span class="text-[8pt]">P3</span>
                        <input type="number" id="param3-{index}" placeholder="Empty" value={actions[Number(index)].param3} on:change={updateParam} />
                      </div>
                      <div class="flex justify-between items-center gap-3">
                        <span class="text-[8pt]">P4</span>
                        <input type="number" id="param4-{index}" placeholder="Empty" value={actions[Number(index)].param4} on:change={updateParam} />
                      </div>
                    </div>
                  </div>
                  <div class="separator"></div>
                  <div class="form-input flex flex-col gap-1 items-center justify-center">
                      <h2 class="text-[9pt]">Additional Notes</h2>
                      <textarea placeholder="Notes" value={actions[Number(index)].notes} id="notes-{index}" on:change={updateNotes}></textarea>
                  </div>
                  <div class="separator"></div>
                  <button class="delete-action relative rounded-lg px-3 py-2 text-sm" on:click={() => removeAction(index)}>
                      <i class="fas fa-trash-alt text-red-400"></i>
                      <span class="tooltip">Delete Action</span>
                  </button>
              </div>
              <hr>
            {/if}
          {/each}
        {/key}
      </div>
      <div class="flex justify-center">
        <button class="add-action rounded-lg px-4 py-2 my-4" on:click={addAction}>
          <i class="fas fa-plus"></i>&nbsp;&nbsp;Add Action
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .column {
    flex: 1;
    padding: 0 1rem;
  }

  .separator {
    height: 4vh;
    background-color: var(--secondaryColor);
    margin: 0 1em;
    padding: 1px;
    border-radius: 0.5rem;
  }

  hr {
    border: 0;
    border-top: 1px solid var(--secondaryColor);
  }

  .form-checkbox {
    display: flex;
    align-items: center;
  }

  .form-checkbox:checked {
    background-color: #61cd89;
  }

  .form-input {
    padding: 0.5rem;
    font-size: 0.875rem;
  }

  input, select {
    border: none;
    border-radius: 0.5rem;
    padding-inline: 0.5em;
    padding-block: 0.25em;
    background-color: var(--secondaryColor);
    color: var(--fontColor);
  }

  input:focus, select:focus {
    border-color: #61cd89;
  }

  .form-input:focus {
    outline: none;
    border-color: #61cd89;
  }

  input[type='number'] {
    width: 100px;
    font-size: 9pt;
  }

  .altitude {
    width: 100px !important;
  }

  textarea {
    width: 120px;
    background-color: var(--secondaryColor);
    border-radius: 1em;
    padding: 0.5rem;
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
    z-index: 2;
  }

  button:hover .tooltip {
    opacity: 1;
    visibility: visible;
    transform: translateX(-50%) translateY(-0.25em);
  }

  .add-action {
    background-color: var(--secondaryColor);
  }

  .delete-action {
    background-color: var(--secondaryColor);
  }

  .delete-action:hover {
    background-color: #ff7e7e;
  }

  .delete-action:hover i {
    color: var(--fontColor);
  }

  .delete-action .tooltip {
    bottom: 0;
    left: 0;
    margin-bottom: 0;
  }

  .delete-action:hover .tooltip {
    transform: translateX(-108%);
  }

  button {
    position: relative;
  }
  
  button:disabled, button:disabled:hover {
    filter: brightness(0.5);
    cursor: not-allowed;
  }

  .mission-btns > button {
    color: white;
  }

  #mission-plan-actions {
    max-height: 215px;
  }

  .missionPlan {
    color: var(--fontColor);
    background-color: var(--primaryColor);
  }

  /* Mobile Styles */
  @media (max-width: 990px) {
    .missionPlan {
      overflow: hidden;
      overflow-y: auto;
    }

    #mission-plan-title {
      margin-inline: 0;
    }

    .float-right {
      display: block;
      margin-bottom: 1em;
    }
    a {
      font-size: small;
    }
    
    .container {
      display: inline-grid;
      align-items: center;
      justify-content: center;
    }
  }

  @media (max-width: 1320px) {
    #mission-plan-actions {
      max-height: 260px;
    }
  }
  @media (max-width: 1060px) {
    #mission-plan-actions {
      max-height: 270px;
    }
  }
  @media (max-width: 1500px) {
    @media (min-width: 1300px) {
      #mission-plan-actions {
        max-height: 240px;
      }
    }
  }
</style>
