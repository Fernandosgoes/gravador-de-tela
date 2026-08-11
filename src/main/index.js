const { app, BrowserWindow, ipcMain, dialog, globalShortcut, Tray, Menu } = require('electron');
const { listSources } = require('./capture');
const { toCropParams } = require('../lib/cropMath');
const { saveRecording } = require('./export');

app.setName('Gravador de Tela');

let toolbarWindow = null;
app.isQuitting = false;

// bounds/shouldShow let recreateToolbarWindow() restore the previous window's
// position and defer showing until it's fully sized+stated — see there for why.
function createToolbarWindow(bounds, shouldShow = true) {
  const win = new BrowserWindow({
    // 296x420 matches EXPANDED_SIZE (toolbar.js) — the idle-state size every
    // fresh window lands in, whether at first boot or after recreation.
    width: 296,
    height: 420,
    alwaysOnTop: true,
    resizable: false,
    transparent: true,
    frame: false,
    show: false,
    webPreferences: {
      preload: require('path').join(__dirname, '../windows/toolbar/preload.js'),
      contextIsolation: true
    }
  });
  // Must match or beat the 'screen-saver' level used by areaframe/countdown/
  // areaselect — otherwise the area outline's darkening overlay paints over
  // the toolbar whenever it sits outside the recorded area, making it look
  // dim/washed-out even though it's fully opaque.
  win.setAlwaysOnTop(true, 'screen-saver');
  if (bounds) win.setBounds(bounds);
  win.loadFile(require('path').join(__dirname, '../windows/toolbar/index.html'));
  win.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
  win.once('ready-to-show', () => {
    if (shouldShow) win.show();
  });
  toolbarWindow = win;
  return win;
}

// The native save dialog (and possibly other modal dialogs) can leave this
// window in a stuck/unresponsive state on some Electron/Windows combinations
// (frameless + transparent windows losing sync with the compositor after a
// modal closes). Recreating the window from scratch — instead of just
// re-focusing it — has proven to be the only reliable fix after lighter
// mitigations (refocusing, elevating always-on-top) failed.
function recreateToolbarWindow() {
  if (currentRecordingState === 'recording' || currentRecordingState === 'paused') {
    // Never destroy the window mid-recording — it would kill the MediaRecorder
    // living in that renderer. Just try to bring it back as-is.
    if (toolbarWindow && !toolbarWindow.isDestroyed()) {
      toolbarWindow.show();
      toolbarWindow.focus();
    }
    return;
  }
  const wasVisible = toolbarWindow && !toolbarWindow.isDestroyed() && toolbarWindow.isVisible();
  const bounds = wasVisible ? toolbarWindow.getBounds() : null;
  if (toolbarWindow && !toolbarWindow.isDestroyed()) {
    // Hide before destroying — otherwise the doomed window can paint one more
    // stale frame (still showing the old Save/Discard preview state) during
    // teardown, which read as a flash right before the toolbar disappeared.
    toolbarWindow.hide();
    toolbarWindow.destroy();
  }
  createToolbarWindow(bounds, wasVisible);
}

let tray = null; // kept top-level: the GC destroys the tray icon if it's only function-local

function createTray() {
  // In dev, build/icon.ico sits in the project root. Packaged, it's not inside
  // app.asar (build/ is not in "files") — electron-builder's extraResources
  // copies it next to the asar instead, under process.resourcesPath.
  const iconPath = app.isPackaged
    ? require('path').join(process.resourcesPath, 'build/icon.ico')
    : require('path').join(__dirname, '../../build/icon.ico');
  tray = new Tray(iconPath);
  tray.setToolTip('Gravador de Tela');
  const showToolbar = () => {
    recreateToolbarWindow();
    if (toolbarWindow && !toolbarWindow.isDestroyed()) {
      toolbarWindow.show();
      toolbarWindow.focus();
    }
  };
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir', click: showToolbar },
    { type: 'separator' },
    { label: 'Sair', click: () => { app.isQuitting = true; app.quit(); } }
  ]));
  tray.on('click', showToolbar);
}

let areaSelectWindow = null;

