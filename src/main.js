import { SoundEngine } from './audio.js';
import { GameEngine } from './game.js';
import { Renderer3D } from './renderer3d.js';

const canvas = document.getElementById('gameCanvas');
const sound = new SoundEngine();
const game = new GameEngine(sound);
const renderer = new Renderer3D(canvas);

// DOM references
const hudTop = document.getElementById('hud-top');
const hudBottom = document.getElementById('hud-bottom');
const alertBanner = document.getElementById('alert-banner');
const alertText = document.getElementById('alert-text');

const routeProgressFill = document.getElementById('route-progress-fill');
const routeCarDot = document.getElementById('route-car-dot');
const zoneLabel = document.getElementById('zone-label');
const distanceRemaining = document.getElementById('distance-remaining');
const speedLimitValue = document.getElementById('speed-limit-value');
const timerValue = document.getElementById('timer-value');
const integrityValue = document.getElementById('integrity-value');

const speedValue = document.getElementById('speed-value');
const gearValue = document.getElementById('gear-value');
const brakeStatusText = document.getElementById('brake-status-text');
const brakeDemandFill = document.getElementById('brake-demand-fill');
const brakeActualFill = document.getElementById('brake-actual-fill');
const brakeEfficiencyPct = document.getElementById('brake-efficiency-pct');
const brakeLagSec = document.getElementById('brake-lag-sec');

const parkingSensorCard = document.getElementById('parking-sensor-card');
const sensorBars = document.getElementById('sensor-bars').querySelectorAll('span');
const parkingHint = document.getElementById('parking-hint');

const overlayStart = document.getElementById('overlay-start');
const overlayPause = document.getElementById('overlay-pause');
const overlayEnd = document.getElementById('overlay-end');

const endBadge = document.getElementById('end-badge');
const endTitle = document.getElementById('end-title');
const endSubtitle = document.getElementById('end-subtitle');
const endGigMessage = document.getElementById('end-gig-message');
const statTime = document.getElementById('stat-time');
const statParking = document.getElementById('stat-parking');
const statHull = document.getElementById('stat-hull');
const statBrakes = document.getElementById('stat-brakes');

const btnStart = document.getElementById('btn-start');
const btnResume = document.getElementById('btn-resume');
const btnRestartPause = document.getElementById('btn-restart-pause');
const btnRestartEnd = document.getElementById('btn-restart-end');
const btnRadio = document.getElementById('btn-radio');
const btnMute = document.getElementById('btn-mute');
const btnPause = document.getElementById('btn-pause');

const btnChooseMp3 = document.getElementById('btn-choose-mp3');
const btnChooseMp3Pause = document.getElementById('btn-choose-mp3-pause');
const radioFileInput = document.getElementById('radio-file-input');
const radioStatusLabel = document.getElementById('radio-status-label');
const radioStatusPause = document.getElementById('radio-status-pause');

const touchControls = document.getElementById('touch-controls');

// Input State
const keys = new Set();
const touchState = { left: false, right: false, gas: false, brake: false };
let toggleReverseQueued = false;
let endScreenShown = false;

