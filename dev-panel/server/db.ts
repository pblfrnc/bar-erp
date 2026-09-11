import { DatabaseSync } from 'node:sqlite';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'software_house.db');
const db = new DatabaseSync(dbPath);

// Habilitar Foreign Keys e WAL mode para performance máxima
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

// Inicialização das tabelas
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      business_name TEXT NOT NULL,
      owner_name TEXT,
      phone TEXT NOT NULL,
      document TEXT,
      city TEXT,
      state TEXT,
      monthly_fee REAL NOT NULL DEFAULT 150.0,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS licenses (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      machine_id TEXT NOT NULL UNIQUE,
      machine_name TEXT DEFAULT 'Terminal Principal',
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      last_check_in TEXT,
      last_ip TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_licenses_machine ON licenses(machine_id);
    CREATE INDEX IF NOT EXISTS idx_licenses_client ON licenses(client_id);

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      machine_id TEXT,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      days_added INTEGER NOT NULL DEFAULT 30,
      previous_expires_at TEXT,
      new_expires_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS dev_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Inserir configurações padrão se não existirem
  const getSetting = db.prepare('SELECT value FROM dev_settings WHERE key = ?');
  const insertSetting = db.prepare('INSERT INTO dev_settings (key, value) VALUES (?, ?)');

  if (!getSetting.get('developer_name')) {
    insertSetting.run('developer_name', 'Pablo Franco - Software House');
  }
  if (!getSetting.get('developer_phone')) {
    insertSetting.run('developer_phone', '5591988887777'); // WhatsApp para recebimento de comprovantes
  }
  if (!getSetting.get('pix_key')) {
    insertSetting.run('pix_key', '36.275.163/0001-24');
  }
  if (!getSetting.get('default_monthly_fee')) {
    insertSetting.run('default_monthly_fee', '150.00');
  }

  console.log('[DevPanel DB] Banco de dados inicializado em:', dbPath);
}

// Interfaces
export interface ClientRecord {
  id: string;
  business_name: string;
  owner_name: string | null;
  phone: string;
  document: string | null;
  city: string | null;
  state: string | null;
  monthly_fee: number;
  status: string;
  created_at: string;
  licenses?: LicenseRecord[];
}

export interface LicenseRecord {
  id: string;
  client_id: string;
  machine_id: string;
  machine_name: string;
  expires_at: string;
  status: string;
  last_check_in: string | null;
  last_ip: string | null;
  created_at: string;
}

