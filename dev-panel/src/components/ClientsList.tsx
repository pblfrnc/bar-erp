import React, { useState } from 'react';
import { 
  Building2, 
  Smartphone, 
  Key, 
  RefreshCw, 
  Zap, 
  MessageCircle, 
  ShieldAlert, 
  ShieldCheck, 
  Copy, 
  Check, 
  Clock, 
  PlusCircle, 
  Trash2, 
  Monitor,
  Ban
} from 'lucide-react';
import { ClientRecord, LicenseRecord } from '../types';

interface Props {
  clients: ClientRecord[];
  loading: boolean;
  onQuickRenew: (machineId: string, clientName: string) => Promise<void>;
  onOpenRenewModal: (license: LicenseRecord, client: ClientRecord) => void;
  onOpenOfflineKey: (license: LicenseRecord, client: ClientRecord) => void;
  onToggleBlock: (machineId: string) => Promise<void>;
  onDeleteClient: (clientId: string, clientName: string) => Promise<void>;
  onAddMachine: (clientId: string) => void;
}

export function ClientsList({
  clients,
  loading,
  onQuickRenew,
  onOpenRenewModal,
  onOpenOfflineKey,
  onToggleBlock,
  onDeleteClient,
  onAddMachine,
}: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [renewingId, setRenewingId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleQuickRenewClick = async (machineId: string, clientName: string) => {
    try {
      setRenewingId(machineId);
      await onQuickRenew(machineId, clientName);
    } finally {
      setRenewingId(null);
    }
  };

  const getStatusBadge = (license: LicenseRecord) => {
    if (license.status === 'BLOCKED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <Ban size={12} /> Bloqueada
        </span>
      );
    }

    const now = new Date();
    const exp = new Date(license.expires_at);
    const diffMs = exp.getTime() - now.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (days <= 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
          <ShieldAlert size={12} /> Expirada ({Math.abs(days)}d atrás)
        </span>
      );
    }

    if (days <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
          <Clock size={12} /> Vence em {days} {days === 1 ? 'dia' : 'dias'}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        <ShieldCheck size={12} /> Ativa ({days}d restantes)
      </span>
    );
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return isoStr;
    }
  };

  const openWhatsApp = (phone: string, clientName: string, license?: LicenseRecord) => {
    const cleanPhone = phone.replace(/\D/g, '');
    let text = `Olá, tudo bem? Aqui é do suporte do Bar ERP!\n`;
    if (license) {
      const exp = formatDate(license.expires_at);
      text += `Confirmamos seu pagamento da mensalidade do *${clientName}*. Sua licença está ativa até *${exp}*!\n\nQualquer dúvida estamos à disposição! 🚀`;
    } else {
      text += `Estamos entrando em contato sobre a sua assinatura do Bar ERP (*${clientName}*).`;
    }
    const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 bg-slate-900/60 border border-slate-800 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-12 text-center">
        <Building2 size={48} className="mx-auto text-slate-600 mb-4" />
        <h3 className="text-xl font-bold text-slate-300 mb-2">Nenhum cliente encontrado</h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
          Cadastre seu primeiro estabelecimento para começar a gerenciar licenças e receber comprovantes de pagamento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {clients.map((client) => {
        const hasLicenses = client.licenses && client.licenses.length > 0;

        return (
          <div
            key={client.id}
            className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700/90 transition-all duration-150 backdrop-blur-sm"
          >
            {/* Header do Cliente */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 font-bold text-base">
                  {client.business_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white tracking-tight">
                      {client.business_name}
                    </h3>
                    {client.owner_name && (
                      <span className="text-xs text-slate-400 font-medium">
                        ({client.owner_name})
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1 font-mono">
                      <Smartphone size={13} className="text-emerald-400" />
                      {client.phone}
                    </span>
                    {client.city && (
                      <span>
                        📍 {client.city}{client.state ? ` - ${client.state}` : ''}
                      </span>
                    )}
                    {client.document && (
                      <span className="font-mono">
                        CNPJ/CPF: {client.document}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Ações do Cliente */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  R$ {Number(client.monthly_fee).toFixed(2)}/mês
                </span>

                <button
                  onClick={() => openWhatsApp(client.phone, client.business_name, client.licenses?.[0])}
                  title="Conversar no WhatsApp"
                  className="p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition-colors"
                >
                  <MessageCircle size={16} />
                </button>

                <button
                  onClick={() => onAddMachine(client.id)}
                  title="Adicionar Terminal / Máquina"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  <PlusCircle size={16} />
                </button>

                <button
                  onClick={() => onDeleteClient(client.id, client.business_name)}
                  title="Excluir Cliente"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Lista de Máquinas do Cliente */}
            <div className="pt-4 space-y-3">
              {!hasLicenses ? (
                <div className="text-xs text-slate-500 italic p-3 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 flex items-center justify-between">
                  <span>Nenhuma máquina vinculada a este estabelecimento ainda.</span>
                  <button
                    onClick={() => onAddMachine(client.id)}
                    className="text-indigo-400 hover:underline font-semibold"
                  >
                    + Vincular ID da Máquina
                  </button>
                </div>
              ) : (
                client.licenses!.map((lic) => {
                  const isRenewing = renewingId === lic.machine_id;

                  return (
                    <div
                      key={lic.id}
                      className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      {/* Dados da Máquina */}
                      <div className="flex items-start md:items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-800 text-slate-300 shrink-0">
                          <Monitor size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-slate-200">
                              {lic.machine_name || 'Terminal Principal'}
                            </span>
                            {getStatusBadge(lic)}
                          </div>

                          {/* Machine ID com Copiar */}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] text-slate-400 uppercase font-mono">ID:</span>
                            <code className="text-xs font-mono font-bold text-indigo-300 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-500/30 select-all">
                              {lic.machine_id}
                            </code>
                            <button
                              onClick={() => handleCopy(lic.machine_id, lic.id)}
                              title="Copiar ID da Máquina"
                              className="text-slate-400 hover:text-white transition-colors"
                            >
                              {copiedId === lic.id ? (
                                <Check size={14} className="text-emerald-400" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>

                          <div className="text-[11px] text-slate-400 mt-1 flex gap-3">
                            <span>Validade: <strong className="text-slate-300">{formatDate(lic.expires_at)}</strong></span>
                            {lic.last_check_in && (
                              <span>Último Acesso: {formatDate(lic.last_check_in)}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botões de Ação da Máquina */}
                      <div className="flex items-center gap-2 flex-wrap self-end md:self-center">
                        {/* ⚡ RENOVAR +30 DIAS (1 CLIQUE AO RECEBER COMPROVANTE) */}
                        <button
                          onClick={() => handleQuickRenewClick(lic.machine_id, client.business_name)}
                          disabled={isRenewing}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                        >
                          {isRenewing ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : (
                            <Zap size={14} className="fill-current" />
                          )}
                          Renovar +30d
                        </button>

                        {/* Renovação Personalizada */}
                        <button
                          onClick={() => onOpenRenewModal(lic, client)}
                          title="Opções detalhadas de renovação"
                          className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                        >
                          Mais Dias...
                        </button>

                        {/* Chave Offline (WhatsApp) */}
                        <button
                          onClick={() => onOpenOfflineKey(lic, client)}
                          title="Gerar Chave de Ativação Offline"
                          className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold transition-colors"
                        >
                          <Key size={13} />
                          Chave Offline
                        </button>

                        {/* Bloquear / Desbloquear */}
                        <button
                          onClick={() => onToggleBlock(lic.machine_id)}
                          title={lic.status === 'BLOCKED' ? 'Desbloquear máquina' : 'Bloquear máquina'}
                          className={`p-2 rounded-xl border text-xs transition-colors ${
                            lic.status === 'BLOCKED'
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-rose-400'
                          }`}
                        >
                          <Ban size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
