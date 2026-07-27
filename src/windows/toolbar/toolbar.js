// Keep in sync with src/lib/toolbarState.js — inlined here because the renderer has no require() without a bundler.
const TRANSITIONS = {
  idle: { start: 'recording' },
  recording: { pause: 'paused', stop: 'preview', cancel: 'idle' },
  paused: { resume: 'recording', stop: 'preview', cancel: 'idle' },
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
const COMPACT_SIZE = { width: 300, height: 48 };

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
const btnCancel = document.getElementById('btnCancel');
const cameraSelect = document.getElementById('cameraSelect');
const micSelect = document.getElementById('micSelect');
const sysAudioToggle = document.getElementById('sysAudioToggle');
const pillTimer = document.getElementById('pillTimer');
const btnSettings = document.getElementById('btnSettings');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const shortcutInput = document.getElementById('shortcutInput');

let captureMode = 'fullscreen'; // 'fullscreen' | 'area'
let lastRecordingBlob = null;
let recordingStartedAt = null;
let timerInterval = null;
let hasSavedThisSession = false;
let recordingStarting = false;

// Explicit reset back to the default capture mode. Must be called only at real
// "back to clean idle" points (after save/discard) — NOT from inside render(),
// because state === 'idle' is also true while the user is actively picking an
// area (between clicking "Área Customizada" and pickArea() resolving), and
// render() runs during that window too. A level-triggered check on `state`
// alone can't distinguish "just reset" from "mid-pick", so the reset must be
// edge-triggered at the specific call sites instead.
function resetToFullscreenMode() {
  captureMode = 'fullscreen';
  modeFullscreen.classList.add('active');
  modeArea.classList.remove('active');
}

function render() {
  body.className = `state-${state}`;

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
  resetToFullscreenMode();
  render();
});

modeArea.addEventListener('click', async () => {
  if (state !== 'idle') return;
  captureMode = 'area';
  modeArea.classList.add('active');
  modeFullscreen.classList.remove('active');
  render();

  const picked = await window.gravador.pickArea();
  if (!picked) {
    // user pressed Escape — revert to fullscreen mode
    resetToFullscreenMode();
    render();
    return;
  }
  await beginRecording(picked.physical, picked.logical);
});

// ---- Recording flow ----
// cropRect is in physical pixels (matches the desktopCapturer stream resolution);
// logicalRect is in CSS pixels (matches what the areaframe overlay positions with).
async function beginRecording(cropRect, logicalRect) {
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
    if (logicalRect) window.gravador.showAreaFrame(logicalRect);
    transition('start');
    startTimer();
    render();
  } finally {
    recordingStarting = false;
  }
}

btnRecord.addEventListener('click', async () => {
  if (state !== 'idle' || captureMode !== 'fullscreen') return;
  await beginRecording(null, null);
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
  try {
    lastRecordingBlob = await window.recorderApi.stop();
  } catch (err) {
    alert('Erro ao finalizar a gravação: ' + err.message);
    lastRecordingBlob = null;
  }
  stopTimer();
  applyTool('none', toolColor); // else the overlay keeps swallowing clicks after recording ends
  window.gravador.hideAreaFrame(); // no-op in fullscreen mode, idempotent otherwise
  transition('stop');
  render();
});

btnCancel.addEventListener('click', async () => {
  if (state !== 'recording' && state !== 'paused') return;
  // Intentionally no confirmation dialog — cancel is meant to be immediate.
  await window.recorderApi.cancel();
  lastRecordingBlob = null;
  stopTimer();
  applyTool('none', toolColor);
  window.gravador.hideAreaFrame();
  transition('cancel');
  resetToFullscreenMode();
  render();
});

let savingRecording = false;

btnSave.addEventListener('click', async () => {
  if (!lastRecordingBlob || savingRecording) return;
  savingRecording = true;
  try {
    const arrayBuffer = await lastRecordingBlob.arrayBuffer();
    const result = await window.gravador.saveRecording(arrayBuffer);
    if (result.success) {
      if (result.format === 'webm') {
        alert('Não foi possível converter para MP4, salvo como WebM: ' + result.path + '\n\nMotivo: ' + result.warning);
      }
      hasSavedThisSession = true;
      btnOpenFolder.disabled = false;
      lastRecordingBlob = null;
      transition('save');
      resetToFullscreenMode();
      render();
    } else if (result.error) {
      alert('Não foi possível salvar a gravação: ' + result.error);
    }
  } catch (err) {
    alert('Erro ao salvar a gravação: ' + err.message);
  } finally {
    savingRecording = false;
  }
});

