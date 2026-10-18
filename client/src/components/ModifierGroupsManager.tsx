import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Edit2, ListChecks, Loader2, Plus, Trash2, X } from 'lucide-react';
import { ModifierGroup } from '../types';
import { api } from '../services/api';

interface OptionDraft {
  id?: string;
  name: string;
  price: string;
  isActive: boolean;
}

interface GroupDraft {
  id?: string;
  name: string;
  required: boolean;
  maxSelect: string; // 0 = sem limite
  isActive: boolean;
  options: OptionDraft[];
}

const emptyOption = (): OptionDraft => ({ name: '', price: '0', isActive: true });

const PRESETS: { label: string; draft: () => GroupDraft }[] = [
  {
    label: 'Ponto da carne',
    draft: () => ({
      name: 'Ponto da carne', required: true, maxSelect: '1', isActive: true,
      options: ['Mal passada', 'Ao ponto', 'Bem passada'].map((name) => ({ ...emptyOption(), name }))
    })
  },
  {
    label: 'Gelo e limão',
    draft: () => ({
      name: 'Gelo e limão', required: false, maxSelect: '2', isActive: true,
      options: ['Com gelo', 'Com limão', 'Sem gelo'].map((name) => ({ ...emptyOption(), name }))
    })
  },
  {
    label: 'Adicionais',
    draft: () => ({ name: 'Adicionais', required: false, maxSelect: '0', isActive: true, options: [emptyOption()] })
  }
];

export const describeModifierRule = (g: Pick<ModifierGroup, 'minSelect' | 'maxSelect'>) => {
  const kind = g.minSelect >= 1 ? 'Obrigatório' : 'Opcional';
  if (g.maxSelect === 1) return `${kind} · escolha 1`;
  if (g.maxSelect === 0) return `${kind} · sem limite`;
  return `${kind} · até ${g.maxSelect}`;
};

const formatPrice = (price: number) => (price > 0 ? `+R$ ${price.toFixed(2).replace('.', ',')}` : 'sem custo');

const toDraft = (g: ModifierGroup): GroupDraft => ({
  id: g.id,
  name: g.name,
  required: g.minSelect >= 1,
  maxSelect: String(g.maxSelect),
  isActive: g.isActive,
  options: [...g.options]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((o) => ({ id: o.id, name: o.name, price: String(o.price), isActive: o.isActive }))
});

const inputClass =
  'w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-xl py-2.5 px-3 focus:border-amber-500 outline-none transition';

