import React from 'react';

export interface KitchenTicketItem {
  id?: string;
  name: string;
  quantity: number;
  notes?: string | null;
  category?: string;
  kdsStation?: 'KITCHEN' | 'BAR' | string;
}

export interface KitchenTicketData {
  orderNumber: number;
  tableName: string;
  tableNumber?: number;
  waiterName?: string;
  createdAt?: string | Date;
  station?: 'COZINHA' | 'BAR' | 'TODOS';
  items: KitchenTicketItem[];
}

interface KitchenTicketReceiptProps {
  ticket: KitchenTicketData | null;
}

export const KitchenTicketReceipt: React.FC<KitchenTicketReceiptProps> = ({ ticket }) => {
  if (!ticket || !ticket.items || ticket.items.length === 0) return null;

  const dateStr = ticket.createdAt
    ? new Date(ticket.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div id="kitchen-ticket-receipt" className="hidden print:block fixed inset-0 bg-white text-black p-4 text-xs font-mono z-[99999]">
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .print\\:block, .print\\:block * {
              visibility: visible;
            }
            .print\\:block {
              position: absolute;
              left: 0;
              top: 0;
              width: 80mm;
              padding: 4mm;
              margin: 0;
              background: #fff !important;
              color: #000 !important;
              font-family: monospace;
            }
            @page {
              size: 80mm auto;
              margin: 0;
            }
          }
        `}
      </style>

      {/* Cabeçalho da Comanda de Produção */}
      <div className="text-center pb-2 border-b-2 border-dashed border-black">
        <h2 className="text-lg font-black tracking-wider uppercase">
          *** {ticket.station || 'PEDIDO COZINHA'} ***
        </h2>
        <div className="mt-1 text-base font-black border-2 border-black py-1 px-2 my-1">
          {ticket.tableName || `MESA ${ticket.tableNumber}`}
        </div>
        <div className="flex justify-between text-[11px] font-bold mt-1">
          <span>COMANDA: #{ticket.orderNumber}</span>
          <span>HORA: {dateStr}</span>
        </div>
        <div className="text-[11px] text-left mt-0.5">
          <span>ATENDENTE: <b>{ticket.waiterName || 'Garçom'}</b></span>
        </div>
      </div>

      {/* Lista de Itens do Pedido */}
      <div className="py-2 border-b-2 border-dashed border-black space-y-2">
        {ticket.items.map((item, idx) => (
          <div key={item.id || idx} className="text-left leading-tight">
            <div className="flex items-start justify-between text-sm font-black">
              <span className="text-base bg-black text-white px-1.5 py-0.5 rounded mr-1.5">
                {item.quantity}x
              </span>
              <span className="flex-1 uppercase font-black text-sm">
                {item.name}
              </span>
            </div>

            {/* Observações com destaque obrigatório para a cozinha */}
            {item.notes && (
              <div className="mt-1 ml-6 p-1 border-l-4 border-black text-xs font-black uppercase bg-gray-100">
                &gt;&gt; OBS: {item.notes}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Rodapé com contagem total de itens */}
      <div className="pt-2 text-center text-[10px] space-y-0.5">
        <p className="font-bold uppercase">TOTAL DE ITENS: {ticket.items.reduce((acc, i) => acc + i.quantity, 0)}</p>
        <p>================================</p>
        <p className="text-[9px]">SISTEMA BAR ERP • IMPRESSÃO AUTOMÁTICA</p>
      </div>
    </div>
  );
};

export default KitchenTicketReceipt;
