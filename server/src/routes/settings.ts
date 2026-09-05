import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { createHmac } from 'crypto';
import { machineIdSync } from 'node-machine-id';

const prisma = new PrismaClient();
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

export function createSettingsRouter() {
  return router;
}
