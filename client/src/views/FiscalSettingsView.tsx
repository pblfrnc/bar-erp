import React, { useState, useEffect } from 'react';
import { Settings, FileText, ArrowLeft, Save, Building2, Key, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

interface FiscalSettingsViewProps {
  onBack: () => void;
}

export const FiscalSettingsView: React.FC<FiscalSettingsViewProps> = ({ onBack }) => {
  const [settings, setSettings] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    fetch(api.getApiUrl() + '/fiscal/settings')
      .then(r => r.json())
      .then(data => {
        setSettings(data || {});
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleChange = (field: string, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(api.getApiUrl() + '/fiscal/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error('Erro ao salvar.');
      alert('Configurações Fiscais salvas com sucesso!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-slate-400">Carregando...</div>;

  return (
    <div className="space-y-4 max-w-3xl mx-auto pt-4 pb-20">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
        </button>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white px-5 py-2.5 rounded-xl font-bold transition disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>

      <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-3xl p-5 mb-6 flex items-start gap-4">
        <AlertTriangle className="w-6 h-6 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-base font-bold text-indigo-400 mb-1">Integração API (Focus NFe)</h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            Para emitir cupons fiscais (NFC-e), você precisa criar uma conta gratuita na Focus NFe (homologação) e colar o seu <strong>Token de API</strong> abaixo. O Certificado Digital A1 deve ser anexado diretamente no painel deles.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* API Credentials */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Key className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-bold text-white">Credenciais da API</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Token da API (Produção ou Homologação)</label>
              <input
                type="text"
                value={settings.apiToken || ''}
                onChange={e => handleChange('apiToken', e.target.value)}
                placeholder="Ex: tok_1234567890abcdef..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* Dados da Empresa */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Building2 className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-bold text-white">Dados da sua Empresa (Emitente)</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">CNPJ</label>
              <input
                type="text"
                value={settings.cnpj || ''}
                onChange={e => handleChange('cnpj', e.target.value)}
                placeholder="Apenas números"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Inscrição Estadual (IE)</label>
              <input
                type="text"
                value={settings.ie || ''}
                onChange={e => handleChange('ie', e.target.value)}
                placeholder="Apenas números ou ISENTO"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Regime Tributário (CRT)</label>
              <select
                value={settings.crt || ''}
                onChange={e => handleChange('crt', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition"
              >
                <option value="">Selecione...</option>
                <option value="1">Simples Nacional (1)</option>
                <option value="2">Simples Nacional - Excesso Receita (2)</option>
                <option value="3">Regime Normal (3)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">ID do CSC</label>
              <input
                type="text"
                value={settings.cscId || ''}
                onChange={e => handleChange('cscId', e.target.value)}
                placeholder="000001"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Código de Segurança do Contribuinte (CSC)</label>
              <input
                type="text"
                value={settings.cscSecret || ''}
                onChange={e => handleChange('cscSecret', e.target.value)}
                placeholder="Alfanumérico fornecido pela SEFAZ"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
