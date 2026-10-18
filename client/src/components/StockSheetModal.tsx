import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Loader2, Printer, X } from 'lucide-react';
import { Category, Product } from '../types';
import { api } from '../services/api';
import { buildStockSheetHtml, exportStockSheet, stockSheetProducts, StockSheetOrder } from '../utils/stockSheet';

const ORDERS: { id: StockSheetOrder; label: string; hint: string }[] = [
  { id: 'alpha', label: 'Alfabética', hint: 'Todos os produtos de A a Z' },
  { id: 'category', label: 'Por categoria', hint: 'Agrupado por categoria, A a Z dentro de cada uma' }
];

// Folha de balanço/preços em PDF para imprimir e preencher à mão
export const StockSheetModal: React.FC<{ products: Product[]; categories: Category[]; onClose: () => void }> = ({
  products,
  categories,
  onClose
}) => {
  const [categoryId, setCategoryId] = useState<string>('ALL');
  const [order, setOrder] = useState<StockSheetOrder>('alpha');
  const [showCost, setShowCost] = useState(true);
  const [storeName, setStoreName] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api
      .getSystemSettings()
      .then((s) => setStoreName(s?.restaurantName || ''))
      .catch(() => {});
  }, []);

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.sortOrder - b.sortOrder), [categories]);
  const count = useMemo(
    () => stockSheetProducts(products, categories, { categoryId, order }).reduce((n, g) => n + g.products.length, 0),
    [products, categories, categoryId, order]
  );

  const handleExport = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const opts = { storeName: storeName || 'BarERP', categoryId, order, showCost };
      const html = buildStockSheetHtml(products, categories, opts);
      const result = await exportStockSheet(html, opts, categories.find((c) => c.id === categoryId)?.name || '');
      if (result.error) setFeedback({ type: 'error', text: result.error });
      else if (result.success) setFeedback({ type: 'ok', text: `PDF gerado com ${count} produtos.` });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Erro ao gerar o PDF.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl my-auto">
        <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Folha de Balanço (PDF)</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Imprima, anote a contagem e os preços novos à mão e depois lance no sistema.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <label className="block space-y-1.5">
            <span className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400">Categoria</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:border-amber-500 outline-none cursor-pointer"
            >
              <option value="ALL">Todas as categorias</option>
              {sortedCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-1.5">
            <span className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400">Ordem</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ORDERS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOrder(o.id)}
                  aria-pressed={order === o.id}
                  className={`text-left rounded-xl border px-3 py-2.5 transition cursor-pointer ${
                    order === o.id
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span className="block text-sm font-bold text-slate-900 dark:text-white">{o.label}</span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">{o.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showCost}
              onChange={(e) => setShowCost(e.target.checked)}
              className="w-4 h-4 accent-amber-500 cursor-pointer"
            />
            <span className="text-sm text-slate-700 dark:text-slate-200">
              Mostrar preço de custo <span className="text-xs text-slate-500">(desmarque se a folha for para funcionários)</span>
            </span>
          </label>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            A folha traz código, produto, unidade, estoque atual, <b>Contagem</b> em branco, {showCost ? 'custo, ' : ''}preço atual e{' '}
            <b>Novo preço</b> em branco.
          </p>

          {feedback && (
            <p
              className={`text-xs font-semibold ${
                feedback.type === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {feedback.text}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-2 p-5 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-black transition cursor-pointer"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={busy || count === 0}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition disabled:opacity-50 cursor-pointer shadow-md shadow-amber-500/20"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            {count === 0 ? 'Nenhum produto' : `Gerar PDF (${count} produtos)`}
          </button>
        </div>
      </div>
    </div>
  );
};
