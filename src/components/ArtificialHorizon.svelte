<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import {
    mavHeadingStore,
    mavPitchStore,
    mavRollStore,
    mavAltitudeStore,
    mavSpeedStore,
    mavArmedStateStore,
    mavModeStore,
    mavBatteryStore,
    mavSatelliteStore,
    onlineStore
  } from '../stores/mavlinkStore';

  const dispatch = createEventDispatcher<{ toggle: void }>();

  // When true the parent has expanded us to overlay the video feed.
  // The parent controls this — we just render the button state correctly.
  export let expanded: boolean = false;

  // Props (all driven by stores)
  export let pitch: number    = 0;
  export let roll: number     = 0;
  export let heading: number  = 0;
  export let airspeed: number = 0;
  export let groundspeed: number = 0;
  export let altitude: number = 0;

  $: pitch      = $mavPitchStore;
  $: roll       = $mavRollStore;
  $: heading    = $mavHeadingStore;
  $: altitude   = $mavAltitudeStore;
  $: airspeed   = $mavSpeedStore;
  $: groundspeed = $mavSpeedStore;

  $: armed     = $mavArmedStateStore;
  $: mode      = $mavModeStore;
  $: battery   = $mavBatteryStore;
  $: sats      = $mavSatelliteStore;
  $: online    = $onlineStore;

  // ── Dimensions (matched to a 760×430 reference viewport) ─────────────
  // The component fills its container; all measurements use % or viewBox units.
  // We use an SVG overlay for the attitude area so everything scales cleanly.

  // Pixels per degree for pitch ladder (in the 430-tall SVG)
  const PX_PER_DEG = 20;

  // Pitch ladder lines to draw (degrees)
  const pitchLines = [-20, -10, 10, 20];

  // ── Heading tape ─────────────────────────────────────────────────────
  // We generate marks in ±55° window around current heading
  const HDG_PX_PER_DEG = 5.5; // px per degree in a 760-wide tape
  function hdgMarks(h: number) {
    const out: { x: number; label: string; major: boolean }[] = [];
    for (let d = Math.floor(h - 55); d <= Math.ceil(h + 55); d++) {
      if (d % 5 !== 0) continue;
      const norm = ((d % 360) + 360) % 360;
      const x = (d - h) * HDG_PX_PER_DEG + 380; // 380 = center of 760
      let label = '';
      let major = false;
      if (norm % 45 === 0) {
        const map: Record<number,string> = {0:'N',45:'NE',90:'E',135:'SE',180:'S',225:'SW',270:'W',315:'NW'};
        label = map[norm];
        major = true;
      } else if (norm % 10 === 0) {
        label = String(norm);
        major = true;
      }
      out.push({ x, label, major });
    }
    return out;
  }
  $: hdgTicks = hdgMarks(heading);

  // ── Airspeed tape ─────────────────────────────────────────────────────
  // 5-unit grid, 20px per unit in a 430-tall tape
  const SPD_PX = 20;
  function spdMarks(v: number) {
    const out: { y: number; val: number }[] = [];
    const center = 215; // vertical center of tape
    for (let s = Math.floor(v / 5) * 5 - 40; s <= Math.ceil(v / 5) * 5 + 40; s += 5) {
      const y = center - (s - v) * SPD_PX;
      if (y < 0 || y > 430) continue;
      out.push({ y, val: s });
    }
    return out;
  }
  $: spdTicks = spdMarks(airspeed);

  // ── Altitude tape ─────────────────────────────────────────────────────
  const ALT_PX = 20;
  function altMarks(v: number) {
    const out: { y: number; val: number }[] = [];
    const center = 215;
    for (let a = Math.floor(v / 5) * 5 - 40; a <= Math.ceil(v / 5) * 5 + 40; a += 5) {
      const y = center - (a - v) * ALT_PX;
      if (y < 0 || y > 430) continue;
      out.push({ y, val: a });
    }
    return out;
  }
  $: altTicks = altMarks(altitude);

  // ── Clock ─────────────────────────────────────────────────────────────
  let clock = '00:00:00';
  function tick() {
    const n = new Date();
    clock = n.toTimeString().slice(0, 8);
  }
  let timer: ReturnType<typeof setInterval>;
  onMount(() => { tick(); timer = setInterval(tick, 1000); });
  onDestroy(() => clearInterval(timer));

  // ── Derived status ────────────────────────────────────────────────────
  $: gpsLabel = sats.total > 0 ? `GPS: ${sats.total} sats` : 'GPS: No GPS';
  $: readyToArm = online && sats.total > 5;
  $: battPct = battery != null ? battery.toFixed(0) : '0';

  // ── Roll arc geometry (SVG viewBox 760 × 300) ────────────────────────
  // Arc center: (380, 370); radius: 320
  // Arc goes from -60° to +60° around top (i.e. 210° to 330° in SVG angles)
  // SVG angle 0 = right, so "up" = 270°. Arc from 210° to 330° (−60 to +60 rel up).
  const ARC_CX = 380;
  const ARC_CY = 380;
  const ARC_R  = 320;

  // Convert roll-relative degree to SVG coord on the arc
  // 0° roll = top of arc (SVG angle 270°), positive = clockwise
  function arcPoint(deg: number, r: number) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: ARC_CX + r * Math.cos(rad), y: ARC_CY + r * Math.sin(rad) };
  }

  // Tick marks: 0, ±10, ±20, ±30, ±45, ±60
  const rollTickDefs = [
    { deg: 0,   len: 18, label: '' },
    { deg: 10,  len: 12, label: '10' },
    { deg: -10, len: 12, label: '10' },
    { deg: 20,  len: 12, label: '20' },
    { deg: -20, len: 12, label: '20' },
    { deg: 30,  len: 18, label: '30' },
    { deg: -30, len: 18, label: '30' },
    { deg: 45,  len: 12, label: '45' },
    { deg: -45, len: 12, label: '45' },
    { deg: 60,  len: 18, label: '60' },
    { deg: -60, len: 18, label: '60' },
  ];

  // Arc path: large semi-circle from -60 to +60
  const p1 = arcPoint(-60, ARC_R);
  const p2 = arcPoint(60,  ARC_R);
  const arcPath = `M ${p1.x},${p1.y} A ${ARC_R},${ARC_R} 0 0,1 ${p2.x},${p2.y}`;
