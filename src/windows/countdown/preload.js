const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('countdownBridge', {
  done: () => ipcRenderer.send('countdown:done')
});
