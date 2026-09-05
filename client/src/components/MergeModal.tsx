import React, { useState } from 'react';
import { Table } from '../types';
import { api } from '../services/api';
import { X, Merge, AlertCircle } from 'lucide-react';

interface MergeModalProps {
  mainTable: Table | null;
  tables: Table[];
  onClose: () => void;
  onSuccess: () => void;
}

export const MergeModal: React.FC<MergeModalProps> = ({
  mainTable,
  tables,
  onClose,
  onSuccess
}) => {
  // Outras mesas que podem ser agrupadas (ocupadas ou com clientes)
  const otherTables = tables.filter(
    (t) => t.id !== mainTable?.id && (t.status === 'OCCUPIED' || t.status === 'CLOSING')
  );

  const [selectedSecondId, setSelectedSecondId] = useState<string>(
    otherTables[0]?.id || ''
  );
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!mainTable) return null;

  const handleMerge = async () => {
    if (!selectedSecondId) return;

    try {
      setSubmitting(true);
      await api.mergeTables(mainTable.id, selectedSecondId);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Erro ao juntar mesas');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-xs uppercase tracking-wider text-purple-400 font-bold">
              Junção de Mesas
            </span>
            <h2 className="text-xl font-black text-white">
              Unir à {mainTable.name || `Mesa ${mainTable.number}`}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <p className="text-xs text-slate-300">
            Selecione a outra mesa ocupada cujos itens e comandas serão integrados à {mainTable.name || `Mesa ${mainTable.number}`}:
          </p>

          {otherTables.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 text-xs text-slate-400">
              <AlertCircle className="w-4 h-4 shrink-0 text-slate-500" />
              <span>Não há outras mesas ocupadas disponíveis para unir neste momento.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto p-1">
              {otherTables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedSecondId(t.id)}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition ${
                    selectedSecondId === t.id
                      ? 'bg-purple-600/20 border-purple-500 text-white ring-1 ring-purple-500'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <div className="font-bold text-sm">#{t.number} - {t.name || `Mesa ${t.number}`}</div>
                    <div className="text-[11px] text-slate-400">
                      {t.customerName || 'Cliente'} • {t.activeOrder?.items?.length || 0} itens
                    </div>
                  </div>
                  <span className="text-sm font-mono font-bold text-emerald-400">
                    R$ {(t.activeOrder?.total || 0).toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="pt-3 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!selectedSecondId || submitting || otherTables.length === 0}
              onClick={handleMerge}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-500 text-white transition shadow-lg shadow-purple-600/20 disabled:opacity-50"
            >
              {submitting ? 'Unindo...' : 'Confirmar Junção'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
