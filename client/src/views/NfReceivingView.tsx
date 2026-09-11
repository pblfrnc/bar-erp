import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Scan, CheckCircle, RefreshCw, Package, Loader, Trash2, FileText, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface NotaRecebida {
  id: string;
  chave: string;
  emitente: string;
  cnpjEmitente: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  valorTotal: number;
  status: string;
  createdAt: string;
}

interface NfReceivingViewProps {
  onBack: () => void;
  onImportarXml: (chave: string) => void;
}

export const NfReceivingView: React.FC<NfReceivingViewProps> = ({ onBack, onImportarXml }) => {
  const [chave, setChave] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [notas, setNotas] = useState<NotaRecebida[]>([]);
  const [loadingNotas, setLoadingNotas] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    loadNotas();
  }, []);

  const loadNotas = async () => {
    try {
      setLoadingNotas(true);
      const res = await fetch(`${api.getApiUrl()}/fiscal/notas-recebidas`);
      const data = await res.json();
      setNotas(Array.isArray(data) ? data : []);
    } catch {
      setNotas([]);
    } finally {
      setLoadingNotas(false);
    }
  };

  
  const handleSyncSEFAZ = async () => {
    setIsLoading(true);
    setLastResult(null);
    try {
      const res = await fetch(`${api.getApiUrl()}/fiscal/sync-nfe-recebidas`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Erro ao sincronizar');
      
      setLastResult({ success: true, message: data.message || 'Sincronização concluída!' });
      await loadNotas();
    } catch (err: any) {
      setLastResult({ success: false, error: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBip = async () => {
    const chaveClean = chave.replace(/\D/g, '');
    if (chaveClean.length !== 44) {
      return alert('Chave de acesso inválida. Bipe novamente ou verifique os 44 dígitos.');
    }

    setIsLoading(true);
    setLastResult(null);

    try {
      const res = await fetch(`${api.getApiUrl()}/fiscal/bip-chave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: chaveClean })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setLastResult({ success: true, ...data });
      await loadNotas();
    } catch (err: any) {
      setLastResult({ success: false, error: err.message });
    } finally {
      setIsLoading(false);
      setChave('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleBip();
  };

  const formatChave = (c: string) => {
    return c.replace(/(\d{4})/g, '$1 ').trim();
  };

  const formatMoney = (v: number) =>
    `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pt-4 pb-20">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> Voltar ao Módulo Fiscal
      </button>

      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">1º BIP: Recebimento de NF & Ciência na SEFAZ</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Bipe a chave de 44 dígitos na entrega da mercadoria. O sistema registra a <strong>Ciência da Operação na SEFAZ</strong> e faz o download automático do XML.
        </p>
      </div>

      {/* Alerta explicativo do fluxo em 2 etapas */}
      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4 text-xs text-amber-800 dark:text-amber-300/90 flex items-start gap-3 shadow-xs">
        <Scan className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-900 dark:text-white">Fluxo de Entrada em 2 Etapas:</p>
          <p><strong>1º Bip (Aqui):</strong> Confirma o recebimento fiscal na SEFAZ e baixa o XML. O estoque <u className="font-bold text-amber-700 dark:text-amber-200">não</u> é alterado ainda.</p>
          <p><strong>2º Bip (Na Conferência):</strong> Feito ao descarregar as caixas e conferir os itens recebidos com a DANFE impressa. É neste momento que os produtos e custos entram no estoque.</p>
        </div>
      </div>

      {/* Campo de Bip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <Scan className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">1º Bip — Leitor de Chave de Acesso</h3>
        </div>

        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={chave}
            onChange={e => setChave(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Bipe o código ou cole a chave de 44 dígitos aqui..."
            className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-mono text-sm focus:border-amber-500 outline-none transition shadow-xs"
            disabled={isLoading}
          />
          <button
            onClick={handleBip}
            disabled={isLoading || chave.replace(/\D/g, '').length < 44}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl transition disabled:opacity-50 flex items-center gap-2 whitespace-nowrap cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
          >
            {isLoading ? <Loader className="w-5 h-5 animate-spin" /> : <Scan className="w-5 h-5" />}
            {isLoading ? 'Consultando SEFAZ...' : 'Registrar NF'}
          </button>
        </div>

        <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
          <p className="flex items-center gap-1">
            <Scan className="w-3 h-3" />
            Pressione <strong className="text-slate-700 dark:text-slate-400">Enter</strong> após bipar para registro imediato. O leitor USB já faz isso automaticamente.
          </p>
          <button
            onClick={() => onImportarXml('')}
            className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 hover:underline font-semibold cursor-pointer shrink-0"
          >
            <FileText className="w-3.5 h-3.5" /> Fazer Upload de Arquivo XML (Manual)
          </button>
        </div>

        {/* Resultado do último bip */}
        {lastResult && (
          <div className={`mt-4 p-4 rounded-2xl border flex items-start gap-3 ${
            !lastResult.success
              ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'
              : lastResult.xmlDisponivel === false
                ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
                : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
          }`}>
            {!lastResult.success ? (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            ) : lastResult.xmlDisponivel === false ? (
              <RefreshCw className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-500 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              {!lastResult.success ? (
                <>
                  <p className="text-sm font-bold text-red-700 dark:text-red-400">Erro no Bip</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{lastResult.error}</p>
                </>
              ) : lastResult.xmlDisponivel === false ? (
                <>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Ciência Registrada na SEFAZ! (XML em processamento)</p>
                    <button
                      onClick={() => onImportarXml(lastResult.chave)}
                      className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1 rounded-lg font-bold transition cursor-pointer"
                    >
                      Tentar Conferir Agora
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {lastResult.emitente} — NF {lastResult.numero}/{lastResult.serie}
                  </p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1">
                    A SEFAZ recebeu o manifesto e está consolidando o XML oficial com a Focus NFe (~30s a 1 min). A nota já foi salva com segurança no seu histórico.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">1º Bip Concluído! Ciência e XML OK na SEFAZ</p>
                    <button
                      onClick={() => onImportarXml(lastResult.chave)}
                      className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg font-bold transition cursor-pointer"
                    >
                      Ir para 2º Bip / Conferência →
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    {lastResult.emitente} — NF {lastResult.numero}/{lastResult.serie} — {formatMoney(lastResult.valorTotal)}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lista de Notas Recebidas */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Histórico de Recebimentos</h3>
          </div>
          <button onClick={loadNotas} className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer">
            Atualizar
          </button>
        </div>

        {loadingNotas ? (
          <div className="text-center py-8 text-slate-500">
            <Loader className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            Carregando...
          </div>
        ) : notas.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Scan className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma nota recebida ainda. Bipe a primeira!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notas.map((nota) => (
              <div
                key={nota.id}
                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl gap-4 shadow-xs"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      nota.status === 'importada'
                        ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                        : nota.status === 'ciencia_registrada'
                          ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30'
                          : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                    }`}>
                      {nota.status === 'importada'
                        ? '✓ 2º Bip OK (No Estoque)'
                        : nota.status === 'ciencia_registrada'
                          ? 'Ciência SEFAZ OK (Processando XML)'
                          : 'Aguardando 2º Bip (Conferência)'}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">NF {nota.numero}/{nota.serie}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{nota.emitente || 'Fornecedor não identificado'}</p>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">{formatChave(nota.chave).substring(0, 24)}…</p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-base font-black text-amber-600 dark:text-amber-400">{formatMoney(nota.valorTotal)}</p>
                  <p className="text-xs text-slate-500">{new Date(nota.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>

                <button
                  onClick={() => onImportarXml(nota.chave)}
                  disabled={nota.status === 'importada'}
                  className={`shrink-0 flex items-center gap-2 px-4 py-2 font-bold text-sm rounded-xl transition cursor-pointer border ${
                    nota.status === 'importada'
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-50'
                      : nota.status === 'ciencia_registrada'
                        ? 'bg-blue-500/15 hover:bg-blue-500 text-blue-700 hover:text-white dark:text-blue-400 border-blue-500/30'
                        : 'bg-amber-500/15 hover:bg-amber-500 text-amber-800 hover:text-slate-950 dark:text-amber-400 border-amber-500/30'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  {nota.status === 'importada'
                    ? 'Entrada Realizada'
                    : nota.status === 'ciencia_registrada'
                      ? 'Conferir / Obter XML'
                      : 'Fazer 2º Bip / Conferir'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
