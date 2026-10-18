import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { ModifierOption, Product } from '../types';
import { productModifierGroups, selectionError } from '../utils/pricing';

interface ModifierPickerModalProps {
  product: Product;
  basePrice: number; // Preço da unidade já com a promoção do dia
  onConfirm: (options: ModifierOption[]) => void;
  onClose: () => void;
}

// Perguntas e adicionais do produto (ex: ponto da carne, gelo e limão, + bacon) antes de ir para o carrinho
export const ModifierPickerModal: React.FC<ModifierPickerModalProps> = ({ product, basePrice, onConfirm, onClose }) => {
  const groups = productModifierGroups(product);
  const [selected, setSelected] = useState<ModifierOption[]>([]);
  const [showErrors, setShowErrors] = useState<boolean>(false);

  const toggle = (option: ModifierOption, maxSelect: number) => {
    setSelected((prev) => {
      if (prev.some((o) => o.id === option.id)) return prev.filter((o) => o.id !== option.id);
      const inGroup = prev.filter((o) => o.groupId === option.groupId);
      // Escolha única: trocar a opção em vez de bloquear
      if (maxSelect === 1) return [...prev.filter((o) => o.groupId !== option.groupId), option];
      if (maxSelect > 0 && inGroup.length >= maxSelect) return prev;
      return [...prev, option];
    });
  };

  const error = selectionError(groups, selected);
  const total = basePrice + selected.reduce((acc, o) => acc + o.price, 0);

  const handleConfirm = () => {
    if (error) {
      setShowErrors(true);
      return;
    }
    // Mantém a ordem dos grupos/opções do cadastro
    const ordered = groups.flatMap((g) => g.options.filter((o) => selected.some((s) => s.id === o.id)));
    onConfirm(ordered);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-900 dark:text-white truncate">{product.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Escolha as opções do pedido</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {groups.map((group) => {
            const count = selected.filter((o) => o.groupId === group.id).length;
            const missing = showErrors && count < group.minSelect;
            const rule = group.minSelect > 0
              ? (group.maxSelect === 1 ? 'Obrigatório · escolha 1' : `Obrigatório · mínimo ${group.minSelect}${group.maxSelect > 0 ? `, até ${group.maxSelect}` : ''}`)
              : (group.maxSelect > 0 ? `Opcional · até ${group.maxSelect}` : 'Opcional');
            return (
              <div key={group.id}>
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <span className="text-sm font-black text-slate-900 dark:text-white">{group.name}</span>
                  <span className={`text-[10px] font-bold uppercase ${missing ? 'text-red-600 dark:text-red-400' : group.minSelect > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
                    {rule}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {group.options.filter((o) => o.isActive).map((option) => {
                    const isOn = selected.some((o) => o.id === option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggle(option, group.maxSelect)}
                        className={`min-h-[48px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition cursor-pointer active:scale-[0.98] ${
                          isOn
                            ? 'bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-200 ring-1 ring-amber-500'
                            : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="text-xs font-bold leading-tight">
                          {option.name}
                          {option.price > 0 && (
                            <span className="block text-[10px] font-mono text-emerald-600 dark:text-emerald-400">+ R$ {option.price.toFixed(2)}</span>
                          )}
                        </span>
                        {isOn && <Check className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {showErrors && error && <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full min-h-[48px] rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-black transition active:scale-[0.98] cursor-pointer"
          >
            Adicionar · R$ {total.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
};
