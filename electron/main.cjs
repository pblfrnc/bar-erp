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
    
    // Procura o banco pré-semeado inicial em múltiplas localizações possíveis
    const candidateDefaultDbPaths = [
      path.join(__dirname, '..', 'server', 'prisma', 'dev.db'),
      path.join(process.resourcesPath || '', 'server', 'prisma', 'dev.db'),
      path.join(process.resourcesPath || '', 'app', 'server', 'prisma', 'dev.db')
    ];

    let defaultDbPath = candidateDefaultDbPaths.find(p => fs.existsSync(p));

    // Se o banco ainda não existir no AppData do usuário, copia o banco inicial pré-populado
    if (!fs.existsSync(dbPath) && defaultDbPath) {
      fs.copyFileSync(defaultDbPath, dbPath);
      console.log('✅ Banco de dados inicial copiado com sucesso de:', defaultDbPath, 'para:', dbPath);
    }

    // Configurar variável de ambiente para o Prisma usar o banco do AppData (usando forward slashes para Windows)
    const normalizedDbPath = dbPath.replace(/\\/g, '/');
    process.env.DATABASE_URL = `file:${normalizedDbPath}`;
    console.log('DATABASE_URL configurada:', process.env.DATABASE_URL);

    // Apontar o Prisma para o engine nativo embutido junto com o bundle do servidor
    const engineFilename = process.platform === 'win32'
      ? 'query_engine-windows.dll.node'
      : process.platform === 'darwin'
        ? 'libquery_engine-darwin.dylib.node'
        : 'libquery_engine-debian-openssl-3.0.x.so.node';

    const candidateEnginePaths = [
      path.join(__dirname, '..', 'server', 'dist', 'prisma-engine', engineFilename),
      path.join(__dirname, '..', 'server', 'dist', engineFilename),
      path.join(process.resourcesPath || '', 'server', 'dist', 'prisma-engine', engineFilename),
      path.join(process.resourcesPath || '', 'server', 'dist', engineFilename),
      path.join(process.resourcesPath || '', engineFilename),
      path.join(__dirname, '..', 'server', 'dist', '.prisma', 'client', engineFilename)
    ];

    for (const p of candidateEnginePaths) {
      if (fs.existsSync(p)) {
        process.env.PRISMA_QUERY_ENGINE_LIBRARY = p;
        console.log('✅ PRISMA_QUERY_ENGINE_LIBRARY configurada:', p);
        break;
      }
    }
    if (!process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
      console.warn('⚠️ Engine do Prisma não encontrado nas rotas candidatas:', candidateEnginePaths);
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

    const serverEntryCjs = path.join(__dirname, '..', 'server', 'dist', 'index.cjs');
    const serverEntryJs = path.join(__dirname, '..', 'server', 'dist', 'index.js');

    if (fs.existsSync(serverEntryCjs)) {
      console.log('Iniciando servidor local via require CJS direto:', serverEntryCjs);
      require(serverEntryCjs);
      console.log('✅ Servidor BarERP iniciado com sucesso no processo principal via CJS!');
    } else if (fs.existsSync(serverEntryJs)) {
      console.log('Iniciando servidor local via import direto:', serverEntryJs);
      const fileUrl = pathToFileURL(serverEntryJs).href;
      await import(fileUrl);
      console.log('✅ Servidor BarERP iniciado com sucesso no processo principal via ESM!');
    } else {
      console.warn('Arquivo do servidor não encontrado em:', serverEntryCjs, 'ou', serverEntryJs);
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

  // Atalho F12 para abrir DevTools caso necessário
  globalShortcut.register('F12', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
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
