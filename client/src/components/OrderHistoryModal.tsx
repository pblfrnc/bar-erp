import React, { useState, useEffect } from 'react';
import { Order } from '../types';
import { api } from '../services/api';
import { ThermalReceipt } from './ThermalReceipt';
import {
  X,
  Search,
  Calendar,
  Clock,
  Printer,
  Receipt,
  User,
  CheckCircle,
  AlertCircle,
  Package,
  RefreshCw,
  Eye,
  FileText,
  DollarSign
} from 'lucide-react';

interface OrderHistoryModalProps {
  onClose: () => void;
}

export const OrderHistoryModal: React.FC<OrderHistoryModalProps> = ({ onClose }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    loadOrders();
  }, [selectedDate]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await api.getOrderHistory(100, selectedDate || undefined);
      setOrders(Array.isArray(data) ? data : []);
      if (data && data.length > 0 && !selectedOrder) {
        setSelectedOrder(data[0]);
      }
    } catch (err) {
      console.error('Erro ao carregar histórico de comandas:', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(o => {
    const term = search.toLowerCase();
    const orderNumMatch = o.orderNumber?.toString().includes(term);
    const tableMatch = o.table?.number?.toString().includes(term) || (o.table?.name && o.table.name.toLowerCase().includes(term));
    const customerMatch = o.customerName && o.customerName.toLowerCase().includes(term);
    const waiterMatch = o.waiterName && o.waiterName.toLowerCase().includes(term);
    return orderNumMatch || tableMatch || customerMatch || waiterMatch;
  });

  const handlePrintReceipt = () => {
    if (!selectedOrder) return;
    if ((window as any).electronAPI && (window as any).electronAPI.printSilent) {
      (window as any).electronAPI.printSilent();
    } else {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-tight">Comandas Finalizadas & Histórico</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                  {orders.length} Encerradas
                </span>
              </div>
              <p className="text-xs text-slate-400">Consulte itens consumidos, descontos, 10% de serviço e 2ª via de comprovante</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadOrders}
              title="Atualizar lista"
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-900 flex flex-col sm:flex-row items-center gap-3 justify-between">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por comanda #, mesa, cliente ou garçom..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl text-xs text-white px-3 py-2 focus:border-amber-500 focus:outline-none"
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                className="text-xs text-amber-400 hover:text-white underline cursor-pointer"
              >
                Limpar data
              </button>
            )}
          </div>
        </div>

        {/* Corpo Principal (Tabela de Comandas à Esquerda + Detalhes/Itens à Direita) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Coluna Esquerda: Lista de Comandas */}
          <div className="flex-1 overflow-y-auto border-r border-slate-800 bg-slate-950/40 scrollbar-thin">
            {loading ? (
              <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                Carregando histórico de comandas...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                <Package className="w-8 h-8 text-slate-600" />
                Nenhuma comanda finalizada encontrada com os filtros atuais.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {filteredOrders.map(ord => {
                  const isSelected = selectedOrder?.id === ord.id;
                  const isLoss = ord.status === 'CLOSED' && (ord.paidAmount || 0) < (ord.total || 0);

                  return (
                    <div
                      key={ord.id}
                      onClick={() => setSelectedOrder(ord)}
                      className={`p-4 transition cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-amber-500/10 border-l-4 border-amber-500'
                          : 'hover:bg-slate-850/60'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-white text-sm">
                            #{ord.orderNumber}
                          </span>
                          <span className="text-xs font-bold text-slate-300">
                            {ord.table ? (ord.table.name || `Mesa ${ord.table.number}`) : 'Balcão / Direto'}
                          </span>
                          {isLoss ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Calote / Perda
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Pago
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {ord.closedAt ? new Date(ord.closedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </span>
                          <span>Atendente: {ord.waiterName || 'Garçom'}</span>
                          {ord.customerName && (
                            <span className="truncate max-w-[120px]">Cliente: {ord.customerName}</span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-black text-sm text-emerald-400">
                          R$ {(ord.total || 0).toFixed(2)}
                        </div>
                        {ord.discount > 0 && (
                          <div className="text-[10px] text-amber-400 font-mono">
                            Desc: -R$ {ord.discount.toFixed(2)}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-500">
                          {ord.items?.length || 0} itens
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Coluna Direita: Detalhes da Comanda Selecionada e Itens Consumidos */}
          <div className="w-full md:w-[460px] bg-slate-900 flex flex-col justify-between overflow-y-auto scrollbar-thin">
            {selectedOrder ? (
              <div className="p-6 space-y-5 flex-1">
                
                {/* Header do Card de Detalhes */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                        Comanda
                      </span>
                      <span className="text-xl font-black text-white font-mono">
                        #{selectedOrder.orderNumber}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                        Local
                      </span>
                      <span className="text-sm font-bold text-amber-400">
                        {selectedOrder.table ? (selectedOrder.table.name || `Mesa ${selectedOrder.table.number}`) : 'Balcão / Direto'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/80">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Data & Hora</span>
                      <span className="text-slate-300 font-medium">
                        {selectedOrder.closedAt ? new Date(selectedOrder.closedAt).toLocaleString('pt-BR') : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Atendente</span>
                      <span className="text-slate-300 font-medium">
                        {selectedOrder.waiterName || 'Garçom'}
                      </span>
                    </div>
                  </div>

                  {selectedOrder.customerName && (
                    <div className="text-xs pt-2 border-t border-slate-800/80">
                      <span className="text-slate-500 block text-[10px]">Cliente Identificado</span>
                      <span className="text-slate-300 font-medium">{selectedOrder.customerName}</span>
                    </div>
                  )}
                </div>

                {/* Itens Consumidos */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                    <span>Itens Consumidos ({selectedOrder.items?.length || 0})</span>
                    <span className="text-[10px] text-slate-500">Qtd / Unit / Total</span>
                  </h4>

                  <div className="bg-slate-950/60 rounded-2xl border border-slate-800 divide-y divide-slate-800/50 overflow-hidden">
                    {selectedOrder.items?.map((item, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between text-xs">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="font-bold text-white truncate">
                            {item.product?.name || 'Produto'}
                          </div>
                          {item.notes && (
                            <div className="text-[10px] text-amber-400/80 italic">
                              Obs: {item.notes}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-500 font-mono">
                            {item.quantity}x R$ {item.unitPrice.toFixed(2)}
                          </div>
                        </div>

                        <span className="font-mono font-bold text-slate-200">
                          R$ {item.totalPrice.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resumo Financeiro da Comanda */}
                <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal dos Itens:</span>
                    <span className="font-mono text-slate-200">R$ {(selectedOrder.subtotal || 0).toFixed(2)}</span>
                  </div>

                  {selectedOrder.isServiceFeeActive && (
                    <div className="flex justify-between text-amber-400">
                      <span>Taxa de Serviço (10% Garçom):</span>
                      <span className="font-mono">+ R$ {(selectedOrder.serviceFee || 0).toFixed(2)}</span>
                    </div>
                  )}

                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-rose-400 font-bold">
                      <span>Desconto Concedido:</span>
                      <span className="font-mono">- R$ {selectedOrder.discount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between pt-2 border-t border-slate-800 text-sm font-black">
                    <span className="text-white uppercase">Total Final:</span>
                    <span className="text-emerald-400 font-mono text-base">
                      R$ {(selectedOrder.total || 0).toFixed(2)}
                    </span>
                  </div>

                  {/* Formas de Pagamento Registradas */}
                  {selectedOrder.payments && selectedOrder.payments.length > 0 && (
                    <div className="pt-3 border-t border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">
                        Recebimentos Registrados:
                      </span>
                      {selectedOrder.payments.map((p, pIdx) => (
                        <div key={pIdx} className="flex justify-between text-[11px] text-slate-400">
                          <span>• {p.method}:</span>
                          <span className="font-mono font-bold text-slate-300">
                            R$ {p.amount.toFixed(2)} {p.notes ? `(${p.notes})` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Botão de Reimpressão de Cupom (2ª Via) */}
                <button
                  onClick={handlePrintReceipt}
                  className="w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer shadow active:scale-95"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  Imprimir 2ª Via do Cupom
                </button>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs p-8 text-center">
                <FileText className="w-10 h-10 mb-2 stroke-[1.5]" />
                Selecione uma comanda à esquerda para visualizar todos os itens e valores consumidos.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recibo térmico isolado para impressão física */}
      {selectedOrder && (
        <div className="hidden print:block fixed inset-0 z-50 bg-white p-2">
          <ThermalReceipt order={selectedOrder} />
        </div>
      )}
    </div>
  );
};
