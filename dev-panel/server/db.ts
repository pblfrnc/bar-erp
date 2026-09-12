import { createClient, type Client } from '@libsql/client';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração de Conexão: Turso Cloud ou SQLite Local (com libSQL file://)
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

let client: Client;

if (tursoUrl) {
  console.log('[DevPanel DB] Conectando ao Turso Cloud em:', tursoUrl);
  client = createClient({
    url: tursoUrl,
    authToken: tursoAuthToken,
  });
} else {
  const dataDir = process.env.DATA_DIR || path.resolve(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'software_house.db');
  console.log('[DevPanel DB] Variáveis Turso não detectadas. Usando SQLite local em:', dbPath);
  client = createClient({
    url: `file:${dbPath}`,
  });
}

// Inicialização das tabelas
export async function initDb() {
  await client.execute(`
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
  `);

  await client.execute(`
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
  `);

  await client.execute(`CREATE INDEX IF NOT EXISTS idx_licenses_machine ON licenses(machine_id);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_licenses_client ON licenses(client_id);`);

  await client.execute(`
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
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS dev_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Inserir configurações padrão se não existirem
  const devNameRes = await client.execute({ sql: 'SELECT value FROM dev_settings WHERE key = ?', args: ['developer_name'] });
  if (devNameRes.rows.length === 0) {
    await client.execute({ sql: 'INSERT INTO dev_settings (key, value) VALUES (?, ?)', args: ['developer_name', 'Pablo Franco - Software House'] });
  }

  const devPhoneRes = await client.execute({ sql: 'SELECT value FROM dev_settings WHERE key = ?', args: ['developer_phone'] });
  if (devPhoneRes.rows.length === 0) {
    await client.execute({ sql: 'INSERT INTO dev_settings (key, value) VALUES (?, ?)', args: ['developer_phone', '5547974002560'] });
  } else {
    await client.execute({ sql: "UPDATE dev_settings SET value = '5547974002560' WHERE key = 'developer_phone' AND (value LIKE '%91988887777%' OR value = '5591988887777')", args: [] });
  }

  const pixRes = await client.execute({ sql: 'SELECT value FROM dev_settings WHERE key = ?', args: ['pix_key'] });
  if (pixRes.rows.length === 0) {
    await client.execute({ sql: 'INSERT INTO dev_settings (key, value) VALUES (?, ?)', args: ['pix_key', '68.817.608/0001-47'] });
  } else {
    await client.execute({ sql: "UPDATE dev_settings SET value = '68.817.608/0001-47' WHERE key = 'pix_key' AND value LIKE '%36.275%'", args: [] });
  }

  const feeRes = await client.execute({ sql: 'SELECT value FROM dev_settings WHERE key = ?', args: ['default_monthly_fee'] });
  if (feeRes.rows.length === 0) {
    await client.execute({ sql: 'INSERT INTO dev_settings (key, value) VALUES (?, ?)', args: ['default_monthly_fee', '150.00'] });
  }

  console.log('[DevPanel DB] Banco de dados inicializado com sucesso.');
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

// Métodos de Acesso Assíncronos
export const devDb = {
  // Configurações
  async getSettings(): Promise<Record<string, string>> {
    const res = await client.execute('SELECT key, value FROM dev_settings');
    const result: Record<string, string> = {};
    for (const r of res.rows) {
      result[String(r.key)] = String(r.value);
    }
    return result;
  },

  async updateSettings(settings: Record<string, string>): Promise<void> {
    for (const [k, v] of Object.entries(settings)) {
      await client.execute({
        sql: `INSERT INTO dev_settings (key, value) VALUES (?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        args: [k, String(v)]
      });
    }
  },

  // Overview / Métricas
  async getMetrics() {
    const nowIso = new Date().toISOString();
    const in7DaysIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const clientsRes = await client.execute("SELECT COUNT(*) as count FROM clients WHERE status != 'CANCELLED'");
    const clientsCount = Number(clientsRes.rows[0]?.count || 0);

    const revRes = await client.execute("SELECT SUM(monthly_fee) as total FROM clients WHERE status = 'ACTIVE'");
    const totalMonthlyRevenue = Number(revRes.rows[0]?.total || 0);

    const licRes = await client.execute('SELECT * FROM licenses');
    const licenses = licRes.rows as unknown as LicenseRecord[];
    
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
  async listClients(search?: string): Promise<ClientRecord[]> {
    let clientsQuery = 'SELECT * FROM clients';
    const params: any[] = [];

    if (search && search.trim()) {
      clientsQuery += ' WHERE business_name LIKE ? OR owner_name LIKE ? OR phone LIKE ? OR document LIKE ?';
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }
    clientsQuery += ' ORDER BY created_at DESC';

    const clientsRes = await client.execute({ sql: clientsQuery, args: params });
    const clients = clientsRes.rows as unknown as ClientRecord[];

    const licRes = await client.execute('SELECT * FROM licenses ORDER BY created_at ASC');
    const allLicenses = licRes.rows as unknown as LicenseRecord[];

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
  async getClientById(id: string): Promise<ClientRecord | null> {
    const res = await client.execute({ sql: 'SELECT * FROM clients WHERE id = ?', args: [id] });
    if (res.rows.length === 0) return null;
    const clientRecord = res.rows[0] as unknown as ClientRecord;

    const licRes = await client.execute({ sql: 'SELECT * FROM licenses WHERE client_id = ?', args: [id] });
    clientRecord.licenses = licRes.rows as unknown as LicenseRecord[];

    return clientRecord;
  },

  // Criar cliente
  async createClient(data: {
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
  }): Promise<ClientRecord | null> {
    const clientId = 'cli_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const now = new Date();
    const createdAt = now.toISOString();
    const monthlyFee = data.monthlyFee ?? 150.0;

    await client.execute({
      sql: `INSERT INTO clients (id, business_name, owner_name, phone, document, city, state, monthly_fee, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      args: [
        clientId,
        data.businessName.trim(),
        data.ownerName?.trim() || null,
        data.phone.trim(),
        data.document?.trim() || null,
        data.city?.trim() || null,
        data.state?.trim() || null,
        monthlyFee,
        createdAt
      ]
    });

    if (data.machineId && data.machineId.trim()) {
      const days = data.initialDays && data.initialDays > 0 ? data.initialDays : 30;
      const expiresDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      expiresDate.setUTCHours(23, 59, 59, 999);

      const licenseId = 'lic_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await client.execute({
        sql: `INSERT INTO licenses (id, client_id, machine_id, machine_name, expires_at, status, created_at)
              VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`,
        args: [
          licenseId,
          clientId,
          data.machineId.trim(),
          data.machineName?.trim() || 'Terminal Principal',
          expiresDate.toISOString(),
          createdAt
        ]
      });

      const paymentId = 'pay_' + Date.now().toString(36);
      await client.execute({
        sql: `INSERT INTO payments (id, client_id, machine_id, amount, payment_date, days_added, previous_expires_at, new_expires_at, notes, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Ativação inicial da máquina', ?)`,
        args: [
          paymentId,
          clientId,
          data.machineId.trim(),
          monthlyFee,
          createdAt,
          days,
          null,
          expiresDate.toISOString(),
          createdAt
        ]
      });
    }

    return await this.getClientById(clientId);
  },

  // Adicionar máquina a um cliente existente
  async addMachineToClient(clientId: string, machineId: string, machineName: string = 'Terminal', days: number = 30) {
    const existing = await client.execute({ sql: 'SELECT * FROM licenses WHERE machine_id = ?', args: [machineId.trim()] });
    if (existing.rows.length > 0) {
      throw new Error(`A máquina com ID "${machineId}" já está cadastrada para outro cliente.`);
    }

    const now = new Date();
    const expiresDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    expiresDate.setUTCHours(23, 59, 59, 999);

    const licenseId = 'lic_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await client.execute({
      sql: `INSERT INTO licenses (id, client_id, machine_id, machine_name, expires_at, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      args: [
        licenseId,
        clientId,
        machineId.trim(),
        machineName.trim(),
        expiresDate.toISOString(),
        now.toISOString()
      ]
    });

    const added = await client.execute({ sql: 'SELECT * FROM licenses WHERE id = ?', args: [licenseId] });
    return added.rows[0] as unknown as LicenseRecord;
  },

  // Atualizar cliente
  async updateClient(id: string, data: Partial<ClientRecord>) {
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
      await client.execute({
        sql: `UPDATE clients SET ${updates.join(', ')} WHERE id = ?`,
        args: params
      });
    }
    return await this.getClientById(id);
  },

  // Excluir cliente
  async deleteClient(id: string) {
    await client.execute({ sql: 'DELETE FROM clients WHERE id = ?', args: [id] });
  },

  // Renovar Licença da Máquina (+30 dias ou data customizada)
  async renewLicense(machineId: string, daysToAdd: number = 30, amountPaid?: number, notes?: string) {
    const licRes = await client.execute({ sql: 'SELECT * FROM licenses WHERE machine_id = ?', args: [machineId.trim()] });
    if (licRes.rows.length === 0) {
      throw new Error(`Máquina com ID "${machineId}" não encontrada.`);
    }
    const license = licRes.rows[0] as unknown as LicenseRecord;

    const now = new Date();
    const currentExp = new Date(license.expires_at);
    
    // Se a licença ainda estiver ativa no futuro, soma os dias a partir do vencimento futuro!
    // Se já estiver vencida no passado, soma a partir de HOJE!
    const baseDate = currentExp > now ? currentExp : now;
    const newExpires = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    newExpires.setUTCHours(23, 59, 59, 999);

    const newExpiresIso = newExpires.toISOString();

    await client.execute({
      sql: `UPDATE licenses SET expires_at = ?, status = 'ACTIVE' WHERE id = ?`,
      args: [newExpiresIso, license.id]
    });

    // Registra o pagamento no histórico
    const clientRes = await client.execute({ sql: 'SELECT * FROM clients WHERE id = ?', args: [license.client_id] });
    const clientRecord = clientRes.rows[0] as unknown as ClientRecord | undefined;
    const amount = amountPaid !== undefined ? amountPaid : (clientRecord?.monthly_fee || 150.0);

    const paymentId = 'pay_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await client.execute({
      sql: `INSERT INTO payments (id, client_id, machine_id, amount, payment_date, days_added, previous_expires_at, new_expires_at, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
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
      ]
    });

    return {
      success: true,
      licenseId: license.id,
      machineId: license.machine_id,
      previousExpiresAt: license.expires_at,
      newExpiresAt: newExpiresIso,
      clientName: clientRecord?.business_name || 'Cliente'
    };
  },

  // Alternar Bloqueio da Máquina
  async toggleBlockLicense(machineId: string) {
    const licRes = await client.execute({ sql: 'SELECT * FROM licenses WHERE machine_id = ?', args: [machineId.trim()] });
    if (licRes.rows.length === 0) throw new Error('Máquina não encontrada.');
    const license = licRes.rows[0] as unknown as LicenseRecord;

    const newStatus = license.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
    await client.execute({ sql: 'UPDATE licenses SET status = ? WHERE id = ?', args: [newStatus, license.id] });
    return { success: true, status: newStatus };
  },

  // Consulta da Máquina pelo Bar ERP (Check-in remoto)
  async checkLicenseByMachineId(machineId: string, ip?: string) {
    const licRes = await client.execute({ sql: 'SELECT * FROM licenses WHERE machine_id = ?', args: [machineId.trim()] });
    if (licRes.rows.length === 0) {
      return { found: false };
    }
    const license = licRes.rows[0] as unknown as LicenseRecord;

    // Registra o check-in e IP
    const nowIso = new Date().toISOString();
    await client.execute({
      sql: 'UPDATE licenses SET last_check_in = ?, last_ip = ? WHERE id = ?',
      args: [nowIso, ip || null, license.id]
    });

    const clientRes = await client.execute({ sql: 'SELECT * FROM clients WHERE id = ?', args: [license.client_id] });
    const clientRecord = clientRes.rows[0] as unknown as ClientRecord | undefined;

    const now = new Date();
    const expDate = new Date(license.expires_at);
    const isExpired = expDate < now;
    const isBlocked = license.status === 'BLOCKED' || clientRecord?.status === 'BLOCKED';
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
      clientName: clientRecord?.business_name || 'Bar ERP Cliente',
      expiresAt: license.expires_at,
      daysRemaining,
    };
  }
};
