import React, { useState, useEffect, useRef } from 'react';
import { Product, Category, Order, ModifierOption } from '../types';
import { api } from '../services/api';
import { useActivePromotions } from '../services/promotions';
import { productModifierGroups } from '../utils/pricing';
import { ModifierPickerModal } from './ModifierPickerModal';
import { emitNfceForOrder, isValidNcm, printNfceDanfe } from '../services/nfce';
import { getCpfCnpjError, NFCE_LIMITE_SEM_IDENTIFICACAO } from '../utils/fiscalDoc';
import { printOrderReceipt } from '../services/printService';
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
  Loader2,
  FileText,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

interface QuickSaleModalProps {
  onClose: () => void;
  onSuccess: (order: Order) => void;
}

interface CartItem {
  key: string; // produto + unidade/caixa + opções escolhidas
  product: Product;
  quantity: number;
  unitType: 'UNIT' | 'BOX';
  options: ModifierOption[];
  notes?: string;
}

// Situação da NFC-e de cada venda (a emissão roda depois da venda gravada e não trava o próximo atendimento)
interface NfceSaleStatus {
  orderNumber: number;
  status: 'emitting' | 'authorized' | 'processing' | 'error';
  message?: string;
  danfeUrl?: string | null;
  retry?: () => void;
}

// Etiqueta das teclas de atalho: legível nos temas claro e escuro
const KBD_CLASS = 'inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 text-[10px] leading-none font-black font-mono shadow-sm bg-white text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600';

