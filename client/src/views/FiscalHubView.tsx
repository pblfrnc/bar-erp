import React, { useState } from 'react';
import { Receipt, FileText, ArrowLeft, Settings, Scan, ShieldAlert, BookOpen, Printer, XCircle } from 'lucide-react';
import { FiscalImportView } from './FiscalImportView';
import { EmitNfeView } from './EmitNfeView';
import { FiscalSettingsView } from './FiscalSettingsView';
import { NfReceivingView } from './NfReceivingView';
import { api } from '../services/api';

import { ManualNfceView } from './ManualNfceView';
import { NfceCancelView } from './NfceCancelView';
import { NfeCancelView } from './NfeCancelView';
import { NfceReprintView } from './NfceReprintView';
import { NfeReprintView } from './NfeReprintView';
import { AccountantPanelView } from './AccountantPanelView';
import { SefazStatusBadge } from '../components/SefazStatusBadge';
import { NfceInutilizacaoModal } from './NfceInutilizacaoModal';
import { NfeInutilizacaoModal } from './NfeInutilizacaoModal';
import { NcmLookupModal } from '../components/NcmLookupModal';

export const FiscalHubView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'hub' | 'receive' | 'import' | 'emit' | 'emitNfce' | 'settings' | 'cancelNfce' | 'cancelNfe' | 'reprintNfce' | 'reprintNfe' | 'accountant'>('hub');
  const [chaveParaImportar, setChaveParaImportar] = useState<string | null>(null);
  const [showInutilizacao, setShowInutilizacao] = useState(false);
  const [showInutilizacaoNfe, setShowInutilizacaoNfe] = useState(false);
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
    return <EmitNfeView onBack={() => setActiveTab('hub')} />;
  }

  if (activeTab === 'emitNfce') {
    return <ManualNfceView onBack={() => setActiveTab('hub')} />;
  }

  if (activeTab === 'accountant') {
    return <AccountantPanelView onBack={() => setActiveTab('hub')} />;
  }

  if (activeTab === 'reprintNfce') {
    return <NfceReprintView onBack={() => setActiveTab('hub')} />;
  }

  if (activeTab === 'reprintNfe') {
    return <NfeReprintView onBack={() => setActiveTab('hub')} />;
  }

  if (activeTab === 'cancelNfce') {
    return <NfceCancelView onBack={() => setActiveTab('hub')} />;
  }

  if (activeTab === 'cancelNfe') {
    return <NfeCancelView onBack={() => setActiveTab('hub')} />;
  }

  if (activeTab === 'settings') {
    return <FiscalSettingsView onBack={() => setActiveTab('hub')} />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pt-4 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Módulo Fiscal Central</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gestão fiscal integrada com SEFAZ e Focus NFe</p>
        </div>
        <div>
          <SefazStatusBadge />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ─── SEÇÃO: Recebimento Fiscal ─── */}
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Scan className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Recebimento Fiscal</span>
          </div>
          <div className="flex flex-col gap-4">
            {/* Card: 1º BIP — Ciência da Operação */}
            <button
              onClick={() => setActiveTab('receive')}
              className="w-full bg-white dark:bg-slate-900 border border-amber-500/40 hover:border-amber-500 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-3xl p-8 text-left transition group relative overflow-hidden shadow-xs"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition" />
              <div className="flex items-center gap-4 mb-3">
                <Scan className="w-10 h-10 text-amber-500" />
                <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">1º Bip</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">1º BIP — Receber NF do Fornecedor ⚡</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Bipe a nota recebida para registrar a <strong className="text-slate-900 dark:text-slate-300">Ciência da Operação na SEFAZ</strong> e fazer o download do XML. O estoque não é alterado nesta etapa.
              </p>
            </button>

            {/* Card: 2º BIP — Entrada no Estoque */}
            <button
              onClick={() => { setChaveParaImportar(null); setActiveTab('import'); }}
              className="w-full bg-white dark:bg-slate-900 border border-emerald-500/40 hover:border-emerald-500 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-3xl p-8 text-left transition group relative overflow-hidden shadow-xs"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition" />
              <div className="flex items-center gap-4 mb-3">
                <FileText className="w-10 h-10 text-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">2º Bip</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">2º BIP — Entrada no Estoque</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Bipe a DANFE impressa ou selecione o arquivo <strong className="text-slate-900 dark:text-slate-300">.xml</strong> para conferir os itens recebidos e dar entrada definitiva no estoque.
              </p>
            </button>
          </div>
        </div>

        {/* ─── SEÇÃO: Emissão de Notas ─── */}
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Emissão de Notas</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card: Emitir NF-e */}
            <button
              onClick={() => setActiveTab('emit')}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-3xl p-8 text-left transition group relative overflow-hidden shadow-xs"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition" />
              <div className="w-10 h-10 text-indigo-500 dark:text-indigo-400 mb-4 flex items-center justify-center bg-indigo-500/10 rounded-xl group-hover:scale-110 transition-transform border border-indigo-500/20">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Emitir NF-e</h3>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30">Modelo 55</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                Emissão avulsa de notas fiscais eletrônicas de saída usando a integração Focus NFe.
              </p>
            </button>

            {/* Card: Emitir NFC-e */}
            <button
              onClick={() => setActiveTab('emitNfce')}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-violet-500 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-3xl p-8 text-left transition group relative overflow-hidden shadow-xs"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-3xl group-hover:bg-violet-500/20 transition" />
              <div className="w-10 h-10 text-violet-500 dark:text-violet-400 mb-4 flex items-center justify-center bg-violet-500/10 rounded-xl group-hover:scale-110 transition-transform border border-violet-500/20">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Emitir NFC-e</h3>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-400 border border-violet-500/30">Modelo 65</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                Emissão de cupons fiscais NFC-e para vendas rápidas via Focus NFe.
              </p>
            </button>
          </div>
        </div>

        {/* Seção: Reimpressão */}
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Printer className="w-4 h-4 text-sky-500" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Reimpressão de DANFE</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card: Reimprimir NFC-e */}
            <button
              onClick={() => setActiveTab('reprintNfce')}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-3xl p-6 text-left transition group relative overflow-hidden shadow-xs"
            >
              <div className="absolute top-0 right-0 w-28 h-28 bg-sky-500/5 rounded-full blur-3xl group-hover:bg-sky-500/20 transition" />
              <div className="w-10 h-10 text-sky-500 dark:text-sky-400 mb-4 flex items-center justify-center bg-sky-500/10 rounded-xl group-hover:scale-110 transition-transform border border-sky-500/20">
                <Printer className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Reimprimir NFC-e</h3>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30">Cupom</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                Reimprime o DANFE de cupons fiscais NFC-e já emitidos na SEFAZ por número ou referência.
              </p>
            </button>

            {/* Card: Reimprimir NF-e */}
            <button
              onClick={() => setActiveTab('reprintNfe')}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-3xl p-6 text-left transition group relative overflow-hidden shadow-xs"
            >
              <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition" />
              <div className="w-10 h-10 text-indigo-500 dark:text-indigo-400 mb-4 flex items-center justify-center bg-indigo-500/10 rounded-xl group-hover:scale-110 transition-transform border border-indigo-500/20">
                <Printer className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Reimprimir NF-e</h3>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30">Nota</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                Reimprime o DANFE de notas fiscais NF-e (saída) já autorizadas na SEFAZ por número da nota.
              </p>
            </button>
          </div>
        </div>

        {/* Seção: Cancelamento */}
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="w-4 h-4 text-rose-500" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Cancelamento de Nota Fiscal</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card: Cancelar NFC-e */}
            <button
              onClick={() => setActiveTab('cancelNfce')}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-500 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-3xl p-6 text-left transition group relative overflow-hidden shadow-xs"
            >
              <div className="absolute top-0 right-0 w-28 h-28 bg-rose-500/5 rounded-full blur-3xl group-hover:bg-rose-500/20 transition" />
              <div className="w-10 h-10 text-rose-500 dark:text-rose-400 mb-4 flex items-center justify-center bg-rose-500/10 rounded-xl group-hover:scale-110 transition-transform border border-rose-500/20">
                <XCircle className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Cancelar NFC-e</h3>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">30 min</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                Cancela cupons fiscais NFC-e na SEFAZ. Prazo máximo de <strong className="text-slate-800 dark:text-slate-200">30 minutos</strong> após a emissão.
              </p>
            </button>

            {/* Card: Cancelar NF-e */}
            <button
              onClick={() => setActiveTab('cancelNfe')}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-500 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-3xl p-6 text-left transition group relative overflow-hidden shadow-xs"
            >
              <div className="absolute top-0 right-0 w-28 h-28 bg-rose-500/5 rounded-full blur-3xl group-hover:bg-rose-500/20 transition" />
              <div className="w-10 h-10 text-rose-600 dark:text-rose-500 mb-4 flex items-center justify-center bg-rose-500/10 rounded-xl group-hover:scale-110 transition-transform border border-rose-500/20">
                <XCircle className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Cancelar NF-e</h3>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">24h</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                Cancela notas fiscais NF-e na SEFAZ. Prazo máximo de <strong className="text-slate-800 dark:text-slate-200">24 horas</strong> após autorização.
              </p>
            </button>
          </div>
        </div>

        {/* Seção: Inutilização de Numeração */}
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Inutilização de Numeração</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card: Inutilizar NFC-e */}
            <button
              onClick={() => setShowInutilizacao(true)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-3xl p-6 text-left transition group relative overflow-hidden shadow-xs"
            >
              <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/20 transition" />
              <div className="w-10 h-10 text-amber-500 dark:text-amber-400 mb-4 flex items-center justify-center bg-amber-500/10 rounded-xl group-hover:scale-110 transition-transform border border-amber-500/20">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Inutilizar NFC-e</h3>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">Modelo 65</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                Comunique à SEFAZ saltos de numeração em cupons fiscais NFC-e. Endpoint: <code className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1 rounded">POST /v2/nfce/inutilizacao</code>
              </p>
            </button>

            {/* Card: Inutilizar NF-e */}
            <button
              onClick={() => setShowInutilizacaoNfe(true)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-3xl p-6 text-left transition group relative overflow-hidden shadow-xs"
            >
              <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/20 transition" />
              <div className="w-10 h-10 text-amber-600 dark:text-amber-500 mb-4 flex items-center justify-center bg-amber-500/10 rounded-xl group-hover:scale-110 transition-transform border border-amber-500/20">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Inutilizar NF-e</h3>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">Modelo 55</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                Comunique à SEFAZ saltos de numeração em notas fiscais NF-e (saída). Endpoint: <code className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1 rounded">POST /v2/nfe/inutilizacao</code>
              </p>
            </button>
          </div>
        </div>

        {/* Card: Consulta NCM & Tributação */}
        <button
          onClick={() => setShowNcmLookup(true)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-3xl p-8 text-left transition group relative overflow-hidden shadow-xs"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/20 transition"></div>
          <div className="w-10 h-10 text-blue-500 dark:text-blue-400 mb-6 flex items-center justify-center bg-blue-500/10 rounded-xl border border-blue-500/20">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Tabela NCM & Alíquotas</h3>
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">IBPT</span>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
            Consulte códigos NCM na base oficial da Receita Federal com atalhos para bebidas, alimentos e alíquotas IBPT.
          </p>
        </button>
        
        {/* Card: Painel do Contador */}
        <button
          onClick={() => setActiveTab('accountant')}
          className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-3xl p-8 text-left transition group relative overflow-hidden shadow-xs"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-sky-500/5 rounded-full blur-3xl group-hover:bg-sky-500/20 transition"></div>
          <div className="flex items-center gap-4 mb-3">
             <div className="w-10 h-10 text-sky-500 dark:text-sky-400 flex items-center justify-center bg-sky-500/10 rounded-xl border border-sky-500/20">
               <span className="font-bold">ZIP</span>
             </div>
             <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30">Contabilidade</span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Painel do Contador (SPED/XMLs e Backups em Nuvem)</h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
            Fechamento do mês: Baixe os pacotes oficiais compactados da Focus NFe na nuvem ou exporte todos os XMLs de notas fiscais de Entrada e Saída em .ZIP para enviar ao contador.
          </p>
        </button>
  
        {/* Card: Configurações Fiscais */}
        <button
          onClick={() => setActiveTab('settings')}
          className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-3xl p-6 text-left transition group flex items-center gap-5 shadow-xs"
        >
          <Settings className="w-8 h-8 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition shrink-0" />
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-0.5">Configurações Fiscais</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Token API Focus NFe, Certificado Digital A1 e dados do emitente.</p>
          </div>
        </button>
      </div>

      {/* Modais */}
      {showInutilizacao && (
        <NfceInutilizacaoModal onClose={() => setShowInutilizacao(false)} />
      )}

      {showInutilizacaoNfe && (
        <NfeInutilizacaoModal onClose={() => setShowInutilizacaoNfe(false)} />
      )}

      {showNcmLookup && (
        <NcmLookupModal onClose={() => setShowNcmLookup(false)} />
      )}
    </div>
  );
};
