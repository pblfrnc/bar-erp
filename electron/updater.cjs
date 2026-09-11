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

const GITHUB_DOWNLOAD_INSTALLER = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/latest/BarERP-Instalador-Windows.exe`;
const GITHUB_DOWNLOAD_VERSION = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/latest/version.json`;
const GITHUB_RELEASES_ATOM = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases.atom`;

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
        const info = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (info && info.buildTime) {
          return info;
        }
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

  // Se não tem build-info.json, usamos uma data base antiga para que qualquer instalador novo no GitHub seja detectado!
  return {
    version,
    buildTime: '2026-01-01T00:00:00.000Z',
    commit: 'local'
  };
}

// Faz requisição HTTP/HTTPS seguindo redirecionamentos (suporta GET, HEAD e redirecionamentos para Azure/S3)
function fetchWithRedirects(url, options = {}, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Muitos redirecionamentos'));
    }

    const reqOptions = options.headers ? { ...options } : { headers: options };
    reqOptions.headers = reqOptions.headers || {};
    if (!reqOptions.headers['User-Agent']) {
      reqOptions.headers['User-Agent'] = 'BarERP-AutoUpdater';
    }

    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(url, reqOptions, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchWithRedirects(res.headers.location, options, maxRedirects - 1));
      }
      resolve(res);
    });

    req.on('error', reject);
    req.end();
  });
}

// 1. Checar se há uma nova versão disponível no GitHub com múltiplas estratégias sem bloqueio de Rate Limit
async function checkForUpdates() {
  const local = getLocalBuildInfo();
  console.log('[AutoUpdater] Verificando atualizações. Build local:', local);

  // ESTRATÉGIA 1: Tentar version.json diretamente do release asset (Rápido, 0 limite de API)
  try {
    const vRes = await fetchWithRedirects(GITHUB_DOWNLOAD_VERSION, { method: 'GET' });
    if (vRes.statusCode === 200) {
      let vData = '';
      for await (const chunk of vRes) vData += chunk;
      const remote = JSON.parse(vData);

      // Se temos commit SHA em ambos e forem idênticos, está na versão mais recente
      if (local.commit && local.commit !== 'local' && remote.commit && local.commit === remote.commit) {
        return {
          hasUpdate: false,
          currentVersion: local.version,
          latestVersion: remote.version || local.version,
          localBuildTime: local.buildTime,
          message: 'Você já está utilizando a compilação mais recente.'
        };
      }

      // Se os commits são diferentes ou local é 'local'
      const headRes = await fetchWithRedirects(GITHUB_DOWNLOAD_INSTALLER, { method: 'HEAD' });
      const assetDate = headRes.headers['last-modified'] ? new Date(headRes.headers['last-modified']).toISOString() : (remote.buildTime || new Date().toISOString());
      const fileSize = parseInt(headRes.headers['content-length'] || '0', 10);

      return {
        hasUpdate: true,
        latestVersion: remote.version ? `v${remote.version}` : 'Nova Versão',
        currentVersion: local.version,
        releaseName: `BarERP Pro (${remote.commit ? remote.commit.substring(0, 7) : 'Atualização'})`,
        releaseNotes: 'Nova compilação do BarERP com melhorias de sistema e atualizações.',
        releaseDate: remote.buildTime || assetDate,
        assetDate,
        downloadUrl: GITHUB_DOWNLOAD_INSTALLER,
        fileName: 'BarERP-Instalador-Windows.exe',
        fileSize,
        localBuildTime: local.buildTime
      };
    }
  } catch (err) {
    console.log('[AutoUpdater] version.json ainda não disponível na release, alternando para feed público:', err.message);
  }

  // ESTRATÉGIA 2: Feed público de releases (releases.atom) + HEAD request no instalador (0 limite de API)
  try {
    const headRes = await fetchWithRedirects(GITHUB_DOWNLOAD_INSTALLER, { method: 'HEAD' });
    if (headRes.statusCode === 200 && headRes.headers['last-modified']) {
      const assetDate = new Date(headRes.headers['last-modified']);
      const fileSize = parseInt(headRes.headers['content-length'] || '0', 10);

      // Busca dados visuais do feed atom
      let releaseTitle = 'BarERP - Nova Versão';
      let releaseNotes = 'Melhorias de desempenho, correções e novos recursos.';
      let releaseDateIso = assetDate.toISOString();

      try {
        const atomRes = await fetchWithRedirects(GITHUB_RELEASES_ATOM);
        if (atomRes.statusCode === 200) {
          let xml = '';
          for await (const chunk of atomRes) xml += chunk;
          const titleMatch = xml.match(/<entry>[\s\S]*?<title>(.*?)<\/title>/);
          const updatedMatch = xml.match(/<entry>[\s\S]*?<updated>(.*?)<\/updated>/);
          const contentMatch = xml.match(/<entry>[\s\S]*?<content type="html">([\s\S]*?)<\/content>/);
          if (titleMatch) releaseTitle = titleMatch[1];
          if (updatedMatch) releaseDateIso = updatedMatch[1];
          if (contentMatch) {
            releaseNotes = contentMatch[1]
              .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
              .replace(/<[^>]+>/g, '').trim();
          }
        }
      } catch (atomErr) {
        console.log('[AutoUpdater] Não foi possível carregar notas do feed atom:', atomErr.message);
      }

      const localTime = new Date(local.buildTime || '2026-01-01T00:00:00.000Z');
      // Considera mais recente se a data do arquivo for maior que o build local (com tolerância de 1 min)
      const isNewer = (assetDate.getTime() - localTime.getTime()) > (60 * 1000);

      return {
        hasUpdate: isNewer,
        latestVersion: releaseTitle || 'Nova Versão',
        currentVersion: local.version,
        releaseName: releaseTitle,
        releaseNotes,
        releaseDate: releaseDateIso,
        assetDate: assetDate.toISOString(),
        downloadUrl: GITHUB_DOWNLOAD_INSTALLER,
        fileName: 'BarERP-Instalador-Windows.exe',
        fileSize,
        localBuildTime: local.buildTime
      };
    }
  } catch (err) {
    console.log('[AutoUpdater] Falha na verificação direta do asset, tentando API REST:', err.message);
  }

  // ESTRATÉGIA 3: Fallback final para API do GitHub (caso os anteriores falhem)
  try {
    const res = await fetchWithRedirects(GITHUB_API_LATEST);
    if (res.statusCode === 200) {
      let rawData = '';
      for await (const chunk of res) rawData += chunk;
      const release = JSON.parse(rawData);
      const installerAsset = (release.assets || []).find(a => 
        a.name && (a.name.endsWith('-Instalador-Windows.exe') || a.name.endsWith('.exe'))
      );

      if (installerAsset) {
        const assetUpdatedAt = new Date(installerAsset.updated_at || release.published_at);
        const localTime = new Date(local.buildTime || '2026-01-01T00:00:00.000Z');
        const isNewer = (assetUpdatedAt.getTime() - localTime.getTime()) > (60 * 1000);

        return {
          hasUpdate: isNewer,
          latestVersion: release.tag_name || release.name || 'Nova Versão',
          currentVersion: local.version,
          releaseName: release.name || 'Atualização do BarERP',
          releaseNotes: release.body || 'Melhorias gerais e correções de desempenho.',
          releaseDate: new Date(release.published_at || release.created_at).toISOString(),
          assetDate: assetUpdatedAt.toISOString(),
          downloadUrl: installerAsset.browser_download_url || GITHUB_DOWNLOAD_INSTALLER,
          fileName: installerAsset.name,
          fileSize: installerAsset.size || 0,
          localBuildTime: local.buildTime
        };
      }
    }
  } catch (apiErr) {
    console.error('[AutoUpdater] Erro final na API do GitHub:', apiErr.message);
  }

  return {
    hasUpdate: false,
    message: 'Não foi possível verificar atualizações no momento.',
    currentVersion: local.version,
    localBuildTime: local.buildTime
  };
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
