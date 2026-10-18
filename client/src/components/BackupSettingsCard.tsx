import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FolderOpen, Loader2, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

interface BackupFileInfo {
  file: string;
  at: string;
}

interface BackupStatus {
  enabled: boolean;
  externalFolder: string;
  keep: number;
  lastLocal: BackupFileInfo | null;
  lastExternal: BackupFileInfo | null;
  externalReachable: boolean;
  totalLocal: number;
  totalExternal: number;
  lastError: string | null;
  lastErrorAt: string | null;
  running: boolean;
}

const STALE_MS = 24 * 60 * 60 * 1000;

const formatDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca';

// Backup automático do banco + cópia para fora do computador (Google Drive / OneDrive / pen drive)
export const BackupSettingsCard: React.FC = () => {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [folder, setFolder] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [keep, setKeep] = useState('30');
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const electron = (window as any).electronAPI;
  const canChooseFolder = typeof electron?.chooseBackupFolder === 'function';

  const loadStatus = useCallback(async (syncForm: boolean) => {
    try {
      const st: BackupStatus = await api.getBackupStatus();
      setStatus(st);
      if (syncForm) {
        setFolder(st.externalFolder || '');
        setEnabled(Boolean(st.enabled));
        setKeep(String(st.keep || 30));
      }
    } catch {
      // Sem servidor não há o que mostrar; o card fica com "nunca"
    }
  }, []);

  useEffect(() => {
    loadStatus(true);
  }, [loadStatus]);

  const handleChooseFolder = async () => {
    const chosen = await electron.chooseBackupFolder();
    if (chosen) setFolder(chosen);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.saveBackupSettings({ externalFolder: folder, enabled, keep: Number(keep) });
      setMessage({ type: 'ok', text: 'Configuração de backup salva.' });
      await loadStatus(true);
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Erro ao salvar a configuração de backup.' });
    } finally {
      setSaving(false);
    }
  };

  const handleBackupNow = async () => {
    setBackingUp(true);
    setMessage(null);
    try {
      const result = await api.runBackupNow();
      if (result.externalError) {
        setMessage({ type: 'error', text: result.externalError });
      } else {
        setMessage({ type: 'ok', text: result.external ? 'Backup feito no computador e na pasta externa.' : 'Backup feito no computador.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Erro ao fazer o backup.' });
    } finally {
      setBackingUp(false);
      loadStatus(false);
    }
  };

  const lastExternalMs = status?.lastExternal ? new Date(status.lastExternal.at).getTime() : 0;
  let alert: string | null = null;
  if (status?.enabled) {
    if (status.lastError) alert = status.lastError;
    else if (!status.externalReachable) alert = 'A pasta de backup externo não está acessível. Verifique o pen drive ou a pasta do Google Drive/OneDrive.';
    else if (!status.lastExternal) alert = 'Ainda não há backup na pasta externa. Clique em "Fazer backup agora".';
    else if (Date.now() - lastExternalMs > STALE_MS) alert = `O último backup externo tem mais de 24 horas (${formatDateTime(status.lastExternal.at)}).`;
  } else if (status?.lastError) {
    alert = status.lastError;
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 mb-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Backup Automático do Banco</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ao abrir o sistema, a cada 6 horas e ao fechar o caixa. Use a pasta do Google Drive ou OneDrive para o backup sair do computador.
            </p>
          </div>
        </div>
        <span
          className={`text-[10px] font-black uppercase px-2 py-1 rounded border shrink-0 ${
            alert
              ? 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/20 border-red-200 dark:border-red-500/30'
              : 'text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/20 border-indigo-200 dark:border-indigo-500/30'
          }`}
        >
          {alert ? 'Atenção' : 'Protegido'}
        </span>
      </div>

      {alert && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{alert}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-3">
          <p className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px]">Último backup no computador</p>
          <p className="font-mono font-bold text-slate-900 dark:text-white mt-1">{formatDateTime(status?.lastLocal?.at)}</p>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5">{status?.totalLocal ?? 0} cópias guardadas</p>
        </div>
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-3">
          <p className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px]">Último backup externo</p>
          <p className="font-mono font-bold text-slate-900 dark:text-white mt-1">
            {status?.enabled ? formatDateTime(status?.lastExternal?.at) : 'desligado'}
          </p>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5">{status?.enabled ? `${status?.totalExternal ?? 0} cópias na pasta` : 'Escolha uma pasta e ative abaixo'}</p>
        </div>
      </div>

      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Pasta do backup externo</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="Ex.: C:\Users\Bar\Google Drive\Backups BarERP"
            className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs rounded-xl py-2.5 px-3 focus:border-indigo-500 outline-none transition"
          />
          {canChooseFolder && (
            <button
              type="button"
              onClick={handleChooseFolder}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <FolderOpen className="w-4 h-4" />
              Escolher pasta
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition ${enabled ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Copiar para a pasta externa</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            Guardar
            <input
              type="number"
              min="1"
              max="365"
              step="1"
              value={keep}
              onChange={(e) => setKeep(e.target.value)}
              className="w-20 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-sm font-bold rounded-xl py-2 px-3 focus:border-indigo-500 outline-none transition"
            />
            dias de histórico
          </label>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-start gap-2 text-xs font-semibold ${
            message.type === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
          }`}
        >
          {message.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-end gap-2">
        <button
          type="button"
          onClick={handleBackupNow}
          disabled={backingUp || saving}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-black transition disabled:opacity-50 cursor-pointer"
        >
          {backingUp && <Loader2 className="w-4 h-4 animate-spin" />}
          {backingUp ? 'Fazendo backup...' : 'Fazer backup agora'}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || backingUp}
          className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-black transition disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-500/20"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
};
