import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import compression from 'compression';
import os from 'os';
import { createTablesRouter } from './routes/tables.js';
import { createOrdersRouter } from './routes/orders.js';
import { createProductsRouter } from './routes/products.js';
import { createKdsRouter } from './routes/kds.js';
import { createCashRouter } from './routes/cash.js';
import { createDashboardRouter } from './routes/dashboard.js';

const app = express();
const httpServer = createServer(app);

// Compressão de payload para tráfego veloz no Wi-Fi do bar
app.use(compression());
app.use(cors());
app.use(express.json());

// Configuração robusta do WebSocket para resistir a oscilações de Wi-Fi e economia de bateria
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  },
  pingTimeout: 10000,
  pingInterval: 5000,
  transports: ['websocket', 'polling']
});

// Gerenciamento de conexões Socket.IO
io.on('connection', (socket) => {
  console.log(`⚡ Dispositivo conectado (Wi-Fi/Web): ${socket.id}`);

  socket.on('disconnect', (reason) => {
    console.log(`🔌 Dispositivo desconectado (${reason}): ${socket.id}`);
  });
});

// Rotas da API
app.use('/api/tables', createTablesRouter(io));
app.use('/api/orders', createOrdersRouter(io));
app.use('/api/products', createProductsRouter());
app.use('/api/kds', createKdsRouter(io));
app.use('/api/cash', createCashRouter(io));
app.use('/api/dashboard', createDashboardRouter());

// Rota de Healthcheck e identificação de rede
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    uptime: process.uptime()
  });
});

const PORT = Number(process.env.PORT) || 3001;

// Obter os endereços IP locais da rede Wi-Fi
function getLocalIps(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

// Vincula a 0.0.0.0 para que qualquer celular ou tablet no Wi-Fi do bar consiga conectar
httpServer.listen(PORT, '0.0.0.0', () => {
  const localIps = getLocalIps();
  console.log('\n======================================================');
  console.log('🚀 SERVIDOR BAR ERP INICIADO COM SUCESSO');
  console.log(`• Localhost (PC do Caixa): http://localhost:${PORT}`);
  if (localIps.length > 0) {
    console.log('• Celulares/Tablets Android na rede Wi-Fi do Bar:');
    localIps.forEach((ip) => {
      console.log(`   ➜ http://${ip}:${PORT}`);
    });
  }
  console.log('======================================================\n');
});
