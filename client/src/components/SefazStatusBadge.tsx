import React, { useState, useEffect } from 'react';
import { Wifi, RefreshCw, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../services/api';

export const SefazStatusBadge: React.FC = () => {
  const [status, setStatus] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${api.getApiUrl()}/fiscal/sefaz-status`);
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ ok: false, online: false, motivoStatus: 'Sem conexão com servidor' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    // Verifica a cada 5 minutos automaticamente
    const interval = setInterval(checkStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const isOnline = status?.online === true;
  const isPending = loading && !status;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
          isPending
            ? 'bg-slate-800 text-slate-400 border-slate-700'
            : isOnline
            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
            : 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
        }`}
        title="Clique para ver o status da SEFAZ"
      >
        <span className={`w-2 h-2 rounded-full ${
          isPending ? 'bg-slate-400 animate-pulse' : isOnline ? 'bg-emerald-400' : 'bg-rose-400 animate-ping'
        }`} />
        <span className="text-[11px]">
          {isPending ? 'SEFAZ...' : isOnline ? `SEFAZ Online (${status?.uf || 'SP'})` : 'SEFAZ Fora do Ar'}
        </span>
      </button>

      {showDetails && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl z-50 text-xs text-slate-300 space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-sky-400" /> Servidores SEFAZ ({status?.uf || 'SP'})
            </span>
            <button
              onClick={checkStatus}
              disabled={loading}
              className="p-1 hover:text-white text-slate-400 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Recarregar status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase">Status Oficial</p>
            <p className="font-semibold text-white mt-0.5 flex items-center gap-1.5">
              {isOnline ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
              {status?.motivoStatus || (isOnline ? 'Serviço em Operação' : 'Serviço Indisponível')}
            </p>
          </div>

          {status?.codigoStatus && (
            <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
              <span>Código SEFAZ: <strong className="text-white">{status.codigoStatus}</strong></span>
              {status?.tempoMedio !== undefined && (
                <span>Latência: <strong className="text-white">{status.tempoMedio}s</strong></span>
              )}
            </div>
          )}

          <div className="pt-1 text-[10px] text-slate-500">
            {isOnline
              ? 'Emissões fiscais de NFC-e autorizando normalmente.'
              : 'Se a SEFAZ estiver instável, a contingência offline entra em ação automaticamente.'}
          </div>
        </div>
      )}
    </div>
  );
};
