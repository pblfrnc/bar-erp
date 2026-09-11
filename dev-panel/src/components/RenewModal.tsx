import React, { useState } from 'react';
import { X, Zap, Calendar, DollarSign, FileText, CheckCircle2 } from 'lucide-react';
import { LicenseRecord, ClientRecord } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  license: LicenseRecord | null;
  client: ClientRecord | null;
  onSuccess: (result: any) => void;
}

export function RenewModal({ isOpen, onClose, license, client, onSuccess }: Props) {
  const [days, setDays] = useState(30);
  const [amount, setAmount] = useState(client?.monthly_fee?.toString() || '150.00');
  const [notes, setNotes] = useState('Mensalidade recebida via PIX');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !license || !client) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/licenses/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineId: license.machine_id,
          daysToAdd: days,
          amountPaid: parseFloat(amount) || 0,
          notes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess(data);
        onClose();
      } else {
        setError(data.error || 'Erro ao renovar licença');
      }
    } catch (err: any) {
      setError('Erro de conexão ao renovar licença');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Zap size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Renovar Licença</h2>
              <p className="text-xs text-slate-400">{client.business_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Terminal Vinculado
            </span>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div className="font-semibold text-sm text-slate-200">{license.machine_name}</div>
              <code className="text-xs font-mono text-indigo-400 font-bold block mt-0.5 select-all">
                {license.machine_id}
              </code>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Período de Renovação
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[15, 30, 60, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                    days === d
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  +{d} dias
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Valor Pago (R$)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm">
                R$
              </div>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Anotações do Comprovante
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Comprovante recebido via WhatsApp às 15:30"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 size={18} />
              {loading ? 'Renovando...' : 'Confirmar e Renovar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
