import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';

export function createSystemRouter() {
  const router = Router();

  router.get('/backup-status', (req, res) => {
    try {
      // O DB URL tem o formato file:C:/Users/.../bar.db
      const dbUrl = process.env.DATABASE_URL || '';
      const dbPath = dbUrl.replace('file:', '');
      
      let lastBackup = null;
      let totalBackups = 0;
      
      if (dbPath && fs.existsSync(dbPath)) {
        const userDataPath = path.dirname(dbPath);
        const backupsDir = path.join(userDataPath, 'backups');
        
        if (fs.existsSync(backupsDir)) {
          const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.db'));
          totalBackups = files.length;
          
          if (files.length > 0) {
            // Sort to get newest
            files.sort((a, b) => b.localeCompare(a));
            lastBackup = files[0];
          }
        }
      }
      
      res.json({ success: true, lastBackup, totalBackups });
    } catch (err: any) {
      res.json({ success: false, error: err.message });
    }
  });

  return router;
}
