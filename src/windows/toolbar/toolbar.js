// Keep in sync with src/lib/toolbarState.js — inlined here because the renderer has no require() without a bundler.
const TRANSITIONS = {
  idle: { start: 'recording' },
  recording: { pause: 'paused', stop: 'preview' },
  paused: { resume: 'recording', stop: 'preview' },
  preview: { save: 'idle', delete: 'idle' }
};

let state = 'idle';
function transition(action) {
  const next = TRANSITIONS[state] && TRANSITIONS[state][action];
  if (!next) return false;
  state = next;
  return true;
}

const EXPANDED_SIZE = { width: 296, height: 420 };
const COMPACT_SIZE = { width: 176, height: 48 };

const body = document.body;
const modeFullscreen = document.getElementById('modeFullscreen');
const modeArea = document.getElementById('modeArea');
const btnRecord = document.getElementById('btnRecord');
const btnPause = document.getElementById('btnPause');
const btnStop = document.getElementById('btnStop');
const btnSave = document.getElementById('btnSave');
const btnDiscard = document.getElementById('btnDiscard');
const btnOpenFolder = document.getElementById('btnOpenFolder');
const btnClose = document.getElementById('btnClose');
const btnPen = document.getElementById('btnPen');
const btnArrow = document.getElementById('btnArrow');
const cameraSelect = document.getElementById('cameraSelect');
const micSelect = document.getElementById('micSelect');
const sysAudioToggle = document.getElementById('sysAudioToggle');
const pillTimer = document.getElementById('pillTimer');

let captureMode = 'fullscreen'; // 'fullscreen' | 'area'
let lastRecordingBlob = null;
let recordingStartedAt = null;
let timerInterval = null;
let hasSavedThisSession = false;
let recordingStarting = false;

function render() {
  body.className = `state-${state}`;

  if (state === 'idle' && captureMode !== 'fullscreen') {
    // Returning to idle (e.g. after a completed Área Customizada recording is
    // saved/discarded) must not leave capture mode stuck on 'area' — otherwise
    // the big Gravar button stays permanently disabled (see Finding 1).
    captureMode = 'fullscreen';
    modeFullscreen.classList.add('active');
    modeArea.classList.remove('active');
  }

  const isIdleOrPreview = state === 'idle' || state === 'preview';
  body.classList.toggle('compact', !isIdleOrPreview);

  btnRecord.disabled = state !== 'idle' || captureMode === 'area';
  btnPause.title = state === 'paused' ? 'Retomar' : 'Pausar';
  btnPause.innerHTML = state === 'paused'
    ? '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7Z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';

  window.gravador.resizeWindow(isIdleOrPreview ? EXPANDED_SIZE : COMPACT_SIZE);
  window.gravador.notifyState(state);
}

function startTimer() {
  recordingStartedAt = Date.now();
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  pillTimer.textContent = '00:00';
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - recordingStartedAt) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  pillTimer.textContent = `${mm}:${ss}`;
}

// ---- Capture mode selection ----
modeFullscreen.addEventListener('click', () => {
  if (state !== 'idle') return;
  captureMode = 'fullscreen';
  modeFullscreen.classList.add('active');
  modeArea.classList.remove('active');
  render();
});

modeArea.addEventListener('click', async () => {
  if (state !== 'idle') return;
  captureMode = 'area';
  modeArea.classList.add('active');
  modeFullscreen.classList.remove('active');
  render();

  const cropRect = await window.gravador.pickArea();
  if (!cropRect) {
    // user pressed Escape — revert to fullscreen mode
    captureMode = 'fullscreen';
    modeFullscreen.classList.add('active');
    modeArea.classList.remove('active');
    render();
    return;
  }
  await beginRecording(cropRect);
});

// ---- Recording flow ----
async function beginRecording(cropRect) {
  if (recordingStarting) return;
  recordingStarting = true;
  try {
    const sources = await window.gravador.listSources();
    const screenSource = sources.find((s) => s.name.toLowerCase().includes('screen')) || sources[0];
    if (!screenSource) {
      alert('Nenhuma tela encontrada para gravar.');
      return;
    }

    await window.gravador.runCountdown();
    await window.recorderApi.start(screenSource.id, cropRect);
    transition('start');
    startTimer();
    render();
  } finally {
    recordingStarting = false;
  }
}

btnRecord.addEventListener('click', async () => {
  if (state !== 'idle' || captureMode !== 'fullscreen') return;
  await beginRecording(null);
});

