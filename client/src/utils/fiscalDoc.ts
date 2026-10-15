// ============================================================
// Funções Utilitárias de Formatação e Validação Fiscal (SEFAZ)
// ============================================================

/**
 * Formata CPF ou CNPJ dinamicamente conforme os dígitos são digitados
 */
export function formatCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else {
    // CNPJ: 00.000.000/0000-00
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }
}

/**
 * Validação dos dois dígitos verificadores do CPF (módulo 11)
 */
export function validateCpf(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

/**
 * Validação dos dois dígitos verificadores do CNPJ (módulo 11)
 */
export function validateCnpj(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;

  const length = clean.length - 2;
  const numbers = clean.substring(0, length);
  const digits = clean.substring(length);
  let sum = 0;
  let pos = length - 7;

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0), 10)) return false;

  const newLength = length + 1;
  const newNumbers = clean.substring(0, newLength);
  sum = 0;
  pos = newLength - 7;
  for (let i = newLength; i >= 1; i--) {
    sum += parseInt(newNumbers.charAt(newLength - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1), 10)) return false;

  return true;
}

/**
 * Valor a partir do qual a SEFAZ exige a identificação do consumidor (CPF/CNPJ) na NFC-e
 */
export const NFCE_LIMITE_SEM_IDENTIFICACAO = 10000;

/**
 * Retorna a mensagem de erro do documento (CPF/CNPJ) ou null se estiver vazio ou válido
 */
export function getCpfCnpjError(value: string): string | null {
  const clean = value.replace(/\D/g, '');
  if (!clean) return null;
  if (clean.length === 11) return validateCpf(clean) ? null : 'CPF com dígitos verificadores inválidos.';
  if (clean.length === 14) return validateCnpj(clean) ? null : 'CNPJ com dígitos verificadores inválidos.';
  return 'Documento incompleto. Digite um CPF com 11 dígitos ou um CNPJ com 14 dígitos.';
}
