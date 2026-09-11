import React, { useState } from 'react';
import { 
  Lock, 
  CheckCircle, 
  AlertTriangle, 
  Copy, 
  Check, 
  RefreshCw, 
  MessageCircle, 
  Key, 
  ChevronDown, 
  ChevronUp, 
  QrCode,
  ShieldAlert,
  Zap,
  Globe
} from 'lucide-react';
import { getServerBaseUrl } from '../services/socket';

interface LicenseModalProps {
  machineId: string;
  onSuccess: () => void;
  status?: string;
  developerContact?: {
    phone?: string;
    pixKey?: string;
    developerName?: string;
  };
}

export function LicenseModal({ machineId, onSuccess, status, developerContact }: LicenseModalProps) {
  const [offlineKey, setOfflineKey] = useState('');
  const [loadingSync, setLoadingSync] = useState(false);
  const [loadingOffline, setLoadingOffline] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);
  const [showOfflineInput, setShowOfflineInput] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem('bar_license_server_url') || 'https://bar-erp-licensas.onrender.com');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const devPhone = developerContact?.phone || '5547974002560';
  const devPix = developerContact?.pixKey || '68.817.608/0001-47';
  const devName = developerContact?.developerName || 'Pablo Franco - Software House';

  const isExpired = status === 'EXPIRED';
  const isBlocked = status === 'BLOCKED';

  // Copiar ID da Máquina
  const handleCopyId = () => {
    navigator.clipboard.writeText(machineId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Copiar Chave PIX
  const handleCopyPix = () => {
    if (!devPix) return;
    navigator.clipboard.writeText(devPix);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2000);
  };

  // Enviar ID e Comprovante no WhatsApp do Desenvolvedor
  const handleSendWhatsApp = () => {
    const rawDigits = devPhone.replace(/\D/g, '');
    const cleanPhone = rawDigits.startsWith('55') ? rawDigits : `55${rawDigits}`;
    const text = `Olá! Segue o comprovante de pagamento da mensalidade do Bar ERP.\n\n💻 *ID DA MINHA MÁQUINA:*\n\`${machineId}\`\n\nPor favor, ative minha licença remotamente. Obrigado!`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // 1. Verificar Ativação Online Remota (Após o desenvolvedor ativar no painel)
  const handleCheckOnline = async () => {
    setLoadingSync(true);
    setError('');
    setSuccessMessage('');

    if (serverUrl.trim()) {
      localStorage.setItem('bar_license_server_url', serverUrl.trim());
    }

    try {
      const res = await fetch(`${getServerBaseUrl()}/api/settings/license/sync-remote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl: serverUrl.trim() || undefined }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.activated) {
        setSuccessMessage('🎉 Licença ativada remotamente com sucesso! Liberando sistema...');
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        setError(data.message || 'Sua máquina ainda não foi ativada. Envie o comprovante e o ID da máquina ao desenvolvedor.');
      }
    } catch (err: any) {
      setError('Não foi possível conectar ao servidor de licenças. Verifique sua conexão com a internet ou use uma chave offline.');
    } finally {
      setLoadingSync(false);
    }
  };

  // 2. Ativar com Chave Offline
  const handleActivateOffline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offlineKey.trim()) {
      setError('Informe a chave de ativação offline recebida no WhatsApp.');
      return;
    }

    setLoadingOffline(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await fetch(`${getServerBaseUrl()}/api/settings/license/offline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: offlineKey.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMessage('🎉 Licença offline ativada com sucesso! Liberando sistema...');
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        setError(data.error || 'Chave de ativação inválida ou expirada.');
      }
    } catch (err: any) {
      setError('Erro ao validar chave offline.');
    } finally {
      setLoadingOffline(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className={`p-6 text-white text-center flex flex-col items-center justify-center ${
          isExpired || isBlocked
            ? 'bg-gradient-to-r from-rose-600 to-red-600'
            : 'bg-gradient-to-r from-amber-500 to-orange-600'
        }`}>
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mb-3 shadow-inner">
            {isExpired || isBlocked ? <ShieldAlert size={32} /> : <Lock size={32} />}
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">
            {isExpired ? 'Mensalidade Expirada' : isBlocked ? 'Licença Bloqueada' : 'Ativação do Bar ERP'}
          </h2>
          <p className="text-white/90 text-xs sm:text-sm mt-1 max-w-md font-medium">
            {isExpired 
              ? 'Sua mensalidade venceu. Efetue o pagamento e informe o ID abaixo para reativação remota imediata.' 
              : isBlocked 
              ? 'Este terminal está temporariamente suspenso pelo desenvolvedor.' 
              : 'Este computador precisa de ativação para liberar o uso do sistema.'}
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Sucesso */}
          {successMessage && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center gap-3 text-sm font-bold animate-in zoom-in-95">
              <CheckCircle size={24} className="shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-2xl flex items-start gap-2.5 text-xs font-semibold animate-in shake">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Box de Destaque: ID DA MÁQUINA */}
          <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                ID da sua Máquina (Hardware)
              </span>
              <button
                onClick={handleCopyId}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                {copiedId ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                {copiedId ? 'Copiado!' : 'Copiar ID'}
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 font-mono text-center text-sm sm:text-base font-bold text-slate-900 dark:text-indigo-300 select-all break-all">
              {machineId || 'Carregando ID...'}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center mt-2">
              Envie este ID junto com o comprovante no WhatsApp do desenvolvedor.
            </p>
          </div>

          {/* Dados de Pagamento (PIX) */}
          <div className="bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-500/20 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode size={18} className="text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold text-indigo-950 dark:text-indigo-300">
                  Chave PIX para Renovação:
                </span>
              </div>
              <button
                onClick={handleCopyPix}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                {copiedPix ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                {copiedPix ? 'Copiado!' : 'Copiar PIX'}
              </button>
            </div>
            <div className="mt-1 font-mono text-xs font-bold text-slate-800 dark:text-slate-200 select-all">
              {devPix}
            </div>
          </div>

          {/* Ações Rápidas de Ativação */}
          <div className="space-y-2.5">
            {/* 1. Botão Enviar Comprovante no WhatsApp */}
            <button
              onClick={handleSendWhatsApp}
              className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
            >
              <MessageCircle size={18} />
              Enviar Comprovante e ID no WhatsApp (47 97400-2560)
            </button>

            {/* 2. Botão Verificar Ativação Online Remota */}
            <button
              onClick={handleCheckOnline}
              disabled={loadingSync}
              className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw size={18} className={loadingSync ? 'animate-spin' : ''} />
              {loadingSync ? 'Verificando com o Servidor...' : 'Verificar Ativação Online Agora'}
            </button>
          </div>

          {/* Opção Sanfona: Ativação por Chave Offline */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowOfflineInput(!showOfflineInput)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 py-1 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Key size={14} />
                Recebeu uma chave de ativação offline?
              </span>
              {showOfflineInput ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showOfflineInput && (
              <form onSubmit={handleActivateOffline} className="mt-3 space-y-2.5 animate-in fade-in duration-150">
                <input
                  type="text"
                  value={offlineKey}
                  onChange={(e) => setOfflineKey(e.target.value)}
                  placeholder="Cole a chave offline aqui (Ex: EXP-2026...)"
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={loadingOffline}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Zap size={14} />
                  {loadingOffline ? 'Validando...' : 'Ativar Chave Offline'}
                </button>
              </form>
            )}
          </div>

          {/* Configuração Opcional do Servidor Remoto */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowServerConfig(!showServerConfig)}
              className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Globe size={13} />
                Endereço do Servidor de Ativação
              </span>
              {showServerConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showServerConfig && (
              <div className="mt-2 space-y-2 animate-in fade-in duration-150">
                <input
                  type="url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://seu-painel.onrender.com"
                  className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500">
                  URL da nuvem (Render) da Software House.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
