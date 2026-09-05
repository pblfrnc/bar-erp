import React, { useState, useEffect } from 'react';
import { Table, Product, Category } from '../types';
import { api } from '../services/api';
import {
  X,
  Search,
  Plus,
  Minus,
  Trash2,
  Send,
  Beer,
  Wine,
  Flame,
  UtensilsCrossed,
  Beef,
  GlassWater,
  Sparkles,
  Check
} from 'lucide-react';

interface AddOrderModalProps {
  table: Table | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface CartItem {
  product: Product;
  quantity: number;
  notes: string;
}

export const AddOrderModal: React.FC<AddOrderModalProps> = ({
  table,
  onClose,
  onSuccess
}) => {
  if (!table || !table.activeOrder) return null;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Chips de observações rápidas para agilizar o atendimento
  const quickObservationChips = [
    'Com gelo e limão',
    'Sem gelo',
    'Bem gelada',
    'Sem cebola',
    'Ponto: Ao Ponto',
    'Ponto: Mal Passada',
    'Gelo extra',
    'Molho à parte'
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cats, prods] = await Promise.all([
        api.getCategories(),
        api.getProducts()
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch (err) {
      console.error('Erro ao carregar cardápio:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar produtos
  const filteredProducts = products.filter((prod) => {
    const matchCategory = selectedCategoryId === 'ALL' || prod.categoryId === selectedCategoryId;
    const matchSearch = search.trim() === '' || prod.name.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  // Funções do carrinho
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1, notes: '' }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const updateNotes = (productId: string, notes: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, notes } : item
      )
    );
  };

  const appendQuickNote = (productId: string, chip: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const current = item.notes ? `${item.notes}, ${chip}` : chip;
          return { ...item, notes: current };
        }
        return item;
      })
    );
  };

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const handleSendOrder = async () => {
    if (cart.length === 0 || !table.activeOrder) return;

    try {
      setSubmitting(true);
      const itemsPayload = cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        notes: item.notes.trim() || undefined
      }));

      await api.addOrderItems(table.activeOrder.id, itemsPayload);
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(error.message || 'Erro ao enviar pedido');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Beer': return <Beer className="w-4 h-4" />;
      case 'Wine': return <Wine className="w-4 h-4" />;
      case 'Flame': return <Flame className="w-4 h-4" />;
      case 'UtensilsCrossed': return <UtensilsCrossed className="w-4 h-4" />;
      case 'Beef': return <Beef className="w-4 h-4" />;
      case 'GlassWater': return <GlassWater className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-4 sm:px-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                LANÇAMENTO DE PEDIDO
              </span>
              <span className="text-xs text-slate-400">
                Comanda #{table.activeOrder.orderNumber}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              {table.name || `Mesa ${table.number}`}
              {table.customerName ? ` • ${table.customerName}` : ''}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo: Grade de Produtos + Carrinho Lateral/Inferior */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* LADO ESQUERDO: Catálogo e Busca */}
          <div className="flex-1 flex flex-col border-r border-slate-800 overflow-hidden">
            {/* Barra de Busca e Categorias */}
            <div className="p-3 sm:p-4 space-y-3 bg-slate-950/40 border-b border-slate-800">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar produto (ex: chope, batata, caipirinha)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>

              {/* Categorias (scroll horizontal touch-friendly no Android) */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedCategoryId('ALL')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                    selectedCategoryId === 'ALL'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Todos os Itens
                </button>

                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                      selectedCategoryId === cat.id
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {getCategoryIcon(cat.icon)}
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid de Produtos */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              {loading ? (
                <div className="flex items-center justify-center h-48 text-slate-400">
                  Carregando cardápio...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
                  Nenhum item encontrado
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {filteredProducts.map((prod) => {
                    const inCart = cart.find((i) => i.product.id === prod.id);
                    return (
                      <div
                        key={prod.id}
                        onClick={() => addToCart(prod)}
                        className={`group relative p-3 rounded-2xl border transition-all duration-150 cursor-pointer flex flex-col justify-between select-none active:scale-[0.97] ${
                          inCart
                            ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/30'
                            : 'bg-slate-950/60 border-slate-800/90 hover:border-slate-700 hover:bg-slate-850'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              {prod.kdsStation === 'BAR' ? '🍺 Bar' : '🍳 Cozinha'}
                            </span>
                            {inCart && (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                                {inCart.quantity}x no pedido
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-white line-clamp-2 leading-snug">
                            {prod.name}
                          </h4>
                          {prod.description && (
                            <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                              {prod.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/60">
                          <span className="text-sm font-extrabold text-amber-400">
                            R$ {prod.price.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            className="p-1 rounded-lg bg-amber-500/20 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition"
                          >
                            <Plus className="w-4 h-4 stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* LADO DIREITO: Carrinho de Envio ao KDS */}
          <div className="w-full md:w-80 lg:w-96 bg-slate-950/80 flex flex-col border-t md:border-t-0 md:border-l border-slate-800">
            <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-200">
                  Itens a Enviar
                </h3>
                <span className="text-xs text-slate-400">
                  {cart.length} produto(s) selecionado(s)
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-red-400 hover:text-red-300 font-medium flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpar
                </button>
              )}
            </div>

            {/* Lista dos Itens no Carrinho */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <Beer className="w-10 h-10 stroke-[1.5] text-slate-600 mb-2" />
                  <p className="text-sm font-medium">Nenhum item selecionado</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Toque nos produtos ao lado para adicionar à rodada.
                  </p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <span className="text-xs font-bold text-white block">
                          {item.product.name}
                        </span>
                        <span className="text-xs font-semibold text-amber-400">
                          R$ {(item.product.price * item.quantity).toFixed(2)}
                        </span>
                      </div>

                      {/* Controle de Quantidade */}
                      <div className="flex items-center gap-1 bg-slate-950 rounded-xl p-0.5 border border-slate-800">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-bold text-sm text-white px-2 font-mono">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="p-1.5 text-amber-400 hover:text-amber-300 rounded-lg hover:bg-slate-800 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Campo de Observação do Item */}
                    <div>
                      <input
                        type="text"
                        placeholder="Observação (ex: sem gelo, bem passada)..."
                        value={item.notes}
                        onChange={(e) => updateNotes(item.product.id, e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 bg-slate-950 border border-slate-800/80 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                      />

                      {/* Chips rápidos de observação */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {quickObservationChips.slice(0, 4).map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => appendQuickNote(item.product.id, chip)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                          >
                            + {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Rodapé com Total e Botão de Envio para Bar/Cozinha */}
            <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                  Total desta Rodada
                </span>
                <span className="text-xl font-black text-amber-400">
                  R$ {cartTotal.toFixed(2)}
                </span>
              </div>

              <button
                disabled={cart.length === 0 || submitting}
                onClick={handleSendOrder}
                className="w-full py-3.5 px-4 rounded-xl font-black text-sm uppercase tracking-wide bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Enviando...' : 'Enviar para Bar / Cozinha'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
