const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayBridge', {
  onToolChanged: (callback) => ipcRenderer.on('overlay:tool-changed', (_e, payload) => callback(payload))
});
