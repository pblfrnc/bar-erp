import React, { useState, useEffect } from 'react';
import { X, Key, Copy, Check, MessageCircle, ShieldCheck } from 'lucide-react';
import { LicenseRecord, ClientRecord } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  license: LicenseRecord | null;
  client: ClientRecord | null;
  initialKey?: string;
}

export function OfflineKeyModal({ isOpen, onClose, license, client, initialKey }: Props) {
  const [offlineKey, setOfflineKey] = useState(initialKey || '');
  const [loading, setLoading] = useState(!initialKey);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && license && !initialKey) {
      setLoading(true);
      fetch(`/api/admin/licenses/offline-key/${license.machine_id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.offlineKey) {
            setOfflineKey(data.offlineKey);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else if (initialKey) {
      setOfflineKey(initialKey);
    }
  }, [isOpen, license, initialKey]);

  if (!isOpen || !license || !client) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(offlineKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    const cleanPhone = client.phone.replace(/\D/g, '');
    const text = `Olá, tudo bem? Segue a chave de ativação offline do Bar ERP para o *${client.business_name}*:\n\n🔑 *CHAVE DE ATIVAÇÃO:*\n\`${offlineKey}\`\n\n📌 *Instruções:* No Bar ERP, clique em "Ativar com Chave Offline", cole o código acima e clique em "Ativar".\n\nSeu sistema será desbloqueado na hora! 🚀`;
    const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const expDateFormatted = new Date(license.expires_at).toLocaleDateString('pt-BR');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Key size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Chave Offline</h2>
              <p className="text-xs text-slate-400">{client.business_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-300 flex items-start gap-2.5">
            <ShieldCheck size={18} className="shrink-0 mt-0.5" />
            <span>
              Use esta chave caso o bar do cliente esteja temporariamente sem internet. Ela é criptografada e vinculada estritamente ao ID desta máquina até <strong>{expDateFormatted}</strong>.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Chave de Liberação Criptografada
            </label>
            <div className="relative">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-center text-base sm:text-lg font-extrabold text-amber-400 tracking-wider select-all break-all shadow-inner">
                {loading ? 'Gerando chave...' : offlineKey}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              {copied ? 'Copiado!' : 'Copiar Chave'}
            </button>

            <button
              onClick={handleSendWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-colors"
            >
              <MessageCircle size={16} />
              Enviar no WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
