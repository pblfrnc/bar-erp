import crypto from 'crypto';

/**
 * Módulo de Criptografia de Dados Ultrassensíveis (Camada C - Application Level Encryption)
 * Padrão: AES-256-GCM com chave derivada de forma segura.
 */
const VAULT_SALT = 'BAR_ERP_VAULT_SALT_SECURE_2026_V1';
const RAW_MASTER_SECRET = process.env.DATABASE_VAULT_KEY || 'BAR_ERP_MILITARY_GRADE_VAULT_KEY_2026';

// Derivação de chave de 32 bytes (256 bits) usando scrypt
const ENCRYPTION_KEY = crypto.scryptSync(RAW_MASTER_SECRET, VAULT_SALT, 32);

/**
 * Criptografa uma string usando AES-256-GCM.
 * Formato de saída: $enc$v1$<iv_hex>$<authTag_hex>$<ciphertext_hex>
 */
export function encryptField(plainText: string | null | undefined): string | null {
  if (!plainText || typeof plainText !== 'string') return plainText as any;
  if (plainText.startsWith('$enc$v1$')) return plainText; // Já está criptografado

  try {
    const iv = crypto.randomBytes(12); // IV de 96 bits recomendado para GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    return `$enc$v1$${iv.toString('hex')}$${authTag}$${encrypted}`;
  } catch (err) {
    console.error('[SecurityVault] Erro ao criptografar campo:', err);
    return plainText;
  }
}

/**
 * Descriptografa um campo em AES-256-GCM.
 * Se o campo não estiver criptografado (dados legados), retorna o próprio texto com segurança retroativa.
 */
export function decryptField(encryptedText: string | null | undefined): string | null {
  if (!encryptedText || typeof encryptedText !== 'string') return encryptedText as any;
  if (!encryptedText.startsWith('$enc$v1$')) return encryptedText; // Dado legado não cifrado

  try {
    const parts = encryptedText.split('$');
    // ['', 'enc', 'v1', iv_hex, authTag_hex, ciphertext_hex]
    if (parts.length !== 6) return encryptedText;

    const iv = Buffer.from(parts[3], 'hex');
    const authTag = Buffer.from(parts[4], 'hex');
    const ciphertext = parts[5];

    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[SecurityVault] Erro ao descriptografar campo (chave inválida ou adulterado):', err);
    return '***DADO_PROTEGIDO***';
  }
}

/**
 * Hash unidirecional com Salt para senhas de funcionários (PBKDF2 SHA-512)
 * Formato: $pbkdf2$<salt_hex>$<hash_hex>
 */
export function hashPassword(plainPassword: string): string {
  if (!plainPassword) return '';
  if (plainPassword.startsWith('$pbkdf2$')) return plainPassword; // Já é hash

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(plainPassword, salt, 10000, 64, 'sha512').toString('hex');
  return `$pbkdf2$${salt}$${hash}`;
}

export function verifyPassword(plainPassword: string, storedHashOrPlain: string): boolean {
  if (!storedHashOrPlain) return false;

  // Comparação com hash PBKDF2
  if (storedHashOrPlain.startsWith('$pbkdf2$')) {
    const parts = storedHashOrPlain.split('$');
    if (parts.length !== 4) return false;
    const salt = parts[2];
    const originalHash = parts[3];

    const computed = crypto.pbkdf2Sync(plainPassword, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(computed, 'hex'));
  }

  // Compatibilidade com senhas legadas em texto puro (migração transparente)
  return storedHashOrPlain === plainPassword;
}
