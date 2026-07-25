const { app, BrowserWindow } = require('electron');

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

app.whenReady().then(() => {
  createToolbarWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
