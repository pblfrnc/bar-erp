const { app, BrowserWindow, globalShortcut, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

let mainWindow = null;

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

// Inicializar banco de dados persistente no AppData do usuário no Windows
function setupDatabase() {
  try {
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    const dbPath = path.join(userDataPath, 'bar.db');
    const defaultDbPath = path.join(__dirname, '..', 'server', 'prisma', 'dev.db');

    // Se o banco ainda não existir no AppData do usuário, copia o banco inicial pré-populado
    if (!fs.existsSync(dbPath) && fs.existsSync(defaultDbPath)) {
      fs.copyFileSync(defaultDbPath, dbPath);
      console.log('✅ Banco de dados inicial copiado com sucesso para:', dbPath);
    }

    // Configurar variável de ambiente para o Prisma usar o banco do AppData
    process.env.DATABASE_URL = `file:${dbPath}`;
    console.log('DATABASE_URL configurada:', process.env.DATABASE_URL);

    // Apontar o Prisma para o engine nativo embutido junto com o bundle do servidor
    const engineDir = path.join(__dirname, '..', 'server', 'dist', '.prisma', 'client');
    if (fs.existsSync(engineDir)) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(engineDir, 'query_engine-windows.dll.node');
      console.log('PRISMA_QUERY_ENGINE_LIBRARY:', process.env.PRISMA_QUERY_ENGINE_LIBRARY);
    }
  } catch (err) {
    console.error('Erro ao configurar banco de dados no AppData:', err);
  }
}

// Iniciar o servidor Express + WebSocket diretamente no processo principal
async function startServer() {
  if (isDev) {
    console.log('[DEV] Servidor externo esperado na porta 3001');
    return;
  }

  try {
    setupDatabase();
    process.env.PORT = '3001';
    process.env.NODE_ENV = 'production';

    const serverEntry = path.join(__dirname, '..', 'server', 'dist', 'index.js');
    if (fs.existsSync(serverEntry)) {
      console.log('Iniciando servidor local via import direto:', serverEntry);
      const fileUrl = pathToFileURL(serverEntry).href;
      await import(fileUrl);
      console.log('✅ Servidor BarERP iniciado com sucesso no processo principal!');
    } else {
      console.warn('Arquivo do servidor não encontrado em:', serverEntry);
    }
  } catch (err) {
    console.error('Aviso ao iniciar servidor embutido:', err);
    if (err && err.code !== 'EADDRINUSE') {
      dialog.showErrorBox(
        'Aviso do Servidor',
        `O servidor encontrou um aviso ao inicializar: ${err.message || err}`
      );
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

app.whenReady().then(async () => {
  await startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
