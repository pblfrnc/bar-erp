import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  ArrowLeft,
  Search,
  Plus,
  Trash2,
  Send,
  Download,
  Barcode,
  Sparkles,
  CheckCircle,
  Package,
  ShieldCheck,
  CreditCard,
  QrCode,
  Banknote,
  Printer,
  Mail,
  RotateCcw,
  Loader2,
  Copy,
  ExternalLink
} from 'lucide-react';
import { api } from '../services/api';
import { Product } from '../types';

interface ManualNfceViewProps {
  onBack: () => void;
}

export const ManualNfceView: React.FC<ManualNfceViewProps> = ({ onBack }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<{ product: Product; quantity: number }[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDropdownResults, setShowDropdownResults] = useState<boolean>(false);
  const [customerCpf, setCustomerCpf] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('PIX');
  const [isEmitting, setIsEmitting] = useState<boolean>(false);
  const [resultDanfe, setResultDanfe] = useState<string | null>(null);

  // Estados de Finalização e Pós-Venda
  const [saleSuccessData, setSaleSuccessData] = useState<{
    danfeUrl: string;
    referencia?: string;
    total: number;
    chaveAcesso?: string;
    paymentMethod: string;
  } | null>(null);
  const [emailInput, setEmailInput] = useState<string>('');
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState<boolean>(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [printSuccessFeedback, setPrintSuccessFeedback] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getProducts(undefined, undefined, true)
      .then(prods => setProducts(prods))
      .catch(() => {});
  }, []);

  // Filtragem ultra-rápida por iniciais do nome, código interno (#5001) ou EAN
  const filteredSearch = searchTerm.trim() === '' ? [] : products.filter((p) => {
    const term = searchTerm.trim().toLowerCase();
    const nameMatch = Boolean(p.name && p.name.toLowerCase().includes(term));
    const codeMatch = Boolean(p.code && p.code.toLowerCase().includes(term));
    const eanMatch = Boolean(p.ean && p.ean.toLowerCase().includes(term));
    const brandMatch = Boolean(p.brand && p.brand.toLowerCase().includes(term));
    return nameMatch || codeMatch || eanMatch || brandMatch;
  });

  const handleAddProduct = (prod: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === prod.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === prod.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product: prod, quantity: 1 }];
    });
    setSearchTerm('');
    setShowDropdownResults(false);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!searchTerm.trim()) return;

      // 1. Tenta correspondência exata por código de barras EAN ou código interno
      const exactCode = products.find(
        (p) =>
          (p.ean && p.ean.toLowerCase() === searchTerm.trim().toLowerCase()) ||
          (p.code && p.code.toLowerCase() === searchTerm.trim().toLowerCase())
      );

      if (exactCode) {
        handleAddProduct(exactCode);
        return;
      }

      // 2. Se houver apenas 1 resultado filtrado, adiciona direto
      if (filteredSearch.length === 1) {
        handleAddProduct(filteredSearch[0]);
        return;
      }

      // 3. Se houver mais de 1, abre a lista de seleção rápida
      if (filteredSearch.length > 1) {
        setShowDropdownResults(true);
      }
    } else if (e.key === 'Escape') {
      setShowDropdownResults(false);
    }
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, newQty: number) => {
    if (newQty < 1) return;
    setItems((prev) => {
      const copy = [...prev];
      copy[index].quantity = newQty;
      return copy;
    });
  };

  const total = items.reduce((acc, curr) => acc + (curr.product.price * curr.quantity), 0);

  const handleResetForNewSale = () => {
    setItems([]);
    setSaleSuccessData(null);
    setResultDanfe(null);
    setSearchTerm('');
    setCustomerCpf('');
    setCustomerName('');
    setEmailInput('');
    setEmailSentSuccess(false);
    setEmailError(null);
    setPrintSuccessFeedback(false);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 150);
  };

  const handlePrintDanfe = () => {
    const url = saleSuccessData?.danfeUrl || resultDanfe;
    if (!url) return;
    if ((window as any).electronAPI?.printPdfSilent) {
      (window as any).electronAPI.printPdfSilent(url);
      setPrintSuccessFeedback(true);
      setTimeout(() => setPrintSuccessFeedback(false), 3000);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleSendEmail = async () => {
    if (!emailInput.trim() || !emailInput.includes('@')) {
      alert('Digite um endereço de e-mail válido.');
      return;
    }
    const ref = saleSuccessData?.referencia;
    if (!ref) {
      alert('Referência da nota não localizada para envio.');
      return;
    }

    setIsSendingEmail(true);
    setEmailError(null);
    try {
      const res = await fetch(api.getApiUrl() + '/fiscal/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referencia: ref,
          email: emailInput.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar e-mail.');
      setEmailSentSuccess(true);
    } catch (err: any) {
      setEmailError(err.message || 'Falha no envio do e-mail.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Atalho de teclado no pós-venda: Enter ou Espaço fecha o aviso e inicia a nova venda
  useEffect(() => {
    if (!saleSuccessData) return;
    const handleKey = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTypingEmail = activeEl && activeEl.tagName === 'INPUT' && (activeEl as HTMLInputElement).type === 'email';
      if (e.key === 'Escape' || (e.key === 'Enter' && !isTypingEmail)) {
        e.preventDefault();
        handleResetForNewSale();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [saleSuccessData]);

  const handleEmit = async () => {
    if (items.length === 0) {
      alert('Adicione pelo menos um produto à nota fiscal.');
      return;
    }
    setIsEmitting(true);
    try {
      const saleTotal = total;
      const payload = {
        orderId: `${Date.now()}${Math.floor(Math.random() * 9000) + 1000}`,
        customerCpf: customerCpf.replace(/\D/g, '') || undefined,
        customerName: customerName.trim() || undefined,
        paymentMethod,
        items: items.map((i) => ({
          productId: i.product.id,
          ean: i.product.ean,
          code: i.product.code,
          quantity: i.quantity,
          price: i.product.price,
          name: i.product.name,
          ncm: i.product.ncm || '22030000',
          cfop: i.product.cfop || '5102',
          unit: i.product.unit || 'un',
          cest: i.product.cest || undefined
        }))
      };

      const res = await fetch(api.getApiUrl() + '/fiscal/emit-nfce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na transmissão à SEFAZ.');
      
      const danfeUrl = data.caminhoDanfe;
      const refNota = data.referencia || data.ref;
      const chaveNota = data.chaveAcesso;

      setResultDanfe(danfeUrl);
      setSaleSuccessData({
        danfeUrl,
        referencia: refNota,
        total: saleTotal,
        chaveAcesso: chaveNota,
        paymentMethod
      });
      setEmailSentSuccess(false);
      setEmailError(null);
      setPrintSuccessFeedback(false);

      // Disparo automático e silencioso da impressão na impressora térmica (Sem tela do Windows)
      if (danfeUrl && (window as any).electronAPI?.printPdfSilent) {
        (window as any).electronAPI.printPdfSilent(danfeUrl);
        setPrintSuccessFeedback(true);
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao emitir NFC-e');
    } finally {
      setIsEmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl w-full mx-auto pb-24 animate-in fade-in duration-200">
      {/* Cabeçalho de Navegação */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-sm dark:shadow-xl">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-2xl transition border border-slate-200 dark:border-slate-700/60 active:scale-95 group cursor-pointer"
            title="Voltar ao Painel Fiscal"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Emissor Fiscal de NFC-e (Tela Cheia)</h2>
              <span className="px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/20 text-xs font-bold">
                SEFAZ ONLINE
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Busque produtos por iniciais ou bipe código de barras com adição automática ao teclar Enter
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setItems([])}
              className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Limpar Itens</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid Principal (2 Colunas Espaçosas) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUNA ESQUERDA (7 colunas): Busca Inteligente & Tabela de Itens */}
        <div className="lg:col-span-7 space-y-5">
          {/* Card de Busca Rápida de Produtos */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm dark:shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="nfce-search-input" className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1.5 cursor-pointer">
                <Search className="w-4 h-4 text-amber-500" />
                <span>Busca Rápida de Produtos (Iniciais, Código ou Barcode)</span>
              </label>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                Pressione <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-amber-700 dark:text-amber-300 border border-slate-200 dark:border-slate-700">Enter</kbd> para adicionar
              </span>
            </div>

            <div className="relative">
              <Barcode className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="nfce-search-input"
                ref={searchInputRef}
                type="text"
                autoFocus
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowDropdownResults(true);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Digite as iniciais (ex: HEIN, AGUA, 5001) ou bipe o EAN..."
                className="w-full pl-11 pr-24 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white text-sm focus:border-amber-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium cursor-text shadow-xs"
              />

              {searchTerm && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {filteredSearch.length} {filteredSearch.length === 1 ? 'item' : 'itens'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setShowDropdownResults(false);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Lista Flutuante de Resultados da Busca */}
              {showDropdownResults && searchTerm.trim() !== '' && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-30 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSearch.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Nenhum produto encontrado com "{searchTerm}".
                    </div>
                  ) : (
                    filteredSearch.slice(0, 10).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleAddProduct(p)}
                        className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer flex items-center justify-between gap-3 transition group"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 flex items-center gap-2">
                            <span>{p.name}</span>
                            {p.code && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                                #{p.code}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {p.brand && <span>{p.brand}</span>}
                            {p.ncm && <span className="font-mono text-cyan-600 dark:text-cyan-400">NCM: {p.ncm}</span>}
                            {p.cfop && <span className="font-mono text-slate-400 dark:text-slate-500">CFOP: {p.cfop}</span>}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-black font-mono text-amber-600 dark:text-amber-400">
                            R$ {p.price.toFixed(2)}
                          </div>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 justify-end">
                            <Plus className="w-3 h-3" /> Adicionar
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tabela de Itens da NFC-e */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm dark:shadow-xl">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Itens a Serem Emitidos ({items.reduce((a, b) => a + b.quantity, 0)} unidades)
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {items.length} {items.length === 1 ? 'produto único' : 'produtos'}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="p-12 text-center text-slate-400 dark:text-slate-500">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-30 text-slate-400" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-400">Nenhum produto adicionado ainda</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Digite as iniciais do produto no campo de busca acima e pressione Enter para incluí-lo automaticamente.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-950/80 uppercase text-[10px] tracking-wider text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Produto & Dados Fiscais</th>
                      <th className="py-3 px-4 text-center">Qtd</th>
                      <th className="py-3 px-4 text-right">Unitário</th>
                      <th className="py-3 px-4 text-right">Subtotal</th>
                      <th className="py-3 px-4 text-center">Remover</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {items.map((item, index) => {
                      const itemSubtotal = item.product.price * item.quantity;
                      return (
                        <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white text-sm">
                              {item.product.name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              {item.product.code && (
                                <span className="text-slate-400 dark:text-slate-500">#{item.product.code}</span>
                              )}
                              <span className="text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 px-1 rounded border border-cyan-200 dark:border-cyan-900/40">
                                NCM: {item.product.ncm || '22030000'}
                              </span>
                              <span className="text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 px-1 rounded">
                                CFOP: {item.product.cfop || '5102'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => updateQuantity(index, item.quantity - 1)}
                                className="px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 font-bold text-xs transition cursor-pointer"
                              >
                                -
                              </button>
                              <span className="px-3 font-mono font-bold text-slate-900 dark:text-white text-xs">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(index, item.quantity + 1)}
                                className="px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 font-bold text-xs transition cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right font-mono text-slate-500 dark:text-slate-400">
                            R$ {item.product.price.toFixed(2)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                            R$ {itemSubtotal.toFixed(2)}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                              title="Remover da NFC-e"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA (5 colunas): Destinatário, Pagamento & Transmissão */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card Destinatário & Forma de Pagamento */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-base font-black text-slate-900 dark:text-white">Dados da Emissão & Pagamento</h3>
            </div>

            {/* CPF / CNPJ */}
            <div>
              <label htmlFor="nfce-customer-cpf" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5 cursor-pointer">
                CPF / CNPJ na Nota (Opcional)
              </label>
              <input
                id="nfce-customer-cpf"
                type="text"
                placeholder="000.000.000-00 (ou deixar em branco)"
                value={customerCpf}
                onChange={(e) => setCustomerCpf(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-sm focus:border-emerald-500 focus:outline-none cursor-text shadow-xs"
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
                Se informado, o cupom fiscal constará o documento do comprador.
              </span>
            </div>

            {/* Nome do Cliente */}
            <div>
              <label htmlFor="nfce-customer-name" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5 cursor-pointer">
                Nome do Consumidor (Opcional)
              </label>
              <input
                id="nfce-customer-name"
                type="text"
                placeholder="Ex: João da Silva"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-emerald-500 focus:outline-none cursor-text shadow-xs"
              />
            </div>

            {/* Forma de Pagamento SEFAZ */}
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">
                Forma de Pagamento (SEFAZ) *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'PIX', label: 'PIX', icon: QrCode },
                  { id: 'DINHEIRO', label: 'Dinheiro', icon: Banknote },
                  { id: 'CREDITO', label: 'Cartão Crédito', icon: CreditCard },
                  { id: 'DEBITO', label: 'Cartão Débito', icon: CreditCard }
                ].map((pm) => {
                  const Icon = pm.icon;
                  const isSel = paymentMethod === pm.id;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs ${
                        isSel
                          ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{pm.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Card de Resumo e Emissão */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 block">Total a Emitir</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                    {items.reduce((a, b) => a + b.quantity, 0)} itens adicionados
                  </span>
                </div>
                <span className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                  R$ {total.toFixed(2)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleEmit}
                disabled={isEmitting || items.length === 0}
                className="w-full py-4 px-6 rounded-2xl font-black text-sm bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 transition flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-500/20 active:scale-95 cursor-pointer"
              >
                <Send className="w-5 h-5 stroke-[2.5]" />
                <span>{isEmitting ? 'Transmitindo à SEFAZ...' : 'Emitir Cupom Fiscal Agora'}</span>
              </button>

              <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                Ao clicar em emitir, os dados dos produtos, NCM, tributos e pagamento são assinados com certificado digital A1 e validados pelos servidores da SEFAZ estadual.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Venda Finalizada com Sucesso & Pós-Venda */}
      {saleSuccessData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl flex flex-col gap-6 text-center">
            
            {/* Ícone & Título */}
            <div>
              <div className="w-20 h-20 bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-500/10">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Venda Finalizada com Sucesso!</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                NFC-e Autorizada e transmitida à SEFAZ
              </p>
            </div>

            {/* Card com Detalhes da Venda */}
            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Total da Venda</span>
                <span className="text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400">
                  R$ {saleSuccessData.total.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/80 pt-2">
                <span>Forma de Pagamento:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{saleSuccessData.paymentMethod}</span>
              </div>

              {saleSuccessData.chaveAcesso && (
                <div className="border-t border-slate-200 dark:border-slate-800/80 pt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold uppercase text-slate-500">Chave de Acesso SEFAZ</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(saleSuccessData.chaveAcesso!);
                        setCopiedKey(true);
                        setTimeout(() => setCopiedKey(false), 2000);
                      }}
                      className="text-[11px] text-sky-600 dark:text-sky-400 hover:text-sky-500 flex items-center gap-1 font-bold cursor-pointer"
                    >
                      {copiedKey ? '✓ Copiado!' : 'Copiar Chave'}
                    </button>
                  </div>
                  <p className="font-mono text-[11px] text-slate-600 dark:text-slate-400 break-all leading-tight bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200 dark:border-slate-800 select-all">
                    {saleSuccessData.chaveAcesso}
                  </p>
                </div>
              )}
            </div>

            {/* Ações: Imprimir Cupom / Encaminhar E-mail */}
            <div className="flex flex-col gap-3">
              {/* Botão Imprimir */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePrintDanfe}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl font-bold flex items-center justify-center gap-2.5 transition active:scale-98 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>{printSuccessFeedback ? 'Reimprimir Cupom' : 'Imprimir Cupom'}</span>
                </button>

                {saleSuccessData.danfeUrl && (
                  <a
                    href={saleSuccessData.danfeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-xl transition flex items-center justify-center shadow-xs"
                    title="Visualizar PDF do DANFE"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>

              {/* Seção de Envio por E-mail */}
              <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Mail className="w-4 h-4 text-amber-500" />
                  <span>Encaminhar NF por E-mail</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="email.do.cliente@exemplo.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendEmail(); }}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-amber-400 transition"
                  />
                  <button
                    type="button"
                    onClick={handleSendEmail}
                    disabled={isSendingEmail || !emailInput.trim()}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    {isSendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Enviar
                  </button>
                </div>
                {emailSentSuccess && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold text-left flex items-center gap-1">
                    ✓ E-mail com XML e DANFE enviado com sucesso!
                  </p>
                )}
                {emailError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 text-left">
                    {emailError}
                  </p>
                )}
              </div>
            </div>

            {/* Botão de Ação Primária: ZERAR E INICIAR NOVA VENDA */}
            <button
              type="button"
              onClick={handleResetForNewSale}
              className="w-full py-4 px-6 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/25 transition cursor-pointer"
            >
              <RotateCcw className="w-5 h-5" />
              <span>Nova Venda (Zerar)</span>
              <span className="text-xs bg-emerald-950/20 px-2 py-0.5 rounded-md font-mono font-bold text-slate-900">Enter</span>
            </button>

          </div>
        </div>
      )}
    </div>
  );
};
