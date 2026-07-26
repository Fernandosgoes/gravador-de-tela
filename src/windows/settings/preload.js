const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsBridge', {
  get: () => ipcRenderer.invoke('settings:get'),
  update: (settings) => ipcRenderer.send('settings:update', settings)
});
