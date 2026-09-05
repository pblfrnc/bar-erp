const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let serverProcess = null;

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

function startServer() {
  const serverDir = path.join(__dirname, '..', 'server');
  // In development, server is usually run via npm run dev:server
  // In production / exe, we can run node server
  if (!isDev) {
    try {
      const serverEntry = path.join(serverDir, 'dist', 'index.js');
      serverProcess = spawn(process.execPath, [serverEntry], {
        cwd: serverDir,
        env: { ...process.env, PORT: '3001', NODE_ENV: 'production' }
      });

      serverProcess.stdout.on('data', (data) => {
        console.log(`[SERVER]: ${data}`);
      });

      serverProcess.stderr.on('data', (data) => {
        console.error(`[SERVER ERROR]: ${data}`);
      });
    } catch (err) {
      console.error('Falha ao iniciar servidor embutido:', err);
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 868,
    minWidth: 1024,
    minHeight: 680,
    title: 'BarERP Pro • Frente de Caixa & Mesas',
    backgroundColor: '#020617',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // URL para carregar
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  }

  // Atalho F11 para Tela Cheia no Windows
  globalShortcut.register('F11', () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (serverProcess) {
    serverProcess.kill();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
