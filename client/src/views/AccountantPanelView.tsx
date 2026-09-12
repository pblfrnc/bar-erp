import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Briefcase, 
  Download, 
  Calendar, 
  Loader2, 
  FileSpreadsheet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertCircle, 
  CheckCircle2,
  Boxes,
  TrendingUp,
  Tag
} from 'lucide-react';
import { api } from '../services/api';

interface CategoryStockSummary {
  category: string;
  itemsCount: number;
  totalCost: number;
  totalSale: number;
  expectedProfit: number;
  marginPercent: number;
}

interface MonthSummary {
  month: string;
  emitidasCount: number;
  emitidasTotal: number;
  nfceCount?: number;
  nfceTotal?: number;
  nfeCount?: number;
  nfeTotal?: number;
  recebidasCount: number;
  recebidasTotal: number;
  hasNotes: boolean;
  stockCostTotal?: number;
  stockSaleTotal?: number;
  stockProfitTotal?: number;
  categoriesStock?: CategoryStockSummary[];
}

export const AccountantPanelView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isExporting, setIsExporting] = useState(false);
  const [includeStock, setIncludeStock] = useState(false);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  useEffect(() => {
    if (!month) return;
    loadMonthSummary(month);
  }, [month]);

  const loadMonthSummary = async (selectedMonth: string) => {
    try {
      setIsLoadingSummary(true);
      const res = await fetch(`${api.getApiUrl()}/fiscal/month-summary?month=${selectedMonth}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      } else {
        setSummary(null);
      }
    } catch {
      setSummary(null);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(`${api.getApiUrl()}/fiscal/export-month?month=${month}&includeStock=${includeStock}`);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao gerar o pacote ZIP.');
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Fechamento_Contabil_${month}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      alert('Pacote baixado com sucesso! Envie o arquivo ZIP gerado para a sua contabilidade.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const formatMoney = (val: number) => 
    `R$ ${Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 max-w-2xl mx-auto pt-4 pb-20">
      <div className="flex items-center justify-between mb-2">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Painel Fiscal
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 relative overflow-hidden shadow-sm dark:shadow-2xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
            <Briefcase className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Painel do Contador</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
              Gere o pacote mensal completo (.ZIP) com os XMLs de notas fiscais e relatório de fechamento para a contabilidade.
            </p>
          </div>
        </div>

        {/* Seleção de Mês */}
        <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 mb-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-slate-900 dark:text-white font-bold text-sm">Mês de Competência</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Selecione o mês do fechamento contábil</p>
              </div>
            </div>
            <input 
              type="month" 
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono px-4 py-2 rounded-xl focus:border-indigo-500 outline-none transition text-sm cursor-pointer shadow-xs"
            />
          </div>

          {/* Cards de Resumo Prévia do Mês */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {/* Saídas NFC-e (Modelo 65) */}
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-emerald-600 dark:text-emerald-400">
                  <ArrowUpRight className="w-3.5 h-3.5" /> NFC-e (Mod. 65)
                </span>
                {isLoadingSummary ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                ) : (
                  <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">{summary?.nfceCount ?? summary?.emitidasCount ?? 0} nota(s)</span>
                )}
              </div>
              <div className="text-base font-black text-slate-900 dark:text-white font-mono">
                {isLoadingSummary ? '...' : formatMoney(summary?.nfceTotal ?? summary?.emitidasTotal ?? 0)}
              </div>
            </div>

            {/* Saídas NF-e (Modelo 55) */}
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-blue-600 dark:text-blue-400">
                  <ArrowUpRight className="w-3.5 h-3.5" /> NF-e (Mod. 55)
                </span>
                {isLoadingSummary ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                ) : (
                  <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">{summary?.nfeCount ?? 0} nota(s)</span>
                )}
              </div>
              <div className="text-base font-black text-slate-900 dark:text-white font-mono">
                {isLoadingSummary ? '...' : formatMoney(summary?.nfeTotal ?? 0)}
              </div>
            </div>

            {/* Entradas */}
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-amber-600 dark:text-amber-400">
                  <ArrowDownLeft className="w-3.5 h-3.5" /> Entradas (Compras)
                </span>
                {isLoadingSummary ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                ) : (
                  <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">{summary?.recebidasCount ?? 0} nota(s)</span>
                )}
              </div>
              <div className="text-base font-black text-slate-900 dark:text-white font-mono">
                {isLoadingSummary ? '...' : formatMoney(summary?.recebidasTotal ?? 0)}
              </div>
            </div>
          </div>

          {/* Posição de Estoque & Lucro Previsto (SPED Fiscal / Inventário) */}
          {summary?.stockCostTotal !== undefined && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-indigo-500" />
                  Posição de Estoque & Lucro Previsto (SPED)
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                  includeStock 
                    ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}>
                  {includeStock ? 'Será incluído no SPED' : 'Oculto no SPED'}
                </span>
              </div>

              {/* Caixa de Seleção / Checkbox de envio do estoque */}
              <label className={`flex items-start gap-3 p-3 rounded-2xl border transition cursor-pointer select-none ${
                includeStock
                  ? 'bg-indigo-50/70 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 text-indigo-950 dark:text-indigo-200'
                  : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                <input
                  type="checkbox"
                  checked={includeStock}
                  onChange={(e) => setIncludeStock(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 dark:text-white block">
                    Enviar posição do estoque no SPED / Fechamento
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-relaxed">
                    Marque esta opção somente se o inventário físico estiver conferido e corrigido. Se desmarcado, o SPED/fechamento será gerado exclusivamente com as notas fiscais emitidas e recebidas.
                  </span>
                </div>
              </label>

              <div className={`grid grid-cols-1 sm:grid-cols-3 gap-2.5 transition-opacity ${includeStock ? 'opacity-100' : 'opacity-60'}`}>
                <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                    Estoque a Custo
                  </div>
                  <div className="text-sm font-black font-mono text-slate-800 dark:text-slate-200">
                    {formatMoney(summary.stockCostTotal || 0)}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                    Estoque a Venda
                  </div>
                  <div className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {formatMoney(summary.stockSaleTotal || 0)}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 flex items-center justify-between">
                    <span>Lucro Previsto Total</span>
                    <TrendingUp className="w-3 h-3 text-indigo-500" />
                  </div>
                  <div className="text-sm font-black font-mono text-indigo-600 dark:text-indigo-400">
                    {formatMoney(summary.stockProfitTotal || 0)}
                  </div>
                </div>
              </div>

              {/* Categorias */}
              {summary.categoriesStock && summary.categoriesStock.length > 0 && (
                <div className={`bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2 mt-2 transition-opacity ${includeStock ? 'opacity-100' : 'opacity-60'}`}>
                  <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-amber-500" /> Lucro Previsto por Categoria
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {includeStock ? 'Incluído no fechamento CSV' : 'Oculto no fechamento CSV'}
                    </span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {summary.categoriesStock.map((cat, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {cat.category} ({cat.itemsCount} itens)
                        </span>
                        <div className="flex items-center gap-3 font-mono">
                          <span className="text-slate-500 text-[11px]">Custo: {formatMoney(cat.totalCost)}</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                            Lucro: {formatMoney(cat.expectedProfit)} ({cat.marginPercent}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Aviso sobre notas */}
          {summary && !summary.hasNotes && !isLoadingSummary && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300/90">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-bold text-slate-900 dark:text-white mb-0.5">Nenhuma nota fiscal encontrada neste mês</p>
                <p>
                  Não foram emitidas NFC-e nem importadas notas de fornecedor em <strong>{month}</strong>. Ao clicar em baixar, o sistema gerará o arquivo ZIP com o relatório fiscal de fechamento oficial demonstrando a movimentação zerada.
                </p>
              </div>
            </div>
          )}

          {summary && summary.hasNotes && !isLoadingSummary && (
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                <strong>{(summary.emitidasCount || 0) + (summary.recebidasCount || 0)} nota(s)</strong> prontas para empacotamento em ZIP com XMLs separados e relatório em CSV.
              </span>
            </div>
          )}
        </div>

        {/* Botão de Download Local */}
        <button
          onClick={handleExport}
          disabled={isExporting || !month}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-6 rounded-2xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-indigo-600/20 text-base cursor-pointer"
        >
          {isExporting ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Compactando XMLs e Relatório...</>
          ) : (
            <><Download className="w-5 h-5" /> Baixar Fechamento Contábil Local (.ZIP)</>
          )}
        </button>

        <p className="text-center text-xs text-slate-500 mt-4 flex items-center justify-center gap-1.5">
          <FileSpreadsheet className="w-3.5 h-3.5" /> O arquivo .ZIP local inclui XMLs de Saídas/Entradas e planilha formatada para o contador (.CSV).
        </p>
      </div>

      {/* Seção Focus NFe: Backups Oficiais em Nuvem */}
      <FocusCloudBackupsSection />
    </div>
  );
};

function FocusCloudBackupsSection() {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFocusBackups = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${api.getApiUrl()}/fiscal/focus-backups`);
      const data = await res.json();
      if (res.ok) {
        setBackups(Array.isArray(data.backups) ? data.backups : []);
        if (data.backups?.length === 0 && data.mensagem) {
          setError(data.mensagem);
        }
      } else {
        setError(data.error || 'Erro ao carregar backups da Focus NFe.');
      }
    } catch (e: any) {
      setError(e.message || 'Falha de conexão com a Focus NFe.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFocusBackups();
  }, []);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 relative overflow-hidden shadow-sm dark:shadow-2xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-xl border border-sky-100 dark:border-sky-500/20">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Backups Oficiais em Nuvem (Focus NFe)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Pacotes mensais e semanais compilados automaticamente pelos servidores da Focus</p>
          </div>
        </div>
        <button
          onClick={loadFocusBackups}
          disabled={loading}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          <span>Atualizar Nuvem</span>
        </button>
      </div>

      {loading && (
        <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-xs flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-sky-500 dark:text-sky-400" />
          <span>Consultando arquivos compactados na Focus NFe...</span>
        </div>
      )}

      {error && !loading && (
        <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 text-xs text-slate-600 dark:text-slate-400">
          <p className="font-semibold text-slate-800 dark:text-slate-300">{error}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Os backups mensais da Focus NFe são gerados automaticamente a cada virada de mês (ou aos sábados). Enquanto não houver lote fechado, utilize o botão de fechamento contábil acima.
          </p>
        </div>
      )}

      {!loading && backups.length > 0 && (
        <div className="space-y-3">
          {backups.map((b: any, idx: number) => {
            const label = b.referencia || `${b.ano || ''}-${String(b.mes || '').padStart(2, '0')}`;
            return (
              <div key={idx} className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-mono font-bold text-xs border border-sky-200 dark:border-transparent">
                    {b.mes ? String(b.mes).padStart(2, '0') : 'NF'}
                  </div>
                  <div>
                    <h4 className="text-slate-900 dark:text-white font-bold text-sm">Competência {label}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Pacote oficial homologado com DANFEs e XMLs</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {b.xmls && (
                    <a
                      href={b.xmls}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-sky-50 dark:bg-sky-600/20 hover:bg-sky-100 dark:hover:bg-sky-600/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Baixar XMLs
                    </a>
                  )}
                  {b.danfes && (
                    <a
                      href={b.danfes}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-600/20 hover:bg-indigo-100 dark:hover:bg-indigo-600/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Baixar DANFEs
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
