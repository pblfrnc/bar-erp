import React, { useState, useEffect } from 'react';
import { StaffMember } from '../types';
import { api } from '../services/api';
import {
  X,
  UserPlus,
  ShieldCheck,
  Check,
  Trash2,
  Edit2,
  AlertCircle,
  Key,
  Users,
  Lock,
  Sparkles,
  LayoutGrid,
  ChefHat,
  Receipt,
  UtensilsCrossed,
  FileText,
  Settings,
  BarChart3,
  Truck
} from 'lucide-react';

interface ManageStaffModalProps {
  onClose: () => void;
  onStaffChanged?: () => void;
}

const AVAILABLE_MODULES = [
  { id: 'tables', label: 'Mesas & Salão', icon: LayoutGrid, desc: 'Abertura, consumo e fechamento de mesas' },
  { id: 'kds', label: 'KDS (Cozinha/Bar)', icon: ChefHat, desc: 'Painel de produção de pedidos e comandas' },
  { id: 'cash', label: 'Caixa & PDV', icon: Receipt, desc: 'Operação de caixa, vendas rápidas e fechamento' },
  { id: 'products', label: 'Cardápio & Estoque', icon: UtensilsCrossed, desc: 'Cadastro de produtos, preços e receitas' },
  { id: 'fiscal', label: 'Módulo Fiscal', icon: FileText, desc: 'Emissão e cancelamento de NFC-e' },
  { id: 'settings', label: 'Retaguarda', icon: Settings, desc: 'Painel de administração e configurações' },
  { id: 'dashboard', label: 'Métricas & Gestão', icon: BarChart3, desc: 'Faturamento, relatórios e auditoria' },
  { id: 'customers', label: 'Clientes (Fiado)', icon: Users, desc: 'Cadastro de clientes e saldos devedores' },
  { id: 'suppliers', label: 'Fornecedores', icon: Truck, desc: 'Cadastro de fornecedores e compras' }
];

