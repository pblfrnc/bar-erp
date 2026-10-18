import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpCircle, Download, Loader2, X } from 'lucide-react';
import {
  AppUpdateInfo,
  checkForAppUpdate,
  downloadAppUpdate,
  installAppUpdate,
  isAppUpdateSupported
} from '../services/appUpdate';

const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const MIN_RECHECK_ON_RESUME_MS = 10 * 60 * 1000;

type Stage = 'available' | 'downloading' | 'ready' | 'installing';

// Aviso de nova versão do APK (Garçom / Cozinha). Só aparece no app Android nativo.
export const AppUpdateBanner: React.FC = () => {
  const [update, setUpdate] = useState<AppUpdateInfo | null>(null);
  const [stage, setStage] = useState<Stage>('available');
  const [percent, setPercent] = useState<number>(0);
  const [apkPath, setApkPath] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const lastCheckRef = useRef<number>(0);

  const runCheck = useCallback(async () => {
    lastCheckRef.current = Date.now();
    try {
      const info = await checkForAppUpdate();
      // Não troca a versão no meio de um download/instalação
      setUpdate((prev) => (prev && prev.latestVersion === info?.latestVersion ? prev : info));
    } catch (err) {
      console.warn('[AppUpdate] Falha ao verificar atualização:', err);
    }
  }, []);

  useEffect(() => {
    if (!isAppUpdateSupported()) return;
    runCheck();
    const interval = setInterval(runCheck, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheckRef.current > MIN_RECHECK_ON_RESUME_MS) {
        runCheck();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [runCheck]);

  if (!update || dismissedVersion === update.latestVersion) return null;

  const install = async (path: string) => {
    setStage('installing');
    try {
      await installAppUpdate(path);
      setMessage('Confirme a instalação na tela do Android.');
    } catch (err: any) {
      setMessage(err?.message || 'Não foi possível abrir o instalador.');
      if (err?.code === 'APK_MISSING') {
        setApkPath(null);
        setStage('available');
        return;
      }
    }
    setStage('ready');
  };

  const handleUpdate = async () => {
    if (apkPath) return install(apkPath);
    setMessage(null);
    setPercent(0);
    setStage('downloading');
    try {
      const path = await downloadAppUpdate(update.apkUrl, (p) => setPercent(p.percent));
      setApkPath(path);
      await install(path);
    } catch (err: any) {
      setMessage(err?.message || 'Falha ao baixar a atualização. Verifique a internet do Wi-Fi.');
      setStage('available');
    }
  };

  const busy = stage === 'downloading' || stage === 'installing';

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-lg rounded-2xl border border-amber-500/40 bg-white dark:bg-slate-900 shadow-2xl p-3.5">
        <div className="flex items-start gap-3">
          <ArrowUpCircle className="w-6 h-6 shrink-0 text-amber-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-900 dark:text-white">
              Nova versão do app: v{update.latestVersion}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Instalada: v{update.currentVersion}. A atualização leva menos de 1 minuto e não apaga nada.
            </p>
            {message && <p className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-400">{message}</p>}
            {stage === 'downloading' && (
              <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${percent >= 0 ? percent : 100}%` }}
                />
              </div>
            )}
          </div>
          {!busy && (
            <button
              type="button"
              onClick={() => setDismissedVersion(update.latestVersion)}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              title="Lembrar depois"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={handleUpdate}
          className="mt-3 w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-70 text-slate-950 text-sm font-black transition active:scale-[0.98] cursor-pointer"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {stage === 'downloading'
            ? `Baixando... ${percent >= 0 ? `${percent}%` : ''}`
            : stage === 'installing'
              ? 'Abrindo instalador...'
              : apkPath
                ? 'Instalar Atualização'
                : 'Atualizar Agora'}
        </button>
      </div>
    </div>
  );
};
