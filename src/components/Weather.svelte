<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import weatherCodes from '../lib/weathercodes.json';
  import { mavLocationStore, mavHeadingStore } from '../stores/mavlinkStore';
  import {
    darkModeStore,
    primaryColorStore,
    secondaryColorStore,
    tertiaryColorStore,
  } from '../stores/customizationStore';

  type WeatherCode = {
    day: {
      description: string;
      image: string;
    };
    night: {
      description: string;
      image: string;
    };
  };

  type WeatherCodes = {
    [key: number]: WeatherCode;
  };

  const weatherCodesTyped: WeatherCodes = weatherCodes as WeatherCodes;

  export let isDashboard: boolean = false;
  export let mavLocation: L.LatLng | { lat: number; lng: number };;

  $: darkMode = $darkModeStore;
  $: primaryColor = $primaryColorStore;
  $: secondaryColor = $secondaryColorStore;
  $: tertiaryColor = $tertiaryColorStore;
  $: fontColor = darkMode ? '#ffffff' : '#000000';
  $: mavLocation = $mavLocationStore;
  $: droneHeading = $mavHeadingStore;

  let locationName = '';
  let temperature = '';
  let weatherDescription = '';
  let weatherImage = '';
  let rainChance = '';
  let windSpeed = '';
  let windDirection = '';
  let error = '';

  // Raw numeric values for crosswind calculation
  let windSpeedNum = 0;
  let windDirDeg = 0;

  // Crosswind decomposition relative to drone heading
  // headwind: positive = into the nose, negative = tailwind
  // crosswind: positive = from right, negative = from left
  function calcWindComponents(windDirDeg: number, windSpeedNum: number, heading: number): { head: number; cross: number } {
    // Angle between wind direction and drone heading
    const relAngle = ((windDirDeg - heading + 360) % 360) * Math.PI / 180;
    const head  = parseFloat((windSpeedNum * Math.cos(relAngle)).toFixed(1));
    const cross = parseFloat((windSpeedNum * Math.sin(relAngle)).toFixed(1));
    return { head, cross };
  }

  $: windComponents = calcWindComponents(windDirDeg, windSpeedNum, droneHeading);

  async function fetchWeather() {
    try {
      const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${mavLocation.lat}&longitude=${mavLocation.lng}&current_weather=true&hourly=precipitation_probability&wind_speed_unit=ms`);
      const weatherData = await weatherResponse.json();

      const geocodeResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${mavLocation.lat}&lon=${mavLocation.lng}`);
      const geocodeData = await geocodeResponse.json();

      if (weatherResponse.ok && geocodeResponse.ok) {
        const { temperature: temp, weathercode, relative_humidity } = weatherData.current_weather;
        const isDaytime = new Date().getHours() >= 6 && new Date().getHours() < 18;
        const weatherCode = weatherCodesTyped[weathercode];

        if (weatherCode) {
          weatherDescription = isDaytime ? weatherCode.day.description : weatherCode.night.description;
          weatherImage = isDaytime ? weatherCode.day.image : weatherCode.night.image;
        } else {
          weatherDescription = 'Unknown weather';
          weatherImage = '';
        }

        temperature = `${temp}°C / ${(temp * 1.8 + 32).toFixed(1)}°F`;

        const rainData = weatherData.hourly.precipitation_probability;
        if (rainData && rainData.length > 0) {
          rainChance = `${rainData[0]}%`;
        } else {
          rainChance = 'N/A';
        }
        windSpeed = weatherData.current_weather.windspeed;
        windDirection = weatherData.current_weather.winddirection;
        // Store raw numeric values for crosswind calculation
        windSpeedNum = parseFloat(windSpeed.toString());
        windDirDeg = parseFloat(windDirection.toString());
        if (parseFloat(windDirection.toString()) > 337.5 || parseFloat(windDirection.toString()) < 22.5) {
          windDirection += '° N';
        } else if (parseFloat(windDirection.toString()) > 22.5 && parseFloat(windDirection.toString()) < 67.5) {
          windDirection += '° NE';
        } else if (parseFloat(windDirection.toString()) > 67.5 && parseFloat(windDirection.toString()) < 112.5) {
          windDirection += '° E';
        } else if (parseFloat(windDirection.toString()) > 112.5 && parseFloat(windDirection.toString()) < 157.5) {
          windDirection += '° SE';
        } else if (parseFloat(windDirection.toString()) > 157.5 && parseFloat(windDirection.toString()) < 202.5) {
          windDirection += '° S';
        } else if (parseFloat(windDirection.toString()) > 202.5 && parseFloat(windDirection.toString()) < 247.5) {
          windDirection += '° SW';
        } else if (parseFloat(windDirection.toString()) > 247.5 && parseFloat(windDirection.toString()) < 292.5) {
          windDirection += '° W';
        } else if (parseFloat(windDirection.toString()) > 292.5 && parseFloat(windDirection.toString()) < 337.5) {
          windDirection += '° NW';
        }
        
        locationName = geocodeData.display_name;
      } else {
        error = weatherData.reason || 'Failed to fetch weather data';
      }
    } catch (err : any) {
      error = err.message || 'Failed to fetch weather data';
    }
  }

  onMount(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 60000); // Update every 1 minute

    return () => {
      clearInterval(interval); // Clear interval on component destroy
    };
  });
