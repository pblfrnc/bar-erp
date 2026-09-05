import React, { useState } from 'react';
import { Table } from '../types';
import { api } from '../services/api';
import { X, ArrowRightLeft, AlertCircle } from 'lucide-react';

interface TransferModalProps {
  sourceTable: Table | null;
  tables: Table[];
  onClose: () => void;
  onSuccess: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  sourceTable,
  tables,
  onClose,
  onSuccess
}) => {
  if (!sourceTable) return null;

  // Mesas livres disponíveis para receber a transferência
  const availableTables = tables.filter(
    (t) => t.id !== sourceTable.id && t.status === 'AVAILABLE'
  );

  const [selectedTargetId, setSelectedTargetId] = useState<string>(
    availableTables[0]?.id || ''
  );
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleTransfer = async () => {
    if (!selectedTargetId) return;

    try {
      setSubmitting(true);
      await api.transferTable(sourceTable.id, selectedTargetId);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Erro ao transferir mesa');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-xs uppercase tracking-wider text-blue-400 font-bold">
              Transferência
            </span>
            <h2 className="text-xl font-black text-white">
              Transferir {sourceTable.name || `Mesa ${sourceTable.number}`}
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
            Selecione a mesa de destino livre para onde todos os itens e a comanda ativa serão transferidos:
          </p>

          {availableTables.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/50 flex items-center gap-2 text-xs text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Não há mesas livres no salão no momento para realizar a transferência.</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1">
              {availableTables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTargetId(t.id)}
                  className={`p-3 rounded-xl border text-left transition ${
                    selectedTargetId === t.id
                      ? 'bg-blue-600/20 border-blue-500 text-white ring-1 ring-blue-500'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold text-sm">#{t.number} - {t.name || `Mesa ${t.number}`}</div>
                  <div className="text-[11px] text-slate-400">{t.section} • {t.capacity}p</div>
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
              disabled={!selectedTargetId || submitting || availableTables.length === 0}
              onClick={handleTransfer}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white transition shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              {submitting ? 'Transferindo...' : 'Confirmar Transferência'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
