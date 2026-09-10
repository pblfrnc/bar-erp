import React, { useState, useEffect, useMemo } from 'react';
import { OrderItem, KdsStatus, KdsStation } from '../types';
import { api } from '../services/api';
import { ServerConfigModal } from '../components/ServerConfigModal';
import {
  ChefHat,
  Beer,
  Clock,
  CheckCircle2,
  Hourglass,
  Flame,
  CheckCheck,
  RefreshCw,
  Volume2,
  Wifi,
  WifiOff,
  QrCode
} from 'lucide-react';

interface KdsViewProps {
  onRefreshKdsBadge: () => void;
  isConnected?: boolean;
}

export const KdsView: React.FC<KdsViewProps> = ({ onRefreshKdsBadge, isConnected = true }) => {
  const [station, setStation] = useState<string>('ALL'); // 'ALL' | 'BAR' | 'KITCHEN'
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isServerConfigOpen, setIsServerConfigOpen] = useState(false);

  const loadKds = async () => {
    try {
      setLoading(true);
      const data = await api.getKdsItems(station);
      setItems(data);
      onRefreshKdsBadge();
    } catch (err) {
      console.error('Erro ao carregar KDS:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKds();
    const interval = setInterval(loadKds, 15000); // polling de contingência a cada 15s
    return () => clearInterval(interval);
  }, [station]);

  // Atualizar status individual
  const handleUpdateStatus = async (itemId: string, nextStatus: KdsStatus) => {
    try {
      await api.updateKdsItemStatus(itemId, nextStatus);
      loadKds();
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar status');
    }
  };

  // Marcar todos do ticket como prontos
  const handleMarkAllReady = async (orderId: string) => {
    try {
      const stationParam = station === 'ALL' ? undefined : station;
      await api.markAllReady(orderId, stationParam);
      loadKds();
    } catch (err: any) {
      alert(err.message || 'Erro ao marcar todos como prontos');
    }
  };

  // Agrupar itens por Comanda/Mesa
  const tickets = useMemo(() => {
    const grouped: Record<string, { order: any; items: OrderItem[]; oldestAddedAt: Date }> = {};

    items.forEach((it) => {
      const ord = (it as any).order;
      const orderId = it.orderId;
      if (!grouped[orderId]) {
        grouped[orderId] = {
          order: ord,
          items: [],
          oldestAddedAt: new Date(it.addedAt)
        };
      }
      grouped[orderId].items.push(it);
      const itemDate = new Date(it.addedAt);
      if (itemDate < grouped[orderId].oldestAddedAt) {
        grouped[orderId].oldestAddedAt = itemDate;
      }
    });

    // Ordenar tickets pelo mais antigo primeiro (FIFO)
    return Object.values(grouped).sort(
      (a, b) => a.oldestAddedAt.getTime() - b.oldestAddedAt.getTime()
    );
  }, [items]);

  // Cálculo de tempo de espera
  const getWaitMinutes = (date: Date) => {
    const diffMs = Date.now() - date.getTime();
    return Math.floor(diffMs / 60000);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Barra Superior do KDS com Filtros de Estação */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <ChefHat className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              KDS • Fila de Produção
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950 font-mono">
                {items.length} pedidos
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Atualização em tempo real para equipe de Bar e Cozinha
            </p>
          </div>
        </div>

        {/* Seletor de Estação: Todos, Bar, Cozinha */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setStation('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                station === 'ALL'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Todas as Estações
            </button>
            <button
              onClick={() => setStation('BAR')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                station === 'BAR'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Beer className="w-3.5 h-3.5" />
              Barman / Bebidas
            </button>
            <button
              onClick={() => setStation('KITCHEN')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                station === 'KITCHEN'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ChefHat className="w-3.5 h-3.5" />
              Cozinha / Petiscos
            </button>
          </div>

          {/* Status Wi-Fi / Configuração de Servidor & QR Code */}
          <button
            onClick={() => setIsServerConfigOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer shadow-xs ${
              isConnected
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                : 'bg-red-50 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700 animate-pulse hover:bg-red-100 dark:hover:bg-red-900/80'
            }`}
            title="Clique para escanear QR Code do Caixa ou configurar IP do servidor"
          >
            {isConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="hidden md:inline text-[11px]">Wi-Fi OK</span>
                <QrCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 opacity-70" />
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-red-500" />
                <span className="text-[11px] font-extrabold">Conectar (QR/IP)</span>
              </>
            )}
          </button>

          <button
            onClick={loadKds}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
            title="Recarregar KDS"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grade de Comandas / Tickets de Produção */}
      {tickets.length === 0 ? (
        <div className="text-center py-20 bg-white/60 dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800/60 shadow-xs">
          <CheckCircle2 className="w-16 h-16 stroke-[1.5] text-emerald-500/80 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Tudo limpo! Sem pedidos na fila</h3>
          <p className="text-xs text-slate-500 mt-1">
            Novos pedidos lançados pelos garçons aparecerão aqui instantaneamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tickets.map((ticket) => {
            const waitMins = getWaitMinutes(ticket.oldestAddedAt);
            const isAlert = waitMins >= 15;
            const isWarning = waitMins >= 8 && waitMins < 15;

            let timerBadge = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
            if (isAlert) timerBadge = 'bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/40 animate-pulse font-black';
            else if (isWarning) timerBadge = 'bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-500/40 font-bold';

            return (
              <div
                key={ticket.order.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col justify-between overflow-hidden shadow-sm dark:shadow-xl"
              >
                {/* Cabeçalho do Ticket */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-lg font-black text-slate-900 dark:text-white">
                        {ticket.order.table?.name || `Mesa ${ticket.order.table?.number || 'Balcão'}`}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block">
                        CMD #{ticket.order.orderNumber} • {ticket.order.customerName || 'Sem nome'}
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs border font-mono ${timerBadge}`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {waitMins} min
                    </span>
                  </div>
                </div>

                {/* Itens do Ticket */}
                <div className="p-3.5 flex-1 space-y-2.5 overflow-y-auto max-h-96">
                  {ticket.items.map((item) => {
                    const isPending = item.kdsStatus === 'PENDING';
                    const isPreparing = item.kdsStatus === 'PREPARING';
                    const isReady = item.kdsStatus === 'READY';

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-2xl border transition ${
                          isReady
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                            : isPreparing
                            ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/40 ring-1 ring-orange-400/30 dark:ring-orange-500/30'
                            : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <span className="text-base font-black text-amber-600 dark:text-amber-400 font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                              {item.quantity}x
                            </span>
                            <div>
                              <div className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                                {item.product?.name}
                              </div>
                              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                {item.kdsStation === 'BAR' ? '🍺 Bar' : '🍳 Cozinha'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Observações com destaque */}
                        {item.notes && (
                          <div className="mt-2 p-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-xs font-bold text-amber-800 dark:text-amber-300">
                            ⚠️ Obs: {item.notes}
                          </div>
                        )}

                        {/* Botões de Ação do Item */}
                        <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center gap-1.5">
                          {isPending && (
                            <button
                              onClick={() => handleUpdateStatus(item.id, 'PREPARING')}
                              className="flex-1 py-1.5 px-2 rounded-xl text-xs font-bold bg-orange-50 hover:bg-orange-500 text-orange-700 hover:text-white dark:bg-orange-600/20 dark:hover:bg-orange-500 dark:text-orange-400 dark:hover:text-slate-950 border border-orange-200 dark:border-orange-500/30 transition flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Flame className="w-3.5 h-3.5" />
                              Iniciar Preparo
                            </button>
                          )}

                          {isPreparing && (
                            <button
                              onClick={() => handleUpdateStatus(item.id, 'READY')}
                              className="flex-1 py-1.5 px-2 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition flex items-center justify-center gap-1 shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Marcar Pronto!
                            </button>
                          )}

                          {isReady && (
                            <button
                              onClick={() => handleUpdateStatus(item.id, 'DELIVERED')}
                              className="flex-1 py-1.5 px-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              Marcar Entregue
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Rodapé do Ticket: Botão Todos Prontos */}
                <div className="p-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => handleMarkAllReady(ticket.order.id)}
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-100 hover:bg-emerald-600 text-slate-800 hover:text-white dark:bg-slate-800 dark:hover:bg-emerald-600 dark:text-slate-200 dark:hover:text-slate-950 border border-slate-200 dark:border-slate-700 transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-xs"
                  >
                    <CheckCheck className="w-4 h-4" />
                    Tudo Pronto nesta Mesa
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Configuração de Servidor com QR Code Scanner */}
      <ServerConfigModal
        isOpen={isServerConfigOpen}
        onClose={() => setIsServerConfigOpen(false)}
        isConnected={isConnected}
      />
    </div>
  );
};