function formatTime(sec) {
  const total = Math.floor(sec);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getInput() {
  const input = {
    gas: keys.has('KeyW') || keys.has('ArrowUp') || touchState.gas,
    brake: keys.has('KeyS') || keys.has('ArrowDown') || touchState.brake,
    spaceBrake: keys.has('Space'),
    left: keys.has('KeyA') || keys.has('ArrowLeft') || touchState.left,
    right: keys.has('KeyD') || keys.has('ArrowRight') || touchState.right,
    toggleReversePressed: toggleReverseQueued,
  };
  toggleReverseQueued = false;
  return input;
}

function updateRadioUi() {
  if (sound.radioLoaded) {
    const shortName =
      sound.radioTrackName.length > 28
        ? sound.radioTrackName.slice(0, 25) + '...'
        : sound.radioTrackName;
    const labelText = sound.radioEnabled ? `Radio Ready: ${shortName}` : `Radio Off (${shortName})`;
    radioStatusLabel.textContent = labelText;
    radioStatusLabel.classList.add('loaded');
    radioStatusPause.textContent = labelText;
    radioStatusPause.classList.add('loaded');
    btnRadio.classList.toggle('radio-on', sound.radioEnabled);
    btnRadio.classList.toggle('radio-off', !sound.radioEnabled);
    btnRadio.title = sound.radioEnabled ? `Radio ON: ${sound.radioTrackName} (N)` : `Radio OFF (N)`;
  } else {
    radioStatusLabel.innerHTML = 'Optional: pick an MP3 or drop <code>audio/radio.mp3</code>';
    radioStatusLabel.classList.remove('loaded');
    radioStatusPause.textContent = 'No radio track loaded';
    radioStatusPause.classList.remove('loaded');
    btnRadio.classList.remove('radio-on', 'radio-off');
    btnRadio.title = 'Load Radio MP3 (N)';
  }
}

function handleRadioToggle() {
  if (!sound.radioLoaded) {
    radioFileInput.click();
    return;
  }
  sound.toggleRadio();
  updateRadioUi();
}

function startDrive() {
  sound.init();
  game.reset();
  game.status = 'playing';
  endScreenShown = false;

  overlayStart.classList.add('hidden');
  overlayPause.classList.add('hidden');
  overlayEnd.classList.add('hidden');
  hudTop.classList.remove('hidden');
  hudBottom.classList.remove('hidden');

  if (window.matchMedia('(pointer: coarse)').matches) {
    touchControls.classList.remove('hidden');
  }

  sound.startRadio();
  updateRadioUi();
}

function togglePause() {
  if (game.status === 'playing') {
    game.status = 'paused';
    sound.stopContinuous();
    sound.pauseRadio();
    overlayPause.classList.remove('hidden');
  } else if (game.status === 'paused') {
    sound.init();
    game.status = 'playing';
    sound.startRadio();
    overlayPause.classList.add('hidden');
  }
}

function toggleMute() {
  sound.init();
  const next = !sound.muted;
  sound.setMuted(next);
  btnMute.textContent = next ? '🔇' : '🔊';
}

function showEndScreen(snap) {
  endScreenShown = true;
  overlayEnd.classList.remove('hidden');
  alertBanner.classList.add('hidden');

  if (snap.status === 'won') {
    endBadge.textContent = 'ARRIVED IN NOTTINGHAM';
    endBadge.style.background = '#f5c518';
    endBadge.style.color = '#111';
    endTitle.textContent = 'Parked Cleanly in Bay 14!';
    endSubtitle.textContent = `You navigated stiff brakes from Leicester to Broadmarsh Multi-Storey Level 2 (${snap.collisions} bumps, ${snap.redLightsRun} red lights run).`;
    endGigMessage.textContent = 'Congratulations Now Go and Enjoy The Paul Heaton Gig!';
    endGigMessage.classList.remove('hidden');
    statParking.textContent = `${snap.parkingPrecision}%`;
  } else {
    endBadge.textContent = 'VEHICLE IMMOBILISED';
    endBadge.style.background = '#dc2626';
    endBadge.style.color = '#fff';
    endTitle.textContent = 'Journey Ended Early';
    endSubtitle.textContent = 'Too many collisions damaged the car before reaching Bay 14.';
    endGigMessage.classList.add('hidden');
    statParking.textContent = '—';
  }

  statTime.textContent = formatTime(snap.driveTimeSec);
  statHull.textContent = `${snap.hull}%`;
  statBrakes.textContent = `${Math.round(snap.brakeEfficiency * 100)}%`;
}

function updateHud(snap) {
  routeProgressFill.style.width = `${snap.progressPct.toFixed(1)}%`;
  routeCarDot.style.left = `${snap.progressPct.toFixed(1)}%`;
  zoneLabel.textContent = snap.zone;
  distanceRemaining.textContent =
    snap.milesRemaining > 0.15 ? `${snap.milesRemaining.toFixed(1)} mi to Car Park` : 'Inside Car Park';

  speedLimitValue.textContent = String(snap.speedLimit);
  timerValue.textContent = formatTime(snap.driveTimeSec);
  integrityValue.textContent = `Hull ${snap.hull}%`;

  speedValue.textContent = String(snap.speedMph);
  gearValue.textContent = snap.gear;
  gearValue.classList.toggle('reverse', snap.gear === 'R');

  // Brake Servo Telemetry
  const effPct = Math.round(snap.brakeEfficiency * 100);
  brakeEfficiencyPct.textContent = `${effPct}%`;
  brakeLagSec.textContent = `${snap.brakeLagSec.toFixed(2)}s`;
  brakeDemandFill.style.width = `${Math.round(snap.brakeDemand * 100)}%`;
  brakeActualFill.style.width = `${Math.round(snap.brakeActual * 100)}%`;

  brakeStatusText.classList.remove('good', 'warn', 'danger');
  if (effPct >= 75) {
    brakeStatusText.textContent = 'RESPONSIVE';
    brakeStatusText.classList.add('good');
  } else if (effPct >= 46) {
    brakeStatusText.textContent = 'STIFFENING';
    brakeStatusText.classList.add('warn');
  } else {
    brakeStatusText.textContent = 'ROCK HARD';
    brakeStatusText.classList.add('danger');
  }

  // Alert Banner
  if (snap.alertActive) {
    alertBanner.classList.remove('hidden', 'info', 'warn');
    if (snap.alertKind === 'info') alertBanner.classList.add('info');
    else if (snap.alertKind === 'warn') alertBanner.classList.add('warn');
    alertText.textContent = snap.alertText;
  } else {
    alertBanner.classList.add('hidden');
  }

  // Multi-Storey Parking Assist
  if (snap.inCarparkLevel2 && snap.parkingStatus) {
    parkingSensorCard.classList.remove('hidden');
    const ps = snap.parkingStatus;
    const activeBars = Math.round(ps.proximity * 5);
    sensorBars.forEach((bar, i) => {
      bar.className = '';
      if (i < activeBars) {
        if (ps.insideBay) bar.classList.add('active-green');
        else if (activeBars >= 4) bar.classList.add('active-amber');
        else bar.classList.add('active-red');
      }
    });

    if (ps.insideBay && ps.stopped) {
      parkingHint.textContent = 'Holding in Bay 14...';
    } else if (ps.insideBay) {
      parkingHint.textContent = 'STOP NOW!';
    } else if (ps.distToBay < 16) {
      parkingHint.textContent = ps.across > 0.6 ? 'Steer Left into Bay 14' : ps.across < -0.6 ? 'Steer Right into Bay 14' : 'Straight into Bay 14';
    } else {
      parkingHint.textContent = 'Bay 14 ahead on Left';
    }
  } else {
    parkingSensorCard.classList.add('hidden');
  }

  if ((snap.status === 'won' || snap.status === 'lost') && !endScreenShown) {
    showEndScreen(snap);
  }
}

// Event Listeners
window.addEventListener('resize', () => renderer.resize());

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault();
  }
  if (!keys.has(e.code)) {
    if (e.code === 'KeyR') toggleReverseQueued = true;
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (game.status === 'playing' || game.status === 'paused') togglePause();
    }
    if (e.code === 'KeyM') toggleMute();
    if (e.code === 'KeyN') handleRadioToggle();
  }
  keys.add(e.code);
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

