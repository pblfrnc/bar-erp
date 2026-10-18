import React, { useEffect, useMemo, useState } from 'react';
import { Beer, Check, ChevronDown, ImageOff, Loader2, QrCode, Search, UtensilsCrossed, X } from 'lucide-react';
import { Category, Product } from '../types';
import { api } from '../services/api';
import { ProductPhotoField } from './ProductPhotoField';
import { menuGroupOf, NOT_FOR_MENU_GROUPS, sortByMenuGroup } from '../utils/menuGroups';

type Filter = 'all' | 'in' | 'out' | 'nophoto';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'in', label: 'No cardápio' },
  { id: 'out', label: 'Fora do cardápio' },
  { id: 'nophoto', label: 'Sem foto' }
];

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Escolha dos itens do cardápio digital, com foto e descrição de cada um.
// Comidas aparecem antes das bebidas, na mesma ordem do site (categoria com maioria de itens da cozinha = comida).
export const DigitalMenuItemsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialSelected, setInitialSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [descDraft, setDescDraft] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);
  const [photoBusyId, setPhotoBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [prods, cats] = await Promise.all([api.getProducts(undefined, undefined, true), api.getCategories()]);
        setProducts(prods);
        setCategories([...cats].sort((a, b) => a.sortOrder - b.sortOrder));
        const initial = new Set(prods.filter((p) => p.showInMenu !== false).map((p) => p.id));
        setSelected(initial);
        setInitialSelected(new Set(initial));
      } catch (err: any) {
        setLoadError(err?.message || 'Não foi possível carregar os produtos.');
      } finally {
        setLoading(false);
      }
      api.getDigitalMenu().then((st) => setHiddenCategoryIds(st.hiddenCategoryIds)).catch(() => {});
    })();
  }, []);

  const changes = useMemo(() => {
    const show = [...selected].filter((id) => !initialSelected.has(id));
    const hide = [...initialSelected].filter((id) => !selected.has(id));
    return { show, hide, count: show.length + hide.length };
  }, [selected, initialSelected]);

  const groups = useMemo(() => {
    const q = normalize(query.trim());
    const visible = products.filter((p) => {
      if (q && !normalize(`${p.name} ${p.code || ''} ${p.description || ''}`).includes(q)) return false;
      if (filter === 'in') return selected.has(p.id);
      if (filter === 'out') return !selected.has(p.id);
      if (filter === 'nophoto') return !p.imageHash;
      return true;
    });
    const sections = categories
      .map((category) => {
        const all = products.filter((p) => p.categoryId === category.id);
        const kitchen = all.filter((p) => p.kdsStation === 'KITCHEN').length;
        const list = visible.filter((p) => p.categoryId === category.id);
        const buckets = new Map<string, Product[]>();
        for (const p of list) {
          const g = menuGroupOf(p.name);
          buckets.set(g, [...(buckets.get(g) || []), p]);
        }
        return {
          category,
          food: kitchen * 2 > all.length,
          products: list,
          subgroups:
            buckets.size > 1
              ? sortByMenuGroup([...buckets.entries()]).map(([name, items]) => ({ name: name as string | null, products: items }))
              : [{ name: null as string | null, products: list }]
        };
      })
      .filter((s) => s.products.length > 0);
    return { food: sections.filter((s) => s.food), drink: sections.filter((s) => !s.food) };
  }, [products, categories, query, filter, selected]);

  // Estoque da loja que não costuma ir ao cardápio (cigarro, limpeza, conservas, insumos)
  const notForMenu = useMemo(
    () => products.filter((p) => selected.has(p.id) && NOT_FOR_MENU_GROUPS.includes(menuGroupOf(p.name))).map((p) => p.id),
    [products, selected]
  );

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setMany = (ids: string[], on: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const patchProduct = (id: string, patch: Partial<Product>) =>
    setProducts((cur) => cur.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const startEdit = (p: Product) => {
    setFeedback(null);
    if (editingId === p.id) {
      setEditingId(null);
      return;
    }
    setEditingId(p.id);
    setDescDraft(p.description || '');
  };

  const saveDescription = async (p: Product) => {
    setSavingDesc(true);
    try {
      const description = descDraft.trim() || null;
      await api.updateProduct(p.id, { description });
      patchProduct(p.id, { description });
      setFeedback({ type: 'ok', text: `Descrição de "${p.name}" salva.` });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Erro ao salvar a descrição.' });
    } finally {
      setSavingDesc(false);
    }
  };

  const uploadPhoto = async (p: Product, image: Blob) => {
    setPhotoBusyId(p.id);
    try {
      const { imageHash } = await api.uploadProductImage(p.id, image);
      patchProduct(p.id, { imageHash });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Erro ao enviar a foto.' });
    } finally {
      setPhotoBusyId(null);
    }
  };

  const removePhoto = async (p: Product) => {
    setPhotoBusyId(p.id);
    try {
      await api.deleteProductImage(p.id);
      patchProduct(p.id, { imageHash: null });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Erro ao remover a foto.' });
    } finally {
      setPhotoBusyId(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await api.setMenuVisibility(changes.show, changes.hide);
      setInitialSelected(new Set(selected));
      setFeedback({ type: 'ok', text: 'Itens salvos. O cardápio digital é atualizado em alguns segundos.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Erro ao salvar os itens do cardápio.' });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (changes.count > 0 && !window.confirm('Há itens marcados/desmarcados que não foram salvos. Sair mesmo assim?')) return;
    onClose();
  };

  const renderRow = (p: Product) => {
    const on = selected.has(p.id);
    const editing = editingId === p.id;
    const noPrice = !(p.price > 0);
    return (
      <li key={p.id} className={on ? '' : 'bg-slate-50/60 dark:bg-slate-950/40'}>
        <div className="flex items-center gap-3 px-4 py-2.5">
          <button
            type="button"
            role="checkbox"
            aria-checked={on}
            aria-label={`Mostrar ${p.name} no cardápio`}
            onClick={() => toggle(p.id)}
            className={`w-6 h-6 shrink-0 rounded-lg border-2 flex items-center justify-center transition cursor-pointer ${
              on ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-slate-300 dark:border-slate-600'
            }`}
          >
            {on && <Check className="w-4 h-4" strokeWidth={3} />}
          </button>
          <button
            type="button"
            onClick={() => startEdit(p)}
            className="w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
            title="Foto e descrição"
          >
            {p.imageHash ? (
              <img src={api.productImageUrl(p.id, p.imageHash)} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImageOff className="w-4 h-4" />
            )}
          </button>
          <button type="button" onClick={() => toggle(p.id)} className="min-w-0 flex-1 text-left cursor-pointer">
            <p className={`text-sm font-bold truncate ${on ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
              {p.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {noPrice ? (
                <span className="font-semibold text-red-600 dark:text-red-400">Sem preço de venda: não aparece no cardápio</span>
              ) : (
                <>
                  <span className="font-mono font-bold">{brl(p.price)}</span>
                  {p.description && <> · {p.description}</>}
                </>
              )}
            </p>
          </button>
          <button
            type="button"
            onClick={() => startEdit(p)}
            aria-expanded={editing}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Foto e descrição
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${editing ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {editing && (
          <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 sm:pl-[3.25rem]">
            <ProductPhotoField
              size="sm"
              imageUrl={p.imageHash ? api.productImageUrl(p.id, p.imageHash) : null}
              busy={photoBusyId === p.id}
              onPick={(image) => uploadPhoto(p, image)}
              onRemove={() => removePhoto(p)}
            />
            <div className="space-y-2">
              <textarea
                rows={2}
                maxLength={500}
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                placeholder="Descrição para o cliente (ingredientes, tamanho, quantas pessoas serve...)"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:border-amber-500 outline-none resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => saveDescription(p)}
                  disabled={savingDesc || descDraft.trim() === (p.description || '').trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-black transition disabled:opacity-40 cursor-pointer"
                >
                  {savingDesc && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Salvar descrição
                </button>
              </div>
            </div>
          </div>
        )}
      </li>
    );
  };

  const renderGroup = (title: string, Icon: typeof Beer, sections: typeof groups.food) =>
    sections.length > 0 && (
      <div className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
          <span className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center">
            <Icon className="w-4 h-4" />
          </span>
          {title}
        </h3>
        {sections.map(({ category, products: list, subgroups }) => {
          const ids = list.map((p) => p.id);
          const allOn = ids.every((id) => selected.has(id));
          const categoryHidden = hiddenCategoryIds.includes(category.id);
          return (
            <section key={category.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-950">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 dark:text-white">{category.name}</p>
                  {categoryHidden && (
                    <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                      Categoria escondida nas configurações do cardápio: estes itens não aparecem.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setMany(ids, !allOn)}
                  className="shrink-0 text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  {allOn ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
              </div>
              {subgroups.map((g) => {
                const subIds = g.products.map((p) => p.id);
                const subOn = subIds.filter((id) => selected.has(id)).length;
                return (
                  <div key={g.name || 'all'}>
                    {g.name && (
                      <div className="flex items-center justify-between gap-3 px-4 py-1.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {g.name}{' '}
                          <span className="font-semibold normal-case tracking-normal">
                            ({subOn} de {subIds.length} no cardápio)
                          </span>
                        </p>
                        <button
                          type="button"
                          onClick={() => setMany(subIds, subOn < subIds.length)}
                          className="shrink-0 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          {subOn < subIds.length ? 'Marcar todos' : 'Desmarcar todos'}
                        </button>
                      </div>
                    )}
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">{g.products.map(renderRow)}</ul>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    );

  const total = products.length;
  const empty = groups.food.length === 0 && groups.drink.length === 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl my-auto flex flex-col max-h-[calc(100vh-2rem)]">
        <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Itens do Cardápio Digital</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Marque o que aparece para o cliente. Clique na foto para adicionar foto e descrição.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar"
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 pb-3 space-y-3 border-b border-slate-100 dark:border-slate-800">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produto"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-xl py-2.5 pl-9 pr-3 focus:border-amber-500 outline-none"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-full border text-xs font-bold transition cursor-pointer ${
                  filter === f.id
                    ? 'bg-amber-500 text-slate-950 border-amber-500'
                    : 'bg-transparent text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
            <span className="ml-auto text-xs font-semibold text-slate-500 dark:text-slate-400">
              {selected.size} de {total} no cardápio
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {!loading && notForMenu.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-4 py-3">
              <p className="flex-1 text-xs text-amber-900 dark:text-amber-200">
                <span className="font-black">{notForMenu.length} itens parecem ser estoque da loja</span> ({NOT_FOR_MENU_GROUPS.join(', ')}) e
                estão no cardápio. Confira e tire do cardápio de uma vez; depois clique em Salvar.
              </p>
              <button
                type="button"
                onClick={() => setMany(notForMenu, false)}
                className="shrink-0 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition cursor-pointer"
              >
                Desmarcar esses {notForMenu.length}
              </button>
            </div>
          )}
          {loading && (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            </div>
          )}
          {loadError && <p className="py-10 text-center text-sm font-semibold text-red-600 dark:text-red-400">{loadError}</p>}
          {!loading && !loadError && empty && (
            <p className="py-10 text-center text-sm text-slate-500">Nenhum produto encontrado com esse filtro.</p>
          )}
          {renderGroup('Comidas', UtensilsCrossed, groups.food)}
          {renderGroup('Bebidas', Beer, groups.drink)}
        </div>

        <div className="p-5 border-t border-slate-100 dark:border-slate-800 space-y-3">
          {feedback && (
            <p
              className={`text-xs font-semibold ${
                feedback.type === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {feedback.text}
            </p>
          )}
          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-black transition cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || changes.count === 0}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition disabled:opacity-50 cursor-pointer shadow-md shadow-amber-500/20"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {changes.count > 0 ? `Salvar ${changes.count} alteração(ões)` : 'Nada para salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
