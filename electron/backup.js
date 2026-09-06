const fs = require('fs');
const path = require('path');

function setupDailyBackup(userDataPath, dbFileName = 'bar.db') {
  try {
    const dbPath = path.join(userDataPath, dbFileName);
    if (!fs.existsSync(dbPath)) return;

    const backupsDir = path.join(userDataPath, 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const backupFileName = `backup_${today}.db`;
    const backupFilePath = path.join(backupsDir, backupFileName);

    // Se o backup de hoje ainda não existe, cria um
    if (!fs.existsSync(backupFilePath)) {
      console.log(`[Backup] Criando backup do dia: ${backupFileName}`);
      fs.copyFileSync(dbPath, backupFilePath);

      // Limpeza de backups antigos (manter últimos 30 dias)
      const MAX_BACKUPS = 30;
      const files = fs.readdirSync(backupsDir)
        .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
        .sort((a, b) => b.localeCompare(a)); // Z-A (mais novo pro mais velho)

      if (files.length > MAX_BACKUPS) {
        for (let i = MAX_BACKUPS; i < files.length; i++) {
          const oldFile = path.join(backupsDir, files[i]);
          fs.unlinkSync(oldFile);
          console.log(`[Backup] Removido backup antigo: ${files[i]}`);
        }
      }
    }
  } catch (error) {
    console.error('[Backup] Erro ao criar backup automático:', error);
  }
}

module.exports = { setupDailyBackup };
