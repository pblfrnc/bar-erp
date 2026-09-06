import React from 'react';
import { Settings, Users, Smartphone, Printer, ChevronRight } from 'lucide-react';

interface SettingsViewProps {
  onOpenWaitersModal: () => void;
  onOpenConnectMobile: () => void;
  onOpenCustomers: () => void;
  autoPrintKitchen: boolean;
  onToggleAutoPrintKitchen: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onOpenWaitersModal,
  onOpenConnectMobile,
  onOpenCustomers,
  autoPrintKitchen,
  onToggleAutoPrintKitchen
}) => {
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

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
    </div>
  );
};
