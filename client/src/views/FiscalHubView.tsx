import React, { useState } from 'react';
import { Receipt, FileText, ArrowLeft, Settings } from 'lucide-react';
import { FiscalImportView } from './FiscalImportView';
import { ManualNfceView } from './ManualNfceView';
import { FiscalSettingsView } from './FiscalSettingsView';

export const FiscalHubView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'hub' | 'import' | 'emit' | 'settings'>('hub');

  if (activeTab === 'import') {
    return <FiscalImportView onBack={() => setActiveTab('hub')} />;
  }

  if (activeTab === 'emit') {
    return <ManualNfceView onBack={() => setActiveTab('hub')} />;
  }

  if (activeTab === 'settings') {
    return <FiscalSettingsView onBack={() => setActiveTab('hub')} />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pt-4 pb-20">
      <h2 className="text-2xl font-black text-white tracking-tight mb-8">Módulo Fiscal Central</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card: Importar XML */}
        <button 
          onClick={() => setActiveTab('import')}
          className="bg-slate-900 border border-slate-800 hover:border-emerald-500 hover:bg-slate-800/80 rounded-3xl p-8 text-left transition group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition"></div>
          <FileText className="w-10 h-10 text-emerald-500 mb-6" />
          <h3 className="text-xl font-bold text-white mb-2">Importar XML (Entrada)</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Importe notas de fornecedores para dar entrada automática no estoque e atualizar preços de custo.
          </p>
        </button>

        {/* Card: Emitir NFC-e */}
        <button 
          onClick={() => setActiveTab('emit')}
          className="bg-slate-900 border border-slate-800 hover:border-indigo-500 hover:bg-slate-800/80 rounded-3xl p-8 text-left transition group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition"></div>
          <Receipt className="w-10 h-10 text-indigo-400 mb-6" />
          <h3 className="text-xl font-bold text-white mb-2">Emitir NFC-e (Saída)</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Emissão avulsa de cupons fiscais para vendas rápidas ou retroativas usando a integração Focus NFe.
          </p>
        </button>

        {/* Card: Configurações Fiscais */}
        <button 
          onClick={() => setActiveTab('settings')}
          className="bg-slate-900 border border-slate-800 hover:border-amber-500 hover:bg-slate-800/80 rounded-3xl p-8 text-left transition group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/20 transition"></div>
          <Settings className="w-10 h-10 text-amber-500 mb-6" />
          <h3 className="text-xl font-bold text-white mb-2">Configurações Fiscais</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Configure seu Token Master da Focus NFe, dados do cliente e gerencie o Certificado Digital A1.
          </p>
        </button>
      </div>
    </div>
  );
};
