import React, { useState, useEffect } from 'react';
import { Table, Waiter } from '../types';
import { api } from '../services/api';
import { X, Users, User, Utensils, Check } from 'lucide-react';

interface OpenTableModalProps {
  table: Table | null;
  onClose: () => void;
  onConfirm: (data: { customerName?: string; waiterName?: string; waiterId?: string; customerCount: number }) => void;
}

export const OpenTableModal: React.FC<OpenTableModalProps> = ({
  table,
  onClose,
  onConfirm
}) => {
  const [customerCount, setCustomerCount] = useState<number>(table?.capacity || 2);
  const [customerName, setCustomerName] = useState<string>('');
  const [waiterName, setWaiterName] = useState<string>('Garçom');
  const [waiterId, setWaiterId] = useState<string | undefined>(undefined);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [isCustomWaiter, setIsCustomWaiter] = useState(false);

  useEffect(() => {
    api.getWaiters().then((data) => {
      setWaiters(data);
      if (data.length > 0) {
        setWaiterId(data[0].id);
        setWaiterName(data[0].name);
      }
    }).catch(console.error);
  }, []);

  if (!table) return null;

  const presetCounts = [1, 2, 3, 4, 5, 6, 8, 10];

  const handleSelectWaiter = (w: Waiter) => {
    setWaiterId(w.id);
    setWaiterName(w.name);
    setIsCustomWaiter(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      customerName: customerName.trim() || undefined,
      waiterName: waiterName.trim() || 'Garçom',
      waiterId: isCustomWaiter ? undefined : waiterId,
      customerCount
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">
              Nova Ocupação
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              Abrir {table.name || `Mesa ${table.number}`}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{table.section}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Seletor de Pessoas Rápido */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-500" />
              Quantidade de Pessoas: <span className="text-amber-500 font-black">{customerCount}</span>
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {presetCounts.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setCustomerCount(count)}
                  className={`py-2 text-sm font-black rounded-xl border transition ${
                    customerCount === count
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-105'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* Nome do Cliente */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-500" />
              Nome / Identificador do Cliente (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Carlos, Família Souza..."
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm font-medium"
              autoFocus
            />
          </div>

          {/* Seletor de Garçom */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-emerald-500" />
                Garçom / Atendente Responsável
              </label>
              {waiters.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomWaiter(!isCustomWaiter);
                    if (!isCustomWaiter) {
                      setWaiterId(undefined);
                      setWaiterName('');
                    }
                  }}
                  className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-bold"
                >
                  {isCustomWaiter ? 'Selecionar da Lista' : 'Digitar Outro'}
                </button>
              )}
            </div>

            {waiters.length > 0 && !isCustomWaiter ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto p-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                {waiters.map((w) => {
                  const isSelected = waiterId === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => handleSelectWaiter(w)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border text-left flex items-center justify-between transition ${
                        isSelected
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                      }`}
                    >
                      <span className="truncate">{w.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                type="text"
                placeholder="Nome do garçom"
                value={waiterName}
                onChange={(e) => setWaiterName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm font-medium"
              />
            )}
          </div>

          {/* Ações */}
          <div className="pt-3 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              Abrir Atendimento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
