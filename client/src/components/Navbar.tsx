import React from 'react';
import {
  Beer,
  LayoutGrid,
  ChefHat,
  Receipt,
  UtensilsCrossed,
  BarChart3,
  Maximize2,
  Minimize2,
  WifiOff,
  Printer,
  Sun,
  Moon,
  Users,
  Smartphone
} from 'lucide-react';

interface NavbarProps {
  currentView: 'tables' | 'kds' | 'cash' | 'products' | 'dashboard';
  onSelectView: (view: 'tables' | 'kds' | 'cash' | 'products' | 'dashboard') => void;
  kdsCount: number;
  isCashOpen: boolean;
  isConnected: boolean;
  fontScale: 'normal' | 'large' | 'xlarge';
  onChangeFontScale: (scale: 'normal' | 'large' | 'xlarge') => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenWaitersModal: () => void;
  onOpenConnectMobile?: () => void;
  autoPrintKitchen?: boolean;
  onToggleAutoPrintKitchen?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onSelectView,
  kdsCount,
  isCashOpen,
  isConnected,
  fontScale,
  onChangeFontScale,
  theme,
  onToggleTheme,
  onOpenWaitersModal,
  onOpenConnectMobile,
  autoPrintKitchen,
  onToggleAutoPrintKitchen
}) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const cycleFontScale = () => {
    if (fontScale === 'normal') onChangeFontScale('large');
    else if (fontScale === 'large') onChangeFontScale('xlarge');
    else onChangeFontScale('normal');
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

  const navItems = [
    {
      id: 'tables' as const,
      label: 'Mesas & Salão',
      icon: LayoutGrid,
      badge: null
    },
    {
      id: 'kds' as const,
      label: 'KDS (Cozinha)',
      icon: ChefHat,
      badge: kdsCount > 0 ? kdsCount : null,
      badgeColor: 'bg-amber-500 text-black'
    },
    {
      id: 'cash' as const,
      label: 'Caixa & PDV',
      icon: Receipt,
      badge: isCashOpen ? 'Aberto' : 'Fechado',
      badgeColor: isCashOpen ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-600 dark:text-red-400'
    },
    {
      id: 'products' as const,
      label: 'Cardápio & Estoque',
      icon: UtensilsCrossed,
      badge: null
    },
    {
      id: 'dashboard' as const,
      label: 'Métricas & Gestão',
      icon: BarChart3,
      badge: null
    }
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 select-none shadow-sm dark:shadow-none transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Marca */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Beer className="w-6 h-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-slate-900 dark:text-white text-lg">
                  Bar<span className="text-amber-500">ERP</span>
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">Controle de Mesas & KDS</p>
            </div>
          </div>

          {/* Navegação Desktop / Tablet */}
          <nav className="hidden md:flex items-center gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectView(item.id)}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge !== null && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-slate-950 text-amber-400' : item.badgeColor
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Ações da direita: Status conexão, Tema, Acessibilidade, Garçons, etc. */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Status Wi-Fi / Conexão */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isConnected
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
              }`}
              title={isConnected ? 'Sincronizado em tempo real' : 'Sem conexão WebSocket'}
            >
              {isConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="hidden lg:inline">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-red-500" />
                  <span className="hidden lg:inline">Offline</span>
                </>
              )}
            </div>

            {/* Alternador de Tema Claro / Escuro */}
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700 active:scale-95"
              title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>

            {/* Botão de Acessibilidade / Fontes Grandes */}
            <button
              onClick={cycleFontScale}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-300 border border-slate-200 dark:border-slate-700 transition active:scale-95"
              title="Ajustar Tamanho da Fonte (Acessibilidade)"
            >
              <span className="text-sm font-black tracking-tighter">A+</span>
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 hidden sm:inline">
                {fontScale === 'normal' ? 'Normal' : fontScale === 'large' ? 'Grande' : 'Extra'}
              </span>
            </button>

            {/* Conectar Celular / Wi-Fi */}
            {onOpenConnectMobile && (
              <button
                onClick={onOpenConnectMobile}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 transition active:scale-95 cursor-pointer shadow-xs"
                title="Conectar Celular ou Tablet Android via Wi-Fi (Ver IP e QR Code)"
              >
                <Smartphone className="w-4 h-4" />
                <span className="hidden sm:inline">Conectar Celular</span>
              </button>
            )}

            {/* Gerenciamento de Garçons */}
            <button
              onClick={onOpenWaitersModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition active:scale-95 cursor-pointer"
              title="Gerenciar Garçons e Comissões"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Garçons</span>
            </button>

            {/* Auto-Impressão Térmica de Cozinha no PC */}
            {onToggleAutoPrintKitchen && (
              <button
                onClick={onToggleAutoPrintKitchen}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition active:scale-95 ${
                  autoPrintKitchen
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
                title={
                  autoPrintKitchen
                    ? 'Impressão automática de pedidos da cozinha ATIVADA no PC'
                    : 'Auto-impressão de pedidos da cozinha DESATIVADA'
                }
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden xl:inline text-[11px]">
                  {autoPrintKitchen ? 'Auto-Imprimir: ON' : 'Auto-Imprimir: OFF'}
                </span>
              </button>
            )}

            {/* Botão Tela Cheia */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={isFullscreen ? 'Sair da tela cheia' : 'Entrar em tela cheia'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Navegação Inferior para Mobile */}
      <div className="md:hidden flex items-center justify-around bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`relative flex flex-col items-center py-1 px-2 rounded-lg transition ${
                isActive ? 'text-amber-500 font-bold' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {item.badge !== null && (
                  <span className="absolute -top-1 -right-2 px-1 text-[9px] font-black rounded-full bg-amber-500 text-slate-950">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
