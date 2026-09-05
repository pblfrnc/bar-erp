import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { WaiterApp } from './WaiterApp.tsx'
import { KdsApp } from './KdsApp.tsx'

// Determina qual aplicativo carregar com base na plataforma ou rota:
// 1. App da Cozinha / KDS: rota /kds ou /cozinha
// 2. App do Garçom: build Android (APK), Capacitor nativo ou rota /garcom
// 3. Painel do PC / Gestão: padrão desktop / caixa
const pathname = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
const isKds = pathname.startsWith('/kds') || pathname.startsWith('/cozinha');

const isNative = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());
const isWaiterTarget = import.meta.env.VITE_APP_TARGET === 'waiter';
const isGarcomUrl = pathname.startsWith('/garcom') || pathname.startsWith('/waiter');

const isWaiterApp = !isKds && (isWaiterTarget || isNative || isGarcomUrl);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isKds ? <KdsApp /> : isWaiterApp ? <WaiterApp /> : <App />}
  </StrictMode>,
)
