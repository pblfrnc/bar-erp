import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search, Barcode, Trash2 } from 'lucide-react';
import { api } from '../services/api';

interface EmitNfeViewProps {
  onBack: () => void;
}

export const EmitNfeView: React.FC<EmitNfeViewProps> = ({ onBack }) => {
  const [items, setItems] = useState<any[]>([]);
  const [customerCpf, setCustomerCpf] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('money');
  const [total, setTotal] = useState(0);
  const [isEmitting, setIsEmitting] = useState(false);
  const [saleSuccessData, setSaleSuccessData] = useState<any>(null);
  // Printer selection UI state
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [printers, setPrinters] = useState<string[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdownResults, setShowDropdownResults] = useState(false);
  const [filteredSearch, setFilteredSearch] = useState<any[]>([]);

  // Simplified product search placeholder
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredSearch.length > 0) {
      handleAddProduct(filteredSearch[0]);
    }
  };

  const handleAddProduct = (product: any) => {
    setItems((prev) => [...prev, { product, quantity: 1 }]);
    setSearchTerm('');
    setShowDropdownResults(false);
  };

  const handleReset = () => {
    setItems([]);
    setCustomerCpf('');
    setCustomerName('');
    setPaymentMethod('money');
    setSaleSuccessData(null);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement;
      const isTyping = activeEl && activeEl.tagName === 'INPUT';
      if (e.key === 'Escape' || (e.key === 'Enter' && !isTyping)) {
        e.preventDefault();
        handleReset();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const calculateTotal = () => {
    const sum = items.reduce((acc, i) => acc + i.product.price * i.quantity, 0);
    setTotal(parseFloat(sum.toFixed(2)));
  };

  useEffect(() => {
    calculateTotal();
  }, [items]);

  const handleEmit = async () => {
    if (items.length === 0) {
      alert('Adicione pelo menos um produto à nota fiscal.');
      return;
    }
    setIsEmitting(true);
    try {
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
          cest: i.product.cest,
        })),
      };
      const res = await fetch(api.getApiUrl() + '/fiscal/emit-nfe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao transmitir à SEFAZ');
      const danfeUrl = data.caminhoDanfe || data.pdfUrl;
      const refNota = data.referencia || data.ref;
      const chaveNota = data.chaveAcesso || data.chave;
      setSaleSuccessData({ danfeUrl, referencia: refNota, total, chaveAcesso: chaveNota, paymentMethod });
    } catch (err: any) {
      alert(err.message || 'Erro ao emitir NF‑e');
    } finally {
      setIsEmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl w-full mx-auto pb-24 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-sm dark:shadow-xl">
        <button type="button" onClick={onBack} className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-2xl transition border border-slate-200 dark:border-slate-700/60 active:scale-95" title="Voltar ao Painel Fiscal">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Emissão de NF‑e</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Emita notas fiscais eletrônicas via Focus NFe.</p>
        </div>
        {items.length > 0 && (
          <button type="button" onClick={() => setItems([])} className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5">
            <Trash2 className="w-4 h-4" />
            <span>Limpar Itens</span>
          </button>
        )}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: product search */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm dark:shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="nfe-search-input" className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1.5 cursor-pointer">
                <Search className="w-4 h-4 text-amber-500" />
                <span>Busca rápida de produtos (inicial, código ou barcode)</span>
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
                placeholder="Digite iniciais ou código..."
                className="w-full pl-11 pr-24 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white text-sm focus:border-amber-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
              />
              {searchTerm && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {filteredSearch.length} {filteredSearch.length === 1 ? 'item' : 'itens'}
                  </span>
                  <button type="button" onClick={() => { setSearchTerm(''); setShowDropdownResults(false); }} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg">
                    ×
                  </button>
                </div>
              )}
              {showDropdownResults && searchTerm.trim() !== '' && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-30 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSearch.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">Nenhum produto encontrado.</div>
                  ) : (
                    filteredSearch.slice(0, 10).map((p) => (
                      <div key={p.id} onClick={() => handleAddProduct(p)} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{p.name}</span>
                            {p.code && (<span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">#{p.code}</span>)}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {p.brand && <span>{p.brand}</span>}
                            {p.ncm && <span className="font-mono text-cyan-600 dark:text-cyan-400">NCM: {p.ncm}</span>}
                            {p.cfop && <span className="font-mono text-slate-400 dark:text-slate-500">CFOP: {p.cfop}</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black font-mono text-amber-600 dark:text-amber-400">R$ {p.price.toFixed(2)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Right: summary and actions */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm dark:shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Itens ({items.length})</h3>
            {items.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Nenhum item adicionado.</p>
            ) : (
              <ul className="space-y-2">
                {items.map((i, idx) => (
                  <li key={idx} className="flex justify-between text-sm">
                    <span>{i.product.name} x {i.quantity}</span>
                    <span>R$ {(i.product.price * i.quantity).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 text-right font-bold text-lg">Total: R$ {total.toFixed(2)}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm dark:shadow-xl flex flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="nfe-cpf">CPF/CNPJ (opcional)</label>
            <input id="nfe-cpf" type="text" value={customerCpf} onChange={(e) => setCustomerCpf(e.target.value)} className="w-full p-2 border rounded" placeholder="Apenas números" />
            <label className="text-sm font-medium" htmlFor="nfe-name">Nome (opcional)</label>
            <input id="nfe-name" type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full p-2 border rounded" placeholder="Nome do cliente" />
            <label className="text-sm font-medium" htmlFor="nfe-payment">Forma de pagamento</label>
            <select id="nfe-payment" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full p-2 border rounded">
              <option value="money">Dinheiro</option>
              <option value="card">Cartão</option>
              <option value="pix">PIX</option>
            </select>
          </div>
          <button onClick={handleEmit} disabled={isEmitting} className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded disabled:opacity-50">
            {isEmitting ? 'Emitindo...' : 'Emitir NF‑e'}
          </button>
          {saleSuccessData && (
            <div className="bg-green-100 dark:bg-green-900 p-4 rounded">
              <p className="font-bold">NF‑e emitida! Referência: {saleSuccessData.referencia}</p>
              {saleSuccessData.danfeUrl && (
                <a href={saleSuccessData.danfeUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Abrir DANFE</a>
              )}
              <button onClick={() => setShowPrinterModal(true)} className="mt-2 w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded">
                Emitir Nota
              </button>
              {showPrinterModal && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                  <div className="bg-white dark:bg-slate-800 p-6 rounded shadow-lg w-full max-w-md">
                    <h3 className="text-lg font-semibold mb-4">Selecionar Impressora</h3>
                    <select value={selectedPrinter} onChange={(e) => setSelectedPrinter(e.target.value)} className="w-full mb-4 p-2 border rounded">
                      <option value="">Impressora padrão</option>
                      {printers.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <div className="flex justify-end space-x-2">
                      <button onClick={() => setShowPrinterModal(false)} className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded">Cancelar</button>
                      <button
                        onClick={() => {
                          if (saleSuccessData?.danfeUrl) {
                            if (selectedPrinter) {
                              // Use electron API to print to selected printer if available
                              const printFn = (window as any).electronAPI?.printPdf;
                              if (printFn) {
                                printFn(saleSuccessData.danfeUrl, selectedPrinter);
                              } else {
                                // Fallback: open URL
                                window.open(saleSuccessData.danfeUrl, '_blank');
                              }
                            } else {
                              // Abre o diálogo nativo do sistema operacional para selecionar impressora A4
                              if ((window as any).electronAPI?.printPdfDialog) {
                                (window as any).electronAPI.printPdfDialog(saleSuccessData.danfeUrl);
                              } else {
                                window.open(saleSuccessData.danfeUrl, '_blank');
                              }
                            }
                          }
                          setShowPrinterModal(false);
                        }}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded"
                      >
                        Imprimir
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
