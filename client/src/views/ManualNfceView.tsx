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
  Banknote
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

  const handleEmit = async () => {
    if (items.length === 0) {
      alert('Adicione pelo menos um produto à nota fiscal.');
      return;
    }
    setIsEmitting(true);
    try {
      const payload = {
        customerCpf: customerCpf.replace(/\D/g, '') || undefined,
        customerName: customerName.trim() || undefined,
        paymentMethod,
        items: items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          price: i.product.price,
          name: i.product.name,
          ncm: i.product.ncm || '22030000',
          cfop: i.product.cfop || '5102',
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
      setResultDanfe(data.caminhoDanfe);

      // Disparo automático e silencioso da impressão na impressora térmica (Sem tela do Windows)
      if (data.caminhoDanfe) {
        if ((window as any).electronAPI?.printPdfSilent) {
          (window as any).electronAPI.printPdfSilent(data.caminhoDanfe);
        } else {
          // Fallback para navegador web
          try {
            const printFrame = document.createElement('iframe');
            printFrame.style.position = 'fixed';
            printFrame.style.right = '0';
            printFrame.style.bottom = '0';
            printFrame.style.width = '0';
            printFrame.style.height = '0';
            printFrame.style.border = '0';
            printFrame.src = data.caminhoDanfe;
            document.body.appendChild(printFrame);
            printFrame.onload = () => {
              setTimeout(() => {
                try {
                  printFrame.contentWindow?.focus();
                  printFrame.contentWindow?.print();
                } catch {}
              }, 600);
            };
          } catch {}
        }
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao emitir NFC-e');
    } finally {
      setIsEmitting(false);
    }
  };

  if (resultDanfe) {
    return (
      <div className="space-y-6 max-w-2xl w-full mx-auto pt-10 pb-20 text-center animate-in fade-in duration-200">
        <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/10">
          <CheckCircle className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white">NFC-e Autorizada com Sucesso!</h2>
          <p className="text-sm text-slate-400 mt-1">
            O cupom fiscal eletrônico foi transmitido e validado pela SEFAZ.
          </p>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between text-left">
          <div>
            <span className="text-xs font-bold uppercase text-slate-400 block">Total Transmitido</span>
            <span className="text-xl font-mono font-black text-emerald-400">R$ {total.toFixed(2)}</span>
          </div>
          <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs rounded-full">
            STATUS: AUTORIZADA
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <a
            href={resultDanfe}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition"
          >
            <Download className="w-5 h-5" />
            <span>Imprimir / Baixar DANFE</span>
          </a>
          <button
            onClick={() => {
              setItems([]);
              setResultDanfe(null);
              setSearchTerm('');
              setCustomerCpf('');
            }}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold bg-slate-800 text-white hover:bg-slate-700 transition"
          >
            Nova Emissão Manual
          </button>
          <button
            onClick={onBack}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold bg-slate-900 border border-slate-700 text-slate-300 hover:text-white transition"
          >
            Voltar ao Painel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl w-full mx-auto pb-24 animate-in fade-in duration-200">
      {/* Cabeçalho de Navegação */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl transition border border-slate-700/60 active:scale-95 group cursor-pointer"
            title="Voltar ao Painel Fiscal"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-white">Emissor Fiscal de NFC-e (Tela Cheia)</h2>
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-bold">
                SEFAZ ONLINE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Busque produtos por iniciais ou bipe código de barras com adição automática ao teclar Enter
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setItems([])}
              className="py-2.5 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="nfce-search-input" className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5 cursor-pointer">
                <Search className="w-4 h-4 text-amber-400" />
                <span>Busca Rápida de Produtos (Iniciais, Código ou Barcode)</span>
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                Pressione <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">Enter</kbd> para adicionar
              </span>
            </div>

            <div className="relative">
              <Barcode className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                className="w-full pl-11 pr-24 py-3.5 bg-slate-950 border border-slate-700 rounded-2xl text-white text-sm focus:border-amber-500 focus:outline-none placeholder:text-slate-600 font-medium cursor-text"
              />

              {searchTerm && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-slate-800 text-slate-300">
                    {filteredSearch.length} {filteredSearch.length === 1 ? 'item' : 'itens'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setShowDropdownResults(false);
                    }}
                    className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Lista Flutuante de Resultados da Busca */}
              {showDropdownResults && searchTerm.trim() !== '' && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-30 max-h-72 overflow-y-auto divide-y divide-slate-800">
                  {filteredSearch.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Nenhum produto encontrado com "{searchTerm}".
                    </div>
                  ) : (
                    filteredSearch.slice(0, 10).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleAddProduct(p)}
                        className="p-3 hover:bg-slate-800/80 cursor-pointer flex items-center justify-between gap-3 transition group"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-bold text-white group-hover:text-amber-400 flex items-center gap-2">
                            <span>{p.name}</span>
                            {p.code && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                                #{p.code}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            {p.brand && <span>{p.brand}</span>}
                            {p.ncm && <span className="font-mono text-cyan-400">NCM: {p.ncm}</span>}
                            {p.cfop && <span className="font-mono text-slate-500">CFOP: {p.cfop}</span>}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-black font-mono text-amber-400">
                            R$ {p.price.toFixed(2)}
                          </div>
                          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 justify-end">
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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-black text-white">
                  Itens a Serem Emitidos ({items.reduce((a, b) => a + b.quantity, 0)} unidades)
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {items.length} {items.length === 1 ? 'produto único' : 'produtos'}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-30 text-slate-400" />
                <p className="text-sm font-bold text-slate-400">Nenhum produto adicionado ainda</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Digite as iniciais do produto no campo de busca acima e pressione Enter para incluí-lo automaticamente.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 uppercase text-[10px] tracking-wider text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Produto & Dados Fiscais</th>
                      <th className="py-3 px-4 text-center">Qtd</th>
                      <th className="py-3 px-4 text-right">Unitário</th>
                      <th className="py-3 px-4 text-right">Subtotal</th>
                      <th className="py-3 px-4 text-center">Remover</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {items.map((item, index) => {
                      const itemSubtotal = item.product.price * item.quantity;
                      return (
                        <tr key={index} className="hover:bg-slate-850/50 transition">
                          <td className="py-3 px-4">
                            <div className="font-bold text-white text-sm">
                              {item.product.name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[10px] text-slate-400 font-mono">
                              {item.product.code && (
                                <span className="text-slate-500">#{item.product.code}</span>
                              )}
                              <span className="text-cyan-400 bg-cyan-950/40 px-1 rounded border border-cyan-900/40">
                                NCM: {item.product.ncm || '22030000'}
                              </span>
                              <span className="text-slate-400 bg-slate-950 px-1 rounded">
                                CFOP: {item.product.cfop || '5102'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => updateQuantity(index, item.quantity - 1)}
                                className="px-2.5 py-1 text-slate-300 hover:bg-slate-800 font-bold text-xs transition cursor-pointer"
                              >
                                -
                              </button>
                              <span className="px-3 font-mono font-bold text-white text-xs">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(index, item.quantity + 1)}
                                className="px-2.5 py-1 text-slate-300 hover:bg-slate-800 font-bold text-xs transition cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right font-mono text-slate-400">
                            R$ {item.product.price.toFixed(2)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-amber-400 text-sm">
                            R$ {itemSubtotal.toFixed(2)}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-black text-white">Dados da Emissão & Pagamento</h3>
            </div>

            {/* CPF / CNPJ */}
            <div>
              <label htmlFor="nfce-customer-cpf" className="block text-xs font-bold uppercase text-slate-400 mb-1.5 cursor-pointer">
                CPF / CNPJ na Nota (Opcional)
              </label>
              <input
                id="nfce-customer-cpf"
                type="text"
                placeholder="000.000.000-00 (ou deixar em branco)"
                value={customerCpf}
                onChange={(e) => setCustomerCpf(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm focus:border-emerald-500 focus:outline-none cursor-text"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Se informado, o cupom fiscal constará o documento do comprador.
              </span>
            </div>

            {/* Nome do Cliente */}
            <div>
              <label htmlFor="nfce-customer-name" className="block text-xs font-bold uppercase text-slate-400 mb-1.5 cursor-pointer">
                Nome do Consumidor (Opcional)
              </label>
              <input
                id="nfce-customer-name"
                type="text"
                placeholder="Ex: João da Silva"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none cursor-text"
              />
            </div>

            {/* Forma de Pagamento SEFAZ */}
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
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
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                        isSel
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/30'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
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
            <div className="pt-4 border-t border-slate-800 space-y-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase text-slate-400 block">Total a Emitir</span>
                  <span className="text-xs text-slate-500 font-mono">
                    {items.reduce((a, b) => a + b.quantity, 0)} itens adicionados
                  </span>
                </div>
                <span className="text-3xl font-black font-mono text-emerald-400">
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
    </div>
  );
};
