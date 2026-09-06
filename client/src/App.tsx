import { LicenseModal } from './components/LicenseModal';
import React, { useState, useEffect } from 'react';
import { Table, Order } from './types';
import { api } from './services/api';
import { socket, getServerBaseUrl } from './services/socket';
import { Navbar } from './components/Navbar';
import { TablesView } from './views/TablesView';
import { KdsView } from './views/KdsView';
import { CashView } from './views/CashView';
import { ProductsView } from './views/ProductsView';
import { DashboardView } from './views/DashboardView';
import { AuditView } from './views/AuditView';
import { SettingsView } from './views/SettingsView';
import { FiscalHubView } from './views/FiscalHubView';
import { FiscalSettingsView } from './views/FiscalSettingsView';
import { ManualNfceView } from './views/ManualNfceView';
import { CustomersView } from './views/CustomersView';



import { WaiterView } from './views/WaiterView';
import { ThermalReceipt } from './components/ThermalReceipt';
import { KitchenTicketReceipt, KitchenTicketData } from './components/KitchenTicketReceipt';
import { ManageWaitersModal } from './components/ManageWaitersModal';
import { ConnectMobileModal } from './components/ConnectMobileModal';
import { playKitchenChime } from './utils/sound';

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
    if (mode === 'admin' && (window.location.pathname.startsWith('/garcom') || window.location.pathname.startsWith('/waiter'))) {
      window.history.pushState(null, '', '/');
    }
  };

  // Gerenciamento de Garçons no Modal
  const [showWaitersModal, setShowWaitersModal] = useState<boolean>(false);

  // Modal para conectar celulares/tablets na rede local
  const [showConnectMobileModal, setShowConnectMobileModal] = useState<boolean>(false);

  const [currentView, setCurrentView] = useState<'tables' | 'kds' | 'cash' | 'products' | 'dashboard' | 'audit' | 'settings' | 'customers' | 'fiscal' | 'fiscalSettings' | 'manualNfce'>('tables');
  const [tables, setTables] = useState<Table[]>([]);
  const [loadingTables, setLoadingTables] = useState<boolean>(true);
  const [kdsCount, setKdsCount] = useState<number>(0);
  const [isCashOpen, setIsCashOpen] = useState<boolean>(false);
  const [isLicensed, setIsLicensed] = useState<boolean | null>(null);
  const [machineId, setMachineId] = useState<string>("");

  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);

  // Auto-impressão de pedidos da cozinha no computador
  const [autoPrintKitchen, setAutoPrintKitchen] = useState<boolean>(() => {
    return localStorage.getItem('bar_autoprint_kitchen') === 'true';
  });
  const autoPrintKitchenRef = React.useRef(autoPrintKitchen);
  useEffect(() => {
    autoPrintKitchenRef.current = autoPrintKitchen;
  }, [autoPrintKitchen]);

  const handleToggleAutoPrintKitchen = () => {
    setAutoPrintKitchen((prev) => {
      const next = !prev;
      localStorage.setItem('bar_autoprint_kitchen', String(next));
      return next;
    });
  };

  // Estado da comanda de produção da cozinha para impressão
  const [kitchenTicket, setKitchenTicket] = useState<KitchenTicketData | null>(null);
  const [activePrintType, setActivePrintType] = useState<'bill' | 'kitchen' | null>(null);

  useEffect(() => {
    const handleAfterPrint = () => {
      setActivePrintType(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  // Tema: Light ou Dark
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('bar_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  });

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('bar_theme', next);
      return next;
    });
  };

  // Escala de Acessibilidade para Baixa Visão
  const [fontScale, setFontScale] = useState<'normal' | 'large' | 'xlarge'>(() => {
    return (localStorage.getItem('bar_font_scale') as any) || 'normal';
  });

  const handleFontScaleChange = (scale: 'normal' | 'large' | 'xlarge') => {
    setFontScale(scale);
    localStorage.setItem('bar_font_scale', scale);
  };

  useEffect(() => {
    document.documentElement.className = `${theme} font-scale-${fontScale}`;
  }, [theme, fontScale]);

  // Carregar Mesas
  // Carregar Configurações (Licença)
  const loadSettings = async () => {
    try {
      const res = await fetch(`${getServerBaseUrl()}/api/settings`);
      const data = await res.json();
      setMachineId(data.machineId || "");
      setIsLicensed(data.isLicensed);
    } catch (err) {
      console.error("Erro ao verificar licença:", err);
      // Em modo offline restrito de rede local, vamos tolerar se falhar e tentar novamente
    }
  };

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
    loadSettings();

    loadTables();
    loadKdsCount();
    loadCashStatus();

    // Eventos de Conexão WebSocket
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    // Eventos de Atualização em Tempo Real
    const onTableUpdated = () => {
    loadSettings();

      loadTables();
    };

    const onOrderUpdated = () => {
    loadSettings();

      loadTables();
      loadKdsCount();
    };

    const onKdsUpdated = () => {
      loadKdsCount();
    loadSettings();

      loadTables();
    };

    const onKdsNewOrder = (payload: any) => {
      loadKdsCount();
    loadSettings();

      loadTables();

      // Se auto-impressão de cozinha estiver ativada no computador
      if (autoPrintKitchenRef.current && payload?.items?.length) {
        try {
          playKitchenChime();
        } catch (e) {
          console.warn('Alerta sonoro bloqueado pelo navegador:', e);
        }

        const ticketData: KitchenTicketData = {
          orderNumber: payload.orderNumber || 0,
          tableName: payload.tableName || (payload.tableNumber ? `Mesa ${payload.tableNumber}` : 'Balcão'),
          tableNumber: payload.tableNumber,
          waiterName: payload.waiterName || 'Garçom',
          createdAt: new Date(),
          station: 'COZINHA',
          items: payload.items.map((item: any) => ({
            id: item.id,
            name: item.product?.name || item.name || 'Item',
            quantity: Number(item.quantity) || 1,
            notes: item.notes || null,
            kdsStation: item.kdsStation || item.product?.kdsStation
          }))
        };

        setKitchenTicket(ticketData);
        setActivePrintType('kitchen');
        setTimeout(() => {
          if ((window as any).electronAPI && (window as any).electronAPI.printSilent) { (window as any).electronAPI.printSilent(); } else { window.print(); }
        }, 300);
      }
    };

    const onCashUpdated = () => {
      loadCashStatus();
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('table:updated', onTableUpdated);
    socket.on('order:updated', onOrderUpdated);
    socket.on('kds:new_order', onKdsNewOrder);
    socket.on('kds:item_updated', onKdsUpdated);
    socket.on('kds:batch_updated', onKdsUpdated);
    socket.on('cash:updated', onCashUpdated);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('table:updated', onTableUpdated);
      socket.off('order:updated', onOrderUpdated);
      socket.off('kds:new_order', onKdsNewOrder);
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

  
  if (isLicensed === false) {
    return <LicenseModal machineId={machineId} onSuccess={loadSettings} />;
  }

  if (appMode === 'waiter') {

    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-150">
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
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-150">
      {/* Componente para Impressão Térmica (visível apenas ao acionar window.print()) */}
      {activePrintType === 'kitchen' ? (
        <KitchenTicketReceipt ticket={kitchenTicket} />
      ) : (
        <ThermalReceipt order={printOrder} />
      )}

      {/* Navbar Superior & Mobile Bottom Bar do Painel do PC / Gestão */}
      <Navbar
        currentView={currentView}
        onSelectView={setCurrentView}
        kdsCount={kdsCount}
        isCashOpen={isCashOpen}
        isConnected={isConnected}
        fontScale={fontScale}
        onChangeFontScale={handleFontScaleChange}
        theme={theme}
        onToggleTheme={handleToggleTheme}
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

        

        
        
        
        

        {currentView === 'fiscal' && (
          <FiscalHubView />
        )}

        {currentView === 'settings' && (
          <SettingsView 
            onOpenWaitersModal={() => setShowWaitersModal(true)}
            onOpenConnectMobile={() => setShowConnectMobileModal(true)}
            onOpenCustomers={() => setCurrentView('customers')}
            
            
            
            autoPrintKitchen={autoPrintKitchen}
            onToggleAutoPrintKitchen={() => setAutoPrintKitchen(!autoPrintKitchen)}
          />
        )}

        {currentView === 'customers' && (
          <CustomersView />
        )}

        {currentView === 'dashboard' && (
          <DashboardView />
        )}
      </main>

      {/* Modal de Gestão de Garçons */}
      {showWaitersModal && (
        <ManageWaitersModal
          onClose={() => setShowWaitersModal(false)}
          onWaitersChanged={loadTables}
        />
      )}

      {/* Modal de Conexão com Dispositivos Móveis (IP & QR Code) */}
      {showConnectMobileModal && (
        <ConnectMobileModal
          isOpen={showConnectMobileModal}
          onClose={() => setShowConnectMobileModal(false)}
        />
      )}
    </div>
  );
}

export default App;
