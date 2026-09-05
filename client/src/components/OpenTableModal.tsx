import React, { useState } from 'react';
import { Table } from '../types';
import { X, Users, User, Utensils } from 'lucide-react';

interface OpenTableModalProps {
  table: Table | null;
  onClose: () => void;
  onConfirm: (data: { customerName?: string; waiterName?: string; customerCount: number }) => void;
}

export const OpenTableModal: React.FC<OpenTableModalProps> = ({
  table,
  onClose,
  onConfirm
}) => {
  const [customerCount, setCustomerCount] = useState<number>(table?.capacity || 2);
  const [customerName, setCustomerName] = useState<string>('');
  const [waiterName, setWaiterName] = useState<string>('Garçom');

  if (!table) return null;

  const presetCounts = [1, 2, 3, 4, 5, 6, 8, 10];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      customerName: customerName.trim() || undefined,
      waiterName: waiterName.trim() || 'Garçom',
      customerCount
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold">
              Nova Ocupação
            </span>
            <h2 className="text-2xl font-black text-white">
              Abrir {table.name || `Mesa ${table.number}`}
            </h2>
            <p className="text-xs text-slate-400">{table.section}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Seletor de Pessoas Rápido */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              Quantidade de Pessoas na Mesa
            </label>
            <div className="grid grid-cols-4 gap-2">
              {presetCounts.map((num) => (
                <button
                  type="button"
                  key={num}
                  onClick={() => setCustomerCount(num)}
                  className={`py-2.5 rounded-xl font-bold text-sm transition ${
                    customerCount === num
                      ? 'bg-amber-500 text-slate-950 font-black ring-2 ring-amber-400'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {num} {num === 1 ? 'pessoa' : 'pessoas'}
                </button>
              ))}
            </div>
          </div>

          {/* Nome do Cliente */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-400" />
              Nome / Identificador do Cliente (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Carlos, Família Souza..."
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm"
              autoFocus
            />
          </div>

          {/* Garçom Responsável */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-emerald-400" />
              Garçom / Atendente
            </label>
            <input
              type="text"
              placeholder="Garçom"
              value={waiterName}
              onChange={(e) => setWaiterName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
            />
          </div>

          {/* Ações */}
          <div className="pt-3 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
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
