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
  showConfirm: (message, title) => ipcRenderer.sendSync('show-confirm-dialog', { message, title })
});
