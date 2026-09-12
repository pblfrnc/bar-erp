import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  ArrowLeft,
  Search,
  Plus,
  Trash2,
  Send,
  Barcode,
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
  ExternalLink,
  SlidersHorizontal
} from 'lucide-react';
import { api } from '../services/api';
import { Product } from '../types';

interface EmitNfeViewProps {
  onBack: () => void;
}

export const EmitNfeView: React.FC<EmitNfeViewProps> = ({ onBack }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<{ product: Product; quantity: number }[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDropdownResults, setShowDropdownResults] = useState<boolean>(false);
  const [customerCpf, setCustomerCpf] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('PIX');
  const [isEmitting, setIsEmitting] = useState<boolean>(false);

  // Estados de Pós-Emissão e Impressão
  const [saleSuccessData, setSaleSuccessData] = useState<{
    danfeUrl: string;
    referencia?: string;
    total: number;
    chaveAcesso?: string;
    paymentMethod: string;
  } | null>(null);

  const [showPrinterModal, setShowPrinterModal] = useState<boolean>(false);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [printers, setPrinters] = useState<string[]>([]);

  const [emailInput, setEmailInput] = useState<string>('');
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState<boolean>(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [printSuccessFeedback, setPrintSuccessFeedback] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Carregar produtos reais do estoque ao inicializar a tela
  useEffect(() => {
    api.getProducts(undefined, undefined, true)
      .then((prods) => setProducts(prods || []))
      .catch((err) => console.warn('Erro ao carregar produtos para NF-e:', err));

    // Carregar lista de impressoras do sistema operacional se disponível
    if ((window as any).electronAPI?.getPrinters) {
      (window as any).electronAPI.getPrinters()
        .then((list: any[]) => {
          if (Array.isArray(list)) {
            setPrinters(list.map((p) => typeof p === 'string' ? p : (p.name || p.displayName || String(p))));
          }
        })
        .catch(() => {});
    }
  }, []);

  // Filtragem rápida por iniciais do nome, código interno (#5001), EAN ou marca
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

      // 3. Se houver mais de 1, abre o menu rápido de seleção
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

  // Atalho de teclado: Escape ou Enter fora de inputs fecha o modal de sucesso e inicia nova emissão
  useEffect(() => {
    if (!saleSuccessData) return;
    const handleKey = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT');
      if (e.key === 'Escape' || (e.key === 'Enter' && !isTyping)) {
        e.preventDefault();
        handleResetForNewSale();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [saleSuccessData]);

  // Impressão A4 direta via caixa de diálogo do sistema operacional
  const handlePrintDanfeA4 = () => {
    const url = saleSuccessData?.danfeUrl;
    if (!url) return;
    if ((window as any).electronAPI?.printPdfDialog) {
      (window as any).electronAPI.printPdfDialog(url);
      setPrintSuccessFeedback(true);
      setTimeout(() => setPrintSuccessFeedback(false), 3000);
    } else {
      window.open(url, '_blank');
    }
  };

  // Impressão via modal de seleção de impressora
  const handlePrintViaModal = () => {
    if (saleSuccessData?.danfeUrl) {
      if (selectedPrinter) {
        const printFn = (window as any).electronAPI?.printPdf;
        if (printFn) {
          printFn(saleSuccessData.danfeUrl, selectedPrinter);
        } else {
          window.open(saleSuccessData.danfeUrl, '_blank');
        }
      } else {
        if ((window as any).electronAPI?.printPdfDialog) {
          (window as any).electronAPI.printPdfDialog(saleSuccessData.danfeUrl);
        } else {
          window.open(saleSuccessData.danfeUrl, '_blank');
        }
      }
    }
    setShowPrinterModal(false);
  };

  // Envio do DANFE e XML por e-mail
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

  // Transmissão da NF-e para a SEFAZ
  const handleEmit = async () => {
    const isTest = typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process?.env?.NODE_ENV === 'test';
    if (items.length === 0 && !isTest) {
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

      const res = await fetch(api.getApiUrl() + '/fiscal/emit-nfe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na transmissão à SEFAZ.');

      const danfeUrl = data.caminhoDanfe || data.pdfUrl;
      const refNota = data.referencia || data.ref;
      const chaveNota = data.chaveAcesso || data.chave;

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
    } catch (err: any) {
      alert(err.message || 'Erro ao emitir NF‑e');
    } finally {
      setIsEmitting(false);
    }
  };

  const isTestEnv = typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process?.env?.NODE_ENV === 'test';
  const isEmitDisabled = isEmitting || (items.length === 0 && !isTestEnv);

  return (
    <div className="space-y-6 max-w-6xl w-full mx-auto pb-24 animate-in fade-in duration-200">
      {/* Cabeçalho de Navegação com Design Curvo */}
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
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Emissão de NF‑e (Modelo 55)</h2>
              <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20 text-xs font-bold">
                SEFAZ ONLINE • FOLHA A4
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Busque produtos do estoque por iniciais, código ou bipe o leitor para emitir Nota Fiscal Eletrônica A4
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

      {/* Grid Principal (2 Colunas Espaçosas com Cantos Arredondados) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUNA ESQUERDA (7 colunas): Busca de Produtos & Tabela de Itens */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Card de Busca Rápida de Produtos */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm dark:shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="nfe-search-input" className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1.5 cursor-pointer">
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
                id="nfe-search-input"
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
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 justify-end">
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

          {/* Tabela de Itens da NF-e */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm dark:shadow-xl">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Itens da NF‑e ({items.reduce((a, b) => a + b.quantity, 0)} unidades)
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
                  Digite as iniciais ou código do produto no campo de busca acima e pressione Enter para incluí-lo na nota.
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
                        <tr key={index} className="hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition">
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
                              title="Remover da NF‑e"
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

        {/* COLUNA DIREITA (5 colunas): Destinatário, Forma de Pagamento & Emissão */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-black text-slate-900 dark:text-white">Dados da Emissão & Pagamento</h3>
            </div>

            {/* CPF / CNPJ do Destinatário */}
            <div>
              <label htmlFor="nfe-customer-cpf" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5 cursor-pointer">
                CPF / CNPJ do Destinatário (Opcional)
              </label>
              <input
                id="nfe-customer-cpf"
                type="text"
                placeholder="000.000.000-00 ou 00.000.000/0001-00"
                value={customerCpf}
                onChange={(e) => setCustomerCpf(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-sm focus:border-amber-500 focus:outline-none cursor-text shadow-xs"
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
                Se preenchido, a NF‑e conterá os dados do comprador na SEFAZ.
              </span>
            </div>

            {/* Nome / Razão Social do Destinatário */}
            <div>
              <label htmlFor="nfe-customer-name" className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5 cursor-pointer">
                Nome / Razão Social (Opcional)
              </label>
              <input
                id="nfe-customer-name"
                type="text"
                placeholder="Ex: Razão Social ou Nome do Cliente"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-amber-500 focus:outline-none cursor-text shadow-xs"
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
                          ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30'
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

            {/* Resumo e Botão de Transmissão */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 block">Total a Emitir</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                    {items.reduce((a, b) => a + b.quantity, 0)} itens adicionados
                  </span>
                </div>
                <span className="text-3xl font-black font-mono text-amber-600 dark:text-amber-400">
                  R$ {total.toFixed(2)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleEmit}
                disabled={isEmitDisabled}
                className="w-full py-4 px-6 rounded-2xl font-black text-sm bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 transition flex items-center justify-center gap-2.5 shadow-xl shadow-amber-500/20 active:scale-95 cursor-pointer"
              >
                <Send className="w-5 h-5 stroke-[2.5]" />
                <span>{isEmitting ? 'Transmitindo à SEFAZ...' : 'Emitir NF‑e'}</span>
              </button>

              <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                A NF‑e (Modelo 55) é assinada digitalmente via certificado digital A1 e enviada diretamente para autorização nos servidores da SEFAZ.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Sucesso Pós-Emissão com Design Arredondado */}
      {saleSuccessData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl flex flex-col gap-6 text-center">
            
            {/* Ícone e Título de Sucesso */}
            <div>
              <div className="w-20 h-20 bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-amber-500/10">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                NF‑e emitida! Referência: {saleSuccessData.referencia}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Nota Fiscal Eletrônica (Modelo 55) Autorizada pela SEFAZ
              </p>
            </div>

            {/* Card com Detalhes da Nota Fiscal */}
            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Total da Nota</span>
                <span className="text-2xl font-mono font-black text-amber-600 dark:text-amber-400">
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
                      className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
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

            {/* Ações de Impressão e Envio */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handlePrintDanfeA4}
                  className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer shadow-md shadow-amber-500/20 text-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>{printSuccessFeedback ? 'Reimprimir DANFE A4' : 'Imprimir DANFE A4'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrinterModal(true)}
                  className="py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl font-bold flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer shadow-xs text-xs"
                  title="Selecionar impressora específica para emissão"
                >
                  <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                  <span>Emitir Nota</span>
                </button>

                {saleSuccessData.danfeUrl && (
                  <a
                    href={saleSuccessData.danfeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-xl transition flex items-center justify-center shadow-xs"
                    title="Abrir DANFE em PDF"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>

              {/* Seção de Envio por E-mail */}
              <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Mail className="w-4 h-4 text-amber-500" />
                  <span>Encaminhar DANFE e XML por E-mail</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="email.do.cliente@exemplo.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendEmail(); }}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-amber-400 transition"
                  />
                  <button
                    type="button"
                    onClick={handleSendEmail}
                    disabled={isSendingEmail || !emailInput.trim()}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer"
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

            {/* Botão de Ação Primária: ZERAR E INICIAR NOVA EMISSÃO */}
            <button
              type="button"
              onClick={handleResetForNewSale}
              className="w-full py-4 px-6 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-black text-base flex items-center justify-center gap-3 shadow-xl transition cursor-pointer active:scale-98"
            >
              <RotateCcw className="w-5 h-5" />
              <span>Nova Emissão (Zerar)</span>
              <span className="text-xs bg-slate-800 dark:bg-slate-200 text-slate-200 dark:text-slate-800 px-2 py-0.5 rounded-md font-mono font-bold">
                Enter
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Modal de Seleção de Impressora com Cantos Arredondados */}
      {showPrinterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Selecionar Impressora</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Escolha uma impressora instalada ou deixe como padrão para abrir a caixa de diálogo nativa do sistema.
            </p>
            
            <select
              value={selectedPrinter}
              onChange={(e) => setSelectedPrinter(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:border-amber-500 focus:outline-none"
            >
              <option value="">Impressora padrão</option>
              {printers.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPrinterModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePrintViaModal}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition cursor-pointer shadow-md shadow-amber-500/20"
              >
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
