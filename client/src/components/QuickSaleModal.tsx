import React, { useState, useEffect, useRef } from 'react';
import { Product, Category, Order } from '../types';
import { api } from '../services/api';
import {
  X,
  Search,
  Plus,
  Minus,
  Trash2,
  Zap,
  Banknote,
  CreditCard,
  QrCode,
  CheckCircle,
  Printer,
  Package,
  Loader2
} from 'lucide-react';

interface QuickSaleModalProps {
  onClose: () => void;
  onSuccess: (order: Order) => void;
}

interface CartItem {
  product: Product;
  quantity: number;
  unitType: 'UNIT' | 'BOX';
  unitPrice: number;
  notes?: string;
}

export const QuickSaleModal: React.FC<QuickSaleModalProps> = ({ onClose, onSuccess }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Pagamento e Cliente
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD'>('PIX');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [printReceipt, setPrintReceipt] = useState<boolean>(true);

  // Estados de controle
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [lastSuccess, setLastSuccess] = useState<{ order: Order; change: number } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      const [cats, prods] = await Promise.all([
        api.getCategories(),
        api.getProducts()
      ]);
      setCategories(cats);
      setProducts(prods.filter(p => p.isActive));
    } catch (err) {
      console.error('Erro ao carregar cardápio:', err);
    } finally {
      setLoading(false);
      setTimeout(() => searchInputRef.current?.focus(), 150);
    }
  };

  // Funções do Carrinho
  const handleAddToCart = (product: Product, unitType: 'UNIT' | 'BOX' = 'UNIT') => {
    const isBox = unitType === 'BOX' && product.hasBoxPrice && product.boxPrice;
    const price = isBox ? Number(product.boxPrice) : Number(product.price || 0);

    setCart(prev => {
      const idx = prev.findIndex(item => item.product.id === product.id && item.unitType === unitType);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, {
        product,
        quantity: 1,
        unitType,
        unitPrice: price,
        notes: isBox ? `Caixa Fechada (${product.boxQuantity || 24} un)` : undefined
      }];
    });
  };

  const handleUpdateQuantity = (productId: string, unitType: 'UNIT' | 'BOX', delta: number) => {
    setCart(prev => {
      return prev
        .map(item => {
          if (item.product.id === productId && item.unitType === unitType) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleRemoveFromCart = (productId: string, unitType: 'UNIT' | 'BOX') => {
    setCart(prev => prev.filter(item => !(item.product.id === productId && item.unitType === unitType)));
  };

  // Cálculos
  const subtotal = cart.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
  const discountNum = Math.min(parseFloat(discountValue.replace(',', '.')) || 0, subtotal);
  const total = Math.max(0, subtotal - discountNum);

  const tenderedNum = parseFloat(cashTendered.replace(',', '.')) || total;
  const change = paymentMethod === 'CASH' && tenderedNum > total ? tenderedNum - total : 0;

  // Filtragem de Produtos (Iniciais, Nome, Código Interno # e EAN)
  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'ALL' || p.categoryId === selectedCategory;
    const rawTerm = search.trim().toLowerCase();
    if (!rawTerm) return matchesCat;

    const cleanTerm = rawTerm.startsWith('#') ? rawTerm.slice(1) : rawTerm;
    const pName = p.name ? String(p.name).toLowerCase() : '';
    const pCode = p.code ? String(p.code).toLowerCase() : '';
    const pEan = p.ean ? String(p.ean).toLowerCase() : '';
    const pBoxEan = p.boxEan ? String(p.boxEan).toLowerCase() : '';
    const pBrand = p.brand ? String(p.brand).toLowerCase() : '';
    const pDesc = p.description ? String(p.description).toLowerCase() : '';

    const matchesSearch =
      pName.includes(rawTerm) ||
      (cleanTerm !== '' && pCode.includes(cleanTerm)) ||
      (cleanTerm !== '' && pEan.includes(cleanTerm)) ||
      (cleanTerm !== '' && pBoxEan.includes(cleanTerm)) ||
      pBrand.includes(rawTerm) ||
      pDesc.includes(rawTerm);

    return matchesCat && matchesSearch;
  });

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const rawTerm = search.trim().toLowerCase();
      if (!rawTerm) return;

      const cleanTerm = rawTerm.startsWith('#') ? rawTerm.slice(1) : rawTerm;

      // 1. Tenta correspondência exata por código de barras de caixa (DUN-14 / boxEan)
      const exactBox = products.find(p => 
        p.hasBoxPrice && p.boxEan && (
          String(p.boxEan).toLowerCase() === rawTerm ||
          String(p.boxEan).toLowerCase() === cleanTerm
        )
      );

      if (exactBox) {
        handleAddToCart(exactBox, 'BOX');
        setSearch('');
        return;
      }

      // 2. Tenta correspondência exata por código de barras EAN ou código interno (#5001)
      const exact = products.find(p => 
        (p.ean && (String(p.ean).toLowerCase() === rawTerm || String(p.ean).toLowerCase() === cleanTerm)) ||
        (p.code && (String(p.code).toLowerCase() === rawTerm || String(p.code).toLowerCase() === cleanTerm))
      );

      if (exact) {
        handleAddToCart(exact, 'UNIT');
        setSearch('');
        return;
      }

      // 3. Se houver resultados filtrados, adiciona o primeiro item imediatamente
      if (filteredProducts.length > 0) {
        handleAddToCart(filteredProducts[0], 'UNIT');
        setSearch('');
      }
    }
  };

  // Finalizar Venda
  const handleFinishSale = async () => {
    if (cart.length === 0) return;
    if (submitting) return;

    try {
      setSubmitting(true);
      const res = await api.quickSale({
        items: cart.map(i => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitType: i.unitType,
          notes: i.notes
        })),
        payment: {
          method: paymentMethod,
          amount: total,
          cashTendered: paymentMethod === 'CASH' ? tenderedNum : total
        },
        customerName: customerName.trim() || 'Cliente Balcão',
        discount: discountNum
      });

      setLastSuccess({ order: res.order, change: res.change });
      onSuccess(res.order);

      // Impressão opcional
      if (printReceipt) {
        if ((window as any).electronAPI?.printSilent) {
          (window as any).electronAPI.printSilent();
        }
      }

      // Limpar carrinho para próxima venda rápida
      setCart([]);
      setDiscountValue('');
      setCashTendered('');
      setCustomerName('');
    } catch (err: any) {
      alert(err.error || err.message || 'Erro ao concluir venda');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-100 dark:bg-slate-950 animate-in fade-in duration-150 overflow-hidden">
      <div className="flex-1 flex flex-col w-full h-full overflow-hidden">
        
        {/* Header do PDV Expresso */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400 shadow-md shadow-amber-500/10">
              <Zap className="w-5 h-5 fill-amber-500 dark:fill-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Venda Rápida de Balcão (PDV Tela Cheia)</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  PDV Expresso
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Atendimento ágil direto no balcão sem necessidade de abrir mesa</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/60 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notificação de Sucesso Rápida */}
        {lastSuccess && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-6 py-2.5 flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="w-4 h-4" />
              <span>Venda #{lastSuccess.order.orderNumber} finalizada com sucesso!</span>
              {lastSuccess.change > 0 && (
                <span className="bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/40 text-slate-900 dark:text-white font-mono">
                  Troco: R$ {lastSuccess.change.toFixed(2)}
                </span>
              )}
            </div>
            <button
              onClick={() => setLastSuccess(null)}
              className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs cursor-pointer"
            >
              Dispensar
            </button>
          </div>
        )}

        {/* Corpo Principal (Catálogo à Esquerda + Carrinho/Checkout à Direita) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Lado Esquerdo: Catálogo de Produtos */}
          <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
            {/* Barra de Pesquisa e Categorias */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                <input
                  ref={searchInputRef}
                  autoFocus
                  type="text"
                  id="quick-sale-search"
                  name="quickSaleSearch"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Digite iniciais (ex: HEIN, AGUA), código (#5001) ou bipe o código de barras + Enter..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-amber-500 focus:outline-none transition font-medium cursor-text select-text"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg transition cursor-pointer z-10"
                    title="Limpar busca"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Categorias Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    selectedCategory === 'ALL'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white border border-slate-200 dark:border-transparent'
                  }`}
                >
                  Todos ({products.length})
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white border border-slate-200 dark:border-transparent'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid de Produtos */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
              {loading ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                  Carregando cardápio...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs py-12">
                  <Package className="w-10 h-10 mb-2 stroke-[1.5]" />
                  Nenhum produto encontrado.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {filteredProducts.map(product => {
                    const cartUnits = cart.find(item => item.product.id === product.id && item.unitType === 'UNIT');
                    const cartBoxes = cart.find(item => item.product.id === product.id && item.unitType === 'BOX');
                    const totalCartCount = (cartUnits?.quantity || 0) + (cartBoxes?.quantity || 0);
                    const isLowStock = product.trackStock && product.stock <= product.minStock;

                    return (
                      <div
                        key={product.id}
                        className={`p-3 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                          totalCartCount > 0
                            ? 'bg-amber-500/10 border-amber-500/40 shadow-sm shadow-amber-500/10'
                            : 'bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 shadow-xs'
                        }`}
                      >
                        {totalCartCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-slate-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-md z-10">
                            {totalCartCount}
                          </span>
                        )}

                        <div className="mb-2">
                          <div className="flex items-start justify-between gap-1 mb-0.5">
                            <span className="font-bold text-xs text-slate-900 dark:text-white line-clamp-2 leading-snug flex-1">
                              {product.name}
                            </span>
                            {product.code && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 shrink-0">
                                #{product.code}
                              </span>
                            )}
                          </div>
                          {product.description && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                              {product.description}
                            </div>
                          )}
                        </div>

                        {/* Seletor Visual de Preço: Unidade vs Caixa */}
                        {product.hasBoxPrice && product.boxPrice ? (
                          <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800/60">
                            <div className="grid grid-cols-2 gap-1">
                              {/* Botão Unidade Avulsa */}
                              <button
                                type="button"
                                onClick={() => handleAddToCart(product, 'UNIT')}
                                className="px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-amber-400 transition flex flex-col items-center justify-center cursor-pointer group/btn active:scale-95"
                                title="Adicionar 1 Unidade Avulsa"
                              >
                                <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400 group-hover/btn:text-slate-900">
                                  Unidade
                                </span>
                                <span className="text-[11px] font-black font-mono text-emerald-600 dark:text-emerald-400 group-hover/btn:text-slate-950">
                                  R$ {Number(product.price || 0).toFixed(2)}
                                </span>
                                {cartUnits && (
                                  <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 group-hover/btn:text-slate-950">
                                    ({cartUnits.quantity}x)
                                  </span>
                                )}
                              </button>

                              {/* Botão Caixa Fechada */}
                              <button
                                type="button"
                                onClick={() => handleAddToCart(product, 'BOX')}
                                className="px-2 py-1.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 hover:bg-amber-500 hover:text-slate-950 text-amber-800 dark:text-amber-300 border border-amber-500/30 hover:border-amber-400 transition flex flex-col items-center justify-center cursor-pointer group/box active:scale-95"
                                title={`Adicionar Caixa com ${product.boxQuantity || 24} unidades`}
                              >
                                <span className="text-[9px] uppercase font-black tracking-wider flex items-center gap-0.5 group-hover/box:text-slate-950">
                                  <Package className="w-2.5 h-2.5" /> Cx {product.boxQuantity || 24}x
                                </span>
                                <span className="text-[11px] font-black font-mono text-slate-900 dark:text-white group-hover/box:text-slate-950">
                                  R$ {Number(product.boxPrice).toFixed(2)}
                                </span>
                                {cartBoxes && (
                                  <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 group-hover/box:text-slate-950">
                                    ({cartBoxes.quantity} cx)
                                  </span>
                                )}
                              </button>
                            </div>

                            <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400 px-0.5">
                              {product.trackStock && (
                                <span className={isLowStock ? 'text-rose-500 dark:text-rose-400 font-bold' : ''}>
                                  Estoque: {product.stock} un
                                </span>
                              )}
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400/90 font-mono">
                                R$ {(Number(product.boxPrice) / (product.boxQuantity || 24)).toFixed(2)}/un
                              </span>
                            </div>
                          </div>
                        ) : (
                          /* Botão Simples Para Produtos sem opção de Caixa */
                          <button
                            type="button"
                            onClick={() => handleAddToCart(product, 'UNIT')}
                            className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800/50 w-full hover:text-amber-500 transition cursor-pointer"
                          >
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                              R$ {Number(product.price || 0).toFixed(2)}
                            </span>

                            {product.trackStock && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                isLowStock 
                                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300' 
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-transparent'
                              }`}>
                                {product.stock} un
                              </span>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Lado Direito: Carrinho & Pagamento Instantâneo */}
          <div className="w-full md:w-96 flex flex-col bg-slate-50 dark:bg-slate-950 justify-between border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800">
            
            {/* Lista de Itens do Carrinho */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900/80">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-300">
                Itens da Venda ({cart.reduce((a, b) => a + b.quantity, 0)})
              </span>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-[11px] font-bold text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 flex items-center gap-1 transition cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Limpar
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs text-center py-10">
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-600 mb-2">
                    <Zap className="w-6 h-6" />
                  </div>
                  <span>Clique nos produtos ao lado para adicionar à venda rápida.</span>
                </div>
              ) : (
                cart.map(item => (
                  <div
                    key={`${item.product.id}-${item.unitType}`}
                    className="p-3 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-2 shadow-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.product.name}</span>
                        {item.unitType === 'BOX' ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-black border border-amber-500/30 flex items-center gap-1">
                            <Package className="w-2.5 h-2.5" /> Cx {item.product.boxQuantity || 24}x
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-bold border border-slate-200 dark:border-transparent">
                            Un
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        R$ {item.unitPrice.toFixed(2)} {item.unitType === 'BOX' ? 'cx' : 'un'}
                      </div>
                    </div>

                    {/* Controles de Quantidade */}
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-800">
                      <button
                        onClick={() => handleUpdateQuantity(item.product.id, item.unitType, -1)}
                        className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-0.5 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold text-slate-900 dark:text-white w-5 text-center font-mono">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(item.product.id, item.unitType, 1)}
                        className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right min-w-[65px]">
                      <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        R$ {(item.unitPrice * item.quantity).toFixed(2)}
                      </div>
                      <button
                        onClick={() => handleRemoveFromCart(item.product.id, item.unitType)}
                        className="text-slate-400 hover:text-rose-500 p-0.5 transition cursor-pointer"
                        title="Remover item do carrinho"
                      >
                        <Trash2 className="w-3 h-3 ml-auto" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Painel de Fechamento & Pagamento */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-3">
              
              {/* Desconto e Cliente */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                    Desconto (R$)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={discountValue}
                    onChange={e => setDiscountValue(e.target.value.replace(',', '.'))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                    Cliente (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Nome ou CPF"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600"
                  />
                </div>
              </div>

              {/* Seletor de Forma de Pagamento */}
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1.5">
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('PIX')}
                    className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition cursor-pointer ${
                      paymentMethod === 'PIX'
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/50'
                        : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>PIX</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition cursor-pointer ${
                      paymentMethod === 'CASH'
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/50'
                        : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Dinheiro</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CREDIT_CARD')}
                    className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition cursor-pointer ${
                      paymentMethod === 'CREDIT_CARD'
                        ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/50'
                        : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Crédito</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('DEBIT_CARD')}
                    className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition cursor-pointer ${
                      paymentMethod === 'DEBIT_CARD'
                        ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/50'
                        : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Débito</span>
                  </button>
                </div>
              </div>

              {/* Troco em Dinheiro */}
              {paymentMethod === 'CASH' && (
                <div className="bg-slate-50 dark:bg-slate-950/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Valor Entregue:</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={`R$ ${total.toFixed(2)}`}
                      value={cashTendered}
                      onChange={e => setCashTendered(e.target.value.replace(',', '.'))}
                      className="w-28 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-mono text-right font-bold focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* Atalhos rápidos de notas */}
                  <div className="flex items-center gap-1 justify-end">
                    {[20, 50, 100].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCashTendered(String(val))}
                        className="px-2 py-0.5 text-[10px] font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md transition cursor-pointer"
                      >
                        R${val}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCashTendered(total.toFixed(2))}
                      className="px-2 py-0.5 text-[10px] font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 rounded-md transition cursor-pointer"
                    >
                      Exato
                    </button>
                  </div>

                  {change > 0 && (
                    <div className="flex items-center justify-between text-xs font-black text-amber-600 dark:text-amber-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                      <span>Troco a Devolver:</span>
                      <span className="font-mono text-sm">R$ {change.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Totalizador */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">Total a Pagar</span>
                  {discountNum > 0 && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 line-through">
                      R$ {subtotal.toFixed(2)}
                    </span>
                  )}
                </div>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  R$ {total.toFixed(2)}
                </span>
              </div>

              {/* Opção de Impressão */}
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={printReceipt}
                  onChange={e => setPrintReceipt(e.target.checked)}
                  className="rounded bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-amber-500 focus:ring-0"
                />
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir comprovante térmico</span>
              </label>

              {/* Botão de Conclusão */}
              <button
                type="button"
                onClick={handleFinishSale}
                disabled={cart.length === 0 || submitting}
                className="w-full py-3.5 px-4 rounded-2xl font-black text-sm uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 transition shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 fill-slate-950" />
                )}
                {submitting ? 'Finalizando...' : `Concluir Venda (R$ ${total.toFixed(2)})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
