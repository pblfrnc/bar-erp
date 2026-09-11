import { createHmac, randomBytes } from 'node:crypto';

export const DEFAULT_LICENSE_SECRET = process.env.LICENSE_SECRET_KEY || 'BAR_ERP_SUPER_SECRET_KEY_2026';

export interface LicensePayload {
  machineId: string;
  expiresAt: string; // ISO string
  clientName: string;
  issuedAt: string;  // ISO string
}

/**
 * Gera um token assinado completo contendo os metadados e assinatura HMAC
 */
export function generateSignedLicenseToken(payload: LicensePayload, secretKey: string = DEFAULT_LICENSE_SECRET): string {
  const jsonStr = JSON.stringify(payload);
  const base64Payload = Buffer.from(jsonStr, 'utf8').toString('base64url');
  const signature = createHmac('sha256', secretKey).update(base64Payload).digest('hex');
  return `${base64Payload}.${signature}`;
}

/**
 * Valida um token assinado e retorna os dados decodificados caso seja autêntico e não expirado
 */
export function verifySignedLicenseToken(token: string, secretKey: string = DEFAULT_LICENSE_SECRET): { valid: boolean; payload?: LicensePayload; error?: string } {
  try {
    const parts = token.trim().split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Formato de token inválido' };
    }

    const [base64Payload, signature] = parts;
    const expectedSignature = createHmac('sha256', secretKey).update(base64Payload).digest('hex');

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Assinatura digital inválida (chave adulterada)' };
    }

    const jsonStr = Buffer.from(base64Payload, 'base64url').toString('utf8');
    const payload: LicensePayload = JSON.parse(jsonStr);

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Falha ao processar token' };
  }
}

/**
 * Gera uma chave offline compacta e amigável para envio por WhatsApp
 * Exemplo: KEY-20261015-A1B2C3D4-E5F6G7H8
 */
export function generateOfflineKey(machineId: string, expiresAt: string, secretKey: string = DEFAULT_LICENSE_SECRET): string {
  const cleanExp = expiresAt.split('T')[0].replace(/-/g, ''); // 20261015
  const cleanMac = machineId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  const rawData = `${cleanMac}:${cleanExp}`;
  const sig = createHmac('sha256', secretKey).update(rawData).digest('hex').slice(0, 8).toUpperCase();
  
  // Retorna formato: EXP-YYYYMMDD-MAC8-SIG8
  return `EXP-${cleanExp}-${cleanMac}-${sig}`;
}

/**
 * Valida a chave offline compacta
 */
export function verifyOfflineKey(key: string, machineId: string, secretKey: string = DEFAULT_LICENSE_SECRET): { valid: boolean; expiresAtDate?: Date; error?: string } {
  try {
    const parts = key.trim().toUpperCase().split('-');
    if (parts.length !== 4 || parts[0] !== 'EXP') {
      return { valid: false, error: 'Formato de chave offline inválido. Formato esperado: EXP-AAAAMMDD-XXXX-YYYY' };
    }

    const expStr = parts[1]; // YYYYMMDD
    const macPart = parts[2]; // MAC8
    const sigPart = parts[3]; // SIG8

    const cleanMac = machineId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
    if (macPart !== cleanMac) {
      return { valid: false, error: 'Esta chave foi gerada para outro computador e não é válida nesta máquina.' };
    }

    const rawData = `${cleanMac}:${expStr}`;
    const expectedSig = createHmac('sha256', secretKey).update(rawData).digest('hex').slice(0, 8).toUpperCase();

    if (sigPart !== expectedSig) {
      return { valid: false, error: 'Código de validação incorreto ou chave adulterada.' };
    }

    const year = parseInt(expStr.slice(0, 4), 10);
    const month = parseInt(expStr.slice(4, 6), 10) - 1;
    const day = parseInt(expStr.slice(6, 8), 10);
    const expiresAt = new Date(Date.UTC(year, month, day, 23, 59, 59));

    if (isNaN(expiresAt.getTime())) {
      return { valid: false, error: 'Data embutida na chave é inválida.' };
    }

    return { valid: true, expiresAtDate: expiresAt };
  } catch (err: any) {
    return { valid: false, error: 'Falha ao decodificar chave offline.' };
  }
}
