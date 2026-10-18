import { Router } from 'express';
import { getBackupStatus, runBackup, saveBackupSettings } from '../services/backupService.js';

export function createSystemRouter() {
  const router = Router();

  router.get('/backup-status', async (req, res) => {
    try {
      res.json(await getBackupStatus());
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao consultar o backup' });
    }
  });

  router.put('/backup-settings', async (req, res) => {
    try {
      const { externalFolder, enabled, keep } = req.body || {};
      const settings = await saveBackupSettings({ externalFolder, enabled, keep });
      res.json({ success: true, settings });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Erro ao salvar a configuração de backup' });
    }
  });

  router.post('/backup-now', async (req, res) => {
    const result = await runBackup('manual');
    res.status(result.error ? 500 : 200).json(result);
  });

  return router;
}
