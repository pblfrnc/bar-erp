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
import { SuppliersView } from './views/SuppliersView';
import { DashboardView } from './views/DashboardView';
import { AuditView } from './views/AuditView';
import { SettingsView } from './views/SettingsView';
import { FiscalHubView } from './views/FiscalHubView';
import { FiscalSettingsView } from './views/FiscalSettingsView';
import { ManualNfceView } from './views/ManualNfceView';
import { CustomersView } from './views/CustomersView';
import { PrinterSettingsView } from './views/PrinterSettingsView';
import { UpdateNotificationModal, UpdateInfo } from './components/UpdateNotificationModal';



import { WaiterView } from './views/WaiterView';
import { ThermalReceipt } from './components/ThermalReceipt';
import { KitchenTicketReceipt, KitchenTicketData } from './components/KitchenTicketReceipt';
import { ManageWaitersModal } from './components/ManageWaitersModal';
import { ManageStaffModal } from './components/ManageStaffModal';
import { LoginScreen } from './components/LoginScreen';
import { ConnectMobileModal } from './components/ConnectMobileModal';
import { playKitchenChime } from './utils/sound';
import { LoggedUser } from './types';


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

  // Modal de Gestão de Funcionários & Permissões
  const [showStaffModal, setShowStaffModal] = useState<boolean>(false);

  // Usuário / Operador logado
  const [currentUser, setCurrentUser] = useState<LoggedUser | null>(() => {
    try {
      const saved = localStorage.getItem('bar_logged_staff');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  const handleLogout = () => {
    localStorage.removeItem('bar_logged_staff');
    setCurrentUser(null);
  };

  // Modal para conectar celulares/tablets na rede local
  const [showConnectMobileModal, setShowConnectMobileModal] = useState<boolean>(false);

  // Gerenciamento de Atualização Automática do Bar ERP
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState<boolean>(false);

  useEffect(() => {
    const electron = (window as any).electronAPI;
    if (!electron) return;

    let cleanupAvail: any = null;
    if (electron.onUpdateAvailable) {
      cleanupAvail = electron.onUpdateAvailable((info: UpdateInfo) => {
        if (info && info.hasUpdate) {
          setUpdateInfo(info);
        }
      });
    }

    const timer = setTimeout(async () => {
      try {
        if (electron.checkForUpdates) {
          const res = await electron.checkForUpdates();
          if (res && res.hasUpdate) {
            setUpdateInfo(res);
          }
        }
      } catch (e) {}
    }, 4000);

    return () => {
      clearTimeout(timer);
      if (cleanupAvail) cleanupAvail();
    };
  }, []);

  const handleCheckForUpdates = async () => {
    const electron = (window as any).electronAPI;
    if (electron?.checkForUpdates) {
      try {
        const res = await electron.checkForUpdates();
        if (res) {
          setUpdateInfo(res);
        }
        return res;
      } catch (err) {
        console.error('Erro ao checar atualizações:', err);
        return null;
      }
    }
    return null;
  };

  const [currentView, setCurrentView] = useState<'tables' | 'kds' | 'cash' | 'products' | 'suppliers' | 'dashboard' | 'audit' | 'settings' | 'customers' | 'fiscal' | 'fiscalSettings' | 'manualNfce' | 'printers'>('tables');

  // Redireciona automaticamente se a tela atual não for permitida para o usuário
  useEffect(() => {
    if (currentUser && currentUser.role !== 'ADMIN' && currentUser.permissions?.length) {
      // Mapeamento de sub-views para módulo pai
      const requiredModule = 
        currentView === 'fiscalSettings' || currentView === 'manualNfce' ? 'fiscal' :
        currentView === 'printers' ? 'settings' :
        currentView === 'audit' ? 'dashboard' : currentView;

      if (!currentUser.permissions.includes(requiredModule)) {
        const firstAllowed = currentUser.permissions[0] as any;
        if (firstAllowed) {
          setCurrentView(firstAllowed);
        }
      }
    }
  }, [currentUser, currentView]);

  // Inicializa variáveis CSS de impressão térmica (bobina e margens)
  useEffect(() => {
    try {
      const localStr = localStorage.getItem('bar_erp_printer_settings');
      if (localStr) {
        const s = JSON.parse(localStr);
        document.documentElement.style.setProperty('--printer-paper-width', `${s.paperWidth || 80}mm`);
        document.documentElement.style.setProperty('--printer-margin-left', `${s.marginLeft ?? 1}mm`);
        document.documentElement.style.setProperty('--printer-margin-right', `${s.marginRight ?? 1}mm`);
        document.documentElement.style.setProperty('--printer-margin-top', `${s.marginTop ?? 2}mm`);
      }
    } catch (e) {}
  }, []);

  const [tables, setTables] = useState<Table[]>([]);
  const [loadingTables, setLoadingTables] = useState<boolean>(true);
  const [kdsCount, setKdsCount] = useState<number>(0);
  const [isCashOpen, setIsCashOpen] = useState<boolean>(false);
  const [isLicensed, setIsLicensed] = useState<boolean | null>(null);
  const [machineId, setMachineId] = useState<string>("");
  const [licenseStatus, setLicenseStatus] = useState<string>("UNLICENSED");
  const [daysRemaining, setDaysRemaining] = useState<number>(0);
  const [isExpiringSoon, setIsExpiringSoon] = useState<boolean>(false);
  const [developerContact, setDeveloperContact] = useState<any>(null);
  const [showLicenseInfo, setShowLicenseInfo] = useState<boolean>(false);

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
      setLicenseStatus(data.licenseStatus || (data.isLicensed ? "ACTIVE" : "UNLICENSED"));
      setDaysRemaining(data.daysRemaining || 0);
      setIsExpiringSoon(Boolean(data.isExpiringSoon));
      if (data.developerContact) {
        setDeveloperContact(data.developerContact);
      }
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
    return (
      <LicenseModal 
        machineId={machineId} 
        onSuccess={loadSettings} 
        status={licenseStatus}
        developerContact={developerContact}
      />
    );
  }

  // Tela de Login obrigatória no modo computador / gestão
  if (appMode === 'admin' && !currentUser) {
    return <LoginScreen onLoginSuccess={(u) => setCurrentUser(u)} />;
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
        currentUser={currentUser}
        onLogout={handleLogout}
        hasUpdate={Boolean(updateInfo?.hasUpdate)}
        onOpenUpdateModal={() => setShowUpdateModal(true)}
        isExpiringSoon={isExpiringSoon}
        daysRemaining={daysRemaining}
        onOpenLicenseInfo={() => setShowLicenseInfo(true)}
      />

      {/* Modal de Aviso de Mensalidade Próxima do Vencimento */}
      {showLicenseInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Aviso de Mensalidade</h3>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                    Vence em {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLicenseInfo(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Para evitar interrupções no funcionamento do Bar ERP, efetue o pagamento da sua mensalidade via PIX e envie o comprovante.
            </p>

            <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3.5 rounded-2xl border border-indigo-200 dark:border-indigo-500/20">
              <span className="text-[11px] uppercase font-bold text-indigo-950 dark:text-indigo-300 block mb-1">
                Chave PIX do Desenvolvedor:
              </span>
              <code className="text-xs font-mono font-bold text-slate-900 dark:text-indigo-200 block select-all">
                {developerContact?.pixKey || '68.817.608/0001-47'}
              </code>
            </div>

            <div className="bg-slate-100 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] uppercase font-bold text-slate-500 block mb-1">
                ID deste Computador:
              </span>
              <code className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 block select-all">
                {machineId}
              </code>
            </div>

            <button
              onClick={() => {
                const phone = (developerContact?.phone || '5591988887777').replace(/\D/g, '');
                const text = `Olá! Segue o comprovante de renovação da mensalidade do Bar ERP.\nID da minha máquina: ${machineId}`;
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
            >
              Enviar Comprovante no WhatsApp
            </button>
          </div>
        </div>
      )}

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
          <KdsView onRefreshKdsBadge={loadKdsCount} isConnected={isConnected} />
        )}

        {currentView === 'cash' && (
          <CashView onRefreshStatus={loadCashStatus} />
        )}

        {currentView === 'products' && (
          <ProductsView />
        )}

        {currentView === 'suppliers' && (
          <SuppliersView isAdmin={currentUser?.role === 'ADMIN'} />
        )}

        {currentView === 'fiscal' && (
          <FiscalHubView />
        )}

        {currentView === 'settings' && (
          <SettingsView 
            onOpenWaitersModal={() => setShowWaitersModal(true)}
            onOpenStaffModal={() => setShowStaffModal(true)}
            onOpenConnectMobile={() => setShowConnectMobileModal(true)}
            onOpenCustomers={() => setCurrentView('customers')}
            onOpenSuppliers={() => setCurrentView('suppliers')}
            onOpenDashboard={() => setCurrentView('dashboard')}
            onOpenPrinters={() => setCurrentView('printers')}
            autoPrintKitchen={autoPrintKitchen}
            onToggleAutoPrintKitchen={() => setAutoPrintKitchen(!autoPrintKitchen)}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            fontScale={fontScale}
            onChangeFontScale={handleFontScaleChange}
            updateInfo={updateInfo}
            onOpenUpdateModal={() => setShowUpdateModal(true)}
            onCheckForUpdates={handleCheckForUpdates}
          />
        )}

        {currentView === 'printers' && (
          <PrinterSettingsView onBack={() => setCurrentView('settings')} />
        )}

        {currentView === 'customers' && (
          <CustomersView />
        )}

        {currentView === 'dashboard' && (
          <DashboardView onBack={() => setCurrentView('settings')} />
        )}
      </main>

      {/* Modal de Gestão de Colaboradores & Permissões */}
      {showStaffModal && (
        <ManageStaffModal
          onClose={() => setShowStaffModal(false)}
        />
      )}

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

      {/* Modal e Notificação de Atualização do Bar ERP */}
      <UpdateNotificationModal
        updateInfo={updateInfo}
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onOpenModal={() => setShowUpdateModal(true)}
      />
    </div>
  );
}

export default App;
