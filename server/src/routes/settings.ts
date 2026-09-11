import { Router } from 'express';
import { prisma } from '../prisma.js';
import { createHmac } from 'crypto';
import machineId from 'node-machine-id';
const machineIdSync = machineId.machineIdSync;

const router = Router();
const SECRET_KEY = process.env.LICENSE_SECRET_KEY || 'BAR_ERP_SUPER_SECRET_KEY_2026';

function generateExpectedKey(email: string, machineId: string) {
  return createHmac('sha256', SECRET_KEY)
    .update(`${email}:${machineId}`)
    .digest('hex');
}

/**
 * Valida chave de ativação offline compacta: EXP-YYYYMMDD-MAC8-SIG8
 */
function verifyOfflineKey(key: string, currentMachineId: string) {
  try {
    const parts = key.trim().toUpperCase().split('-');
    if (parts.length !== 4 || parts[0] !== 'EXP') {
      return { valid: false, error: 'Formato de chave inválido. Formato esperado: EXP-AAAAMMDD-XXXX-YYYY' };
    }

    const expStr = parts[1];
    const macPart = parts[2];
    const sigPart = parts[3];

    const cleanMac = currentMachineId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
    if (macPart !== cleanMac) {
      return { valid: false, error: 'Esta chave foi gerada para outro computador e não é válida nesta máquina.' };
    }

    const rawData = `${cleanMac}:${expStr}`;
    const expectedSig = createHmac('sha256', SECRET_KEY).update(rawData).digest('hex').slice(0, 8).toUpperCase();

    if (sigPart !== expectedSig) {
      return { valid: false, error: 'Código de validação incorreto ou chave adulterada.' };
    }

    const year = parseInt(expStr.slice(0, 4), 10);
    const month = parseInt(expStr.slice(4, 6), 10) - 1;
    const day = parseInt(expStr.slice(6, 8), 10);
    const expiresAt = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

    if (isNaN(expiresAt.getTime())) {
      return { valid: false, error: 'Data de expiração inválida na chave.' };
    }

    if (expiresAt < new Date()) {
      return { valid: false, error: `Esta chave de licença expirou em ${expiresAt.toLocaleDateString('pt-BR')}.` };
    }

    return { valid: true, expiresAt };
  } catch (err: any) {
    return { valid: false, error: 'Falha ao processar chave offline.' };
  }
}

