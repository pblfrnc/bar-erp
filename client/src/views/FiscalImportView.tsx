import React, { useState, useEffect, useRef } from 'react';
import { FileCode2, Upload, AlertCircle, CheckCircle2, PackagePlus, ArrowRight, ArrowLeft } from 'lucide-react';
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
}

export const FiscalImportView: React.FC<FiscalImportViewProps> = ({ onBack }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [xmlData, setXmlData] = useState<any>(null);
  const [matches, setMatches] = useState<MatchState[]>([]);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getProducts().then(setProducts).catch(() => {});
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

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
      // Pré-montar matches
      const initialMatches = res.items.map((item: XmlItem) => {
        // Tentar achar pelo nome exato (simplificado)
        const exactMatch = products.find(p => p.name.toLowerCase() === item.name.toLowerCase());
        return {
          xmlItem: item,
          action: exactMatch ? 'LINK' : 'NEW',
          productId: exactMatch?.id,
          categoryId: categories.length > 0 ? categories[0].id : undefined
        };
      });
      setMatches(initialMatches);
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

  const handleApply = async () => {
    const validMatches = matches.filter(m => m.action !== 'IGNORE');
    if (validMatches.length === 0) {
      alert("Nenhum item selecionado para importação.");
      return;
    }
    
    // Validar NEW sem categoria ou LINK sem produto
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
      const res = await api.applyXmlImport(validMatches);
      alert(`Importação concluída!\n\nAtualizados: ${res.results.updated}\nCriados: ${res.results.created}`);
      onBack();
    } catch (err: any) {
      alert("Erro ao aplicar: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  if (!xmlData) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto pt-4">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
        </button>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mx-auto">
            <FileCode2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Importar XML de Compra (NF-e)</h2>
            <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
              Selecione o arquivo .xml da nota fiscal enviada pelo seu fornecedor. O sistema irá extrair os produtos, atualizar o seu estoque e os preços de custo automaticamente.
            </p>
          </div>

          <div className="pt-4">
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
                className="mx-auto w-full max-w-xs py-4 px-6 rounded-2xl border-2 border-dashed border-slate-700 hover:border-emerald-500 bg-slate-950 text-slate-400 hover:text-emerald-400 transition flex flex-col items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-6 h-6" />
                <span className="font-bold text-sm">Selecionar Arquivo .XML</span>
              </button>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 font-mono text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  {file.name}
                </div>
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => setFile(null)}
                    className="px-6 py-3 rounded-xl font-bold bg-slate-800 text-white hover:bg-slate-700 transition"
                  >
                    Trocar Arquivo
                  </button>
                  <button 
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="px-6 py-3 rounded-xl font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition disabled:opacity-50"
                  >
                    {isUploading ? 'Lendo...' : 'Ler Nota Fiscal'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto pt-4 pb-20">
      <div className="flex items-center justify-between">
        <button onClick={() => setXmlData(null)} className="flex items-center gap-2 text-slate-400 hover:text-white transition">
          <ArrowLeft className="w-4 h-4" /> Cancelar
        </button>
        <button 
          onClick={handleApply}
          disabled={isUploading}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2.5 rounded-xl font-bold transition disabled:opacity-50"
        >
          <PackagePlus className="w-5 h-5" />
          {isUploading ? 'Processando...' : 'Efetivar Importação'}
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
        <h3 className="text-lg font-bold text-white">Fornecedor: {xmlData.vendor.name}</h3>
        <p className="text-sm text-slate-400 font-mono">CNPJ: {xmlData.vendor.cnpj}</p>
      </div>

      <div className="space-y-3">
        {matches.map((match, i) => (
          <div key={match.xmlItem.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            
            {/* Info do XML */}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-emerald-500 mb-1 uppercase tracking-wider">Lido da Nota (XML)</div>
              <div className="text-sm font-bold text-white truncate">{match.xmlItem.name}</div>
              <div className="text-xs text-slate-400 mt-1 flex gap-3">
                <span>Qtd: <strong className="text-slate-300">{match.xmlItem.quantity} {match.xmlItem.unit}</strong></span>
                <span>Custo: <strong className="text-slate-300">R$ {match.xmlItem.unitCost.toFixed(2)}</strong></span>
              </div>
            </div>

            <ArrowRight className="hidden lg:block w-5 h-5 text-slate-700 shrink-0" />

            {/* Ação no Sistema */}
            <div className="flex-1 w-full bg-slate-950 rounded-xl p-3 border border-slate-800/80">
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => updateMatch(i, { action: 'LINK' })}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${match.action === 'LINK' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                >
                  Vincular Existente
                </button>
                <button
                  onClick={() => updateMatch(i, { action: 'NEW' })}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${match.action === 'NEW' ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                >
                  Criar Novo
                </button>
                <button
                  onClick={() => updateMatch(i, { action: 'IGNORE' })}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${match.action === 'IGNORE' ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                >
                  Ignorar
                </button>
              </div>

              {match.action === 'LINK' && (
                <select
                  value={match.productId || ''}
                  onChange={(e) => updateMatch(i, { productId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg p-2 focus:border-indigo-500 outline-none"
                >
                  <option value="">-- Selecione o Produto --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Estoque: {p.stock})</option>
                  ))}
                </select>
              )}

              {match.action === 'NEW' && (
                <select
                  value={match.categoryId || ''}
                  onChange={(e) => updateMatch(i, { categoryId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg p-2 focus:border-amber-500 outline-none"
                >
                  <option value="">-- Categoria do Novo Produto --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}

              {match.action === 'IGNORE' && (
                <div className="text-xs text-slate-500 text-center py-2">
                  Este item não será adicionado ao estoque.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
