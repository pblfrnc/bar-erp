import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { WaiterApp } from './WaiterApp.tsx'

// Determina se este cliente roda o aplicativo dedicado do Garçom:
// 1. Build direcionado para garçom (ex: APK Android gerado)
// 2. Rodando nativamente no app Android (Capacitor)
// 3. Acesso direto pela URL /garcom ou /waiter
const isNative = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());
const isWaiterTarget = import.meta.env.VITE_APP_TARGET === 'waiter';
const isGarcomUrl = typeof window !== 'undefined' && (
  window.location.pathname.startsWith('/garcom') ||
  window.location.pathname.startsWith('/waiter')
);

const isWaiterApp = isWaiterTarget || isNative || isGarcomUrl;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isWaiterApp ? <WaiterApp /> : <App />}
  </StrictMode>,
)
