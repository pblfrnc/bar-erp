const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  printSilent: () => ipcRenderer.send('print-silent'),
  printPdfSilent: (url) => ipcRenderer.send('print-pdf-silent', url),
  focusWindow: () => ipcRenderer.send('focus-window')
});
