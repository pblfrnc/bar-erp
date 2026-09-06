import React, { useState } from 'react';
import { ArrowLeft, XCircle, FileX, Loader2, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

export const NfceCancelView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [referencia, setReferencia] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [isCanceling, setIsCanceling] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; data?: any } | null>(null);

  const handleCancel = async () => {
    if (!referencia.trim()) {
      return alert('Informe a Referência (ID do Pedido).');
    }
    if (justificativa.length < 15) {
      return alert('A justificativa deve ter no mínimo 15 caracteres.');
    }

    setIsCanceling(true);
    setResult(null);

    try {
      const res = await fetch(api.getApiUrl() + '/fiscal/cancel-nfce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referencia, justificativa })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setResult({ ok: false, message: data.error || 'Erro desconhecido ao cancelar.', data: data.details });
      } else {
        setResult({ ok: true, message: data.mensagem || 'Nota cancelada com sucesso!', data: data.data });
      }
    } catch (err: any) {
      setResult({ ok: false, message: err.message || 'Erro de conexão com o servidor.' });
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pt-4 pb-20">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
        <div className="flex items-center gap-4 mb-6">
          <FileX className="w-8 h-8 text-rose-500" />
          <div>
            <h2 className="text-xl font-bold text-white">Cancelar NFC-e</h2>
            <p className="text-slate-400 text-sm">Cancelamento de nota até 30 minutos após emissão.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
              Referência da Nota (ID do Pedido)
            </label>
            <input
              type="text"
              value={referencia}
              onChange={e => setReferencia(e.target.value)}
              placeholder="Ex: order_12345"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-rose-500 outline-none transition font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
              Justificativa (Mín. 15 caracteres)
            </label>
            <textarea
              value={justificativa}
              onChange={e => setJustificativa(e.target.value)}
              placeholder="Descreva o motivo do cancelamento (ex: Desistência da compra pelo cliente)"
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-rose-500 outline-none transition resize-none"
            />
            <p className={`text-xs mt-1 ${justificativa.length >= 15 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {justificativa.length}/15 caracteres
            </p>
          </div>

          <button
            onClick={handleCancel}
            disabled={isCanceling || justificativa.length < 15 || !referencia.trim()}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold bg-rose-500 hover:bg-rose-400 text-white transition disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {isCanceling ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Processando na SEFAZ...</>
            ) : (
              <><XCircle className="w-5 h-5" /> Confirmar Cancelamento</>
            )}
          </button>
        </div>

        {result && (
          <div className={`mt-6 p-4 rounded-xl border flex flex-col gap-2 ${
            result.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            <div className="flex items-center gap-2 font-bold">
              {result.ok ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              {result.message}
            </div>
            {!result.ok && result.data && (
              <p className="text-sm opacity-80 break-words">{JSON.stringify(result.data)}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
