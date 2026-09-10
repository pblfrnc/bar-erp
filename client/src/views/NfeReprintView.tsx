import React, { useState, useEffect } from 'react';
import { ArrowLeft, Printer, Search, FileText, Loader2, RefreshCw, Package } from 'lucide-react';
import { api } from '../services/api';

interface NotaEmitida {
  id: string;
  referencia: string;
  chave?: string;
  numero?: string;
  serie?: string;
  dataEmissao?: string;
  valorTotal?: number;
  status: string;
  pdfUrl?: string;
  createdAt: string;
}

export const NfeReprintView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [numeroNota, setNumeroNota] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [recentNotas, setRecentNotas] = useState<NotaEmitida[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  useEffect(() => {
    loadRecentNotas();
  }, []);

  const loadRecentNotas = async () => {
    try {
      setLoadingRecent(true);
      const res = await fetch(`${api.getApiUrl()}/fiscal/recent-notes`);
      const data = await res.json();
      setRecentNotas(Array.isArray(data) ? data : []);
    } catch {
      setRecentNotas([]);
    } finally {
      setLoadingRecent(false);
    }
  };

  const handleConsultByNumber = async (numToSearch?: string) => {
    const num = (numToSearch || numeroNota).trim();
    if (!num) return alert('Digite o número da nota fiscal a ser reimpressa.');

    setIsLoading(true);
    setResult(null);

    try {
      const res = await fetch(`${api.getApiUrl()}/fiscal/nfe/reprint/${encodeURIComponent(num)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nota fiscal não localizada.');
      setResult(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pt-4 pb-20">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Painel Fiscal
        </button>
        <button onClick={loadRecentNotas} className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold">
          <RefreshCw className={`w-3.5 h-3.5 ${loadingRecent ? 'animate-spin' : ''}`} /> Atualizar Notas
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-sm dark:shadow-2xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-500/15 border border-sky-200 dark:border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Reimprimir NF‑e</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Busca direta pelo <strong>Número da Nota Fiscal</strong> (independente de comanda ou mesa).
            </p>
          </div>
        </div>

        {/* Campo de Busca por Número da Nota */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">Número da NF‑e</label>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Ex: 1543 ou 12"
                value={numeroNota}
                onChange={e => setNumeroNota(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleConsultByNumber(); }}
                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-sky-500 outline-none transition font-mono text-sm shadow-xs"
              />
              <button
                onClick={() => handleConsultByNumber()}
                disabled={isLoading || !numeroNota.trim()}
                className="px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-lg shadow-sky-600/20 active:scale-95"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Buscar Nota
              </button>
            </div>
          </div>

          {/* Resultado da Busca */}
          {result && result.success && (
            <div className="p-6 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3">
                  <FileText className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  <div>
                    <h3 className="text-base font-black text-emerald-700 dark:text-emerald-400">
                      NF‑e Nº {result.nota?.numero || numeroNota} Encontrada!
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      Série: {result.nota?.serie || '1'} • Status: <strong className="uppercase text-emerald-600 dark:text-emerald-400">{result.status || 'Autorizado'}</strong>
                    </p>
                    {result.chaveAcesso && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 break-all font-mono">
                        Chave: {result.chaveAcesso}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if ((window as any).electronAPI?.printPdfSilent) {
                        (window as any).electronAPI.printPdfSilent(result.caminhoDanfe);
                        alert('Enviado diretamente para a impressora térmica!');
                      } else {
                        window.open(result.caminhoDanfe, '_blank');
                      }
                    }}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-3 px-5 rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" /> Imprimir Direto (Silencioso)
                  </button>
                  <a
                    href={result.caminhoDanfe}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2"
                  >
                    Ver PDF
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lista de Notas Emitidas Recentemente */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm dark:shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Notas Emitidas Recentemente ({recentNotas.length})
          </span>
          <span className="text-[11px] text-slate-500">Clique em qualquer nota para reimprimir</span>
        </div>

        {loadingRecent ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
            Carregando histórico recente...
          </div>
        ) : recentNotas.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs flex flex-col items-center gap-2">
            <Package className="w-8 h-8 text-slate-400 dark:text-slate-600 mb-1" />
            Nenhuma nota emitida gravada no sistema ainda.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {recentNotas.map(nota => (
              <div key={nota.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                      NF‑e Nº {nota.numero || 'S/N'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono border border-slate-200 dark:border-transparent">
                      Série {nota.serie || '1'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      nota.status === 'cancelado'
                        ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                        : 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                    }`}
                    >
                      {nota.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
                    <span>{new Date(nota.createdAt).toLocaleString('pt-BR')}</span>
                    {nota.valorTotal !== undefined && (
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        R$ {nota.valorTotal.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (nota.numero) {
                        setNumeroNota(nota.numero);
                        handleConsultByNumber(nota.numero);
                      }
                    }}
                    className="px-3.5 py-2 bg-sky-50 hover:bg-sky-500 dark:bg-sky-500/15 dark:hover:bg-sky-500 text-sky-700 hover:text-white dark:text-sky-300 dark:hover:text-white border border-sky-200 dark:border-sky-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" /> Reimprimir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
