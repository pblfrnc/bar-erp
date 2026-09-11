import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Clock, 
  Copy, 
  Check, 
  RefreshCw, 
  MessageCircle, 
  Key, 
  Sparkles, 
  Calendar, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  CreditCard,
  Building2,
  CheckCircle2,
  Laptop
} from 'lucide-react';
import { getServerBaseUrl } from '../services/socket';

interface SubscriptionViewProps {
  machineId: string;
  daysRemaining: number;
  isLicensed: boolean | null;
  licenseStatus?: string;
  expiresAt?: string | null;
  clientName?: string;
  developerContact?: {
    phone?: string;
    pixKey?: string;
    developerName?: string;
    monthlyFee?: string;
  };
  onBack: () => void;
  onRefresh: () => Promise<void>;
}

export const SubscriptionView: React.FC<SubscriptionViewProps> = ({
  machineId,
  daysRemaining,
  isLicensed,
  licenseStatus = 'ACTIVE',
  expiresAt,
  clientName,
  developerContact,
  onBack,
  onRefresh
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<number>(1);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Ativação Offline
  const [showOfflineBox, setShowOfflineBox] = useState(false);
  const [offlineKey, setOfflineKey] = useState('');
  const [loadingOffline, setLoadingOffline] = useState(false);
  const [offlineMessage, setOfflineMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const devPhone = developerContact?.phone || '5547974002560';
  const devPix = developerContact?.pixKey || '68.817.608/0001-47';
  const devName = developerContact?.developerName || 'Pablo Franco - Software House';

  // Copiar ID da Máquina
  const handleCopyId = () => {
    if (!machineId) return;
    navigator.clipboard.writeText(machineId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Copiar Chave PIX
  const handleCopyPix = () => {
    if (!devPix) return;
    navigator.clipboard.writeText(devPix);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2000);
  };

  // Sincronizar licença online remotamente
  const handleSyncOnline = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch(`${getServerBaseUrl()}/api/settings/license/sync-remote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncMessage({
          type: 'success',
          text: `🎉 Licença sincronizada! Nova validade: ${data.expiresAt ? new Date(data.expiresAt).toLocaleDateString('pt-BR') : 'Ativa'} (${data.daysRemaining || daysRemaining} dias restantes).`
        });
        await onRefresh();
      } else {
        setSyncMessage({
          type: 'error',
          text: data.message || 'Sua máquina ainda não foi renovada no painel da Software House. Envie o comprovante ao desenvolvedor.'
        });
      }
    } catch (err: any) {
      setSyncMessage({
        type: 'error',
        text: 'Não foi possível conectar ao servidor de licenças. Verifique sua internet.'
      });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 8000);
    }
  };

  // Ativar chave offline
  const handleActivateOffline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offlineKey.trim()) return;

    setLoadingOffline(true);
    setOfflineMessage(null);
    try {
      const res = await fetch(`${getServerBaseUrl()}/api/settings/license/offline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: offlineKey.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOfflineMessage({
          type: 'success',
          text: `🎉 Chave offline validada com sucesso! Válido até: ${data.expiresAt ? new Date(data.expiresAt).toLocaleDateString('pt-BR') : 'Ativo'}.`
        });
        setOfflineKey('');
        await onRefresh();
      } else {
        setOfflineMessage({
          type: 'error',
          text: data.error || 'Chave offline inválida para esta máquina ou formato incorreto.'
        });
      }
    } catch (err: any) {
      setOfflineMessage({
        type: 'error',
        text: 'Erro ao validar chave offline localmente.'
      });
    } finally {
      setLoadingOffline(false);
    }
  };

  // Enviar solicitação de renovação antecipada no WhatsApp
  const handleRequestRenewal = () => {
    const rawDigits = devPhone.replace(/\D/g, '');
    const cleanPhone = rawDigits.startsWith('55') ? rawDigits : `55${rawDigits}`;
    const currentFormattedDate = expiresAt 
      ? new Date(expiresAt).toLocaleDateString('pt-BR') 
      : `${daysRemaining} dias`;

    const monthsLabels: Record<number, string> = {
      1: '1 Mês (+30 dias)',
      2: '2 Meses (+60 dias)',
      3: '3 Meses / Trimestral (+90 dias)',
      6: '6 Meses / Semestral (+180 dias)',
      12: '12 Meses / Anual (+365 dias)'
    };

    const periodLabel = monthsLabels[selectedMonths] || `${selectedMonths} Meses`;

    const message = [
      `👋 *Olá, ${devName}!*`,
      `Gostaria de solicitar a *renovação antecipada* da licença do *Bar ERP*.`,
      ``,
      `🏢 *Estabelecimento:* ${clientName || 'Cliente Bar ERP'}`,
      `💻 *ID da Máquina:* \`${machineId}\``,
      `⏳ *Validade Atual:* ${daysRemaining} dias restantes (vence em: ${currentFormattedDate})`,
      `📅 *Período Antecipado:* ${periodLabel}`,
      ``,
      `💰 *Forma:* Pagamento via PIX`,
      `Segue o comprovante de pagamento para liberação dos dias adicionais no sistema! Obrigado!`
    ].join('\n');

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Calcular projeção da nova data com renovação antecipada
  const calculateNewExpirationDate = () => {
    const baseDate = expiresAt ? new Date(expiresAt) : new Date();
    const daysToAdd = selectedMonths * 30;
    const futureDate = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    return futureDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const formattedExpiration = expiresAt 
    ? new Date(expiresAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'Data em validação';

  const isExpiringSoon = daysRemaining <= 5 && daysRemaining > 0;

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto animate-in fade-in duration-200">
      {/* 1. Cabeçalho com Botão Voltar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition active:scale-95 cursor-pointer border border-slate-200 dark:border-slate-700"
            title="Voltar para Retaguarda"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                Minha Assinatura & Licença
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                Regularizada
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Identificador do computador, dias restantes e solicitação de renovação antecipada.
            </p>
          </div>
        </div>

        {/* Botão Sincronizar Licença Online */}
        <button
          type="button"
          disabled={syncing}
          onClick={handleSyncOnline}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/20 dark:hover:bg-indigo-500/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/40 text-xs font-bold transition active:scale-95 cursor-pointer self-stretch sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-indigo-500' : ''}`} />
          {syncing ? 'Sincronizando...' : 'Sincronizar com Servidor'}
        </button>
      </div>

      {/* Alerta de Feedback de Sincronização */}
      {syncMessage && (
        <div className={`p-4 rounded-2xl border text-xs font-medium flex items-center gap-3 animate-in fade-in duration-150 ${
          syncMessage.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
        }`}>
          {syncMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />}
          <span>{syncMessage.text}</span>
        </div>
      )}

      {/* 2. Grid Principal: Status do Plano + ID da Máquina */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Validade da Licença & Dias Restantes */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-white to-white dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 border border-emerald-500/30 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Status da Licença</span>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    {licenseStatus === 'ACTIVE' ? 'Ativa & Em Operação' : licenseStatus}
                  </span>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                isExpiringSoon
                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 animate-pulse'
                  : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isExpiringSoon ? 'bg-amber-500' : 'bg-emerald-500'} animate-ping`} />
                {isExpiringSoon ? 'Expira em Breve' : 'Operação Liberada'}
              </span>
            </div>

            {/* Grande Mostrador de Dias */}
            <div className="my-5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block uppercase">Tempo Restante:</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                  {daysRemaining}
                </span>
                <span className="text-base sm:text-lg font-bold text-slate-600 dark:text-slate-400">
                  {daysRemaining === 1 ? 'dia restante' : 'dias restantes'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Vencimento:
              </span>
              <span className="font-bold text-slate-900 dark:text-slate-200">
                {formattedExpiration}
              </span>
            </div>
            {clientName && (
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  Estabelecimento:
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-200">
                  {clientName}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: ID da Máquina (Identificador Único) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Terminal Atual</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Identificador de Hardware
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                Hash Único
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
              Este identificador vincula este computador à sua licença no servidor da Software House.
            </p>

            {/* Código Mono em Destaque */}
            <div className="my-4 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 relative group">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex items-center justify-between">
                <span>Machine ID:</span>
                <span className="text-[9px] text-indigo-600 dark:text-indigo-400">Clique para copiar</span>
              </div>
              <code 
                onClick={handleCopyId}
                className="text-xs font-mono font-black text-indigo-700 dark:text-indigo-300 break-all select-all block cursor-pointer hover:opacity-80 transition"
              >
                {machineId || 'Carregando identificador...'}
              </code>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyId}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-700 active:scale-95"
          >
            {copiedId ? (
              <>
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-700 dark:text-emerald-300">ID da Máquina Copiado com Sucesso!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-500" />
                <span>Copiar ID da Máquina</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Seção Especial: Renovação & Ativação Antecipada */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Renovação & Pagamento Antecipado
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pague meses com antecedência e garanta a operação contínua do seu bar sem bloqueios.
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/40 px-3 py-1 rounded-full">
            💡 Os dias são cumulativos
          </span>
        </div>

        {/* Banner Explicativo de Segurança: Não perde dias */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-xl">🛡️</span>
          <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
            <p className="font-bold text-slate-900 dark:text-white">
              Garantia de Acúmulo de Dias:
            </p>
            <p>
              Ao pagar 1 ou mais meses antecipadamente, os novos dias são <strong>somados ao final da sua validade atual</strong>. Você nunca perde os <strong>{daysRemaining} dias</strong> que já possui!
            </p>
          </div>
        </div>

        {/* Seletor de Período */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-3">
            Selecione quantos meses deseja renovar adiantado:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { months: 1, label: '+1 Mês', sub: '30 dias adicionais' },
              { months: 3, label: '+3 Meses', sub: '90 dias (Trimestral)' },
              { months: 6, label: '+6 Meses', sub: '180 dias (Semestral)', highlight: true },
              { months: 12, label: '+12 Meses', sub: '365 dias (1 Ano)' },
            ].map((plan) => {
              const isSelected = selectedMonths === plan.months;
              return (
                <button
                  key={plan.months}
                  type="button"
                  onClick={() => setSelectedMonths(plan.months)}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30 text-slate-900 dark:text-white'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-2.5 right-2 px-1.5 py-0.5 bg-amber-500 text-slate-950 text-[9px] font-black uppercase rounded-full">
                      Popular
                    </span>
                  )}
                  <div className="text-sm font-black flex items-center justify-between">
                    <span>{plan.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-amber-500" />}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    {plan.sub}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Prévia da Nova Validade Projetada */}
        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase block">Projeção da Nova Validade:</span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-4 h-4" />
              Válido até {calculateNewExpirationDate()} ({daysRemaining + (selectedMonths * 30)} dias no total)
            </span>
          </div>
          <span className="text-[11px] text-slate-500 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
            {selectedMonths} {selectedMonths === 1 ? 'mês adicionado' : 'meses adicionados'}
          </span>
        </div>

        {/* Dados do PIX para Pagamento */}
        <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-indigo-200">
                Chave PIX para Renovação:
              </span>
            </div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
              Titular: {devName}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
            <code className="text-xs font-mono font-black text-slate-900 dark:text-indigo-200 px-2 py-1 select-all flex-1 break-all">
              {devPix}
            </code>
            <button
              type="button"
              onClick={handleCopyPix}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs active:scale-95"
            >
              {copiedPix ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copiada!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Chave PIX</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Botão de Ação: Enviar Comprovante no WhatsApp */}
        <button
          type="button"
          onClick={handleRequestRenewal}
          className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2.5 active:scale-98 cursor-pointer uppercase tracking-wider"
        >
          <MessageCircle className="w-5 h-5 stroke-[2.5]" />
          Solicitar Renovação Antecipada no WhatsApp
        </button>
      </div>

      {/* 4. Sanfona / Accordion: Ativação por Chave Offline (Sem Internet) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setShowOfflineBox(!showOfflineBox)}
          className="w-full p-5 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Ativação Offline (Sem Internet)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Recebeu uma chave de ativação offline do desenvolvedor? Clique para inserir.
              </p>
            </div>
          </div>
          {showOfflineBox ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showOfflineBox && (
          <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-4">
            <form onSubmit={handleActivateOffline} className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Cole a Chave de Ativação Offline:
              </label>
              <textarea
                rows={2}
                value={offlineKey}
                onChange={(e) => setOfflineKey(e.target.value)}
                placeholder="Ex: eyJtYWNoaW5lSWQiOi... ou BAR-ERP-XXXXX"
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />

              {offlineMessage && (
                <div className={`p-3 rounded-xl text-xs font-bold ${
                  offlineMessage.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                }`}>
                  {offlineMessage.text}
                </div>
              )}

              <button
                type="submit"
                disabled={loadingOffline || !offlineKey.trim()}
                className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {loadingOffline ? 'Validando Chave...' : 'Validar Chave Offline'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* 5. Central de Contato do Desenvolvedor */}
      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div>
          <span className="text-[10px] font-black uppercase text-slate-400 block">Software House & Desenvolvedor</span>
          <span className="font-bold text-slate-900 dark:text-white text-sm block">{devName}</span>
          <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
            WhatsApp: <span className="font-semibold text-emerald-600 dark:text-emerald-400">(47) 97400-2560</span> • Suporte técnico, renovações e customizações.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const rawDigits = devPhone.replace(/\D/g, '');
            const cleanPhone = rawDigits.startsWith('55') ? rawDigits : `55${rawDigits}`;
            window.open(`https://wa.me/${cleanPhone}?text=Olá! Preciso de suporte no Bar ERP.`, '_blank');
          }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shrink-0 cursor-pointer self-start sm:self-auto shadow-sm shadow-emerald-600/20"
        >
          <MessageCircle className="w-4 h-4 text-white" />
          Falar no WhatsApp (47 97400-2560)
        </button>
      </div>
    </div>
  );
};