function createAreaSelectWindow() {
  // Defense in depth against orphaned pickers: if a previous pick is somehow
  // still open (e.g. IPC invoked twice before the first resolved), close it
  // first rather than stacking a second darkening overlay on top of it.
  if (areaSelectWindow && !areaSelectWindow.isDestroyed()) areaSelectWindow.close();
  return new Promise((resolve) => {
    const { screen } = require('electron');
    const primary = screen.getPrimaryDisplay();
    const win = new BrowserWindow({
      x: 0,
      y: 0,
      width: primary.bounds.width,
      height: primary.bounds.height,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: true,
      show: false,
      webPreferences: {
        preload: require('path').join(__dirname, '../windows/areaselect/preload.js'),
        contextIsolation: true
      }
    });
    win.setAlwaysOnTop(true, 'screen-saver'); // must win over the Windows taskbar
    areaSelectWindow = win;

    let settled = false;
    const cleanup = (result) => {
      if (settled) return;
      settled = true;
      ipcMain.removeListener('areaselect:result', onResult);
      if (areaSelectWindow === win) areaSelectWindow = null;
      if (!win.isDestroyed()) win.close();
      resolve(result);
    };
    const onResult = (event, rect) => {
      if (!rect) return cleanup(null);
      const logical = toCropParams(rect, { width: primary.bounds.width, height: primary.bounds.height });
      // The recorder captures physical pixels (desktopCapturer's stream resolution),
      // but the picker's rect is in logical/CSS pixels — scale by scaleFactor so the
      // crop lands on the right region on displays with Windows scaling != 100%.
      // The areaframe window (physical border overlay) needs the logical rect back,
      // since it positions in CSS pixels — both are carried through.
      const { scaleFactor } = primary;
      cleanup({
        logical,
        physical: {
          x: Math.round(logical.x * scaleFactor),
          y: Math.round(logical.y * scaleFactor),
          width: Math.round(logical.width * scaleFactor),
          height: Math.round(logical.height * scaleFactor)
        }
      });
    };

    ipcMain.on('areaselect:result', onResult);
    win.on('closed', () => cleanup(null));
    win.once('ready-to-show', () => {
      win.show();
      win.focus();
      win.webContents.focus(); // without this the document never receives keydown
    });
    win.loadFile(require('path').join(__dirname, '../windows/areaselect/index.html'));
  });
}

let overlayWindow = null;

// Created on demand at recording start and destroyed at recording end (see
// overlay:create/overlay:destroy below) rather than living for the app's
// whole lifetime — it's a fullscreen alwaysOnTop window with a continuous
// rAF render loop, so keeping it around while idle (the vast majority of the
// app's runtime) costs GPU/compositor work for nothing.
function createOverlayWindow() {
  return new Promise((resolve) => {
    const { screen } = require('electron');
    const primary = screen.getPrimaryDisplay();
    overlayWindow = new BrowserWindow({
      x: 0,
      y: 0,
      width: primary.bounds.width,
      height: primary.bounds.height,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: true,
      // A new BrowserWindow steals focus by default once shown. That was
      // harmless when this window was created once at app boot (nothing else
      // was competing for focus yet), but now it's created right before the
      // countdown/recording flow starts — without show:false it would steal
      // focus from the countdown window and toolbar mid-flow.
      show: false,
      webPreferences: {
        preload: require('path').join(__dirname, '../windows/overlay/preload.js'),
        contextIsolation: true
      }
    });
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    overlayWindow.webContents.once('did-finish-load', () => {
      // Resolve with nothing serializable, not the BrowserWindow itself — this
      // handler answers an ipcRenderer.invoke(), and a BrowserWindow can't be
      // structured-cloned across that bridge ("An object could not be cloned").
      resolve();
      overlayWindow.showInactive(); // visible but never steals focus from the countdown/toolbar
    });
    overlayWindow.loadFile(require('path').join(__dirname, '../windows/overlay/index.html'));
  });
}

function destroyOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy();
  overlayWindow = null;
}

function createCountdownWindow() {
  return new Promise((resolve) => {
    const { screen } = require('electron');
    const primary = screen.getPrimaryDisplay();
    const win = new BrowserWindow({
      x: 0,
      y: 0,
      width: primary.bounds.width,
      height: primary.bounds.height,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      webPreferences: {
        preload: require('path').join(__dirname, '../windows/countdown/preload.js'),
        contextIsolation: true
      }
    });
    win.loadFile(require('path').join(__dirname, '../windows/countdown/index.html'));

    let settled = false;
    function finish() {
      if (settled) return;
      settled = true;
      ipcMain.removeListener('countdown:done', onDone);
      if (!win.isDestroyed()) win.close();
      resolve();
    }
    function onDone() {
      finish();
    }
    ipcMain.on('countdown:done', onDone);
    win.on('closed', finish);
  });
}

let areaFrameWindow = null;

