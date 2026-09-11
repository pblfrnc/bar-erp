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

// Get current settings (including license status)
router.get('/', async (req, res) => {
  try {
    let settings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
    
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
          isLicensed: false
        }
      });
    }

    // Verify if license is still valid for this machine
    if (settings.isLicensed && settings.licenseEmail && settings.licenseKey) {
      const expectedKey = generateExpectedKey(settings.licenseEmail, currentMachineId);
      if (expectedKey !== settings.licenseKey) {
        // License invalid (machine changed or key tampered)
        settings = await prisma.systemSettings.update({
          where: { id: 'default' },
          data: { isLicensed: false }
        });
      }
    } else {
       // Just update the machineId if it was empty
       if (settings.machineId !== currentMachineId) {
         settings = await prisma.systemSettings.update({
           where: { id: 'default' },
           data: { machineId: currentMachineId }
         });
       }
    }

    // Don't send the actual key to the frontend
    const { licenseKey, ...safeSettings } = settings;
    res.json(safeSettings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

// Activate license
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
          isLicensed: true
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
  qrSize: 170,
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
        "qrSize" REAL DEFAULT 170,
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
        qrSize: Number(row.qrSize) || 170,
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
    const qrSize = Number(body.qrSize ?? 170);
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
