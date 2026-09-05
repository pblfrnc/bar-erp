import { io, Socket } from 'socket.io-client';

export function getServerBaseUrl(): string {
  const customUrl = localStorage.getItem('bar_server_url');
  if (customUrl && customUrl.trim() !== '') {
    return customUrl.trim().replace(/\/$/, '');
  }

  // Se executando no navegador ou PWA pela rede local
  const hostname = window.location.hostname;
  if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `http://${hostname}:3001`;
  }

  return 'http://localhost:3001';
}

export function setServerBaseUrl(newUrl: string): void {
  const sanitized = newUrl.trim().replace(/\/$/, '');
  localStorage.setItem('bar_server_url', sanitized);
  window.location.reload();
}

const SERVER_URL = getServerBaseUrl();

export const socket: Socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 2500,
  randomizationFactor: 0.2,
  timeout: 6000
});

// Otimização para Android: reconectar instantaneamente quando a tela do garçom despertar
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (!socket.connected) {
        console.log('⚡ Tela despertada: reconectando ao servidor do bar...');
        socket.connect();
      }
    }
  });

  window.addEventListener('focus', () => {
    if (!socket.connected) {
      socket.connect();
    }
  });

  window.addEventListener('online', () => {
    console.log('📶 Conexão Wi-Fi restabelecida!');
    socket.connect();
  });
}
