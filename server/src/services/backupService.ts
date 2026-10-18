import fs from 'fs';
import path from 'path';
import { prisma } from '../prisma.js';

// Backup automático do banco: snapshot consistente com VACUUM INTO (seguro com o servidor gravando)
// em <pasta do banco>/backups e cópia para uma pasta externa (Google Drive / OneDrive / pen drive).

export interface BackupSettings {
  externalFolder: string;
  enabled: boolean; // liga a cópia para a pasta externa (o backup local roda sempre)
  keep: number; // dias de histórico (ver prune)
}

export interface BackupFileInfo {
  file: string;
  at: string;
}

export interface BackupResult {
  success: boolean;
  reason: string;
  local: BackupFileInfo | null;
  external: BackupFileInfo | null;
  externalError: string | null;
  error: string | null;
}

const DEFAULT_SETTINGS: BackupSettings = { externalFolder: '', enabled: false, keep: 30 };
const SETTINGS_FILE = 'backup-settings.json';
const LOCAL_PREFIX = 'backup_';
const EXTERNAL_PREFIX = 'bar-erp-backup_';
// backup_2026-10-17.db (cópia diária antiga do Electron) ou backup_2026-10-17_2130.db
const LOCAL_FILE_RE = /^backup_\d{4}-\d{2}-\d{2}(_\d{4})?\.db$/;
const EXTERNAL_FILE_RE = /^bar-erp-backup_\d{4}-\d{2}-\d{2}_\d{4}\.db$/;
const SCHEDULE_INTERVAL_MS = 6 * 60 * 60 * 1000;

let lastError: string | null = null;
let lastErrorAt: string | null = null;
let running: Promise<BackupResult> | null = null;

// Caminho real do banco aberto pelo Prisma (resolve DATABASE_URL relativo/absoluto sem adivinhar)
async function getDbPath(): Promise<string> {
  const rows: any[] = await prisma.$queryRawUnsafe('PRAGMA database_list;');
  const main = rows.find((r) => r.name === 'main');
  if (!main?.file) throw new Error('Não foi possível localizar o arquivo do banco de dados.');
  return main.file as string;
}

async function getDbDir() {
  return path.dirname(await getDbPath());
}

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
const todayPrefix = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export async function getBackupSettings(): Promise<BackupSettings> {
  const file = path.join(await getDbDir(), SETTINGS_FILE);
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return {
      externalFolder: typeof raw.externalFolder === 'string' ? raw.externalFolder : DEFAULT_SETTINGS.externalFolder,
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_SETTINGS.enabled,
      keep: normalizeKeep(raw.keep)
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function normalizeKeep(value: unknown) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 365) : DEFAULT_SETTINGS.keep;
}

// Pasta existe, é pasta e aceita gravação. Lança erro com mensagem para o operador.
async function assertWritableFolder(folder: string) {
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(folder);
  } catch {
    throw new Error(`A pasta de backup externo não foi encontrada: ${folder}. Verifique se o pen drive está conectado ou se a pasta do Google Drive/OneDrive existe.`);
  }
  if (!stat.isDirectory()) throw new Error(`O caminho escolhido não é uma pasta: ${folder}`);

  const probe = path.join(folder, `.bar-erp-teste-${process.pid}-${Date.now()}.tmp`);
  try {
    await fs.promises.writeFile(probe, 'ok');
    await fs.promises.unlink(probe);
  } catch {
    throw new Error(`Sem permissão para gravar na pasta de backup externo: ${folder}`);
  }
}

