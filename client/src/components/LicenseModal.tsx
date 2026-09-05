import React, { useState } from 'react';
import { Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { getServerBaseUrl } from '../services/socket';

interface LicenseModalProps {
  machineId: string;
  onSuccess: () => void;
}

export function LicenseModal({ machineId, onSuccess }: LicenseModalProps) {
  const [email, setEmail] = useState('');
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // POST to /api/settings/license
      const res = await fetch(`${getServerBaseUrl()}/api/settings/license`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, key }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        setError(data.error || 'Chave inválida para este computador.');
      }
    } catch (err) {
      setError('Erro ao se conectar ao servidor. Verifique a rede.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-amber-500 text-white p-6 flex flex-col items-center justify-center text-center">
          <Lock size={48} className="mb-4 drop-shadow-md" />
          <h2 className="text-2xl font-bold">Ativação do Sistema</h2>
          <p className="text-amber-100 mt-2 font-medium">Este computador não possui uma licença ativa.</p>
        </div>
        
        <div className="p-6">
          <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg flex flex-col items-center justify-center mb-6 border border-slate-200 dark:border-slate-700">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider mb-1">ID da Máquina</span>
            <code className="text-sm text-slate-800 dark:text-slate-200 font-mono font-bold select-all">{machineId || 'Carregando...'}</code>
            <span className="text-[10px] text-slate-400 mt-1 text-center">Forneça este ID ao desenvolvedor para obter sua chave.</span>
          </div>

          {success ? (
            <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-4 rounded-xl flex items-center justify-center gap-3">
              <CheckCircle size={24} />
              <span className="font-bold">Licença ativada com sucesso!</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Registrado</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@bar.com.br"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Chave de Ativação</label>
                <input
                  type="text"
                  required
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="Cole sua chave aqui"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors"
                />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-start gap-2">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-md"
              >
                {loading ? 'Verificando...' : 'Ativar Licença'}
                {!loading && <Lock size={18} />}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
