import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Package,
  FileText,
  Scan,
  CheckCircle,
  AlertCircle,
  Clock,
  Download,
  ExternalLink,
  Copy,
  Check,
  Building2
} from 'lucide-react';
import { api } from '../services/api';

export interface PendingInvoice {
  id: string;
  chave: string;
  emitente: string;
  cnpjEmitente: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  valorTotal: number;
  status: 'pendente' | 'recebida' | 'finalizada';
  hasXml: boolean;
  createdAt: string;
}

interface PendingInvoicesSummary {
  total: number;
  pendentes: number;
  recebidas: number;
  finalizadas: number;
  comXml: number;
  semXml: number;
}

interface PendingInvoicesViewProps {
  onBack: () => void;
  onIrParaPrimeiroBip?: (chave?: string) => void;
  onIrParaSegundoBip: (chave: string) => void;
}

export const PendingInvoicesView: React.FC<PendingInvoicesViewProps> = ({
  onBack,
  onIrParaPrimeiroBip,
  onIrParaSegundoBip
}) => {
  const [notas, setNotas] = useState<PendingInvoice[]>([]);
  const [summary, setSummary] = useState<PendingInvoicesSummary>({
    total: 0,
    pendentes: 0,
    recebidas: 0,
    finalizadas: 0,
    comXml: 0,
    semXml: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filtros
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendente' | 'recebida' | 'finalizada'>('todos');
  const [xmlFilter, setXmlFilter] = useState<'todos' | 'com_xml' | 'sem_xml'>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Ações por nota
  const [actionLoadingChave, setActionLoadingChave] = useState<string | null>(null);
  const [copiedChave, setCopiedChave] = useState<string | null>(null);

  useEffect(() => {
    loadNotas();
  }, [statusFilter, xmlFilter, dataInicio, dataFim]);

  const loadNotas = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'todos') params.append('status', statusFilter);
      if (xmlFilter !== 'todos') params.append('xmlStatus', xmlFilter);
      if (dataInicio) params.append('dataInicio', dataInicio);
      if (dataFim) params.append('dataFim', dataFim);
      if (searchQuery.trim()) params.append('fornecedor', searchQuery.trim());

      const res = await fetch(`${api.getApiUrl()}/fiscal/notas-pendentes?${params.toString()}`);
      if (!res.ok) throw new Error('Falha ao buscar notas pendentes');
      const data = await res.json();
      setNotas(data.notas || []);
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err: any) {
      console.error('Erro ao carregar notas pendentes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadNotas();
  };

  const handleSyncSefaz = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await fetch(`${api.getApiUrl()}/fiscal/sync-nfe-recebidas`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao sincronizar com SEFAZ');
      setSyncFeedback({
        type: 'success',
        message: data.message || 'Sincronização concluída com sucesso!'
      });
      await loadNotas();
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Erro de conexão ao consultar a SEFAZ.'
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 7000);
    }
  };

  const handleReceberNota = async (chave: string) => {
    if (!confirm('Deseja registrar o 1º BIP para esta nota? O sistema registrará a Ciência da Operação na SEFAZ e atualizará o status para Recebida.')) {
      return;
    }
    setActionLoadingChave(chave);
    try {
      const res = await fetch(`${api.getApiUrl()}/fiscal/notas-pendentes/${chave}/receber`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao receber nota.');
      alert(data.message || 'Nota recebida com sucesso!');
      await loadNotas();
    } catch (err: any) {
      alert('Falha ao receber nota: ' + (err.message || err));
    } finally {
      setActionLoadingChave(null);
    }
  };

  const handleFinalizarNota = async (chave: string) => {
    if (!confirm('Deseja marcar esta nota fiscal como FINALIZADA?\n\nFaça isso se você já deu entrada física ou anterior nas mercadorias desta nota no estoque.')) {
      return;
    }
    setActionLoadingChave(chave);
    try {
      const res = await fetch(`${api.getApiUrl()}/fiscal/notas-pendentes/${chave}/finalizar`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao finalizar nota.');
      await loadNotas();
    } catch (err: any) {
      alert('Falha ao finalizar nota: ' + (err.message || err));
    } finally {
      setActionLoadingChave(null);
    }
  };

  const handleReabrirNota = async (chave: string) => {
    if (!confirm('Deseja reabrir esta nota para conferência (2º Bip)?')) {
      return;
    }
    setActionLoadingChave(chave);
    try {
      const res = await fetch(`${api.getApiUrl()}/fiscal/notas-pendentes/${chave}/reabrir`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao reabrir nota.');
      await loadNotas();
    } catch (err: any) {
      alert('Falha ao reabrir nota: ' + (err.message || err));
    } finally {
      setActionLoadingChave(null);
    }
  };

  const handleSyncSingleNota = async (chave: string) => {
    setActionLoadingChave(chave);
    try {
      const res = await fetch(`${api.getApiUrl()}/fiscal/notas-recebidas/${chave}/sync`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao buscar XML.');
      alert(data.message || 'Consulta SEFAZ finalizada.');
      await loadNotas();
    } catch (err: any) {
      alert('Falha ao buscar XML: ' + (err.message || err));
    } finally {
      setActionLoadingChave(null);
    }
  };

  const handleDownloadXml = async (chave: string) => {
    try {
      const res = await fetch(`${api.getApiUrl()}/fiscal/notas-recebidas/${chave}/xml`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'XML não disponível no momento.');
      }
      const xmlText = await res.text();
      const blob = new Blob([xmlText], { type: 'application/xml;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NFe_${chave}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert('Erro ao baixar XML: ' + err.message);
    }
  };

  const handleViewDanfe = (chave: string) => {
    window.open(`${api.getApiUrl()}/fiscal/danfe/${chave}`, '_blank');
  };

  const handleCopyChave = (chave: string) => {
    navigator.clipboard.writeText(chave);
    setCopiedChave(chave);
    setTimeout(() => setCopiedChave(null), 2500);
  };

  const formatChave = (c: string) => {
    return c.replace(/(\d{4})/g, '$1 ').trim();
  };

  const formatCnpj = (doc: string) => {
    const clean = (doc || '').replace(/\D/g, '');
    if (clean.length === 14) {
      return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    if (clean.length === 11) {
      return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    }
    return doc;
  };

  const formatMoney = (v: number) => {
    return `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (d: string) => {
    if (!d) return '-';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return d;
      return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return d;
    }
  };

  // Atalhos rápidos de data
  const handleQuickDate = (type: 'hoje' | '7d' | '30d' | 'mes' | 'limpar') => {
    if (type === 'limpar') {
      setDataInicio('');
      setDataFim('');
      return;
    }
    const today = new Date();
    const toDateStr = (d: Date) => d.toISOString().substring(0, 10);

    setDataFim(toDateStr(today));
    if (type === 'hoje') {
      setDataInicio(toDateStr(today));
    } else if (type === '7d') {
      const past = new Date();
      past.setDate(today.getDate() - 7);
      setDataInicio(toDateStr(past));
    } else if (type === '30d') {
      const past = new Date();
      past.setDate(today.getDate() - 30);
      setDataInicio(toDateStr(past));
    } else if (type === 'mes') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setDataInicio(toDateStr(firstDay));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pt-4 pb-24 px-3 sm:px-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer mb-2 font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao Módulo Fiscal
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 rounded-2xl text-amber-600 dark:text-amber-400">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Notas Fiscais Pendentes (DF-e)
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Monitoramento das notas emitidas contra o CNPJ da sua empresa na SEFAZ.
              </p>
            </div>
          </div>
        </div>

        {/* Botão Sincronizar com SEFAZ */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncSefaz}
            disabled={isSyncing}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-50 active:scale-95 whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando SEFAZ...' : 'Sincronizar com SEFAZ'}
          </button>
        </div>
      </div>

      {/* Feedback Toast Banner */}
      {syncFeedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm font-semibold transition animate-in fade-in ${
            syncFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-500/30 text-red-800 dark:text-red-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {syncFeedback.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span>{syncFeedback.message}</span>
          </div>
          <button
            onClick={() => setSyncFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100 cursor-pointer px-2 py-1"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total de Notas</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{summary.total}</p>
          <p className="text-[11px] text-slate-500 mt-1">Notas capturadas da SEFAZ</p>
        </div>

        {/* Pendentes */}
        <div
          onClick={() => setStatusFilter('pendente')}
          className={`cursor-pointer bg-white dark:bg-slate-900 border rounded-3xl p-5 shadow-xs transition hover:border-amber-500 ${
            statusFilter === 'pendente' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Pendentes</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">{summary.pendentes}</p>
          <p className="text-[11px] text-slate-500 mt-1">Aguardando 1º BIP</p>
        </div>

        {/* Recebidas */}
        <div
          onClick={() => setStatusFilter('recebida')}
          className={`cursor-pointer bg-white dark:bg-slate-900 border rounded-3xl p-5 shadow-xs transition hover:border-blue-500 ${
            statusFilter === 'recebida' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Recebidas</span>
            <Scan className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">{summary.recebidas}</p>
          <p className="text-[11px] text-slate-500 mt-1">1º BIP OK • Aguardando 2º BIP</p>
        </div>

        {/* Finalizadas */}
        <div
          onClick={() => setStatusFilter('finalizada')}
          className={`cursor-pointer bg-white dark:bg-slate-900 border rounded-3xl p-5 shadow-xs transition hover:border-emerald-500 ${
            statusFilter === 'finalizada' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Finalizadas</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">{summary.finalizadas}</p>
          <p className="text-[11px] text-slate-500 mt-1">Entrada no Estoque Realizada</p>
        </div>
      </div>

      {/* Painel de Filtros e Busca */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        {/* Barra superior de status tabs e xml filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          {/* Tabs de Status */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl flex-wrap">
            {(
              [
                { key: 'todos', label: 'Todas as Notas', count: summary.total },
                { key: 'pendente', label: 'Pendentes (1º Bip)', count: summary.pendentes },
                { key: 'recebida', label: 'Recebidas (2º Bip)', count: summary.recebidas },
                { key: 'finalizada', label: 'Finalizadas', count: summary.finalizadas }
              ] as const
            ).map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === tab.key
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 font-mono">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Filtro do XML (Bolinhas Verde e Amarela) */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <button
              onClick={() => setXmlFilter('todos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                xmlFilter === 'todos'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Todos XMLs
            </button>
            <button
              onClick={() => setXmlFilter('com_xml')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                xmlFilter === 'com_xml'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 hover:text-emerald-600 dark:text-slate-400'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              XML Baixado ({summary.comXml})
            </button>
            <button
              onClick={() => setXmlFilter('sem_xml')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                xmlFilter === 'sem_xml'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-500 hover:text-amber-600 dark:text-slate-400'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              XML Pendente ({summary.semXml})
            </button>
          </div>
        </div>

        {/* Linha de Busca e Intervalo de Datas */}
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Campo de Busca por Fornecedor / Chave / Número */}
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por Fornecedor, CNPJ, Número da Nota ou Chave..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-amber-500 transition shadow-xs"
            />
          </div>

          {/* Data Início */}
          <div className="md:col-span-2">
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              title="Data Início"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500 transition shadow-xs"
            />
          </div>

          {/* Data Fim */}
          <div className="md:col-span-2">
            <input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              title="Data Fim"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500 transition shadow-xs"
            />
          </div>

          {/* Botão Filtrar */}
          <div className="md:col-span-2 flex items-center gap-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Filter className="w-3.5 h-3.5" /> Filtrar
            </button>
            {(dataInicio || dataFim || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setDataInicio('');
                  setDataFim('');
                  setSearchQuery('');
                  setTimeout(loadNotas, 50);
                }}
                className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                title="Limpar Filtros"
              >
                Limpar
              </button>
            )}
          </div>
        </form>

        {/* Atalhos Rápidos de Data */}
        <div className="flex items-center gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
          <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Período rápido:
          </span>
          <button
            type="button"
            onClick={() => handleQuickDate('hoje')}
            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer font-medium"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => handleQuickDate('7d')}
            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer font-medium"
          >
            Últimos 7 dias
          </button>
          <button
            type="button"
            onClick={() => handleQuickDate('30d')}
            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer font-medium"
          >
            Últimos 30 dias
          </button>
          <button
            type="button"
            onClick={() => handleQuickDate('mes')}
            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer font-medium"
          >
            Este Mês
          </button>
        </div>
      </div>

      {/* Legenda Informativa das Bolinhas */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">Bolinha Verde:</span> XML baixado e pronto para entrada
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">Bolinha Amarela:</span> XML pendente de liberação SEFAZ
          </div>
        </div>
        <div className="text-[11px] text-slate-400">
          Exibindo {notas.length} de {summary.total} notas
        </div>
      </div>

      {/* Lista de Notas Fiscais */}
      {isLoading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center shadow-xs">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-3" />
          <p className="text-sm font-bold text-slate-900 dark:text-white">Carregando notas pendentes...</p>
          <p className="text-xs text-slate-500 mt-1">Consultando registros e status fiscais</p>
        </div>
      ) : notas.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center shadow-xs space-y-4">
          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto text-amber-500">
            <Package className="w-8 h-8 opacity-60" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhuma nota fiscal encontrada</h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Nenhuma nota corresponde aos filtros atuais. Você pode clicar no botão de sincronização para consultar se há novas emissões contra seu CNPJ na SEFAZ.
            </p>
          </div>
          <button
            onClick={handleSyncSefaz}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Sincronizar Agora com SEFAZ
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {notas.map(nota => {
            const isPendente = nota.status === 'pendente';
            const isRecebida = nota.status === 'recebida';
            const isFinalizada = nota.status === 'finalizada';

            return (
              <div
                key={nota.id || nota.chave}
                className={`bg-white dark:bg-slate-900 border rounded-3xl p-5 sm:p-6 shadow-xs transition hover:shadow-md ${
                  isPendente
                    ? 'border-amber-500/30 dark:border-amber-500/20 bg-gradient-to-r from-amber-50/10 via-transparent to-transparent'
                    : isRecebida
                      ? 'border-blue-500/30 dark:border-blue-500/20 bg-gradient-to-r from-blue-50/10 via-transparent to-transparent'
                      : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Informações Principais da Nota */}
                  <div className="space-y-2 flex-1 min-w-0">
                    {/* Linha 1: Badges de XML e Status */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Indicador de XML (Bolinha Verde ou Amarela) */}
                      {nota.hasXml ? (
                        <div
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold"
                          title="XML completo baixado e disponível para entrada no estoque"
                        >
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                          </span>
                          XML Baixado
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-400 text-[11px] font-bold"
                          title="XML ainda não disponibilizado pela SEFAZ"
                        >
                          <span className="inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
                          XML Pendente
                        </div>
                      )}

                      {/* Badge do Status da Nota */}
                      {isPendente && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Pendente (Aguardando 1º Bip)
                        </span>
                      )}
                      {isRecebida && (
                        <span className="px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-400 text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                          <Scan className="w-3 h-3" /> Recebida (Aguardando 2º Bip)
                        </span>
                      )}
                      {isFinalizada && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Finalizada (No Estoque)
                        </span>
                      )}

                      {/* Identificação de NF e Série */}
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        NF {nota.numero || 'S/N'} • Série {nota.serie || '1'}
                      </span>
                    </div>

                    {/* Linha 2: Fornecedor e CNPJ */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                      <h4 className="text-base font-black text-slate-900 dark:text-white truncate">
                        {nota.emitente || 'Fornecedor'}
                      </h4>
                      {nota.cnpjEmitente && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          • CNPJ: {formatCnpj(nota.cnpjEmitente)}
                        </span>
                      )}
                    </div>

                    {/* Linha 3: Chave de Acesso */}
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      <span className="font-mono bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px]">
                        {formatChave(nota.chave)}
                      </span>
                      <button
                        onClick={() => handleCopyChave(nota.chave)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        title="Copiar Chave de Acesso"
                      >
                        {copiedChave === nota.chave ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span>Emissão: <strong>{formatDate(nota.dataEmissao)}</strong></span>
                    </div>
                  </div>

                  {/* Valor Total e Ações */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="text-left lg:text-right">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Valor Total</span>
                      <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                        {formatMoney(nota.valorTotal)}
                      </span>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {/* Se Pendente: Botão para dar 1º Bip com 1 clique */}
                      {isPendente && (
                        <button
                          onClick={() => handleReceberNota(nota.chave)}
                          disabled={actionLoadingChave === nota.chave}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-500/10 active:scale-95 disabled:opacity-50"
                        >
                          {actionLoadingChave === nota.chave ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Scan className="w-3.5 h-3.5" />
                          )}
                          Receber (1º Bip)
                        </button>
                      )}

                      {/* Se Recebida ou Com XML: Botão para 2º Bip (Conferir e Dar Entrada) */}
                      {(isRecebida || (isPendente && nota.hasXml)) && !isFinalizada && (
                        <button
                          onClick={() => onIrParaSegundoBip(nota.chave)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95"
                          title="Conferir itens e dar entrada definitiva no estoque"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          2º Bip (Entrada Estoque) →
                        </button>
                      )}

                      {/* Se Pendente ou Recebida: Opção rápida caso a entrada já tenha sido realizada antes */}
                      {!isFinalizada && (
                        <button
                          onClick={() => handleFinalizarNota(nota.chave)}
                          disabled={actionLoadingChave === nota.chave}
                          className="px-3 py-2 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-600 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                          title="Marcar como Finalizada se a entrada no estoque já foi efetuada"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Já dei entrada</span>
                        </button>
                      )}

                      {/* Se Finalizada: Opção de Reabrir caso precise reconferir */}
                      {isFinalizada && (
                        <button
                          onClick={() => handleReabrirNota(nota.chave)}
                          disabled={actionLoadingChave === nota.chave}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-semibold text-xs rounded-xl transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                          title="Reabrir nota para nova conferência no estoque"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Reabrir</span>
                        </button>
                      )}

                      {/* Se XML Pendente: Botão para buscar XML */}
                      {!nota.hasXml && (
                        <button
                          onClick={() => handleSyncSingleNota(nota.chave)}
                          disabled={actionLoadingChave === nota.chave}
                          className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition cursor-pointer text-xs font-semibold flex items-center gap-1"
                          title="Consultar se a SEFAZ já liberou o XML desta nota"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${actionLoadingChave === nota.chave ? 'animate-spin text-amber-500' : ''}`} />
                          <span className="hidden sm:inline">Buscar XML</span>
                        </button>
                      )}

                      {/* Se XML Baixado: Botão Download XML e DANFE */}
                      {nota.hasXml && (
                        <>
                          <button
                            onClick={() => handleDownloadXml(nota.chave)}
                            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition cursor-pointer"
                            title="Baixar Arquivo XML"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleViewDanfe(nota.chave)}
                            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition cursor-pointer"
                            title="Visualizar DANFE em PDF"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
