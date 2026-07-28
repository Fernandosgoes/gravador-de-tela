const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gravador', {
  listSources: () => ipcRenderer.invoke('capture:list-sources'),
  pickArea: () => ipcRenderer.invoke('areaselect:pick'),
  setOverlayTool: (payload) => ipcRenderer.send('overlay:set-tool', payload),
  createOverlay: () => ipcRenderer.invoke('overlay:create'),
  destroyOverlay: () => ipcRenderer.send('overlay:destroy'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.send('settings:update', settings),
  onSettingsChanged: (callback) => ipcRenderer.on('settings:changed', (event, settings) => callback(settings)),
  saveRecording: (arrayBuffer) => ipcRenderer.invoke('export:save', arrayBuffer),
  notifyState: (state) => ipcRenderer.send('recording:state-changed', state),
  runCountdown: () => ipcRenderer.invoke('countdown:run'),
  openLastFolder: () => ipcRenderer.invoke('export:open-last-folder'),
  resizeWindow: (size) => ipcRenderer.send('toolbar:resize', size),
  positionWindow: (pos) => ipcRenderer.send('toolbar:position', pos),
  getPrimaryDisplayBounds: () => ipcRenderer.invoke('screen:get-primary-bounds'),
  startWindowDrag: () => ipcRenderer.send('window:drag-start'),
  endWindowDrag: () => ipcRenderer.send('window:drag-end'),
  showAreaFrame: (rect) => ipcRenderer.send('areaframe:show', rect),
  hideAreaFrame: () => ipcRenderer.send('areaframe:hide'),
  onForceToolNone: (callback) => ipcRenderer.on('tool:force-none', () => callback()),
  onShortcutAction: (callback) => ipcRenderer.on('shortcut:action', (_e, action) => callback(action))
});
