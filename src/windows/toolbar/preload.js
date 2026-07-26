const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gravador', {
  listSources: () => ipcRenderer.invoke('capture:list-sources'),
  pickArea: () => ipcRenderer.invoke('areaselect:pick'),
  setOverlayTool: (payload) => ipcRenderer.send('overlay:set-tool', payload),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.send('settings:update', settings),
  onSettingsChanged: (callback) => ipcRenderer.on('settings:changed', (event, settings) => callback(settings)),
  saveRecording: (arrayBuffer) => ipcRenderer.invoke('export:save', arrayBuffer),
  notifyState: (state) => ipcRenderer.send('recording:state-changed', state),
  runCountdown: () => ipcRenderer.invoke('countdown:run'),
  openLastFolder: () => ipcRenderer.invoke('export:open-last-folder'),
  resizeWindow: (size) => ipcRenderer.send('toolbar:resize', size)
});
