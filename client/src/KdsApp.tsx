import { useState, useEffect, useRef } from 'react';
import { KdsItem } from './types';
import { api } from './services/api';
import { socket } from './services/socket';
import { KitchenTicketReceipt, KitchenTicketData } from './components/KitchenTicketReceipt';
import { playKitchenChime } from './utils/sound';
import {
  ChefHat,
  Volume2,
  VolumeX,
  Printer,
  Clock,
  CheckCircle2,
  Flame,
  Utensils,
  RefreshCw,
  Wine,
  Maximize2,
  Minimize2,
  LayoutDashboard
} from 'lucide-react';

export function KdsApp() {
  const [items, setItems] = useState<KdsItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [stationFilter, setStationFilter] = useState<'ALL' | 'KITCHEN' | 'BAR'>('ALL');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Configurações de Cozinha com persistência
  const [autoPrint, setAutoPrint] = useState<boolean>(() => {
    return localStorage.getItem('bar_kds_autoprint') === 'true';
  });
  const [soundAlert, setSoundAlert] = useState<boolean>(() => {
    return localStorage.getItem('bar_kds_sound') !== 'false';
  });

  // Ticket atual para impressão térmica
  const [printTicket, setPrintTicket] = useState<KitchenTicketData | null>(null);
  const printTimeoutRef = useRef<any>(null);

  const toggleAutoPrint = () => {
    const next = !autoPrint;
    setAutoPrint(next);
    localStorage.setItem('bar_kds_autoprint', String(next));
  };

  const toggleSound = () => {
    const next = !soundAlert;
    setSoundAlert(next);
    localStorage.setItem('bar_kds_sound', String(next));
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const loadKdsItems = async () => {
    try {
      setLoading(true);
      const data = await api.getKdsItems(stationFilter);
      setItems(data);
    } catch (err) {
      console.error('Erro ao buscar itens KDS:', err);
    } finally {
      setLoading(false);
    }
  };

  // Disparar impressão de ticket de comanda
  const triggerTicketPrint = (ticket: KitchenTicketData) => {
    setPrintTicket(ticket);
    if (printTimeoutRef.current) clearTimeout(printTimeoutRef.current);
    printTimeoutRef.current = setTimeout(() => {
      if ((window as any).electronAPI && (window as any).electronAPI.printSilent) { (window as any).electronAPI.printSilent(); } else { window.print(); }
    }, 200);
  };

  useEffect(() => {
    loadKdsItems();

    // Novo pedido recebido via Socket.IO
    const onNewOrder = (payload: any) => {
      loadKdsItems();

      // Alerta sonoro de campainha de cozinha
      if (soundAlert) {
        playKitchenChime();
      }

      // Auto-impressão de comanda térmica
      if (autoPrint && payload.items && payload.items.length > 0) {
        triggerTicketPrint({
          orderNumber: payload.orderNumber,
          tableName: payload.tableName || `Mesa`,
          waiterName: payload.waiterName || 'Garçom',
          station: 'COZINHA',
          items: payload.items
        });
      }
    };

    const onItemUpdated = () => {
      loadKdsItems();
    };

    socket.on('kds:new_order', onNewOrder);
    socket.on('kds:item_updated', onItemUpdated);
    socket.on('kds:batch_updated', onItemUpdated);

    return () => {
      socket.off('kds:new_order', onNewOrder);
      socket.off('kds:item_updated', onItemUpdated);
      socket.off('kds:batch_updated', onItemUpdated);
      if (printTimeoutRef.current) clearTimeout(printTimeoutRef.current);
    };
  }, [soundAlert, autoPrint, stationFilter]);

  // Ações de status
  const handleUpdateStatus = async (itemId: string, newStatus: 'PENDING' | 'PREPARING' | 'READY') => {
    try {
      await api.updateKdsItemStatus(itemId, newStatus);
      loadKdsItems();
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar item');
    }
  };

  const handleBatchStatus = async (orderId: string, newStatus: 'PREPARING' | 'READY') => {
    try {
      await api.batchUpdateKdsStatus(orderId, newStatus);
      loadKdsItems();
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar comanda');
    }
  };

  // Agrupar itens por pedido/comanda
  const ordersGrouped: Record<string, { orderNumber: number; tableName: string; createdAt: string; items: KdsItem[] }> = {};
  items.forEach((item) => {
    if (!ordersGrouped[item.orderId]) {
      ordersGrouped[item.orderId] = {
        orderNumber: item.order.orderNumber,
        tableName: item.order.table ? (item.order.table.name || `Mesa ${item.order.table.number}`) : 'Balcão',
        createdAt: item.addedAt,
        items: []
      };
    }
    ordersGrouped[item.orderId].items.push(item);
  });

  const getElapsedTime = (dateString: string) => {
    const diff = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 60000);
    return `${diff} min`;
  };

  const getUrgencyColor = (dateString: string) => {
    const diff = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 60000);
    if (diff >= 25) return 'border-rose-500 bg-rose-950/20 text-rose-400';
    if (diff >= 15) return 'border-amber-500 bg-amber-950/20 text-amber-400';
    return 'border-slate-800 bg-slate-900/60 text-slate-300';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none">
      {/* Ticket de Impressão Térmica (visível na impressora) */}
      <KitchenTicketReceipt ticket={printTicket} />

      {/* Cabeçalho da Cozinha / KDS */}
      <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-600/20 text-white">
              <ChefHat className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-white tracking-tight leading-none">BarERP Cozinha</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-orange-500 text-slate-950 uppercase tracking-wide">
                  KDS Produção
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {items.length} {items.length === 1 ? 'item pendente' : 'itens em produção'}
              </p>
            </div>
          </div>

          {/* Controles: Estação, Som, Auto-Impressão, Fullscreen */}
          <div className="flex items-center gap-2">
            {/* Filtro de Estação */}
            <div className="hidden sm:flex items-center bg-slate-950 rounded-xl p-1 border border-slate-800">
              <button
                onClick={() => setStationFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  stationFilter === 'ALL' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setStationFilter('KITCHEN')}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                  stationFilter === 'KITCHEN' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>Cozinha</span>
              </button>
              <button
                onClick={() => setStationFilter('BAR')}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                  stationFilter === 'BAR' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Wine className="w-3.5 h-3.5" />
                <span>Bar</span>
              </button>
            </div>

            {/* Toggle Alerta Sonoro */}
            <button
              onClick={toggleSound}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition active:scale-95 ${
                soundAlert
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                  : 'bg-slate-800 text-slate-500 border-slate-700'
              }`}
              title={soundAlert ? 'Som ativado quando chegar pedido' : 'Som desativado'}
            >
              {soundAlert ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden md:inline">{soundAlert ? 'Som Ligado' : 'Som Mudo'}</span>
            </button>

            {/* Toggle Auto-Impressão Térmica */}
            <button
              onClick={toggleAutoPrint}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition active:scale-95 ${
                autoPrint
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title={autoPrint ? 'Auto-impressão de pedidos ligada' : 'Auto-impressão desligada'}
            >
              <Printer className="w-4 h-4" />
              <span className="hidden md:inline">{autoPrint ? 'Auto-Imprimir: ON' : 'Auto-Imprimir: OFF'}</span>
            </button>

            {/* Atualizar */}
            <button
              onClick={loadKdsItems}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition border border-slate-700"
              title="Atualizar KDS"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            {/* Tela Cheia */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition border border-slate-700"
              title={isFullscreen ? 'Sair da tela cheia' : 'Modo Monitor de Cozinha'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Voltar ao Painel Administrativo */}
            <button
              onClick={() => {
                localStorage.setItem('bar_app_mode', 'admin');
                window.location.href = '/';
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 hover:text-white border border-orange-500/30 transition active:scale-95"
              title="Voltar ao Painel Administrativo / Caixa"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden md:inline">Painel Admin</span>
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal do KDS */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6">
        {Object.keys(ordersGrouped).length === 0 ? (
          <div className="py-24 text-center bg-slate-900/40 rounded-3xl border border-slate-800 flex flex-col items-center justify-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-500/80 mb-3" />
            <h3 className="text-xl font-black text-white">Todos os pedidos foram atendidos!</h3>
            <p className="text-slate-400 text-sm mt-1">A cozinha e o bar estão com todas as comandas zeradas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Object.entries(ordersGrouped).map(([orderId, orderGroup]) => {
              const urgencyClasses = getUrgencyColor(orderGroup.createdAt);
              const elapsed = getElapsedTime(orderGroup.createdAt);

              return (
                <div
                  key={orderId}
                  className={`border rounded-2xl p-4 flex flex-col justify-between shadow-lg transition duration-150 ${urgencyClasses}`}
                >
                  <div>
                    {/* Topo do Card de Comanda */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div>
                        <span className="text-xs font-black text-amber-400 uppercase tracking-wide">
                          Comanda #{orderGroup.orderNumber}
                        </span>
                        <h4 className="text-lg font-black text-white leading-tight">
                          {orderGroup.tableName}
                        </h4>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-slate-950/40 border border-slate-800">
                          <Clock className="w-3 h-3" />
                          {elapsed}
                        </span>
                        <button
                          onClick={() =>
                            triggerTicketPrint({
                              orderNumber: orderGroup.orderNumber,
                              tableName: orderGroup.tableName,
                              station: 'COZINHA',
                              items: orderGroup.items.map((i) => ({
                                id: i.id,
                                name: i.product.name,
                                quantity: i.quantity,
                                notes: i.notes
                              }))
                            })
                          }
                          className="mt-1 flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-amber-400 transition"
                          title="Reimprimir comanda na impressora térmica"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Reimprimir</span>
                        </button>
                      </div>
                    </div>

                    {/* Lista de Itens do Pedido */}
                    <div className="py-3 space-y-3">
                      {orderGroup.items.map((item) => {
                        const isPreparing = item.kdsStatus === 'PREPARING';
                        const isPending = item.kdsStatus === 'PENDING';

                        return (
                          <div
                            key={item.id}
                            className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 space-y-1.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2">
                                <span className="text-sm font-black px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">
                                  {item.quantity}x
                                </span>
                                <div>
                                  <p className="text-sm font-bold text-white leading-snug">
                                    {item.product.name}
                                  </p>
                                  {item.notes && (
                                    <p className="text-xs font-black text-amber-300 bg-amber-950/40 border-l-2 border-amber-400 px-1.5 py-0.5 mt-1 rounded-r">
                                      OBS: {item.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Botões de Ação por Item */}
                            <div className="flex items-center justify-end gap-1.5 pt-1">
                              {isPending && (
                                <button
                                  onClick={() => handleUpdateStatus(item.id, 'PREPARING')}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/30 transition flex items-center gap-1"
                                >
                                  <Flame className="w-3 h-3" />
                                  <span>Iniciar</span>
                                </button>
                              )}
                              {isPreparing && (
                                <button
                                  onClick={() => handleUpdateStatus(item.id, 'READY')}
                                  className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition flex items-center gap-1 shadow-sm active:scale-95"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                  <span>Pronto</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Ações em Massa da Comanda */}
                  <div className="pt-2 border-t border-slate-800/80 flex gap-2">
                    <button
                      onClick={() => handleBatchStatus(orderId, 'PREPARING')}
                      className="flex-1 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 transition"
                    >
                      Iniciar Todos
                    </button>
                    <button
                      onClick={() => handleBatchStatus(orderId, 'READY')}
                      className="flex-1 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition active:scale-95 shadow-md shadow-emerald-950/20"
                    >
                      Concluir Todos
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default KdsApp;
