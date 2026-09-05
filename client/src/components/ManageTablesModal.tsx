import React, { useState } from 'react';
import { Table } from '../types';
import { api } from '../services/api';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  FolderEdit,
  Check,
  MapPin,
  Users
} from 'lucide-react';

interface ManageTablesModalProps {
  tables: Table[];
  onClose: () => void;
  onSuccess: () => void;
}

export const ManageTablesModal: React.FC<ManageTablesModalProps> = ({
  tables,
  onClose,
  onSuccess
}) => {
  // Lista única de locais/setores existentes
  const existingSections = Array.from(new Set(tables.map((t) => t.section))).filter(Boolean);

  // Estados de edição de mesa individual
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState<number>(1);
  const [editName, setEditName] = useState<string>('');
  const [editCapacity, setEditCapacity] = useState<number>(4);
  const [editSection, setEditSection] = useState<string>('');

  // Estados de renomeação de local
  const [renamingSection, setRenamingSection] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState<string>('');

  // Estados de nova mesa rápida
  const [isAddingTable, setIsAddingTable] = useState<boolean>(false);
  const [newNumber, setNewNumber] = useState<number>(() => {
    const maxNum = tables.reduce((max, t) => Math.max(max, t.number), 0);
    return maxNum + 1;
  });
  const [newName, setNewName] = useState<string>('');
  const [newCapacity, setNewCapacity] = useState<number>(4);
  const [newSection, setNewSection] = useState<string>(existingSections[0] || 'Salão Principal');
  const [customSectionInput, setCustomSectionInput] = useState<string>('');

  // Estado de carregamento e mensagens
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Iniciar edição de uma mesa
  const handleStartEdit = (t: Table) => {
    setEditingTableId(t.id);
    setEditNumber(t.number);
    setEditName(t.name || '');
    setEditCapacity(t.capacity);
    setEditSection(t.section);
    setErrorMsg(null);
  };

  // Salvar edição da mesa
  const handleSaveEdit = async () => {
    if (!editingTableId) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      await api.updateTable(editingTableId, {
        number: editNumber,
        name: editName || `Mesa ${editNumber}`,
        capacity: editCapacity,
        section: editSection
      });
      setEditingTableId(null);
      setSuccessMsg('Mesa atualizada com sucesso!');
      setTimeout(() => setSuccessMsg(null), 3000);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao atualizar mesa');
    } finally {
      setLoading(false);
    }
  };

  // Renomear local/setor
  const handleRenameSection = async (oldSec: string) => {
    if (!newSectionName.trim() || newSectionName.trim() === oldSec) {
      setRenamingSection(null);
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      await api.renameSection(oldSec, newSectionName.trim());
      setRenamingSection(null);
      setNewSectionName('');
      setSuccessMsg(`Local renomeado para "${newSectionName.trim()}"!`);
      setTimeout(() => setSuccessMsg(null), 3000);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao renomear local');
    } finally {
      setLoading(false);
    }
  };

  // Excluir mesa
  const handleDeleteTable = async (t: Table) => {
    if (t.status !== 'AVAILABLE') {
      alert('Não é possível excluir uma mesa que está ocupada.');
      return;
    }
    if (!window.confirm(`Tem certeza que deseja excluir permanentemente a Mesa ${t.number}?`)) {
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      await api.deleteTable(t.id);
      setSuccessMsg(`Mesa ${t.number} excluída!`);
      setTimeout(() => setSuccessMsg(null), 3000);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao excluir mesa');
    } finally {
      setLoading(false);
    }
  };

  // Criar nova mesa
  const handleCreateTable = async () => {
    const finalSection = customSectionInput.trim() || newSection;
    try {
      setLoading(true);
      setErrorMsg(null);
      await api.createTable({
        number: newNumber,
        name: newName || `Mesa ${newNumber}`,
        capacity: newCapacity,
        section: finalSection
      });
      setIsAddingTable(false);
      setCustomSectionInput('');
      setNewNumber(newNumber + 1);
      setNewName('');
      setSuccessMsg(`Mesa ${newNumber} criada com sucesso em "${finalSection}"!`);
      setTimeout(() => setSuccessMsg(null), 3000);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao criar mesa');
    } finally {
      setLoading(false);
    }
  };

  // Agrupar mesas por local
  const tablesBySection: Record<string, Table[]> = {};
  tables.forEach((t) => {
    const sec = t.section || 'Salão Principal';
    if (!tablesBySection[sec]) tablesBySection[sec] = [];
    tablesBySection[sec].push(t);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Editar Locais & Mesas</h2>
              <p className="text-xs text-slate-400">
                Organize os setores do bar, crie novos locais e mova ou edite cada mesa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notificações e Feedback */}
        {errorMsg && (
          <div className="bg-rose-500/10 border-b border-rose-500/30 px-4 py-2 text-rose-400 text-xs font-semibold flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="hover:underline">Fechar</button>
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-4 py-2 text-emerald-400 text-xs font-semibold">
            {successMsg}
          </div>
        )}

        {/* Ações Rápidas do Topo */}
        <div className="p-3 bg-slate-950/50 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-bold text-slate-200">{tables.length}</span> mesas cadastradas em{' '}
            <span className="font-bold text-amber-400">{Object.keys(tablesBySection).length}</span> setores
          </div>
          <button
            onClick={() => setIsAddingTable(!isAddingTable)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition active:scale-95 shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Adicionar Nova Mesa</span>
          </button>
        </div>

        {/* Formulário de Adicionar Nova Mesa */}
        {isAddingTable && (
          <div className="p-4 bg-slate-800/40 border-b border-amber-500/30 space-y-3">
            <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Cadastrar Nova Mesa
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Número:</label>
                <input
                  type="number"
                  min={1}
                  value={newNumber}
                  onChange={(e) => setNewNumber(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Nome/Identificação:</label>
                <input
                  type="text"
                  placeholder={`Mesa ${newNumber}`}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Capacidade (Lugares):</label>
                <input
                  type="number"
                  min={1}
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Local / Setor:</label>
                <select
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-semibold"
                >
                  {existingSections.map((sec) => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                  <option value="__NEW__">+ Criar Novo Setor...</option>
                </select>
              </div>
            </div>

            {newSection === '__NEW__' && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Digite o nome do novo setor (ex: Deck Superior, Piscina, Área VIP)"
                  value={customSectionInput}
                  onChange={(e) => setCustomSectionInput(e.target.value)}
                  className="flex-1 bg-slate-900 border border-amber-500/50 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 font-semibold"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingTable(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateTable}
                disabled={loading}
                className="px-4 py-1.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 transition active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Salvando...' : 'Salvar Mesa'}
              </button>
            </div>
          </div>
        )}

        {/* Lista de Locais e Mesas */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {Object.entries(tablesBySection).map(([sectionName, sectionTables]) => {
            const isRenamingThis = renamingSection === sectionName;

            return (
              <div key={sectionName} className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-3">
                {/* Cabeçalho do Setor com Renomeação */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  {isRenamingThis ? (
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                      <input
                        type="text"
                        defaultValue={sectionName}
                        onChange={(e) => setNewSectionName(e.target.value)}
                        className="flex-1 bg-slate-900 border border-amber-500 rounded-lg px-2 py-1 text-sm font-bold text-white outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRenameSection(sectionName)}
                        className="p-1.5 rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                        title="Confirmar novo nome"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                      </button>
                      <button
                        onClick={() => setRenamingSection(null)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                      <h3 className="text-sm font-black text-white">{sectionName}</h3>
                      <span className="text-[11px] font-semibold text-slate-400">
                        ({sectionTables.length} {sectionTables.length === 1 ? 'mesa' : 'mesas'})
                      </span>
                      <button
                        onClick={() => {
                          setRenamingSection(sectionName);
                          setNewSectionName(sectionName);
                        }}
                        className="p-1 rounded text-slate-500 hover:text-amber-400 transition"
                        title="Renomear este setor/local"
                      >
                        <FolderEdit className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Grid de Mesas no Setor */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {sectionTables.map((table) => {
                    const isEditing = editingTableId === table.id;

                    if (isEditing) {
                      return (
                        <div
                          key={table.id}
                          className="bg-slate-900 border border-amber-500 rounded-xl p-3 space-y-2.5 shadow-lg"
                        >
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-400 block">Número:</label>
                              <input
                                type="number"
                                value={editNumber}
                                onChange={(e) => setEditNumber(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-bold text-white"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 block">Lugares:</label>
                              <input
                                type="number"
                                value={editCapacity}
                                onChange={(e) => setEditCapacity(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-bold text-white"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 block">Nome:</label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 block">Mover para Setor:</label>
                            <input
                              type="text"
                              value={editSection}
                              onChange={(e) => setEditSection(e.target.value)}
                              list="sections-list"
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-semibold text-amber-300"
                            />
                            <datalist id="sections-list">
                              {existingSections.map((s) => (
                                <option key={s} value={s} />
                              ))}
                            </datalist>
                          </div>

                          <div className="flex justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingTableId(null)}
                              className="px-2 py-1 rounded text-xs text-slate-400 hover:text-white"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              disabled={loading}
                              className="px-3 py-1 rounded text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950"
                            >
                              Salvar
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={table.id}
                        className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between hover:border-slate-700 transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-black text-sm text-amber-400 border border-slate-700">
                            {table.number}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white leading-tight">{table.name}</p>
                            <p className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {table.capacity} lugares •{' '}
                              <span className={table.status === 'OCCUPIED' ? 'text-blue-400' : 'text-emerald-400'}>
                                {table.status === 'OCCUPIED' ? 'Ocupada' : 'Livre'}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(table)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition"
                            title="Editar número, nome ou setor da mesa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {table.status === 'AVAILABLE' && (
                            <button
                              onClick={() => handleDeleteTable(table)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                              title="Excluir mesa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-black bg-slate-800 hover:bg-slate-700 text-white transition active:scale-95"
          >
            Concluir Edição
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageTablesModal;
