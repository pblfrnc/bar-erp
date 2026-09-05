import React, { useState, useMemo } from 'react';
import { Table } from '../types';
import { TableCard } from '../components/TableCard';
import { OpenTableModal } from '../components/OpenTableModal';
import { TableDetailsModal } from '../components/TableDetailsModal';
import { AddOrderModal } from '../components/AddOrderModal';
import { CheckoutModal } from '../components/CheckoutModal';
import { TransferModal } from '../components/TransferModal';
import { MergeModal } from '../components/MergeModal';
import { ManageTablesModal } from '../components/ManageTablesModal';
import { api } from '../services/api';
import {
  LayoutGrid,
  Filter,
  Users,
  DollarSign,
  Clock,
  Plus,
  RefreshCw,
  Search,
  MapPin
} from 'lucide-react';

interface TablesViewProps {
  tables: Table[];
  onRefresh: () => void;
  loading: boolean;
}

export const TablesView: React.FC<TablesViewProps> = ({
  tables,
  onRefresh,
  loading
}) => {
  const [selectedSection, setSelectedSection] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modais
  const [tableToOpen, setTableToOpen] = useState<Table | null>(null);
  const [tableDetails, setTableDetails] = useState<Table | null>(null);
  const [tableForOrder, setTableForOrder] = useState<Table | null>(null);
  const [tableForCheckout, setTableForCheckout] = useState<Table | null>(null);
  const [tableForTransfer, setTableForTransfer] = useState<Table | null>(null);
  const [tableForMerge, setTableForMerge] = useState<Table | null>(null);

  // Modal para criar nova mesa
  const [showNewTableModal, setShowNewTableModal] = useState<boolean>(false);
  const [isManageTablesOpen, setIsManageTablesOpen] = useState<boolean>(false);
  const [newTableNumber, setNewTableNumber] = useState<string>('');
  const [newTableName, setNewTableName] = useState<string>('');
  const [newTableCapacity, setNewTableCapacity] = useState<number>(4);
  const [newTableSection, setNewTableSection] = useState<string>('Salão Principal');

  // Seções únicas
  const sections = useMemo(() => {
    const list = Array.from(new Set(tables.map((t) => t.section)));
    return list.filter(Boolean);
  }, [tables]);

  // Estatísticas do Salão
  const stats = useMemo(() => {
    const total = tables.length;
    const occupied = tables.filter((t) => t.status === 'OCCUPIED').length;
    const closing = tables.filter((t) => t.status === 'CLOSING').length;
    const available = tables.filter((t) => t.status === 'AVAILABLE').length;

    const totalOpenRevenue = tables.reduce((acc, t) => {
      return acc + (t.activeOrder?.total || 0);
    }, 0);

    return { total, occupied, closing, available, totalOpenRevenue };
  }, [tables]);

  // Mesas filtradas
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      const matchSection = selectedSection === 'ALL' || t.section === selectedSection;
      const matchStatus = selectedStatus === 'ALL' || t.status === selectedStatus;
      const matchSearch =
        searchQuery.trim() === '' ||
        t.number.toString().includes(searchQuery) ||
        (t.name && t.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.customerName && t.customerName.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchSection && matchStatus && matchSearch;
    });
  }, [tables, selectedSection, selectedStatus, searchQuery]);

  // Abertura de Mesa
  const handleOpenTableConfirm = async (data: {
    customerName?: string;
    waiterName?: string;
    customerCount: number;
  }) => {
    if (!tableToOpen) return;
    try {
      await api.openTable(tableToOpen.id, data);
      setTableToOpen(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao abrir mesa');
    }
  };

  // Criar Nova Mesa
  const handleCreateNewTable = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(newTableNumber);
    if (isNaN(num)) {
      alert('Informe um número de mesa válido');
      return;
    }
    try {
      await api.createTable({
        number: num,
        name: newTableName.trim() || undefined,
        capacity: newTableCapacity,
        section: newTableSection
      });
      setShowNewTableModal(false);
      setNewTableNumber('');
      setNewTableName('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao criar mesa');
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Top Banner de Métricas Rápidas do Salão */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
              Ocupação
            </span>
            <span className="text-xl font-black text-white">
              {stats.occupied + stats.closing} / {stats.total}{' '}
              <span className="text-xs text-slate-400 font-normal">
                ({stats.total > 0 ? Math.round(((stats.occupied + stats.closing) / stats.total) * 100) : 0}%)
              </span>
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
              Livres
            </span>
            <span className="text-xl font-black text-emerald-400">
              {stats.available} mesas
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
              Fechando
            </span>
            <span className="text-xl font-black text-amber-400">
              {stats.closing} contas
            </span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
              Em Aberto
            </span>
            <span className="text-xl font-black text-white">
              R$ {stats.totalOpenRevenue.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Busca rápida */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar mesa ou cliente (ex: 2, Mariana)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              title="Atualizar salão"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>

            <button
              onClick={() => setIsManageTablesOpen(true)}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95"
              title="Gerenciar e editar locais e mesas do bar"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Editar Locais</span>
            </button>

            <button
              onClick={() => setShowNewTableModal(true)}
              className="py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-amber-500/10 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Nova Mesa</span>
            </button>
          </div>
        </div>

        {/* Filtros de Ambiente e Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
          {/* Áreas do Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedSection('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                selectedSection === 'ALL'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              Todas as Áreas
            </button>
            {sections.map((sec) => (
              <button
                key={sec}
                onClick={() => setSelectedSection(sec)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedSection === sec
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {sec}
              </button>
            ))}
          </div>

          {/* Status */}
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setSelectedStatus('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                selectedStatus === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas ({tables.length})
            </button>
            <button
              onClick={() => setSelectedStatus('AVAILABLE')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                selectedStatus === 'AVAILABLE' ? 'bg-emerald-950/60 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Livres ({stats.available})
            </button>
            <button
              onClick={() => setSelectedStatus('OCCUPIED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                selectedStatus === 'OCCUPIED' ? 'bg-blue-950/60 text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ocupadas ({stats.occupied})
            </button>
            <button
              onClick={() => setSelectedStatus('CLOSING')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                selectedStatus === 'CLOSING' ? 'bg-amber-950/60 text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Fechando ({stats.closing})
            </button>
          </div>
        </div>
      </div>

      {/* Grid de Mesas */}
      {filteredTables.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800/60">
          <LayoutGrid className="w-12 h-12 stroke-[1.5] text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-300">Nenhuma mesa encontrada</h3>
          <p className="text-xs text-slate-500 mt-1">Tente alterar os filtros ou adicione uma nova mesa.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {filteredTables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              onOpenTable={(t) => setTableToOpen(t)}
              onSelectTable={(t) => setTableDetails(t)}
              onQuickOrder={(t) => setTableForOrder(t)}
              onQuickPay={(t) => setTableForCheckout(t)}
            />
          ))}
        </div>
      )}

      {/* Modais */}
      {tableToOpen && (
        <OpenTableModal
          table={tableToOpen}
          onClose={() => setTableToOpen(null)}
          onConfirm={handleOpenTableConfirm}
        />
      )}

      {tableDetails && (
        <TableDetailsModal
          table={tableDetails}
          onClose={() => setTableDetails(null)}
          onAddOrder={() => {
            setTableForOrder(tableDetails);
            setTableDetails(null);
          }}
          onCheckout={() => {
            setTableForCheckout(tableDetails);
            setTableDetails(null);
          }}
          onTransfer={() => {
            setTableForTransfer(tableDetails);
            setTableDetails(null);
          }}
          onMerge={() => {
            setTableForMerge(tableDetails);
            setTableDetails(null);
          }}
          onRefresh={onRefresh}
        />
      )}

      {tableForOrder && (
        <AddOrderModal
          table={tableForOrder}
          onClose={() => setTableForOrder(null)}
          onSuccess={onRefresh}
        />
      )}

      {tableForCheckout && (
        <CheckoutModal
          table={tableForCheckout}
          onClose={() => setTableForCheckout(null)}
          onSuccess={onRefresh}
        />
      )}

      {tableForTransfer && (
        <TransferModal
          sourceTable={tableForTransfer}
          tables={tables}
          onClose={() => setTableForTransfer(null)}
          onSuccess={onRefresh}
        />
      )}

      {tableForMerge && (
        <MergeModal
          mainTable={tableForMerge}
          tables={tables}
          onClose={() => setTableForMerge(null)}
          onSuccess={onRefresh}
        />
      )}

      {/* Modal Criar Nova Mesa */}
      {showNewTableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-xl font-black text-white mb-4">Adicionar Nova Mesa</h2>
            <form onSubmit={handleCreateNewTable} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Número da Mesa
                </label>
                <input
                  type="number"
                  required
                  placeholder="Ex: 13"
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Nome / Identificação (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Mesa 13, Bistrô 01, VIP 02"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Capacidade (Lugares)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(parseInt(e.target.value) || 4)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Ambiente / Área
                </label>
                <select
                  value={newTableSection}
                  onChange={(e) => setNewTableSection(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                >
                  <option value="Salão Principal">Salão Principal</option>
                  <option value="Deck Externo">Deck Externo</option>
                  <option value="Balcão">Balcão</option>
                  <option value="Área VIP">Área VIP</option>
                </select>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewTableModal(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-800 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow"
                >
                  Criar Mesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Gestão e Edição de Locais e Mesas */}
      {isManageTablesOpen && (
        <ManageTablesModal
          tables={tables}
          onClose={() => setIsManageTablesOpen(false)}
          onSuccess={() => {
            onRefresh();
          }}
        />
      )}
    </div>
  );
};
