const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('areaFrameBridge', {
  onSetRect: (callback) => ipcRenderer.on('areaframe:set-rect', (_e, rect) => callback(rect))
});