function bindTouchBtn(id, field) {
  const el = document.getElementById(id);
  const set = (v) => (e) => {
    e.preventDefault();
    touchState[field] = v;
  };
  el.addEventListener('pointerdown', set(true));
  el.addEventListener('pointerup', set(false));
  el.addEventListener('pointercancel', set(false));
  el.addEventListener('pointerleave', set(false));
}

bindTouchBtn('touch-left', 'left');
bindTouchBtn('touch-right', 'right');
bindTouchBtn('touch-gas', 'gas');
bindTouchBtn('touch-brake', 'brake');

btnStart.addEventListener('click', startDrive);
btnResume.addEventListener('click', togglePause);
btnRestartPause.addEventListener('click', startDrive);
btnRestartEnd.addEventListener('click', startDrive);
btnPause.addEventListener('click', togglePause);
btnMute.addEventListener('click', toggleMute);
btnRadio.addEventListener('click', handleRadioToggle);
btnChooseMp3.addEventListener('click', () => radioFileInput.click());
btnChooseMp3Pause.addEventListener('click', () => radioFileInput.click());

radioFileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file && sound.loadRadioFile(file)) {
    updateRadioUi();
    if (game.status === 'playing') {
      sound.startRadio();
    }
  }
  radioFileInput.value = '';
});

sound.checkDefaultRadio(['radio.mp3', 'audio/radio.mp3']).then(updateRadioUi);

// Main Loop
let lastTime = performance.now();
function loop(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  game.update(dt, getInput());
  renderer.render(game);

  if (game.status !== 'menu') {
    updateHud(game.getHudSnapshot());
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
