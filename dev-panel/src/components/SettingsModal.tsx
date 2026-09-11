import React, { useState, useEffect } from 'react';
import { X, Settings, Check, Smartphone, DollarSign, QrCode } from 'lucide-react';
import { DevSettings } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SettingsModal({ isOpen, onClose, onSuccess }: Props) {
  const [settings, setSettings] = useState<DevSettings>({});
  const [developerName, setDeveloperName] = useState('');
  const [developerPhone, setDeveloperPhone] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [defaultFee, setDefaultFee] = useState('150.00');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/admin/settings')
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.settings) {
            setSettings(data.settings);
            setDeveloperName(data.settings.developer_name || '');
            setDeveloperPhone(data.settings.developer_phone || '');
            setPixKey(data.settings.pix_key || '');
            setDefaultFee(data.settings.default_monthly_fee || '150.00');
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          developer_name: developerName,
          developer_phone: developerPhone,
          pix_key: pixKey,
          default_monthly_fee: defaultFee,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || 'Erro ao salvar configurações');
      }
    } catch {
      setError('Erro de conexão ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Settings size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Configurações da Software House</h2>
              <p className="text-xs text-slate-400">Dados exibidos aos clientes para pagamento</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Nome da Software House / Desenvolvedor
            </label>
            <input
              type="text"
              required
              value={developerName}
              onChange={(e) => setDeveloperName(e.target.value)}
              placeholder="Ex: Pablo Franco - Bar ERP Pro"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Smartphone size={14} className="text-emerald-400" />
              WhatsApp para Receber Comprovantes
            </label>
            <input
              type="text"
              required
              value={developerPhone}
              onChange={(e) => setDeveloperPhone(e.target.value)}
              placeholder="Ex: 5591988887777 (com DDD)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              O Bar ERP usará este número no botão "Enviar Comprovante e ID da Máquina".
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
              <QrCode size={14} className="text-indigo-400" />
              Chave PIX para Mensalidades
            </label>
            <input
              type="text"
              required
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="Ex: 36.275.163/0001-24 ou email ou telefone"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Valor Padrão da Mensalidade (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={defaultFee}
              onChange={(e) => setDefaultFee(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Check size={18} />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
