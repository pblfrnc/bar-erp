import React, { useState, useEffect, useRef } from 'react';
import { FileCode2, Upload, AlertCircle, CheckCircle2, PackagePlus, ArrowRight, ArrowLeft, Loader, Scan, Check } from 'lucide-react';
import { api } from '../services/api';
import { Product, Category } from '../types';

interface XmlItem {
  id: string;
  code: string;
  name: string;
  quantity: number;
  unitCost: number;
  ncm: string;
  cfop: string;
  unit: string;
}

interface MatchState {
  xmlItem: XmlItem;
  action: 'LINK' | 'NEW' | 'IGNORE';
  productId?: string;
  categoryId?: string;
}

interface FiscalImportViewProps {
  onBack: () => void;
  chaveAcesso?: string; // Se fornecida via props, puxa o XML da SEFAZ automaticamente
}

export const FiscalImportView: React.FC<FiscalImportViewProps> = ({ onBack, chaveAcesso }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [xmlData, setXmlData] = useState<any>(null);
  const [matches, setMatches] = useState<MatchState[]>([]);

  // 2º Bip: chave bipada no início ou dentro da conferência
  const [bipChaveInput, setBipChaveInput] = useState('');
  const [isSearchingBip, setIsSearchingBip] = useState(false);
  const [bipError, setBipError] = useState<string | null>(null);

  // Confirmação de 2º bip dentro da tela de itens
  const [confirmChave, setConfirmChave] = useState('');
  const [confirmStatus, setConfirmStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const confirmInputRef = useRef<HTMLInputElement>(null);
  const startBipInputRef = useRef<HTMLInputElement>(null);

  const [autoLoading, setAutoLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getProducts().then(setProducts).catch(() => {});
    api.getCategories().then(setCategories).catch(() => {});
    setTimeout(() => startBipInputRef.current?.focus(), 150);
  }, []);

  const buildInitialMatches = (items: XmlItem[], prods: Product[], cats: Category[]): MatchState[] => {
    return items.map((item: XmlItem) => {
      const exactMatch = prods.find(p => p.name.toLowerCase().trim() === item.name.toLowerCase().trim());
      return {
        xmlItem: item,
        action: exactMatch ? 'LINK' : 'NEW',
        productId: exactMatch?.id,
        categoryId: cats.length > 0 ? cats[0].id : undefined
      };
    });
  };

  // Carregar XML automaticamente se vier chaveAcesso via props
  useEffect(() => {
    if (!chaveAcesso) return;
    loadXmlByChave(chaveAcesso);
  }, [chaveAcesso]);

  const loadXmlByChave = async (chave: string) => {
    const cleanKey = chave.replace(/\D/g, '');
    if (cleanKey.length !== 44) {
      alert('Chave de acesso deve conter 44 dígitos.');
      return;
    }

    setAutoLoading(true);
    setBipError(null);
    try {
      // 1. Tenta endpoint direto de parsed XML
      const res = await fetch(`${api.getApiUrl()}/fiscal/parsed-by-chave/${cleanKey}`);
      if (res.ok) {
        const data = await res.json();
        setXmlData(data);
        setMatches(buildInitialMatches(data.items, products, categories));
        setConfirmChave(cleanKey);
        setConfirmStatus('ok');
        return;
      }

      // 2. Fallback: baixar XML raw e processar
      const rawRes = await fetch(`${api.getApiUrl()}/fiscal/notas-recebidas/${cleanKey}/xml`);
      if (!rawRes.ok) {
        const errData = await rawRes.json().catch(() => ({}));
        throw new Error(errData.error || 'XML não disponível na SEFAZ ainda. Aguarde alguns instantes e tente novamente.');
      }

      const xmlText = await rawRes.text();
      const blob = new Blob([xmlText], { type: 'application/xml' });
      const xmlFile = new File([blob], `nfe_${cleanKey}.xml`, { type: 'application/xml' });
      const formData = new FormData();
      formData.append('xml', xmlFile);

      const parseRes = await fetch(`${api.getApiUrl()}/fiscal/import-xml`, { method: 'POST', body: formData });
      const parsedData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parsedData.error || 'Erro ao processar XML.');

      setXmlData(parsedData);
      setMatches(buildInitialMatches(parsedData.items, products, categories));
      setConfirmChave(cleanKey);
      setConfirmStatus('ok');
    } catch (err: any) {
      setBipError(err.message || 'Erro ao carregar nota.');
    } finally {
      setAutoLoading(false);
      setIsSearchingBip(false);
    }
  };

  const handleSecondBipScan = (value: string) => {
    setBipChaveInput(value);
    const clean = value.replace(/\D/g, '');
    if (clean.length === 44) {
      executeBipSearch(clean);
    }
  };

  const executeBipSearch = (chaveToSearch: string) => {
    const clean = chaveToSearch.replace(/\D/g, '');
    if (clean.length !== 44) {
      setBipError('A chave bipada deve ter 44 dígitos numéricos.');
      return;
    }
    setIsSearchingBip(true);
    loadXmlByChave(clean);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('xml', file);
      const res = await api.uploadXml(formData);
      if (res.error) {
        alert(res.error);
        return;
      }
      setXmlData(res);
      setMatches(buildInitialMatches(res.items, products, categories));
      // Se não veio de bip, pede para bipar no segundo bip ou aceita
      setConfirmStatus('idle');
    } catch (err: any) {
      alert("Erro ao ler XML: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const updateMatch = (index: number, changes: Partial<MatchState>) => {
    setMatches(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...changes };
      return copy;
    });
  };

  const handleConfirmBip = (value: string) => {
    const typed = value.replace(/\D/g, '');
    setConfirmChave(value);
    if (typed.length < 44) {
      setConfirmStatus('idle');
      return;
    }
    const chaveNota = (chaveAcesso || xmlData?.accessKey || xmlData?.chaveAcesso || '').replace(/\D/g, '');
    if (!chaveNota) {
      setConfirmStatus('ok');
      return;
    }
    if (typed === chaveNota) {
      setConfirmStatus('ok');
    } else {
      setConfirmStatus('error');
    }
  };

  const handleApply = async () => {
    const validMatches = matches.filter(m => m.action !== 'IGNORE');
    if (validMatches.length === 0) {
      alert("Nenhum item selecionado para importação.");
      return;
    }

    for (const m of validMatches) {
      if (m.action === 'NEW' && !m.categoryId) {
        alert("Selecione uma categoria para os novos produtos.");
        return;
      }
      if (m.action === 'LINK' && !m.productId) {
        alert("Selecione qual produto existente deseja vincular.");
        return;
      }
    }

    try {
      setIsUploading(true);
      const keyToSend = (confirmChave || chaveAcesso || xmlData?.accessKey || '').replace(/\D/g, '');
      const res = await api.applyXmlImport({
        items: validMatches,
        chaveAcesso: keyToSend || undefined
      });

      if (res.error) {
        throw new Error(res.error);
      }

      alert(`✅ Entrada no Estoque Confirmada com Sucesso!\n\n• Produtos atualizados: ${res.results?.updated ?? 0}\n• Novos produtos cadastrados: ${res.results?.created ?? 0}`);
      onBack();
    } catch (err: any) {
      alert("Erro ao efetivar entrada: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (xmlData && confirmInputRef.current) {
      setTimeout(() => confirmInputRef.current?.focus(), 200);
    }
  }, [xmlData]);

  if (autoLoading || isSearchingBip) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[360px] gap-4 text-slate-400">
        <Loader className="w-10 h-10 animate-spin text-amber-500" />
        <p className="font-bold text-white text-lg">Buscando e Processando XML da SEFAZ...</p>
        <p className="text-sm max-w-sm text-center">Aguarde enquanto extraímos os produtos e quantidades para conferência física.</p>
      </div>
    );
  }

  // TELA INICIAL: Escolha entre 2º Bip ou Arquivo XML
  if (!xmlData) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto pt-4 pb-20">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Painel Fiscal
        </button>

        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Importação de NF-e e Entrada no Estoque</h2>
          <p className="text-sm text-slate-400 mt-1">
            Realize o <strong>2º Bip (Conferência Física)</strong> para puxar os produtos da nota e dar entrada definitiva no estoque.
          </p>
        </div>

        {/* 1. SEÇÃO DE 2º BIP DIRETO (SCANNER) */}
        <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 relative overflow-hidden shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-black">
              2º
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                2º Bip — Conferência Física da Nota (DANFE)
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-500/30">Recomendado</span>
              </h3>
              <p className="text-xs text-slate-400">
                Bipe o código de barras da DANFE impressa que chegou com a mercadoria física para abrir a conferência.
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <input
                ref={startBipInputRef}
                type="text"
                value={bipChaveInput}
                onChange={e => handleSecondBipScan(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') executeBipSearch(bipChaveInput); }}
                placeholder="Bipe a chave de 44 dígitos da nota com o leitor..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm font-mono text-white focus:border-amber-500 outline-none transition"
              />
              <Scan className="w-5 h-5 text-amber-500 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
            <button
              onClick={() => executeBipSearch(bipChaveInput)}
              disabled={bipChaveInput.replace(/\D/g, '').length < 44}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-xl transition flex items-center gap-2 disabled:opacity-40 whitespace-nowrap"
            >
              <Scan className="w-4 h-4" />
              Conferir Nota
            </button>
          </div>

          {bipError && (
            <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{bipError}</span>
            </div>
          )}

          <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-pulse" />
            <span>O leitor USB preenche automaticamente e já pressiona Enter.</span>
          </div>
        </div>

        <div className="flex items-center gap-4 my-2">
          <div className="h-px bg-slate-800 flex-1" />
          <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">OU por arquivo</span>
          <div className="h-px bg-slate-800 flex-1" />
        </div>

        {/* 2. SEÇÃO DE UPLOAD MANUAL DE ARQUIVO XML */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mx-auto">
            <FileCode2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Carregar Arquivo .XML do Fornecedor</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Caso tenha recebido o arquivo .xml por e-mail ou pendrive, selecione-o abaixo para conferir os itens.
            </p>
          </div>

          <div>
            <input 
              type="file" 
              accept=".xml" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileChange}
            />
            
            {!file ? (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="mx-auto w-full max-w-xs py-3 px-6 rounded-2xl border-2 border-dashed border-slate-700 hover:border-emerald-500 bg-slate-950 text-slate-400 hover:text-emerald-400 transition flex flex-col items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-5 h-5" />
                <span className="font-bold text-xs">Selecionar Arquivo .XML</span>
              </button>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 font-mono text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {file.name}
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => setFile(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-white hover:bg-slate-700 transition"
                  >
                    Trocar
                  </button>
                  <button 
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition disabled:opacity-50"
                  >
                    {isUploading ? 'Lendo...' : 'Ler Arquivo XML'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // TELA DE CONFERÊNCIA DOS ITENS (XML CARREGADO)
  return (
    <div className="space-y-4 max-w-4xl mx-auto pt-4 pb-20">
      <div className="flex items-center justify-between">
        <button onClick={() => setXmlData(null)} className="flex items-center gap-2 text-slate-400 hover:text-white transition">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <button 
          onClick={handleApply}
          disabled={isUploading || confirmStatus !== 'ok'}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2.5 rounded-xl font-bold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
          title={confirmStatus !== 'ok' ? 'Confirme a conferência física com o 2º bip antes de dar entrada no estoque' : ''}
        >
          <PackagePlus className="w-5 h-5" />
          {isUploading ? 'Efetivando Entrada...' : 'Confirmar Conferência & Dar Entrada no Estoque'}
        </button>
      </div>

      {/* Cabeçalho da Nota & Confirmação de 2º Bip */}
      <div className={`border rounded-3xl p-5 transition ${
        confirmStatus === 'ok'
          ? 'bg-emerald-500/10 border-emerald-500/40'
          : confirmStatus === 'error'
          ? 'bg-red-500/10 border-red-500/40'
          : 'bg-slate-900 border-slate-800'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              Conferência de Entrada (2º Bip)
            </span>
            <h3 className="text-lg font-bold text-white mt-1 truncate">
              {xmlData.vendor?.name || 'Fornecedor Identificado'}
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              CNPJ: {xmlData.vendor?.cnpj || 'N/A'} {xmlData.numero ? `• NF: ${xmlData.numero}/${xmlData.serie || '1'}` : ''}
            </p>
          </div>

          {/* STATUS DO 2º BIP */}
          <div className="flex flex-col gap-1 sm:w-80">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Scan className="w-3.5 h-3.5 text-amber-400" />
              2º Bip: Confirmação da Nota Impressa
            </label>
            <div className="relative">
              <input
                ref={confirmInputRef}
                type="text"
                value={confirmChave}
                onChange={e => handleConfirmBip(e.target.value)}
                placeholder="Bipe a DANFE impressa (44 dígitos)..."
                className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-white font-mono text-xs outline-none transition pr-9 ${
                  confirmStatus === 'ok'
                    ? 'border-emerald-500 focus:border-emerald-400'
                    : confirmStatus === 'error'
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-amber-500/60 focus:border-amber-400'
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {confirmStatus === 'ok' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {confirmStatus === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                {confirmStatus === 'idle' && <Scan className="w-4 h-4 text-slate-500" />}
              </div>
            </div>
            {confirmStatus === 'error' && (
              <p className="text-xs text-red-400 font-bold">⚠️ Chave divergente! Esta não é a nota física correspondente.</p>
            )}
            {confirmStatus === 'ok' && (
              <p className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> 2º Bip Confirmado: liberado para dar entrada no estoque.
              </p>
            )}
            {confirmStatus === 'idle' && (
              <p className="text-[11px] text-amber-400/90 font-medium">Bipe a DANFE física para garantir que os itens recebidos batem com a nota.</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabela de Itens para Conferência */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-black uppercase text-white tracking-wider">
            Itens da Nota ({matches.length}) — Associe ou Cadastre
          </h4>
          <span className="text-xs text-slate-400">
            Ajuste os vínculos antes de aplicar
          </span>
        </div>

        <div className="space-y-3">
          {matches.map((match, i) => (
            <div key={match.xmlItem.id} className="bg-slate-950 border border-slate-800/90 rounded-2xl p-4 flex flex-col lg:flex-row gap-4 items-start lg:items-center">
              
              {/* Info do XML */}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">
                  Item #{i + 1} • {match.xmlItem.code ? `Cód: ${match.xmlItem.code}` : ''}
                </div>
                <div className="text-sm font-bold text-white truncate" title={match.xmlItem.name}>
                  {match.xmlItem.name}
                </div>
                <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-3">
                  <span>Qtd: <strong className="text-slate-200">{match.xmlItem.quantity} {match.xmlItem.unit}</strong></span>
                  <span>Custo Unit.: <strong className="text-slate-200">R$ {match.xmlItem.unitCost.toFixed(2)}</strong></span>
                  <span>Total: <strong className="text-emerald-400">R$ {(match.xmlItem.quantity * match.xmlItem.unitCost).toFixed(2)}</strong></span>
                </div>
              </div>

              <ArrowRight className="hidden lg:block w-5 h-5 text-slate-700 shrink-0" />

              {/* Ação no Sistema */}
              <div className="flex-1 w-full bg-slate-900/90 rounded-xl p-3 border border-slate-800">
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => updateMatch(i, { action: 'LINK' })}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                      match.action === 'LINK'
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Vincular Existente
                  </button>
                  <button
                    onClick={() => updateMatch(i, { action: 'NEW' })}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                      match.action === 'NEW'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Criar Novo
                  </button>
                  <button
                    onClick={() => updateMatch(i, { action: 'IGNORE' })}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                      match.action === 'IGNORE'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Ignorar
                  </button>
                </div>

                {match.action === 'LINK' && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Produto no Sistema (Estoque será somado):
                    </label>
                    <select
                      value={match.productId || ''}
                      onChange={(e) => updateMatch(i, { productId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-lg p-2.5 focus:border-indigo-500 outline-none"
                    >
                      <option value="">-- Selecione o Produto Existente --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Estoque atual: {p.stock})</option>
                      ))}
                    </select>
                  </div>
                )}

                {match.action === 'NEW' && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Categoria do Novo Produto:
                    </label>
                    <select
                      value={match.categoryId || ''}
                      onChange={(e) => updateMatch(i, { categoryId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-lg p-2.5 focus:border-amber-500 outline-none"
                    >
                      <option value="">-- Selecione a Categoria --</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {match.action === 'IGNORE' && (
                  <div className="text-xs text-slate-500 text-center py-2 italic">
                    Este item não entrará no estoque e não alterará preços.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Botão de Finalização no rodapé */}
        <div className="pt-6 mt-6 border-t border-slate-800 flex justify-end">
          <button 
            onClick={handleApply}
            disabled={isUploading || confirmStatus !== 'ok'}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-6 py-3 rounded-xl font-black text-sm transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xl shadow-emerald-500/20"
          >
            <PackagePlus className="w-5 h-5" />
            {isUploading ? 'Efetivando Entrada...' : 'Confirmar Conferência & Dar Entrada no Estoque'}
          </button>
        </div>
      </div>
    </div>
  );
};
