import React, { useState } from 'react';
import { ArrowLeft, Briefcase, Download, Calendar, Loader2 } from 'lucide-react';
import { api } from '../services/api';

export const AccountantPanelView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    // Default to current month YYYY-MM
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isExporting, setIsExporting] = useState(false);

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

  return (
    <div className="space-y-6 max-w-2xl mx-auto pt-4 pb-20">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl"></div>
        
        <div className="flex items-center gap-4 mb-8">
          <Briefcase className="w-10 h-10 text-indigo-500" />
          <div>
            <h2 className="text-2xl font-black text-white">Painel do Contador</h2>
            <p className="text-slate-400 text-sm mt-1">Gere o fechamento do mês para enviar à sua contabilidade.</p>
          </div>
        </div>

        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-bold mb-2">Selecione o Mês de Referência</h3>
              <input 
                type="month" 
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white px-4 py-2 rounded-xl focus:border-indigo-500 outline-none transition"
              />
              <p className="text-xs text-slate-500 mt-3">
                O sistema irá varrer todas as Notas de Entrada (Compras) e Notas de Saída (NFC-e) emitidas neste mês, agrupá-las em um arquivo ZIP com as pastas separadas e incluir uma planilha de resumo.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting || !month}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-6 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Compactando Arquivos na Nuvem...</>
          ) : (
            <><Download className="w-5 h-5" /> Baixar Fechamento (.ZIP)</>
          )}
        </button>

      </div>
    </div>
  );
};