btnDiscard.addEventListener('click', () => {
  lastRecordingBlob = null;
  transition('delete');
  resetToFullscreenMode();
  render();
});

btnOpenFolder.addEventListener('click', async () => {
  await window.gravador.openLastFolder();
});

btnClose.addEventListener('click', () => {
  window.close();
});

// ---- Overlay tool state — nextColor cycle inlined (mirrors src/lib/colorCycle.js) ----
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

let activeTool = 'none';       // 'none' | 'pen' | 'arrow' | 'rect'
let toolColor = '#000000';

// Buttons come in pairs: the expanded card and the compact recording bar each
// have their own DOM node for the same logical tool.
const TOOL_BUTTONS = {
  pen: [btnPen, document.getElementById('btnPenC')],
  arrow: [btnArrow, document.getElementById('btnArrowC')],
  rect: [document.getElementById('btnRectC')]
};

function syncToolButtons() {
  for (const [tool, els] of Object.entries(TOOL_BUTTONS)) {
    for (const el of els) {
      if (el) el.classList.toggle('active', activeTool === tool);
    }
  }
}

function applyTool(tool, color) {
  activeTool = tool;
  toolColor = color || toolColor;
  syncToolButtons();
  window.gravador.setOverlayTool({ tool: activeTool, color: toolColor });
}

window.gravador.onForceToolNone(() => applyTool('none', toolColor));

window.gravador.onToggleRecordShortcut(() => {
  if (state === 'idle' && captureMode === 'fullscreen') btnRecord.click();
  else if (state === 'recording' || state === 'paused') btnStop.click();
});

// ---- Keyboard-shortcut settings panel ----
// Keep in sync with src/lib/shortcutRecorder.js — inlined here because the renderer has no require() without a bundler.
function keysToAccelerator({ ctrlKey, metaKey, shiftKey, altKey, key }) {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return null;
  const parts = [];
  if (ctrlKey || metaKey) parts.push('CommandOrControl');
  if (shiftKey) parts.push('Shift');
  if (altKey) parts.push('Alt');
  parts.push(key.length === 1 ? key.toUpperCase() : key);
  return parts.join('+');
}

btnSettings.addEventListener('click', async () => {
  if (state !== 'idle') return;
  body.classList.add('settings-open');
  const settings = await window.gravador.getSettings();
  shortcutInput.value = settings.shortcuts?.toggleRecord || '';
});

btnCloseSettings.addEventListener('click', () => {
  body.classList.remove('settings-open');
});

shortcutInput.addEventListener('keydown', (e) => {
  e.preventDefault();
  if (e.key === 'Escape') { shortcutInput.blur(); return; }
  const accelerator = keysToAccelerator(e);
  if (!accelerator) return; // only a modifier held so far, keep waiting
  shortcutInput.value = accelerator;
  window.gravador.updateSettings({ shortcuts: { toggleRecord: accelerator } });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && body.classList.contains('settings-open') && document.activeElement !== shortcutInput) {
    body.classList.remove('settings-open');
  }
});

// Pen keeps its color-cycling behavior: click cycles black → blue → red → off.
function onPenClick() {
  const next = activeTool === 'pen' ? nextColor(toolColor) : '#000000';
  if (!next) applyTool('none', toolColor);
  else applyTool('pen', next);
}

function toggleTool(tool) {
  if (activeTool === tool) applyTool('none', toolColor);
  else applyTool(tool, toolColor);
}

TOOL_BUTTONS.pen.forEach((el) => el && el.addEventListener('click', onPenClick));
TOOL_BUTTONS.arrow.forEach((el) => el && el.addEventListener('click', () => toggleTool('arrow')));
TOOL_BUTTONS.rect.forEach((el) => el && el.addEventListener('click', () => toggleTool('rect')));

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

// ---- Manual window drag (replaces -webkit-app-region, broken on transparent Windows windows) ----
function isInteractive(el) {
  return !!el.closest('button, select, input, label, a, .switch, .pill-controls, .compact-tools');
}

function initWindowDrag() {
  for (const id of ['dragbar', 'compactDragZone']) {
    const zone = document.getElementById(id);
    if (!zone) continue;
    zone.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || isInteractive(e.target)) return;
      e.preventDefault();
      window.gravador.startWindowDrag();
    });
  }
  // Global: the cursor routinely leaves the small window mid-drag.
  window.addEventListener('mouseup', () => window.gravador.endWindowDrag());
  window.addEventListener('blur', () => window.gravador.endWindowDrag());
}
initWindowDrag();

// ---- Init ----
btnOpenFolder.disabled = !hasSavedThisSession;
initSettings();
render();
