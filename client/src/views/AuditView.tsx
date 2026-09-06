import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ShieldAlert, Clock, Info } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  description: string;
  createdAt: string;
}

export const AuditView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 max-w-6xl mx-auto">
      {/* Cabeçalho */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Auditoria Cega</h2>
            <p className="text-xs text-slate-400">
              Histórico seguro de remoção de itens, descontos e ações do sistema
            </p>
          </div>
        </div>
        <button
          onClick={loadLogs}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
        >
          Atualizar
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Carregando logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm flex flex-col items-center gap-3">
            <Info className="w-8 h-8 opacity-20" />
            Nenhuma atividade sensível registrada ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-xs uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4 font-bold">Data/Hora</th>
                  <th className="py-3 px-4 font-bold">Ação</th>
                  <th className="py-3 px-4 font-bold">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-850/50 transition">
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-600" />
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        log.action === 'CANCEL_ITEM' ? 'bg-red-500/10 text-red-400' :
                        log.action === 'APPLY_DISCOUNT' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-white font-mono text-xs">
                      {log.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
