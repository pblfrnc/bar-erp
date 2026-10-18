import { Order } from '../types';
import { api } from './api';
import { parseModifiers } from '../utils/pricing';

// Emissão de NFC-e a partir de uma venda já registrada (venda de balcão).
// Usa o preço que o servidor cobrou em cada item (com promoção do dia e adicionais) e rateia o desconto da venda,
// para o total da nota bater com o valor pago.

export const cleanNcm = (ncm?: string | null) => String(ncm || '').replace(/\D/g, '');
export const isValidNcm = (ncm?: string | null) => /^\d{8}$/.test(cleanNcm(ncm));

export type NfceEmitResult =
  | { status: 'authorized'; danfeUrl: string | null; referencia: string }
  | { status: 'processing'; referencia: string };

const round2 = (v: number) => Math.round(v * 100) / 100;

export async function emitNfceForOrder(order: Order, options: { customerDoc?: string; paymentMethod: string }): Promise<NfceEmitResult> {
  const items = order.items || [];
  const gross = items.reduce((acc, i) => acc + i.totalPrice, 0);
  const discount = Math.min(round2(order.discount || 0), round2(gross));

  // Rateio proporcional do desconto, nunca acima do valor do item; a sobra de centavos vai para quem ainda tem margem
  const itemGross = items.map((i) => round2(i.totalPrice));
  // Arredonda para baixo: a soma nunca passa do desconto e a sobra é distribuída abaixo
  const floor2 = (v: number) => Math.floor(round2(v * 100)) / 100;
  const itemDiscounts = itemGross.map((g) => (discount > 0 && gross > 0 ? Math.min(g, floor2((discount * g) / gross)) : 0));
  let remaining = round2(discount - itemDiscounts.reduce((acc, d) => acc + d, 0));
  for (let idx = itemDiscounts.length - 1; idx >= 0 && remaining > 0; idx--) {
    const add = Math.min(remaining, round2(itemGross[idx] - itemDiscounts[idx]));
    itemDiscounts[idx] = round2(itemDiscounts[idx] + add);
    remaining = round2(remaining - add);
  }

  const payload = {
    // saleKey = id da venda: a mesma venda sempre usa a mesma referência na Focus (tentar de novo não duplica a nota)
    saleKey: order.id,
    orderId: `bal${order.orderNumber}`,
    customerCpf: options.customerDoc || undefined,
    customerName: order.customerName && order.customerName !== 'Cliente Balcão' ? order.customerName : undefined,
    paymentMethod: options.paymentMethod,
    items: items.map((i, idx) => {
      const mods = parseModifiers(i.modifiers).map((m) => m.name).join(', ');
      return {
        productId: i.productId,
        ean: i.unitType === 'BOX' ? (i.product.boxEan || i.product.ean) : i.product.ean,
        code: i.product.code,
        quantity: i.quantity,
        price: i.unitPrice,
        discount: itemDiscounts[idx] || undefined,
        name: mods ? `${i.product.name} (${mods})` : i.product.name,
        ncm: cleanNcm(i.product.ncm),
        cfop: i.product.cfop || '5102',
        unit: i.unitType === 'BOX' ? 'CX' : (i.product.unit || 'un'),
        cest: i.product.cest || undefined
      };
    })
  };

  const res = await fetch(api.getApiUrl() + '/fiscal/emit-nfce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro na transmissão à SEFAZ.');

  const referencia = data.referencia || data.ref || '';
  const isOk = data.status === 'autorizado' || data.status === 'emitido_contingencia' || data.status === 'contingencia';
  if (!isOk) return { status: 'processing', referencia };
  return { status: 'authorized', danfeUrl: data.caminhoDanfe || null, referencia };
}

// Impressão do DANFE NFC-e: silenciosa na térmica pelo Electron, ou abre o PDF no navegador
export function printNfceDanfe(url: string | null) {
  if (!url) return;
  const electron = (window as any).electronAPI;
  if (electron?.printPdfSilent) electron.printPdfSilent(url);
  else window.open(url, '_blank');
}
