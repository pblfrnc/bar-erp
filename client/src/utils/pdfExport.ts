// Gera PDF a partir de HTML.
// Electron: salva o PDF e abre no leitor (window.print() iria direto para a térmica, por causa do kiosk-printing).
// Navegador: imprime por um iframe oculto.

export const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export async function exportHtmlAsPdf(
  html: string,
  defaultName: string
): Promise<{ success: boolean; canceled?: boolean; error?: string }> {
  const electron = (window as any).electronAPI;
  if (typeof electron?.saveHtmlAsPdf === 'function') {
    return electron.saveHtmlAsPdf({ html, defaultName });
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