// Métodos de Acesso
export const devDb = {
  // Configurações
  getSettings(): Record<string, string> {
    const rows = db.prepare('SELECT key, value FROM dev_settings').all() as { key: string; value: string }[];
    const result: Record<string, string> = {};
    for (const r of rows) {
      result[r.key] = r.value;
    }
    return result;
  },

  updateSettings(settings: Record<string, string>) {
    const upsert = db.prepare(`
      INSERT INTO dev_settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    for (const [k, v] of Object.entries(settings)) {
      upsert.run(k, String(v));
    }
  },

  // Overview / Métricas
  getMetrics() {
    const nowIso = new Date().toISOString();
    const in7DaysIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const clientsCount = (db.prepare("SELECT COUNT(*) as count FROM clients WHERE status != 'CANCELLED'").get() as any)?.count || 0;
    const totalMonthlyRevenue = (db.prepare("SELECT SUM(monthly_fee) as total FROM clients WHERE status = 'ACTIVE'").get() as any)?.total || 0;

    const licenses = db.prepare('SELECT * FROM licenses').all() as LicenseRecord[];
    let activeLicenses = 0;
    let expiringSoon = 0;
    let expired = 0;
    let blocked = 0;

    for (const lic of licenses) {
      if (lic.status === 'BLOCKED') {
        blocked++;
      } else if (lic.expires_at < nowIso) {
        expired++;
      } else if (lic.expires_at <= in7DaysIso) {
        expiringSoon++;
        activeLicenses++;
      } else {
        activeLicenses++;
      }
    }

    return {
      totalClients: clientsCount,
      estimatedMonthlyRevenue: totalMonthlyRevenue,
      totalLicenses: licenses.length,
      activeLicenses,
      expiringSoon,
      expired,
      blocked,
    };
  },

  // Listagem de clientes com suas respectivas máquinas
  listClients(search?: string): ClientRecord[] {
    let clientsQuery = 'SELECT * FROM clients';
    const params: any[] = [];

    if (search && search.trim()) {
      clientsQuery += ' WHERE business_name LIKE ? OR owner_name LIKE ? OR phone LIKE ? OR document LIKE ?';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }
    clientsQuery += ' ORDER BY created_at DESC';

    const clients = db.prepare(clientsQuery).all(...params) as ClientRecord[];
    const allLicenses = db.prepare('SELECT * FROM licenses ORDER BY created_at ASC').all() as LicenseRecord[];

    const licensesByClient = new Map<string, LicenseRecord[]>();
    for (const lic of allLicenses) {
      if (!licensesByClient.has(lic.client_id)) {
        licensesByClient.set(lic.client_id, []);
      }
      licensesByClient.get(lic.client_id)!.push(lic);
    }

    for (const c of clients) {
      c.licenses = licensesByClient.get(c.id) || [];
    }

    return clients;
  },

  // Buscar cliente por ID
  getClientById(id: string): ClientRecord | null {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as ClientRecord | undefined;
    if (!client) return null;
    client.licenses = db.prepare('SELECT * FROM licenses WHERE client_id = ?').all(id) as LicenseRecord[];
    return client;
  },

  // Criar cliente
  createClient(data: {
    businessName: string;
    ownerName?: string;
    phone: string;
    document?: string;
    city?: string;
    state?: string;
    monthlyFee?: number;
    machineId?: string;
    machineName?: string;
    initialDays?: number;
  }) {
    const clientId = 'cli_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const now = new Date();
    const createdAt = now.toISOString();
    const monthlyFee = data.monthlyFee ?? 150.0;

    db.prepare(`
      INSERT INTO clients (id, business_name, owner_name, phone, document, city, state, monthly_fee, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
    `).run(
      clientId,
      data.businessName.trim(),
      data.ownerName?.trim() || null,
      data.phone.trim(),
      data.document?.trim() || null,
      data.city?.trim() || null,
      data.state?.trim() || null,
      monthlyFee,
      createdAt
    );

    // Se forneceu machineId, vincula a máquina com os dias iniciais (default 30 dias)
    if (data.machineId && data.machineId.trim()) {
      const days = data.initialDays && data.initialDays > 0 ? data.initialDays : 30;
      const expiresDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      expiresDate.setUTCHours(23, 59, 59, 999);

      const licenseId = 'lic_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      db.prepare(`
        INSERT INTO licenses (id, client_id, machine_id, machine_name, expires_at, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)
      `).run(
        licenseId,
        clientId,
        data.machineId.trim(),
        data.machineName?.trim() || 'Terminal Principal',
        expiresDate.toISOString(),
        createdAt
      );

      // Registra pagamento inicial
      const paymentId = 'pay_' + Date.now().toString(36);
      db.prepare(`
        INSERT INTO payments (id, client_id, machine_id, amount, payment_date, days_added, previous_expires_at, new_expires_at, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Ativação inicial da máquina', ?)
      `).run(
        paymentId,
        clientId,
        data.machineId.trim(),
        monthlyFee,
        createdAt,
        days,
        null,
        expiresDate.toISOString(),
        createdAt
      );
    }

    return this.getClientById(clientId);
  },

  // Adicionar máquina a um cliente existente
  addMachineToClient(clientId: string, machineId: string, machineName: string = 'Terminal', days: number = 30) {
    const existing = db.prepare('SELECT * FROM licenses WHERE machine_id = ?').get(machineId.trim()) as LicenseRecord | undefined;
    if (existing) {
      throw new Error(`A máquina com ID "${machineId}" já está cadastrada para outro cliente.`);
    }

    const now = new Date();
    const expiresDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    expiresDate.setUTCHours(23, 59, 59, 999);

    const licenseId = 'lic_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    db.prepare(`
      INSERT INTO licenses (id, client_id, machine_id, machine_name, expires_at, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)
    `).run(
      licenseId,
      clientId,
      machineId.trim(),
      machineName.trim(),
      expiresDate.toISOString(),
      now.toISOString()
    );

    return db.prepare('SELECT * FROM licenses WHERE id = ?').get(licenseId) as LicenseRecord;
  },

  // Atualizar cliente
  updateClient(id: string, data: Partial<ClientRecord>) {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.business_name !== undefined) { updates.push('business_name = ?'); params.push(data.business_name); }
    if (data.owner_name !== undefined) { updates.push('owner_name = ?'); params.push(data.owner_name); }
    if (data.phone !== undefined) { updates.push('phone = ?'); params.push(data.phone); }
    if (data.document !== undefined) { updates.push('document = ?'); params.push(data.document); }
    if (data.city !== undefined) { updates.push('city = ?'); params.push(data.city); }
    if (data.state !== undefined) { updates.push('state = ?'); params.push(data.state); }
    if (data.monthly_fee !== undefined) { updates.push('monthly_fee = ?'); params.push(data.monthly_fee); }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }

    if (updates.length > 0) {
      params.push(id);
      db.prepare(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    return this.getClientById(id);
  },

  // Excluir cliente
  deleteClient(id: string) {
    db.prepare('DELETE FROM clients WHERE id = ?').run(id);
  },

  // Renovar Licença da Máquina (+30 dias ou data customizada)
  renewLicense(machineId: string, daysToAdd: number = 30, amountPaid?: number, notes?: string) {
    const license = db.prepare('SELECT * FROM licenses WHERE machine_id = ?').get(machineId.trim()) as LicenseRecord | undefined;
    if (!license) {
      throw new Error(`Máquina com ID "${machineId}" não encontrada.`);
    }

    const now = new Date();
    const currentExp = new Date(license.expires_at);
    
    // Se a licença ainda estiver ativa no futuro, soma os dias a partir do vencimento futuro!
    // Se já estiver vencida no passado, soma a partir de HOJE!
    const baseDate = currentExp > now ? currentExp : now;
    const newExpires = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    newExpires.setUTCHours(23, 59, 59, 999);

    const newExpiresIso = newExpires.toISOString();

    db.prepare(`
      UPDATE licenses
      SET expires_at = ?, status = 'ACTIVE'
      WHERE id = ?
    `).run(newExpiresIso, license.id);

    // Registra o pagamento no histórico
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(license.client_id) as ClientRecord;
    const amount = amountPaid !== undefined ? amountPaid : (client?.monthly_fee || 150.0);

    const paymentId = 'pay_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    db.prepare(`
      INSERT INTO payments (id, client_id, machine_id, amount, payment_date, days_added, previous_expires_at, new_expires_at, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      paymentId,
      license.client_id,
      machineId.trim(),
      amount,
      now.toISOString(),
      daysToAdd,
      license.expires_at,
      newExpiresIso,
      notes?.trim() || 'Renovação mensal remota',
      now.toISOString()
    );

    return {
      success: true,
      licenseId: license.id,
      machineId: license.machine_id,
      previousExpiresAt: license.expires_at,
      newExpiresAt: newExpiresIso,
      clientName: client?.business_name || 'Cliente'
    };
  },

  // Alternar Bloqueio da Máquina
  toggleBlockLicense(machineId: string) {
    const license = db.prepare('SELECT * FROM licenses WHERE machine_id = ?').get(machineId.trim()) as LicenseRecord | undefined;
    if (!license) throw new Error('Máquina não encontrada.');

    const newStatus = license.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
    db.prepare('UPDATE licenses SET status = ? WHERE id = ?').run(newStatus, license.id);
    return { success: true, status: newStatus };
  },

  // Consulta da Máquina pelo Bar ERP (Check-in remoto)
  checkLicenseByMachineId(machineId: string, ip?: string) {
    const license = db.prepare('SELECT * FROM licenses WHERE machine_id = ?').get(machineId.trim()) as LicenseRecord | undefined;
    if (!license) {
      return { found: false };
    }

    // Registra o check-in e IP
    const nowIso = new Date().toISOString();
    db.prepare('UPDATE licenses SET last_check_in = ?, last_ip = ? WHERE id = ?').run(nowIso, ip || null, license.id);

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(license.client_id) as ClientRecord | undefined;

    const now = new Date();
    const expDate = new Date(license.expires_at);
    const isExpired = expDate < now;
    const isBlocked = license.status === 'BLOCKED' || client?.status === 'BLOCKED';
    const isValid = !isExpired && !isBlocked;

    const diffMs = expDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    let status = 'ACTIVE';
    if (isBlocked) status = 'BLOCKED';
    else if (isExpired) status = 'EXPIRED';

    return {
      found: true,
      valid: isValid,
      status,
      machineId: license.machine_id,
      clientName: client?.business_name || 'Bar ERP Cliente',
      expiresAt: license.expires_at,
      daysRemaining,
    };
  }
};