// Draws a thin outline around the recorded region. It needs its own window
// because the drawing overlay deliberately has NO content protection
// (annotations must appear in the video), while this frame is meant to be
// visual-only guidance and not end up in the recording.
function createAreaFrameWindow(rect) {
  const { screen } = require('electron');
  const primary = screen.getPrimaryDisplay();
  destroyAreaFrameWindow();
  const win = new BrowserWindow({
    x: 0,
    y: 0,
    width: primary.bounds.width,
    height: primary.bounds.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: require('path').join(__dirname, '../windows/areaframe/preload.js'),
      contextIsolation: true
    }
  });
  win.setAlwaysOnTop(true, 'screen-saver'); // must win over the Windows taskbar
  // No setContentProtection here: on some GPU/driver combos it makes the window
  // vanish from the actual screen (not just from capture) whenever another app's
  // screen-capture overlay activates (e.g. Lightshot, Windows' Snipping Tool) —
  // so this frame will show up if you record with a different tool, but it
  // never disappears from view. It's still excluded from this app's own
  // recordings, since those are composited from the raw screen source, not a
  // screenshot of this window.
  win.setIgnoreMouseEvents(true); // fully click-through, no forwarding needed
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('areaframe:set-rect', rect);
  });
  win.loadFile(require('path').join(__dirname, '../windows/areaframe/index.html'));
  areaFrameWindow = win;
  return win;
}

function destroyAreaFrameWindow() {
  if (areaFrameWindow && !areaFrameWindow.isDestroyed()) areaFrameWindow.destroy();
  areaFrameWindow = null;
}

const fs = require('fs');
const settingsPath = require('path').join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Failed to persist settings:', err);
  }
}

// Only toggleRecord ships with a default binding — the rest start unbound
// until the user opts in and assigns one from the shortcuts panel.
const DEFAULT_SHORTCUTS = {
  toggleRecord: 'CommandOrControl+Shift+R',
  pause: null,
  cancel: null,
  pen: null,
  arrow: null,
  rect: null
};

let appSettings = {
  cameraId: null,
  micEnabled: true,
  micId: null,
  systemAudioEnabled: false,
  outputFormat: 'mp4',
  frameColor: '#30D158',
  shortcuts: { ...DEFAULT_SHORTCUTS },
  ...loadSettings()
};

let registeredShortcuts = {}; // action -> accelerator currently registered with globalShortcut

function applyShortcuts(shortcuts) {
  for (const [action, accelerator] of Object.entries(registeredShortcuts)) {
    globalShortcut.unregister(accelerator);
  }
  registeredShortcuts = {};
  for (const action of Object.keys(DEFAULT_SHORTCUTS)) {
    const accelerator = shortcuts[action];
    if (!accelerator) continue;
    const ok = globalShortcut.register(accelerator, () => {
      if (toolbarWindow && !toolbarWindow.isDestroyed()) {
        toolbarWindow.webContents.send('shortcut:action', action);
      }
    });
    if (ok) registeredShortcuts[action] = accelerator;
  }
}

let currentRecordingState = 'idle';

