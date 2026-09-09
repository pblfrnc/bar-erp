import React, { useState } from 'react';
import { Receipt, FileText, ArrowLeft, Settings, Scan, ShieldAlert, BookOpen } from 'lucide-react';
import { FiscalImportView } from './FiscalImportView';
import { ManualNfceView } from './ManualNfceView';
import { FiscalSettingsView } from './FiscalSettingsView';
import { NfReceivingView } from './NfReceivingView';
import { api } from '../services/api';

import { NfceCancelView } from './NfceCancelView';
import { NfceReprintView } from './NfceReprintView';
import { AccountantPanelView } from './AccountantPanelView';
import { SefazStatusBadge } from '../components/SefazStatusBadge';
import { NfceInutilizacaoModal } from './NfceInutilizacaoModal';
import { NcmLookupModal } from '../components/NcmLookupModal';

export const FiscalHubView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'hub' | 'receive' | 'import' | 'emit' | 'settings' | 'cancel' | 'reprint' | 'accountant'>('hub');
  const [chaveParaImportar, setChaveParaImportar] = useState<string | null>(null);
  const [showInutilizacao, setShowInutilizacao] = useState(false);
  const [showNcmLookup, setShowNcmLookup] = useState(false);

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

  if (activeTab === 'accountant') {
    return <AccountantPanelView onBack={() => setActiveTab('hub')} />;
  }

  if (activeTab === 'reprint') {
    return <NfceReprintView onBack={() => setActiveTab('hub')} />;
  }

  if (activeTab === 'cancel') {
    return <NfceCancelView onBack={() => setActiveTab('hub')} />;
  }

  if (activeTab === 'settings') {
    return <FiscalSettingsView onBack={() => setActiveTab('hub')} />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pt-4 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Módulo Fiscal Central</h2>
          <p className="text-slate-400 text-sm mt-1">Gestão fiscal integrada com SEFAZ e Focus NFe</p>
        </div>
        <div>
          <SefazStatusBadge />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Card: Receber NF (1º Bip) */}
        <button
          onClick={() => setActiveTab('receive')}
          className="md:col-span-2 bg-slate-900 border border-amber-500/40 hover:border-amber-500 hover:bg-slate-800/80 rounded-3xl p-8 text-left transition group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition"></div>
          <div className="flex items-center gap-4 mb-3">
            <Scan className="w-10 h-10 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">1º Bip</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">1º BIP — Receber NF do Fornecedor ⚡</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Bipe a nota recebida para registrar a <strong className="text-slate-300">Ciência da Operação na SEFAZ</strong> e fazer o download do XML. O estoque não é alterado nesta etapa.
          </p>
        </button>

        {/* Card: Importar XML / 2º Bip */}
        <button
          onClick={() => { setChaveParaImportar(null); setActiveTab('import'); }}
          className="bg-slate-900 border border-slate-800 hover:border-emerald-500 hover:bg-slate-800/80 rounded-3xl p-8 text-left transition group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition"></div>
          <FileText className="w-10 h-10 text-emerald-500 mb-6" />
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-bold text-white">2º BIP — Entrada no Estoque</h3>
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">2º Bip</span>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed">
            Bipe a DANFE impressa ou selecione o arquivo .xml para conferir os itens recebidos e dar entrada definitiva no estoque.
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

        
        {/* Card: Reimprimir Nota */}
        <button
          onClick={() => setActiveTab('reprint')}
          className="bg-slate-900 border border-slate-800 hover:border-sky-500 hover:bg-slate-800/80 rounded-3xl p-8 text-left transition group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-3xl group-hover:bg-sky-500/20 transition"></div>
          <div className="w-12 h-12 text-sky-400 mb-6 flex items-center justify-center bg-sky-500/10 rounded-2xl group-hover:scale-110 transition-transform border border-sky-500/20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Reimprimir NFC-e</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Busque o DANFE e o XML de uma nota já emitida na SEFAZ usando o número da nota fiscal.
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

        {/* Card: Inutilizar Numeração */}
        <button
          onClick={() => setShowInutilizacao(true)}
          className="bg-slate-900 border border-slate-800 hover:border-amber-500 hover:bg-slate-800/80 rounded-3xl p-8 text-left transition group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/20 transition"></div>
          <div className="w-10 h-10 text-amber-400 mb-6 flex items-center justify-center bg-amber-500/10 rounded-xl border border-amber-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-bold text-white">Inutilizar Numeração</h3>
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">SEFAZ</span>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed">
            Comunique falhas de numeração ou saltos de notas fiscais à SEFAZ para manter a escrituração 100% legalizada.
          </p>
        </button>

        {/* Card: Consulta NCM & Tributação */}
        <button
          onClick={() => setShowNcmLookup(true)}
          className="bg-slate-900 border border-slate-800 hover:border-blue-500 hover:bg-slate-800/80 rounded-3xl p-8 text-left transition group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/20 transition"></div>
          <div className="w-10 h-10 text-blue-400 mb-6 flex items-center justify-center bg-blue-500/10 rounded-xl border border-blue-500/20">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-bold text-white">Tabela NCM & Alíquotas</h3>
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">IBPT</span>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed">
            Consulte códigos NCM na base oficial da Receita Federal com atalhos para bebidas, alimentos e alíquotas IBPT.
          </p>
        </button>
        
        {/* Card: Painel do Contador */}
        <button
          onClick={() => setActiveTab('accountant')}
          className="md:col-span-2 bg-slate-900 border border-slate-800 hover:border-sky-500 hover:bg-slate-800/80 rounded-3xl p-8 text-left transition group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-sky-500/5 rounded-full blur-3xl group-hover:bg-sky-500/20 transition"></div>
          <div className="flex items-center gap-4 mb-3">
             <div className="w-10 h-10 text-sky-400 flex items-center justify-center bg-sky-500/10 rounded-xl border border-sky-500/20">
               <span className="font-bold">ZIP</span>
             </div>
             <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">Contabilidade</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Painel do Contador (SPED/XMLs e Backups em Nuvem)</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Fechamento do mês: Baixe os pacotes oficiais compactados da Focus NFe na nuvem ou exporte todos os XMLs de notas fiscais de Entrada e Saída em .ZIP para enviar ao contador.
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

      {/* Modais */}
      {showInutilizacao && (
        <NfceInutilizacaoModal onClose={() => setShowInutilizacao(false)} />
      )}

      {showNcmLookup && (
        <NcmLookupModal onClose={() => setShowNcmLookup(false)} />
      )}
    </div>
  );
};
