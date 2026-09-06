const fs = require('fs');
let code = fs.readFileSync('client/src/services/socket.ts', 'utf8');

const replacement = `
const SERVER_URL = getServerBaseUrl();

// Determinar tipo de cliente
let clientType = 'CAIXA_PC';
const appMode = localStorage.getItem('appMode');
if (appMode === 'KDS') clientType = 'COZINHA_KDS';
if (appMode === 'WAITER') clientType = 'GARCOM_MOBILE';

// Obter nome do garçom se existir
let waiterName = localStorage.getItem('bar_waiter_name') || undefined;

export const socket: Socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 2500,
  randomizationFactor: 0.2,
  timeout: 6000,
  query: {
    clientType,
    waiterName
  }
});
`;

code = code.replace(/const SERVER_URL = getServerBaseUrl\(\);[\s\S]*?timeout: 6000\n\}\);/, replacement.trim());
fs.writeFileSync('client/src/services/socket.ts', code);
