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
const COMPACT_SIZE = { width: 320, height: 48 };
const COMPACT_SIZE_WITH_COLORS = { width: 320, height: 92 };
// activeTool is declared further down (with the rest of the tool state) but
// this is only ever called from render()/syncToolButtons(), both invoked
// well after the whole script has run once — never during initial load.
function compactSize() {
  return activeTool !== 'none' ? COMPACT_SIZE_WITH_COLORS : COMPACT_SIZE;
}

const POSITION_MARGIN = 48;

// Places the bar right before a recording starts. The bar is a real, opaque
// window — wherever it sits, clicks land on it instead of the drawing
// overlay underneath. So the goal is to keep it off the recorded area
// entirely whenever the screen has room, only falling back to sitting inside
// the area (least-bad option) when there's nowhere else to put it.
// Uses the compact size since that's the version visible for the recording.
async function positionForRecording(areaRect) {
  const screenBounds = await window.gravador.getPrimaryDisplayBounds();
  const { width: barWidth, height: barHeight } = compactSize();

  if (!areaRect) {
    // Fullscreen: everywhere is "the recorded area", so there's no true safe
    // spot — top-right corner is simply less likely to sit over content than
    // top-center.
    window.gravador.positionWindow({
      x: screenBounds.x + screenBounds.width - barWidth - POSITION_MARGIN,
      y: screenBounds.y + POSITION_MARGIN
    });
    return;
  }

  const clamp = (v, min, max) => Math.max(min, Math.min(v, max));
  const x = clamp(
    areaRect.x + (areaRect.width - barWidth) / 2,
    screenBounds.x,
    screenBounds.x + screenBounds.width - barWidth
  );

  const spaceAbove = areaRect.y - screenBounds.y;
  const spaceBelow = (screenBounds.y + screenBounds.height) - (areaRect.y + areaRect.height);
  const needed = barHeight + 2 * POSITION_MARGIN;

  let y;
  if (spaceAbove >= needed) {
    y = areaRect.y - barHeight - POSITION_MARGIN; // outside, above the area
  } else if (spaceBelow >= needed) {
    y = areaRect.y + areaRect.height + POSITION_MARGIN; // outside, below the area
  } else if (areaRect.height >= needed) {
    y = areaRect.y + POSITION_MARGIN; // no room outside — inside, near the top
  } else {
    y = areaRect.y + areaRect.height - barHeight - POSITION_MARGIN; // inside, near the bottom
  }

  window.gravador.positionWindow({ x, y });
}

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
const btnToolOff = document.getElementById('btnToolOff');
const cameraSelect = document.getElementById('cameraSelect');
const micSelect = document.getElementById('micSelect');
const sysAudioToggle = document.getElementById('sysAudioToggle');
const pillTimer = document.getElementById('pillTimer');
const btnSettings = document.getElementById('btnSettings');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const shortcutFields = document.querySelectorAll('.shortcut-field');
const settingsTabs = document.querySelectorAll('.settings-tab');
const settingsTabPanels = document.querySelectorAll('.settings-tab-panel');

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

  window.gravador.resizeWindow(isIdleOrPreview ? EXPANDED_SIZE : compactSize());
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

    // Root cause of an earlier "hangs forever" bug: the main-process handler
    // used to resolve with the BrowserWindow itself, which can't cross the
    // IPC bridge ("An object could not be cloned") — the invoke() below never
    // settled. Fixed by resolving with nothing there; safe to await here now.
    await window.gravador.createOverlay();
    // transition+render BEFORE positioning: render() shrinks the window to
    // the compact size. positionForRecording() computes coordinates from
    // that same compact size — running it first left the (still expanded,
    // 420px-tall) window moved to a spot sized for the compact bar, so a
    // chunk of the expanded window's old footprint stayed behind, planted
    // over the recording area and swallowing clicks meant for the overlay.
    transition('start');
    render();
    await positionForRecording(logicalRect);
    await window.gravador.runCountdown();
    await window.recorderApi.start(screenSource.id, cropRect);
    if (logicalRect) window.gravador.showAreaFrame(logicalRect);
    startTimer();
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
  window.gravador.destroyOverlay();
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
  window.gravador.destroyOverlay();
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

// ---- Overlay tool state ----
let activeTool = 'none';       // 'none' | 'pen' | 'arrow' | 'rect'
let toolColor = '#000000';

// Buttons come in pairs: the expanded card and the compact recording bar each
// have their own DOM node for the same logical tool.
const TOOL_BUTTONS = {
  pen: [btnPen, document.getElementById('btnPenC')],
  arrow: [btnArrow, document.getElementById('btnArrowC')],
  rect: [document.getElementById('btnRectC')]
};

