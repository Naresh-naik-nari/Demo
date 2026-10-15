<script lang="ts">
  import '@fortawesome/fontawesome-free/css/all.min.css';
  import { page } from '$app/stores';
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import { goto } from '$app/navigation';
  import '../app.css';
  import {
    onlineStore,
    mavBatteryStore,
    mavArmedStateStore,
  } from '../stores/mavlinkStore';
  import {
    missionPlanTitleStore,
    missionPlanActionsStore,
    missionCountStore,
    missionCompleteStore
  } from '../stores/missionPlanStore';
  import {
    darkModeStore,
    primaryColorStore,
    secondaryColorStore,
    tertiaryColorStore,
    audoNotificationStore
  } from '../stores/customizationStore';
  import { loggedInStore } from '../stores/authStore';
  import { get } from 'svelte/store';
  import { mavlinkLogStore } from '../stores/mavlinkStore';
  import Notification from '../components/Notification.svelte';
  import ConnectionModal from '../components/ConnectionModal.svelte';
  import { mapTypeStore } from '../stores/mapStore';
  import { buildMessageHandlers, processLogLine } from '$lib/mavlink/parser';
  import { showNotification } from '$lib/utils/notifications';
  import type { NotificationConfig } from '$lib/utils/notifications';
  import { disconnect as mavDisconnect, getStatus, heartbeat as mavHeartbeat, loadMission as mavLoadMission, requestParams } from '$lib/api/mavlink';
  import { listMissions } from '$lib/api/mission';

  let showPortModal = false;

  let currentPath = '';
  let heightOfDashboard = 1000;
  let logs: string[] = [];
  let online = get(onlineStore);
  let serialConnected = false;
  let serialConnecting = false;

  // RTLL guard — mutable object so parser mutations are reflected here
  const rtllState = { triggered: false };

  // Pre-build the handler map once; it's bound to rtllState and showNotification
  const messageHandlers = buildMessageHandlers({ showNotification, rtllState });

  async function toggleSerialConnection() {
    if (serialConnecting) return;
    if (serialConnected) {
      serialConnecting = true;
      try {
        await mavDisconnect();
        serialConnected = false;
        window.location.reload();
      } catch (e) {
        console.warn('Disconnect failed:', e);
      } finally {
        serialConnecting = false;
      }
    } else {
      showPortModal = true;
    }
  }

  async function handlePortSelected(_config: unknown) {
    await syncSerialStatus();
  }

  async function syncSerialStatus() {
    try {
      const data = await getStatus();
      serialConnected = data.portOpen || data.connected || data.online;
      onlineStore.set(serialConnected);
    } catch { /* ignore */ }
  }

  let statusCheckInterval: ReturnType<typeof setInterval>;
  let loggedIn = get(loggedInStore);

  const batteryAlerts = [50, 20, 15, 10, 5];
  let batteryAlertIndex = 0;
  let batteryAlertShown = false;

  $: loggedIn = $loggedInStore;
  $: battery = $mavBatteryStore;
  $: online = $onlineStore;
  $: audioNotification = $audoNotificationStore;
  $: darkMode = $darkModeStore;
  $: primaryColor = $primaryColorStore;
  $: secondaryColor = $secondaryColorStore;
  $: tertiaryColor = $tertiaryColorStore;
  $: fontColor = darkMode ? '#ffffff' : '#000000';
  $: currentPath = $page.url.pathname;
  $: isNavHidden = currentPath === '/' || currentPath === '/login' || currentPath === '/register';
  $: missionCountStore.set(Object.keys($missionPlanActionsStore).length - 1);

  // Battery threshold notifications
  $: if (battery && battery <= batteryAlerts[batteryAlertIndex] && !batteryAlertShown) {
    showNotification({
      title: 'Low Battery Alert',
      content: `Battery level is at ${battery}%. It's highly recommended to return to home or land immediately to prevent a crash.`,
      type: battery <= 20 ? 'error' : 'warning',
    });
    batteryAlertIndex++;
    batteryAlertShown = true;
  } else if (battery && battery > batteryAlerts[batteryAlertIndex]) {
    batteryAlertShown = false;
  }

  function updateDashboardHeight() {
    const dashboard = document.querySelector('.dashboard');
    if (dashboard) {
      heightOfDashboard = dashboard.clientHeight;
      if (window.location.pathname !== '/') {
        heightOfDashboard = dashboard.clientHeight;
        if (window.location.pathname !== '/dashboard') heightOfDashboard += 1;
        const nav = document.querySelector('.desktop-nav') as HTMLElement | null;
        if (nav) nav.style.opacity = '1';
        (dashboard as HTMLElement).style.opacity = '1';
      }
    }
  }

  let resizeObserver: ResizeObserver;

  async function checkOnlineStatus() {
    try {
      const data = await mavHeartbeat();
      data.logs.forEach((log: string) => {
        processLogLine(log.replace(/\\"/g, '"') + '\n', logs, messageHandlers, mavlinkLogStore);
      });
      const isConnected = data.portOpen || data.online;
      onlineStore.set(isConnected);
      serialConnected = isConnected;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[layout] checkOnlineStatus:', msg);
      onlineStore.set(false);
      serialConnected = false;
    }
  }

  async function checkLoadedMission() {
    try {
      const records = await listMissions();
      if (records.length > 0) {
        const loadedMission = records.find((m: { isLoaded: number }) => m.isLoaded === 1);
        if (loadedMission) {
          missionPlanTitleStore.set(loadedMission.title);
          missionPlanActionsStore.set(JSON.parse(loadedMission.actions));
          try {
            await mavLoadMission(JSON.parse(loadedMission.actions));
          } catch (err) {
            console.error('[layout] load_mission failed:', err);
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('The request was autocancelled')) return;
      console.error('[layout] checkLoadedMission:', error);
    }
  }

  async function requestParameters() {
    try {
      await requestParams();
    } catch (err: unknown) {
      console.error('[layout] requestParameters failed:', err instanceof Error ? err.message : err);
    }
  }

  onMount(async () => {
    const bg = document.querySelector('.bg') as HTMLElement | null;
    if (bg) bg.style.background = '#0a0a0f';
    document.body.classList.toggle('dark-mode', darkMode);

    syncSerialStatus();
    setInterval(syncSerialStatus, 3000);

    setInterval(() => {
      const nav = document.querySelector('.desktop-nav') as HTMLElement | null;
      if (!nav) return;
      const isAuthRoute = currentPath === '/' || currentPath === '/login' || currentPath === '/register';
      nav.style.display = isAuthRoute ? 'none' : 'grid';
    }, 1000);

    setTimeout(() => {
      checkLoadedMission();
      let paramRequestInterval = setInterval(async () => {
        if (get(onlineStore)) {
          clearInterval(paramRequestInterval);
          await requestParameters();
          console.log('📋 PARAM_REQUEST_LIST sent after connection confirmed');
        }
      }, 3000);
      setTimeout(() => clearInterval(paramRequestInterval), 120000);
    }, 2000);

    let checkCookieInterval = setInterval(() => {
      const lastActivity = parseInt(
        document.cookie.replace(/(?:(?:^|.*;\s*)lastActivity\s*=\s*([^;]*).*$)|^.*$/, '$1')
      );
      if (Date.now() - lastActivity > 600000) {
        clearInterval(checkCookieInterval);
        loggedInStore.set(false);
        handleLogout();
      } else {
        loggedInStore.set(true);
      }
    }, 1000);

    window.addEventListener('mousemove', refreshCookie);
    window.addEventListener('keydown', refreshCookie);
    window.addEventListener('click', refreshCookie);
    window.addEventListener('scroll', refreshCookie);

    statusCheckInterval = setInterval(checkOnlineStatus, 1100);

    const dashboard = document.querySelector('.dashboard');
    if (dashboard) {
      resizeObserver = new ResizeObserver(updateDashboardHeight);
      resizeObserver.observe(dashboard);
    }
    updateDashboardHeight();
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    clearInterval(statusCheckInterval);
  });

  afterUpdate(() => {
    const dashboard = document.querySelector('.dashboard');
    if (dashboard) {
      resizeObserver?.disconnect();
      resizeObserver = new ResizeObserver(updateDashboardHeight);
      resizeObserver.observe(dashboard);
    }
    const nav = document.querySelector('.desktop-nav') as HTMLElement | null;
    if (!nav) return;
    const isAuthRoute = currentPath === '/' || currentPath === '/login' || currentPath === '/register';
    nav.style.display = isAuthRoute ? 'none' : 'grid';
  });

  function refreshCookie() {
    if (loggedIn) document.cookie = 'lastActivity=' + Date.now();
  }

  async function handleLogout() {
    if (serialConnected) {
      try { await mavDisconnect(); } catch { /* ignore */ }
    }
    loggedInStore.set(false);
    document.cookie = 'lastActivity=' + Date.UTC(1970);
    if (!window.location.pathname.includes('register')) goto('/login');
  }

  function handleNavigation(path: string, target = '') {
    if (target === '_blank') window.open(path, target);
    else if (currentPath !== path) goto(path);
  }

  let isNavOpen = false;
  function toggleNav() { isNavOpen = !isNavOpen; }

  function toggleDarkMode() {
    const map = document.getElementById('map');
    darkMode = !darkMode;
    darkModeStore.set(darkMode);
    document.body.classList.toggle('dark-mode', darkMode);
    if (darkMode) {
      if (map && get(mapTypeStore) !== 'Satellite') map.classList.add('dark');
      const bg = document.querySelector('.bg') as HTMLElement | null;
      if (bg) bg.style.background = "url('bg-map.webp') no-repeat center center fixed";
      primaryColorStore.set('#1c1c1e');
      secondaryColorStore.set('#121212');
      tertiaryColorStore.set('#2d2d2d');
    } else {
      if (map) map.classList.remove('dark');
      const bg = document.querySelector('.bg') as HTMLElement | null;
      if (bg) bg.style.background = "url('bg-map-light.webp') no-repeat center center fixed";
      primaryColorStore.set('#f0f4f8');
      secondaryColorStore.set('#dce4ef');
      tertiaryColorStore.set('#b8c8dc');
    }
  }

  function toggleAudioNotifications() {
    audioNotification = !audioNotification;
    audoNotificationStore.set(audioNotification);
  }
</script>

<main class="bg-black flex overflow-auto"
  style="--heightOfDashboard: {heightOfDashboard}px; --primaryColor: {primaryColor}; --secondaryColor: {secondaryColor}; --tertiaryColor: {tertiaryColor}; --fontColor: {fontColor};"
>
  <div class="bg fixed w-full h-full "></div>
  <div class="dark-mode-btn absolute top-2 left-2 z-20">
    <button class="nav-button" aria-label="Toggle Dark Mode" on:click={toggleDarkMode}>
      <i class="nav-icon fas {darkMode ? 'fa-sun' : 'fa-moon'}"></i>
    </button>
  </div>
  <div class="bg-[#0000001f] flex w-full h-full z-10">
    <!-- Desktop Navigation -->
    <nav class="desktop-nav w-min h-full p-4 grid opacity-0 z-20" class:opacity={isNavHidden ? 0 : 1}>
      <div class="flex-grow flex flex-col items-center">
        <div class="mb-5">
          <button on:click|preventDefault={() => handleNavigation('/dashboard')}>
            <img src="/logo.png" alt="Logo" class="w-12 h-12">
          </button>
        </div>
        {#if loggedIn}
        <a href="/dashboard" class="nav-button mb-4 {currentPath === '/dashboard' ? 'active' : ''}">
          <i class="nav-icon fas fa-tachometer-alt"></i>
          <div class="tooltip text-white">Dashboard</div>
        </a>
        <a href="/mission-planner" class="nav-button mb-4 {currentPath === '/mission-planner' ? 'active' : ''}">
          <i class="nav-icon fas fa-route"></i>
          <div class="tooltip text-white">Mission Planner</div>
        </a>
        <a href="/event-log" class="nav-button mb-4 {currentPath === '/event-log' ? 'active' : ''}">
          <i class="nav-icon fas fa-bars-staggered"></i>
          <div class="tooltip text-white">Event Log</div>
        </a>
        <a href="/parameters" class="nav-button mb-4 {currentPath === '/parameters' ? 'active' : ''}">
          <i class="nav-icon fas fa-cog"></i>
          <div class="tooltip text-white">Vehicle Parameters</div>
        </a>
        <div class="separator h-[2px] w-[80%] rounded-2xl mb-4"></div>
        <button
          class="nav-button mb-4"
          class:connected={serialConnected}
          on:click={toggleSerialConnection}
          title={serialConnected ? 'Disconnect USB' : 'Connect USB'}
          disabled={serialConnecting}
        >
          <i class="nav-icon fas {serialConnecting ? 'fa-spinner fa-spin' : serialConnected ? 'fa-plug-circle-xmark' : 'fa-plug'}"></i>
          <div class="tooltip text-white">{serialConnected ? 'Disconnect' : 'Connect'} USB</div>
        </button>
        <a href="/login" on:click|preventDefault={handleLogout} class="nav-button mb-4">
          <i class="nav-icon fas fa-sign-out-alt"></i>
          <div class="tooltip text-white">Logout</div>
        </a>
        {:else}
        <a href="/login" class="nav-button mb-4 {currentPath === '/login' ? 'active' : ''}">
          <i class="nav-icon fas fa-sign-in-alt"></i>
          <div class="tooltip text-white">Login</div>
        </a>
        {/if}
      </div>
      <div class="flex flex-col justify-self-end gap-3">
        <button class="nav-button" on:click={toggleAudioNotifications}>
          <i class="nav-icon fas {audioNotification ? 'fa-volume-up' : 'fa-volume-mute'}"></i>
          <div class="tooltip text-white">Toggle Audio Notifications</div>
        </button>
        <div class="separator h-[2px] w-[80%] mx-auto mb-2 rounded-2xl"></div>
        <button class="nav-button" aria-label="Dark Mode" on:click={toggleDarkMode}>
          <i class="nav-icon fas {darkMode ? 'fa-sun' : 'fa-moon'}"></i>
          <div class="tooltip text-white">Toggle Dark Mode</div>
        </button>
      </div>
    </nav>

    <!-- Mobile Navigation -->
    <nav
      class="mobile-nav p-4 md:hidden flex flex-col z-20"
      style="--primaryColor: {primaryColor}; --secondaryColor: {secondaryColor}; --tertiaryColor: {tertiaryColor}; --fontColor: {fontColor};"
    >
      <div class="flex justify-between items-center">
        <button class="nav-button" aria-label="Toggle Navigation" on:click={toggleNav}>
          <i class="nav-icon fas fa-bars"></i>
        </button>
        <span class="text-xl font-semibold">Sidak Ground Control</span>
        <a href="/dashboard" on:click|preventDefault={() => handleNavigation('/dashboard')}>
          <img src="/logo.png" alt="Logo" class="w-8 h-8">
        </a>
      </div>
      <div class={`mobile-nav-links ${isNavOpen ? 'block' : 'hidden'} flex flex-col items-center mt-4`}>
        {#if loggedIn}
          <a href="/dashboard" on:click|preventDefault={() => handleNavigation('/dashboard')} class="nav-button mb-4 {currentPath === '/dashboard' ? 'active' : ''}">
            <i class="nav-icon fas fa-tachometer-alt"></i>&nbsp;&nbsp;Dashboard
          </a>
          <a href="/mission-planner" on:click|preventDefault={() => handleNavigation('/mission-planner')} class="nav-button mb-4 {currentPath === '/mission-planner' ? 'active' : ''}">
            <i class="nav-icon fas fa-route"></i>&nbsp;&nbsp;Mission Planner
          </a>
          <a href="/event-log" on:click|preventDefault={() => handleNavigation('/event-log')} class="nav-button mb-4 {currentPath === '/event-log' ? 'active' : ''}">
            <i class="nav-icon fas fa-bars-staggered"></i>&nbsp;&nbsp;Event Log
          </a>
          <a href="/user-settings" on:click|preventDefault={() => handleNavigation('/parameters')} class="nav-button mb-4 {currentPath === '/parameters' ? 'active' : ''}">
            <i class="nav-icon fas fa-cog"></i>&nbsp;&nbsp;Vehicle Parameters
          </a>
          <a href="/admin" on:click|preventDefault={() => handleNavigation('/admin')} class="nav-button mb-4">
            <i class="nav-icon fas fa-user"></i>&nbsp;&nbsp;Admin Dashboard
          </a>
          <button
            on:click={toggleSerialConnection}
            class="nav-button mb-4"
            class:connected={serialConnected}
            type="button"
            disabled={serialConnecting}
          >
            <i class="nav-icon fas {serialConnecting ? 'fa-spinner fa-spin' : serialConnected ? 'fa-plug-circle-xmark' : 'fa-plug'}"></i>&nbsp;&nbsp;{serialConnected ? 'Disconnect' : 'Connect'} USB
          </button>
          <button on:click|preventDefault={handleLogout} class="nav-button mb-4" type="button">
            <i class="nav-icon fas fa-sign-out-alt"></i>&nbsp;&nbsp;Logout
          </button>
        {:else}
          <a href="/login" on:click|preventDefault={() => handleNavigation('/login')} class="nav-button mb-4 {currentPath === '/login' ? 'active' : ''}">
            <i class="nav-icon fas fa-sign-in-alt"></i>&nbsp;&nbsp;Login
          </a>
        {/if}
      </div>
    </nav>

    <div class="slot-container flex-grow { currentPath !== '/login' && currentPath !== '/' ? 'pr-8' : '' } justify-center items-center overflow-auto z-10">
      <slot />
    </div>

    
  </div>
</main>

<ConnectionModal
  isOpen={showPortModal}
  onClose={() => { showPortModal = false; }}
  onConnect={handlePortSelected}
/>

<style>
  .bg {
    background: url('bg-map.webp') no-repeat center center fixed;
    background-size: cover !important;
    margin: 0;
    filter: blur(2px);
  }

  .dark-mode-btn {
    z-index: 25;
    background-color: rgb(from var(--primaryColor) r g b / 0.5);
    border-radius: 50%;
    display: none;
  }

  .dark-mode-btn button:hover {
    color: var(--fontColor);
    background-color: transparent;
  }

  .separator {
    background-color: var(--tertiaryColor);
  }

  .desktop-nav {
    align-content: space-between;
    align-self: center;
    color: var(--fontColor);
    background-color: var(--primaryColor);
    border: 5px solid rgb(from var(--secondaryColor) r g b / 0.85);
    border-right: none;
    border-radius: 30px 0 0 30px;
    margin-left: 2em;
    max-height: 90vh;
    height: var(--heightOfDashboard);
    transition: height 0s;
    transition: opacity 0.25s;
  }

  .mobile-nav {
    color: var(--fontColor);
    background-color: var(--primaryColor);
  }

  .nav-button {
    width: 40px;
    height: 40px;
    display: flex;
    position: relative;
    justify-content: center;
    align-items: center;
    background-color: transparent;
    border-radius: 5px;
    color: #8d8d8e;
  }

  .nav-button:hover {
    background-color: var(--secondaryColor);
  }

  .nav-button:hover, .nav-button.active {
    color: white;
  }

  .nav-button.active {
    background-color: var(--tertiaryColor);
  }

  .nav-button.connected {
    color: #22c55e;
  }
  .nav-button.connected:hover {
    color: #ef4444;
  }

  .nav-icon {
    font-size: 18px;
  }

  .tooltip {
    position: absolute;
    top: 0;
    left: 0;
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    border-radius: 0.25rem;
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s, visibility 0.3s, transform 0.3s;
    z-index: 1;
  }

  .nav-button:hover .tooltip {
    opacity: 1;
    visibility: visible;
    transform: translateX(50px);
  }

  /* Mobile Styles */
  @media (max-width: 990px) {
    main > div {
      flex-direction: column;
    } 

    .dark-mode-btn {
      top: unset;
      left: unset;
      right: 1rem;
      bottom: 1rem;
      padding: 0.5rem;
      background-color: var(--tertiaryColor);
      border: 1px solid var(--secondaryColor);
      display: unset;
    }

    .slot-container {
      padding: 0;
      overflow: hidden;
    }

    .desktop-nav {
      display: none !important;
    }

    .mobile-nav {
      display: flex;
      background-color: var(--primaryColor);
    }

    .mobile-nav-links {
      display: flex;
      flex-direction: column;
      width: 100%;
    }

    .mobile-nav-links a, .mobile-nav-links button {
      width: 100%;
      text-align: center;
    }

    .mobile-nav-links.hidden {
      display: none;
    }
  }
</style>
