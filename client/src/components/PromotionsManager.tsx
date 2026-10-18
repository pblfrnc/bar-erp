import React, { useEffect, useMemo, useState } from 'react';
import { BadgePercent, Check, Edit2, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { Category, Product, Promotion } from '../types';
import { api } from '../services/api';
import { describePromotion, WEEKDAY_LABELS } from '../utils/pricing';

interface PromotionDraft {
  id?: string;
  name: string;
  isActive: boolean;
  days: number[];
  startTime: string;
  endTime: string;
  discountType: 'PERCENT' | 'FIXED_PRICE';
  value: string;
  productIds: string[];
  categoryIds: string[];
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKEND = [5, 6, 0];

const parseIds = (json: string): string[] => {
  try {
    const list = JSON.parse(json || '[]');
    return Array.isArray(list) ? list.map(String) : [];
  } catch {
    return [];
  }
};

const parseDays = (days: string) =>
  String(days || '').split(',').map((d) => parseInt(d, 10)).filter((d) => !isNaN(d));

const toDraft = (p: Promotion): PromotionDraft => ({
  id: p.id,
  name: p.name,
  isActive: p.isActive,
  days: parseDays(p.daysOfWeek),
  startTime: p.startTime,
  endTime: p.endTime,
  discountType: p.discountType,
  value: String(p.value),
  productIds: parseIds(p.productIds),
  categoryIds: parseIds(p.categoryIds)
});

const toPayload = (d: PromotionDraft) => ({
  id: d.id,
  name: d.name.trim(),
  isActive: d.isActive,
  daysOfWeek: [...d.days].sort(),
  startTime: d.startTime,
  endTime: d.endTime,
  discountType: d.discountType,
  value: parseFloat(d.value.replace(',', '.')) || 0,
  productIds: d.productIds,
  categoryIds: d.categoryIds
});

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

const inputClass =
  'w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-xl py-2.5 px-3 focus:border-amber-500 outline-none transition';

const chipClass = (on: boolean) =>
  `px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
    on
      ? 'bg-amber-500 text-slate-950 border-amber-500'
      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-500/50'
  }`;

// Promoções do dia / Happy Hour: desconto em % ou preço fixo, por dia da semana e horário
export const PromotionsManager: React.FC<{ products: Product[]; categories: Category[]; onClose: () => void }> = ({ products, categories, onClose }) => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<PromotionDraft | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setPromotions(await api.getPromotions());
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar as promoções.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const searchResults = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => p.isActive !== false && (p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)))
      .slice(0, 30);
  }, [products, productSearch]);

  // Prévia com até 3 produtos afetados (selecionados direto ou pela categoria)
  const preview = useMemo(() => {
    if (!draft) return [];
    const value = parseFloat(draft.value.replace(',', '.')) || 0;
    const affected = products.filter((p) => draft.productIds.includes(p.id) || draft.categoryIds.includes(p.categoryId));
    return affected.slice(0, 3).map((p) => {
      const price = draft.discountType === 'FIXED_PRICE' ? value : p.price * (1 - Math.min(100, Math.max(0, value)) / 100);
      return { name: p.name, from: p.price, to: Math.round(price * 100) / 100 };
    });
  }, [draft, products]);

  const affectedCount = draft
    ? products.filter((p) => draft.productIds.includes(p.id) || draft.categoryIds.includes(p.categoryId)).length
    : 0;

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const handleSave = async () => {
    if (!draft) return;
    setError(null);
    const value = parseFloat(draft.value.replace(',', '.'));
    if (!draft.name.trim()) return setError('Dê um nome à promoção (ex.: Happy Hour do Chopp).');
    if (isNaN(value) || value <= 0) return setError('Informe o valor do desconto.');
    if (draft.discountType === 'PERCENT' && value >= 100) return setError('O desconto em % precisa ser menor que 100.');
    if (draft.days.length === 0) return setError('Escolha pelo menos um dia da semana.');
    if (!draft.startTime || !draft.endTime) return setError('Informe o horário de início e fim.');
    if (draft.productIds.length === 0 && draft.categoryIds.length === 0) return setError('Escolha os produtos ou categorias da promoção.');

    setSaving(true);
    try {
      await api.savePromotion(toPayload(draft));
      setDraft(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar a promoção.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (p: Promotion) => {
    setError(null);
    try {
      await api.savePromotion(toPayload({ ...toDraft(p), isActive: !p.isActive }));
      await load();
    } catch (err: any) {
      setError(err?.message || 'Erro ao atualizar a promoção.');
    }
  };

  const handleDelete = async (p: Promotion) => {
    if (!window.confirm(`Excluir a promoção "${p.name}"?`)) return;
    setError(null);
    try {
      await api.deletePromotion(p.id);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Erro ao excluir a promoção.');
    }
  };

  const targetsLabel = (p: Promotion) => {
    const names = [
      ...parseIds(p.categoryIds).map((id) => categoryById.get(id)?.name).filter(Boolean).map((n) => `Categoria ${n}`),
      ...parseIds(p.productIds).map((id) => productById.get(id)?.name).filter(Boolean)
    ];
    return names.length > 4 ? `${names.slice(0, 4).join(', ')} e mais ${names.length - 4}` : names.join(', ');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl my-auto">
        <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <BadgePercent className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Promoções do Dia</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Happy hour e preços especiais por dia da semana e horário. O desconto entra sozinho ao lançar o pedido.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" title="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {draft ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="sm:col-span-3 space-y-1">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Nome da promoção</span>
                  <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Happy Hour do Chopp" autoFocus />
                </label>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Tipo</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setDraft({ ...draft, discountType: 'PERCENT' })} className={chipClass(draft.discountType === 'PERCENT')}>% de desconto</button>
                    <button type="button" onClick={() => setDraft({ ...draft, discountType: 'FIXED_PRICE' })} className={chipClass(draft.discountType === 'FIXED_PRICE')}>Preço fixo</button>
                  </div>
                </div>
                <label className="space-y-1">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{draft.discountType === 'PERCENT' ? 'Desconto (%)' : 'Preço promocional (R$)'}</span>
                  <input type="text" inputMode="decimal" className={`${inputClass} font-mono`} value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} placeholder={draft.discountType === 'PERCENT' ? 'Ex.: 25' : 'Ex.: 9,90'} />
                </label>
                <label className="flex items-end gap-2 pb-2.5 cursor-pointer">
                  <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} className="w-4 h-4 accent-amber-500" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Promoção ativa</span>
                </label>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Dias da semana</span>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_LABELS.map((label, day) => (
                    <button key={label} type="button" onClick={() => setDraft({ ...draft, days: draft.days.includes(day) ? draft.days.filter((d) => d !== day) : [...draft.days, day] })} className={chipClass(draft.days.includes(day))}>
                      {label}
                    </button>
                  ))}
                  <span className="w-px bg-slate-200 dark:bg-slate-700 mx-1" />
                  <button type="button" onClick={() => setDraft({ ...draft, days: ALL_DAYS })} className={chipClass(false)}>Todos</button>
                  <button type="button" onClick={() => setDraft({ ...draft, days: WEEKEND })} className={chipClass(false)}>Fim de semana</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
                <label className="space-y-1">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Início</span>
                  <input type="time" className={inputClass} value={draft.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Fim</span>
                  <input type="time" className={inputClass} value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} />
                </label>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-2">Fim menor que início = vira a noite, ex.: 18:00 às 02:00.</p>

              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Categorias inteiras</span>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <button key={c.id} type="button" onClick={() => setDraft({ ...draft, categoryIds: toggle(draft.categoryIds, c.id) })} className={chipClass(draft.categoryIds.includes(c.id))}>
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Produtos</span>
                {draft.productIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {draft.productIds.map((id) => (
                      <span key={id} className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 text-xs font-bold">
                        {productById.get(id)?.name || 'Produto removido'}
                        <button type="button" onClick={() => setDraft({ ...draft, productIds: draft.productIds.filter((x) => x !== id) })} className="p-0.5 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-500/30 cursor-pointer" title="Tirar da promoção">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input className={`${inputClass} pl-9`} value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Buscar produto pelo nome ou código..." />
                </div>
                {searchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                    {searchResults.map((p) => (
                      <label key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <span className="flex items-center gap-2 min-w-0">
                          <input type="checkbox" checked={draft.productIds.includes(p.id)} onChange={() => setDraft({ ...draft, productIds: toggle(draft.productIds, p.id) })} className="w-4 h-4 accent-amber-500 shrink-0" />
                          <span className="truncate text-slate-800 dark:text-slate-200">{p.name}</span>
                        </span>
                        <span className="font-mono text-xs text-slate-500 shrink-0">{brl(p.price)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {preview.length > 0 && (
                <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-4 py-3 text-xs space-y-1">
                  <p className="font-black uppercase text-[10px] text-emerald-700 dark:text-emerald-300">Prévia ({affectedCount} produto(s) na promoção)</p>
                  {preview.map((p) => (
                    <p key={p.name} className={`font-semibold ${p.to < p.from ? 'text-emerald-800 dark:text-emerald-200' : 'text-rose-700 dark:text-rose-300'}`}>
                      {p.name}: {brl(p.from)} → {brl(p.to)}{p.to >= p.from ? ' (não fica mais barato, a promoção não se aplica)' : ''}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setDraft(null); setError(null); }}
                  className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="py-2.5 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-sm font-black transition flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                  {draft.id ? 'Salvar promoção' : 'Criar promoção'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setProductSearch('');
                  setDraft({ name: '', isActive: true, days: ALL_DAYS, startTime: '17:00', endTime: '20:00', discountType: 'PERCENT', value: '', productIds: [], categoryIds: [] });
                }}
                className="h-9 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Nova promoção
              </button>

              {loading ? (
                <div className="py-10 flex justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : promotions.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Nenhuma promoção cadastrada ainda.</p>
              ) : (
                <div className="space-y-2">
                  {promotions.map((p) => (
                    <div key={p.id} className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 flex items-start justify-between gap-3 ${p.isActive ? '' : 'opacity-60'}`}>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-black text-slate-900 dark:text-white">{p.name}</h3>
                          {p.isRunningNow && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white animate-pulse">Agora</span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1">{describePromotion(p)}</p>
                        <p className="text-[11px] text-slate-500 mt-1 truncate">{targetsLabel(p) || 'Sem produtos'}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <label className="relative inline-flex items-center cursor-pointer mr-1" title={p.isActive ? 'Desativar' : 'Ativar'}>
                          <input type="checkbox" checked={p.isActive} onChange={() => handleToggleActive(p)} className="sr-only peer" />
                          <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                        <button type="button" onClick={() => { setProductSearch(''); setDraft(toDraft(p)); setError(null); }} className="p-2 rounded-xl text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 cursor-pointer" title="Editar">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => handleDelete(p)} className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer" title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
