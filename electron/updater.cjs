const { app, ipcMain } = require('electron');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const REPO_OWNER = 'pblfrnc';
const REPO_NAME = 'bar-erp';
const GITHUB_API_LATEST = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

let downloadInProgress = false;
let downloadedInstallerPath = null;
let downloadAbortController = null;

// Obter informações do build atual instalado
function getLocalBuildInfo() {
  const possiblePaths = [
    path.join(__dirname, '..', 'build-info.json'),
    path.join(__dirname, 'build-info.json'),
    path.join(process.resourcesPath || '', 'build-info.json'),
    path.join(process.resourcesPath || '', 'app', 'build-info.json')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
      } catch (e) {}
    }
  }

  // Fallback para o package.json
  const pkgPath = path.join(__dirname, '..', 'package.json');
  let version = '1.0.0';
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      version = pkg.version || '1.0.0';
    } catch (e) {}
  }

  return {
    version,
    buildTime: new Date(fs.statSync(pkgPath).mtime || Date.now()).toISOString(),
    commit: 'local'
  };
}

// Faz requisição HTTP/HTTPS seguindo redirecionamentos (necessário para GitHub -> S3)
function fetchWithRedirects(url, headers = {}, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Muitos redirecionamentos'));
    }

    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchWithRedirects(res.headers.location, headers, maxRedirects - 1));
      }
      resolve(res);
    });

    req.on('error', reject);
  });
}

// 1. Checar se há uma nova versão disponível no GitHub
async function checkForUpdates() {
  const local = getLocalBuildInfo();
  try {
    const res = await fetchWithRedirects(GITHUB_API_LATEST, {
      'User-Agent': 'BarERP-AutoUpdater'
    });

    if (res.statusCode !== 200) {
      throw new Error(`GitHub API retornou status ${res.statusCode}`);
    }

    let rawData = '';
    for await (const chunk of res) {
      rawData += chunk;
    }

    const release = JSON.parse(rawData);
    const releaseDate = new Date(release.published_at || release.created_at);

    // Procura o instalador do Windows nos assets
    const installerAsset = (release.assets || []).find(a => 
      a.name && (a.name.endsWith('-Instalador-Windows.exe') || a.name.endsWith('.exe'))
    );

    if (!installerAsset) {
      return {
        hasUpdate: false,
        message: 'Nenhum instalador executável encontrado na release.',
        currentVersion: local.version,
        localBuildTime: local.buildTime
      };
    }

    const assetUpdatedAt = new Date(installerAsset.updated_at || release.published_at);
    const localTime = new Date(local.buildTime);

    // Considera atualização se o arquivo da release no GitHub for mais recente que o build local
    // (com tolerância de 2 minutos para evitar falsos positivos de horário)
    const isNewer = (assetUpdatedAt.getTime() - localTime.getTime()) > (2 * 60 * 1000);

    return {
      hasUpdate: isNewer,
      latestVersion: release.tag_name || release.name || 'Nova Versão',
      currentVersion: local.version,
      releaseName: release.name || 'Atualização do BarERP',
      releaseNotes: release.body || 'Melhorias gerais e correções de desempenho.',
      releaseDate: releaseDate.toISOString(),
      assetDate: assetUpdatedAt.toISOString(),
      downloadUrl: installerAsset.browser_download_url,
      fileName: installerAsset.name,
      fileSize: installerAsset.size || 0,
      localBuildTime: local.buildTime
    };
  } catch (err) {
    console.error('[AutoUpdater] Erro ao verificar atualizações:', err.message);
    return {
      hasUpdate: false,
      error: err.message,
      currentVersion: local.version,
      localBuildTime: local.buildTime
    };
  }
}

