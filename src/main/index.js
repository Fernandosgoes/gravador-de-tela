const { app, BrowserWindow, ipcMain, dialog, shell, globalShortcut, Tray, Menu } = require('electron');
const { listSources } = require('./capture');
const { toCropParams } = require('../lib/cropMath');
const { saveRecording } = require('./export');

let toolbarWindow = null;
app.isQuitting = false;

function createToolbarWindow() {
  const win = new BrowserWindow({
    width: 560,
    height: 110,
    alwaysOnTop: true,
    resizable: false,
    transparent: true,
    frame: false,
    webPreferences: {
      preload: require('path').join(__dirname, '../windows/toolbar/preload.js'),
      contextIsolation: true
    }
  });
  win.setContentProtection(true);
  win.loadFile(require('path').join(__dirname, '../windows/toolbar/index.html'));
  win.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      win.hide();
    }
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
  if (toolbarWindow && !toolbarWindow.isDestroyed()) {
    toolbarWindow.destroy();
  }
  createToolbarWindow();
  if (!wasVisible) {
    toolbarWindow.hide();
  }
}

let tray = null; // kept top-level: the GC destroys the tray icon if it's only function-local

function createTray() {
  tray = new Tray(require('path').join(__dirname, '../../build/icon.ico'));
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

function createAreaSelectWindow() {
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

    let settled = false;
    const cleanup = (result) => {
      if (settled) return;
      settled = true;
      ipcMain.removeListener('areaselect:result', onResult);
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

function createOverlayWindow() {
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
    webPreferences: {
      preload: require('path').join(__dirname, '../windows/overlay/preload.js'),
      contextIsolation: true
    }
  });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.loadFile(require('path').join(__dirname, '../windows/overlay/index.html'));
  return overlayWindow;
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
// (annotations must appear in the video), while this frame must NOT appear.
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
  win.setContentProtection(true); // hides it from the capture
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

let appSettings = {
  cameraId: null,
  micEnabled: true,
  micId: null,
  systemAudioEnabled: true,
  shortcuts: { toggleRecord: 'CommandOrControl+Shift+R' },
  ...loadSettings()
};

let registeredShortcut = null;

function applyRecordShortcut(accelerator) {
  if (registeredShortcut) globalShortcut.unregister(registeredShortcut);
  registeredShortcut = null;
  if (!accelerator) return;
  const ok = globalShortcut.register(accelerator, () => {
    if (toolbarWindow && !toolbarWindow.isDestroyed()) {
      toolbarWindow.webContents.send('shortcut:toggle-record');
    }
  });
  if (ok) registeredShortcut = accelerator;
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

  // Safety net: no matter what state the window stack is in, Escape always
  // forces any active annotation tool off. Registered globally (not a
  // renderer keydown listener) so it works even if the overlay window is
  // covering the toolbar's own buttons.
  globalShortcut.register('Escape', () => {
    if (toolbarWindow && !toolbarWindow.isDestroyed()) {
      toolbarWindow.webContents.send('tool:force-none');
    }
  });

  applyRecordShortcut(appSettings.shortcuts.toggleRecord);

  ipcMain.on('recording:state-changed', (event, state) => {
    currentRecordingState = state;
  });
  ipcMain.handle('capture:list-sources', () => listSources());
  ipcMain.handle('areaselect:pick', () => createAreaSelectWindow());
  ipcMain.handle('countdown:run', () => createCountdownWindow());
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
    // The overlay is fullscreen and alwaysOnTop; without an explicit level it can
    // end up above the toolbar once a tool starts capturing clicks, making the
    // recording bar's own buttons unreachable. Elevate the toolbar's level only
    // while a tool is active, so Cancel/Stop/re-clicking the tool stay reachable
    // without the toolbar permanently outranking the user's other windows.
    if (toolbarWindow && !toolbarWindow.isDestroyed()) {
      toolbarWindow.setAlwaysOnTop(payload.tool !== 'none', 'screen-saver');
    }
  });
  ipcMain.on('overlay:set-ignore-mouse', (event, ignore) => {
    if (overlayWindow) overlayWindow.setIgnoreMouseEvents(ignore, { forward: true });
  });
  ipcMain.handle('settings:get', () => appSettings);
  ipcMain.on('settings:update', (event, newSettings) => {
    appSettings = {
      ...appSettings,
      ...newSettings,
      shortcuts: { ...appSettings.shortcuts, ...newSettings.shortcuts }
    };
    saveSettings(appSettings);
    const nextAccel = appSettings.shortcuts?.toggleRecord;
    if (nextAccel !== registeredShortcut) applyRecordShortcut(nextAccel);
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('settings:changed', appSettings));
  });
  ipcMain.on('toolbar:resize', (event, { width, height }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setSize(width, height, true);
  });
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
  let lastSavedPath = null;
  ipcMain.handle('export:save', async (event, arrayBuffer) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await saveRecording(Buffer.from(arrayBuffer), win);
    if (result.success) {
      lastSavedPath = result.path;
    }
    // Let the IPC response reach the renderer before the window is torn down.
    setImmediate(() => recreateToolbarWindow());
    return result;
  });
  ipcMain.handle('export:open-last-folder', () => {
    if (!lastSavedPath) return { opened: false };
    shell.showItemInFolder(lastSavedPath);
    return { opened: true };
  });
  createToolbarWindow();
  createOverlayWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // With the tray active, closing the toolbar only hides it (see createToolbarWindow's
  // close handler) — the app is meant to keep running in the background. Only quit
  // here as a fallback if the tray somehow failed to create.
  if (!tray) app.quit();
});
