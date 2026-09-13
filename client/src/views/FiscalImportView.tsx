import React, { useState, useEffect, useRef } from 'react';
import { 
  FileCode2, 
  Upload, 
  AlertCircle, 
  CheckCircle2, 
  PackagePlus, 
  ArrowRight, 
  ArrowLeft, 
  Loader, 
  Scan, 
  Check, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Percent, 
  AlertTriangle,
  Scissors,
  Scale,
  Layers
} from 'lucide-react';
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
  // Precificação inteligente
  newSalePrice?: number;
  targetMargin?: number;
  updateBoxPrice?: boolean;
  newBoxPrice?: number;
  // Fator de Conversão / Embalagem / Rendimento
  conversionFactor?: number;
  isConversionActive?: boolean;
  conversionMode?: 'box' | 'portion';
}

function detectConversionSuggestion(name: string, unit?: string): { factor: number; mode: 'box' | 'portion'; detected: boolean; label?: string } {
  const text = (name || '').toLowerCase();
  const u = (unit || '').toLowerCase();

  // 1. Cigarros (10 maços por pacote/box)
  if (
    /\b(?:10x20|box\s*10|10\s*mac|10\s*pct|10\s*cart)\b/i.test(text) ||
    (/\b(?:cigarro|marlboro|malboro|rothmans|derby|hollywood|lucky\s*strike|camel|dunhill|winston|chesterfield|kent|parliament|san\s*marino|plaza|calton)\b/i.test(text) && /\b10\b/.test(text))
  ) {
    return { factor: 10, mode: 'box', detected: true, label: 'Pacote com 10 Maços de Cigarro' };
  }

  // 2. Caixas com quantidade explícita (ex: CX12, C/12, CX 12, 12UN)
  const cx12Match = text.match(/\b(?:cx|c\/|caixa)\s*12\b|\b12\s*(?:un|latas|lts|garrafas|gfs)\b/i);
  if (cx12Match) {
    return { factor: 12, mode: 'box', detected: true, label: 'Caixa com 12 unidades' };
  }

  const cx24Match = text.match(/\b(?:cx|c\/|fd|fardo|caixa)\s*24\b|\b24\s*(?:un|latas|lts|garrafas|gfs)\b/i);
  if (cx24Match) {
    return { factor: 24, mode: 'box', detected: true, label: 'Caixa/Fardo com 24 unidades' };
  }

  const cx6Match = text.match(/\b(?:pack|pct|cx|c\/)\s*6\b|\b6\s*(?:un|latas|lts|garrafas|gfs)\b/i);
  if (cx6Match) {
    return { factor: 6, mode: 'box', detected: true, label: 'Pack com 6 unidades' };
  }

  // Genérico: cx 15, cx 20, cx 8, etc.
  const genericCx = text.match(/\b(?:cx|c\/|caixa|fd|fardo|pack)\s*(\d{1,3})\b/i);
  if (genericCx && parseInt(genericCx[1], 10) > 1) {
    const num = parseInt(genericCx[1], 10);
    return { factor: num, mode: 'box', detected: true, label: `Embalagem com ${num} unidades` };
  }

  // 3. Peso em KG (ex: 5kg, 2kg, 2.5kg) -> batata, carne, queijo (sugere rendimento em porções)
  const kgMatch = text.match(/\b(\d+(?:[.,]\d+)?)\s*(?:kg|quilo|quilos)\b/i) || (u === 'kg' ? [null, 'kg'] : null);
  if (kgMatch) {
    const weightStr = kgMatch[1];
    const weightNum = weightStr ? parseFloat(weightStr.replace(',', '.')) : 1;
    // 5kg -> 12 porções de ~400g
    const portions = weightNum >= 4 ? 12 : (weightNum >= 2 ? 6 : 4);
    return {
      factor: portions,
      mode: 'portion',
      detected: true,
      label: weightStr ? `Item em peso (${weightStr}kg) -> Rendimento em Porções` : 'Item em peso -> Rendimento em Porções'
    };
  }

  return { factor: 1, mode: 'box', detected: false };
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
  const [defaultMargin, setDefaultMargin] = useState<number>(50.0);
  const [showPriceDropModal, setShowPriceDropModal] = useState<boolean>(false);
  const [pendingApplyAction, setPendingApplyAction] = useState<boolean>(false);

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
    api.getSystemSettings().then(st => {
      if (st?.defaultProfitMargin && st.defaultProfitMargin > 0) {
        setDefaultMargin(st.defaultProfitMargin);
      }
    }).catch(() => {});
    setTimeout(() => startBipInputRef.current?.focus(), 150);
  }, []);

  const calculateSalePriceFromMargin = (cost: number, margin: number): number => {
    if (cost <= 0) return 0;
    if (margin >= 100) return Number((cost * 2).toFixed(2));
    return Number((cost / (1 - (margin / 100))).toFixed(2));
  };

  const calculateMarginFromSaleAndCost = (cost: number, sale: number): number => {
    if (sale <= 0) return 0;
    return Number((((sale - cost) / sale) * 100).toFixed(1));
  };

  const getEffectiveCost = (match: MatchState): number => {
    if (match.isConversionActive && match.conversionFactor && match.conversionFactor > 0) {
      return Number((match.xmlItem.unitCost / match.conversionFactor).toFixed(4));
    }
    return match.xmlItem.unitCost;
  };

  const buildInitialMatches = (items: XmlItem[], prods: Product[], cats: Category[], sysMargin = 50.0): MatchState[] => {
    return items.map((item: XmlItem) => {
      const exactMatch = prods.find(p => p.name.toLowerCase().trim() === item.name.toLowerCase().trim());
      
      const margin = exactMatch?.targetMargin && exactMatch.targetMargin > 0 
        ? exactMatch.targetMargin 
        : sysMargin;

      // Detectar sugestão de fator de conversão de embalagem ou peso
      const detection = detectConversionSuggestion(item.name, item.unit);
      const existingBoxQty = exactMatch?.hasBoxPrice && exactMatch.boxQuantity && exactMatch.boxQuantity > 1 ? exactMatch.boxQuantity : null;
      const isConversionActive = Boolean(existingBoxQty || detection.detected);
      const conversionFactor = existingBoxQty || (detection.detected ? detection.factor : 1);
      const conversionMode = detection.mode;

      const effectiveCost = (isConversionActive && conversionFactor > 0) ? (item.unitCost / conversionFactor) : item.unitCost;
      const suggestedSale = calculateSalePriceFromMargin(effectiveCost, margin);

      let newBoxPrice: number | undefined = undefined;
      if (exactMatch?.hasBoxPrice && exactMatch.boxQuantity) {
        // Proporcional
        if (exactMatch.price > 0 && exactMatch.boxPrice) {
          const ratio = suggestedSale / exactMatch.price;
          newBoxPrice = Number((exactMatch.boxPrice * ratio).toFixed(2));
        } else {
          newBoxPrice = Number((suggestedSale * exactMatch.boxQuantity).toFixed(2));
        }
      } else if (isConversionActive && conversionFactor > 1) {
        newBoxPrice = Number((suggestedSale * conversionFactor).toFixed(2));
      }

      return {
        xmlItem: item,
        action: exactMatch ? 'LINK' : 'NEW',
        productId: exactMatch?.id,
        categoryId: cats.length > 0 ? cats[0].id : undefined,
        targetMargin: margin,
        newSalePrice: suggestedSale,
        updateBoxPrice: Boolean(exactMatch?.hasBoxPrice || (isConversionActive && conversionFactor > 1)),
        newBoxPrice: newBoxPrice,
        conversionFactor,
        isConversionActive,
        conversionMode
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

  const checkPriceDrops = (validMatches: MatchState[]) => {
    const drops: { name: string; oldPrice: number; newPrice: number; diff: number }[] = [];
    for (const m of validMatches) {
      if (m.action === 'LINK' && m.productId && m.newSalePrice !== undefined) {
        const prod = products.find(p => p.id === m.productId);
        if (prod && prod.price > 0 && m.newSalePrice < prod.price) {
          drops.push({
            name: prod.name,
            oldPrice: prod.price,
            newPrice: m.newSalePrice,
            diff: Number((prod.price - m.newSalePrice).toFixed(2))
          });
        }
      }
    }
    return drops;
  };

  const handleApply = async () => {
    const validMatches = matches.filter(m => m.action !== 'IGNORE');
    if (validMatches.length === 0) {
      alert("Nenhum item selecionado para importação.");
      return;
    }

    if (confirmStatus === 'error') {
      alert("Atenção: A chave de acesso bipada na conferência não confere com o DANFE desta nota. Verifique o código de barras antes de efetivar.");
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

    // Verificar se há redução de preço em algum produto vinculado
    const priceDrops = checkPriceDrops(validMatches);
    if (priceDrops.length > 0) {
      setShowPriceDropModal(true);
      return;
    }

    await executeFinalApply();
  };

  const executeFinalApply = async () => {
    const validMatches = matches.filter(m => m.action !== 'IGNORE');
    try {
      setIsUploading(true);
      const keyToSend = (confirmChave || chaveAcesso || xmlData?.accessKey || '').replace(/\D/g, '');
      const itemsPayload = validMatches.map(m => ({
        ...m,
        conversionFactor: (m.isConversionActive && m.conversionFactor && m.conversionFactor > 0) ? m.conversionFactor : 1
      }));
      const res = await api.applyXmlImport({
        items: itemsPayload,
        chaveAcesso: keyToSend || undefined,
        supplierId: xmlData?.vendor?.id || undefined,
        vendorName: xmlData?.vendor?.name || undefined,
        numero: xmlData?.numero || undefined,
        serie: xmlData?.serie || undefined,
        dataEmissao: xmlData?.dataEmissao || undefined,
        valorTotal: xmlData?.valorTotal !== undefined ? xmlData.valorTotal : undefined
      });

      if (res.error) {
        throw new Error(res.error);
      }

      alert(`✅ Entrada no Estoque Confirmada com Sucesso!\n\n• Produtos atualizados: ${res.results?.updated ?? 0}\n• Novos produtos cadastrados: ${res.results?.created ?? 0}`);
      setShowPriceDropModal(false);
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
      <div className="flex flex-col items-center justify-center min-h-[360px] gap-4 text-slate-500 dark:text-slate-400">
        <Loader className="w-10 h-10 animate-spin text-amber-500" />
        <p className="font-bold text-slate-900 dark:text-white text-lg">Buscando e Processando XML da SEFAZ...</p>
        <p className="text-sm max-w-sm text-center">Aguarde enquanto extraímos os produtos e quantidades para conferência física.</p>
      </div>
    );
  }

  // TELA INICIAL: Escolha entre 2º Bip ou Arquivo XML
  if (!xmlData) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto pt-4 pb-20">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Painel Fiscal
        </button>

        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Importação de NF-e e Entrada no Estoque</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Realize o <strong>2º Bip (Conferência Física)</strong> para puxar os produtos da nota e dar entrada definitiva no estoque.
          </p>
        </div>

        {/* 1. SEÇÃO DE 2º BIP DIRETO (SCANNER HERO) */}
        <div className="bg-gradient-to-br from-amber-50/50 via-white to-amber-100/40 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/20 border-2 border-amber-500 rounded-3xl p-8 relative overflow-hidden shadow-xl dark:shadow-2xl dark:shadow-amber-500/10">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg shadow-amber-500/30">
              <Scan className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  2º Bip: Bipar DANFE para Entrada no Estoque
                </h3>
                <span className="text-[10px] bg-amber-500/20 text-amber-800 dark:text-amber-300 font-extrabold px-2.5 py-0.5 rounded-full border border-amber-500/40 uppercase tracking-wider">
                  Automático
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Aproxime o leitor de código de barras da DANFE impressa. O XML é carregado instantaneamente do sistema.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                ref={startBipInputRef}
                type="text"
                autoFocus
                value={bipChaveInput}
                onChange={e => handleSecondBipScan(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') executeBipSearch(bipChaveInput); }}
                placeholder="Bipe o código de barras de 44 dígitos da nota..."
                className="w-full bg-white dark:bg-slate-950 border-2 border-amber-500/60 focus:border-amber-400 rounded-2xl pl-12 pr-4 py-4 text-base font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition shadow-xs"
              />
              <Scan className="w-6 h-6 text-amber-500 absolute left-3.5 top-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <button
              onClick={() => executeBipSearch(bipChaveInput)}
              disabled={bipChaveInput.replace(/\D/g, '').length < 44}
              className="px-8 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-2xl transition flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:hover:bg-amber-500 shadow-xl shadow-amber-500/25 whitespace-nowrap cursor-pointer"
            >
              <Scan className="w-5 h-5" />
              Carregar Itens
            </button>
          </div>

          {bipError && (
            <div className="mt-4 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
              <span className="font-medium">{bipError}</span>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-amber-200/60 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-ping" />
              <span className="text-slate-700 dark:text-slate-300 font-medium">Leitor USB pronto:</span>
              <span>Bipe diretamente o DANFE, sem precisar de mouse ou teclado.</span>
            </div>
            <span className="font-mono text-[11px] text-amber-700 dark:text-amber-400/80 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-500/20">
              {bipChaveInput.replace(/\D/g, '').length}/44 dígitos
            </span>
          </div>
        </div>

        {/* 2. FALLBACK MANUAL SECUNDÁRIO (OPÇÃO DE CONTINGÊNCIA) */}
        <details className="group bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl transition hover:border-slate-300 dark:hover:border-slate-700 shadow-xs">
          <summary className="p-4 cursor-pointer text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between list-none select-none hover:text-slate-800 dark:hover:text-slate-200">
            <span className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition" />
              Problemas com o leitor de código de barras? Enviar arquivo .xml manualmente
            </span>
            <span className="text-[11px] text-slate-400 font-normal group-open:rotate-180 transition-transform">▼</span>
          </summary>

          <div className="p-5 pt-1 border-t border-slate-200 dark:border-slate-800/60 space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Caso você não tenha o código de barras impresso ou o leitor não esteja funcionando, você pode carregar o arquivo .xml fornecido pelo distribuidor:
            </p>

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
                  className="w-full py-3 px-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition flex items-center justify-center gap-2 cursor-pointer text-xs font-bold"
                >
                  <Upload className="w-4 h-4" />
                  <span>Selecionar Arquivo .XML de contingência</span>
                </button>
              ) : (
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-emerald-300 dark:border-emerald-500/30">
                  <div className="text-emerald-600 dark:text-emerald-400 font-mono text-xs flex items-center gap-2 truncate">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      onClick={() => setFile(null)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                    >
                      Trocar
                    </button>
                    <button 
                      onClick={handleUpload}
                      disabled={isUploading}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition disabled:opacity-50 cursor-pointer"
                    >
                      {isUploading ? 'Lendo...' : 'Carregar XML'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </details>
      </div>
    );
  }

  // TELA DE CONFERÊNCIA DOS ITENS (XML CARREGADO)
  return (
    <div className="space-y-4 max-w-4xl mx-auto pt-4 pb-20">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={() => setXmlData(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <button 
          onClick={handleApply}
          disabled={isUploading || confirmStatus !== 'ok'}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2.5 rounded-xl font-bold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 cursor-pointer"
          title={confirmStatus !== 'ok' ? 'Confirme a conferência física com o 2º bip antes de dar entrada no estoque' : ''}
        >
          <PackagePlus className="w-5 h-5" />
          {isUploading ? 'Efetivando Entrada...' : 'Confirmar Conferência & Dar Entrada no Estoque'}
        </button>
      </div>

      {/* Cabeçalho da Nota & Confirmação de 2º Bip */}
      <div className={`border rounded-3xl p-5 transition shadow-sm ${
        confirmStatus === 'ok'
          ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/40'
          : confirmStatus === 'error'
          ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/40'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/30">
              Conferência de Entrada (2º Bip)
            </span>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1 truncate">
              {xmlData.vendor?.name || 'Fornecedor Identificado'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              CNPJ: {xmlData.vendor?.cnpj || 'N/A'} {xmlData.numero ? `• NF: ${xmlData.numero}/${xmlData.serie || '1'}` : ''}
            </p>
          </div>

          {/* STATUS DO 2º BIP */}
          <div className="flex flex-col gap-1 sm:w-80">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Scan className="w-3.5 h-3.5 text-amber-500" />
              2º Bip: Confirmação da Nota Impressa
            </label>
            <div className="relative">
              <input
                ref={confirmInputRef}
                type="text"
                value={confirmChave}
                onChange={e => handleConfirmBip(e.target.value)}
                placeholder="Bipe a DANFE impressa (44 dígitos)..."
                className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs outline-none transition pr-9 shadow-xs ${
                  confirmStatus === 'ok'
                    ? 'border-emerald-500 focus:border-emerald-400'
                    : confirmStatus === 'error'
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-amber-500/60 focus:border-amber-400'
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {confirmStatus === 'ok' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                {confirmStatus === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                {confirmStatus === 'idle' && <Scan className="w-4 h-4 text-slate-400" />}
              </div>
            </div>
            {confirmStatus === 'error' && (
              <p className="text-xs text-red-600 dark:text-red-400 font-bold">⚠️ Chave divergente! Esta não é a nota física correspondente.</p>
            )}
            {confirmStatus === 'ok' && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> 2º Bip Confirmado: liberado para dar entrada no estoque.
              </p>
            )}
            {confirmStatus === 'idle' && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400/90 font-medium">Bipe a DANFE física para garantir que os itens recebidos batem com a nota.</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabela de Itens para Conferência */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm dark:shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
            Itens da Nota ({matches.length}) — Associe ou Cadastre
          </h4>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Ajuste os vínculos antes de aplicar
          </span>
        </div>

        <div className="space-y-3">
          {matches.map((match, i) => (
            <div key={match.xmlItem.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/90 rounded-2xl p-4 flex flex-col lg:flex-row gap-4 items-start lg:items-center shadow-xs">
              
              {/* Info do XML */}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">
                  Item #{i + 1} • {match.xmlItem.code ? `Cód: ${match.xmlItem.code}` : ''}
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate" title={match.xmlItem.name}>
                  {match.xmlItem.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-3">
                  <span>Qtd: <strong className="text-slate-800 dark:text-slate-200">{match.xmlItem.quantity} {match.xmlItem.unit}</strong></span>
                  <span>Custo Unit.: <strong className="text-slate-800 dark:text-slate-200">R$ {match.xmlItem.unitCost.toFixed(2)}</strong></span>
                  <span>Total: <strong className="text-emerald-600 dark:text-emerald-400">R$ {(match.xmlItem.quantity * match.xmlItem.unitCost).toFixed(2)}</strong></span>
                </div>
              </div>

              <ArrowRight className="hidden lg:block w-5 h-5 text-slate-400 dark:text-slate-700 shrink-0" />

              {/* Ação no Sistema */}
              <div className="flex-1 w-full bg-white dark:bg-slate-900/90 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => updateMatch(i, { action: 'LINK' })}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                      match.action === 'LINK'
                        ? 'bg-indigo-50 dark:bg-indigo-500/20 border-indigo-300 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                  >
                    Vincular Existente
                  </button>
                  <button
                    onClick={() => updateMatch(i, { action: 'NEW' })}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                      match.action === 'NEW'
                        ? 'bg-amber-50 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500 text-amber-700 dark:text-amber-300'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                  >
                    Criar Novo
                  </button>
                  <button
                    onClick={() => updateMatch(i, { action: 'IGNORE' })}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                      match.action === 'IGNORE'
                        ? 'bg-rose-50 dark:bg-rose-500/20 border-rose-300 dark:border-rose-500 text-rose-700 dark:text-rose-400'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                    }`}
                  >
                    Ignorar
                  </button>
                </div>

                {/* FATOR DE CONVERSÃO / EMBALAGEM / RENDIMENTO (PORÇÕES / CIGARRO / CAIXA) */}
                {match.action !== 'IGNORE' && (
                  <div className="mb-3 p-3 rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(match.isConversionActive)}
                          onChange={(e) => {
                            const active = e.target.checked;
                            const factor = active ? (match.conversionFactor && match.conversionFactor > 1 ? match.conversionFactor : 12) : 1;
                            const effectiveC = active ? Number((match.xmlItem.unitCost / factor).toFixed(4)) : match.xmlItem.unitCost;
                            const margin = match.targetMargin ?? defaultMargin;
                            const newSale = calculateSalePriceFromMargin(effectiveC, margin);
                            updateMatch(i, {
                              isConversionActive: active,
                              conversionFactor: factor,
                              newSalePrice: newSale
                            });
                          }}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-indigo-500" />
                          Fator de Conversão / Rendimento (Fracionar Caixa / Porção)
                        </span>
                      </label>
                      {match.isConversionActive && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                          {match.conversionMode === 'portion' ? 'Modo: Rendimento de Porções' : 'Modo: Caixa / Embalagem'}
                        </span>
                      )}
                    </div>

                    {match.isConversionActive && (
                      <div className="space-y-2 pt-1">
                        {/* Sugestões Rápidas */}
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mr-1">Atalhos rápidos:</span>
                          {[
                            { label: '10 un (Cigarro)', factor: 10, mode: 'box' as const },
                            { label: '12 un (Caixa)', factor: 12, mode: 'box' as const },
                            { label: '6 un (Pack)', factor: 6, mode: 'box' as const },
                            { label: '24 un (Fardo)', factor: 24, mode: 'box' as const },
                            { label: '12 porções (5kg)', factor: 12, mode: 'portion' as const },
                            { label: '6 porções (2kg)', factor: 6, mode: 'portion' as const },
                          ].map(preset => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                const effectiveC = Number((match.xmlItem.unitCost / preset.factor).toFixed(4));
                                const margin = match.targetMargin ?? defaultMargin;
                                const newSale = calculateSalePriceFromMargin(effectiveC, margin);
                                updateMatch(i, {
                                  conversionFactor: preset.factor,
                                  conversionMode: preset.mode,
                                  newSalePrice: newSale
                                });
                              }}
                              className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold transition cursor-pointer ${
                                match.conversionFactor === preset.factor && match.conversionMode === preset.mode
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-indigo-400'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>

                        {/* Input customizado de fator e resumo do cálculo */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-950">
                          <div>
                            <label className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                              {match.conversionMode === 'portion' ? 'Qtd. Porções por Embalagem / Peso:' : 'Unidades por Caixa / Pacote:'}
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={match.conversionFactor || 1}
                                onChange={(e) => {
                                  const factor = Math.max(1, parseInt(e.target.value, 10) || 1);
                                  const effectiveC = Number((match.xmlItem.unitCost / factor).toFixed(4));
                                  const margin = match.targetMargin ?? defaultMargin;
                                  const newSale = calculateSalePriceFromMargin(effectiveC, margin);
                                  updateMatch(i, {
                                    conversionFactor: factor,
                                    newSalePrice: newSale
                                  });
                                }}
                                className="w-24 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs font-bold rounded-lg p-1.5 focus:border-indigo-500 outline-none"
                              />
                              <span className="text-xs text-slate-600 dark:text-slate-400">
                                {match.conversionMode === 'portion' ? 'porções' : 'unidades'}
                              </span>
                            </div>
                          </div>

                          <div className="text-xs text-slate-600 dark:text-slate-300 flex flex-col justify-center space-y-1">
                            <div>
                              <span>Custo Unitário Real: </span>
                              <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                                R$ {getEffectiveCost(match).toFixed(2)}
                              </strong>
                              <span className="text-[10px] text-slate-400"> (divisão da nota)</span>
                            </div>
                            <div>
                              <span>Entrada no Estoque: </span>
                              <strong className="text-indigo-600 dark:text-indigo-400 font-mono">
                                +{Math.round(match.xmlItem.quantity * (match.conversionFactor || 1))} {match.conversionMode === 'portion' ? 'porções' : 'unidades'}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {match.action === 'LINK' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                        Produto no Sistema (Estoque será somado):
                      </label>
                      <select
                        value={match.productId || ''}
                        onChange={(e) => {
                          const pId = e.target.value;
                          const found = products.find(p => p.id === pId);
                          const margin = found?.targetMargin && found.targetMargin > 0 ? found.targetMargin : defaultMargin;
                          
                          // Se o produto já possui caixa cadastrada, sugere o fator
                          let convFactor = match.conversionFactor || 1;
                          let convActive = match.isConversionActive;
                          if (found?.hasBoxPrice && found.boxQuantity && found.boxQuantity > 1) {
                            convFactor = found.boxQuantity;
                            convActive = true;
                          }

                          const effCost = (convActive && convFactor > 0) ? Number((match.xmlItem.unitCost / convFactor).toFixed(4)) : match.xmlItem.unitCost;
                          const newSale = calculateSalePriceFromMargin(effCost, margin);
                          let newBox = undefined;
                          if (found?.hasBoxPrice && found.boxQuantity) {
                            if (found.price > 0 && found.boxPrice) {
                              newBox = Number((found.boxPrice * (newSale / found.price)).toFixed(2));
                            } else {
                              newBox = Number((newSale * found.boxQuantity).toFixed(2));
                            }
                          }
                          updateMatch(i, {
                            productId: pId,
                            targetMargin: margin,
                            newSalePrice: newSale,
                            conversionFactor: convFactor,
                            isConversionActive: convActive,
                            updateBoxPrice: Boolean(found?.hasBoxPrice),
                            newBoxPrice: newBox
                          });
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs rounded-lg p-2.5 focus:border-indigo-500 outline-none shadow-xs"
                      >
                        <option value="">-- Selecione o Produto Existente --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} (Estoque atual: {p.stock})</option>
                        ))}
                      </select>
                    </div>

                    {/* Preços e Margem Inteligente */}
                    {(() => {
                      const existingProd = products.find(p => p.id === match.productId);
                      const currentSale = existingProd?.price || 0;
                      const currentCost = existingProd?.costPrice || 0;
                      const effectiveCost = getEffectiveCost(match);
                      const newSale = match.newSalePrice ?? currentSale;
                      const isDrop = existingProd && currentSale > 0 && newSale < currentSale;
                      const isRise = existingProd && currentSale > 0 && newSale > currentSale;

                      return (
                        <div className="bg-slate-50 dark:bg-slate-950/80 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                              Atualização de Preço de Venda
                            </span>
                            {existingProd && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                Venda Atual: R$ {currentSale.toFixed(2)} | Custo Ant.: R$ {currentCost ? currentCost.toFixed(2) : '-'}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="text-[9px] font-extrabold uppercase text-slate-500 dark:text-slate-400 block mb-0.5">
                                Margem Alvo (%)
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  max="99"
                                  step="1"
                                  value={match.targetMargin ?? defaultMargin}
                                  onChange={(e) => {
                                    const m = parseFloat(e.target.value) || 0;
                                    const calculatedSale = calculateSalePriceFromMargin(effectiveCost, m);
                                    let calculatedBox = match.newBoxPrice;
                                    if (existingProd?.hasBoxPrice && existingProd.boxQuantity) {
                                      if (existingProd.price > 0 && existingProd.boxPrice) {
                                        calculatedBox = Number((existingProd.boxPrice * (calculatedSale / existingProd.price)).toFixed(2));
                                      } else {
                                        calculatedBox = Number((calculatedSale * existingProd.boxQuantity).toFixed(2));
                                      }
                                    }
                                    updateMatch(i, {
                                      targetMargin: m,
                                      newSalePrice: calculatedSale,
                                      newBoxPrice: calculatedBox
                                    });
                                  }}
                                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs rounded-lg p-1.5 focus:border-amber-500 outline-none"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">%</span>
                              </div>
                            </div>

                            <div>
                              <label className="text-[9px] font-extrabold uppercase text-slate-500 dark:text-slate-400 block mb-0.5">
                                Novo Preço Venda
                              </label>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={match.newSalePrice !== undefined ? match.newSalePrice : ''}
                                  onChange={(e) => {
                                    const s = parseFloat(e.target.value) || 0;
                                    const m = calculateMarginFromSaleAndCost(effectiveCost, s);
                                    let calculatedBox = match.newBoxPrice;
                                    if (existingProd?.hasBoxPrice && existingProd.boxQuantity) {
                                      if (existingProd.price > 0 && existingProd.boxPrice) {
                                        calculatedBox = Number((existingProd.boxPrice * (s / existingProd.price)).toFixed(2));
                                      } else {
                                        calculatedBox = Number((s * existingProd.boxQuantity).toFixed(2));
                                      }
                                    }
                                    updateMatch(i, {
                                      newSalePrice: s,
                                      targetMargin: m,
                                      newBoxPrice: calculatedBox
                                    });
                                  }}
                                  className={`w-full pl-7 pr-2 py-1.5 bg-white dark:bg-slate-900 border text-slate-900 dark:text-white font-mono text-xs font-bold rounded-lg outline-none ${
                                    isDrop ? 'border-amber-500 focus:border-amber-400 bg-amber-50/20' : 'border-slate-300 dark:border-slate-700 focus:border-emerald-500'
                                  }`}
                                />
                              </div>
                            </div>

                            <div className="col-span-2 sm:col-span-1 flex flex-col justify-center">
                              {isDrop && (
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-500/20">
                                  <TrendingDown className="w-3 h-3 text-amber-500 shrink-0" />
                                  <span>Preço abaixará (-R$ {(currentSale - newSale).toFixed(2)})</span>
                                </span>
                              )}
                              {isRise && (
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-500/20">
                                  <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0" />
                                  <span>Reajuste (+R$ {(newSale - currentSale).toFixed(2)})</span>
                                </span>
                              )}
                              {!isDrop && !isRise && existingProd && (
                                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                  Preço mantido
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Se for vendido em caixa, pergunta proporcional */}
                          {existingProd?.hasBoxPrice && existingProd.boxQuantity && (
                            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={Boolean(match.updateBoxPrice)}
                                  onChange={(e) => updateMatch(i, { updateBoxPrice: e.target.checked })}
                                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-slate-300 dark:border-slate-700"
                                />
                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                  <Package className="w-3.5 h-3.5 text-amber-500" />
                                  Atualizar preço de caixa proporcional ({existingProd.boxQuantity} un)?
                                </span>
                              </label>

                              {match.updateBoxPrice && (
                                <div className="mt-2 pl-6 flex items-center gap-3">
                                  <span className="text-[10px] text-slate-500">
                                    Caixa Atual: R$ {existingProd.boxPrice?.toFixed(2) || '0.00'} ➔ Novo Caixa:
                                  </span>
                                  <div className="relative w-28">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">R$</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={match.newBoxPrice !== undefined ? match.newBoxPrice : ''}
                                      onChange={(e) => updateMatch(i, { newBoxPrice: parseFloat(e.target.value) || 0 })}
                                      className="w-full pl-7 pr-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs font-bold rounded-lg outline-none focus:border-amber-500"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {match.action === 'NEW' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-1">
                        Categoria do Novo Produto:
                      </label>
                      <select
                        value={match.categoryId || ''}
                        onChange={(e) => updateMatch(i, { categoryId: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs rounded-lg p-2.5 focus:border-amber-500 outline-none shadow-xs"
                      >
                        <option value="">-- Selecione a Categoria --</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Preço de Venda do Novo Produto */}
                    <div className="bg-slate-50 dark:bg-slate-950/80 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                          Preço de Venda Sugerido (Novo Produto)
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Custo Real: R$ {getEffectiveCost(match).toFixed(2)}
                          {match.isConversionActive && match.conversionFactor && match.conversionFactor > 1 && (
                            <span className="text-slate-400 font-normal"> (NF: R$ {match.xmlItem.unitCost.toFixed(2)} / {match.conversionFactor})</span>
                          )}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-extrabold uppercase text-slate-500 dark:text-slate-400 block mb-0.5">
                            Margem Alvo (%)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              max="99"
                              step="1"
                              value={match.targetMargin ?? defaultMargin}
                              onChange={(e) => {
                                const m = parseFloat(e.target.value) || 0;
                                updateMatch(i, {
                                  targetMargin: m,
                                  newSalePrice: calculateSalePriceFromMargin(getEffectiveCost(match), m)
                                });
                              }}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs rounded-lg p-1.5 focus:border-amber-500 outline-none"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">%</span>
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] font-extrabold uppercase text-slate-500 dark:text-slate-400 block mb-0.5">
                            Preço de Venda
                          </label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={match.newSalePrice !== undefined ? match.newSalePrice : ''}
                              onChange={(e) => {
                                const s = parseFloat(e.target.value) || 0;
                                updateMatch(i, {
                                  newSalePrice: s,
                                  targetMargin: calculateMarginFromSaleAndCost(getEffectiveCost(match), s)
                                });
                              }}
                              className="w-full pl-7 pr-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs font-bold rounded-lg outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
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
        <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button 
            onClick={handleApply}
            disabled={isUploading || confirmStatus !== 'ok'}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-6 py-3 rounded-xl font-black text-sm transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xl shadow-emerald-500/20 cursor-pointer"
          >
            <PackagePlus className="w-5 h-5" />
            {isUploading ? 'Efetivando Entrada...' : 'Confirmar Conferência & Dar Entrada no Estoque'}
          </button>
        </div>
      </div>

      {/* Modal de Alerta de Redução de Preço */}
      {showPriceDropModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Atenção: Redução de Preço de Venda!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  O preço de venda calculado para um ou mais produtos ficou abaixo do valor atual.
                </p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-3.5 space-y-2 max-h-56 overflow-y-auto">
              <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                Produtos que terão o preço reduzido:
              </div>
              <div className="space-y-1.5">
                {checkPriceDrops(matches.filter(m => m.action !== 'IGNORE')).map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-white dark:bg-slate-950 p-2 rounded-xl border border-amber-200/60 dark:border-amber-500/20">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">
                      {p.name}
                    </span>
                    <span className="font-mono whitespace-nowrap text-amber-700 dark:text-amber-400">
                      R$ {p.oldPrice.toFixed(2)} ➔ <strong className="text-rose-600 dark:text-rose-400">R$ {p.newPrice.toFixed(2)}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Deseja realmente <strong>abaixar o preço de venda</strong> desses produtos no PDV/Mesas ou prefere manter os preços atuais e revisar as margens?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowPriceDropModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Voltar e Revisar Margens
              </button>
              <button
                onClick={() => executeFinalApply()}
                disabled={isUploading}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                {isUploading ? 'Efetivando...' : 'Confirmar e Reduzir Preço'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