</script>

<!--
  The whole component is one SVG (viewBox 760 430) so it scales perfectly
  to any container size while keeping pixel-perfect proportions.
  Layout zones inside the viewBox:
    x=0..65    : airspeed tape
    x=65..695  : attitude + roll arc + heading tape
    x=695..760 : altitude tape
    y=0..28    : heading tape strip
    y=28..370  : main attitude + tapes
    y=370..400 : "Not Ready to Arm" / "Ready to Arm"
    y=400..430 : status bar
-->
<div class="pfd-wrap">
<!-- Expand / collapse button -->
<button
  class="pfd-expand-btn"
  title={expanded ? 'Collapse PFD' : 'Expand PFD over video'}
  on:click={() => dispatch('toggle')}
>
  {#if expanded}
    <!-- collapse icon: inward arrows -->
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M5.5 0v5.5H0v1h6.5V0h-1zM10.5 0v6.5H16v-1h-4.5V0h-1zM0 9.5v1h4.5V16h1v-6.5H0zM10.5 10.5V16h1v-4.5H16v-1h-5.5z"/>
    </svg>
  {:else}
    <!-- expand icon: outward arrows -->
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M1.5 1H6V0H0v6h1V1.5l4.5 4.5.7-.7L1.5 1zM10 0v1h4.5l-4.5 4.5.7.7L15 1.7V6h1V0h-6zM1.5 15l4.5-4.5-.7-.7L1 14.3V10H0v6h6v-1H1.5zM10.5 15H15v-4.5l-4.5 4.5-.7-.7L14.5 10H10V9H16v6h-5.5v-1z"/>
    </svg>
  {/if}
</button>

<svg
  class="pfd-svg"
  viewBox="0 0 760 430"
  xmlns="http://www.w3.org/2000/svg"
  preserveAspectRatio="xMidYMid meet"
>
  <!-- ═══════════════════════════════════════════════════════════════════
       BACKGROUND — full black base
  ═══════════════════════════════════════════════════════════════════ -->
  <rect x="0" y="0" width="760" height="430" fill="#000"/>

  <!-- ═══════════════════════════════════════════════════════════════════
       ATTITUDE AREA  x=65..695  y=28..370
       Sky + Ground rotated by roll, translated by pitch
  ═══════════════════════════════════════════════════════════════════ -->
  <clipPath id="att-clip">
    <rect x="65" y="28" width="630" height="342"/>
  </clipPath>

  <g clip-path="url(#att-clip)">
    <!-- Rotate around center of attitude area -->
    <g transform="rotate({roll}, 380, 199)">
      <!-- Pitch translate: positive pitch → nose up → horizon moves down -->
      <g transform="translate(0, {pitch * PX_PER_DEG})">

        <!-- Sky: very tall so it covers any pitch -->
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="#1a6fbd"/>
            <stop offset="100%" stop-color="#5ab0e8"/>
          </linearGradient>
          <linearGradient id="gndGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="#7a9a25"/>
            <stop offset="100%" stop-color="#5a7518"/>
          </linearGradient>
        </defs>
        <rect x="-500" y="-900" width="1760" height="900" fill="url(#skyGrad)"/>
        <!-- Ground: starts at y=199 (horizon) -->
        <rect x="-500" y="199" width="1760" height="900" fill="url(#gndGrad)"/>

        <!-- ── Pitch ladder ── -->
        <!-- horizon (0°) — green center segment + red wings -->
        <!-- The white horizon divider line -->
        <line x1="-500" y1="199" x2="1260" y2="199" stroke="#666" stroke-width="1"/>

        <!-- Red reference wings at 0° pitch (fixed distance from center) -->
        <line x1="200" y1="199" x2="300" y2="199" stroke="#cc2222" stroke-width="3"/>
        <line x1="460" y1="199" x2="560" y2="199" stroke="#cc2222" stroke-width="3"/>
        <!-- Green center tick at horizon -->
        <rect x="373" y="195" width="14" height="8" fill="#22aa44"/>

        <!-- Pitch lines — positive = above horizon, negative = below -->
        {#each pitchLines as deg}
          {@const cy = 199 - deg * PX_PER_DEG}
          {@const halfW = Math.abs(deg) === 10 ? 55 : 85}
          <!-- left line -->
          <line x1={380 - halfW} y1={cy} x2={380 - 10} y2={cy}
                stroke="white" stroke-width="1.8"/>
          <!-- right line -->
          <line x1={380 + 10} y1={cy} x2={380 + halfW} y2={cy}
                stroke="white" stroke-width="1.8"/>
          <!-- label (left side) -->
          <text x={380 - halfW - 22} y={cy + 5}
                fill="white" font-size="15" text-anchor="middle"
                font-family="Arial, sans-serif">{deg}</text>
        {/each}

      </g><!-- /pitch translate -->
    </g><!-- /roll rotate -->
  </g><!-- /att-clip -->

  <!-- ═══════════════════════════════════════════════════════════════════
       FIXED OVERLAY (not clipped, not rotated)
  ═══════════════════════════════════════════════════════════════════ -->

  <!-- ── Aircraft symbol (fixed center, red V chevron + wings) ── -->
  <!-- Left red wing bar -->
  <line x1="245" y1="227" x2="340" y2="227" stroke="#dd2222" stroke-width="3.5"/>
  <!-- Right red wing bar -->
  <line x1="420" y1="227" x2="515" y2="227" stroke="#dd2222" stroke-width="3.5"/>
  <!-- V-chevron body -->
  <polyline points="280,215 355,245 380,238 405,245 480,215"
            fill="none" stroke="#dd2222" stroke-width="3.5"
            stroke-linejoin="round" stroke-linecap="round"/>
  <!-- Center green dot -->
  <rect x="375" y="222" width="10" height="10" fill="#22aa44"/>

  <!-- ── DISARMED / ARMED text ── -->
  {#if !armed}
    <text x="380" y="210" fill="#ff2020" font-size="40" font-weight="bold"
          text-anchor="middle" font-family="Arial, sans-serif"
          filter="url(#shadow)">DISARMED</text>
  {:else}
    <text x="380" y="210" fill="#22ff44" font-size="40" font-weight="bold"
          text-anchor="middle" font-family="Arial, sans-serif">ARMED</text>
  {/if}

  <!-- Drop shadow filter for DISARMED text -->
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="1" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.7"/>
    </filter>
  </defs>

  <!-- ═══════════════════════════════════════════════════════════════════
       ROLL ARC — on top of attitude, clipped to attitude zone
  ═══════════════════════════════════════════════════════════════════ -->
  <clipPath id="arc-clip">
    <rect x="65" y="28" width="630" height="342"/>
  </clipPath>
  <g clip-path="url(#arc-clip)">
    <!-- Arc -->
    <path d="{arcPath}" fill="none" stroke="white" stroke-width="2" opacity="0.85"/>

    <!-- Tick marks and labels -->
    {#each rollTickDefs as t}
      {@const outer = arcPoint(t.deg, ARC_R)}
      {@const inner = arcPoint(t.deg, ARC_R - t.len)}
      {@const labelPt = arcPoint(t.deg, ARC_R - t.len - 16)}
      <line x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
            stroke="white" stroke-width={Math.abs(t.deg) % 30 === 0 ? 2 : 1.5}
            opacity="0.85"/>
      {#if t.label}
        <text x={labelPt.x} y={labelPt.y + 5}
              fill="white" font-size="13" text-anchor="middle"
              font-family="Arial, sans-serif" opacity="0.9">{t.label}</text>
      {/if}
    {/each}

    <!-- Roll pointer triangle (rotates around arc center with roll) -->
    <g transform="rotate({roll}, {ARC_CX}, {ARC_CY})">
      <!-- Triangle at top of arc pointing down (toward center) -->
      <polygon
        points="{ARC_CX},{ARC_CY - ARC_R - 5}
                {ARC_CX - 7},{ARC_CY - ARC_R - 20}
                {ARC_CX + 7},{ARC_CY - ARC_R - 20}"
        fill="none" stroke="#ff3333" stroke-width="2"/>
    </g>
  </g>

  <!-- ═══════════════════════════════════════════════════════════════════
       HEADING TAPE  y=0..28
  ═══════════════════════════════════════════════════════════════════ -->
  <rect x="0" y="0" width="760" height="28" fill="rgba(10,20,50,0.88)"/>
  <!-- Thin separator line -->
  <line x1="0" y1="28" x2="760" y2="28" stroke="#445" stroke-width="1"/>

  <clipPath id="hdg-clip"><rect x="65" y="0" width="630" height="28"/></clipPath>
  <g clip-path="url(#hdg-clip)">
    {#each hdgTicks as t}
      <line x1={t.x} y1="28" x2={t.x} y2={t.major ? 18 : 22}
            stroke={t.major ? '#fff' : '#888'} stroke-width={t.major ? 1.5 : 1}/>
      {#if t.label}
        <text x={t.x} y="14" fill="#ddd" font-size="12" text-anchor="middle"
              font-family="Arial, sans-serif">{t.label}</text>
      {/if}
    {/each}
  </g>
  <!-- Heading box (current heading) -->
  <rect x="352" y="0" width="56" height="28" fill="#000" stroke="#fff" stroke-width="1.5"/>
  <text x="380" y="19" fill="#fff" font-size="14" font-weight="bold"
        text-anchor="middle" font-family="Arial, sans-serif">{Math.round(heading)}</text>

  <!-- ═══════════════════════════════════════════════════════════════════
       AIRSPEED TAPE  x=0..65  y=28..370
  ═══════════════════════════════════════════════════════════════════ -->
  <!-- Background -->
  <rect x="0" y="28" width="65" height="342" fill="rgba(200,210,220,0.15)" stroke="#555" stroke-width="1"/>

  <clipPath id="spd-clip"><rect x="0" y="28" width="65" height="342"/></clipPath>
  <g clip-path="url(#spd-clip)">
    {#each spdTicks as t}
      {@const gy = t.y + 28}
      <line x1="55" y1={gy} x2="65" y2={gy} stroke="#aaa" stroke-width="1.2"/>
      {#if t.val % 5 === 0}
        <text x="50" y={gy + 5} fill="#ccc" font-size="13"
              text-anchor="end" font-family="Arial, sans-serif">{t.val}</text>
      {/if}
    {/each}
  </g>
  <!-- Current speed box -->
  <rect x="0" y="196" width="65" height="26" fill="#000" stroke="#fff" stroke-width="1.5"/>
  <text x="32" y="213" fill="#fff" font-size="13" font-weight="bold"
        text-anchor="middle" font-family="Arial, sans-serif">{airspeed.toFixed(1)}m/s</text>
  <!-- AS / GS labels below tape -->
  <text x="3"  y="385" fill="#ddd" font-size="11" font-family="Arial, sans-serif">AS {airspeed.toFixed(1)}m/s</text>
  <text x="3"  y="398" fill="#ddd" font-size="11" font-family="Arial, sans-serif">GS {groundspeed.toFixed(1)}m/s</text>

  <!-- ═══════════════════════════════════════════════════════════════════
       ALTITUDE TAPE  x=695..760  y=28..370
  ═══════════════════════════════════════════════════════════════════ -->
  <rect x="695" y="28" width="65" height="342" fill="rgba(200,210,220,0.15)" stroke="#555" stroke-width="1"/>

  <clipPath id="alt-clip"><rect x="695" y="28" width="65" height="342"/></clipPath>
  <g clip-path="url(#alt-clip)">
    {#each altTicks as t}
      {@const gy = t.y + 28}
      <line x1="695" y1={gy} x2="705" y2={gy} stroke="#aaa" stroke-width="1.2"/>
      {#if t.val % 5 === 0}
        <text x="710" y={gy + 5} fill="#ccc" font-size="13"
              text-anchor="start" font-family="Arial, sans-serif">{t.val}</text>
      {/if}
    {/each}
  </g>
  <!-- Current altitude box -->
  <rect x="695" y="196" width="65" height="26" fill="#000" stroke="#fff" stroke-width="1.5"/>
  <text x="727" y="213" fill="#fff" font-size="13" font-weight="bold"
        text-anchor="middle" font-family="Arial, sans-serif">{altitude.toFixed(0)} m</text>
  <!-- Blue altitude bug -->
  <polygon points="760,209 753,205 753,213" fill="#3399ff"/>
  <!-- Mode + altitude ref below tape -->
  <text x="757" y="385" fill="#ddd" font-size="11" text-anchor="end"
        font-family="Arial, sans-serif">{mode}</text>
  <text x="757" y="398" fill="#ddd" font-size="11" text-anchor="end"
        font-family="Arial, sans-serif">0m&gt;0</text>

  <!-- ═══════════════════════════════════════════════════════════════════
       TOP-RIGHT OVERLAY — battery % (crossed out) + clock
  ═══════════════════════════════════════════════════════════════════ -->
  <!-- Battery % with red X cross-out -->
  <text x="730" y="58" fill="#ddd" font-size="14" text-anchor="middle"
        font-family="Arial, sans-serif">{battPct}%</text>
  <!-- Red X lines over battery -->
  <line x1="712" y1="48" x2="748" y2="65" stroke="#ff2020" stroke-width="2"/>
  <line x1="748" y1="48" x2="712" y2="65" stroke="#ff2020" stroke-width="2"/>
  <!-- Clock -->
  <text x="730" y="82" fill="#ddd" font-size="14" text-anchor="middle"
        font-family="Arial, sans-serif">{clock}</text>

  <!-- ═══════════════════════════════════════════════════════════════════
       NOT READY / READY BAR  y=370..390
  ═══════════════════════════════════════════════════════════════════ -->
  <rect x="0" y="370" width="760" height="22" fill="rgba(0,0,0,0.85)"/>
  {#if readyToArm}
    <text x="380" y="386" fill="#22ff44" font-size="14" font-weight="bold"
          text-anchor="middle" font-family="Arial, sans-serif">Ready to Arm</text>
  {:else}
    <text x="380" y="386" fill="#ff2020" font-size="14" font-weight="bold"
          text-anchor="middle" font-family="Arial, sans-serif">Not Ready to Arm</text>
  {/if}

  <!-- ═══════════════════════════════════════════════════════════════════
       STATUS BAR  y=392..430
  ═══════════════════════════════════════════════════════════════════ -->
  <rect x="0" y="392" width="760" height="38" fill="#000"/>
  <line x1="0" y1="392" x2="760" y2="392" stroke="#333" stroke-width="1"/>

  <!-- Bat -->
  <text x="8" y="415" fill="#ff3030" font-size="13" font-weight="bold"
        font-family="Arial, sans-serif">
    Bat1 {battery != null ? battery.toFixed(2) : '0.00'}v 0.0 A {battPct}%
  </text>
  <!-- EKF -->
  <text x="310" y="415" fill="#ff3030" font-size="13" font-weight="bold"
        font-family="Arial, sans-serif">EKF</text>
  <!-- Vibe -->
  <text x="390" y="415" fill="#ffffff" font-size="13" font-weight="bold"
        font-family="Arial, sans-serif">Vibe</text>
  <!-- GPS -->
  <text x="460" y="415" fill="#ff3030" font-size="13" font-weight="bold"
        font-family="Arial, sans-serif">{gpsLabel}</text>
</svg>
</div><!-- /pfd-wrap -->

<style>
  .pfd-wrap {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
  }

  .pfd-svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* Expand / collapse button — sits in the top-right corner of the PFD */
  .pfd-expand-btn {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 50;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.35);
    background: rgba(0,0,0,0.65);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    transition: background 0.15s;
  }

  .pfd-expand-btn:hover {
    background: rgba(50,130,220,0.75);
    border-color: rgba(255,255,255,0.6);
  }
</style>
