import React from 'react';
import { Order } from '../types';

interface ThermalReceiptProps {
  order: Order | null;
  establishmentName?: string;
  establishmentInfo?: string;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({
  order,
  establishmentName = 'BAR & CHOPERIA PRO',
  establishmentInfo = 'Av. Principal, 1000 • CNPJ 00.000.000/0001-00'
}) => {
  if (!order) return null;

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div id="thermal-receipt" className="font-mono text-xs text-black leading-tight">
      <div className="text-center font-bold text-sm uppercase">{establishmentName}</div>
      <div className="text-center text-[10px] text-gray-700">{establishmentInfo}</div>
      <div className="text-center my-1 text-[10px]">
        ------------------------------------------
      </div>
      <div className="text-center font-bold uppercase tracking-wider text-xs">
        CONFERÊNCIA DE MESA (NÃO FISCAL)
      </div>
      <div className="text-center my-1 text-[10px]">
        ------------------------------------------
      </div>

      <div className="flex justify-between">
        <span>MESA: {order.table?.name || `Mesa ${order.table?.number || 'Balcão'}`}</span>
        <span>CMD: #{order.orderNumber}</span>
      </div>
      <div className="flex justify-between">
        <span>DATA: {dateStr} {timeStr}</span>
        <span>GARÇOM: {order.waiterName || 'Atendente'}</span>
      </div>
      {order.customerName && (
        <div>CLIENTE: {order.customerName}</div>
      )}

      <div className="text-center my-1 text-[10px]">
        ------------------------------------------
      </div>

      <div className="flex justify-between font-bold border-b border-black pb-1 mb-1">
        <span className="w-1/2">ITEM</span>
        <span className="w-1/6 text-center">QTD</span>
        <span className="w-1/6 text-right">UNIT</span>
        <span className="w-1/6 text-right">TOTAL</span>
      </div>

      <div className="space-y-1">
        {order.items?.map((item, idx) => (
          <div key={idx} className="flex justify-between text-[11px]">
            <span className="w-1/2 truncate font-medium">{item.product?.name}</span>
            <span className="w-1/6 text-center">{item.quantity}</span>
            <span className="w-1/6 text-right">{item.unitPrice.toFixed(2)}</span>
            <span className="w-1/6 text-right font-bold">{item.totalPrice.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="text-center my-1 text-[10px]">
        ------------------------------------------
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span>SUBTOTAL:</span>
          <span>R$ {order.subtotal.toFixed(2)}</span>
        </div>

        {order.isServiceFeeActive && (
          <div className="flex justify-between">
            <span>TX SERVIÇO (10%):</span>
            <span>R$ {order.serviceFee.toFixed(2)}</span>
          </div>
        )}

        {order.discount > 0 && (
          <div className="flex justify-between">
            <span>DESCONTO:</span>
            <span>- R$ {order.discount.toFixed(2)}</span>
          </div>
        )}

        <div className="flex justify-between text-sm font-black border-t border-black pt-1">
          <span>TOTAL:</span>
          <span>R$ {order.total.toFixed(2)}</span>
        </div>

        {order.paidAmount > 0 && (
          <div className="flex justify-between text-green-700 font-bold">
            <span>VALOR PAGO:</span>
            <span>R$ {order.paidAmount.toFixed(2)}</span>
          </div>
        )}

        {order.total - order.paidAmount > 0 && (
          <div className="flex justify-between font-bold">
            <span>SALDO RESTANTE:</span>
            <span>R$ {(order.total - order.paidAmount).toFixed(2)}</span>
          </div>
        )}
      </div>

      {order.payments && order.payments.length > 0 && (
        <div className="mt-2 pt-1 border-t border-dashed border-gray-500">
          <div className="font-bold text-[10px] mb-1">PAGAMENTOS REALIZADOS:</div>
          {order.payments.map((p, i) => (
            <div key={i} className="flex justify-between text-[10px]">
              <span>• {p.method} {p.notes ? `(${p.notes})` : ''}</span>
              <span>R$ {p.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="text-center my-2 text-[10px]">
        ==========================================
      </div>
      <div className="text-center text-[10px] italic">
        Agradecemos a preferência! Volte sempre!
      </div>
      <div className="text-center text-[9px] text-gray-500 mt-1">
        Sistema BarERP Pro • Versão Android / Web
      </div>
    </div>
  );
};
