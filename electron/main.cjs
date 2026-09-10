const { app, BrowserWindow, globalShortcut, dialog, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { setupDailyBackup } = require('./backup.js');

// Desabilitar menu padrão do sistema para nunca prender o foco das teclas (ex: tecla Alt)
Menu.setApplicationMenu(null);

// Habilitar impressão silenciosa (bypass janela de impressão do sistema)
app.commandLine.appendSwitch('kiosk-printing');

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
    // Executa o backup diário logo após definir o banco
    setupDailyBackup(userDataPath, 'bar.db');
    // Verifica a cada 6 horas se o dia virou (caso o PC fique ligado 24/7)
    setInterval(() => setupDailyBackup(userDataPath, 'bar.db'), 6 * 60 * 60 * 1000);

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

  // Impressão silenciosa do DOM atual (80mm)
  ipcMain.on('print-silent', (event) => {
    if (mainWindow) {
      mainWindow.webContents.print({ 
        silent: true, 
        printBackground: true,
        margins: { marginType: 'none' }
      }, (success, failureReason) => {
        if (!success) console.error('Print failed:', failureReason);
      });
    }
  });

  // Impressão silenciosa de DANFE / PDF externo da SEFAZ direto na impressora térmica sem abrir diálogo
  ipcMain.on('print-pdf-silent', (event, pdfUrl) => {
    if (!pdfUrl) return;
    try {
      const printWin = new BrowserWindow({
        width: 380,
        height: 800,
        show: false,
        focusable: false, // Não rouba foco
        skipTaskbar: true,
        webPreferences: {
          plugins: true
        }
      });
      printWin.loadURL(pdfUrl);
      printWin.webContents.on('did-finish-load', async () => {
        // Injeta estilização estrita de bobina térmica 80mm/58mm para evitar margens em branco e cortes laterais
        try {
          await printWin.webContents.insertCSS(`
            @page {
              size: 80mm auto !important;
              margin: 0mm !important;
            }
            @media print, all {
              html, body {
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
              }
              .content {
                max-width: 100% !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 2mm 1mm !important;
                border: none !important;
                box-sizing: border-box !important;
              }
              .tabela-nfce, table {
                width: 100% !important;
                max-width: 100% !important;
              }
              #qr-code0, #qr-code1 {
                margin: 6px auto !important;
                text-align: center !important;
                display: flex !important;
                justify-content: center !important;
              }
              #qr-code0 img, #qr-code0 canvas, #qr-code1 img, #qr-code1 canvas {
                max-width: 170px !important;
                height: auto !important;
                margin: 0 auto !important;
              }
            }
          `);
        } catch (cssErr) {
          console.warn('Aviso: falha ao injetar CSS de impressão térmica no printWin:', cssErr);
        }

        // Aguarda 800ms para renderizar o QR Code/fontes na memória e dispara print silencioso
        setTimeout(() => {
          printWin.webContents.print({ 
            silent: true, 
            printBackground: true,
            margins: { marginType: 'none' }
          }, (success, failureReason) => {
            if (!success) console.error('Silent PDF print failed:', failureReason);
            try { printWin.destroy(); } catch {}
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.focus();
              mainWindow.webContents?.focus();
            }
          });
        }, 800);
      });

      // Timeout de segurança se o PDF falhar ao carregar
      setTimeout(() => {
        if (!printWin.isDestroyed()) {
          try { printWin.destroy(); } catch {}
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.focus();
            mainWindow.webContents?.focus();
          }
        }
      }, 10000);
    } catch (e) {
      console.error('Erro ao disparar impressão de PDF silenciosa:', e);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus();
        mainWindow.webContents?.focus();
      }
    }
  });

  // Diálogo de confirmação síncrono nativo e seguro (evita o bug de teclado do window.confirm)
  ipcMain.on('show-confirm-dialog', (event, { title, message }) => {
    try {
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'question',
        buttons: ['Cancelar', 'Confirmar'],
        defaultId: 1,
        cancelId: 0,
        title: title || 'BarERP Pro',
        message: String(message || '')
      });
      event.returnValue = (choice === 1);
    } catch (err) {
      console.error('Erro no diálogo de confirmação:', err);
      event.returnValue = false;
    } finally {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus();
        mainWindow.webContents?.focus();
      }
    }
  });

  // Forçar restauração de foco no processo principal
  ipcMain.on('focus-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
      mainWindow.webContents?.focus();
    }
  });

  // ─── Restaurar foco do teclado ao voltar da barra de tarefas ─────────────
  // No Windows, ao minimizar e restaurar, o foco fica preso no frame do OS
  // e o teclado para de funcionar. Forçar foco no webContents resolve.
  mainWindow.on('restore', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => {
        mainWindow.focus();
        mainWindow.webContents?.focus();
      }, 100);
    }
  });

  mainWindow.on('focus', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents?.focus();
    }
  });

  mainWindow.on('show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => {
        mainWindow.focus();
        mainWindow.webContents?.focus();
      }, 50);
    }
  });
  // ─────────────────────────────────────────────────────────────────────────

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
