import React, { useState } from 'react';
import { Table, Order, PaymentMethod } from '../types';
import { api } from '../services/api';
import {
  X,
  Printer,
  Share2,
  CheckCircle,
  CreditCard,
  Banknote,
  QrCode,
  Tag,
  Percent,
  Users,
  AlertCircle
} from 'lucide-react';

interface CheckoutModalProps {
  table: Table | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  table,
  onClose,
  onSuccess
}) => {
  if (!table || !table.activeOrder) return null;

  const order = table.activeOrder;
  const remainingBalance = Math.max(0, order.total - order.paidAmount);

  // Estados de divisão
  const [splitCount, setSplitCount] = useState<number>(table.customerCount || 2);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [payAmount, setPayAmount] = useState<string>(remainingBalance.toFixed(2));
  const [cashTendered, setCashTendered] = useState<string>('');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);

  // Cálculo da divisão por pessoa
  const amountPerPerson = remainingBalance / Math.max(1, splitCount);

  // Troco em dinheiro
  const cashGiven = parseFloat(cashTendered) || 0;
  const toPayNum = parseFloat(payAmount) || 0;
  const change = Math.max(0, cashGiven - toPayNum);

  // Alternar taxa de serviço 10%
  const handleToggleService = async () => {
    try {
      await api.toggleServiceFee(order.id, !order.isServiceFeeActive);
      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar taxa de serviço');
    }
  };

  // Aplicar desconto
  const handleApplyDiscount = async () => {
    const val = parseFloat(discountValue) || 0;
    try {
      await api.applyDiscount(order.id, val);
      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Erro ao aplicar desconto');
    }
  };

  // Imprimir conferência (80mm/58mm)
  const handlePrint = () => {
    window.print();
  };

  // Compartilhar conta no WhatsApp
  const handleShareWhatsApp = () => {
    let msg = `*CONFERÊNCIA DE MESA - ${table.name || `Mesa ${table.number}`}*\n`;
    msg += `Comanda #${order.orderNumber}\n`;
    msg += `--------------------------------\n`;
    order.items.forEach((it) => {
      msg += `${it.quantity}x ${it.product.name} - R$ ${it.totalPrice.toFixed(2)}\n`;
    });
    msg += `--------------------------------\n`;
    msg += `Subtotal: R$ ${order.subtotal.toFixed(2)}\n`;
    if (order.isServiceFeeActive) {
      msg += `Taxa Serviço (10%): R$ ${order.serviceFee.toFixed(2)}\n`;
    }
    if (order.discount > 0) {
      msg += `Desconto: - R$ ${order.discount.toFixed(2)}\n`;
    }
    msg += `*TOTAL: R$ ${order.total.toFixed(2)}*\n`;
    if (splitCount > 1) {
      msg += `Divisão (${splitCount} pessoas): R$ ${(order.total / splitCount).toFixed(2)} cada\n`;
    }
    msg += `\nObrigado pela preferência!`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  // Executar Pagamento
  const handleExecutePayment = async (closeOrderImmediately: boolean) => {
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Informe um valor válido para pagamento');
      return;
    }

    try {
      setSubmitting(true);
      const isClosing = closeOrderImmediately || amt >= remainingBalance - 0.05;

      await api.payOrder(order.id, {
        payments: [
          {
            amount: amt,
            method: paymentMethod,
            notes: splitCount > 1 ? `Divisão (${splitCount}p)` : undefined
          }
        ],
        closeOrder: isClosing
      });

      setPaymentSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      alert(err.message || 'Erro ao processar pagamento');
    } finally {
      setSubmitting(false);
    }
  };

  const paymentOptions: { method: PaymentMethod; label: string; icon: any }[] = [
    { method: 'PIX', label: 'PIX Instantâneo', icon: QrCode },
    { method: 'CREDIT_CARD', label: 'Cartão Crédito', icon: CreditCard },
    { method: 'DEBIT_CARD', label: 'Cartão Débito', icon: CreditCard },
    { method: 'CASH', label: 'Dinheiro', icon: Banknote },
    { method: 'VOUCHER', label: 'Voucher / Vale', icon: Tag }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:px-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                FECHAMENTO & PDV
              </span>
              <span className="text-xs text-slate-400">
                Comanda #{order.orderNumber}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              {table.name || `Mesa ${table.number}`}
              {table.customerName ? ` • ${table.customerName}` : ''}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1.5 text-xs font-bold"
              title="Imprimir conferência 80mm"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir (80mm)</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="p-2 text-emerald-400 hover:text-emerald-300 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-800/40 transition flex items-center gap-1.5 text-xs font-bold"
              title="Compartilhar no WhatsApp"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Card Resumo Financeiro */}
          <div className="bg-slate-950/70 rounded-2xl border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Subtotal ({order.items.length} itens):</span>
              <span className="font-mono font-bold">R$ {order.subtotal.toFixed(2)}</span>
            </div>

            {/* Taxa de Serviço 10% com Toggle */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleService}
                  className={`w-9 h-5 rounded-full transition-colors relative ${
                    order.isServiceFeeActive ? 'bg-amber-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`block w-3.5 h-3.5 rounded-full bg-slate-950 transition-transform ${
                      order.isServiceFeeActive ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-slate-300">Taxa de Serviço (10% Garçom):</span>
              </div>
              <span className="font-mono font-bold text-amber-400">
                {order.isServiceFeeActive ? `R$ ${order.serviceFee.toFixed(2)}` : 'R$ 0.00'}
              </span>
            </div>

            {/* Desconto */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">Desconto:</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="0.00"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-20 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-right font-mono"
                />
                <button
                  onClick={handleApplyDiscount}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300"
                >
                  Aplicar
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block">
                  Total da Conta
                </span>
                <span className="text-2xl font-black text-white">
                  R$ {order.total.toFixed(2)}
                </span>
              </div>

              <div className="text-right">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block">
                  Saldo Restante a Pagar
                </span>
                <span className="text-2xl font-black text-emerald-400">
                  R$ {remainingBalance.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Seção de Divisão de Conta */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase text-slate-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-400" />
                Divisão da Conta
              </label>
              <span className="text-xs font-bold text-amber-400 font-mono">
                R$ {amountPerPerson.toFixed(2)} por pessoa
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[1, 2, 3, 4, 5, 6, 8].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setSplitCount(num);
                    setPayAmount((remainingBalance / num).toFixed(2));
                  }}
                  className={`flex-1 min-w-[54px] py-2 rounded-xl text-xs font-bold transition ${
                    splitCount === num
                      ? 'bg-amber-500 text-slate-950 font-black shadow'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {num}x
                </button>
              ))}
            </div>
          </div>

          {/* Formas de Pagamento */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
              Selecione o Meio de Pagamento
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {paymentOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = paymentMethod === opt.method;
                return (
                  <button
                    key={opt.method}
                    type="button"
                    onClick={() => setPaymentMethod(opt.method)}
                    className={`flex items-center gap-2 p-3 rounded-2xl border text-xs font-bold transition select-none ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-amber-400" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Valor a Pagar neste Acerto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                Valor deste Pagamento (R$)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-base font-bold focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setPayAmount(remainingBalance.toFixed(2))}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 whitespace-nowrap"
                >
                  Tudo
                </button>
              </div>
            </div>

            {/* Se dinheiro: Calculadora de Troco */}
            {paymentMethod === 'CASH' && (
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Valor Entregue pelo Cliente (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 100.00"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-base font-bold focus:border-amber-500 focus:outline-none"
                />
                {cashGiven > 0 && (
                  <div className="mt-1 flex justify-between text-xs font-bold">
                    <span className="text-slate-400">Troco a Devolver:</span>
                    <span className="text-emerald-400 font-mono">
                      R$ {change.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Alerta de Pagamento Parcial */}
          {toPayNum < remainingBalance - 0.05 && (
            <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/50 flex items-center gap-2 text-xs text-blue-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-blue-400" />
              <span>
                Pagamento parcial: a mesa continuará ocupada com saldo restante de{' '}
                <strong>R$ {(remainingBalance - toPayNum).toFixed(2)}</strong>.
              </span>
            </div>
          )}
        </div>

        {/* Rodapé / Botões de Ação */}
        <div className="p-4 sm:px-6 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="py-3 px-4 rounded-xl font-bold text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
          >
            Voltar
          </button>

          {toPayNum < remainingBalance - 0.05 ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleExecutePayment(false)}
              className="flex-1 py-3.5 px-4 rounded-xl font-black text-sm uppercase tracking-wide bg-blue-600 hover:bg-blue-500 text-white transition shadow-lg shadow-blue-600/20 active:scale-[0.98]"
            >
              Registrar Pagamento Parcial (R$ {toPayNum.toFixed(2)})
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleExecutePayment(true)}
              className="flex-1 py-3.5 px-4 rounded-xl font-black text-sm uppercase tracking-wide bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 transition shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
            >
              {paymentSuccess ? 'Liquidado com Sucesso!' : `Confirmar Pagamento & Liberar Mesa (R$ ${toPayNum.toFixed(2)})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
