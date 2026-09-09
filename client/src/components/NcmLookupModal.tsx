import React, { useState } from 'react';
import { X, Search, CheckCircle, AlertTriangle, Loader2, BookOpen, Percent } from 'lucide-react';
import { api } from '../services/api';

interface Props {
  onClose: () => void;
  onSelectNcm?: (ncm: string) => void;
}

export const NcmLookupModal: React.FC<Props> = ({ onClose, onSelectNcm }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = code.replace(/\D/g, '');
    if (clean.length < 4) {
      alert('Digite ao menos 4 dígitos do NCM (ex: 22030000 para Cerveja).');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${api.getApiUrl()}/fiscal/ncm/${clean}`);
      const data = await res.json();
      if (res.ok && data.valido) {
        setResult(data);
      } else {
        setError(data.error || 'Código NCM não encontrado ou inválido na Receita Federal.');
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao consultar NCM na Focus NFe.');
    } finally {
      setLoading(false);
    }
  };

  const quickCodes = [
    { code: '22030000', label: 'Cervejas e Chopes' },
    { code: '22021000', label: 'Refrigerantes' },
    { code: '22011000', label: 'Águas Minerais' },
    { code: '22084000', label: 'Cachaças e Aguardentes' },
    { code: '22083020', label: 'Whiskies' },
    { code: '22086000', label: 'Vodkas' },
    { code: '22085000', label: 'Gins' },
    { code: '22042100', label: 'Vinhos de Mesa' },
    { code: '21069090', label: 'Lanches e Porções' },
    { code: '19059090', label: 'Pastéis e Salgados' },
    { code: '24022000', label: 'Cigarros e Tabacaria' },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-purple-500/10 p-2.5 rounded-xl border border-purple-500/20">
              <BookOpen className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">Consulta Oficial de NCM</h2>
              <p className="text-xs text-slate-400">Classificação fiscal e alíquotas oficiais da Receita Federal</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Digite o código NCM (ex: 22030000)"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm focus:border-purple-500 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading || code.length < 4}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Consultar</span>
            </button>
          </form>

          {/* Atalhos Rápidos */}
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">Atalhos Comuns no Bar & Restaurante</p>
            <div className="flex flex-wrap gap-1.5">
              {quickCodes.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setCode(item.code);
                    const clean = item.code;
                    setLoading(true);
                    setError(null);
                    setResult(null);
                    fetch(`${api.getApiUrl()}/fiscal/ncm/${clean}`)
                      .then(r => r.json())
                      .then(d => d.valido ? setResult(d) : setError(d.error))
                      .catch(e => setError(e.message))
                      .finally(() => setLoading(false));
                  }}
                  className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium transition cursor-pointer border border-slate-700/60"
                >
                  <span className="font-mono text-purple-400 font-bold">{item.code}</span> — {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resultado */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-xs text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-mono text-base font-black text-white">{result.codigo}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase">
                  Válido na SEFAZ
                </span>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase text-slate-500">Descrição Oficial</p>
                <p className="text-sm font-semibold text-slate-200 mt-0.5">{result.descricao || 'Sem descrição cadastrada'}</p>
              </div>

              {(result.aliquotaNacional !== undefined || result.aliquotaEstadual !== undefined) && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-slate-900 rounded-xl p-2.5 border border-slate-800/80">
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Percent className="w-3 h-3 text-purple-400" /> Imposto Federal
                    </p>
                    <p className="text-sm font-mono font-bold text-white mt-0.5">
                      {result.aliquotaNacional !== undefined ? `${result.aliquotaNacional}%` : 'Conforme regime'}
                    </p>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-2.5 border border-slate-800/80">
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Percent className="w-3 h-3 text-purple-400" /> Imposto Estadual
                    </p>
                    <p className="text-sm font-mono font-bold text-white mt-0.5">
                      {result.aliquotaEstadual !== undefined ? `${result.aliquotaEstadual}%` : 'Conforme estado'}
                    </p>
                  </div>
                </div>
              )}

              {onSelectNcm && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectNcm(result.codigo);
                    onClose();
                  }}
                  className="w-full mt-2 py-2.5 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-500 text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Usar este NCM no Produto</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