export async function saveBackupSettings(input: Partial<BackupSettings>): Promise<BackupSettings> {
  const current = await getBackupSettings();
  const next: BackupSettings = {
    externalFolder: typeof input.externalFolder === 'string' ? input.externalFolder.trim() : current.externalFolder,
    enabled: typeof input.enabled === 'boolean' ? input.enabled : current.enabled,
    keep: input.keep !== undefined ? normalizeKeep(input.keep) : current.keep
  };

  if (next.enabled && !next.externalFolder) {
    throw new Error('Escolha a pasta de backup externo antes de ativar a cópia.');
  }
  if (next.externalFolder) {
    if (!path.isAbsolute(next.externalFolder)) {
      throw new Error('Informe o caminho completo da pasta (ex.: C:\\Users\\Bar\\Google Drive\\Backups).');
    }
    const rel = path.relative(await getDbDir(), path.resolve(next.externalFolder));
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
      throw new Error('A pasta externa não pode ficar dentro da pasta do banco de dados. Use o Google Drive, OneDrive ou um pen drive.');
    }
    // Só exige a pasta acessível quando a cópia está ligada (o pen drive pode estar fora na hora de desligar)
    if (next.enabled) await assertWritableFolder(next.externalFolder);
  }

  const file = path.join(await getDbDir(), SETTINGS_FILE);
  await fs.promises.writeFile(file, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

function listBackups(dir: string, re: RegExp): string[] {
  try {
    return fs.readdirSync(dir).filter((f) => re.test(f)).sort().reverse(); // mais novo primeiro (ordem do nome = ordem da data)
  } catch {
    return [];
  }
}

const KEEP_ALL_DAYS = 2;

// Retenção: todos os backups dos 2 dias mais recentes e o mais novo de cada dia anterior, até `keepDays` dias.
// Conta dias que têm backup (não dias do calendário): um PC desligado por semanas não perde o histórico.
function prune(dir: string, re: RegExp, keepDays: number) {
  const byDay = new Map<string, string[]>();
  for (const file of listBackups(dir, re)) {
    const day = file.match(/\d{4}-\d{2}-\d{2}/)![0];
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(file); // já em ordem do mais novo para o mais velho
  }

  const toDelete: string[] = [];
  Array.from(byDay.keys()).forEach((day, index) => {
    const files = byDay.get(day)!;
    if (index >= keepDays) toDelete.push(...files);
    else if (index >= KEEP_ALL_DAYS) toDelete.push(...files.slice(1));
  });

  for (const old of toDelete) {
    try {
      fs.unlinkSync(path.join(dir, old));
      console.log(`[Backup] Removido backup antigo: ${old}`);
    } catch (err) {
      console.warn(`[Backup] Não foi possível remover ${old}:`, err);
    }
  }
}

function fileInfo(dir: string, file: string | undefined): BackupFileInfo | null {
  if (!file) return null;
  try {
    return { file, at: fs.statSync(path.join(dir, file)).mtime.toISOString() };
  } catch {
    return null;
  }
}

function recordError(message: string) {
  lastError = message;
  lastErrorAt = new Date().toISOString();
  console.error(`[Backup] ${message}`);
}

async function doBackup(reason: string): Promise<BackupResult> {
  const result: BackupResult = { success: false, reason, local: null, external: null, externalError: null, error: null };
  try {
    const dbDir = await getDbDir();
    const settings = await getBackupSettings();
    const backupsDir = path.join(dbDir, 'backups');
    await fs.promises.mkdir(backupsDir, { recursive: true });

    const name = stamp(new Date());
    const localFile = `${LOCAL_PREFIX}${name}.db`;
    const localPath = path.join(backupsDir, localFile);
    const localTmp = `${localPath}.tmp`;
    await fs.promises.rm(localTmp, { force: true });

    // VACUUM INTO gera uma cópia íntegra mesmo com o servidor gravando (inclui o que ainda está no WAL)
    await prisma.$executeRawUnsafe(`VACUUM INTO '${localTmp.replace(/'/g, "''")}'`);
    await fs.promises.rename(localTmp, localPath);
    prune(backupsDir, LOCAL_FILE_RE, settings.keep);
    result.local = fileInfo(backupsDir, localFile);
    console.log(`[Backup] Backup local criado (${reason}): ${localFile}`);

    if (settings.enabled && settings.externalFolder) {
      try {
        await assertWritableFolder(settings.externalFolder);
        const externalFile = `${EXTERNAL_PREFIX}${name}.db`;
        const externalPath = path.join(settings.externalFolder, externalFile);
        // .tmp + rename: o Google Drive/OneDrive não sobe um arquivo pela metade
        await fs.promises.copyFile(localPath, `${externalPath}.tmp`);
        await fs.promises.rename(`${externalPath}.tmp`, externalPath);
        prune(settings.externalFolder, EXTERNAL_FILE_RE, settings.keep);
        result.external = fileInfo(settings.externalFolder, externalFile);
        console.log(`[Backup] Cópia externa criada: ${externalPath}`);
      } catch (err: any) {
        result.externalError = err?.message || String(err);
        recordError(`Backup local salvo, mas a cópia externa falhou: ${result.externalError}`);
      }
    }

    result.success = !result.externalError;
    if (result.success) {
      lastError = null;
      lastErrorAt = null;
    }
  } catch (err: any) {
    result.error = `Falha ao gerar o backup: ${err?.message || String(err)}`;
    recordError(result.error);
  }
  return result;
}

// Um backup por vez: chamadas simultâneas (agendador, fechamento de caixa, botão) recebem o mesmo resultado
export function runBackup(reason: string): Promise<BackupResult> {
  if (!running) {
    running = doBackup(reason).finally(() => {
      running = null;
    });
  }
  return running;
}

export async function getBackupStatus() {
  const settings = await getBackupSettings();
  const backupsDir = path.join(await getDbDir(), 'backups');
  const localFiles = listBackups(backupsDir, LOCAL_FILE_RE);

  let externalFiles: string[] = [];
  let externalReachable = false;
  if (settings.externalFolder) {
    externalReachable = fs.existsSync(settings.externalFolder);
    externalFiles = externalReachable ? listBackups(settings.externalFolder, EXTERNAL_FILE_RE) : [];
  }

  return {
    enabled: settings.enabled,
    externalFolder: settings.externalFolder,
    keep: settings.keep,
    lastLocal: fileInfo(backupsDir, localFiles[0]),
    lastExternal: externalReachable ? fileInfo(settings.externalFolder, externalFiles[0]) : null,
    externalReachable,
    totalLocal: localFiles.length,
    totalExternal: externalFiles.length,
    lastError,
    lastErrorAt,
    running: running !== null
  };
}

let schedulerStarted = false;

// Na inicialização (se ainda não houver backup hoje) e a cada 6 horas
export function setupBackupScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  setTimeout(async () => {
    try {
      const backupsDir = path.join(await getDbDir(), 'backups');
      const today = `${LOCAL_PREFIX}${todayPrefix(new Date())}`;
      if (!listBackups(backupsDir, LOCAL_FILE_RE).some((f) => f.startsWith(today))) {
        await runBackup('inicialização');
      }
    } catch (err) {
      console.error('[Backup] Erro no backup de inicialização:', err);
    }
  }, 15 * 1000);

  setInterval(() => {
    runBackup('agendado (6h)').catch((err) => console.error('[Backup] Erro no backup agendado:', err));
  }, SCHEDULE_INTERVAL_MS);
}