// Cadastro de adicionais e perguntas (ex.: ponto da carne, gelo e limão, adicionais pagos)
export const ModifierGroupsManager: React.FC<{ onClose: () => void; onChanged?: () => void }> = ({ onClose, onChanged }) => {
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<GroupDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setGroups(await api.getModifierGroups());
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar os adicionais.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateOption = (index: number, patch: Partial<OptionDraft>) =>
    setDraft((d) => d && { ...d, options: d.options.map((o, i) => (i === index ? { ...o, ...patch } : o)) });

  const moveOption = (index: number, delta: number) =>
    setDraft((d) => {
      if (!d) return d;
      const target = index + delta;
      if (target < 0 || target >= d.options.length) return d;
      const options = [...d.options];
      [options[index], options[target]] = [options[target], options[index]];
      return { ...d, options };
    });

  const handleSave = async () => {
    if (!draft) return;
    setError(null);
    const options = draft.options
      .filter((o) => o.name.trim())
      .map((o) => ({ id: o.id, name: o.name.trim(), price: Math.max(0, parseFloat(o.price.replace(',', '.')) || 0), isActive: o.isActive }));
    const maxSelect = Math.max(0, parseInt(draft.maxSelect, 10) || 0);

    if (!draft.name.trim()) return setError('Dê um nome ao grupo (ex.: Ponto da carne).');
    if (options.length === 0) return setError('Cadastre pelo menos uma opção.');
    if (draft.required && !options.some((o) => o.isActive)) return setError('Uma pergunta obrigatória precisa de pelo menos uma opção ativa.');

    setSaving(true);
    try {
      await api.saveModifierGroup({
        id: draft.id,
        name: draft.name.trim(),
        minSelect: draft.required ? 1 : 0,
        maxSelect,
        isActive: draft.isActive,
        options
      });
      setDraft(null);
      await load();
      onChanged?.();
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar o grupo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (g: ModifierGroup) => {
    const used = g._count?.products ? `\n\nEle está em ${g._count.products} produto(s) e sairá deles.` : '';
    if (!window.confirm(`Excluir o grupo "${g.name}"?${used}`)) return;
    setError(null);
    try {
      await api.deleteModifierGroup(g.id);
      await load();
      onChanged?.();
    } catch (err: any) {
      setError(err?.message || 'Erro ao excluir o grupo.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl my-auto">
        <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <ListChecks className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Adicionais e Perguntas</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Ponto da carne, gelo e limão, adicionais pagos. Depois marque os grupos em cada produto.</p>
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
                <label className="sm:col-span-2 space-y-1">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Nome do grupo</span>
                  <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Ponto da carne" autoFocus />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Máximo de escolhas</span>
                  <input type="number" min="0" step="1" className={inputClass} value={draft.maxSelect} onChange={(e) => setDraft({ ...draft, maxSelect: e.target.value })} />
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">1 = escolha única · 0 = sem limite</span>
                </label>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={draft.required} onChange={(e) => setDraft({ ...draft, required: e.target.checked })} className="w-4 h-4 accent-amber-500" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Pergunta obrigatória</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">(o garçom precisa escolher)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} className="w-4 h-4 accent-amber-500" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Grupo ativo</span>
                </label>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Opções</p>
                {draft.options.map((o, i) => (
                  <div key={o.id || `new-${i}`} className={`flex items-center gap-2 ${o.isActive ? '' : 'opacity-60'}`}>
                    <div className="flex flex-col">
                      <button type="button" onClick={() => moveOption(i, -1)} disabled={i === 0} className="p-0.5 text-slate-400 hover:text-amber-500 disabled:opacity-30 cursor-pointer" title="Subir">
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => moveOption(i, 1)} disabled={i === draft.options.length - 1} className="p-0.5 text-slate-400 hover:text-amber-500 disabled:opacity-30 cursor-pointer" title="Descer">
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input className={`${inputClass} flex-1 min-w-0`} value={o.name} onChange={(e) => updateOption(i, { name: e.target.value })} placeholder="Ex.: Bacon extra" />
                    <div className="relative w-28 shrink-0">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">+R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className={`${inputClass} pl-10 font-mono`}
                        value={o.price}
                        onChange={(e) => updateOption(i, { price: e.target.value })}
                        title="0 = sem custo"
                      />
                    </div>
                    <label className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0 cursor-pointer" title="Opção ativa">
                      <input type="checkbox" checked={o.isActive} onChange={(e) => updateOption(i, { isActive: e.target.checked })} className="w-4 h-4 accent-amber-500" />
                      <span className="hidden sm:inline">Ativa</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, options: draft.options.filter((_, idx) => idx !== i) })}
                      className="p-2 text-slate-400 hover:text-rose-500 cursor-pointer shrink-0"
                      title="Remover opção"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, options: [...draft.options, emptyOption()] })}
                  className="w-full py-2.5 border border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500/50 text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar opção
                </button>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Preço 0 = sem custo. Opções vazias são ignoradas.</p>
              </div>

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
                  {draft.id ? 'Salvar grupo' : 'Criar grupo'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDraft({ name: '', required: false, maxSelect: '0', isActive: true, options: [emptyOption()] })}
                  className="h-9 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Novo grupo
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400">ou comece de um modelo:</span>
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setDraft(p.draft())}
                    className="h-8 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="py-10 flex justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : groups.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum grupo cadastrado ainda.</p>
              ) : (
                <div className="space-y-2">
                  {groups.map((g) => (
                    <div key={g.id} className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 flex items-start justify-between gap-3 ${g.isActive ? '' : 'opacity-60'}`}>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-black text-slate-900 dark:text-white">{g.name}</h3>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${g.minSelect >= 1 ? 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 border-amber-200 dark:border-amber-500/30' : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                            {describeModifierRule(g)}
                          </span>
                          {!g.isActive && <span className="text-[10px] font-black uppercase text-slate-500">Inativo</span>}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                          {[...g.options]
                            .sort((a, b) => a.sortOrder - b.sortOrder)
                            .map((o) => `${o.name} (${formatPrice(o.price)})${o.isActive ? '' : ' [inativa]'}`)
                            .join(' · ') || 'Sem opções'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-1">
                          {g._count?.products ? `Usado em ${g._count.products} produto(s)` : 'Ainda não está em nenhum produto'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => { setDraft(toDraft(g)); setError(null); }} className="p-2 rounded-xl text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 cursor-pointer" title="Editar">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => handleDelete(g)} className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer" title="Excluir">
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
