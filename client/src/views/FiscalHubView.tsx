import React, { useState } from 'react';
import { Receipt, FileText, ArrowLeft, Settings, Scan } from 'lucide-react';
import { FiscalImportView } from './FiscalImportView';
import { ManualNfceView } from './ManualNfceView';
import { FiscalSettingsView } from './FiscalSettingsView';
import { NfReceivingView } from './NfReceivingView';
import { api } from '../services/api';

import { NfceCancelView } from './NfceCancelView';

export const FiscalHubView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'hub' | 'receive' | 'import' | 'emit' | 'settings' | 'cancel'>('hub');
  const [chaveParaImportar, setChaveParaImportar] = useState<string | null>(null);

  // Ao clicar em "Importar Itens" na lista de recebidos, abre import com XML já baixado
  const handleImportarDeChave = async (chave: string) => {
    setChaveParaImportar(chave);
    setActiveTab('import');
  };

  if (activeTab === 'receive') {
    return (
      <NfReceivingView
        onBack={() => setActiveTab('hub')}
        onImportarXml={handleImportarDeChave}
      />
    );
  }

  if (activeTab === 'import') {
    return (
      <FiscalImportView
        onBack={() => { setChaveParaImportar(null); setActiveTab('hub'); }}
        chaveAcesso={chaveParaImportar ?? undefined}
      />
    );
  }

  if (activeTab === 'emit') {
    return <ManualNfceView onBack={() => setActiveTab('hub')} />;
  }

  if (activeTab === 'cancel') {
    return <NfceCancelView onBack={() => setActiveTab('hub')} />;
  }

  if (activeTab === 'settings') {
    return <FiscalSettingsView onBack={() => setActiveTab('hub')} />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pt-4 pb-20">
      <h2 className="text-2xl font-black text-white tracking-tight mb-8">Módulo Fiscal Central</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Card: Receber NF (Bip) */}
        <button
          onClick={() => setActiveTab('receive')}
          className="md:col-span-2 bg-slate-900 border border-amber-500/40 hover:border-amber-500 hover:bg-slate-800/80 rounded-3xl p-8 text-left transition group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition"></div>
          <div className="flex items-center gap-4 mb-3">
            <Scan className="w-10 h-10 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">Novo</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Receber NF por Bip ⚡</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Bipe o código de barras da nota do fornecedor e o sistema registra automaticamente a <strong className="text-slate-300">Ciência da Operação na SEFAZ</strong> e baixa o XML. Depois, importe os itens com um clique.
          </p>
        </button>

        {/* Card: Importar XML manual */}
        <button
          onClick={() => { setChaveParaImportar(null); setActiveTab('import'); }}
          className="bg-slate-900 border border-slate-800 hover:border-emerald-500 hover:bg-slate-800/80 rounded-3xl p-8 text-left transition group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition"></div>
          <FileText className="w-10 h-10 text-emerald-500 mb-6" />
          <h3 className="text-xl font-bold text-white mb-2">Importar XML (Entrada)</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Importe notas de fornecedores pelo arquivo .xml para dar entrada no estoque e atualizar preços de custo.
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

        {/* Card: Cancelar NFC-e */}
        <button
          onClick={() => setActiveTab('cancel')}
          className="bg-slate-900 border border-slate-800 hover:border-rose-500 hover:bg-slate-800/80 rounded-3xl p-8 text-left transition group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl group-hover:bg-rose-500/20 transition"></div>
          <div className="w-10 h-10 text-rose-500 mb-6 flex items-center justify-center bg-rose-500/10 rounded-xl border border-rose-500/20">
             <span className="font-bold text-xl">X</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Cancelar Nota</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Cancele cupons fiscais recém-emitidos na SEFAZ (dentro do prazo legal de 30 minutos) de forma rápida.
          </p>
        </button>

        {/* Card: Configurações Fiscais */}
        <button
          onClick={() => setActiveTab('settings')}
          className="md:col-span-2 bg-slate-900 border border-slate-800 hover:border-slate-600 hover:bg-slate-800/80 rounded-3xl p-6 text-left transition group flex items-center gap-5"
        >
          <Settings className="w-8 h-8 text-slate-500 group-hover:text-slate-300 transition shrink-0" />
          <div>
            <h3 className="text-base font-bold text-white mb-0.5">Configurações Fiscais</h3>
            <p className="text-slate-400 text-sm">Token API Focus NFe, Certificado Digital A1 e dados do emitente.</p>
          </div>
        </button>
      </div>
    </div>
  );
};