const colorSwatches = document.querySelectorAll('#colorSwatches .color-swatch');

function syncToolButtons() {
  for (const [tool, els] of Object.entries(TOOL_BUTTONS)) {
    for (const el of els) {
      if (el) el.classList.toggle('active', activeTool === tool);
    }
  }
  body.classList.toggle('tool-active', activeTool !== 'none');
  // Toggling a tool during recording/paused changes whether the color row is
  // visible — the window must grow/shrink to match, not just render() (which
  // only fires on idle/recording/paused/preview state transitions).
  if (state === 'recording' || state === 'paused') {
    window.gravador.resizeWindow(compactSize());
  }
}

function syncColorSwatches() {
  colorSwatches.forEach((el) => el.classList.toggle('active', el.dataset.color === toolColor));
}

function applyTool(tool, color) {
  activeTool = tool;
  toolColor = color || toolColor;
  syncToolButtons();
  syncColorSwatches();
  window.gravador.setOverlayTool({ tool: activeTool, color: toolColor });
}

colorSwatches.forEach((el) => el.addEventListener('click', () => {
  toolColor = el.dataset.color;
  syncColorSwatches();
  if (activeTool !== 'none') window.gravador.setOverlayTool({ tool: activeTool, color: toolColor });
}));

window.gravador.onForceToolNone(() => applyTool('none', toolColor));
btnToolOff.addEventListener('click', () => applyTool('none', toolColor));

window.gravador.onShortcutAction((action) => {
  if (action === 'toggleRecord') {
    if (state === 'idle' && captureMode === 'fullscreen') btnRecord.click();
    else if (state === 'recording' || state === 'paused') btnStop.click();
  } else if (action === 'pause') {
    if (state === 'recording' || state === 'paused') btnPause.click();
  } else if (action === 'cancel') {
    if (state === 'recording' || state === 'paused') btnCancel.click();
  } else if (action === 'pen' || action === 'arrow' || action === 'rect') {
    if (state === 'recording' || state === 'paused') toggleTool(action);
  }
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

// Each .shortcut-field wraps one action's input + clear button; wiring is
// identical across all 6, so it's driven by data-action instead of six
// hand-written blocks.
shortcutFields.forEach((field) => {
  const action = field.dataset.action;
  const input = field.querySelector('.shortcutInput');
  const clearBtn = field.querySelector('.shortcutClear');

  input.addEventListener('keydown', (e) => {
    e.preventDefault();
    if (e.key === 'Escape') { input.blur(); return; }
    const accelerator = keysToAccelerator(e);
    if (!accelerator) return; // only a modifier held so far, keep waiting
    input.value = accelerator;
    window.gravador.updateSettings({ shortcuts: { [action]: accelerator } });
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    window.gravador.updateSettings({ shortcuts: { [action]: null } });
  });
});

settingsTabs.forEach((tab) => tab.addEventListener('click', () => {
  settingsTabs.forEach((t) => t.classList.toggle('active', t === tab));
  settingsTabPanels.forEach((p) => p.classList.toggle('active', p.dataset.tabPanel === tab.dataset.tab));
}));

btnSettings.addEventListener('click', async () => {
  if (state !== 'idle') return;
  body.classList.add('settings-open');
  // Always reopen on the Shortcuts tab, regardless of which tab was active
  // last time the panel was closed.
  settingsTabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === 'shortcuts'));
  settingsTabPanels.forEach((p) => p.classList.toggle('active', p.dataset.tabPanel === 'shortcuts'));
  const settings = await window.gravador.getSettings();
  shortcutFields.forEach((field) => {
    const input = field.querySelector('.shortcutInput');
    input.value = settings.shortcuts?.[field.dataset.action] || '';
  });
});

btnCloseSettings.addEventListener('click', () => {
  body.classList.remove('settings-open');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && body.classList.contains('settings-open') && !document.activeElement.classList.contains('shortcutInput')) {
    body.classList.remove('settings-open');
  }
});

function toggleTool(tool) {
  if (activeTool === tool) applyTool('none', toolColor);
  else applyTool(tool, toolColor);
}

TOOL_BUTTONS.pen.forEach((el) => el && el.addEventListener('click', () => toggleTool('pen')));
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
  const noMicOpt = document.createElement('option');
  noMicOpt.value = '';
  noMicOpt.textContent = 'Nenhum microfone';
  micSelect.appendChild(noMicOpt);
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
  return !!el.closest('button, select, input, label, a, .switch, .pill-controls, .compact-tools, .color-swatches');
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
