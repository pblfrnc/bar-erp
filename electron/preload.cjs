const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  getSavedPrinterSettings: () => ipcRenderer.invoke('get-saved-printer-settings'),
  savePrinterSettings: (settings) => ipcRenderer.invoke('save-printer-settings', settings),
  printSilent: (options) => ipcRenderer.send('print-silent', options),
  printPdfSilent: (urlOrOptions) => ipcRenderer.send('print-pdf-silent', urlOrOptions),
  printPdfDialog: (urlOrOptions) => ipcRenderer.send('print-pdf-dialog', urlOrOptions),
  printPdf: (url, printerName) => ipcRenderer.send('print-pdf', { url, printerName }),
  printTestTicket: (settings) => ipcRenderer.send('print-test-ticket', settings),
  focusWindow: () => ipcRenderer.send('focus-window'),
  showConfirm: (message, title) => ipcRenderer.sendSync('show-confirm-dialog', { message, title }),

  // Auto-Updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  startDownloadUpdate: (downloadUrl) => ipcRenderer.send('start-download-update', downloadUrl),
  installAndRestart: () => ipcRenderer.send('install-and-restart'),
  onUpdateAvailable: (callback) => {
    const sub = (event, data) => callback(data);
    ipcRenderer.on('update-available', sub);
    return () => ipcRenderer.removeListener('update-available', sub);
  },
  onUpdateProgress: (callback) => {
    const sub = (event, data) => callback(data);
    ipcRenderer.on('update-download-progress', sub);
    return () => ipcRenderer.removeListener('update-download-progress', sub);
  },
  onUpdateDownloaded: (callback) => {
    const sub = (event, data) => callback(data);
    ipcRenderer.on('update-downloaded', sub);
    return () => ipcRenderer.removeListener('update-downloaded', sub);
  },
  onUpdateError: (callback) => {
    const sub = (event, data) => callback(data);
    ipcRenderer.on('update-download-error', sub);
    return () => ipcRenderer.removeListener('update-download-error', sub);
  }
});
