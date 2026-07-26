const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('areaSelectBridge', {
  submit: (rect) => ipcRenderer.send('areaselect:result', rect)
});
