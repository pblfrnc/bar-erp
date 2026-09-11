import React, { useState, useEffect } from 'react';
import { FiscalSettingsView } from './FiscalSettingsView';
import { 
  Settings, 
  Users, 
  Smartphone, 
  Printer, 
  ChevronRight, 
  ShieldCheck, 
  MonitorSmartphone, 
  Wifi, 
  FileCode2, 
  Receipt, 
  Building2, 
  Truck,
  BarChart3,
  Sun,
  Moon,
  Type,
  Sparkles,
  ArrowUpCircle,
  RefreshCw
} from 'lucide-react';
import { socket } from '../services/socket';
import { api } from '../services/api';

interface SettingsViewProps {
  onOpenWaitersModal: () => void;
  onOpenConnectMobile: () => void;
  onOpenCustomers: () => void;
  onOpenSuppliers?: () => void;
  onOpenStaffModal?: () => void;
  onOpenDashboard?: () => void;
  autoPrintKitchen: boolean;
  onToggleAutoPrintKitchen: () => void;
  onOpenPrinters?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  fontScale?: 'normal' | 'large' | 'xlarge';
  onChangeFontScale?: (scale: 'normal' | 'large' | 'xlarge') => void;
  onOpenUpdateModal?: () => void;
  updateInfo?: any;
  onCheckForUpdates?: () => Promise<any>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onOpenWaitersModal,
  onOpenConnectMobile,
  onOpenCustomers,
  onOpenSuppliers,
  onOpenStaffModal,
  onOpenDashboard,
  onOpenPrinters,
  autoPrintKitchen,
  onToggleAutoPrintKitchen,
  theme = 'dark',
  onToggleTheme,
  fontScale = 'normal',
  onChangeFontScale,
  onOpenUpdateModal,
  updateInfo,
  onCheckForUpdates
}) => {
  const [backupInfo, setBackupInfo] = useState<any>(null);
  const [connectedDevices, setConnectedDevices] = useState<any[]>([]);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  const handleManualCheckUpdates = async () => {
    setCheckingUpdate(true);
    setCheckMessage(null);
    try {
      if (onCheckForUpdates) {
        const res = await onCheckForUpdates();
        if (res && res.hasUpdate) {
          setCheckMessage(`Nova versão ${res.latestVersion} disponível!`);
          if (onOpenUpdateModal) onOpenUpdateModal();
        } else if (res && res.error) {
          setCheckMessage(`Aviso: ${res.error}`);
        } else if (res && res.message) {
          setCheckMessage(res.message);
        } else {
          setCheckMessage('Você já está usando a versão mais recente do Bar ERP.');
        }
      } else {
        setCheckMessage('Atualizador disponível apenas no aplicativo Desktop Windows.');
      }
    } catch (e: any) {
      setCheckMessage('Erro ao verificar atualizações: ' + (e.message || e));
    } finally {
      setCheckingUpdate(false);
      setTimeout(() => setCheckMessage(null), 6000);
    }
  };

  const cycleFontScale = () => {
    if (!onChangeFontScale) return;
    if (fontScale === 'normal') onChangeFontScale('large');
    else if (fontScale === 'large') onChangeFontScale('xlarge');
    else onChangeFontScale('normal');
  };

  useEffect(() => {
    api.getBackupStatus().then(setBackupInfo).catch(() => {});

    // Buscar dispositivos iniciais
    fetch('/api/network/devices')
      .then(r => r.json())
      .then(setConnectedDevices)
      .catch(() => {});

    // Escutar eventos ao vivo
    const handleDevicesUpdated = (devices: any[]) => {
      setConnectedDevices(devices);
    };
    
    socket.on('devices_updated', handleDevicesUpdated);
    
    return () => {
      socket.off('devices_updated', handleDevicesUpdated);
    };
  }, []);

  return (
    <div className="space-y-4 pb-20 max-w-4xl mx-auto">
      {/* Cabeçalho com Ações Rápidas de Aparência */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Retaguarda & Gestão do Sistema</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Métricas operacionais, colaboradores, fornecedores, conexões e aparência.
            </p>
          </div>
        </div>

        {/* Botões de Tema e Tamanho de Fonte dentro da Retaguarda para despoluir a Tabbar */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 bg-slate-100 dark:bg-slate-950/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
          {/* Botão Modo Claro / Modo Escuro */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs active:scale-95 cursor-pointer"
              title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <span>Modo Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Modo Escuro</span>
                </>
              )}
            </button>
          )}

          {/* Botão Aumentar Tamanho de Fonte */}
          {onChangeFontScale && (
            <button
              onClick={cycleFontScale}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 border border-slate-200 dark:border-slate-700 shadow-xs transition active:scale-95 cursor-pointer"
              title="Ajustar Tamanho da Fonte (Acessibilidade)"
            >
              <Type className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <span>Aumentar Tamanho</span>
              <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded ml-1">
                {fontScale === 'normal' ? '1x' : fontScale === 'large' ? '1.2x' : '1.4x'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* MÉTRICAS & GESTÃO (Posicionado logo acima do Backup Automático) */}
      {onOpenDashboard && (
        <button
          onClick={onOpenDashboard}
          className="w-full bg-gradient-to-r from-purple-50 via-white to-white dark:from-purple-950/40 dark:via-slate-900 dark:to-slate-900 hover:from-purple-100 hover:to-slate-50 dark:hover:from-purple-900/50 dark:hover:to-slate-800 transition border-2 border-purple-200 dark:border-purple-500/40 hover:border-purple-400 rounded-3xl p-5 text-left flex items-center justify-between group shadow-sm dark:shadow-lg dark:shadow-purple-950/20"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-300 shrink-0 group-hover:scale-105 transition-transform">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition">
                  Métricas & Gestão
                </h3>
                <span className="text-[10px] font-black uppercase text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-500/20 border border-purple-200 dark:border-purple-500/30 px-2 py-0.5 rounded-full">
                  Faturamento & Relatórios
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Acompanhe vendas do dia, produtos mais vendidos, auditoria de pedidos e faturamento.
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-purple-600 dark:group-hover:text-purple-300 group-hover:translate-x-1 transition-all shrink-0" />
        </button>
      )}

      {/* Grid de Opções - Backup Automático */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 mb-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Backup Automático do Banco</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {backupInfo?.totalBackups 
                ? `${backupInfo.totalBackups} backups salvos. Último: ${backupInfo.lastBackup}` 
                : "Ativado. Backups são salvos no AppData todos os dias."}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 px-2 py-1 rounded">Protegido</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Equipe & Funcionários */}
        {onOpenStaffModal && (
          <button
            onClick={onOpenStaffModal}
            className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 transition border border-slate-200 dark:border-slate-800 rounded-3xl p-5 text-left flex items-center justify-between group shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">Equipe & Colaboradores</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Cadastrar funcionários, senhas e liberar funções</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-600 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition" />
          </button>
        )}

        {/* Clientes Fiado */}
        <button
          onClick={onOpenCustomers}
          className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 transition border border-slate-200 dark:border-slate-800 rounded-3xl p-5 text-left flex items-center justify-between group shadow-sm"
        >

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">Clientes (Fiado)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Banco de dados e saldos devedores</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-600 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition" />
        </button>

        {/* Fornecedores & Compras */}
        {onOpenSuppliers && (
          <button
            onClick={onOpenSuppliers}
            className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 transition border border-slate-200 dark:border-slate-800 rounded-3xl p-5 text-left flex items-center justify-between group shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">Fornecedores & Distribuidoras</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Cadastro de CNPJ, contatos e compras</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-600 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition" />
          </button>
        )}
        
        {/* Garçons */}
        <button
          onClick={onOpenWaitersModal}
          className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 transition border border-slate-200 dark:border-slate-800 rounded-3xl p-5 text-left flex items-center justify-between group shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">Cadastro de Garçons</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Adicionar, remover e gerenciar comissões</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-600 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition" />
        </button>

        {/* Conectar Celular */}
        <button
          onClick={onOpenConnectMobile}
          className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 transition border border-slate-200 dark:border-slate-800 rounded-3xl p-5 text-left flex items-center justify-between group shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">Conectar Celular</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ver QRCode e IP para conectar garçons</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition" />
        </button>

        {/* Configurações de Impressora Térmica */}
        {onOpenPrinters && (
          <button
            onClick={onOpenPrinters}
            className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 transition border border-slate-200 dark:border-slate-800 rounded-3xl p-5 text-left flex items-center justify-between group shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Printer className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                  Configurar Impressoras & Bobina
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Bobina 80mm / 58mm, margens, escala e teste de calibração
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-600 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition" />
          </button>
        )}

        {/* Impressão Automática */}
        <button
          onClick={onToggleAutoPrintKitchen}
          className={`transition border rounded-3xl p-5 text-left flex items-center justify-between group shadow-sm ${
            autoPrintKitchen 
              ? 'bg-emerald-50 hover:bg-emerald-100/70 border-emerald-300 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30 dark:border-emerald-500/30' 
              : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              autoPrintKitchen ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h3 className={`text-base font-bold transition ${
                autoPrintKitchen ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-300'
              }`}>
                Auto-Impressão de Cozinha
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {autoPrintKitchen ? 'Ligada: Imprime pedidos KDS automaticamente.' : 'Desligada: Envia apenas para o KDS.'}
              </p>
            </div>
          </div>
          <div className={`w-10 h-6 rounded-full flex items-center p-1 transition-colors ${
            autoPrintKitchen ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
          }`}>
            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
              autoPrintKitchen ? 'translate-x-4' : 'translate-x-0'
            }`} />
          </div>
        </button>

      
      </div>

      {/* 🚀 Sobre o Bar ERP & Atualizador Automático */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm overflow-hidden relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
              <ArrowUpCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Bar ERP Pro Desktop
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {updateInfo?.currentVersion ? `v${updateInfo.currentVersion}` : 'v1.6.9'}
                </span>
                {updateInfo?.hasUpdate && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 animate-pulse">
                    Atualização Disponível
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {updateInfo?.hasUpdate 
                  ? `Uma nova versão (${updateInfo.latestVersion}) está pronta para instalar!`
                  : checkMessage 
                    ? checkMessage 
                    : 'Sistema atualizado. O Bar ERP verifica e notifica sobre novas versões automaticamente.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {updateInfo?.hasUpdate ? (
              <button
                type="button"
                onClick={onOpenUpdateModal}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-md shadow-amber-500/20 active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                Atualizar Agora
              </button>
            ) : (
              <button
                type="button"
                disabled={checkingUpdate}
                onClick={handleManualCheckUpdates}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? 'animate-spin text-amber-500' : ''}`} />
                {checkingUpdate ? 'Verificando...' : 'Verificar Atualizações'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dispositivos Conectados */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 mt-8 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-500 dark:text-cyan-400">
            <MonitorSmartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Dispositivos Conectados ({connectedDevices.length})</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Tempo real dos celulares e painéis KDS conectados na rede.</p>
          </div>
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          {connectedDevices.length === 0 ? (
            <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-sm">
              Nenhum dispositivo móvel conectado no momento.
            </div>
          ) : (
            connectedDevices.map((dev, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${dev.clientType === 'GARCOM_MOBILE' ? 'bg-amber-500' : dev.clientType === 'COZINHA_KDS' ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                  <div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {dev.clientType === 'GARCOM_MOBILE' ? '📱 App Garçom' : dev.clientType === 'COZINHA_KDS' ? '📺 Tela Cozinha (KDS)' : '💻 ' + dev.clientType}
                      {dev.waiterName && <span className="text-amber-600 dark:text-amber-400 ml-1">({dev.waiterName})</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 max-w-[200px] truncate" title={dev.userAgent}>
                      {dev.userAgent}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
                  <Wifi className="w-3.5 h-3.5 text-cyan-500" />
                  {dev.ip}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
