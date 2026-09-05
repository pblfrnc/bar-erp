const fs = require('fs');
let code = fs.readFileSync('client/src/components/CheckoutModal.tsx', 'utf-8');

// Adicionar importações necessárias
code = code.replace(
  "import { Table, Order, PaymentMethod } from '../types';",
  "import { Table, Order, PaymentMethod, OrderItem } from '../types';"
);

// Adicionar icones
code = code.replace(
  "Users,",
  "Users, ListChecks, Plus, Minus,"
);

// Inserir os estados de "Divisão por Itens"
const statesInsert = `
  // Estados de Divisão por Itens
  const [splitMode, setSplitMode] = useState<'simple' | 'items'>('simple');
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
`;
code = code.replace(
  "  const [splitCount, setSplitCount] = useState<number>(table?.customerCount || 2);",
  statesInsert + "  const [splitCount, setSplitCount] = useState<number>(table?.customerCount || 2);"
);

// Inserir lógica de cálculo dos itens selecionados
const logicInsert = `
  // Lógica de "Racha Conta por Itens"
  const selectedItemsSubtotal = Object.entries(selectedItems).reduce((acc, [itemId, qty]) => {
    const item = order.items.find(i => i.id === itemId);
    if (!item) return acc;
    return acc + (item.unitPrice * qty);
  }, 0);
  const selectedItemsService = order.isServiceFeeActive ? selectedItemsSubtotal * (order.serviceFeeRate || 0.1) : 0;
  const selectedItemsTotal = selectedItemsSubtotal + selectedItemsService;

  // Atualizar payAmount quando trocar os itens selecionados
  React.useEffect(() => {
    if (splitMode === 'items') {
      setPayAmount(selectedItemsTotal.toFixed(2));
    }
  }, [selectedItemsTotal, splitMode]);

  const handleToggleItemQty = (item: OrderItem, delta: number) => {
    setSelectedItems(prev => {
      const current = prev[item.id] || 0;
      const next = Math.max(0, Math.min(item.quantity, current + delta));
      if (next === 0) {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      }
      return { ...prev, [item.id]: next };
    });
  };
`;
code = code.replace(
  "  const amountPerPerson = remainingBalance / Math.max(1, splitCount);",
  logicInsert + "\n  const amountPerPerson = remainingBalance / Math.max(1, splitCount);"
);

// Substituir a UI de "Seção de Divisão de Conta"
const uiRegex = /\{\/\* Seção de Divisão de Conta \*\/\}[\s\S]*?\{\/\* Formas de Pagamento \*\/\}/;
const newUi = `{/* Seção de Divisão de Conta (Racha-Conta) */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase text-slate-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-400" />
                Racha-Conta
              </label>
              
              <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setSplitMode('simple')}
                  className={\`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition \${splitMode === 'simple' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}\`}
                >
                  Divisão Igual
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('items')}
                  className={\`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition flex items-center gap-1 \${splitMode === 'items' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}\`}
                >
                  <ListChecks className="w-3 h-3" />
                  Por Itens
                </button>
              </div>
            </div>

            {splitMode === 'simple' ? (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mt-2">
                  {[1, 2, 3, 4, 5, 6, 8].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        setSplitCount(num);
                        setPayAmount((remainingBalance / num).toFixed(2));
                      }}
                      className={\`flex-1 min-w-[54px] py-2 rounded-xl text-xs font-bold transition \${
                        splitCount === num
                          ? 'bg-amber-500 text-slate-950 font-black shadow'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }\`}
                    >
                      {num}x
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-right">
                  <span className="text-xs font-bold text-amber-400 font-mono">
                    R$ {amountPerPerson.toFixed(2)} por pessoa
                  </span>
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200 mt-3 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {order.items.map(item => {
                  const selectedQty = selectedItems[item.id] || 0;
                  const isSelected = selectedQty > 0;
                  return (
                    <div key={item.id} className={\`flex items-center justify-between p-2.5 rounded-xl border transition \${isSelected ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-950/50 border-slate-800'}\`}>
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-baseline gap-2">
                          <span className={\`text-sm font-bold truncate \${isSelected ? 'text-amber-400' : 'text-slate-300'}\`}>
                            {item.product?.name || 'Item'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {item.quantity}x R$ {item.unitPrice.toFixed(2)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3 bg-slate-900 rounded-lg p-1 border border-slate-700">
                        <button
                          type="button"
                          onClick={() => handleToggleItemQty(item, -1)}
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className={\`w-4 text-center text-xs font-bold \${isSelected ? 'text-amber-400' : 'text-slate-400'}\`}>
                          {selectedQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleItemQty(item, 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                
                {selectedItemsSubtotal > 0 && (
                  <div className="pt-2 flex items-center justify-between px-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Subtotal Selecionado {order.isServiceFeeActive ? '+ 10%' : ''}
                    </span>
                    <span className="text-sm font-black text-amber-400 font-mono">
                      R$ {selectedItemsTotal.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Formas de Pagamento */}`;

code = code.replace(uiRegex, newUi);

// Atualizar o 'notes' do pagamento para registrar os itens caso seja "Por Itens"
const payExecuteRegex = /notes: splitCount > 1 \? \`Divisão \(\$\{splitCount\}p\)\` : undefined/;
const newPayNotes = `notes: splitMode === 'items'
              ? 'Itens: ' + Object.entries(selectedItems).filter(([_, q]) => q > 0).map(([id, q]) => \`\${q}x \${order.items.find(i => i.id === id)?.product?.name}\`).join(', ')
              : (splitCount > 1 ? \`Divisão (\${splitCount}p)\` : undefined)`;
code = code.replace(payExecuteRegex, newPayNotes);

fs.writeFileSync('client/src/components/CheckoutModal.tsx', code);
