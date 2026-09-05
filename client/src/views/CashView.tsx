import React, { useState, useEffect } from 'react';
import { CashShift, CashSummary } from '../types';
import { api } from '../services/api';
import {
  Receipt,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Lock,
  Unlock,
  AlertCircle,
  CreditCard,
  QrCode,
  Banknote,
  Clock,
  User,
  Users,
  Plus,
  Minus,
  RefreshCw
} from 'lucide-react';

interface CashViewProps {
  onRefreshStatus: () => void;
}

export const CashView: React.FC<CashViewProps> = ({ onRefreshStatus }) => {
  const [shiftData, setShiftData] = useState<{
    isOpen: boolean;
    shift: CashShift | null;
    summary?: CashSummary;
  }>({ isOpen: false, shift: null });

  const [loading, setLoading] = useState<boolean>(true);

  // Estados de Abertura
  const [initialBalance, setInitialBalance] = useState<string>('200.00');
  const [openedBy, setOpenedBy] = useState<string>('Operador de Caixa');
  const [openNotes, setOpenNotes] = useState<string>('');

  // Estados de Movimentação (Sangria / Suprimento)
  const [showTxModal, setShowTxModal] = useState<boolean>(false);
  const [txType, setTxType] = useState<'SUPPLY' | 'WITHDRAWAL'>('WITHDRAWAL');
  const [txAmount, setTxAmount] = useState<string>('');
  const [txReason, setTxReason] = useState<string>('');

  // Estados de Fechamento de Caixa
  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
  const [finalCashCount, setFinalCashCount] = useState<string>('');
  const [closedBy, setClosedBy] = useState<string>('Operador de Caixa');
  const [closeReport, setCloseReport] = useState<any>(null);

  const loadCashData = async () => {
    try {
      setLoading(true);
      const data = await api.getCurrentCashShift();
      setShiftData(data);
      onRefreshStatus();
    } catch (err) {
      console.error('Erro ao carregar caixa:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCashData();
  }, []);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const bal = parseFloat(initialBalance);
    if (isNaN(bal) || bal < 0) {
      alert('Informe um fundo de troco inicial válido');
      return;
    }
    try {
      await api.openCashShift(bal, openedBy, openNotes);
      loadCashData();
    } catch (err: any) {
      alert(err.message || 'Erro ao abrir caixa');
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(txAmount);
    if (isNaN(amt) || amt <= 0 || !txReason.trim()) {
      alert('Informe o valor e o motivo da movimentação');
      return;
    }
    try {
      await api.addCashTransaction(txType, amt, txReason.trim());
      setShowTxModal(false);
      setTxAmount('');
      setTxReason('');
      loadCashData();
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar movimentação');
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCount = parseFloat(finalCashCount);
    if (isNaN(finalCount)) {
      alert('Informe o valor total em dinheiro contado na gaveta');
      return;
    }
    try {
      const result = await api.closeCashShift(finalCount, closedBy);
      setCloseReport(result.report);
      loadCashData();
    } catch (err: any) {
      alert(err.message || 'Erro ao fechar caixa');
    }
  };

  const summary = shiftData.summary;
  const shift = shiftData.shift;

  return (
    <div className="space-y-4 pb-20 max-w-6xl mx-auto">
      {/* Cabeçalho */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex items-center justify-between shadow-sm transition-colors duration-150">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Frente de Caixa (PDV)</h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  shiftData.isOpen
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                }`}
              >
                {shiftData.isOpen ? 'Turno Aberto' : 'Caixa Fechado'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Controle de suprimento, sangria, recebimentos e repasse de comissões (10%)
            </p>
          </div>
        </div>

        <button
          onClick={loadCashData}
          title="Atualizar dados do caixa"
          className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Se o caixa estiver FECHADO: Exibir tela de abertura */}
      {!shiftData.isOpen ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg mx-auto shadow-xl transition-colors duration-150">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 mx-auto mb-4">
            <Unlock className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white text-center">Abrir Turno de Caixa</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1 mb-6">
            Inicie as operações informando o fundo de troco inicial disponível na gaveta.
          </p>

          <form onSubmit={handleOpenShift} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                Fundo de Troco Inicial (R$)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-lg font-mono font-bold focus:border-amber-500 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                Operador / Responsável
              </label>
              <input
                type="text"
                required
                value={openedBy}
                onChange={(e) => setOpenedBy(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-amber-500 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                Observações do Turno (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Turno Noturno"
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-amber-500 focus:outline-none transition"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-xl font-black text-sm uppercase tracking-wide bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/20 active:scale-95 mt-2 cursor-pointer"
            >
              Confirmar Abertura de Caixa
            </button>
          </form>
        </div>
      ) : (
        /* Se o caixa estiver ABERTO: Resumo do Turno */
        <div className="space-y-4">
          {/* Cards de Indicadores do Caixa */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold block">
                Fundo Inicial (Troco)
              </span>
              <span className="text-xl font-black text-slate-800 dark:text-slate-200">
                R$ {(summary?.initialBalance || 0).toFixed(2)}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold block">
                Total de Vendas
              </span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                R$ {(summary?.totalSales || 0).toFixed(2)}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold block">
                Suprimentos / Sangrias
              </span>
              <div className="text-xs font-mono font-bold mt-1 space-y-0.5">
                <span className="text-blue-600 dark:text-blue-400 block">+ R$ {(summary?.totalSupplies || 0).toFixed(2)}</span>
                <span className="text-red-600 dark:text-red-400 block">- R$ {(summary?.totalWithdrawals || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 shadow-sm">
              <span className="text-[11px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-bold block">
                Dinheiro Esperado na Gaveta
              </span>
              <span className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
                R$ {(summary?.expectedCashInDrawer || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Vendas por Método e Botões de Operação */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Vendas por Método */}
            <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-3 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Recebimentos por Forma de Pagamento
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="bg-slate-50 dark:bg-slate-950/70 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <QrCode className="w-3.5 h-3.5 text-emerald-500" />
                    <span>PIX</span>
                  </div>
                  <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                    R$ {(summary?.paymentsByMethod?.PIX || 0).toFixed(2)}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950/70 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                    <span>Cartão Crédito</span>
                  </div>
                  <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                    R$ {(summary?.paymentsByMethod?.CREDIT_CARD || 0).toFixed(2)}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950/70 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <CreditCard className="w-3.5 h-3.5 text-cyan-500" />
                    <span>Cartão Débito</span>
                  </div>
                  <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                    R$ {(summary?.paymentsByMethod?.DEBIT_CARD || 0).toFixed(2)}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950/70 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <Banknote className="w-3.5 h-3.5 text-amber-500" />
                    <span>Dinheiro em Espécie</span>
                  </div>
                  <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                    R$ {(summary?.paymentsByMethod?.CASH || 0).toFixed(2)}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950/70 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <Receipt className="w-3.5 h-3.5 text-purple-500" />
                    <span>Voucher / Outros</span>
                  </div>
                  <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                    R$ {(summary?.paymentsByMethod?.VOUCHER || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Ações Rápidas do Caixa */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col justify-between space-y-3 shadow-sm">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-1">
                  Ações de Caixa
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Operador: {shift?.openedBy || 'Caixa'}
                </p>

                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setTxType('WITHDRAWAL');
                      setShowTxModal(true);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-red-500/10 text-red-600 dark:text-red-300 hover:bg-red-600 hover:text-white border border-red-500/20 transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <ArrowDownRight className="w-4 h-4" />
                    Efetuar Sangria (Retirada)
                  </button>

                  <button
                    onClick={() => {
                      setTxType('SUPPLY');
                      setShowTxModal(true);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-300 hover:bg-blue-600 hover:text-white border border-blue-500/20 transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    Efetuar Suprimento (Entrada)
                  </button>
                </div>
              </div>

              <button
                onClick={() => setShowCloseModal(true)}
                className="w-full py-3 px-3 rounded-xl text-xs font-black uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                Fechar Turno de Caixa
              </button>
            </div>
          </div>

          {/* Card de Repasse de Comissões dos Garçons (10%) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm transition-colors duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                      Repasse de Comissões dos Garçons (10%)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      Fim de Expediente
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Totalização das taxas de serviço arrecadadas no turno para repasse aos garçons
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3 self-start sm:self-auto">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total 10% do Turno:
                </span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  R$ {(summary?.totalServiceFeesShift || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {summary?.waiterCommissions && summary.waiterCommissions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {summary.waiterCommissions.map((wc, idx) => (
                  <div
                    key={wc.waiterId || `waiter-${idx}`}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 font-black text-xs flex items-center justify-center">
                          {wc.waiterName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            {wc.waiterName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {wc.ordersCount} {wc.ordersCount === 1 ? 'comanda atendida' : 'comandas atendidas'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">
                          Total Vendido
                        </span>
                        <span className="font-mono text-slate-600 dark:text-slate-300 font-medium">
                          R$ {wc.totalSales.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-amber-600 dark:text-amber-400 text-[10px] uppercase font-bold block">
                          Repasse (10%)
                        </span>
                        <span className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                          R$ {wc.serviceFeeTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-xs bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                Nenhum valor de taxa de serviço (10%) acumulado neste turno ainda.
              </div>
            )}
          </div>

          {/* Histórico de Transações e Pagamentos Recentes */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-3">
              Movimentações & Pagamentos do Turno
            </h3>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {shift?.payments && shift.payments.length > 0 ? (
                shift.payments.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                        PAGAMENTO
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {p.order?.table?.name || 'Mesa'} • {p.method}
                      </span>
                      {p.notes && <span className="text-slate-400 dark:text-slate-500 italic">({p.notes})</span>}
                    </div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      + R$ {p.amount.toFixed(2)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs">
                  Nenhum pagamento registrado ainda neste turno.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Sangria / Suprimento */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-3">
              {txType === 'WITHDRAWAL' ? 'Registrar Sangria (Retirada)' : 'Registrar Suprimento (Entrada)'}
            </h3>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-base font-bold focus:border-amber-500 focus:outline-none transition"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Motivo / Justificativa
                </label>
                <input
                  type="text"
                  required
                  placeholder={txType === 'WITHDRAWAL' ? 'Ex: Pagamento fornecedor de gelo' : 'Ex: Troco extra para notas'}
                  value={txReason}
                  onChange={(e) => setTxReason(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none transition"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowTxModal(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Fechamento de Turno (Conferência Cega) */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Fechamento de Turno</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Conte o dinheiro físico em espécie presente na gaveta e confirme o encerramento do expediente.
            </p>

            {closeReport ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-700 dark:text-slate-300">
                    <span>Dinheiro Esperado na Gaveta:</span>
                    <span className="font-mono font-bold">R$ {closeReport.expectedCash.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700 dark:text-slate-300">
                    <span>Dinheiro Físico Contado:</span>
                    <span className="font-mono font-bold">R$ {closeReport.countedCash.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 font-bold">
                    <span>Diferença (Sobra/Falta):</span>
                    <span
                      className={`font-mono ${
                        closeReport.difference >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                      }`}
                    >
                      {closeReport.difference >= 0 ? '+' : ''} R$ {closeReport.difference.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Repasse dos 10% aos Garçons no Fechamento */}
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      Repasse de 10% aos Garçons
                    </span>
                    <span className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400">
                      Total: R$ {(closeReport.totalServiceFeesShift || 0).toFixed(2)}
                    </span>
                  </div>

                  {closeReport.waiterCommissions && closeReport.waiterCommissions.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {closeReport.waiterCommissions.map((wc: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/20 shadow-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">{wc.waiterName}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              {wc.ordersCount} {wc.ordersCount === 1 ? 'comanda' : 'comandas'} • R$ {wc.totalSales.toFixed(2)} em vendas
                            </span>
                          </div>
                          <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                            R$ {wc.serviceFeeTotal.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                      Nenhuma comissão acumulada neste turno.
                    </p>
                  )}
                </div>

                <button
                  onClick={() => {
                    setShowCloseModal(false);
                    setCloseReport(null);
                  }}
                  className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  Concluir Fechamento
                </button>
              </div>
            ) : (
              <form onSubmit={handleCloseShift} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                    Valor Total em Dinheiro Contado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={finalCashCount}
                    onChange={(e) => setFinalCashCount(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-xl font-bold focus:border-amber-500 focus:outline-none transition"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                    Conferido Por
                  </label>
                  <input
                    type="text"
                    required
                    value={closedBy}
                    onChange={(e) => setClosedBy(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none transition"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCloseModal(false)}
                    className="flex-1 py-3 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl font-bold text-xs bg-red-600 hover:bg-red-500 text-white transition cursor-pointer shadow-lg shadow-red-600/20"
                  >
                    Encerrar Caixa
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CashView;
