const { app, BrowserWindow, ipcMain } = require('electron');
const { listSources } = require('./capture');
const { toCropParams } = require('../lib/cropMath');

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
  win.loadFile(require('path').join(__dirname, '../windows/toolbar/index.html'));
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

app.whenReady().then(() => {
  ipcMain.handle('capture:list-sources', () => listSources());
  ipcMain.handle('areaselect:pick', () => createAreaSelectWindow());
  ipcMain.on('overlay:set-tool', (event, payload) => {
    if (overlayWindow) {
      overlayWindow.setIgnoreMouseEvents(payload.tool === 'none', { forward: true });
      overlayWindow.webContents.send('overlay:tool-changed', payload);
    }
  });
  createToolbarWindow();
  createOverlayWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
