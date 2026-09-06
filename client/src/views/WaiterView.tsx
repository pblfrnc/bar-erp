import React, { useState, useMemo, useEffect } from 'react';
import { Table } from '../types';
import { api } from '../services/api';
import { socket } from '../services/socket';
import { playOrderReadyChime } from '../utils/sound';
import { OpenTableModal } from '../components/OpenTableModal';
import { TableDetailsModal } from '../components/TableDetailsModal';
import { AddOrderModal } from '../components/AddOrderModal';
import { CheckoutModal } from '../components/CheckoutModal';
import { TransferModal } from '../components/TransferModal';
import { MergeModal } from '../components/MergeModal';
import { ServerConfigModal } from '../components/ServerConfigModal';
import {
  Beer,
  Search,
  Plus,
  ReceiptText,
  DollarSign,
  Merge,
  Users,
  Clock,
  Wifi,
  WifiOff,
  UserCheck,
  RefreshCw,
  LayoutDashboard,
  Bell,
  BellRing,
  CheckCircle2,
  X,
  Utensils
} from 'lucide-react';

interface WaiterViewProps {
  tables: Table[];
  onRefresh: () => void;
  loading: boolean;
  isConnected: boolean;
  fontScale: 'normal' | 'large' | 'xlarge';
  onChangeFontScale: (scale: 'normal' | 'large' | 'xlarge') => void;
  onSwitchToAdmin?: () => void;
}

