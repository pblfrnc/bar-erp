import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, AlertTriangle, Key, Building2, UploadCloud, MapPin } from 'lucide-react';
import { api } from '../services/api';

export const FiscalSettingsView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [settings, setSettings] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState('');

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
    setSettings((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('settings', JSON.stringify(settings));
      if (certFile) formData.append('certificado', certFile);
      if (certPassword) formData.append('certPassword', certPassword);

      const res = await fetch(api.getApiUrl() + '/fiscal/settings', {
        method: 'PUT',
        body: formData // Note: FormData automatically sets multipart/form-data headers
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.mensagem || 'Erro ao salvar e ativar empresa.');
      
      alert('Configurações Fiscais salvas! A empresa está ativa na SEFAZ.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-slate-400">Carregando...</div>;

  return (
    <div className="space-y-4 max-w-4xl mx-auto pt-4 pb-20">
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
          {isSaving ? 'Salvando...' : 'Cadastrar Dados da Empresa'}
        </button>
      </div>

      

      <div className="space-y-6">
        {/* API Credentials */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Key className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-bold text-white">Token da API de Emissão</h3>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Token da API (Focus NFe)</label>
            <input
              type="text"
              value={settings.apiToken || ''}
              onChange={e => handleChange('apiToken', e.target.value)}
              placeholder="Cole o token da Focus NFe aqui..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition"
            />
          </div>
        </div>

        {/* Dados da Empresa */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Building2 className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-bold text-white">Dados da Empresa (Cliente)</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
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
                placeholder="Ex: ISENTO ou Número"
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
                <option value="1">Simples Nacional</option>
                <option value="2">Simples Nac. Excesso</option>
                <option value="3">Regime Normal</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 pt-4 border-t border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">ID do CSC</label>
              <input
                type="text"
                value={settings.cscId || ''}
                onChange={e => handleChange('cscId', e.target.value)}
                placeholder="Ex: 000001"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Código CSC (SEFAZ)</label>
              <input
                type="text"
                value={settings.cscSecret || ''}
                onChange={e => handleChange('cscSecret', e.target.value)}
                placeholder="Alfanumérico..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Ambiente SEFAZ</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-white cursor-pointer">
                  <input
                    type="radio"
                    name="env"
                    value="homologacao"
                    checked={settings.environment === 'homologacao' || !settings.environment}
                    onChange={e => handleChange('environment', e.target.value)}
                    className="w-4 h-4 text-emerald-500 bg-slate-900 border-slate-700"
                  />
                  <span>Homologação (Testes)</span>
                </label>
                <label className="flex items-center gap-2 text-white cursor-pointer">
                  <input
                    type="radio"
                    name="env"
                    value="producao"
                    checked={settings.environment === 'producao'}
                    onChange={e => handleChange('environment', e.target.value)}
                    className="w-4 h-4 text-amber-500 bg-slate-900 border-slate-700"
                  />
                  <span>Produção (Valendo)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4 pt-4 border-t border-slate-800">
            <MapPin className="w-5 h-5 text-indigo-400" />
            <h4 className="text-sm font-bold text-white uppercase">Endereço do Cliente (Obrigatório)</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">CEP</label>
              <input
                type="text"
                value={settings.cep || ''}
                onChange={e => handleChange('cep', e.target.value)}
                placeholder="00000000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Logradouro</label>
              <input
                type="text"
                value={settings.logradouro || ''}
                onChange={e => handleChange('logradouro', e.target.value)}
                placeholder="Rua, Avenida..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Número</label>
              <input
                type="text"
                value={settings.numero || ''}
                onChange={e => handleChange('numero', e.target.value)}
                placeholder="Ex: 123"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Bairro</label>
              <input
                type="text"
                value={settings.bairro || ''}
                onChange={e => handleChange('bairro', e.target.value)}
                placeholder="Centro"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Município</label>
              <input
                type="text"
                value={settings.municipio || ''}
                onChange={e => handleChange('municipio', e.target.value)}
                placeholder="Tailândia"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">UF</label>
              <input
                type="text"
                value={settings.uf || ''}
                onChange={e => handleChange('uf', e.target.value)}
                placeholder="PA"
                maxLength={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition uppercase"
              />
            </div>
          </div>
        </div>

        {/* Certificado A1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <UploadCloud className="w-5 h-5 text-sky-500" />
            <h3 className="text-lg font-bold text-white">Certificado Digital (A1)</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Arquivo .PFX do Cliente</label>
              <input
                type="file"
                accept=".pfx,.p12"
                onChange={e => setCertFile(e.target.files ? e.target.files[0] : null)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-4 py-2.5 focus:border-sky-500 outline-none transition file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-sky-500/10 file:text-sky-400 hover:file:bg-sky-500/20"
              />
              <p className="text-xs text-slate-500 mt-2">Só envie se for a primeira vez ou estiver atualizando.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Senha do Certificado</label>
              <input
                type="password"
                value={certPassword}
                onChange={e => setCertPassword(e.target.value)}
                placeholder="Senha do arquivo A1"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-sky-500 outline-none transition"
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
