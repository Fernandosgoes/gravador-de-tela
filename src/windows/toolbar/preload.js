const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gravador', {
  listSources: () => ipcRenderer.invoke('capture:list-sources'),
  pickArea: () => ipcRenderer.invoke('areaselect:pick')
});
