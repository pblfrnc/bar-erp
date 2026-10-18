import { getStore } from '@netlify/blobs';
import { purgeCache } from '@netlify/functions';
import type { Config, Context } from '@netlify/functions';

// API do cardápio digital: cada BarERP publica o próprio cardápio aqui (Netlify Blobs) e o site lê de volta.
// GET    /api/menu/:storeId  -> cardápio publicado (público, com cache na CDN)
// PUT    /api/menu/:storeId  -> publica/atualiza (Authorization: Bearer <segredo da loja>)
// DELETE /api/menu/:storeId  -> tira o cardápio do ar (mantém a loja reservada para o mesmo segredo)
// O primeiro PUT de um storeId registra o hash do segredo; depois disso só esse segredo altera a loja.

const STORE_ID_RE = /^[a-z0-9]{16,40}$/;
const MAX_BYTES = 512 * 1024;

interface StoreRecord {
  secretHash: string;
  menu: unknown | null;
  updatedAt: string;
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Comparação em tempo constante (os dois hashes têm o mesmo tamanho)
function sameHash(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isMenuShape(menu: any) {
  return (
    menu &&
    typeof menu === 'object' &&
    menu.store &&
    typeof menu.store.name === 'string' &&
    Array.isArray(menu.categories) &&
    Array.isArray(menu.products) &&
    Array.isArray(menu.promotions)
  );
}

const cacheTag = (storeId: string) => `menu-${storeId}`;

export default async (req: Request, context: Context) => {
  const storeId = String(context.params.storeId || '').toLowerCase();
  if (!STORE_ID_RE.test(storeId)) return json(404, { error: 'Cardápio não encontrado.' });

  const key = `stores/${storeId}`;

  if (req.method === 'GET') {
    // Leitura forte: a leitura padrão (eventual) devolve a versão anterior por até 1 min e a CDN guardaria essa cópia
    const record = (await getStore({ name: 'menus', consistency: 'strong' }).get(key, { type: 'json' })) as StoreRecord | null;
    if (!record?.menu) return json(404, { error: 'Cardápio não encontrado.' });
    return json(200, record.menu, {
      // Navegador sempre revalida; a CDN guarda 1 min e o PUT limpa pela tag
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control': 'public, durable, max-age=60',
      'Netlify-Cache-Tag': cacheTag(storeId)
    });
  }

  if (req.method !== 'PUT' && req.method !== 'DELETE') return json(405, { error: 'Método não permitido.' });

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (token.length < 32) return json(401, { error: 'Chave de publicação ausente.' });

  const store = getStore({ name: 'menus', consistency: 'strong' });
  const existing = (await store.get(key, { type: 'json' })) as StoreRecord | null;
  const secretHash = await sha256(token);
  if (existing && !sameHash(existing.secretHash, secretHash)) {
    return json(403, { error: 'Este cardápio pertence a outra instalação do BarERP.' });
  }

  if (req.method === 'DELETE') {
    if (existing) await store.setJSON(key, { secretHash, menu: null, updatedAt: new Date().toISOString() });
  } else {
    const body = await req.text();
    if (new TextEncoder().encode(body).length > MAX_BYTES) return json(413, { error: 'Cardápio grande demais para publicar.' });
    let menu: unknown;
    try {
      menu = JSON.parse(body);
    } catch {
      return json(400, { error: 'Cardápio inválido (JSON).' });
    }
    if (!isMenuShape(menu)) return json(400, { error: 'Cardápio inválido.' });
    await store.setJSON(key, { secretHash, menu, updatedAt: new Date().toISOString() });
  }

  try {
    await purgeCache({ tags: [cacheTag(storeId)] });
  } catch (err) {
    // Sem a limpeza, a CDN mostra o cardápio novo em até 1 minuto
    console.warn('purgeCache falhou:', err);
  }
  return json(200, { success: true });
};

export const config: Config = {
  path: '/api/menu/:storeId',
  method: ['GET', 'PUT', 'DELETE']
};
