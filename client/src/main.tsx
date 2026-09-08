import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { WaiterApp } from './WaiterApp.tsx'
import { KdsApp } from './KdsApp.tsx'

// Solução definitiva para o bug clássico do Chromium/Electron no Windows:
// O uso de window.alert() nativo aciona um diálogo Win32 do Windows que desacopla
// permanentemente o teclado dos inputs do Chromium até reiniciar o app.
// Substituímos window.alert por um modal in-DOM estilizado e seguro, sem diálogos nativos.
if (typeof window !== 'undefined') {
  const electron = (window as any).electronAPI;

  window.alert = function (message: any) {
    try {
      const existingAlert = document.getElementById('bar-erp-alert-modal');
      if (existingAlert) {
        existingAlert.remove();
      }

      const modal = document.createElement('div');
      modal.id = 'bar-erp-alert-modal';
      modal.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 9999999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(2, 6, 23, 0.78);
        backdrop-filter: blur(4px);
      `;

      const strMsg = typeof message === 'object' ? JSON.stringify(message, null, 2) : String(message ?? '');

      modal.innerHTML = `
        <div style="
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 1.25rem;
          padding: 1.75rem;
          max-width: 30rem;
          width: 90%;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
          color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        ">
          <div style="display: flex; align-items: flex-start; gap: 1rem;">
            <div style="
              width: 2.75rem;
              height: 2.75rem;
              border-radius: 0.75rem;
              background: rgba(99, 102, 241, 0.15);
              border: 1px solid rgba(99, 102, 241, 0.3);
              color: #818cf8;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            ">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <div style="flex: 1; min-width: 0;">
              <h3 style="margin: 0 0 0.375rem 0; font-size: 1.1rem; font-weight: 700; color: #f8fafc;">Aviso do Sistema</h3>
              <p style="margin: 0; font-size: 0.95rem; line-height: 1.5; color: #cbd5e1; word-break: break-word; white-space: pre-wrap;">${strMsg.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end;">
            <button id="bar-erp-alert-btn" style="
              background: #6366f1;
              color: white;
              border: none;
              padding: 0.625rem 1.5rem;
              border-radius: 0.75rem;
              font-weight: 700;
              font-size: 0.95rem;
              cursor: pointer;
            ">Entendido</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const btn = document.getElementById('bar-erp-alert-btn');
      const closeAlert = () => {
        modal.remove();
        document.removeEventListener('keydown', onKeyDown);
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
          e.preventDefault();
          closeAlert();
        }
      };

      btn?.addEventListener('click', closeAlert);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAlert();
      });
      document.addEventListener('keydown', onKeyDown);
      setTimeout(() => btn?.focus(), 50);
    } catch {
      console.warn('[BarERP Alert]', message);
    }
  };

  // Diálogo seguro de confirmação (usa o IPC seguro do Electron com foco garantido)
  const originalConfirm = window.confirm;
  window.confirm = function (message: any) {
    if (electron && typeof electron.showConfirm === 'function') {
      return electron.showConfirm(String(message ?? ''));
    }
    return originalConfirm.apply(window, [message]);
  };
}

// Determina qual aplicativo carregar com base na plataforma ou rota:
// 1. App da Cozinha / KDS: build com target kds, ou rota /kds ou /cozinha
// 2. App do Garçom: build com target waiter, Capacitor nativo ou rota /garcom
// 3. Painel do PC / Gestão: padrão desktop / caixa
const pathname = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
const isKdsTarget = import.meta.env.VITE_APP_TARGET === 'kds' || import.meta.env.MODE === 'kds';
const isKdsUrl = pathname.startsWith('/kds') || pathname.startsWith('/cozinha');
const isKds = isKdsTarget || isKdsUrl;

const isWaiterTarget = import.meta.env.VITE_APP_TARGET === 'waiter' || import.meta.env.MODE === 'waiter';
const isGarcomUrl = pathname.startsWith('/garcom') || pathname.startsWith('/waiter');
const isNative = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());

const isWaiterApp = !isKds && (isWaiterTarget || isNative || isGarcomUrl);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isKds ? <KdsApp /> : isWaiterApp ? <WaiterApp /> : <App />}
  </StrictMode>,
)
