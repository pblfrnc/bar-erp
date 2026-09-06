const fs = require('fs');
let code = fs.readFileSync('server/src/index.ts', 'utf8');

const deviceLogic = `
export interface ConnectedDevice {
  socketId: string;
  ip: string;
  userAgent: string;
  connectedAt: Date;
  clientType: string;
  waiterName?: string;
}

export const activeDevices = new Map<string, ConnectedDevice>();

// Gerenciamento de conexões Socket.IO
io.on('connection', (socket) => {
  const ip = socket.handshake.address;
  const userAgent = socket.handshake.headers['user-agent'] || 'Desconhecido';
  const clientType = (socket.handshake.query.clientType as string) || 'Desconhecido';
  const waiterName = socket.handshake.query.waiterName as string;

  activeDevices.set(socket.id, {
    socketId: socket.id,
    ip: ip.replace('::ffff:', ''), // Limpar IPv4 em IPv6
    userAgent,
    connectedAt: new Date(),
    clientType,
    waiterName
  });

  console.log(\`⚡ Dispositivo conectado (\${clientType}): \${socket.id} (IP: \${ip})\`);
  io.emit('devices_updated', Array.from(activeDevices.values()));

  socket.on('disconnect', (reason) => {
    activeDevices.delete(socket.id);
    console.log(\`🔌 Dispositivo desconectado (\${reason}): \${socket.id}\`);
    io.emit('devices_updated', Array.from(activeDevices.values()));
  });
});
`;

code = code.replace(/\/\/ Gerenciamento de conexões Socket\.IO[\s\S]*?\}\);/, deviceLogic.trim());

// Adicionar endpoint para listar dispositivos em /api/network/devices
const routeLogic = `
app.get('/api/network/devices', (req, res) => {
  res.json(Array.from(activeDevices.values()));
});

// Obter os endereços IP locais da rede Wi-Fi`;

code = code.replace(/\/\/ Obter os endereços IP locais da rede Wi-Fi/, routeLogic.trim());

fs.writeFileSync('server/src/index.ts', code);
