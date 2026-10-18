import { getStore } from '@netlify/blobs';

// Partes comuns das funções do cardápio (menu.mts e menu-image.mts)

export const STORE_ID_RE = /^[a-z0-9]{16,40}$/;

export interface StoreRecord {
  secretHash: string;
  menu: unknown | null;
  updatedAt: string;
}

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });

// Leitura forte: a leitura padrão (eventual) devolve a versão anterior por até 1 min
export const menusStore = () => getStore({ name: 'menus', consistency: 'strong' });

export const storeKey = (storeId: string) => `stores/${storeId}`;

export async function sha256(data: string | ArrayBuffer) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Comparação em tempo constante (os dois hashes têm o mesmo tamanho)
function sameHash(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Confere a chave da loja (Authorization: Bearer). O primeiro envio de um storeId registra o hash da chave.
export async function authorize(req: Request, storeId: string) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (token.length < 32) return { error: json(401, { error: 'Chave de publicação ausente.' }) } as const;

  const existing = (await menusStore().get(storeKey(storeId), { type: 'json' })) as StoreRecord | null;
  const secretHash = await sha256(token);
  if (existing && !sameHash(existing.secretHash, secretHash)) {
    return { error: json(403, { error: 'Este cardápio pertence a outra instalação do BarERP.' }) } as const;
  }
  return { existing, secretHash } as const;
}
