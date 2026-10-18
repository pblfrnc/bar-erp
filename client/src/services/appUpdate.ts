import { Capacitor, CapacitorHttp, registerPlugin, PluginListenerHandle } from '@capacitor/core';

// Atualização do APK (Garçom / Cozinha) direto pelo app, sem Play Store.
// Lê o version.json da release "latest" do GitHub (publicada pelo CI) e baixa o APK correspondente.
const RELEASE_BASE_URL = 'https://github.com/pblfrnc/bar-erp/releases/download/latest';

export interface AppUpdateDownloadProgress {
  percent: number;
  receivedBytes: number;
  totalBytes: number;
}

interface AppUpdaterPlugin {
  getInfo(): Promise<{ packageName: string; versionName: string }>;
  download(options: { url: string }): Promise<{ path: string }>;
  install(options: { path: string }): Promise<void>;
  addListener(event: 'downloadProgress', listener: (progress: AppUpdateDownloadProgress) => void): Promise<PluginListenerHandle>;
}

const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater');

export interface AppUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  apkUrl: string;
}

export const isAppUpdateSupported = () => Capacitor.getPlatform() === 'android';

// "1.8.10" > "1.8.9" (comparação numérica por partes)
export function isNewerVersion(latest: string, current: string): boolean {
  const a = latest.split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  const b = current.split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

export async function checkForAppUpdate(): Promise<AppUpdateInfo | null> {
  if (!isAppUpdateSupported()) return null;

  const { packageName, versionName } = await AppUpdater.getInfo();
  // CapacitorHttp faz a requisição pelo Android, sem bloqueio de CORS do GitHub
  const res = await CapacitorHttp.get({ url: `${RELEASE_BASE_URL}/version.json`, responseType: 'json' });
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status} ao consultar atualização`);
  const remote = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
  const latestVersion = String(remote?.version || '');

  if (!latestVersion || !isNewerVersion(latestVersion, versionName)) return null;

  const apkName = packageName === 'com.barerp.kds' ? 'BarERP-Cozinha.apk' : 'BarERP-Garcom.apk';
  return { currentVersion: versionName, latestVersion, apkUrl: `${RELEASE_BASE_URL}/${apkName}` };
}

export async function downloadAppUpdate(
  apkUrl: string,
  onProgress: (progress: AppUpdateDownloadProgress) => void
): Promise<string> {
  const handle = await AppUpdater.addListener('downloadProgress', onProgress);
  try {
    const { path } = await AppUpdater.download({ url: apkUrl });
    return path;
  } finally {
    handle.remove();
  }
}

// Rejeita com code 'INSTALL_PERMISSION' quando o Android abre a tela de "Instalar apps desconhecidos"
export const installAppUpdate = (path: string) => AppUpdater.install({ path });
