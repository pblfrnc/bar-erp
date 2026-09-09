import React from 'react';
import { Table, OrderItem } from '../types';
import { api } from '../services/api';
import {
  X,
  Plus,
  ArrowRightLeft,
  Merge,
  Clock,
  Printer,
  DollarSign,
  Trash2,
  CheckCircle2,
  Hourglass,
  Flame,
  ReceiptText
} from 'lucide-react';

interface TableDetailsModalProps {
  table: Table | null;
  onClose: () => void;
  onAddOrder: () => void;
  onCheckout: () => void;
  onTransfer: () => void;
  onMerge: () => void;
  onRefresh: () => void;
  isManager?: boolean;
}

export const TableDetailsModal: React.FC<TableDetailsModalProps> = ({
  table,
  onClose,
  onAddOrder,
  onCheckout,
  onTransfer,
  onMerge,
  onRefresh,
  isManager = true
}) => {
  if (!table || !table.activeOrder) return null;

  const order = table.activeOrder;

  // Calcular tempo de permanência
  const getElapsedMinutes = () => {
    if (!table.openedAt) return null;
    const diffMs = Date.now() - new Date(table.openedAt).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  };

  const elapsed = getElapsedMinutes();

  const handleRemoveItem = async (itemId: string) => {
    if (!confirm('Deseja realmente cancelar este item do pedido? O estoque será reposto.')) {
      return;
    }
    try {
      await api.removeOrderItem(order.id, itemId);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao remover item');
    }
  };

  
  const handleMarkAsLoss = async () => {
    if (!window.confirm('ALERTA: Tem certeza que deseja dar baixa nesta mesa como PERDA/CALOTE? Isso não gera receita, mas debita o estoque e registra o prejuízo na Auditoria Cega.')) {
      return;
    }
    try {
      await api.markAsLoss(order.id);
      onClose();
    } catch (err: any) {
      alert(err.error || 'Erro ao registrar perda.');
    }
  };


  const handleRequestClosing = async () => {
    try {
      await api.requestTableClosing(table.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao solicitar fechamento');
    }
  };

  const handleReopen = async () => {
    try {
      await api.reopenTable(table.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao reabrir mesa');
    }
  };

  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Hourglass className="w-3 h-3" /> Fila
          </span>
        );
      case 'PREPARING':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 animate-pulse">
            <Flame className="w-3 h-3" /> Em Preparo
          </span>
        );
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Pronto!
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
            Entregue
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 dark:bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/90">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {table.name || `Mesa ${table.number}`}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold">
                CMD #{order.orderNumber}
              </span>
              {table.status === 'CLOSING' && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                  Em Fechamento
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span>👤 {table.customerName || 'Cliente não identificado'} ({table.customerCount}p)</span>
              <span>•</span>
              <span>🛎️ {order.waiterName || 'Garçom'}</span>
              {elapsed && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-mono text-amber-600 dark:text-amber-400 font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    {elapsed}
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/60 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Ações Rápidas da Mesa */}
        <div className="p-3 bg-slate-100/70 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={onAddOrder}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition whitespace-nowrap shadow-md shadow-amber-500/10 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Lançar Pedido
          </button>

          <button
            onClick={onTransfer}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition whitespace-nowrap active:scale-95 cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            Transferir Mesa
          </button>

          <button
            onClick={onMerge}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition whitespace-nowrap active:scale-95 cursor-pointer"
          >
            <Merge className="w-4 h-4 text-purple-500 dark:text-purple-400" />
            Juntar Mesa
          </button>

          {table.status === 'CLOSING' ? (
            <button
              onClick={handleReopen}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-700 dark:text-amber-300 border border-slate-200 dark:border-slate-700 transition whitespace-nowrap active:scale-95 cursor-pointer"
            >
              Reabrir Mesa
            </button>
          ) : (
            <button
              onClick={handleRequestClosing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-700 dark:text-amber-300 border border-slate-200 dark:border-slate-700 transition whitespace-nowrap active:scale-95 cursor-pointer"
            >
              <ReceiptText className="w-4 h-4" />
              Pedir Pré-Conta
            </button>
          )}

          {isManager && (
            <button
              onClick={handleMarkAsLoss}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-700 transition whitespace-nowrap active:scale-95 cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              Perda (Calote)
            </button>
          )}

          <button
            onClick={() => { if ((window as any).electronAPI && (window as any).electronAPI.printSilent) { (window as any).electronAPI.printSilent(); } else { window.print(); } }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200 dark:border-slate-700 transition whitespace-nowrap active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            Imprimir 80mm
          </button>
        </div>

        {/* Lista de Itens Consumidos */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1 mb-1">
            <span>Itens Consumidos ({order.items?.length || 0})</span>
            <span>Total</span>
          </div>

          {(!order.items || order.items.length === 0) ? (
            <div className="text-center py-10 text-slate-500">
              Nenhum item consumido ainda nesta comanda.
            </div>
          ) : (
            order.items.map((item) => (
              <div
                key={item.id}
                className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/90 rounded-2xl p-3 flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="font-bold text-sm text-amber-600 dark:text-amber-400 font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                    {item.quantity}x
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {item.product?.name}
                      </span>
                      {getItemStatusBadge(item.kdsStatus)}
                    </div>
                    {item.notes && (
                      <p className="text-xs text-amber-700 dark:text-amber-300/90 font-medium italic mt-0.5">
                        Obs: {item.notes}
                      </p>
                    )}
                    <span className="text-[11px] text-slate-500">
                      R$ {item.unitPrice.toFixed(2)} cada • {item.kdsStation === 'BAR' ? '🍺 Bar' : '🍳 Cozinha'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-slate-900 dark:text-white font-mono">
                    R$ {item.totalPrice.toFixed(2)}
                  </span>
                  {isManager && (
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Cancelar item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rodapé com Totais e Botão de Fechar Conta */}
        <div className="p-4 sm:px-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                  Total Acumulado
                </span>
                {order.isServiceFeeActive && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold">
                    10% incluso
                  </span>
                )}
              </div>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                R$ {order.total.toFixed(2)}
              </span>
            </div>

            <button
              onClick={onCheckout}
              className="py-3 px-6 rounded-2xl font-black text-sm uppercase tracking-wide bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 transition shadow-lg shadow-emerald-500/20 flex items-center gap-2 active:scale-95 cursor-pointer"
            >
              <DollarSign className="w-5 h-5 stroke-[2.5]" />
              <span>Fechar Conta / PDV</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