// Get current settings (including license status and expiration)
router.get('/', async (req, res) => {
  try {
    let settings: any = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
    
    let currentMachineId = '';
    try {
      currentMachineId = machineIdSync();
    } catch (e) {
      currentMachineId = 'unknown-machine';
    }

    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          id: 'default',
          restaurantName: 'Meu Bar',
          machineId: currentMachineId,
          isLicensed: false,
          licenseStatus: 'UNLICENSED'
        }
      });
    }

    // Atualiza machineId se estava vazio
    if (settings.machineId !== currentMachineId) {
      settings = await prisma.systemSettings.update({
        where: { id: 'default' },
        data: { machineId: currentMachineId }
      });
    }

    // Verificação de expiração mensal
    let isLicensed = Boolean(settings.isLicensed);
    let daysRemaining = 0;
    let isExpiringSoon = false;

    if (settings.expiresAt) {
      const now = new Date();
      const expDate = new Date(settings.expiresAt);
      const diffMs = expDate.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (now > expDate) {
        // Licença expirou!
        if (isLicensed) {
          isLicensed = false;
          settings = await prisma.systemSettings.update({
            where: { id: 'default' },
            data: { isLicensed: false, licenseStatus: 'EXPIRED' }
          });
        }
      } else if (daysRemaining <= 5 && isLicensed) {
        // Faltam 5 dias ou menos
        isExpiringSoon = true;
      }
    } else if (settings.isLicensed && settings.licenseEmail && settings.licenseKey) {
      // Checagem de licença legado por hash
      const expectedKey = generateExpectedKey(settings.licenseEmail, currentMachineId);
      if (expectedKey !== settings.licenseKey) {
        isLicensed = false;
        settings = await prisma.systemSettings.update({
          where: { id: 'default' },
          data: { isLicensed: false, licenseStatus: 'INVALID' }
        });
      }
    }

    // Parse developer contact se houver
    let developerContact = {
      phone: '5547974002560',
      pixKey: '68.817.608/0001-47',
      developerName: 'Pablo Franco - Software House'
    };
    if (settings.developerContact) {
      try {
        const parsed = JSON.parse(settings.developerContact);
        // Atualiza se ainda tiver o número provisório antigo
        if (parsed.phone && (parsed.phone.includes('91988887777') || parsed.phone.includes('988887777'))) {
          parsed.phone = '5547974002560';
        }
        developerContact = { ...developerContact, ...parsed };
      } catch (e) {}
    }

    // Don't send the actual secret key to the frontend
    const { licenseKey, ...safeSettings } = settings;
    res.json({
      ...safeSettings,
      isLicensed,
      daysRemaining,
      isExpiringSoon,
      developerContact,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

// Sincronização e verificação remota com o Servidor de Licenças da Software House
router.post('/license/sync-remote', async (req, res) => {
  try {
    let currentMachineId = '';
    try {
      currentMachineId = machineIdSync();
    } catch (e) {
      currentMachineId = 'unknown-machine';
    }

    let settings: any = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
    const serverUrl = req.body.serverUrl || process.env.LICENSE_SERVER_URL || settings?.licenseServerUrl || 'https://bar-erp-licensas.onrender.com';

    console.log(`[Licensing] Sincronizando licença com: ${serverUrl}/api/v1/licenses/check/${currentMachineId}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    let remoteRes: Response;
    try {
      remoteRes = await fetch(`${serverUrl}/api/v1/licenses/check/${currentMachineId}`, {
        signal: controller.signal
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      console.warn('[Licensing] Falha ao conectar no servidor remoto:', fetchErr.message);

      // Se a máquina já tiver uma licença válida no banco e não vencida, tolera queda de internet
      if (settings?.isLicensed && settings?.expiresAt && new Date(settings.expiresAt) > new Date()) {
        const days = Math.ceil((new Date(settings.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return res.json({
          success: true,
          offlineFallback: true,
          message: `Servidor remoto inacessível, mas sua licença local continua ativa até ${new Date(settings.expiresAt).toLocaleDateString('pt-BR')} (${days} dias restantes).`,
          isLicensed: true,
          expiresAt: settings.expiresAt,
          daysRemaining: days
        });
      }

      return res.status(503).json({
        success: false,
        error: 'Não foi possível conectar ao servidor de licenças. Verifique sua conexão à internet ou use uma chave de ativação offline.'
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const data: any = await remoteRes.json();

    if (data.success && data.valid && data.expiresAt) {
      // Licença ativada/renovada com sucesso pelo desenvolvedor!
      const updated = await prisma.systemSettings.update({
        where: { id: 'default' },
        data: {
          isLicensed: true,
          machineId: currentMachineId,
          expiresAt: new Date(data.expiresAt),
          clientName: data.clientName || 'Cliente',
          licenseStatus: 'ACTIVE',
          licenseServerUrl: serverUrl,
          lastVerifiedAt: new Date(),
          developerContact: data.developerContact ? JSON.stringify(data.developerContact) : undefined,
        }
      });

      return res.json({
        success: true,
        activated: true,
        message: 'Licença ativada e regularizada com sucesso!',
        expiresAt: data.expiresAt,
        daysRemaining: data.daysRemaining,
        clientName: data.clientName
      });
    } else {
      // Servidor remoto retornou que a máquina está expirada, bloqueada ou não registrada
      await prisma.systemSettings.update({
        where: { id: 'default' },
        data: {
          isLicensed: false,
          licenseStatus: data.status || 'EXPIRED',
          lastVerifiedAt: new Date(),
          developerContact: data.developerContact ? JSON.stringify(data.developerContact) : undefined,
        }
      });

      return res.status(403).json({
        success: false,
        activated: false,
        status: data.status,
        message: data.message || 'Máquina não licenciada ou mensalidade expirada.',
        developerContact: data.developerContact
      });
    }
  } catch (error: any) {
    console.error('[Licensing] Erro ao sincronizar licença remota:', error);
    res.status(500).json({ success: false, error: error?.message || 'Erro interno ao processar sincronização de licença.' });
  }
});

// Ativação por Chave Offline (sem internet)
router.post('/license/offline', async (req, res) => {
  const { key } = req.body;
  if (!key || typeof key !== 'string') {
    return res.status(400).json({ success: false, error: 'Chave de ativação é obrigatória.' });
  }

  try {
    let currentMachineId = '';
    try {
      currentMachineId = machineIdSync();
    } catch (e) {
      currentMachineId = 'unknown-machine';
    }

    const verification = verifyOfflineKey(key, currentMachineId);
    if (!verification.valid || !verification.expiresAt) {
      return res.status(400).json({ success: false, error: verification.error || 'Chave de ativação inválida.' });
    }

    const updated = await prisma.systemSettings.update({
      where: { id: 'default' },
      data: {
        isLicensed: true,
        machineId: currentMachineId,
        expiresAt: verification.expiresAt,
        licenseKey: key.trim(),
        licenseStatus: 'ACTIVE',
        lastVerifiedAt: new Date(),
      }
    });

    const days = Math.ceil((verification.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    return res.json({
      success: true,
      message: `Licença offline ativada com sucesso! Válida até ${verification.expiresAt.toLocaleDateString('pt-BR')} (${days} dias).`,
      expiresAt: verification.expiresAt,
      daysRemaining: days
    });
  } catch (error: any) {
    console.error('Error activating offline license:', error);
    res.status(500).json({ success: false, error: 'Erro ao ativar licença offline.' });
  }
});

// Activate license (modo legado com email e hash permanente)
router.post('/license', async (req, res) => {
  const { email, key } = req.body;
  if (!email || !key) {
    return res.status(400).json({ error: 'Email e chave são obrigatórios.' });
  }

  try {
    const currentMachineId = machineIdSync();
    const expectedKey = generateExpectedKey(email, currentMachineId);

    if (key.trim() === expectedKey) {
      const settings = await prisma.systemSettings.update({
        where: { id: 'default' },
        data: {
          licenseEmail: email.trim(),
          licenseKey: key.trim(),
          machineId: currentMachineId,
          isLicensed: true,
          licenseStatus: 'ACTIVE'
        }
      });
      const { licenseKey, ...safeSettings } = settings;
      return res.json({ success: true, settings: safeSettings });
    } else {
      return res.status(401).json({ error: 'Chave de licença inválida para este computador.' });
    }
  } catch (error) {
    console.error('Error activating license:', error);
    res.status(500).json({ error: 'Erro ao ativar licença' });
  }
});

// ============================================================
// Configurações Globais de Impressoras Térmicas (80mm / 58mm / Margens)
// ============================================================
export const defaultPrinterSettings = {
  id: 'default',
  cashierPrinter: '',
  kitchenPrinter: '',
  paperWidth: 80,
  marginTop: 2,
  marginBottom: 12,
  marginLeft: 1,
  marginRight: 1,
  fontScale: 100,
  qrSize: 100,
  autoCut: true,
  silentPrint: true,
  copies: 1,
  extraFeedLines: 3,
  printLogo: true
};

let printerTableEnsured = false;
async function ensurePrinterSettingsTable() {
  if (printerTableEnsured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PrinterSettings" (
        "id" TEXT PRIMARY KEY DEFAULT 'default',
        "cashierPrinter" TEXT,
        "kitchenPrinter" TEXT,
        "paperWidth" REAL DEFAULT 80,
        "marginTop" REAL DEFAULT 2,
        "marginBottom" REAL DEFAULT 12,
        "marginLeft" REAL DEFAULT 1,
        "marginRight" REAL DEFAULT 1,
        "fontScale" REAL DEFAULT 100,
        "qrSize" REAL DEFAULT 100,
        "autoCut" BOOLEAN DEFAULT 1,
        "silentPrint" BOOLEAN DEFAULT 1,
        "copies" INTEGER DEFAULT 1,
        "extraFeedLines" INTEGER DEFAULT 3,
        "printLogo" BOOLEAN DEFAULT 1,
        "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    printerTableEnsured = true;
  } catch (err) {
    console.warn('Tabela PrinterSettings já verificada:', err);
  }
}

export async function getPrinterSettingsSafe() {
  try {
    await ensurePrinterSettingsTable();
    const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "PrinterSettings" WHERE "id" = 'default' LIMIT 1`);
    if (rows && rows.length > 0) {
      const row = rows[0];
      return {
        id: row.id || 'default',
        cashierPrinter: row.cashierPrinter || '',
        kitchenPrinter: row.kitchenPrinter || '',
        paperWidth: Number(row.paperWidth) || 80,
        marginTop: Number(row.marginTop) || 2,
        marginBottom: Number(row.marginBottom) || 12,
        marginLeft: Number(row.marginLeft) || 1,
        marginRight: Number(row.marginRight) || 1,
        fontScale: Number(row.fontScale) || 100,
        qrSize: Number(row.qrSize) || 100,
        autoCut: Boolean(row.autoCut),
        silentPrint: Boolean(row.silentPrint),
        copies: Number(row.copies) || 1,
        extraFeedLines: Number(row.extraFeedLines) || 3,
        printLogo: Boolean(row.printLogo)
      };
    }
  } catch (e) {
    console.warn('Erro ao consultar PrinterSettings, usando padrões:', e);
  }
  return { ...defaultPrinterSettings };
}

// Obter configurações de impressoras
router.get('/printer', async (req, res) => {
  try {
    const settings = await getPrinterSettingsSafe();
    res.json(settings);
  } catch (error) {
    console.error('Erro ao buscar configurações de impressora:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações de impressora' });
  }
});

// Atualizar configurações de impressoras
router.post('/printer', async (req, res) => {
  try {
    await ensurePrinterSettingsTable();
    const body = req.body || {};

    const cashierPrinter = String(body.cashierPrinter || '').trim();
    const kitchenPrinter = String(body.kitchenPrinter || '').trim();
    const paperWidth = Number(body.paperWidth) || 80;
    const marginTop = Number(body.marginTop ?? 2);
    const marginBottom = Number(body.marginBottom ?? 12);
    const marginLeft = Number(body.marginLeft ?? 1);
    const marginRight = Number(body.marginRight ?? 1);
    const fontScale = Number(body.fontScale ?? 100);
    const qrSize = Number(body.qrSize ?? 100);
    const autoCut = body.autoCut !== false ? 1 : 0;
    const silentPrint = body.silentPrint !== false ? 1 : 0;
    const copies = Math.max(1, Number(body.copies || 1));
    const extraFeedLines = Math.max(0, Number(body.extraFeedLines ?? 3));
    const printLogo = body.printLogo !== false ? 1 : 0;

    await prisma.$executeRawUnsafe(`
      INSERT INTO "PrinterSettings" (
        "id", "cashierPrinter", "kitchenPrinter", "paperWidth",
        "marginTop", "marginBottom", "marginLeft", "marginRight",
        "fontScale", "qrSize", "autoCut", "silentPrint",
        "copies", "extraFeedLines", "printLogo", "updatedAt"
      ) VALUES (
        'default', ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, CURRENT_TIMESTAMP
      )
      ON CONFLICT("id") DO UPDATE SET
        "cashierPrinter" = excluded."cashierPrinter",
        "kitchenPrinter" = excluded."kitchenPrinter",
        "paperWidth" = excluded."paperWidth",
        "marginTop" = excluded."marginTop",
        "marginBottom" = excluded."marginBottom",
        "marginLeft" = excluded."marginLeft",
        "marginRight" = excluded."marginRight",
        "fontScale" = excluded."fontScale",
        "qrSize" = excluded."qrSize",
        "autoCut" = excluded."autoCut",
        "silentPrint" = excluded."silentPrint",
        "copies" = excluded."copies",
        "extraFeedLines" = excluded."extraFeedLines",
        "printLogo" = excluded."printLogo",
        "updatedAt" = CURRENT_TIMESTAMP;
    `,
      cashierPrinter, kitchenPrinter, paperWidth,
      marginTop, marginBottom, marginLeft, marginRight,
      fontScale, qrSize, autoCut, silentPrint,
      copies, extraFeedLines, printLogo
    );

    const updated = await getPrinterSettingsSafe();
    res.json({ success: true, settings: updated });
  } catch (error: any) {
    console.error('Erro ao salvar configurações de impressora:', error);
    res.status(500).json({ error: error.message || 'Erro ao salvar configurações de impressora' });
  }
});

export function createSettingsRouter() {
  return router;
}
