import React from 'react';
import { Table } from '../types';
import { Users, Clock, Plus, ReceiptText, ArrowRightLeft, DollarSign } from 'lucide-react';

interface TableCardProps {
  table: Table;
  onOpenTable: (table: Table) => void;
  onSelectTable: (table: Table) => void;
  onQuickOrder: (table: Table) => void;
  onQuickPay: (table: Table) => void;
}

export const TableCard: React.FC<TableCardProps> = ({
  table,
  onOpenTable,
  onSelectTable,
  onQuickOrder,
  onQuickPay
}) => {
  const isAvailable = table.status === 'AVAILABLE';
  const isOccupied = table.status === 'OCCUPIED';
  const isClosing = table.status === 'CLOSING';

  const [currentTime] = React.useState<number>(() => Date.now());

  // Calcular tempo decorrido
  const getElapsedMinutes = () => {
    if (!table.openedAt) return null;
    const diffMs = currentTime - new Date(table.openedAt).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  };

  const elapsed = getElapsedMinutes();
  const orderTotal = table.activeOrder?.total || 0;
  const itemsCount = table.activeOrder?.items?.length || 0;

  // Status de cor e borda
  let cardBorder = 'border-slate-800 hover:border-slate-700 bg-slate-900/60';
  let badgeColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  let badgeText = 'Livre';

  if (isOccupied) {
    cardBorder = 'border-blue-500/40 hover:border-blue-400 bg-blue-950/20 shadow-lg shadow-blue-950/30';
    badgeColor = 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    badgeText = 'Ocupada';
  } else if (isClosing) {
    cardBorder = 'border-amber-500/60 hover:border-amber-400 bg-amber-950/25 shadow-lg shadow-amber-950/40 ring-1 ring-amber-500/30';
    badgeColor = 'bg-amber-500/25 text-amber-300 border-amber-500/50 animate-pulse';
    badgeText = 'Fechamento';
  }

  return (
    <div
      onClick={() => {
        if (isAvailable) onOpenTable(table);
        else onSelectTable(table);
      }}
      className={`group relative rounded-2xl border ${cardBorder} p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between select-none active:scale-[0.98]`}
    >
      {/* Cabeçalho do Card */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-3xl sm:text-4xl font-black table-number tracking-tight text-white group-hover:text-amber-400 transition-colors">
                #{String(table.number).padStart(2, '0')}
              </span>
              <span className="text-base font-bold text-slate-200 truncate max-w-[130px]">
                {table.name || `Mesa ${table.number}`}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-400 mt-0.5">{table.section}</p>
          </div>

          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeColor}`}>
            {badgeText}
          </span>
        </div>

        {/* Informações Centrais */}
        {isAvailable ? (
          <div className="py-5 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800/80 text-slate-400 group-hover:text-emerald-400 group-hover:bg-emerald-950/30 transition">
              <Users className="w-6 h-6" />
            </div>
            <p className="text-xs text-slate-400 mt-2">Capacidade: {table.capacity} lugares</p>
          </div>
        ) : (
          <div className="space-y-2.5 my-2">
            {/* Cliente e Tempo */}
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-medium truncate max-w-[130px]">
                👤 {table.customerName || 'Cliente sem nome'} ({table.customerCount}p)
              </span>
              {elapsed && (
                <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md font-mono">
                  <Clock className="w-3 h-3 text-amber-400" />
                  {elapsed}
                </span>
              )}
            </div>

            {/* Total Consumido */}
            <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                  Consumo ({itemsCount} itens)
                </span>
                <span className="text-lg font-black text-emerald-400 tracking-tight">
                  R$ {orderTotal.toFixed(2)}
                </span>
              </div>

              {table.activeOrder?.isServiceFeeActive && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                  +10%
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Rodapé / Botões de Ação Direta */}
      <div className="pt-2 border-t border-slate-800/60 flex items-center gap-1.5 mt-2">
        {isAvailable ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenTable(table);
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/30 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Abrir Mesa
          </button>
        ) : (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickOrder(table);
              }}
              className="flex-1 flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-bold bg-blue-600/20 text-blue-300 hover:bg-blue-600 hover:text-white border border-blue-500/30 transition active:scale-95"
              title="Lançar pedido rápido"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Pedido</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickPay(table);
              }}
              className={`flex-1 flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-bold border transition active:scale-95 ${
                isClosing
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 border-amber-400 font-extrabold shadow-md'
                  : 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600 hover:text-white border-emerald-500/30'
              }`}
              title="Fechar conta"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>{isClosing ? 'Receber' : 'Conta'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
