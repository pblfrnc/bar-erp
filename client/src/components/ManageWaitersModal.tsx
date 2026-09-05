import React, { useState, useEffect } from 'react';
import { Waiter } from '../types';
import { api } from '../services/api';
import { X, UserPlus, Check, Trash2, Edit2, AlertCircle, Percent, ShieldCheck } from 'lucide-react';

interface ManageWaitersModalProps {
  onClose: () => void;
  onWaitersChanged?: () => void;
}

export const ManageWaitersModal: React.FC<ManageWaitersModalProps> = ({
  onClose,
  onWaitersChanged
}) => {
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [commissionRate, setCommissionRate] = useState<number>(10);
  const [saving, setSaving] = useState(false);
  const [editingWaiter, setEditingWaiter] = useState<Waiter | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadWaiters = async () => {
    try {
      setLoading(true);
      const data = await api.getWaiters(true); // carregar todos incluindo inativos
      setWaiters(data);
    } catch (err: any) {
      console.error('Erro ao carregar garçons:', err);
      setError('Não foi possível carregar a lista de garçons.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWaiters();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Informe o nome do garçom');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (editingWaiter) {
        await api.updateWaiter(editingWaiter.id, {
          name: name.trim(),
          code: code.trim() || undefined,
          commissionRate: commissionRate / 100
        });
      } else {
        await api.createWaiter({
          name: name.trim(),
          code: code.trim() || undefined,
          commissionRate: commissionRate / 100
        });
      }

      setName('');
      setCode('');
      setCommissionRate(10);
      setEditingWaiter(null);
      await loadWaiters();
      onWaitersChanged?.();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar garçom');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (waiter: Waiter) => {
    setEditingWaiter(waiter);
    setName(waiter.name);
    setCode(waiter.code || '');
    setCommissionRate(Math.round(waiter.commissionRate * 100));
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingWaiter(null);
    setName('');
    setCode('');
    setCommissionRate(10);
    setError(null);
  };

  const handleToggleActive = async (waiter: Waiter) => {
    try {
      await api.updateWaiter(waiter.id, { active: !waiter.active });
      await loadWaiters();
      onWaitersChanged?.();
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar status');
    }
  };

  const handleDelete = async (waiter: Waiter) => {
    if (!confirm(`Deseja remover ou desativar o garçom "${waiter.name}"?`)) return;
    try {
      await api.deleteWaiter(waiter.id);
      await loadWaiters();
      onWaitersChanged?.();
    } catch (err: any) {
      alert(err.message || 'Erro ao remover garçom');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Equipe de Garçons & Comissões
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cadastre os garçons para vincular às comandas e apurar os 10%
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerta de erro */}
        {error && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulário de Cadastro / Edição */}
        <form onSubmit={handleSubmit} className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" />
              {editingWaiter ? 'Editar Garçom' : 'Novo Garçom'}
            </span>
            {editingWaiter && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                Cancelar Edição
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                Nome do Garçom *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Carlos Silva"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                Crachá / Cód.
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: 01"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-bold text-center"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-amber-500" />
                Taxa de Serviço:
              </label>
              <input
                type="number"
                min="0"
                max="30"
                value={commissionRate}
                onChange={(e) => setCommissionRate(Number(e.target.value))}
                className="w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-center font-bold text-slate-900 dark:text-white"
              />
              <span className="text-xs text-slate-400 font-bold">%</span>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              {editingWaiter ? 'Salvar Alterações' : 'Cadastrar Garçom'}
            </button>
          </div>
        </form>

        {/* Lista de Garçons */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Garçons Cadastrados ({waiters.length})
          </div>

          {loading ? (
            <div className="text-center py-8 text-xs text-slate-400">Carregando garçons...</div>
          ) : waiters.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              Nenhum garçom cadastrado ainda. Use o formulário acima para adicionar.
            </div>
          ) : (
            waiters.map((w) => (
              <div
                key={w.id}
                className={`p-3 rounded-2xl border flex items-center justify-between transition ${
                  w.active
                    ? 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white'
                    : 'bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/60 opacity-60 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                    w.active ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                  }`}>
                    {w.code || w.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{w.name}</span>
                      {w.code && (
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-bold text-slate-500">
                          #{w.code}
                        </span>
                      )}
                      {!w.active && (
                        <span className="text-[10px] bg-red-500/10 text-red-500 font-bold px-1.5 py-0.5 rounded">
                          Inativo
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Taxa de repasse: <strong className="text-amber-500">{Math.round(w.commissionRate * 100)}%</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleActive(w)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      w.active
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-700'
                    }`}
                    title={w.active ? 'Clique para desativar' : 'Clique para reativar'}
                  >
                    {w.active ? 'Ativo' : 'Inativo'}
                  </button>
                  <button
                    onClick={() => handleStartEdit(w)}
                    className="p-1.5 text-slate-400 hover:text-amber-500 transition rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Editar garçom"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(w)}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Remover / Desativar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
