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
  Wifi,
  WifiOff
} from 'lucide-react';

interface NavbarProps {
  currentView: 'tables' | 'kds' | 'cash' | 'products' | 'dashboard';
  onSelectView: (view: 'tables' | 'kds' | 'cash' | 'products' | 'dashboard') => void;
  kdsCount: number;
  isCashOpen: boolean;
  isConnected: boolean;
  fontScale: 'normal' | 'large' | 'xlarge';
  onChangeFontScale: (scale: 'normal' | 'large' | 'xlarge') => void;
  onSwitchToWaiter?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onSelectView,
  kdsCount,
  isCashOpen,
  isConnected,
  fontScale,
  onChangeFontScale,
  onSwitchToWaiter
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
      label: 'KDS (Bar / Cozinha)',
      icon: ChefHat,
      badge: kdsCount > 0 ? kdsCount : null,
      badgeColor: 'bg-amber-500 text-black'
    },
    {
      id: 'cash' as const,
      label: 'Caixa & PDV',
      icon: Receipt,
      badge: isCashOpen ? 'Aberto' : 'Fechado',
      badgeColor: isCashOpen ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400'
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
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 select-none">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Marca */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Beer className="w-6 h-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-white text-lg">
                  Bar<span className="text-amber-400">ERP</span>
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Controle de Mesas & KDS</p>
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
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
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

          {/* Ações da direita: Status conexão e tela cheia */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isConnected
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                  : 'bg-red-950/40 text-red-400 border-red-800/50'
              }`}
              title={isConnected ? 'Sincronizado em tempo real' : 'Sem conexão WebSocket'}
            >
              {isConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="hidden sm:inline">Tempo Real</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-red-400" />
                  <span className="hidden sm:inline">Offline</span>
                </>
              )}
            </div>

            {/* Botão de Acessibilidade / Fontes Grandes para Baixa Visão */}
            <button
              onClick={cycleFontScale}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-black bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition active:scale-95"
              title="Ajustar Tamanho da Fonte (Acessibilidade para Baixa Visão)"
            >
              <span className="text-sm font-black tracking-tighter">A+</span>
              <span className="text-[10px] uppercase font-bold text-slate-300">
                {fontScale === 'normal' ? 'Normal' : fontScale === 'large' ? 'Grande' : 'Extra'}
              </span>
            </button>

            {/* Alternador para o Modo Garçom */}
            {onSwitchToWaiter && (
              <button
                onClick={onSwitchToWaiter}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition active:scale-95"
                title="Alternar para a Interface do Garçom (Celular / Tablet)"
              >
                <span>👔</span>
                <span className="hidden sm:inline">Modo Garçom</span>
              </button>
            )}

            {/* Botão Tela Cheia (para tablets e celulares Android no balcão) */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title={isFullscreen ? 'Sair da tela cheia' : 'Entrar em tela cheia (Modo Kiosk / Tablet)'}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Navegação Inferior para Mobile / Celular Android dos Garçons */}
      <div className="md:hidden flex items-center justify-around bg-slate-900 border-t border-slate-800 px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`relative flex flex-col items-center py-1 px-2 rounded-lg transition ${
                isActive ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
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
              <span className="text-[10px] mt-1 font-medium">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
