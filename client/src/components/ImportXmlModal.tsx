import { useState, useRef } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, FileText, Loader2, X } from 'lucide-react';
import { api } from '../services/api';

interface ImportResult {
  ok: boolean;
  mensagem?: string;
  resumo?: {
    categorias: { importadas: number; ignoradas: number };
    fornecedores: { importados: number; ignorados: number; duplicados: number };
    produtos: { importados: number; ignorados: number; atualizados: number; bar?: number; cozinha?: number };
    erros: string[];
  };
  error?: string;
}

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

export function ImportXmlModal({ onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f?.name.endsWith('.xml')) handleFile(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setIsImporting(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('xml', file);
      const res = await fetch(api.getApiUrl() + '/import-xml/tabelas', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      setResult(res.ok ? data : { ok: false, error: data.error });
      if (res.ok && onSuccess) onSuccess();
    } catch {
      setResult({ ok: false, error: 'Sem resposta do servidor. Verifique se o BarERP está rodando.' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="bg-sky-500/10 p-2 rounded-xl">
              <UploadCloud className="w-5 h-5 text-sky-500 dark:text-sky-400" />
            </div>
            <div>
              <h2 className="text-slate-900 dark:text-white font-bold">Importar do Sistema Antigo</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">XML de exportação de tabelas</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Aviso desenvolvedor */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
              <span className="font-black">USO EXCLUSIVO DO DESENVOLVEDOR.</span>{' '}
              Esta função importa dados em massa do sistema antigo. Usar sem orientação pode duplicar ou sobrescrever produtos e fornecedores.
            </p>
          </div>

          {/* Instrução */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-transparent rounded-xl p-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            O arquivo deve ser o XML exportado pelo sistema antigo contendo{' '}
            <span className="text-slate-900 dark:text-white font-medium">Fornecedores</span>,{' '}
            <span className="text-slate-900 dark:text-white font-medium">Categorias</span> e{' '}
            <span className="text-slate-900 dark:text-white font-medium">Produtos</span>.
            Os dados já existentes não serão duplicados.
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition
              ${file ? 'border-sky-500/50 bg-sky-500/5' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 bg-slate-50 dark:bg-slate-800/30'}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xml"
              className="hidden"
              onChange={e => handleFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="space-y-1">
                <FileText className="w-8 h-8 text-sky-500 dark:text-sky-400 mx-auto" />
                <p className="text-slate-900 dark:text-white font-bold text-sm">{file.name}</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs">{(file.size / 1024).toFixed(1)} KB — clique para trocar</p>
              </div>
            ) : (
              <div className="space-y-2">
                <UploadCloud className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto" />
                <p className="text-slate-600 dark:text-slate-400 text-sm">Arraste o arquivo XML aqui ou <span className="text-sky-600 dark:text-sky-400 underline">clique para selecionar</span></p>
              </div>
            )}
          </div>

          {/* Resultado */}
          {result && (
            <div className={`rounded-2xl p-4 space-y-3 ${result.ok ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              {result.ok ? (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                    <p className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">Importação concluída!</p>
                  </div>
                  {result.resumo && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-100 dark:bg-slate-900/60 rounded-xl p-2.5">
                        <p className="text-slate-600 dark:text-slate-400">Categorias importadas</p>
                        <p className="text-slate-900 dark:text-white font-black text-lg">{result.resumo.categorias.importadas}</p>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-900/60 rounded-xl p-2.5">
                        <p className="text-slate-600 dark:text-slate-400">Fornecedores importados</p>
                        <p className="text-slate-900 dark:text-white font-black text-lg">{result.resumo.fornecedores.importados}</p>
                        {result.resumo.fornecedores.duplicados > 0 && (
                          <p className="text-slate-500 text-[10px]">{result.resumo.fornecedores.duplicados} já existiam</p>
                        )}
                      </div>
                      {result.resumo.produtos.importados + result.resumo.produtos.atualizados > 0 && (
                        <>
                          <div className="bg-slate-100 dark:bg-slate-900/60 rounded-xl p-2.5">
                            <p className="text-slate-600 dark:text-slate-400">Produtos importados</p>
                            <p className="text-slate-900 dark:text-white font-black text-lg">{result.resumo.produtos.importados}</p>
                          </div>
                          <div className="bg-slate-100 dark:bg-slate-900/60 rounded-xl p-2.5">
                            <p className="text-slate-600 dark:text-slate-400">Produtos atualizados</p>
                            <p className="text-slate-900 dark:text-white font-black text-lg">{result.resumo.produtos.atualizados}</p>
                          </div>
                          {(result.resumo.produtos.bar !== undefined || result.resumo.produtos.cozinha !== undefined) && (
                            <div className="col-span-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-xs flex justify-between items-center">
                              <span className="text-amber-800 dark:text-amber-200">🍺 <b>Bar (ml / bebidas):</b> {result.resumo.produtos.bar || 0}</span>
                              <span className="text-amber-800 dark:text-amber-200">🍳 <b>Cozinha:</b> {result.resumo.produtos.cozinha || 0}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {result.resumo && result.resumo.erros.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                      <p className="text-amber-800 dark:text-amber-300 text-xs font-bold mb-1">⚠️ {result.resumo.erros.length} erros ignorados:</p>
                      <ul className="text-amber-800/80 dark:text-amber-200/70 text-[10px] space-y-0.5 max-h-24 overflow-auto">
                        {result.resumo.erros.map((e, i) => <li key={i}>• {e}</li>)}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-red-700 dark:text-red-300 text-sm">{result.error}</p>
                </div>
              )}
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={!file || isImporting}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm bg-sky-600 hover:bg-sky-500 text-white transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isImporting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
                : <><UploadCloud className="w-4 h-4" /> Importar Dados</>
              }
            </button>
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-2xl font-bold text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
            >
              {result?.ok ? 'Fechar' : 'Cancelar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