export const ManageStaffModal: React.FC<ManageStaffModalProps> = ({
  onClose,
  onStaffChanged
}) => {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  // Formulário
  const [name, setName] = useState('');
  const [role, setRole] = useState('CAIXA');
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(true);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['tables', 'cash']);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadStaff = async () => {
    try {
      setLoading(true);
      const data = await api.getStaffList();
      setStaffList(data);
    } catch (err: any) {
      console.error('Erro ao carregar equipe:', err);
      setError('Não foi possível carregar a lista de funcionários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleStartEdit = (staff: StaffMember) => {
    setEditingStaff(staff);
    setName(staff.name);
    setRole(staff.role);
    setPassword(''); // deixa em branco se não quiser alterar
    setActive(staff.active);
    setSelectedPermissions(staff.permissions || []);
    setError(null);
    setSuccessMsg(null);
  };

  const handleCancelEdit = () => {
    setEditingStaff(null);
    setName('');
    setRole('CAIXA');
    setPassword('');
    setActive(true);
    setSelectedPermissions(['tables', 'cash']);
    setError(null);
    setSuccessMsg(null);
  };

  const togglePermission = (modId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(modId) ? prev.filter((p) => p !== modId) : [...prev, modId]
    );
  };

  const applyPreset = (preset: 'ALL' | 'CAIXA' | 'GARCOM' | 'KDS') => {
    if (preset === 'ALL') {
      setSelectedPermissions(AVAILABLE_MODULES.map((m) => m.id));
    } else if (preset === 'CAIXA') {
      setSelectedPermissions(['tables', 'cash', 'customers']);
    } else if (preset === 'GARCOM') {
      setSelectedPermissions(['tables']);
    } else if (preset === 'KDS') {
      setSelectedPermissions(['kds']);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Informe o nome do funcionário');
      return;
    }

    if (!editingStaff && !password.trim()) {
      setError('Defina uma senha ou PIN de acesso para o novo funcionário');
      return;
    }

    if (selectedPermissions.length === 0) {
      setError('Selecione pelo menos uma função permitida para este usuário');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (editingStaff) {
        await api.updateStaff(editingStaff.id, {
          name: name.trim(),
          role,
          password: password.trim() ? password.trim() : undefined,
          permissions: selectedPermissions,
          active
        });
        setSuccessMsg(`Colaborador "${name}" atualizado com sucesso!`);
      } else {
        await api.createStaff({
          name: name.trim(),
          role,
          password: password.trim(),
          permissions: selectedPermissions,
          active
        });
        setSuccessMsg(`Novo funcionário "${name}" cadastrado com sucesso!`);
      }

      handleCancelEdit();
      await loadStaff();
      onStaffChanged?.();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar funcionário');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (staff: StaffMember) => {
    if (!confirm(`Deseja realmente excluir o funcionário "${staff.name}"?`)) return;
    try {
      await api.deleteStaff(staff.id);
      await loadStaff();
      onStaffChanged?.();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                Equipe & Permissões de Acesso
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cadastre colaboradores e defina exatamente quais módulos cada um tem autorização para operar.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagens de Status */}
        {error && (
          <div className="m-4 mb-0 p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-2 text-xs text-red-600 dark:text-red-400 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="m-4 mb-0 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LADO ESQUERDO: Formulário (5 colunas) */}
          <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4.5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4" />
                {editingStaff ? 'Editar Colaborador' : 'Novo Colaborador'}
              </span>
              {editingStaff && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white underline cursor-pointer"
                >
                  Cancelar Edição
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Nome */}
              <div>
                <label htmlFor="staff-name-input" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1 cursor-pointer">
                  Nome Completo *
                </label>
                <input
                  id="staff-name-input"
                  type="text"
                  required
                  placeholder="Ex: Carlos Silva, Ana Caixa..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-amber-500 focus:outline-none cursor-text font-medium placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>

              {/* Cargo / Função */}
              <div>
                <label htmlFor="staff-role-select" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1 cursor-pointer">
                  Função Principal / Cargo *
                </label>
                <select
                  id="staff-role-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-amber-500 focus:outline-none cursor-pointer font-bold"
                >
                  <option value="ADMIN">Administrador (Acesso Total)</option>
                  <option value="GERENTE">Gerente de Turno</option>
                  <option value="CAIXA">Operador de Caixa / PDV</option>
                  <option value="GARCOM">Atendente / Garçom</option>
                  <option value="COZINHA">Cozinha / Bar KDS</option>
                  <option value="ESTOQUISTA">Estoquista / Compras</option>
                  <option value="FISCAL">Operador Fiscal</option>
                </select>
              </div>

              {/* Senha / PIN */}
              <div>
                <label htmlFor="staff-password-input" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1 cursor-pointer">
                  {editingStaff ? 'Nova Senha / PIN (Deixe em branco p/ manter)' : 'Senha ou PIN de Acesso *'}
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="staff-password-input"
                    type="text"
                    placeholder="Ex: 1234 ou senha forte"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-sm focus:border-amber-500 focus:outline-none cursor-text placeholder-slate-400 dark:placeholder-slate-500"
                  />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                  Pode ser um PIN numérico rápido (ex: 4 dígitos) para facilitar no touchscreen.
                </span>
              </div>

              {/* Status Ativo / Inativo */}
              <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
                <div>
                  <label htmlFor="staff-status-active" className="text-xs font-bold text-slate-800 dark:text-slate-200 block cursor-pointer">
                    Colaborador Ativo
                  </label>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Se desativado, o login no sistema será bloqueado.
                  </span>
                </div>
                <input
                  id="staff-status-active"
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                />
              </div>

              {/* Presets Rápidos de Permissões */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">
                    Módulos Liberados:
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => applyPreset('ALL')}
                      className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25 font-bold transition cursor-pointer"
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('CAIXA')}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition cursor-pointer"
                    >
                      Caixa
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('GARCOM')}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition cursor-pointer"
                    >
                      Garçom
                    </button>
                  </div>
                </div>

                {/* Grid de Permissões */}
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {AVAILABLE_MODULES.map((mod) => {
                    const Icon = mod.icon;
                    const isChecked = selectedPermissions.includes(mod.id);
                    return (
                      <label
                        key={mod.id}
                        htmlFor={`perm-${mod.id}`}
                        className={`flex items-center justify-between p-2 rounded-xl border transition cursor-pointer ${
                          isChecked
                            ? 'bg-amber-500/10 border-amber-500/40 text-slate-900 dark:text-white'
                            : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800/70 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className={`w-4 h-4 ${isChecked ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`} />
                          <div>
                            <div className="text-xs font-bold leading-tight">{mod.label}</div>
                            <div className="text-[10px] text-slate-500 leading-tight">{mod.desc}</div>
                          </div>
                        </div>
                        <input
                          id={`perm-${mod.id}`}
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermission(mod.id)}
                          className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Botão Salvar */}
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-xl transition shadow-lg shadow-amber-500/10 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{editingStaff ? 'Salvar Alterações' : 'Cadastrar Colaborador'}</span>
              </button>
            </form>
          </div>

          {/* LADO DIREITO: Lista de Funcionários Cadastrados (7 colunas) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span>Colaboradores Cadastrados ({staffList.length})</span>
              </h3>
              <span className="text-[10px] text-slate-500">
                O primeiro usuário com cargo ADMIN não pode ser excluído
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">Carregando colaboradores...</div>
            ) : staffList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                Nenhum colaborador cadastrado. Crie o primeiro ao lado.
              </div>
            ) : (
              <div className="space-y-2.5">
                {staffList.map((staff) => (
                  <div
                    key={staff.id}
                    className={`p-3.5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      editingStaff?.id === staff.id
                        ? 'bg-amber-500/10 border-amber-500/40 shadow-md'
                        : staff.active
                        ? 'bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-900 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 font-black text-sm shrink-0">
                        {staff.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{staff.name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            {staff.role}
                          </span>
                          {!staff.active && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-300">
                              Inativo
                            </span>
                          )}
                        </div>

                        {/* Badges de permissões ativas */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(staff.permissions || []).map((pId) => {
                            const found = AVAILABLE_MODULES.find((m) => m.id === pId);
                            if (!found) return null;
                            return (
                              <span
                                key={pId}
                                className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 font-medium"
                              >
                                {found.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(staff)}
                        className="p-2 text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                        title="Editar Colaborador"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(staff)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                        title="Excluir Colaborador"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
