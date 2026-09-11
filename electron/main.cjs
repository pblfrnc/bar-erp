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

  // ============================================================
  // Gerenciamento e Configurações de Impressoras Térmicas
  // ============================================================
  const printerConfigFile = path.join(app.getPath('userData'), 'printer-settings.json');

  function getLocalPrinterSettings() {
    try {
      if (fs.existsSync(printerConfigFile)) {
        return JSON.parse(fs.readFileSync(printerConfigFile, 'utf-8'));
      }
    } catch (e) {}
    return {
      cashierPrinter: '',
      kitchenPrinter: '',
      paperWidth: 80,
      marginTop: 2,
      marginBottom: 12,
      marginLeft: 1,
      marginRight: 1,
      fontScale: 100,
      qrSize: 100,
      autoCut: true,
      silentPrint: true,
      copies: 1,
      extraFeedLines: 3,
      printLogo: true
    };
  }

  // 1. Listar todas as impressoras instaladas no Windows / Mac
  ipcMain.handle('get-printers', async () => {
    try {
      if (mainWindow && mainWindow.webContents) {
        return await mainWindow.webContents.getPrintersAsync();
      }
      return [];
    } catch (err) {
      console.error('Erro ao listar impressoras no Electron:', err);
      return [];
    }
  });

  // 2. Obter configurações salvas de impressoras
  ipcMain.handle('get-saved-printer-settings', () => {
    return getLocalPrinterSettings();
  });

  // 3. Salvar configurações de impressoras no AppData
  ipcMain.handle('save-printer-settings', (event, settings) => {
    try {
      fs.writeFileSync(printerConfigFile, JSON.stringify(settings, null, 2), 'utf-8');
      return { success: true };
    } catch (e) {
      console.error('Erro ao salvar printer-settings.json:', e);
      return { success: false, error: e.message };
    }
  });

  // 4. Impressão silenciosa do DOM atual (Comandas e Tickets)
  ipcMain.on('print-silent', (event, options) => {
    if (mainWindow) {
      const saved = getLocalPrinterSettings();
      const cfg = { ...saved, ...(options || {}) };
      const printOptions = { 
        silent: cfg.silentPrint !== false, 
        printBackground: true,
        margins: { marginType: 'none' },
        copies: cfg.copies || 1
      };
      if (cfg.cashierPrinter) {
        printOptions.deviceName = cfg.cashierPrinter;
      }
      mainWindow.webContents.print(printOptions, (success, failureReason) => {
        if (!success) console.error('Print failed:', failureReason);
      });
    }
  });

  // 5. Impressão silenciosa de DANFE / Cupom NFC-e / PDF externo
  ipcMain.on('print-pdf-silent', (event, urlOrPayload) => {
    const pdfUrl = typeof urlOrPayload === 'string' ? urlOrPayload : urlOrPayload?.url;
    if (!pdfUrl) return;

    const saved = getLocalPrinterSettings();
    const payloadCfg = typeof urlOrPayload === 'object' ? urlOrPayload : {};
    const settings = { ...saved, ...payloadCfg };

    const paperWidth = Number(settings.paperWidth) || 80;
    const winWidth = Math.round(paperWidth * 4.75); // 80mm ~ 380px, 58mm ~ 275px
    const marginTop = Number(settings.marginTop ?? 2);
    const marginBottom = Number(settings.marginBottom ?? 12);
    const marginLeft = Number(settings.marginLeft ?? 1);
    const marginRight = Number(settings.marginRight ?? 1);
    const qrSize = Number(settings.qrSize || 100);
    const fontScale = (Number(settings.fontScale || 100)) / 100;
    const targetPrinter = settings.deviceName || settings.cashierPrinter || undefined;

    try {
      const printWin = new BrowserWindow({
        width: winWidth,
        height: 3500,
        show: false,
        focusable: false,
        skipTaskbar: true,
        webPreferences: {
          plugins: true
        }
      });
      printWin.loadURL(pdfUrl);
      printWin.webContents.on('did-finish-load', async () => {
        // Ajusta dinamicamente a altura para cobrir todo o cupom sem truncamento vertical
        try {
          const docHeight = await printWin.webContents.executeJavaScript(`
            Math.max(document.body.scrollHeight || 0, document.documentElement.scrollHeight || 0, 2500)
          `);
          if (docHeight && docHeight > 800) {
            printWin.setSize(winWidth, Math.ceil(docHeight + 200));
          }
        } catch (e) {}

        // Neutraliza scripts que expandem o QR Code além do configurado
        try {
          await printWin.webContents.executeJavaScript(`
            try {
              const qrEl = document.getElementById('qr-code0') || document.getElementById('qr-code1');
              if (qrEl) {
                qrEl.style.margin = '4px auto';
                qrEl.style.width = '${qrSize}px';
                qrEl.style.height = '${qrSize}px';
                qrEl.style.maxWidth = '${qrSize}px';
                qrEl.style.maxHeight = '${qrSize}px';
                qrEl.querySelectorAll('img, canvas, svg').forEach(el => {
                  el.style.width = '${qrSize}px';
                  el.style.height = '${qrSize}px';
                  el.style.maxWidth = '${qrSize}px';
                  el.style.maxHeight = '${qrSize}px';
                });
              }
            } catch(e) {}
          `);
        } catch (e) {}

        // Injeta estilização calibrada conforme as preferências do usuário
        try {
          await printWin.webContents.insertCSS(`
            @page {
              size: auto;
              margin: 0mm !important;
            }
            @media print, all {
              html, body {
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
                zoom: ${fontScale} !important;
              }
              .content {
                max-width: ${paperWidth}mm !important;
                width: 100% !important;
                margin: 0 !important;
                padding: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm !important;
                border: none !important;
                box-sizing: border-box !important;
              }
              .tabela-nfce, table {
                width: 100% !important;
                max-width: 100% !important;
              }
              .qrcode {
                width: 100% !important;
                margin: 4px 0 !important;
                text-align: center !important;
                display: block !important;
              }
              #qr-code0, #qr-code1 {
                margin: 4px auto !important;
                text-align: center !important;
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
                width: ${qrSize}px !important;
                height: ${qrSize}px !important;
                min-height: ${qrSize}px !important;
                max-width: 100% !important;
                overflow: hidden !important;
              }
              #qr-code0 img, #qr-code0 canvas, #qr-code0 svg, #qr-code1 img, #qr-code1 canvas, #qr-code1 svg {
                width: ${qrSize}px !important;
                height: ${qrSize}px !important;
                max-width: ${qrSize}px !important;
                max-height: ${qrSize}px !important;
                margin: 0 auto !important;
                display: block !important;
              }
            }
          `);
        } catch (cssErr) {
          console.warn('Aviso: falha ao injetar CSS de impressão térmica no printWin:', cssErr);
        }

        // Dispara print silencioso
        setTimeout(() => {
          const printOptions = { 
            silent: settings.silentPrint !== false, 
            printBackground: true,
            margins: { marginType: 'none' },
            copies: settings.copies || 1
          };
          if (targetPrinter) {
            printOptions.deviceName = targetPrinter;
          }
          printWin.webContents.print(printOptions, (success, failureReason) => {
            if (!success) console.error('Silent PDF print failed:', failureReason);
            try { printWin.destroy(); } catch {}
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.focus();
              mainWindow.webContents?.focus();
            }
          });
        }, 1000);
      });

      // Timeout de segurança se o documento falhar ao carregar
      setTimeout(() => {
        if (!printWin.isDestroyed()) {
          try { printWin.destroy(); } catch {}
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.focus();
            mainWindow.webContents?.focus();
          }
        }
      }, 12000);
    } catch (e) {
      console.error('Erro ao disparar impressão de PDF silenciosa:', e);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus();
        mainWindow.webContents?.focus();
      }
    }
  });

  // 5b. Impressão de DANFE NF-e (Modelo 55 - Folha A4) com Diálogo do Sistema Windows
  ipcMain.on('print-pdf-dialog', (event, urlOrPayload) => {
    const pdfUrl = typeof urlOrPayload === 'string' ? urlOrPayload : urlOrPayload?.url;
    if (!pdfUrl) return;

    try {
      const a4Win = new BrowserWindow({
        width: 1000,
        height: 800,
        show: true,
        title: 'DANFE NF-e (Modelo 55 - Folha A4)',
        autoHideMenuBar: true,
        webPreferences: {
          plugins: true
        }
      });

      a4Win.loadURL(pdfUrl);
      a4Win.webContents.on('did-finish-load', () => {
        // Dispara a janela de diálogo nativa do sistema operacional (Windows / macOS) para selecionar a impressora A4
        setTimeout(() => {
          if (!a4Win.isDestroyed()) {
            a4Win.webContents.print({
              silent: false, // ABRE A JANELA DO SISTEMA
              printBackground: true
            }, (success, failureReason) => {
              if (!success && failureReason !== 'cancelled') {
                console.error('Falha no diálogo de impressão de NF-e:', failureReason);
              }
            });
          }
        }, 500);
      });
    } catch (err) {
      console.error('Erro ao abrir diálogo de impressão da NF-e:', err);
    }
  });

  // 5c. Impressão direcionada de PDF (com impressora específica ou diálogo)
  ipcMain.on('print-pdf', (event, { url, printerName }) => {
    if (!url) return;
    try {
      const a4Win = new BrowserWindow({
        width: 1000,
        height: 800,
        show: true,
        title: 'DANFE NF-e (Modelo 55)',
        autoHideMenuBar: true,
        webPreferences: {
          plugins: true
        }
      });
      a4Win.loadURL(url);
      a4Win.webContents.on('did-finish-load', () => {
        setTimeout(() => {
          if (!a4Win.isDestroyed()) {
            const printOpts = {
              silent: Boolean(printerName),
              printBackground: true
            };
            if (printerName) {
              printOpts.deviceName = printerName;
            }
            a4Win.webContents.print(printOpts, (success, failureReason) => {
              if (!success && failureReason !== 'cancelled') {
                console.error('Falha ao imprimir PDF:', failureReason);
              }
            });
          }
        }, 500);
      });
    } catch (err) {
      console.error('Erro no print-pdf:', err);
    }
  });

  // 6. Impressão de Página de Teste Térmica de Calibração
  ipcMain.on('print-test-ticket', (event, customSettings) => {
    const saved = getLocalPrinterSettings();
    const settings = { ...saved, ...(customSettings || {}) };

    const paperWidth = Number(settings.paperWidth) || 80;
    const winWidth = Math.round(paperWidth * 4.75);
    const marginTop = Number(settings.marginTop ?? 2);
    const marginBottom = Number(settings.marginBottom ?? 12);
    const marginLeft = Number(settings.marginLeft ?? 1);
    const marginRight = Number(settings.marginRight ?? 1);
    const qrSize = Number(settings.qrSize || 100);
    const fontScale = (Number(settings.fontScale || 100)) / 100;
    const targetPrinter = settings.cashierPrinter || undefined;
    const extraFeedLines = Number(settings.extraFeedLines ?? 3);

    const testHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Teste de Impressão Térmica</title>
        <style>
          @page { size: auto; margin: 0mm !important; }
          body {
            font-family: monospace, Arial, sans-serif;
            margin: 0;
            padding: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm;
            width: ${paperWidth}mm;
            max-width: ${paperWidth}mm;
            box-sizing: border-box;
            font-size: 11px;
            color: #000;
            background: #fff;
            zoom: ${fontScale};
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .line { border-bottom: 1px dashed #000; margin: 6px 0; }
          .double-line { border-bottom: 2px solid #000; margin: 8px 0; }
          .table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .table td { padding: 2px 0; }
          .right { text-align: right; }
          .ruler {
            display: flex;
            justify-content: space-between;
            border: 1px solid #000;
            padding: 2px 4px;
            font-size: 9px;
            margin: 4px 0;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size: 14px;">=== BAR ERP PRO ===</div>
        <div class="center bold">TESTE DE CALIBRAÇÃO TÉRMICA</div>
        <div class="center" style="font-size: 9px;">${new Date().toLocaleString('pt-BR')}</div>
        <div class="double-line"></div>

        <div class="ruler">
          <span>| ESQ</span>
          <span>LARGURA: ${paperWidth}mm</span>
          <span>DIR |</span>
        </div>

        <table class="table">
          <tr><td>Impressora:</td><td class="right bold">${targetPrinter || 'Padrão do Sistema'}</td></tr>
          <tr><td>Bobina:</td><td class="right bold">${paperWidth}mm</td></tr>
          <tr><td>Margens:</td><td class="right">E:${marginLeft}mm D:${marginRight}mm T:${marginTop}mm B:${marginBottom}mm</td></tr>
          <tr><td>Escala Texto:</td><td class="right">${settings.fontScale || 100}%</td></tr>
          <tr><td>Tamanho QR:</td><td class="right">${qrSize}px</td></tr>
          <tr><td>Guilhotina:</td><td class="right">${settings.autoCut ? 'Ativada' : 'Desativada'}</td></tr>
        </table>

        <div class="line"></div>
        <div class="center bold" style="font-size: 10px;">TESTE DE QR CODE:</div>
        <div class="center" style="margin: 8px auto;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=https://bar-erp.local/test-calibration&margin=1" width="${qrSize}" height="${qrSize}" style="margin: 0 auto; display: block;" />
        </div>

        <div class="line"></div>
        <div class="center" style="font-size: 9px;">Se as réguas laterais encostaram nas bordas sem cortar, seu alinhamento está 100% calibrado!</div>
        <div class="double-line"></div>
        <div class="center" style="font-size: 9px;">=== FIM DO TESTE DE IMPRESSÃO ===</div>
        ${'<br/>'.repeat(extraFeedLines)}
      </body>
      </html>
    `;

    try {
      const testWin = new BrowserWindow({
        width: winWidth,
        height: 1800,
        show: false,
        focusable: false,
        skipTaskbar: true,
        webPreferences: { plugins: true }
      });
      testWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(testHtml));
      testWin.webContents.on('did-finish-load', () => {
        setTimeout(() => {
          const printOptions = {
            silent: settings.silentPrint !== false,
            printBackground: true,
            margins: { marginType: 'none' },
            copies: 1
          };
          if (targetPrinter) {
            printOptions.deviceName = targetPrinter;
          }
          testWin.webContents.print(printOptions, (success, failureReason) => {
            if (!success) console.error('Test print failed:', failureReason);
            try { testWin.destroy(); } catch {}
          });
        }, 800);
      });
    } catch (err) {
      console.error('Erro ao imprimir página de teste térmica:', err);
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
