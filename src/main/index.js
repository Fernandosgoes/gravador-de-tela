const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const { listSources } = require('./capture');
const { toCropParams } = require('../lib/cropMath');
const { saveRecording } = require('./export');

let toolbarWindow = null;

function createToolbarWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 90,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      preload: require('path').join(__dirname, '../windows/toolbar/preload.js'),
      contextIsolation: true
    }
  });
  win.setContentProtection(true);
  win.loadFile(require('path').join(__dirname, '../windows/toolbar/index.html'));
  win.on('closed', () => {
    app.quit();
  });
  toolbarWindow = win;
  return win;
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
      webPreferences: {
        preload: require('path').join(__dirname, '../windows/areaselect/preload.js'),
        contextIsolation: true
      }
    });

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
      const cropped = toCropParams(rect, { width: primary.bounds.width, height: primary.bounds.height });
      cleanup(cropped);
    };

    ipcMain.on('areaselect:result', onResult);
    win.on('closed', () => cleanup(null));
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

let appSettings = {
  cameraId: null,
  micEnabled: true,
  micId: null,
  systemAudioEnabled: true
};
let settingsWindow = null;

function createSettingsWindow() {
  if (settingsWindow) { settingsWindow.focus(); return; }
  settingsWindow = new BrowserWindow({
    width: 360,
    height: 320,
    webPreferences: {
      preload: require('path').join(__dirname, '../windows/settings/preload.js'),
      contextIsolation: true
    }
  });
  settingsWindow.loadFile(require('path').join(__dirname, '../windows/settings/index.html'));
  settingsWindow.on('closed', () => { settingsWindow = null; });
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
      event.preventDefault();
    }
  }
});

app.whenReady().then(() => {
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
    }
  });
  ipcMain.on('overlay:set-ignore-mouse', (event, ignore) => {
    if (overlayWindow) overlayWindow.setIgnoreMouseEvents(ignore, { forward: true });
  });
  ipcMain.handle('settings:get', () => appSettings);
  ipcMain.on('settings:update', (event, newSettings) => {
    appSettings = { ...appSettings, ...newSettings };
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('settings:changed', appSettings));
  });
  ipcMain.on('open-settings', () => createSettingsWindow());
  let lastSavedPath = null;
  ipcMain.handle('export:save', async (event, arrayBuffer) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await saveRecording(Buffer.from(arrayBuffer), win);
    if (result.success) {
      lastSavedPath = result.path;
    }
    return result;
  });
  ipcMain.handle('export:open-last-folder', () => {
    if (!lastSavedPath) return { opened: false };
    shell.showItemInFolder(lastSavedPath);
    return { opened: true };
  });
  createToolbarWindow();
  createOverlayWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
