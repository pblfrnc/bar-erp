import React, { useState, useEffect } from 'react';
import { Settings, Users, Smartphone, Printer, ChevronRight, ShieldCheck, MonitorSmartphone, Wifi, FileCode2 } from 'lucide-react';
import { socket } from '../services/socket';
import { api } from '../services/api';

interface SettingsViewProps {
  onOpenWaitersModal: () => void;
  onOpenConnectMobile: () => void;
  onOpenCustomers: () => void;
  onOpenFiscal: () => void;
  autoPrintKitchen: boolean;
  onToggleAutoPrintKitchen: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onOpenWaitersModal,
  onOpenConnectMobile,
  onOpenCustomers,
  onOpenFiscal,
  autoPrintKitchen,
  onToggleAutoPrintKitchen
}) => {
  const [backupInfo, setBackupInfo] = useState<any>(null);
  const [connectedDevices, setConnectedDevices] = useState<any[]>([]);

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
      {/* Cabeçalho */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Painel Administrativo</h2>
            <p className="text-xs text-slate-400">
              Gerencie garçons, conexões de dispositivos e impressoras térmicas.
            </p>
          </div>
        </div>
      </div>

      {/* Grid de Opções */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Backup Automático do Banco</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {backupInfo?.totalBackups 
                ? `${backupInfo.totalBackups} backups salvos. Último: ${backupInfo.lastBackup}` 
                : "Ativado. Backups são salvos no AppData todos os dias."}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-black uppercase text-indigo-400 bg-indigo-500/20 px-2 py-1 rounded">Protegido</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        
        {/* Importação XML */}
        <button
          onClick={onOpenFiscal}
          className="bg-slate-900 hover:bg-slate-800 transition border border-slate-800 rounded-3xl p-5 text-left flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <FileCode2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition">Entrada XML (NF-e)</h3>
              <p className="text-xs text-slate-400 mt-0.5">Importe XML de fornecedores p/ estoque</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 transition" />
        </button>

        {/* Clientes Fiado */}
        <button
          onClick={onOpenCustomers}
          className="bg-slate-900 hover:bg-slate-800 transition border border-slate-800 rounded-3xl p-5 text-left flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition">Clientes (Fiado)</h3>
              <p className="text-xs text-slate-400 mt-0.5">Banco de dados e saldos devedores</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 transition" />
        </button>
        
        {/* Garçons */}
        <button
          onClick={onOpenWaitersModal}
          className="bg-slate-900 hover:bg-slate-800 transition border border-slate-800 rounded-3xl p-5 text-left flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition">Cadastro de Garçons</h3>
              <p className="text-xs text-slate-400 mt-0.5">Adicionar, remover e gerenciar comissões</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-amber-400 transition" />
        </button>

        {/* Conectar Celular */}
        <button
          onClick={onOpenConnectMobile}
          className="bg-slate-900 hover:bg-slate-800 transition border border-slate-800 rounded-3xl p-5 text-left flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition">Conectar Celular</h3>
              <p className="text-xs text-slate-400 mt-0.5">Ver QRCode e IP para conectar garçons</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition" />
        </button>

        {/* Impressão Automática */}
        <button
          onClick={onToggleAutoPrintKitchen}
          className={`transition border rounded-3xl p-5 text-left flex items-center justify-between group ${
            autoPrintKitchen 
              ? 'bg-emerald-900/20 hover:bg-emerald-900/30 border-emerald-500/30' 
              : 'bg-slate-900 hover:bg-slate-800 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              autoPrintKitchen ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-800 text-slate-400'
            }`}>
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h3 className={`text-base font-bold transition ${
                autoPrintKitchen ? 'text-emerald-400' : 'text-white group-hover:text-slate-300'
              }`}>
                Auto-Impressão de Cozinha
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {autoPrintKitchen ? 'Ligada: Imprime pedidos KDS automaticamente.' : 'Desligada: Envia apenas para o KDS.'}
              </p>
            </div>
          </div>
          <div className={`w-10 h-6 rounded-full flex items-center p-1 transition-colors ${
            autoPrintKitchen ? 'bg-emerald-500' : 'bg-slate-700'
          }`}>
            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
              autoPrintKitchen ? 'translate-x-4' : 'translate-x-0'
            }`} />
          </div>
        </button>

      
      </div>

      {/* Dispositivos Conectados */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mt-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <MonitorSmartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Dispositivos Conectados ({connectedDevices.length})</h3>
            <p className="text-xs text-slate-400">Tempo real dos celulares e painéis KDS conectados na rede.</p>
          </div>
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          {connectedDevices.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-sm">
              Nenhum dispositivo móvel conectado no momento.
            </div>
          ) : (
            connectedDevices.map((dev, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80 gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${dev.clientType === 'GARCOM_MOBILE' ? 'bg-amber-400' : dev.clientType === 'COZINHA_KDS' ? 'bg-orange-500' : 'bg-emerald-400'}`} />
                  <div>
                    <div className="text-sm font-bold text-slate-200">
                      {dev.clientType === 'GARCOM_MOBILE' ? '📱 App Garçom' : dev.clientType === 'COZINHA_KDS' ? '📺 Tela Cozinha (KDS)' : '💻 ' + dev.clientType}
                      {dev.waiterName && <span className="text-amber-400 ml-1">({dev.waiterName})</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 max-w-[200px] truncate" title={dev.userAgent}>
                      {dev.userAgent}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
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
