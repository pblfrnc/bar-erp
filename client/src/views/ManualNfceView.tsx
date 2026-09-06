import React, { useState, useEffect } from 'react';
import { FileText, ArrowLeft, Plus, Trash2, Send, Download } from 'lucide-react';
import { api } from '../services/api';
import { Product } from '../types';

interface ManualNfceViewProps {
  onBack: () => void;
}

export const ManualNfceView: React.FC<ManualNfceViewProps> = ({ onBack }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<{ product: Product, quantity: number }[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [customerCpf, setCustomerCpf] = useState('');
  const [isEmitting, setIsEmitting] = useState(false);
  const [resultDanfe, setResultDanfe] = useState<string | null>(null);

  useEffect(() => {
    api.getProducts().then(setProducts).catch(() => {});
  }, []);

  const handleAddItem = () => {
    if (!selectedProductId) return;
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    setItems(prev => {
      const existing = prev.find(i => i.product.id === prod.id);
      if (existing) {
        return prev.map(i => i.product.id === prod.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product: prod, quantity: 1 }];
    });
    setSelectedProductId('');
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, newQty: number) => {
    if (newQty < 1) return;
    setItems(prev => {
      const copy = [...prev];
      copy[index].quantity = newQty;
      return copy;
    });
  };

  const total = items.reduce((acc, curr) => acc + (curr.product.price * curr.quantity), 0);

  const handleEmit = async () => {
    if (items.length === 0) return alert('Adicione pelo menos um item.');
    setIsEmitting(true);
    try {
      const payload = {
        customerCpf,
        items: items.map(i => ({
          productId: i.product.id,
          quantity: i.quantity,
          price: i.product.price
        }))
      };
      const res = await fetch(api.getApiUrl() + '/fiscal/emit-nfce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na emissão.');
      setResultDanfe(data.caminhoDanfe);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsEmitting(false);
    }
  };

  if (resultDanfe) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto pt-10 text-center">
        <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <FileText className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-white">NFC-e Emitida com Sucesso!</h2>
        <p className="text-slate-400">O cupom fiscal foi gerado e autorizado pela SEFAZ.</p>
        
        <div className="mt-8 flex justify-center gap-4">
          <a href={resultDanfe} target="_blank" rel="noopener noreferrer" className="px-6 py-3 rounded-xl font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 flex items-center gap-2">
            <Download className="w-5 h-5" /> Imprimir DANFE
          </a>
          <button onClick={() => { setItems([]); setResultDanfe(null); }} className="px-6 py-3 rounded-xl font-bold bg-slate-800 text-white hover:bg-slate-700">
            Nova Emissão
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pt-4 pb-20">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
        </button>
      </div>

      <div>
        <h2 className="text-2xl font-black text-white">Emissor Manual de NFC-e</h2>
        <p className="text-sm text-slate-400 mt-1">Gere cupons fiscais avulsos para clientes sem vincular a uma mesa.</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        {/* Adicionar Produto */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <select
            value={selectedProductId}
            onChange={e => setSelectedProductId(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500"
          >
            <option value="">Buscar Produto...</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} - R$ {p.price.toFixed(2)}</option>
            ))}
          </select>
          <button 
            onClick={handleAddItem}
            className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-5 h-5" /> Adicionar
          </button>
        </div>

        {/* Lista de Itens */}
        <div className="bg-slate-950 rounded-2xl border border-slate-800 p-2 min-h-[200px] mb-6">
          {items.length === 0 ? (
            <div className="text-center text-slate-500 py-10">Nenhum item adicionado.</div>
          ) : (
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800/80">
                  <div className="flex-1">
                    <div className="text-sm font-bold text-slate-200">{item.product.name}</div>
                    <div className="text-xs text-slate-400">R$ {item.product.price.toFixed(2)} un</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
                      <button onClick={() => updateQuantity(index, item.quantity - 1)} className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold">-</button>
                      <span className="px-3 text-sm font-bold text-white min-w-[30px] text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(index, item.quantity + 1)} className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold">+</button>
                    </div>
                    <div className="w-20 text-right text-sm font-bold text-amber-400">
                      R$ {(item.product.price * item.quantity).toFixed(2)}
                    </div>
                    <button onClick={() => removeItem(index)} className="p-2 text-slate-500 hover:text-red-400 bg-slate-950 rounded-lg transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-6 items-end justify-between">
          <div className="w-full sm:w-1/2">
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">CPF na Nota (Opcional)</label>
            <input
              type="text"
              value={customerCpf}
              onChange={e => setCustomerCpf(e.target.value)}
              placeholder="000.000.000-00"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500"
            />
          </div>
          
          <div className="w-full sm:w-auto text-right">
            <div className="text-sm text-slate-400 mb-1">Total da Nota</div>
            <div className="text-3xl font-black text-emerald-400 mb-4">R$ {total.toFixed(2)}</div>
            
            <button 
              onClick={handleEmit}
              disabled={isEmitting || items.length === 0}
              className="w-full sm:w-auto px-8 py-4 rounded-xl font-black bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
              {isEmitting ? 'Emitindo na SEFAZ...' : 'Emitir Cupom Fiscal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
