import express from 'express';
import cors from 'cors';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initDb, devDb } from './db.ts';
import { 
  generateSignedLicenseToken, 
  generateOfflineKey, 
  DEFAULT_LICENSE_SECRET 
} from './licenseCrypto.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializa banco do painel
await initDb();

const app = express();
const PORT = process.env.PORT || process.env.DEV_PANEL_PORT || 4500;

app.use(cors());
app.use(express.json());

// Logger simples
app.use((req, res, next) => {
  console.log(`[DevPanel API] ${req.method} ${req.url}`);
  next();
});

// ============================================================================
// 1. ENDPOINT PÚBLICO: Verificação de Licença consumida pelo Bar ERP
// ============================================================================
app.get('/api/v1/licenses/check/:machineId', async (req, res) => {
  const { machineId } = req.params;
  if (!machineId) {
    return res.status(400).json({ success: false, error: 'ID da máquina não informado' });
  }

  try {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const checkResult = await devDb.checkLicenseByMachineId(machineId, String(clientIp));
    const settings = await devDb.getSettings();

    const developerContact = {
      developerName: settings.developer_name || 'Software House',
      phone: settings.developer_phone || '',
      pixKey: settings.pix_key || '',
    };

    if (!checkResult.found) {
      return res.json({
        success: true,
        found: false,
        valid: false,
        status: 'UNREGISTERED',
        machineId,
        message: 'Esta máquina ainda não está registrada no painel da Software House.',
        developerContact,
      });
    }

    let token: string | undefined = undefined;
    if (checkResult.valid && checkResult.expiresAt) {
      token = generateSignedLicenseToken({
        machineId,
        expiresAt: checkResult.expiresAt,
        clientName: checkResult.clientName || 'Cliente',
        issuedAt: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      found: true,
      valid: checkResult.valid,
      status: checkResult.status,
      machineId: checkResult.machineId,
      clientName: checkResult.clientName,
      expiresAt: checkResult.expiresAt,
      daysRemaining: checkResult.daysRemaining,
      token,
      developerContact,
      message: checkResult.valid 
        ? 'Licença ativa e regular.' 
        : (checkResult.status === 'BLOCKED' ? 'Máquina bloqueada pelo desenvolvedor.' : 'Mensalidade expirada.'),
    });
  } catch (err: any) {
    console.error('[DevPanel API Error checkLicense]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 2. ROTAS ADMINISTRATIVAS: Gestão do Desenvolvedor
// ============================================================================

// Métricas gerais do dashboard
app.get('/api/admin/metrics', async (req, res) => {
  try {
    const metrics = await devDb.getMetrics();
    res.json({ success: true, ...metrics });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Listagem de clientes e máquinas
app.get('/api/admin/clients', async (req, res) => {
  try {
    const search = req.query.search ? String(req.query.search) : undefined;
    const clients = await devDb.listClients(search);
    res.json({ success: true, clients });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Cadastrar novo cliente (com máquina opcional)
app.post('/api/admin/clients', async (req, res) => {
  try {
    const { businessName, ownerName, phone, document, city, state, monthlyFee, machineId, machineName, initialDays } = req.body;
    if (!businessName || !phone) {
      return res.status(400).json({ success: false, error: 'Nome do Estabelecimento e Telefone/WhatsApp são obrigatórios.' });
    }

    const client = await devDb.createClient({
      businessName,
      ownerName,
      phone,
      document,
      city,
      state,
      monthlyFee: monthlyFee ? Number(monthlyFee) : 150.0,
      machineId,
      machineName,
      initialDays: initialDays ? Number(initialDays) : 30,
    });

    res.json({ success: true, client });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Atualizar cliente
app.put('/api/admin/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await devDb.updateClient(id, req.body);
    res.json({ success: true, client: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Excluir cliente
app.delete('/api/admin/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await devDb.deleteClient(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Adicionar nova máquina a um cliente
app.post('/api/admin/clients/:id/machines', async (req, res) => {
  try {
    const { id } = req.params;
    const { machineId, machineName, days } = req.body;
    if (!machineId) {
      return res.status(400).json({ success: false, error: 'ID da máquina é obrigatório.' });
    }

    const license = await devDb.addMachineToClient(id, machineId, machineName, days ? Number(days) : 30);
    res.json({ success: true, license });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Renovar máquina remota (Ação principal do comprovante)
app.post('/api/admin/licenses/renew', async (req, res) => {
  try {
    const { machineId, daysToAdd, amountPaid, notes } = req.body;
    if (!machineId) {
      return res.status(400).json({ success: false, error: 'ID da máquina é obrigatório.' });
    }

    const result = await devDb.renewLicense(
      machineId, 
      daysToAdd ? Number(daysToAdd) : 30, 
      amountPaid !== undefined ? Number(amountPaid) : undefined, 
      notes
    );

    // Gera chave offline de brinde caso o dev queira mandar no zap
    const offlineKey = generateOfflineKey(machineId, result.newExpiresAt);

    res.json({
      success: true,
      ...result,
      offlineKey
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Bloquear / Desbloquear máquina
app.post('/api/admin/licenses/toggle-block', async (req, res) => {
  try {
    const { machineId } = req.body;
    if (!machineId) return res.status(400).json({ success: false, error: 'ID da máquina é obrigatório.' });
    const result = await devDb.toggleBlockLicense(machineId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Obter chave de ativação offline para envio por WhatsApp
app.get('/api/admin/licenses/offline-key/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params;
    const checkResult = await devDb.checkLicenseByMachineId(machineId);
    if (!checkResult.found || !checkResult.expiresAt) {
      return res.status(404).json({ success: false, error: 'Máquina não encontrada ou sem expiração válida.' });
    }

    const key = generateOfflineKey(machineId, checkResult.expiresAt);
    res.json({
      success: true,
      machineId,
      expiresAt: checkResult.expiresAt,
      offlineKey: key,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Configurações do Desenvolvedor (PIX, WhatsApp, etc)
app.get('/api/admin/settings', async (req, res) => {
  try {
    const settings = await devDb.getSettings();
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/settings', async (req, res) => {
  try {
    await devDb.updateSettings(req.body);
    res.json({ success: true, settings: await devDb.getSettings() });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Servir arquivos estáticos do frontend (produção / standalone)
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.send('🚀 Painel do Desenvolvedor - Backend Ativo na porta ' + PORT);
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 PAINEL DO DESENVOLVEDOR (SOFTWARE HOUSE) ONLINE`);
  console.log(`📡 URL Local: http://localhost:${PORT}`);
  console.log(`🛡️  Endpoint de Licença: http://localhost:${PORT}/api/v1/licenses/check/:machineId`);
  console.log(`=======================================================`);
});
