import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { WaiterApp } from './WaiterApp.tsx'
import { KdsApp } from './KdsApp.tsx'

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
