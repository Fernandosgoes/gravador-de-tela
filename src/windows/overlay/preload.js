const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayBridge', {
  onToolChanged: (callback) => ipcRenderer.on('overlay:tool-changed', (_e, payload) => callback(payload)),
  onSettingsChanged: (callback) => ipcRenderer.on('settings:changed', (_e, payload) => callback(payload)),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setIgnoreMouse: (ignore) => ipcRenderer.send('overlay:set-ignore-mouse', ignore)
});
