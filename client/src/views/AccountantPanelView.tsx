import React, { useState, useEffect } from 'react';
import { ArrowLeft, Briefcase, Download, Calendar, Loader2, FileSpreadsheet, ArrowUpRight, ArrowDownLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

interface MonthSummary {
  month: string;
  emitidasCount: number;
  emitidasTotal: number;
  recebidasCount: number;
  recebidasTotal: number;
  hasNotes: boolean;
}

export const AccountantPanelView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isExporting, setIsExporting] = useState(false);
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
      const res = await fetch(`${api.getApiUrl()}/fiscal/export-month?month=${month}`);
      
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
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Painel Fiscal
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl"></div>
        
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
            <Briefcase className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Painel do Contador</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              Gere o pacote mensal completo (.ZIP) com os XMLs de notas fiscais e relatório de fechamento para a contabilidade.
            </p>
          </div>
        </div>

        {/* Seleção de Mês */}
        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 mb-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">Mês de Competência</h3>
                <p className="text-xs text-slate-400">Selecione o mês do fechamento contábil</p>
              </div>
            </div>
            <input 
              type="month" 
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white font-mono px-4 py-2 rounded-xl focus:border-indigo-500 outline-none transition text-sm cursor-pointer"
            />
          </div>

          {/* Cards de Resumo Prévia do Mês */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* Saídas */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-emerald-400">
                  <ArrowUpRight className="w-3.5 h-3.5" /> Saídas (NFC-e)
                </span>
                {isLoadingSummary ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                ) : (
                  <span className="font-mono text-slate-300 font-bold">{summary?.emitidasCount ?? 0} nota(s)</span>
                )}
              </div>
              <div className="text-lg font-black text-white font-mono">
                {isLoadingSummary ? '...' : formatMoney(summary?.emitidasTotal ?? 0)}
              </div>
            </div>

            {/* Entradas */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-amber-400">
                  <ArrowDownLeft className="w-3.5 h-3.5" /> Entradas (Compras)
                </span>
                {isLoadingSummary ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                ) : (
                  <span className="font-mono text-slate-300 font-bold">{summary?.recebidasCount ?? 0} nota(s)</span>
                )}
              </div>
              <div className="text-lg font-black text-white font-mono">
                {isLoadingSummary ? '...' : formatMoney(summary?.recebidasTotal ?? 0)}
              </div>
            </div>
          </div>

          {/* Aviso sobre notas */}
          {summary && !summary.hasNotes && !isLoadingSummary && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-300/90">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <p className="font-bold text-white mb-0.5">Nenhuma nota fiscal encontrada neste mês</p>
                <p>
                  Não foram emitidas NFC-e nem importadas notas de fornecedor em <strong>{month}</strong>. Ao clicar em baixar, o sistema gerará o arquivo ZIP com o relatório fiscal de fechamento oficial demonstrando a movimentação zerada.
                </p>
              </div>
            </div>
          )}

          {summary && summary.hasNotes && !isLoadingSummary && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                <strong>{(summary.emitidasCount || 0) + (summary.recebidasCount || 0)} nota(s)</strong> prontas para empacotamento em ZIP com XMLs separados e relatório em CSV.
              </span>
            </div>
          )}
        </div>

        {/* Botão de Download */}
        <button
          onClick={handleExport}
          disabled={isExporting || !month}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-6 rounded-2xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-indigo-600/20 text-base"
        >
          {isExporting ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Compactando XMLs e Relatório...</>
          ) : (
            <><Download className="w-5 h-5" /> Baixar Fechamento Contábil (.ZIP)</>
          )}
        </button>

        <p className="text-center text-xs text-slate-500 mt-4 flex items-center justify-center gap-1.5">
          <FileSpreadsheet className="w-3.5 h-3.5" /> O arquivo .ZIP inclui pastas separadas para Saídas e Entradas, além de planilha formatada em Excel (.CSV).
        </p>
      </div>
    </div>
  );
};
