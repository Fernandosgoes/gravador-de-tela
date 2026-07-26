const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gravador', {
  listSources: () => ipcRenderer.invoke('capture:list-sources'),
  pickArea: () => ipcRenderer.invoke('areaselect:pick'),
  setOverlayTool: (payload) => ipcRenderer.send('overlay:set-tool', payload),
  openSettings: () => ipcRenderer.send('open-settings'),
  getSettings: () => ipcRenderer.invoke('settings:get')
});
