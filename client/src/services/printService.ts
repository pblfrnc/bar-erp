import { Order } from '../types';
import { api } from './api';

// Evento global: qualquer tela pede a impressão do comprovante de um pedido específico
export const PRINT_RECEIPT_EVENT = 'barerp:print-receipt';

// Computador do caixa (Electron) imprime direto na térmica; celular e navegador enviam para ele
export function isPrintStation(): boolean {
  return Boolean((window as any).electronAPI?.printSilent);
}

// Dispara a impressão do DOM atual (silenciosa no Electron, diálogo do navegador no web/Android)
export function triggerPrint() {
  const electron = (window as any).electronAPI;
  if (electron?.printSilent) {
    electron.printSilent();
  } else {
    window.print();
  }
}

// Pedidos com envio ao caixa em andamento (ignora toques repetidos no botão)
const pendingRemotePrints = new Set<string>();

// Rótulo do botão de impressão conforme o dispositivo
export const printButtonLabel = () => (isPrintStation() ? 'Imprimir 80mm' : 'Imprimir no Caixa');

// Imprime o comprovante (conferência / pedido fechado) do pedido informado
export async function printOrderReceipt(order: Order | null | undefined) {
  if (!order) return;
  if (isPrintStation()) {
    window.dispatchEvent(new CustomEvent<Order>(PRINT_RECEIPT_EVENT, { detail: order }));
    return;
  }
  if (pendingRemotePrints.has(order.id)) return;
  pendingRemotePrints.add(order.id);
  try {
    await api.printReceiptOnCashier(order.id, localStorage.getItem('bar_waiter_name') || undefined);
    alert('Recibo enviado para a impressora do caixa.');
  } catch (err: any) {
    alert(err.message || 'Não foi possível enviar o recibo para a impressora do caixa.');
  } finally {
    pendingRemotePrints.delete(order.id);
  }
}