btnPause.addEventListener('click', () => {
  if (state === 'recording') {
    window.recorderApi.pause();
    transition('pause');
  } else if (state === 'paused') {
    window.recorderApi.resume();
    transition('resume');
  }
  render();
});

btnStop.addEventListener('click', async () => {
  lastRecordingBlob = await window.recorderApi.stop();
  stopTimer();
  transition('stop');
  render();
});

btnSave.addEventListener('click', async () => {
  if (!lastRecordingBlob) return;
  try {
    const arrayBuffer = await lastRecordingBlob.arrayBuffer();
    const result = await window.gravador.saveRecording(arrayBuffer);
    if (result.success) {
      if (result.format === 'webm') {
        alert('Não foi possível converter para MP4, salvo como WebM: ' + result.path);
      }
      hasSavedThisSession = true;
      btnOpenFolder.disabled = false;
      lastRecordingBlob = null;
      transition('save');
      render();
    }
  } catch (err) {
    alert('Erro ao salvar a gravação: ' + err.message);
  }
});

btnDiscard.addEventListener('click', () => {
  lastRecordingBlob = null;
  transition('delete');
  render();
});

btnOpenFolder.addEventListener('click', async () => {
  await window.gravador.openLastFolder();
});

btnClose.addEventListener('click', () => {
  window.close();
});

// ---- Pen/Arrow overlay tool wiring — nextColor cycle inlined (mirrors src/lib/colorCycle.js) ----
const { nextColor } = (function () {
  const CYCLE = [null, '#000000', '#0000FF', '#FF0000'];
  return {
    nextColor(current) {
      const idx = CYCLE.indexOf(current);
      if (idx === -1) return null;
      return CYCLE[(idx + 1) % CYCLE.length];
    }
  };
})();

let penColor = null;
let arrowOn = false;

btnPen.addEventListener('click', () => {
  penColor = nextColor(penColor);
  arrowOn = false;
  btnArrow.classList.remove('active');
  btnPen.classList.toggle('active', !!penColor);
  window.gravador.setOverlayTool({ tool: penColor ? 'pen' : 'none', color: penColor });
});

btnArrow.addEventListener('click', () => {
  arrowOn = !arrowOn;
  penColor = null;
  btnPen.classList.remove('active');
  btnArrow.classList.toggle('active', arrowOn);
  window.gravador.setOverlayTool({ tool: arrowOn ? 'arrow' : 'none', color: '#000000' });
});

// ---- Inline settings: camera/mic dropdowns + system audio toggle ----
async function populateDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();

  cameraSelect.innerHTML = '';
  const noCameraOpt = document.createElement('option');
  noCameraOpt.value = '';
  noCameraOpt.textContent = 'Nenhuma câmera';
  cameraSelect.appendChild(noCameraOpt);
  devices.filter((d) => d.kind === 'videoinput').forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d.deviceId;
    opt.textContent = d.label || 'Câmera';
    cameraSelect.appendChild(opt);
  });

  micSelect.innerHTML = '';
  devices.filter((d) => d.kind === 'audioinput').forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d.deviceId;
    opt.textContent = d.label || 'Microfone';
    micSelect.appendChild(opt);
  });
}

function pushSettingsUpdate() {
  window.gravador.updateSettings({
    cameraId: cameraSelect.value || null,
    micId: micSelect.value || null,
    // The card exposes a single "Áudio do sistema" toggle only; mic capture stays
    // always-on (matches prior behavior — no dedicated mic on/off control in this UI).
    micEnabled: true,
    systemAudioEnabled: sysAudioToggle.checked
  });
}

async function initSettings() {
  await populateDevices();
  const settings = await window.gravador.getSettings();
  cameraSelect.value = settings.cameraId || '';
  micSelect.value = settings.micId || '';
  sysAudioToggle.checked = !!settings.systemAudioEnabled;
}

cameraSelect.addEventListener('change', pushSettingsUpdate);
micSelect.addEventListener('change', pushSettingsUpdate);
sysAudioToggle.addEventListener('change', pushSettingsUpdate);

window.gravador.onSettingsChanged((settings) => {
  cameraSelect.value = settings.cameraId || '';
  micSelect.value = settings.micId || '';
  sysAudioToggle.checked = !!settings.systemAudioEnabled;
});

// ---- Init ----
btnOpenFolder.disabled = !hasSavedThisSession;
initSettings();
render();
