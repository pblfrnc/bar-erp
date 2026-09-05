import React, { useState, useEffect } from 'react';
import { Table, Order } from './types';
import { api } from './services/api';
import { socket } from './services/socket';
import { Navbar } from './components/Navbar';
import { TablesView } from './views/TablesView';
import { KdsView } from './views/KdsView';
import { CashView } from './views/CashView';
import { ProductsView } from './views/ProductsView';
import { DashboardView } from './views/DashboardView';
import { WaiterView } from './views/WaiterView';
import { ThermalReceipt } from './components/ThermalReceipt';

export function App() {
  // Perfil do App: 'waiter' (Comanda do Garçom no Celular/Tablet) ou 'admin' (Painel do PC)
  const [appMode, setAppMode] = useState<'waiter' | 'admin'>(() => {
    const saved = localStorage.getItem('bar_app_mode');
    if (saved === 'waiter' || saved === 'admin') return saved;
    // Dispositivos móveis, tablets ou Capacitor iniciam no Modo Garçom por padrão
    if (window.innerWidth <= 800 || (window as any).Capacitor?.isNativePlatform?.()) {
      return 'waiter';
    }
    return 'admin';
  });

  const handleSetAppMode = (mode: 'waiter' | 'admin') => {
    setAppMode(mode);
    localStorage.setItem('bar_app_mode', mode);
  };

  const [currentView, setCurrentView] = useState<'tables' | 'kds' | 'cash' | 'products' | 'dashboard'>('tables');
  const [tables, setTables] = useState<Table[]>([]);
  const [loadingTables, setLoadingTables] = useState<boolean>(true);
  const [kdsCount, setKdsCount] = useState<number>(0);
  const [isCashOpen, setIsCashOpen] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);

  // Escala de Acessibilidade para Baixa Visão
  const [fontScale, setFontScale] = useState<'normal' | 'large' | 'xlarge'>(() => {
    return (localStorage.getItem('bar_font_scale') as any) || 'normal';
  });

  const handleFontScaleChange = (scale: 'normal' | 'large' | 'xlarge') => {
    setFontScale(scale);
    localStorage.setItem('bar_font_scale', scale);
    document.documentElement.className = `dark font-scale-${scale}`;
  };

  useEffect(() => {
    document.documentElement.className = `dark font-scale-${fontScale}`;
  }, [fontScale]);

  // Carregar Mesas
  const loadTables = async () => {
    try {
      setLoadingTables(true);
      const data = await api.getTables();
      setTables(data);

      // Se houver mesa selecionada para impressão, atualiza
      if (printOrder) {
        const foundTable = data.find((t) => t.activeOrder?.id === printOrder.id);
        if (foundTable?.activeOrder) {
          setPrintOrder(foundTable.activeOrder);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar mesas:', err);
    } finally {
      setLoadingTables(false);
    }
  };

  // Carregar KDS Count
  const loadKdsCount = async () => {
    try {
      const items = await api.getKdsItems('ALL');
      setKdsCount(items.length);
    } catch (err) {
      console.error('Erro ao contar KDS:', err);
    }
  };

  // Carregar Status do Caixa
  const loadCashStatus = async () => {
    try {
      const res = await api.getCurrentCashShift();
      setIsCashOpen(res.isOpen);
    } catch (err) {
      console.error('Erro ao consultar status do caixa:', err);
    }
  };

  useEffect(() => {
    loadTables();
    loadKdsCount();
    loadCashStatus();

    // Eventos de Conexão WebSocket
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    // Eventos de Atualização em Tempo Real
    const onTableUpdated = () => {
      loadTables();
    };

    const onOrderUpdated = () => {
      loadTables();
      loadKdsCount();
    };

    const onKdsUpdated = () => {
      loadKdsCount();
      loadTables();
    };

    const onCashUpdated = () => {
      loadCashStatus();
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('table:updated', onTableUpdated);
    socket.on('order:updated', onOrderUpdated);
    socket.on('kds:new_order', onKdsUpdated);
    socket.on('kds:item_updated', onKdsUpdated);
    socket.on('kds:batch_updated', onKdsUpdated);
    socket.on('cash:updated', onCashUpdated);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('table:updated', onTableUpdated);
      socket.off('order:updated', onOrderUpdated);
      socket.off('kds:new_order', onKdsUpdated);
      socket.off('kds:item_updated', onKdsUpdated);
      socket.off('kds:batch_updated', onKdsUpdated);
      socket.off('cash:updated', onCashUpdated);
    };
  }, []);

  // Definir primeiro pedido ativo para impressão se houver
  useEffect(() => {
    const tableWithOrder = tables.find((t) => t.activeOrder);
    if (tableWithOrder?.activeOrder) {
      setPrintOrder(tableWithOrder.activeOrder);
    }
  }, [tables]);

  if (appMode === 'waiter') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {/* Componente para Impressão Térmica (visível apenas ao acionar window.print()) */}
        <ThermalReceipt order={printOrder} />

        {/* Interface Exclusiva do Garçom (focada em tirar pedidos, juntar mesas, fechar comandas e cobrar conta) */}
        <WaiterView
          tables={tables}
          onRefresh={loadTables}
          loading={loadingTables}
          isConnected={isConnected}
          fontScale={fontScale}
          onChangeFontScale={handleFontScaleChange}
          onSwitchToAdmin={() => handleSetAppMode('admin')}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Componente para Impressão Térmica (visível apenas ao acionar window.print()) */}
      <ThermalReceipt order={printOrder} />

      {/* Navbar Superior & Mobile Bottom Bar do Painel do PC / Gestão */}
      <Navbar
        currentView={currentView}
        onSelectView={setCurrentView}
        kdsCount={kdsCount}
        isCashOpen={isCashOpen}
        isConnected={isConnected}
        fontScale={fontScale}
        onChangeFontScale={handleFontScaleChange}
        onSwitchToWaiter={() => handleSetAppMode('waiter')}
      />

      {/* Conteúdo da View Ativa no Painel do PC */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6">
        {currentView === 'tables' && (
          <TablesView
            tables={tables}
            onRefresh={loadTables}
            loading={loadingTables}
          />
        )}

        {currentView === 'kds' && (
          <KdsView onRefreshKdsBadge={loadKdsCount} />
        )}

        {currentView === 'cash' && (
          <CashView onRefreshStatus={loadCashStatus} />
        )}

        {currentView === 'products' && (
          <ProductsView />
        )}

        {currentView === 'dashboard' && (
          <DashboardView />
        )}
      </main>
    </div>
  );
}

export default App;
