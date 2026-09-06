import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, AlertTriangle, Key, Building2, UploadCloud, MapPin, CheckCircle, XCircle, Wifi, Loader2 } from 'lucide-react';
import { api } from '../services/api';

// Algoritmo de validação oficial do CNPJ (dois dígitos verificadores)
function validarCNPJ(cnpj: string): boolean {
  const nums = cnpj.replace(/\D/g, '');
  if (nums.length !== 14) return false;
  if (/^(\d)\1+$/.test(nums)) return false; // todos iguais (00000000000000, etc.)
  const calc = (n: string, weights: number[]) =>
    weights.reduce((acc, w, i) => acc + parseInt(n[i]) * w, 0);
  const mod11 = (n: number) => (n % 11 < 2 ? 0 : 11 - (n % 11));
  const d1 = mod11(calc(nums, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  const d2 = mod11(calc(nums, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  return d1 === parseInt(nums[12]) && d2 === parseInt(nums[13]);
}

// Aplica máscara XX.XXX.XXX/XXXX-XX
function mascaraCNPJ(value: string): string {
  const nums = value.replace(/\D/g, '').slice(0, 14);
  return nums
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export const FiscalSettingsView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [settings, setSettings] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState('');
  const [cnpjValid, setCnpjValid] = useState<boolean | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validateResult, setValidateResult] = useState<any>(null);

  useEffect(() => {
    setIsLoading(true);
    fetch(api.getApiUrl() + '/fiscal/settings')
      .then(r => r.json())
      .then(data => {
        setSettings(data || {});
        if (data?.cnpj) setCnpjValid(validarCNPJ(data.cnpj));
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleChange = (field: string, value: string) => {
    setSettings((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleCnpjChange = (raw: string) => {
    const masked = mascaraCNPJ(raw);
    handleChange('cnpj', masked);
    const nums = masked.replace(/\D/g, '');
    if (nums.length < 14) {
      setCnpjValid(null); // ainda digitando
    } else {
      setCnpjValid(validarCNPJ(masked));
    }
  };

  const handleSave = async () => {
    if (settings.cnpj && cnpjValid === false) {
      alert('CNPJ inválido! Verifique os dígitos antes de salvar.');
      return;
    }
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('settings', JSON.stringify(settings));
      if (certFile) formData.append('certificado', certFile);
      if (certPassword) formData.append('certPassword', certPassword);

      const res = await fetch(api.getApiUrl() + '/fiscal/settings', {
        method: 'PUT',
        body: formData
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

  const handleValidate = async () => {
    setIsValidating(true);
    setValidateResult(null);
    try {
      const res = await fetch(api.getApiUrl() + '/fiscal/validate-api');
      const data = await res.json();
      setValidateResult(data);
    } catch {
      setValidateResult({ ok: false, error: 'Sem resposta do servidor. Verifique se o BarERP está rodando.' });
    } finally {
      setIsValidating(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-slate-400">Carregando...</div>;

  return (
    <div className="space-y-4 max-w-4xl mx-auto pt-4 pb-20">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={handleValidate}
            disabled={isValidating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-50"
          >
            {isValidating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Testando...</>
            ) : (
              <><Wifi className="w-4 h-4 text-sky-400" /> Testar Conexão</>
            )}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || cnpjValid === false}
            title={cnpjValid === false ? 'CNPJ inválido — corrija antes de salvar' : ''}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed ${
              cnpjValid === false
                ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                : 'bg-indigo-500 hover:bg-indigo-400 text-white'
            }`}
          >
            <Save className="w-5 h-5" />
            {isSaving ? 'Salvando...' : 'Cadastrar Dados da Empresa'}
          </button>
        </div>
      </div>

      {/* Painel de resultado do teste de conexão */}
      {validateResult && (
        <div className={`border rounded-2xl p-4 flex flex-col gap-3 ${
          validateResult.ok
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-center gap-2">
            {validateResult.ok
              ? <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              : <XCircle className="w-5 h-5 text-red-400 shrink-0" />
            }
            <span className={`font-bold text-sm ${validateResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {validateResult.ok ? 'Conexão com a Focus NFe: OK' : 'Falha na Conexão'}
            </span>
            {validateResult.ambiente && (
              <span className="ml-auto text-xs text-slate-400">{validateResult.ambiente}</span>
            )}
          </div>
          {validateResult.ok && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
              <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800">
                <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Empresas na Conta</p>
                <p className="font-bold text-white">{validateResult.totalEmpresas} empresa(s)</p>
              </div>
              <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800">
                <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Status do CNPJ</p>
                <p className="font-bold text-white leading-snug">{validateResult.empresaCadastrada}</p>
              </div>
            </div>
          )}
          {!validateResult.ok && (
            <p className="text-sm text-red-300 leading-relaxed">{validateResult.error}</p>
          )}
        </div>
      )}

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
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Razão Social</label>
              <input
                type="text"
                value={settings.razaoSocial || ''}
                onChange={e => handleChange('razaoSocial', e.target.value)}
                placeholder="Razão Social exata do CNPJ"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nome Fantasia</label>
              <input
                type="text"
                value={settings.nomeFantasia || ''}
                onChange={e => handleChange('nomeFantasia', e.target.value)}
                placeholder="Opcional"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-400 uppercase">CNPJ</label>
                {cnpjValid === true && (
                  <span className="flex items-center gap-1 text-[10px] font-black text-emerald-400">
                    <CheckCircle className="w-3 h-3" /> CNPJ Válido
                  </span>
                )}
                {cnpjValid === false && (
                  <span className="flex items-center gap-1 text-[10px] font-black text-red-400">
                    <XCircle className="w-3 h-3" /> CNPJ Inválido
                  </span>
                )}
              </div>
              <input
                type="text"
                value={settings.cnpj || ''}
                onChange={e => handleCnpjChange(e.target.value)}
                placeholder="00.000.000/0000-00"
                maxLength={18}
                className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-white font-mono outline-none transition ${
                  cnpjValid === true
                    ? 'border-emerald-500 focus:border-emerald-400'
                    : cnpjValid === false
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-slate-800 focus:border-indigo-500'
                }`}
              />
              {cnpjValid === false && (
                <p className="text-xs text-red-400 mt-1.5 font-bold">
                  ⚠️ Dígitos verificadores incorretos. Verifique o CNPJ.
                </p>
              )}
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