// 2. Baixar a atualização com barra de progresso em tempo real
function startDownloadUpdate(downloadUrl, onProgress, onComplete, onError) {
  if (downloadInProgress) {
    return onError(new Error('Download já em andamento.'));
  }

  downloadInProgress = true;
  const tempDir = app.getPath('temp');
  const targetFile = path.join(tempDir, 'BarERP-Instalador-Update.exe');

  console.log(`[AutoUpdater] Iniciando download de: ${downloadUrl}`);
  console.log(`[AutoUpdater] Destino temporário: ${targetFile}`);

  // Se já existia um instalador antigo no temp, remove
  if (fs.existsSync(targetFile)) {
    try { fs.unlinkSync(targetFile); } catch (e) {}
  }

  const headers = { 'User-Agent': 'BarERP-AutoUpdater' };

  fetchWithRedirects(downloadUrl, headers)
    .then((res) => {
      if (res.statusCode !== 200) {
        downloadInProgress = false;
        return onError(new Error(`Falha no download da atualização (Status ${res.statusCode})`));
      }

      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let receivedBytes = 0;
      let lastReportTime = Date.now();
      let lastReportBytes = 0;

      const fileStream = fs.createWriteStream(targetFile);

      res.on('data', (chunk) => {
        receivedBytes += chunk.length;
        const now = Date.now();
        const timeDiff = now - lastReportTime;

        // Atualiza a cada 200ms para manter a interface fluida
        if (timeDiff >= 200 || receivedBytes === totalBytes) {
          const speedBps = timeDiff > 0 ? ((receivedBytes - lastReportBytes) / (timeDiff / 1000)) : 0;
          const speedMBps = (speedBps / (1024 * 1024)).toFixed(1);
          const percent = totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : 0;

          onProgress({
            percent,
            receivedBytes,
            totalBytes,
            receivedMB: (receivedBytes / (1024 * 1024)).toFixed(1),
            totalMB: (totalBytes / (1024 * 1024)).toFixed(1),
            speedMBps
          });

          lastReportTime = now;
          lastReportBytes = receivedBytes;
        }
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(() => {
          downloadInProgress = false;
          downloadedInstallerPath = targetFile;
          console.log('✅ [AutoUpdater] Download concluído com sucesso!');
          onComplete({ filePath: targetFile });
        });
      });

      fileStream.on('error', (err) => {
        downloadInProgress = false;
        try { fs.unlinkSync(targetFile); } catch (e) {}
        onError(err);
      });
    })
    .catch((err) => {
      downloadInProgress = false;
      onError(err);
    });
}

// 3. Executar o instalador baixado e fechar o aplicativo para atualização limpa
function installAndRestart() {
  const targetFile = downloadedInstallerPath || path.join(app.getPath('temp'), 'BarERP-Instalador-Update.exe');

  if (!fs.existsSync(targetFile)) {
    throw new Error('Instalador da atualização não encontrado. Faça o download novamente.');
  }

  console.log(`[AutoUpdater] Executando instalador e fechando aplicação: ${targetFile}`);

  if (process.platform === 'win32') {
    // No Windows, dispara o instalador NSIS desanexado para não ser encerrado junto com o app
    // O instalador do NSIS atualiza os arquivos em Program Files e reabre o BarERP
    const child = spawn(targetFile, [], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
  } else {
    // Fallback para Mac / Linux em ambiente de desenvolvimento
    const child = spawn(targetFile, [], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
  }

  // Fecha o app imediatamente para liberar travas de arquivos (EBUSY)
  setTimeout(() => {
    app.quit();
  }, 500);
}

// Configurar o AutoUpdater com a janela principal e registrar IPC
function setupAutoUpdater(mainWindow) {
  // IPC 1: Verificar se há atualização
  ipcMain.handle('check-for-updates', async () => {
    return await checkForUpdates();
  });

  // IPC 2: Obter versão e build atuais
  ipcMain.handle('get-app-version', () => {
    return getLocalBuildInfo();
  });

  // IPC 3: Iniciar download da atualização
  ipcMain.on('start-download-update', (event, downloadUrl) => {
    startDownloadUpdate(
      downloadUrl,
      (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update-download-progress', progress);
        }
      },
      (complete) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update-downloaded', complete);
        }
      },
      (error) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update-download-error', { message: error.message });
        }
      }
    );
  });

  // IPC 4: Instalar e reiniciar
  ipcMain.on('install-and-restart', () => {
    try {
      installAndRestart();
    } catch (err) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-download-error', { message: err.message });
      }
    }
  });

  // Checagem automática 15 segundos após abrir o app
  setTimeout(async () => {
    try {
      const updateInfo = await checkForUpdates();
      if (updateInfo.hasUpdate && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-available', updateInfo);
      }
    } catch (e) {}
  }, 15000);

  // Checagem periódica a cada 4 horas
  setInterval(async () => {
    try {
      const updateInfo = await checkForUpdates();
      if (updateInfo.hasUpdate && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-available', updateInfo);
      }
    } catch (e) {}
  }, 4 * 60 * 60 * 1000);
}

module.exports = {
  setupAutoUpdater,
  checkForUpdates,
  startDownloadUpdate,
  installAndRestart,
  getLocalBuildInfo
};
