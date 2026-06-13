const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveAndOpenInstaller: (bufferBase64: string, filename: string) =>
    ipcRenderer.invoke('save-and-open-installer', bufferBase64, filename),
});
