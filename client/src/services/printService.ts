import { Order } from '../types';

// Evento global: qualquer tela pede a impressão do comprovante de um pedido específico
export const PRINT_RECEIPT_EVENT = 'barerp:print-receipt';

// Dispara a impressão do DOM atual (silenciosa no Electron, diálogo do navegador no web/Android)
export function triggerPrint() {
  const electron = (window as any).electronAPI;
  if (electron?.printSilent) {
    electron.printSilent();
  } else {
    window.print();
  }
}

// Imprime o comprovante (conferência / pedido fechado) do pedido informado
export function printOrderReceipt(order: Order | null | undefined) {
  if (!order) return;
  window.dispatchEvent(new CustomEvent<Order>(PRINT_RECEIPT_EVENT, { detail: order }));
}