</script>

{#if isDashboard}
  <div class="weather min-w-[max-content] h-full max-h-[190px] overflow-y-visible text-center transform -translate-y-[10px]">
    {#if error}
      <div class="error">{error}</div>
    {:else}
      <div class="weather-detail wind">Wind: {windSpeed} m/s {windDirection}</div>
      <div class="weather-detail crosswind">
        <span class="{Math.abs(windComponents.head) > 5 ? 'warn' : ''}">
          {windComponents.head >= 0 ? '↑ Head' : '↓ Tail'}: {Math.abs(windComponents.head)} m/s
        </span>
        &nbsp;|&nbsp;
        <span class="{Math.abs(windComponents.cross) > 5 ? 'warn' : ''}">
          {windComponents.cross >= 0 ? '→ Cross-R' : '← Cross-L'}: {Math.abs(windComponents.cross)} m/s
        </span>
      </div>
      <img src={weatherImage} alt={weatherDescription} class="weather-icon" />
      <div class="weather-summary">{weatherDescription}</div>
      <div class="weather-detail rain">Rain Chance: {rainChance}</div>
      <div class="weather-detail temp">Temp: {temperature}</div>
    {/if}
  </div>
{:else}
  <div
    class="weather rounded-2xl h-full overflow-y-auto p-4"
    style="--primaryColor: {primaryColor}; --secondaryColor: {secondaryColor}; --tertiaryColor: {tertiaryColor}; --fontColor: {fontColor};"
  >
  <div class="weather-header">Weather Advisory</div>
    {#if error}
      <div class="error">{error}</div>
    {:else}
      <div class="weather-detail wind">Wind Speed: {windSpeed} m/s</div>
      <div class="weather-detail wind">Wind Direction: {windDirection}</div>
      <!-- Crosswind breakdown relative to drone heading -->
      <div class="crosswind-panel">
        <div class="cw-title">Wind vs. Drone Heading ({droneHeading.toFixed(0)}°)</div>
        <div class="cw-row">
          <span class="cw-label">{windComponents.head >= 0 ? '↑ Headwind' : '↓ Tailwind'}</span>
          <span class="cw-val {Math.abs(windComponents.head) > 5 ? 'warn' : ''}">{Math.abs(windComponents.head)} m/s</span>
        </div>
        <div class="cw-row">
          <span class="cw-label">{windComponents.cross >= 0 ? '→ Crosswind (R)' : '← Crosswind (L)'}</span>
          <span class="cw-val {Math.abs(windComponents.cross) > 5 ? 'warn' : ''}">{Math.abs(windComponents.cross)} m/s</span>
        </div>
      </div>
      <img src={weatherImage} alt={weatherDescription} class="weather-icon" />
      <div class="weather-summary">{weatherDescription}</div>
      <div class="weather-detail rain">Rain Chance: {rainChance}</div>
      <div class="weather-detail temp">Temp: {temperature}</div>
    {/if}
      <br/>
      <div class="location text-italic">Based on MAV location
        <span id="location-name"><br/>{locationName}</span>
      </div>
  </div>
{/if}

<style>
  .weather {
    color: var(--fontColor);
    background-color: var(--primaryColor);
    max-width: 400px;
    text-align: center;
    display: flex;
    flex-direction: column;
  }

  .weather > img {
    filter: brightness(0.95);
  }

  .weather-header {
    font-size: 13pt;
    margin-bottom: 0.5rem;
    font-weight: bold;
  }

  .location {
    font-size: 0.875rem;
    color: #838383;
  }

  .weather-summary {
    font-size: 0.85rem;
  }

  .weather-detail {
    font-size: 0.85rem;
  }

  .error {
    color: red;
    font-size: 1.25rem;
  }

  .weather-icon {
    width: 100px;
    height: 100px;
    margin-inline: auto;
  }

  #location-name, .weather-detail.wind {
    color: #66e1ff;
  }

  .weather-detail.crosswind {
    font-size: 0.78rem;
    color: #a0d4ff;
    margin-top: 2px;
  }

  .crosswind-panel {
    background: rgba(78, 148, 247, 0.1);
    border: 1px solid rgba(78, 148, 247, 0.3);
    border-radius: 0.5rem;
    padding: 6px 10px;
    margin: 6px 0;
    font-size: 0.82rem;
  }

  .cw-title {
    font-size: 0.7rem;
    opacity: 0.6;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }

  .cw-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 2px 0;
  }

  .cw-label {
    color: #88ddff;
  }

  .cw-val {
    font-weight: 700;
    font-family: 'Courier New', monospace;
    color: #66e1ff;
  }

  .warn {
    color: #f59e0b !important;
    font-weight: 700;
  }
  
  @media (max-height: 650px) {
    #location-name {
      display: none;
    }
  }
</style>