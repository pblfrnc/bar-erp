import React, { useState, useEffect } from 'react';
import { ArrowLeft, XCircle, FileX, Loader2, CheckCircle, Clock, AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';
import { api } from '../services/api';

interface CancelableNota {
  id: string;
  referencia: string;
  chave: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  valorTotal: number;
  status: string;
  createdAt: string;
  minutesRemaining: number;
}

export const NfceCancelView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [notas, setNotas] = useState<CancelableNota[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNota, setSelectedNota] = useState<CancelableNota | null>(null);
  
  // Dupla confirmação
  const [justificativa, setJustificativa] = useState('');
  const [isCanceling, setIsCanceling] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    loadCancelableNotes();
  }, []);

  const loadCancelableNotes = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${api.getApiUrl()}/fiscal/cancelable-notes`);
      const data = await res.json();
      setNotas(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setNotas([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteCancel = async () => {
    if (!selectedNota) return;
    if (justificativa.trim().length < 15) {
      return alert('A justificativa deve ter no mínimo 15 caracteres (Regra da SEFAZ).');
    }

    setIsCanceling(true);
    setResult(null);

    try {
      const res = await fetch(`${api.getApiUrl()}/fiscal/cancel-nfce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referencia: selectedNota.referencia,
          justificativa: justificativa.trim()
        })
      });
      const data = await res.json();

      if (!res.ok) {
        setResult({ ok: false, message: data.error || 'Erro ao cancelar nota na SEFAZ.' });
      } else {
        setResult({ ok: true, message: `NFC-e nº ${selectedNota.numero} cancelada com sucesso na SEFAZ!` });
        setSelectedNota(null);
        setJustificativa('');
        loadCancelableNotes();
      }
    } catch (err: any) {
      setResult({ ok: false, message: err.message || 'Erro de conexão com o servidor.' });
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pt-4 pb-20">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Painel Fiscal
        </button>

        <button
          onClick={loadCancelableNotes}
          className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar Lista
        </button>
      </div>

      {/* Alerta de Resultado */}
      {result && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 animate-in fade-in ${
          result.ok ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400'
        }`}>
          {result.ok ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <XCircle className="w-5 h-5 flex-shrink-0" />}
          <div className="text-xs font-bold">{result.message}</div>
        </div>
      )}

      {/* Header explicativo */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <FileX className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Cancelamento de NFC-e</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Conforme regras da SEFAZ, o cancelamento é permitido exclusivamente em até <strong className="text-slate-900 dark:text-white">30 minutos</strong> após a emissão.
            </p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
          <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <span>
            Todas as notas abaixo foram emitidas recentemente e estão dentro do prazo legal. <strong>Se a nota que você procura não aparece aqui, o prazo de 30 minutos expirou</strong> e ela não pode mais ser cancelada na SEFAZ.
          </span>
        </div>
      </div>

      {/* Lista de Notas Elegíveis */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm dark:shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Notas Disponíveis para Cancelamento ({notas.length})
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
            Verificando notas com prazo ativo...
          </div>
        ) : notas.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs flex flex-col items-center gap-2">
            <Clock className="w-8 h-8 text-slate-400 dark:text-slate-600 mb-1" />
            <span className="font-bold text-slate-700 dark:text-slate-300">Nenhuma nota emitida nos últimos 30 minutos.</span>
            <span>Todas as notas anteriores já tiveram seu prazo legal de cancelamento expirado.</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {notas.map(nota => (
              <div key={nota.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono font-black text-slate-900 dark:text-white text-base">
                      NFC-e Nº {nota.numero || 'S/N'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono border border-slate-200 dark:border-transparent">
                      Série {nota.serie || '1'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Restam ~{nota.minutesRemaining} min
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
                    <span>Emitida em: {new Date(nota.createdAt).toLocaleTimeString('pt-BR')}</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      R$ {(nota.valorTotal || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedNota(nota);
                    setJustificativa('');
                  }}
                  className="px-4 py-2.5 bg-rose-50 hover:bg-rose-500 dark:bg-rose-500/15 dark:hover:bg-rose-500 text-rose-700 hover:text-white dark:text-rose-300 dark:hover:text-white border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 self-start sm:self-auto shadow-xs"
                >
                  <XCircle className="w-4 h-4" />
                  Cancelar Esta Nota
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Dupla Confirmação Obrigatória */}
      {selectedNota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-500/40 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl space-y-5">
            
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Dupla Confirmação de Cancelamento</h3>
                <span className="text-xs text-rose-600 dark:text-rose-400 font-bold">Ação Irreversível perante a SEFAZ</span>
              </div>
            </div>

            {/* Dados da Nota a ser Cancelada */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Número da Nota:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">#{selectedNota.numero} (Série {selectedNota.serie})</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Valor Total:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">R$ {(selectedNota.valorTotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Prazo Restante:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">~{selectedNota.minutesRemaining} minutos</span>
              </div>
            </div>

            {/* Campo de Justificativa com regra de 15 caracteres */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">
                Motivo do Cancelamento (Mínimo 15 caracteres)
              </label>
              <textarea
                value={justificativa}
                onChange={e => setJustificativa(e.target.value)}
                placeholder="Exemplo: Erro de preenchimento ou desistência da compra pelo cliente"
                rows={3}
                autoFocus
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-xs focus:border-rose-500 outline-none transition resize-none placeholder-slate-400 dark:placeholder-slate-500 shadow-xs"
              />
              <div className="flex justify-between items-center mt-1 text-[11px]">
                <span className={justificativa.length >= 15 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400'}>
                  {justificativa.length}/15 caracteres
                </span>
                {justificativa.length < 15 && (
                  <span className="text-slate-500">A SEFAZ exige ao menos 15 letras.</span>
                )}
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setSelectedNota(null)}
                disabled={isCanceling}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                Voltar / Não Cancelar
              </button>

              <button
                type="button"
                onClick={handleExecuteCancel}
                disabled={isCanceling || justificativa.trim().length < 15}
                className="flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white transition shadow-lg shadow-rose-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isCanceling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                {isCanceling ? 'Cancelando na SEFAZ...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
