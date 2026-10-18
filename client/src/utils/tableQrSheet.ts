import QRCode from 'qrcode';
import { Table } from '../types';

// Folha A4 com o QR Code do cardápio digital de cada mesa (6 por página, com linha de recorte)

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export const tableMenuUrl = (menuUrl: string, tableNumber?: number) =>
  tableNumber ? `${menuUrl}?mesa=${tableNumber}` : menuUrl;

async function qrSvg(url: string) {
  return QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0c0a09', light: '#ffffff' } });
}

export async function buildTableQrSheetHtml(menuUrl: string, storeName: string, tables: Pick<Table, 'number' | 'name'>[]) {
  const sorted = [...tables].sort((a, b) => a.number - b.number);
  const cards = [
    // Primeiro cartão sem mesa: para o balcão, a entrada ou as redes sociais
    { label: 'Cardápio', big: '', extra: 'Balcão e entrada', url: tableMenuUrl(menuUrl) },
    ...sorted.map((t) => ({
      label: 'Mesa',
      big: String(t.number),
      extra: t.name && t.name.trim() && t.name.trim() !== String(t.number) ? t.name.trim() : '',
      url: tableMenuUrl(menuUrl, t.number)
    }))
  ];

  const rendered = await Promise.all(
    cards.map(async (card) => `
      <div class="card">
        <p class="store">${escapeHtml(storeName)}</p>
        <p class="label">${escapeHtml(card.label)}${card.big ? ` <span class="big">${escapeHtml(card.big)}</span>` : ''}</p>
        ${card.extra ? `<p class="extra">${escapeHtml(card.extra)}</p>` : ''}
        <div class="qr">${await qrSvg(card.url)}</div>
        <p class="hint">Aponte a câmera do celular<br/>para ver o cardápio</p>
      </div>`)
  );

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>QR Codes das mesas</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #0c0a09; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: 91mm; gap: 0; }
  .card {
    border: 1px dashed #a8a29e;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 4mm; overflow: hidden; break-inside: avoid; page-break-inside: avoid;
  }
  .store { font-size: 11pt; font-weight: 800; letter-spacing: 0.02em; color: #57534e; max-width: 80mm; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .label { font-size: 15pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 1mm; }
  .big { font-size: 26pt; font-weight: 900; letter-spacing: 0; color: #b45309; }
  .extra { font-size: 9pt; font-weight: 600; color: #78716c; }
  .qr { width: 44mm; height: 44mm; margin: 2.5mm 0; flex-shrink: 0; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .hint { font-size: 9pt; font-weight: 600; color: #57534e; line-height: 1.3; }
</style>
</head>
<body>
  <div class="grid">${rendered.join('')}</div>
</body>
</html>`;
}

// Electron: salva o PDF e abre no leitor (window.print() iria direto para a térmica).
// Navegador: imprime por um iframe oculto.
export async function exportTableQrSheet(html: string): Promise<{ success: boolean; canceled?: boolean; error?: string }> {
  const electron = (window as any).electronAPI;
  if (typeof electron?.saveHtmlAsPdf === 'function') {
    return electron.saveHtmlAsPdf({ html, defaultName: 'QR Codes das mesas.pdf' });
  }
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  frame.srcdoc = html;
  await new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 60_000);
  return { success: true };
}
