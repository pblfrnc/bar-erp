import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ArrowUpCircle, 
  ShieldCheck, 
  Clock, 
  ExternalLink 
} from 'lucide-react';

export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion?: string;
  currentVersion?: string;
  releaseName?: string;
  releaseNotes?: string;
  releaseDate?: string;
  assetDate?: string;
  downloadUrl?: string;
  fileName?: string;
  fileSize?: number;
  localBuildTime?: string;
  error?: string;
}

export interface DownloadProgress {
  percent: number;
  receivedBytes: number;
  totalBytes: number;
  receivedMB: string;
  totalMB: string;
  speedMBps: string;
}

interface Props {
  updateInfo: UpdateInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenModal: () => void;
}

export const UpdateNotificationModal: React.FC<Props> = ({
  updateInfo,
  isOpen,
  onClose,
  onOpenModal
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Escutar eventos nativos do Electron
  useEffect(() => {
    const electron = (window as any).electronAPI;
    if (!electron) return;

    let cleanupProgress: any = null;
    let cleanupDone: any = null;
    let cleanupError: any = null;

    if (electron.onUpdateProgress) {
      cleanupProgress = electron.onUpdateProgress((progress: DownloadProgress) => {
        setDownloading(true);
        setDownloadProgress(progress);
        setDownloadError(null);
      });
    }

    if (electron.onUpdateDownloaded) {
      cleanupDone = electron.onUpdateDownloaded(() => {
        setDownloading(false);
        setDownloadComplete(true);
        setDownloadError(null);
      });
    }

    if (electron.onUpdateError) {
      cleanupError = electron.onUpdateError((err: { message: string }) => {
        setDownloading(false);
        setDownloadError(err.message || 'Erro ao baixar atualização.');
      });
    }

    return () => {
      if (cleanupProgress) cleanupProgress();
      if (cleanupDone) cleanupDone();
      if (cleanupError) cleanupError();
    };
  }, []);

  const handleStartDownload = () => {
    if (!updateInfo?.downloadUrl) return;
    setDownloading(true);
    setDownloadError(null);
    setDownloadComplete(false);
    setDownloadProgress({
      percent: 0,
      receivedBytes: 0,
      totalBytes: updateInfo.fileSize || 0,
      receivedMB: '0.0',
      totalMB: ((updateInfo.fileSize || 0) / (1024 * 1024)).toFixed(1),
      speedMBps: '0.0'
    });

    const electron = (window as any).electronAPI;
    if (electron?.startDownloadUpdate) {
      electron.startDownloadUpdate(updateInfo.downloadUrl);
    } else {
      // Fallback no navegador
      window.open(updateInfo.downloadUrl, '_blank');
      setDownloading(false);
    }
  };

  const handleInstallAndRestart = () => {
    const electron = (window as any).electronAPI;
    if (electron?.installAndRestart) {
      electron.installAndRestart();
    } else {
      alert('Esta função é exclusiva do aplicativo desktop Electron.');
    }
  };

  if (!updateInfo || !updateInfo.hasUpdate) {
    return null;
  }

  const formattedReleaseDate = updateInfo.assetDate
    ? new Date(updateInfo.assetDate).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Recentemente';

  return (
    <>
      {/* 1. Banner Flutuante de Notificação (visível quando o modal estiver fechado e não descartado) */}
      {!isOpen && !bannerDismissed && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md bg-slate-900/95 text-white border border-amber-500/40 p-4 rounded-2xl shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950">
                  Nova Versão
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {updateInfo.latestVersion}
                </span>
              </div>
              <h4 className="text-sm font-black text-white mt-1 truncate">
                Atualização do Bar ERP Disponível!
              </h4>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                {downloadComplete 
                  ? 'Download pronto! Clique para reiniciar e atualizar.' 
                  : downloading 
                    ? `Baixando: ${downloadProgress?.percent || 0}%...` 
                    : 'Novos recursos e melhorias fiscais prontos para instalar.'}
              </p>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={onOpenModal}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl transition shadow-md active:scale-95 cursor-pointer"
                >
                  {downloadComplete ? 'Reiniciar Agora' : 'Ver Detalhes'}
                </button>

                <button
                  onClick={() => setBannerDismissed(true)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
                >
                  Lembrar mais tarde
                </button>
              </div>
            </div>

            <button
              onClick={() => setBannerDismissed(true)}
              className="text-slate-500 hover:text-slate-300 p-1 rounded-lg transition"
              title="Fechar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Modal Completo de Atualização */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative">
            
            {/* Cabeçalho */}
            <div className="bg-gradient-to-br from-amber-500/15 via-slate-100 dark:via-slate-800/40 to-transparent p-6 border-b border-slate-200 dark:border-slate-800 relative">
              <button
                onClick={onClose}
                className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-inner">
                  <ArrowUpCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950">
                      Atualização do Sistema
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                      {updateInfo.latestVersion}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                    Nova Versão do Bar ERP Pronta!
                  </h3>
                </div>
              </div>
            </div>

            {/* Corpo do Modal */}
            <div className="p-6 space-y-5">
              
              {/* Comparativo de Versão e Data */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Versão Atual:</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                    {updateInfo.currentVersion || '1.0.0'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Lançamento no GitHub:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formattedReleaseDate}
                  </span>
                </div>
              </div>

              {/* Notas da Release */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
                  Novidades & Melhorias Desta Versão:
                </label>
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 max-h-36 overflow-y-auto text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-sans leading-relaxed">
                  {updateInfo.releaseNotes || 'Melhorias de desempenho, correções e novas funcionalidades integradas.'}
                </div>
              </div>

              {/* Barra de Progresso do Download */}
              {downloading && downloadProgress && (
                <div className="space-y-2 bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                      Baixando atualização do GitHub...
                    </span>
                    <span className="font-mono text-amber-500">{downloadProgress.percent}%</span>
                  </div>

                  {/* Barra visual */}
                  <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${downloadProgress.percent}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                    <span>{downloadProgress.receivedMB} MB de {downloadProgress.totalMB} MB</span>
                    <span>Velocidade: {downloadProgress.speedMBps} MB/s</span>
                  </div>
                </div>
              )}

              {/* Estado: Download Concluído com Sucesso */}
              {downloadComplete && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-900 dark:text-emerald-300">
                    <strong className="block font-black text-sm">Download Concluído com Sucesso!</strong>
                    O instalador já foi verificado e está pronto. Ao clicar abaixo, o Bar ERP fechará de forma limpa, aplicará a atualização e reiniciará em segundos.
                  </div>
                </div>
              )}

              {/* Estado: Erro */}
              {downloadError && (
                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-900 dark:text-red-300">
                    <strong className="block font-black">Falha no Download</strong>
                    {downloadError}
                  </div>
                </div>
              )}

              {/* Garantia de Segurança do Banco de Dados */}
              <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800/40 p-2.5 rounded-xl">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  <strong>Seus dados estão 100% seguros:</strong> Vendas, comandas, mesas abertas e configurações fiscais são preservadas intactas.
                </span>
              </div>
            </div>

            {/* Rodapé / Botões de Ação */}
            <div className="p-6 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Lembrar Mais Tarde
              </button>

              {downloadComplete ? (
                <button
                  type="button"
                  onClick={handleInstallAndRestart}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  Reiniciar e Atualizar Agora
                </button>
              ) : (
                <button
                  type="button"
                  disabled={downloading}
                  onClick={handleStartDownload}
                  className={`px-5 py-2.5 font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-2 shadow-lg cursor-pointer ${
                    downloading
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 active:scale-95'
                  }`}
                >
                  {downloading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Baixando ({downloadProgress?.percent || 0}%)...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Baixar e Atualizar Agora
                    </>
                  )}
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
};
