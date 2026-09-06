import { prisma } from './prisma.js';
import { runRuntimeMigrations } from './runMigrations.js';

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import compression from 'compression';
import os from 'os';
import { createTablesRouter } from './routes/tables.js';
import { createOrdersRouter } from './routes/orders.js';
import { createFiscalRouter } from './routes/fiscal.js';
import { createProductsRouter } from './routes/products.js';
import { createKdsRouter } from './routes/kds.js';
import { createCashRouter } from './routes/cash.js';
import { createDashboardRouter } from './routes/dashboard.js';
import { createWaitersRouter } from './routes/waiters.js';
import { createSettingsRouter } from './routes/settings.js';
import { createAuditLogsRouter } from './routes/auditLogs.js';
import { createCustomersRouter } from './routes/customers.js';
import { createSystemRouter } from './routes/system.js';



import helmet from 'helmet';
import rateLimit from 'express-rate-limit';


const app = express();
const httpServer = createServer(app);

// Compressão de payload para tráfego veloz no Wi-Fi do bar
app.use(compression());
app.use(cors());
app.use(express.json());

// Segurança e Defesa na Rede Local
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
})); // Previne ataques de injeção e cabeçalhos HTTP maliciosos, ajustado para rodar em Electron/Localhost

// Proteção contra ataques de negação de serviço (Rate Limiting)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500, // Limite de 500 requests por IP a cada 15 min
  message: { error: "Muitas requisições deste IP, tente novamente mais tarde." }
});
app.use("/api", limiter);

app.use("/api/settings", createSettingsRouter());
app.use("/api/audit-logs", createAuditLogsRouter());
app.use("/api/customers", createCustomersRouter());
app.use("/api/system", createSystemRouter());





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

  console.log(`⚡ Dispositivo conectado (${clientType}): ${socket.id} (IP: ${ip})`);
  io.emit('devices_updated', Array.from(activeDevices.values()));

  socket.on('disconnect', (reason) => {
    activeDevices.delete(socket.id);
    console.log(`🔌 Dispositivo desconectado (${reason}): ${socket.id}`);
    io.emit('devices_updated', Array.from(activeDevices.values()));
  });
});

// Rotas da API
app.use('/api/tables', createTablesRouter(io));
app.use('/api/orders', createOrdersRouter(io));
app.use('/api/products', createProductsRouter());
app.use('/api/kds', createKdsRouter(io));
app.use('/api/cash', createCashRouter(io));
app.use('/api/dashboard', createDashboardRouter());
app.use('/api/waiters', createWaitersRouter());
app.use('/api/fiscal', createFiscalRouter());

app.get('/api/network/devices', (req, res) => {
  res.json(Array.from(activeDevices.values()));
});

// Obter os endereços IP locais da rede Wi-Fi
function getLocalIps(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  
  for (const name of Object.keys(interfaces)) {
    const isVirtual = name.toLowerCase().includes('virtual') || name.toLowerCase().includes('vmware') || name.toLowerCase().includes('vethernet') || name.toLowerCase().includes('wsl') || name.toLowerCase().includes('tailscale') || name.toLowerCase().includes('hamachi');
    if (isVirtual) continue;
    
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        // Priorizar IPs comuns de rede local
        if (net.address.startsWith('192.168.')) {
          ips.unshift(net.address); // Joga pro topo
        } else {
          ips.push(net.address);
        }
      }
    }
  }
  return ips;
}

const PORT = Number(process.env.PORT) || 3001;

// Rota de Healthcheck e identificação de rede
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    uptime: process.uptime(),
    ips: getLocalIps(),
    port: PORT
  });
});

// Tratamento de erros de inicialização (ex: porta 3001 já ocupada)
httpServer.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`\n⚠️  [AVISO]: A porta ${PORT} já está em uso por outro processo do BarERP. Conectando à instância existente.`);
  } else {
    console.error('❌ [ERRO NO SERVIDOR HTTP]:', err);
  }
});

// Vincula a 0.0.0.0 para que qualquer celular ou tablet no Wi-Fi do bar consiga conectar
  

const start = async () => {
  await runRuntimeMigrations(prisma);
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
};

start();
