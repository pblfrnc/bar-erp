import React, { useEffect, useState } from 'react';
import { Order } from '../types';
import { api, EstablishmentInfo } from '../services/api';
import { parseModifiers } from '../utils/pricing';

interface ThermalReceiptProps {
  order: Order | null;
}

const ESTABLISHMENT_CACHE_KEY = 'bar_erp_establishment';

// Cache em memória + localStorage: o cabeçalho sai correto mesmo se a API demorar no momento da impressão
let cachedEstablishment: EstablishmentInfo | null = null;
try {
  const stored = localStorage.getItem(ESTABLISHMENT_CACHE_KEY);
  if (stored) cachedEstablishment = JSON.parse(stored);
} catch (e) {}

function readPrinterSettings(): { paperWidth: number; fontScale: number } {
  try {
    const s = JSON.parse(localStorage.getItem('bar_erp_printer_settings') || '{}');
    return { paperWidth: Number(s.paperWidth) || 80, fontScale: Number(s.fontScale) || 100 };
  } catch (e) {
    return { paperWidth: 80, fontScale: 100 };
  }
}

function formatCnpj(value?: string | null): string {
  const d = String(value || '').replace(/\D/g, '');
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : String(value || '');
}

export const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Dinheiro',
  CREDIT_CARD: 'Cartão Crédito',
  DEBIT_CARD: 'Cartão Débito',
  PIX: 'PIX',
  VOUCHER: 'Vale',
  CREDIT_TAB: 'Fiado'
};

const money = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDateTime = (d: Date) =>
  `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

const Divider = () => <div className="border-t border-dashed border-black my-[0.4em]" />;

const Row: React.FC<{ left: React.ReactNode; right: React.ReactNode; className?: string }> = ({ left, right, className = '' }) => (
  <div className={`flex justify-between items-baseline gap-[0.5em] ${className}`}>
    <span className="min-w-0">{left}</span>
    <span className="shrink-0 text-right">{right}</span>
  </div>
);

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ order }) => {
  const [establishment, setEstablishment] = useState<EstablishmentInfo | null>(cachedEstablishment);

  // Carrega (e atualiza) os dados do bar assim que o componente monta, antes de qualquer impressão
  useEffect(() => {
    api.getEstablishment()
      .then((info) => {
        cachedEstablishment = info;
        setEstablishment(info);
        try { localStorage.setItem(ESTABLISHMENT_CACHE_KEY, JSON.stringify(info)); } catch (e) {}
      })
      .catch(() => {});
  }, []);

  if (!order) return null;

  const { paperWidth, fontScale } = readPrinterSettings();
  const isClosed = order.status === 'PAID' || order.status === 'CLOSED';
  const orderDate = new Date((isClosed && order.closedAt) || order.createdAt || Date.now());
  const remaining = order.total - order.paidAmount;
  const tableLabel = order.table?.name || (order.table?.number ? `Mesa ${order.table.number}` : 'Balcão');
  const displayName = establishment?.nomeFantasia || establishment?.razaoSocial || '';

  return (
    <div
      id="thermal-receipt"
      className="font-mono text-black leading-tight"
      style={{ fontSize: `${(12 * fontScale) / 100}px` }}
    >
      <style>{`@media print { @page { size: ${paperWidth}mm auto; margin: 0; } }`}</style>

      {/* Cabeçalho com os dados reais do estabelecimento (Configurações Fiscais) */}
      {displayName && <div className="text-center font-bold uppercase text-[1.2em]">{displayName}</div>}
      {establishment?.nomeFantasia && establishment?.razaoSocial && (
        <div className="text-center text-[0.85em]">{establishment.razaoSocial}</div>
      )}
      {establishment?.cnpj && <div className="text-center text-[0.85em]">CNPJ: {formatCnpj(establishment.cnpj)}</div>}
      {establishment?.endereco && <div className="text-center text-[0.85em]">{establishment.endereco}</div>}

      <Divider />
      <div className="text-center font-bold uppercase">
        {isClosed ? 'Comprovante de Consumo' : 'Conferência de Mesa'}
      </div>
      <div className="text-center text-[0.85em]">DOCUMENTO SEM VALOR FISCAL</div>
      <Divider />

      <Row left={`MESA: ${tableLabel}`} right={`CMD: #${order.orderNumber}`} />
      <div>{isClosed ? 'FECHADA' : 'ABERTA'}: {formatDateTime(orderDate)}</div>
      <div>GARÇOM: {order.waiterName || 'Atendente'}</div>
      {order.customerName && <div>CLIENTE: {order.customerName}</div>}

      <Divider />
      <Row left={<b>ITEM</b>} right={<b>TOTAL</b>} />
      <div className="space-y-[0.3em] mt-[0.2em]">
        {order.items?.map((item, idx) => (
          <div key={idx}>
            <div className="font-bold break-words">{item.product?.name}</div>
            {parseModifiers(item.modifiers).map((m, i) => (
              <div key={i} className="pl-[0.8em] text-[0.9em] break-words">+ {m.name}{m.price > 0 ? ` (${money(m.price)})` : ''}</div>
            ))}
            {item.promotionName && <div className="pl-[0.8em] text-[0.9em] break-words">* {item.promotionName}</div>}
            <Row left={`${item.quantity} x ${money(item.unitPrice)}`} right={money(item.totalPrice)} />
          </div>
        ))}
      </div>

      <Divider />
      <Row left="SUBTOTAL:" right={`R$ ${money(order.subtotal)}`} />
      {order.isServiceFeeActive && order.serviceFee > 0 && (
        <Row left={`TX SERVIÇO (${Math.round((order.serviceFeeRate ?? 0.1) * 100)}%):`} right={`R$ ${money(order.serviceFee)}`} />
      )}
      {order.discount > 0 && <Row left="DESCONTO:" right={`- R$ ${money(order.discount)}`} />}
      <Row left="TOTAL:" right={`R$ ${money(order.total)}`} className="font-bold text-[1.2em] border-t border-black pt-[0.2em] mt-[0.2em]" />
      {order.paidAmount > 0 && <Row left="VALOR PAGO:" right={`R$ ${money(order.paidAmount)}`} className="font-bold" />}
      {remaining > 0.009 && <Row left="SALDO RESTANTE:" right={`R$ ${money(remaining)}`} className="font-bold" />}

      {order.payments && order.payments.length > 0 && (
        <>
          <Divider />
          <div className="font-bold">PAGAMENTOS:</div>
          {order.payments.map((p, i) => (
            <Row key={i} left={`${PAYMENT_LABELS[p.method] || p.method}${p.notes ? ` (${p.notes})` : ''}`} right={`R$ ${money(p.amount)}`} />
          ))}
        </>
      )}

      <Divider />
      <div className="text-center">Agradecemos a preferência! Volte sempre!</div>
      <div className="text-center text-[0.8em] mt-[0.2em]">Impresso em {formatDateTime(new Date())}</div>
    </div>
  );
};