export const WaiterView: React.FC<WaiterViewProps> = ({
  tables,
  onRefresh,
  loading,
  isConnected,
  fontScale,
  onChangeFontScale,
  onSwitchToAdmin
}) => {
  // Nome do garçom com persistência
  const [waiterName, setWaiterName] = useState<string>(() => {
    return localStorage.getItem('bar_waiter_name') || 'Garçom';
  });
  const [isEditingWaiter, setIsEditingWaiter] = useState(false);

  // Filtros rápidos
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'OCCUPIED' | 'CLOSING' | 'AVAILABLE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modais de Atendimento
  const [tableToOpen, setTableToOpen] = useState<Table | null>(null);
  const [tableForOrder, setTableForOrder] = useState<Table | null>(null);
  const [tableDetails, setTableDetails] = useState<Table | null>(null);
  const [tableForCheckout, setTableForCheckout] = useState<Table | null>(null);
  const [tableForTransfer, setTableForTransfer] = useState<Table | null>(null);
  const [tableForMerge, setTableForMerge] = useState<Table | null>(null);
  const [isServerConfigOpen, setIsServerConfigOpen] = useState(false);

  // Notificações de Pedidos Prontos na Cozinha / Bar
  interface ReadyNotification {
    id: string;
    orderId: string;
    orderNumber: number;
    tableName: string;
    waiterName?: string;
    station?: string;
    items: { name: string; quantity: number; notes?: string | null }[];
    readyAt: string;
  }

  const [readyNotifications, setReadyNotifications] = useState<ReadyNotification[]>([]);
  const [showReadyModal, setShowReadyModal] = useState(false);
  const [activeToast, setActiveToast] = useState<ReadyNotification | null>(null);

  // Escutar avisos de pratos/bebidas prontos vindos da cozinha em tempo real
  useEffect(() => {
    const handleOrderReady = (payload: any) => {
      playOrderReadyChime();
      const notif: ReadyNotification = {
        id: `${payload.orderId}-${Date.now()}`,
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        tableName: payload.tableName || `Mesa ${payload.tableNumber || ''}`,
        waiterName: payload.waiterName,
        station: payload.station,
        items: payload.items || [],
        readyAt: payload.readyAt || new Date().toISOString()
      };
      setReadyNotifications((prev) => [notif, ...prev]);
      setActiveToast(notif);
      onRefresh();
    };

    const handleItemReady = (payload: any) => {
      playOrderReadyChime();
      const notif: ReadyNotification = {
        id: `${payload.itemId}-${Date.now()}`,
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        tableName: payload.tableName || `Mesa ${payload.tableNumber || ''}`,
        waiterName: payload.waiterName,
        station: payload.station,
        items: [
          {
            name: payload.productName,
            quantity: payload.quantity,
            notes: payload.notes
          }
        ],
        readyAt: payload.readyAt || new Date().toISOString()
      };
      setReadyNotifications((prev) => [notif, ...prev]);
      setActiveToast(notif);
      onRefresh();
    };

    socket.on('kds:order_ready', handleOrderReady);
    socket.on('kds:item_ready', handleItemReady);

    return () => {
      socket.off('kds:order_ready', handleOrderReady);
      socket.off('kds:item_ready', handleItemReady);
    };
  }, [onRefresh]);

  // Se o aplicativo Android estiver desconectado por mais de 1.2s ou sem IP salvo, abre a tela de IP automaticamente
  useEffect(() => {
    const hasConfiguredUrl = Boolean(localStorage.getItem('bar_server_url'));
    const isMobileDevice = window.innerWidth <= 800 || (window as any).Capacitor?.isNativePlatform?.();
    const timer = setTimeout(() => {
      if (!isConnected && (!hasConfiguredUrl || isMobileDevice)) {
        setIsServerConfigOpen(true);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [isConnected]);

  const handleSaveWaiterName = (name: string) => {
    const trimmed = name.trim() || 'Garçom';
    setWaiterName(trimmed);
    localStorage.setItem('bar_waiter_name', trimmed);
    setIsEditingWaiter(false);
  };

  const cycleFontScale = () => {
    if (fontScale === 'normal') onChangeFontScale('large');
    else if (fontScale === 'large') onChangeFontScale('xlarge');
    else onChangeFontScale('normal');
  };

  const handleAdminSwitch = () => {
    if (onSwitchToAdmin) {
      onSwitchToAdmin();
    } else {
      localStorage.setItem('bar_app_mode', 'admin');
      if (window.location.pathname.startsWith('/garcom') || window.location.pathname.startsWith('/waiter')) {
        window.location.href = '/';
      } else {
        window.location.reload();
      }
    }
  };

  const [selectedSection, setSelectedSection] = useState<string>('ALL');

  // Seções/locais disponíveis
  const sections = useMemo(() => {
    return Array.from(new Set(tables.map((t) => t.section))).filter(Boolean);
  }, [tables]);

  // Filtragem de mesas
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      const matchStatus = filterStatus === 'ALL' || t.status === filterStatus;
      const matchSection = selectedSection === 'ALL' || t.section === selectedSection;
      const matchSearch =
        searchQuery.trim() === '' ||
        t.number.toString().includes(searchQuery) ||
        (t.name && t.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.customerName && t.customerName.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchStatus && matchSection && matchSearch;
    });
  }, [tables, filterStatus, selectedSection, searchQuery]);

  // Contadores rápidos para o garçom
  const counts = useMemo(() => {
    const occupied = tables.filter((t) => t.status === 'OCCUPIED').length;
    const closing = tables.filter((t) => t.status === 'CLOSING').length;
    const available = tables.filter((t) => t.status === 'AVAILABLE').length;
    return { occupied, closing, available, total: tables.length };
  }, [tables]);

  // Abertura de Mesa pelo Garçom
  const handleOpenTableConfirm = async (data: {
    customerName?: string;
    waiterName?: string;
    customerCount: number;
  }) => {
    if (!tableToOpen) return;
    try {
      await api.openTable(tableToOpen.id, {
        ...data,
        waiterName: data.waiterName || waiterName
      });
      setTableToOpen(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao abrir mesa');
    }
  };

  const [currentTime] = useState<number>(() => Date.now());

  // Tempo decorrido de mesa
  const getElapsedMinutes = (openedAt?: string | null) => {
    if (!openedAt) return null;
    const diffMs = currentTime - new Date(openedAt).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none">
      {/* Alerta Flutuante de Pedido Pronto para Entrega */}
      {activeToast && (
        <div className="fixed top-3 left-3 right-3 z-50 max-w-md mx-auto bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-4 rounded-3xl shadow-2xl border-2 border-emerald-400 flex items-start gap-3 animate-in fade-in slide-in-from-top duration-300">
          <div className="p-2.5 bg-emerald-800/90 rounded-2xl text-white shadow-inner flex items-center justify-center shrink-0">
            <BellRing className="w-6 h-6 animate-pulse text-amber-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-black text-[10px] uppercase tracking-wider bg-emerald-950/70 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-400/40">
                🔔 Pedido Pronto!
              </span>
              <button
                onClick={() => setActiveToast(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <h4 className="font-black text-base mt-1 text-white leading-tight">
              {activeToast.tableName} {activeToast.orderNumber ? `• Comanda #${activeToast.orderNumber}` : ''}
            </h4>
            <div className="mt-1 space-y-0.5 text-xs text-emerald-100 font-medium max-h-24 overflow-y-auto">
              {activeToast.items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="font-black text-amber-300">{it.quantity}x</span>
                  <span>{it.name}</span>
                  {it.notes && <span className="text-[10px] text-emerald-200 italic">({it.notes})</span>}
                </div>
              ))}
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={() => {
                  setReadyNotifications((prev) => prev.filter((n) => n.id !== activeToast.id));
                  setActiveToast(null);
                }}
                className="flex-1 py-1.5 px-3 bg-white hover:bg-emerald-50 text-emerald-950 rounded-xl text-xs font-black shadow-md transition active:scale-95 cursor-pointer text-center"
              >
                Entregar à Mesa
              </button>
              <button
                onClick={() => {
                  setShowReadyModal(true);
                  setActiveToast(null);
                }}
                className="py-1.5 px-2.5 bg-emerald-800/80 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
              >
                Ver Todos
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* CABEÇALHO DEDICADO DO GARÇOM (COMPACTO, LIMPO E SEM ITENS ADMINISTRATIVOS) */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-3 py-2.5 flex items-center justify-between gap-2">
          {/* Identificação do Garçom */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black">
              <Beer className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-white text-base tracking-tight">BarERP</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500 text-slate-950 uppercase tracking-wide">
                  Garçom
                </span>
              </div>
              {isEditingWaiter ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="text"
                    defaultValue={waiterName}
                    autoFocus
                    onBlur={(e) => handleSaveWaiterName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveWaiterName((e.target as HTMLInputElement).value);
                    }}
                    className="bg-slate-800 text-amber-300 text-xs px-2 py-0.5 rounded border border-amber-500/50 outline-none w-28 font-bold"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingWaiter(true)}
                  className="flex items-center gap-1 text-xs text-slate-300 hover:text-amber-400 font-semibold transition"
                  title="Clique para alterar o nome do garçom"
                >
                  <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>{waiterName}</span>
                  <span className="text-[10px] text-slate-500 underline ml-0.5">mudar</span>
                </button>
              )}
            </div>
          </div>

          {/* Status Wi-Fi, Acessibilidade e Alternador de Painel */}
          <div className="flex items-center gap-2">
            {/* Botão de Pedidos Prontos para Entrega na Cozinha */}
            {readyNotifications.length > 0 && (
              <button
                onClick={() => setShowReadyModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 animate-bounce shadow-lg shadow-emerald-500/30 cursor-pointer"
                title="Ver pedidos prontos para entrega"
              >
                <BellRing className="w-4 h-4 animate-pulse text-slate-950" />
                <span>{readyNotifications.length} Pronto{readyNotifications.length > 1 ? 's' : ''}!</span>
              </button>
            )}

            {/* Status Wi-Fi / Configuração de Servidor */}
            <button
              onClick={() => setIsServerConfigOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer ${
                isConnected
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60 hover:bg-emerald-900/60'
                  : 'bg-red-950/80 text-red-300 border-red-700 animate-pulse hover:bg-red-900/80'
              }`}
              title="Clique para ver ou configurar o IP do servidor do bar"
            >
              {isConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="hidden sm:inline text-[11px]">Wi-Fi OK</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[11px] font-extrabold">Configurar IP</span>
                </>
              )}
            </button>

            {/* Acessibilidade de Fontes A+ */}
            <button
              onClick={cycleFontScale}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition active:scale-95"
              title="Aumentar tamanho da letra (Acessibilidade)"
            >
              <span className="text-sm font-black">A+</span>
              <span className="text-[10px] uppercase font-bold text-slate-300">
                {fontScale === 'normal' ? '1x' : fontScale === 'large' ? '1.25x' : '1.4x'}
              </span>
            </button>

            {/* Alternador para Modo Administrativo / Gestão (apenas se fornecido pelo painel do PC) */}
            {onSwitchToAdmin && (
              <button
                onClick={handleAdminSwitch}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/30 transition active:scale-95 shadow-sm"
                title="Voltar para o Modo Administrativo (Painel / Caixa / Mesas)"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline font-bold">Modo Administrativo</span>
                <span className="sm:hidden font-bold">Admin</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* CONTEÚDO PRINCIPAL DO GARÇOM: CONTROLE COMPLETO DE MESAS E COMANDAS        */}
      {/* ========================================================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 space-y-3 pb-24">
        {/* Barra de Busca e Ações Rápidas de Salão */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 space-y-2.5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Campo de Busca de Mesa */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Digitar número da mesa ou cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs px-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Ações Rápidas de Mesa: Juntar e Atualizar */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const firstOccupied = tables.find((t) => t.status === 'OCCUPIED' || t.status === 'CLOSING');
                  if (!firstOccupied) {
                    alert('Não há mesas ocupadas para juntar.');
                    return;
                  }
                  setTableForMerge(firstOccupied);
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl text-xs font-black bg-purple-600/20 text-purple-300 hover:bg-purple-600 hover:text-white border border-purple-500/30 transition active:scale-95"
                title="Unir comandas de duas mesas"
              >
                <Merge className="w-4 h-4" />
                <span>Juntar Mesas</span>
              </button>

              <button
                onClick={onRefresh}
                className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition active:scale-95 border border-slate-700"
                title="Atualizar mesas"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Chips de Filtro Rápido com Contadores */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 flex items-center gap-1.5 ${
                filterStatus === 'ALL'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>Todas</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/20">{counts.total}</span>
            </button>

            <button
              onClick={() => setFilterStatus('OCCUPIED')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 flex items-center gap-1.5 ${
                filterStatus === 'OCCUPIED'
                  ? 'bg-blue-600 text-white font-black shadow-md shadow-blue-600/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>Ocupadas</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-500/30 text-blue-200">
                {counts.occupied}
              </span>
            </button>

            <button
              onClick={() => setFilterStatus('CLOSING')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 flex items-center gap-1.5 ${
                filterStatus === 'CLOSING'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>Pedindo Conta</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400/30 text-amber-200">
                {counts.closing}
              </span>
            </button>

            <button
              onClick={() => setFilterStatus('AVAILABLE')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 flex items-center gap-1.5 ${
                filterStatus === 'AVAILABLE'
                  ? 'bg-emerald-600 text-white font-black shadow-md shadow-emerald-600/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>Livres</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/30 text-emerald-200">
                {counts.available}
              </span>
            </button>
          </div>

          {/* Chips de Locais / Setores */}
          {sections.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1.5 border-t border-slate-800/60 scrollbar-none">
              <button
                onClick={() => setSelectedSection('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition active:scale-95 ${
                  selectedSection === 'ALL'
                    ? 'bg-amber-400/25 text-amber-300 border border-amber-400/50'
                    : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                Todos os Locais
              </button>
              {sections.map((sec) => (
                <button
                  key={sec}
                  onClick={() => setSelectedSection(sec)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition active:scale-95 ${
                    selectedSection === sec
                      ? 'bg-amber-400/25 text-amber-300 border border-amber-400/50'
                      : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Grade de Mesas do Salão */}
        {filteredTables.length === 0 ? (
          <div className="py-16 text-center bg-slate-900/40 rounded-3xl border border-slate-800/80">
            <Beer className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-base font-bold text-slate-300">Nenhuma mesa encontrada</p>
            <p className="text-xs text-slate-500 mt-1">Altere o filtro ou limpe o campo de busca.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredTables.map((table) => {
              const isAvailable = table.status === 'AVAILABLE';
              const isOccupied = table.status === 'OCCUPIED';
              const isClosing = table.status === 'CLOSING';
              const elapsed = getElapsedMinutes(table.openedAt);
              const orderTotal = table.activeOrder?.total || 0;
              const itemsCount = table.activeOrder?.items?.length || 0;

              let cardBorder = 'border-slate-800 bg-slate-900/60';
              let badgeColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
              let badgeText = 'Livre';

              if (isOccupied) {
                cardBorder = 'border-blue-500/40 bg-blue-950/20 shadow-md shadow-blue-950/20';
                badgeColor = 'bg-blue-500/20 text-blue-400 border-blue-500/40';
                badgeText = 'Ocupada';
              } else if (isClosing) {
                cardBorder = 'border-amber-500/60 bg-amber-950/25 shadow-lg shadow-amber-950/30 ring-1 ring-amber-500/30';
                badgeColor = 'bg-amber-500/25 text-amber-300 border-amber-500/50 animate-pulse';
                badgeText = 'Pedindo Conta';
              }

              return (
                <div
                  key={table.id}
                  className={`rounded-2xl border ${cardBorder} p-3.5 flex flex-col justify-between transition-all select-none`}
                >
                  {/* Topo do Card: Número da mesa e status */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-3xl sm:text-4xl font-black table-number tracking-tight text-white">
                          #{String(table.number).padStart(2, '0')}
                        </span>
                        <div>
                          <span className="text-sm font-bold text-slate-200 block truncate max-w-[120px]">
                            {table.name || `Mesa ${table.number}`}
                          </span>
                          <span className="text-[11px] text-slate-400 block">{table.section}</span>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${badgeColor}`}>
                        {badgeText}
                      </span>
                    </div>

                    {/* Informações Centrais */}
                    {isAvailable ? (
                      <div className="py-5 text-center">
                        <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-slate-800/80 text-emerald-400 mb-1">
                          <Users className="w-5 h-5" />
                        </div>
                        <p className="text-xs text-slate-400">Capacidade: {table.capacity} lugares</p>
                      </div>
                    ) : (
                      <div className="space-y-2 my-2.5">
                        {/* Cliente, Garçom e Tempo */}
                        <div className="flex items-center justify-between text-xs text-slate-300">
                          <span className="font-semibold truncate max-w-[130px]">
                            👤 {table.customerName || 'Sem nome'} ({table.customerCount}p)
                          </span>
                          {elapsed && (
                            <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md font-mono text-[11px]">
                              <Clock className="w-3 h-3 text-amber-400" />
                              {elapsed}
                            </span>
                          )}
                        </div>

                        {/* Valor Consumido */}
                        <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800/80 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                              Consumo ({itemsCount} itens)
                            </span>
                            <span className="text-xl font-black text-emerald-400 tracking-tight">
                              R$ {orderTotal.toFixed(2)}
                            </span>
                          </div>

                          {table.activeOrder?.isServiceFeeActive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">
                              +10%
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ================================================================= */}
                  {/* OS 4 BOTÕES DO GARÇOM: PEDIDO, FECHAR COMANDA, COBRAR E JUNTAR    */}
                  {/* ================================================================= */}
                  <div className="pt-2 border-t border-slate-800/60 mt-2">
                    {isAvailable ? (
                      <button
                        onClick={() => setTableToOpen(table)}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-black bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition active:scale-95 min-h-[48px]"
                      >
                        <Plus className="w-5 h-5" />
                        <span>Abrir Mesa</span>
                      </button>
                    ) : (
                      <div className="space-y-1.5">
                        {/* Linha 1: Tirar Pedido + Ver Comanda / Fechar */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => setTableForOrder(table)}
                            className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-black bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-600/20 transition active:scale-95 min-h-[44px]"
                            title="Lançar novos produtos"
                          >
                            <Plus className="w-4 h-4" />
                            <span>+ Pedido</span>
                          </button>

                          <button
                            onClick={() => setTableDetails(table)}
                            className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white border border-slate-700 transition active:scale-95 min-h-[44px]"
                            title="Ver itens da comanda e pedir fechamento"
                          >
                            <ReceiptText className="w-4 h-4 text-amber-400" />
                            <span>Comanda</span>
                          </button>
                        </div>

                        {/* Linha 2: Cobrar Conta + Ações de Mesa (Juntar/Transferir) */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            onClick={() => setTableForCheckout(table)}
                            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-black border transition active:scale-95 min-h-[44px] ${
                              isClosing
                                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 border-amber-400 shadow-md shadow-amber-500/20'
                                : 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600 hover:text-white border-emerald-500/30'
                            }`}
                            title="Receber pagamento da conta"
                          >
                            <DollarSign className="w-4 h-4" />
                            <span>Cobrar Conta</span>
                          </button>

                          <button
                            onClick={() => setTableForMerge(table)}
                            className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold bg-purple-600/20 text-purple-300 hover:bg-purple-600 hover:text-white border border-purple-500/30 transition active:scale-95 min-h-[44px]"
                            title="Juntar esta mesa com outra"
                          >
                            <Merge className="w-3.5 h-3.5" />
                            <span>Juntar</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAIS DE OPERAÇÃO DO GARÇOM                                              */}
      {/* ========================================================================= */}
      {/* 1. Modal de Abertura de Mesa */}
      {tableToOpen && (
        <OpenTableModal
          table={tableToOpen}
          onClose={() => setTableToOpen(null)}
          onConfirm={handleOpenTableConfirm}
        />
      )}

      {/* 2. Modal de Tirar Pedido */}
      {tableForOrder && (
        <AddOrderModal
          table={tableForOrder}
          onClose={() => setTableForOrder(null)}
          onSuccess={() => {
            onRefresh();
            setTableForOrder(null);
          }}
        />
      )}

      {/* 3. Modal de Detalhes da Comanda / Fechamento */}
      {tableDetails && (
        <TableDetailsModal
          table={tableDetails}
          isManager={false}
          onClose={() => setTableDetails(null)}
          onAddOrder={() => {
            const t = tableDetails;
            setTableDetails(null);
            setTableForOrder(t);
          }}
          onCheckout={() => {
            const t = tableDetails;
            setTableDetails(null);
            setTableForCheckout(t);
          }}
          onTransfer={() => {
            const t = tableDetails;
            setTableDetails(null);
            setTableForTransfer(t);
          }}
          onMerge={() => {
            const t = tableDetails;
            setTableDetails(null);
            setTableForMerge(t);
          }}
          onRefresh={onRefresh}
        />
      )}

      {/* 4. Modal de Cobrança da Conta (Checkout / Pagamentos / Divisão) */}
      {tableForCheckout && (
        <CheckoutModal
          table={tableForCheckout}
          isManager={false}
          onClose={() => setTableForCheckout(null)}
          onSuccess={() => {
            onRefresh();
            setTableForCheckout(null);
          }}
        />
      )}

      {/* 5. Modal de Junção de Mesas */}
      {tableForMerge && (
        <MergeModal
          mainTable={tableForMerge}
          tables={tables}
          onClose={() => setTableForMerge(null)}
          onSuccess={() => {
            onRefresh();
            setTableForMerge(null);
          }}
        />
      )}

      {/* 6. Modal de Transferência de Mesa */}
      {tableForTransfer && (
        <TransferModal
          sourceTable={tableForTransfer}
          tables={tables}
          onClose={() => setTableForTransfer(null)}
          onSuccess={() => {
            onRefresh();
            setTableForTransfer(null);
          }}
        />
      )}

      {/* 7. Modal de Configuração de IP do Servidor (Android Wi-Fi) */}
      <ServerConfigModal
        isOpen={isServerConfigOpen}
        onClose={() => setIsServerConfigOpen(false)}
        isConnected={isConnected}
      />

      {/* 8. Modal com Todos os Pedidos Prontos para Entrega */}
      {showReadyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-5 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <BellRing className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Pedidos Prontos na Cozinha</h3>
                  <p className="text-xs text-slate-400">Itens aguardando entrega aos clientes</p>
                </div>
              </div>
              <button
                onClick={() => setShowReadyModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {readyNotifications.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Nenhum pedido aguardando entrega no momento.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-96 overflow-y-auto">
                {readyNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/30 flex flex-col justify-between gap-2.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-black text-white block">
                          {notif.tableName} {notif.orderNumber ? `• Comanda #${notif.orderNumber}` : ''}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {notif.station ? `${notif.station} • ` : ''}{new Date(notif.readyAt).toLocaleTimeString().slice(0, 5)}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        Pronto
                      </span>
                    </div>

                    <div className="space-y-1 py-1 border-t border-slate-800/80">
                      {notif.items.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-slate-200 font-medium">
                            <strong className="text-amber-400 mr-1">{it.quantity}x</strong> {it.name}
                          </span>
                          {it.notes && (
                            <span className="text-[10px] text-amber-300 italic">Obs: {it.notes}</span>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        setReadyNotifications((prev) => prev.filter((n) => n.id !== notif.id));
                      }}
                      className="w-full py-2 px-3 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-emerald-500/20 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Marcar como Entregue
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
              {readyNotifications.length > 0 && (
                <button
                  onClick={() => setReadyNotifications([])}
                  className="text-xs text-slate-400 hover:text-red-400 underline cursor-pointer"
                >
                  Limpar todos os alertas
                </button>
              )}
              <button
                onClick={() => setShowReadyModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer ml-auto"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