const cartKey = (productId: string, unitType: 'UNIT' | 'BOX', options: ModifierOption[]) =>
  `${productId}|${unitType}|${options.map((o) => o.id).sort().join(',')}`;

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

  // NFC-e: desligada por padrão sempre que a tela abre; entre uma venda e outra fica como o operador deixou (F8 alterna)
  const [emitNfce, setEmitNfce] = useState<boolean>(false);
  const [nfceDoc, setNfceDoc] = useState<string>('');
  const [nfceStatuses, setNfceStatuses] = useState<NfceSaleStatus[]>([]);

  // Estados de controle
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [lastSuccess, setLastSuccess] = useState<{ order: Order; change: number } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const { priceFor } = useActivePromotions();

  // Atalhos do balcão: Ctrl+L vai para a busca, F8 liga/desliga NFC-e, F12 conclui a venda, Shift+A..D escolhe a forma de pagamento.
  // Refs para o handler (registrado uma vez) sempre enxergar o carrinho e o estado atuais.
  const finishSaleRef = useRef<() => void>(() => {});
  const pickerOpenRef = useRef<boolean>(false);
  pickerOpenRef.current = pickerProduct !== null;

  useEffect(() => {
    const PAYMENT_KEYS: Record<string, 'PIX' | 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD'> = {
      KeyA: 'PIX',
      KeyB: 'CASH',
      KeyC: 'CREDIT_CARD',
      KeyD: 'DEBIT_CARD'
    };
    const onKey = (e: KeyboardEvent) => {
      // Ctrl+L: volta o cursor para a busca de produtos (sem mouse), selecionando o que estiver digitado
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === 'KeyL') {
        e.preventDefault();
        if (pickerOpenRef.current) return;
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === 'F8') {
        e.preventDefault();
        setEmitNfce(v => !v);
        return;
      }
      if (e.key === 'F12') {
        e.preventDefault();
        if (!pickerOpenRef.current) finishSaleRef.current();
        return;
      }
      const method = e.shiftKey ? PAYMENT_KEYS[e.code] : undefined;
      if (!method || pickerOpenRef.current) return;
      // Num campo de texto o Shift+letra digita a maiúscula; na busca vazia (logo após bipar) vale o atalho
      const el = document.activeElement as HTMLInputElement | null;
      const isTextField = !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT'
        && !['decimal', 'numeric'].includes(el.inputMode) && ['text', 'search', 'email', ''].includes(el.type)));
      const isEmptySearch = el === searchInputRef.current && !el?.value;
      if (isTextField && !isEmptySearch) return;
      e.preventDefault();
      setPaymentMethod(method);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Fechar com NFC-e ainda sendo emitida: a emissão continua, mas o aviso de erro some com a tela
  const handleClose = () => {
    if (nfceStatuses.some(st => st.status === 'emitting')
      && !window.confirm('Ainda há NFC-e sendo emitida. Se fechar agora, um erro na emissão não vai aparecer aqui (confira depois em Reimpressão de NFC-e). Fechar mesmo assim?')) {
      return;
    }
    onClose();
  };

  const updateNfceStatus = (next: NfceSaleStatus) =>
    setNfceStatuses(prev => [next, ...prev.filter(s => s.orderNumber !== next.orderNumber)].slice(0, 4));

  // Emite a NFC-e da venda já gravada; falha da SEFAZ não desfaz a venda (dá para tentar de novo)
  const runNfceEmission = async (order: Order, customerDoc: string, method: string, fallbackReceipt: boolean) => {
    updateNfceStatus({ orderNumber: order.orderNumber, status: 'emitting' });
    try {
      const result = await emitNfceForOrder(order, { customerDoc, paymentMethod: method });
      if (result.status === 'authorized') {
        printNfceDanfe(result.danfeUrl);
        updateNfceStatus({ orderNumber: order.orderNumber, status: 'authorized', danfeUrl: result.danfeUrl });
      } else {
        updateNfceStatus({
          orderNumber: order.orderNumber,
          status: 'processing',
          message: `Em processamento na SEFAZ (ref: ${result.referencia}). NÃO emita de novo: consulte em Reimpressão de NFC-e.`
        });
      }
    } catch (err: any) {
      if (fallbackReceipt) printOrderReceipt(order);
      updateNfceStatus({
        orderNumber: order.orderNumber,
        status: 'error',
        message: err?.message || 'Falha ao emitir a NFC-e.',
        retry: () => runNfceEmission(order, customerDoc, method, false)
      });
    }
  };

  // Preço calculado na hora: se a promoção do dia começar/terminar com o carrinho aberto, o total acompanha
  const linePrice = (item: CartItem) =>
    item.unitType === 'BOX'
      ? Number(item.product.boxPrice)
      : priceFor(item.product).price + item.options.reduce((acc, o) => acc + o.price, 0);

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
      // Mostra o cache na hora e atualiza em seguida: adicionais/preços novos cadastrados no PC
      api.getProducts(undefined, undefined, true).then(fresh => setProducts(fresh.filter(p => p.isActive))).catch(() => {});
    } catch (err) {
      console.error('Erro ao carregar cardápio:', err);
    } finally {
      setLoading(false);
      setTimeout(() => searchInputRef.current?.focus(), 150);
    }
  };

  // Funções do Carrinho
  const addLine = (product: Product, unitType: 'UNIT' | 'BOX', options: ModifierOption[] = []) => {
    const isBox = unitType === 'BOX' && product.hasBoxPrice && product.boxPrice;
    const finalType: 'UNIT' | 'BOX' = isBox ? 'BOX' : 'UNIT';
    const key = cartKey(product.id, finalType, isBox ? [] : options);

    setCart(prev => {
      const idx = prev.findIndex(item => item.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, {
        key,
        product,
        quantity: 1,
        unitType: finalType,
        options: isBox ? [] : options,
        notes: isBox ? `Caixa Fechada (${product.boxQuantity || 24} un)` : undefined
      }];
    });
  };

  // Produto com perguntas/adicionais abre a escolha antes de entrar no carrinho. Pelo leitor de código de barras
  // só abre se houver pergunta obrigatória, para não travar a venda rápida (opcionais: tocar no produto).
  const handleAddToCart = (product: Product, unitType: 'UNIT' | 'BOX' = 'UNIT', fromScanner = false) => {
    const groups = unitType === 'UNIT' ? productModifierGroups(product) : [];
    const needsPicker = fromScanner ? groups.some(g => g.minSelect > 0) : groups.length > 0;
    if (needsPicker) setPickerProduct(product);
    else addLine(product, unitType);
  };

  const closePicker = () => {
    setPickerProduct(null);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const handleUpdateQuantity = (key: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(item => {
          if (item.key === key) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleRemoveFromCart = (key: string) => {
    setCart(prev => prev.filter(item => item.key !== key));
  };

  // Cálculos
  const subtotal = cart.reduce((acc, item) => acc + (linePrice(item) * item.quantity), 0);
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
      // Com a escolha de opções aberta, um novo bipe trocaria o produto em escolha e o primeiro sumiria
      if (pickerProduct) return;
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
        handleAddToCart(exactBox, 'BOX', true);
        setSearch('');
        return;
      }

      // 2. Tenta correspondência exata por código de barras EAN ou código interno (#5001)
      const exact = products.find(p => 
        (p.ean && (String(p.ean).toLowerCase() === rawTerm || String(p.ean).toLowerCase() === cleanTerm)) ||
        (p.code && (String(p.code).toLowerCase() === rawTerm || String(p.code).toLowerCase() === cleanTerm))
      );

      if (exact) {
        handleAddToCart(exact, 'UNIT', true);
        setSearch('');
        return;
      }

      // 3. Se houver resultados filtrados, adiciona o primeiro item imediatamente
      if (filteredProducts.length > 0) {
        handleAddToCart(filteredProducts[0], 'UNIT', true);
        setSearch('');
      }
    }
  };

  // Finalizar Venda
  const handleFinishSale = async () => {
    if (cart.length === 0) return;
    if (submitting) return;

    // Conferências da NFC-e antes de gravar a venda (depois de gravada, só a nota poderia falhar)
    const customerDoc = nfceDoc.replace(/\D/g, '');
    if (emitNfce) {
      const docError = getCpfCnpjError(nfceDoc);
      if (docError) {
        alert(`${docError} Corrija o CPF/CNPJ da nota ou deixe em branco.`);
        return;
      }
      if (total <= 0) {
        alert('Venda com total zero não pode ter NFC-e. Desligue a NFC-e (F8) para concluir.');
        return;
      }
      if (!customerDoc && total >= NFCE_LIMITE_SEM_IDENTIFICACAO) {
        alert('Para NFC-e a partir de R$ 10.000,00 a SEFAZ exige o CPF ou CNPJ do consumidor.');
        return;
      }
      const semNcm = Array.from(new Set(cart.filter(i => !isValidNcm(i.product.ncm)).map(i => i.product.name)));
      if (semNcm.length > 0) {
        alert(`Sem NCM no cadastro: ${semNcm.join(', ')}.\n\nCadastre o NCM (8 dígitos) em Cardápio & Estoque ou desligue a NFC-e (F8) para concluir sem nota.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      const res = await api.quickSale({
        items: cart.map(i => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitType: i.unitType,
          notes: i.notes,
          modifierOptionIds: i.options.map(o => o.id)
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

      // Com NFC-e o cupom fiscal substitui o comprovante; se a nota falhar, sai o comprovante (se marcado)
      if (emitNfce) {
        runNfceEmission(res.order, customerDoc, paymentMethod, printReceipt);
      } else if (printReceipt) {
        printOrderReceipt(res.order);
      }

      // Limpar carrinho para próxima venda rápida
      setCart([]);
      setDiscountValue('');
      setCashTendered('');
      setCustomerName('');
      setNfceDoc('');
    } catch (err: any) {
      alert(err.error || err.message || 'Erro ao concluir venda');
    } finally {
      setSubmitting(false);
    }
  };

  finishSaleRef.current = handleFinishSale;

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
            onClick={handleClose}
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

        {/* Situação das NFC-e das últimas vendas */}
        {nfceStatuses.length > 0 && (
          <div className="px-6 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 space-y-1">
            {nfceStatuses.map(st => (
              <div key={st.orderNumber} className="flex items-center justify-between gap-3 text-xs">
                <div className={`flex items-center gap-2 font-bold min-w-0 ${
                  st.status === 'authorized' ? 'text-emerald-600 dark:text-emerald-400'
                    : st.status === 'error' ? 'text-red-600 dark:text-red-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}>
                  {st.status === 'emitting' ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    : st.status === 'authorized' ? <FileText className="w-3.5 h-3.5 shrink-0" />
                    : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">
                    Venda #{st.orderNumber} · NFC-e {
                      st.status === 'emitting' ? 'sendo emitida...'
                        : st.status === 'authorized' ? 'autorizada'
                        : st.status === 'processing' ? 'em processamento'
                        : 'não emitida'
                    }{st.message ? `: ${st.message}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {st.status === 'authorized' && st.danfeUrl && (
                    <button type="button" onClick={() => printNfceDanfe(st.danfeUrl || null)} className="flex items-center gap-1 font-bold text-slate-600 dark:text-slate-300 hover:underline cursor-pointer">
                      <Printer className="w-3 h-3" /> Reimprimir
                    </button>
                  )}
                  {st.status === 'error' && st.retry && (
                    <button type="button" onClick={st.retry} className="flex items-center gap-1 font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer">
                      <RotateCcw className="w-3 h-3" /> Tentar de novo
                    </button>
                  )}
                  {st.status !== 'emitting' && (
                    <button type="button" onClick={() => setNfceStatuses(prev => prev.filter(x => x.orderNumber !== st.orderNumber))} className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer" title="Dispensar">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
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
                  className="w-full pl-10 pr-20 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-amber-500 focus:outline-none transition font-medium cursor-text select-text"
                />
                {!search && (
                  <kbd className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${KBD_CLASS}`} title="Ir para a busca">Ctrl+L</kbd>
                )}
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
                    const sumQty = (unitType: 'UNIT' | 'BOX') =>
                      cart.filter(item => item.product.id === product.id && item.unitType === unitType).reduce((acc, item) => acc + item.quantity, 0);
                    const cartUnits = sumQty('UNIT') > 0 ? { quantity: sumQty('UNIT') } : undefined;
                    const cartBoxes = sumQty('BOX') > 0 ? { quantity: sumQty('BOX') } : undefined;
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
                                  R$ {priceFor(product).price.toFixed(2)}
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
                              {priceFor(product).promotion && (
                                <span className="block text-[10px] font-bold text-slate-400 line-through">R$ {Number(product.price || 0).toFixed(2)}</span>
                              )}
                              R$ {priceFor(product).price.toFixed(2)}
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
                    key={item.key}
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
                        R$ {linePrice(item).toFixed(2)} {item.unitType === 'BOX' ? 'cx' : 'un'}
                      </div>
                      {item.options.length > 0 && (
                        <div className="text-[10px] text-blue-700 dark:text-blue-300 font-semibold truncate">
                          {item.options.map(o => o.name).join(' · ')}
                        </div>
                      )}
                      {item.unitType === 'UNIT' && priceFor(item.product).promotion && (
                        <div className="text-[10px] text-rose-600 dark:text-rose-300 font-bold truncate">
                          {priceFor(item.product).promotion?.name}
                        </div>
                      )}
                    </div>

                    {/* Controles de Quantidade */}
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-800">
                      <button
                        onClick={() => handleUpdateQuantity(item.key, -1)}
                        className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-0.5 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold text-slate-900 dark:text-white w-5 text-center font-mono">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(item.key, 1)}
                        className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right min-w-[65px]">
                      <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        R$ {(linePrice(item) * item.quantity).toFixed(2)}
                      </div>
                      <button
                        onClick={() => handleRemoveFromCart(item.key)}
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
                    className={`relative pt-5 pb-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition cursor-pointer ${
                      paymentMethod === 'PIX'
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/50'
                        : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>PIX</span>
                    <kbd className={`absolute top-1 right-1 ${KBD_CLASS}`} title="Shift+A">⇧A</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`relative pt-5 pb-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition cursor-pointer ${
                      paymentMethod === 'CASH'
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/50'
                        : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Dinheiro</span>
                    <kbd className={`absolute top-1 right-1 ${KBD_CLASS}`} title="Shift+B">⇧B</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CREDIT_CARD')}
                    className={`relative pt-5 pb-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition cursor-pointer ${
                      paymentMethod === 'CREDIT_CARD'
                        ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/50'
                        : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Crédito</span>
                    <kbd className={`absolute top-1 right-1 ${KBD_CLASS}`} title="Shift+C">⇧C</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('DEBIT_CARD')}
                    className={`relative pt-5 pb-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition cursor-pointer ${
                      paymentMethod === 'DEBIT_CARD'
                        ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/50'
                        : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Débito</span>
                    <kbd className={`absolute top-1 right-1 ${KBD_CLASS}`} title="Shift+D">⇧D</kbd>
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

              {/* NFC-e: liga/desliga rápido (F8) */}
              <div className={`rounded-xl border p-2.5 space-y-2 transition ${emitNfce ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60'}`}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={emitNfce}
                  onClick={() => setEmitNfce(v => !v)}
                  className="w-full flex items-center justify-between gap-2 cursor-pointer select-none"
                  title="Emitir NFC-e nesta venda (atalho F8)"
                >
                  <span className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                    <FileText className={`w-4 h-4 ${emitNfce ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                    Emitir NFC-e
                    <kbd className={KBD_CLASS}>F8</kbd>
                  </span>
                  {/* shrink-0: sem ele o trilho encolhia com o texto ao lado e a bolinha saía para fora */}
                  <span className={`relative inline-block w-10 h-5 shrink-0 rounded-full transition-colors ${emitNfce ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${emitNfce ? 'translate-x-5' : 'translate-x-0'}`} />
                  </span>
                </button>
                {emitNfce && (
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="CPF/CNPJ na nota (opcional)"
                    value={nfceDoc}
                    onChange={e => setNfceDoc(e.target.value)}
                    className={`w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border rounded-lg text-xs text-slate-900 dark:text-white font-mono focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 ${
                      getCpfCnpjError(nfceDoc) ? 'border-red-400 focus:border-red-500' : 'border-slate-300 dark:border-slate-700 focus:border-emerald-500'
                    }`}
                  />
                )}
                {emitNfce && getCpfCnpjError(nfceDoc) && nfceDoc.replace(/\D/g, '').length > 0 && (
                  <p className="text-[10px] font-bold text-red-600 dark:text-red-400">{getCpfCnpjError(nfceDoc)}</p>
                )}
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
                <span>{emitNfce ? 'Imprimir comprovante se a NFC-e falhar' : 'Imprimir comprovante térmico'}</span>
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
                {submitting ? 'Finalizando...' : `Concluir Venda${emitNfce ? ' + NFC-e' : ''} (R$ ${total.toFixed(2)})`}
                {!submitting && (
                  <kbd className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] leading-none font-black font-mono bg-slate-950/85 text-white shadow-sm">F12</kbd>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {pickerProduct && (
        <ModifierPickerModal
          product={pickerProduct}
          basePrice={priceFor(pickerProduct).price}
          onClose={closePicker}
          onConfirm={(options) => {
            addLine(pickerProduct, 'UNIT', options);
            closePicker();
          }}
        />
      )}
    </div>
  );
};
