import React, { useState } from 'react';
import { X, ShieldAlert, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

export const NfceInutilizacaoModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [serie, setSerie] = useState('1');
  const [numeroInicial, setNumeroInicial] = useState('');
  const [numeroFinal, setNumeroFinal] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serie || !numeroInicial || !numeroFinal) {
      alert('Preencha a série e o intervalo de números.');
      return;
    }

    if (justificativa.trim().length < 15) {
      alert('A justificativa deve ter no mínimo 15 caracteres (Exigência legal da SEFAZ).');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`${api.getApiUrl()}/fiscal/inutilizar-numeracao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serie: serie.trim(),
          numeroInicial: parseInt(numeroInicial, 10),
          numeroFinal: parseInt(numeroFinal, 10),
          justificativa: justificativa.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, message: data.mensagem || 'Inutilização homologada com sucesso!' });
        if (onSuccess) onSuccess();
      } else {
        setResult({ ok: false, message: data.error || 'Erro ao homologar na SEFAZ.' });
      }
    } catch (err: any) {
      setResult({ ok: false, message: err.message || 'Falha de conexão com o servidor.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">Inutilização de Numeração</h2>
              <p className="text-xs text-slate-400">Comunique à SEFAZ a quebra de sequência de notas</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3 text-xs text-slate-400 leading-relaxed">
            Utilize este recurso quando houver um salto de números não emitidos (por queda de energia, falhas ou testes). A SEFAZ exige justificativa formal com no mínimo <strong className="text-white">15 caracteres</strong>.
          </div>

          {result && (
            <div className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 ${
              result.ok ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
            }`}>
              {result.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{result.message}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Série</label>
              <input
                type="text"
                required
                value={serie}
                onChange={e => setSerie(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-sm focus:border-rose-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Nº Inicial</label>
              <input
                type="number"
                required
                min="1"
                placeholder="Ex: 10"
                value={numeroInicial}
                onChange={e => {
                  setNumeroInicial(e.target.value);
                  if (!numeroFinal) setNumeroFinal(e.target.value);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-sm focus:border-rose-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Nº Final</label>
              <input
                type="number"
                required
                min="1"
                placeholder="Ex: 10"
                value={numeroFinal}
                onChange={e => setNumeroFinal(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-sm focus:border-rose-500 outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-slate-400 uppercase">Justificativa Legal (min. 15 letras)</label>
              <span className={`text-[10px] font-mono ${justificativa.length >= 15 ? 'text-emerald-400' : 'text-slate-500'}`}>
                {justificativa.length}/15 min
              </span>
            </div>
            <textarea
              required
              rows={3}
              placeholder="Ex: Quebra de sequencia numerica decorrente de falha tecnica ou reinicializacao do terminal emissor"
              value={justificativa}
              onChange={e => setJustificativa(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs focus:border-rose-500 outline-none resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || justificativa.trim().length < 15}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>Homologar na SEFAZ</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
