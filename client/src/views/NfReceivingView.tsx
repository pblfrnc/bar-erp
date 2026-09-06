import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Scan, CheckCircle, Package, Loader, Trash2, FileText, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface NotaRecebida {
  id: string;
  chave: string;
  emitente: string;
  cnpjEmitente: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  valorTotal: number;
  status: string;
  createdAt: string;
}

interface NfReceivingViewProps {
  onBack: () => void;
  onImportarXml: (chave: string) => void;
}

export const NfReceivingView: React.FC<NfReceivingViewProps> = ({ onBack, onImportarXml }) => {
  const [chave, setChave] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [notas, setNotas] = useState<NotaRecebida[]>([]);
  const [loadingNotas, setLoadingNotas] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    loadNotas();
  }, []);

  const loadNotas = async () => {
    try {
      setLoadingNotas(true);
      const res = await fetch(`${api.getApiUrl()}/fiscal/notas-recebidas`);
      const data = await res.json();
      setNotas(Array.isArray(data) ? data : []);
    } catch {
      setNotas([]);
    } finally {
      setLoadingNotas(false);
    }
  };

  const handleBip = async () => {
    const chaveClean = chave.replace(/\D/g, '');
    if (chaveClean.length !== 44) {
      return alert('Chave de acesso inválida. Bipe novamente ou verifique os 44 dígitos.');
    }

    setIsLoading(true);
    setLastResult(null);

    try {
      const res = await fetch(`${api.getApiUrl()}/fiscal/bip-chave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: chaveClean })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setLastResult({ success: true, ...data });
      await loadNotas();
    } catch (err: any) {
      setLastResult({ success: false, error: err.message });
    } finally {
      setIsLoading(false);
      setChave('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleBip();
  };

  const formatChave = (c: string) => {
    return c.replace(/(\d{4})/g, '$1 ').trim();
  };

  const formatMoney = (v: number) =>
    `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pt-4 pb-20">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition">
        <ArrowLeft className="w-4 h-4" /> Voltar ao Módulo Fiscal
      </button>

      <div>
        <h2 className="text-2xl font-black text-white tracking-tight">Recebimento de NF por Bip</h2>
        <p className="text-sm text-slate-400 mt-1">Bipe o código de barras da nota ou cole a chave de acesso (44 dígitos). O sistema registra a Ciência da Operação na SEFAZ automaticamente.</p>
      </div>

      {/* Campo de Bip */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Scan className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-bold text-white">Leitor de Chave de Acesso</h3>
        </div>

        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={chave}
            onChange={e => setChave(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Bipe o código ou cole a chave de 44 dígitos aqui..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-amber-500 outline-none transition"
            disabled={isLoading}
          />
          <button
            onClick={handleBip}
            disabled={isLoading || chave.replace(/\D/g, '').length < 44}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl transition disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
          >
            {isLoading ? <Loader className="w-5 h-5 animate-spin" /> : <Scan className="w-5 h-5" />}
            {isLoading ? 'Consultando SEFAZ...' : 'Registrar NF'}
          </button>
        </div>

        <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
          <Scan className="w-3 h-3" />
          Pressione <strong className="text-slate-400">Enter</strong> após bipar para registro imediato. O leitor USB já faz isso automaticamente.
        </p>

        {/* Resultado do último bip */}
        {lastResult && (
          <div className={`mt-4 p-4 rounded-2xl border flex items-start gap-3 ${
            lastResult.success
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            {lastResult.success
              ? <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              : <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            }
            <div>
              {lastResult.success ? (
                <>
                  <p className="text-sm font-bold text-emerald-400">Ciência Registrada na SEFAZ!</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {lastResult.emitente} — NF {lastResult.numero}/{lastResult.serie} — {formatMoney(lastResult.valorTotal)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-red-400">Erro no Bip</p>
                  <p className="text-xs text-slate-400 mt-0.5">{lastResult.error}</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lista de Notas Recebidas */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-white">Histórico de Recebimentos</h3>
          </div>
          <button onClick={loadNotas} className="text-xs text-slate-400 hover:text-white transition">
            Atualizar
          </button>
        </div>

        {loadingNotas ? (
          <div className="text-center py-8 text-slate-500">
            <Loader className="w-6 h-6 animate-spin mx-auto mb-2" />
            Carregando...
          </div>
        ) : notas.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Scan className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma nota recebida ainda. Bipe a primeira!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notas.map((nota) => (
              <div
                key={nota.id}
                className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-2xl gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      nota.status === 'importada'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {nota.status === 'importada' ? '✓ Importada' : 'Aguardando Importação'}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">NF {nota.numero}/{nota.serie}</span>
                  </div>
                  <p className="text-sm font-bold text-white truncate">{nota.emitente || 'Fornecedor não identificado'}</p>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">{formatChave(nota.chave).substring(0, 24)}…</p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-base font-black text-amber-400">{formatMoney(nota.valorTotal)}</p>
                  <p className="text-xs text-slate-500">{new Date(nota.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>

                <button
                  onClick={() => onImportarXml(nota.chave)}
                  disabled={nota.status === 'importada'}
                  className="shrink-0 flex items-center gap-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-400 font-bold text-sm rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FileText className="w-4 h-4" />
                  {nota.status === 'importada' ? 'Importada' : 'Importar Itens'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