app.on('before-quit', (event) => {
  if (currentRecordingState === 'recording' || currentRecordingState === 'paused') {
    const choice = dialog.showMessageBoxSync({
      type: 'warning',
      buttons: ['Cancelar', 'Sair mesmo assim'],
      defaultId: 0,
      title: 'Gravação em andamento',
      message: 'Você tem uma gravação em andamento que será perdida. Sair mesmo assim?'
    });
    if (choice === 0) {
      app.isQuitting = false; // the quit was aborted — undo the flag set by the tray's "Sair"
      event.preventDefault();
      return;
    }
  }
  destroyAreaFrameWindow();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  applyShortcuts(appSettings.shortcuts);

  ipcMain.on('recording:state-changed', (event, state) => {
    currentRecordingState = state;
  });
  ipcMain.handle('capture:list-sources', () => listSources());
  ipcMain.handle('areaselect:pick', () => createAreaSelectWindow());
  ipcMain.handle('countdown:run', () => createCountdownWindow());
  ipcMain.handle('overlay:create', () => createOverlayWindow());
  ipcMain.on('overlay:destroy', () => destroyOverlayWindow());
  ipcMain.on('overlay:set-area', (event, rect) => {
    if (overlayWindow) overlayWindow.webContents.send('overlay:set-area', rect);
  });
  let ignoreMouseNudgeTimer = null;
  ipcMain.on('overlay:set-tool', (event, payload) => {
    if (overlayWindow) {
      overlayWindow.setIgnoreMouseEvents(payload.tool === 'none', { forward: true });
      overlayWindow.webContents.send('overlay:tool-changed', payload);
      // Mitigation for a Windows DWM compositing artifact: transparent windows
      // stacked over hardware-accelerated video (e.g. a video playing in a
      // browser) can render as a blur/smear right when setIgnoreMouseEvents
      // toggles. Nudging the window's bounds forces the compositor to
      // recompute this window's surface. Not a guaranteed fix — it targets the
      // most likely cause (a missed invalidate on the mouse-events state change)
      // but DWM behavior varies across GPUs/drivers.
      const bounds = overlayWindow.getBounds();
      overlayWindow.setBounds(bounds);
    }
    // The same DWM state-loss can happen spontaneously mid-draw, without any
    // tool switch — reported as strokes silently stopping to register after
    // heavy, repeated use of the same tool, recoverable only by forcing the
    // tool off (Escape) and back on. Re-asserting setIgnoreMouseEvents(false)
    // on an interval while a tool is active is a low-cost way to keep
    // correcting that drift without waiting for the user to touch a button.
    clearInterval(ignoreMouseNudgeTimer);
    ignoreMouseNudgeTimer = null;
    if (payload.tool !== 'none') {
      ignoreMouseNudgeTimer = setInterval(() => {
        if (!overlayWindow || overlayWindow.isDestroyed()) {
          clearInterval(ignoreMouseNudgeTimer);
          ignoreMouseNudgeTimer = null;
          return;
        }
        overlayWindow.setIgnoreMouseEvents(false, { forward: true });
      }, 2000);
    }
    // The toolbar is created at 'screen-saver' level already (see
    // createToolbarWindow) and stays there regardless of tool state — it needs
    // to beat both the overlay (once a tool starts capturing clicks) and the
    // areaframe outline's darkening layer, which also runs at 'screen-saver'.
    // Pre-existing: dragging the toolbar while a tool is active (overlay's rAF
    // loop running full-tilt) stutters — not something the alwaysOnTop level
    // fixes, see the drag-performance work.
    // Escape as a safety net to force the tool off only while a tool is active —
    // registering it globally at all times hijacks Esc from every other app on
    // the system (e.g. Lightshot's capture overlay, Windows' own snipping tool,
    // which rely on Esc to cancel/close).
    if (payload.tool !== 'none') {
      globalShortcut.register('Escape', () => {
        if (toolbarWindow && !toolbarWindow.isDestroyed()) {
          toolbarWindow.webContents.send('tool:force-none');
        }
      });
    } else {
      globalShortcut.unregister('Escape');
    }
  });
  ipcMain.on('overlay:set-ignore-mouse', (event, ignore) => {
    if (overlayWindow) overlayWindow.setIgnoreMouseEvents(ignore, { forward: true });
  });
  ipcMain.on('toolbar:set-ignore-mouse', (event, ignore) => {
    if (toolbarWindow && !toolbarWindow.isDestroyed()) {
      toolbarWindow.setIgnoreMouseEvents(ignore, { forward: true });
    }
  });
  ipcMain.handle('settings:get', () => appSettings);
  ipcMain.on('settings:update', (event, newSettings) => {
    appSettings = {
      ...appSettings,
      ...newSettings,
      shortcuts: { ...appSettings.shortcuts, ...newSettings.shortcuts }
    };
    saveSettings(appSettings);
    if (newSettings.shortcuts) applyShortcuts(appSettings.shortcuts);
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('settings:changed', appSettings));
  });
  ipcMain.on('toolbar:resize', (event, { width, height }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setSize(width, height, true);
  });
  ipcMain.on('toolbar:position', (event, { x, y }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setPosition(Math.round(x), Math.round(y));
  });
  ipcMain.handle('screen:get-primary-bounds', () => require('electron').screen.getPrimaryDisplay().bounds);
  // Manual window drag. -webkit-app-region:drag is broken on Windows when the
  // window is transparent:true (Chromium renders a ghost outline and the window
  // never follows). screen.getCursorScreenPoint() returns DIP coordinates — the
  // same space as setBounds() — so this is DPI-safe, unlike renderer deltas.
  let dragTimer = null;
  ipcMain.on('window:drag-start', (event) => {
    const { screen } = require('electron');
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    const startCursor = screen.getCursorScreenPoint();
    const startBounds = win.getBounds();
    clearInterval(dragTimer);
    dragTimer = setInterval(() => {
      if (win.isDestroyed()) { clearInterval(dragTimer); dragTimer = null; return; }
      const p = screen.getCursorScreenPoint();
      win.setBounds({
        x: startBounds.x + (p.x - startCursor.x),
        y: startBounds.y + (p.y - startCursor.y),
        width: startBounds.width,
        height: startBounds.height
      });
    }, 16);
  });
  ipcMain.on('window:drag-end', () => {
    clearInterval(dragTimer);
    dragTimer = null;
  });
  ipcMain.on('areaframe:show', (event, rect) => {
    if (rect) createAreaFrameWindow(rect);
  });
  ipcMain.on('areaframe:hide', () => destroyAreaFrameWindow());
  ipcMain.handle('export:save', async (event, arrayBuffer, format) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await saveRecording(Buffer.from(arrayBuffer), win, format);
    // Let the IPC response reach the renderer before the window is torn down.
    setImmediate(() => recreateToolbarWindow());
    return result;
  });
  createToolbarWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // With the tray active, closing the toolbar only hides it (see createToolbarWindow's
  // close handler) — the app is meant to keep running in the background. Only quit
  // here as a fallback if the tray somehow failed to create.
  if (!tray) app.quit();
});
