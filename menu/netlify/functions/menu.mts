import { purgeCache } from '@netlify/functions';
import type { Config, Context } from '@netlify/functions';
import { STORE_ID_RE, authorize, json, menusStore, storeKey } from '../lib/store.mts';

// API do cardápio digital: cada BarERP publica o próprio cardápio aqui (Netlify Blobs) e o site lê de volta.
// GET    /api/menu/:storeId  -> cardápio publicado (público, com cache na CDN)
// PUT    /api/menu/:storeId  -> publica/atualiza (Authorization: Bearer <segredo da loja>)
// DELETE /api/menu/:storeId  -> tira o cardápio do ar (mantém a loja reservada para o mesmo segredo)
// O primeiro PUT de um storeId registra o hash do segredo; depois disso só esse segredo altera a loja.
// As fotos ficam em menu-image.mts.

const MAX_BYTES = 512 * 1024;

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

  const key = storeKey(storeId);
  const store = menusStore();

  if (req.method === 'GET') {
    // Leitura forte: com a eventual a CDN guardaria a versão anterior
    const record = (await store.get(key, { type: 'json' })) as { menu: unknown | null } | null;
    if (!record?.menu) return json(404, { error: 'Cardápio não encontrado.' });
    return json(200, record.menu, {
      // Navegador sempre revalida; a CDN guarda 1 min e o PUT limpa pela tag
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control': 'public, durable, max-age=60',
      'Netlify-Cache-Tag': cacheTag(storeId)
    });
  }

  if (req.method !== 'PUT' && req.method !== 'DELETE') return json(405, { error: 'Método não permitido.' });

  const auth = await authorize(req, storeId);
  if ('error' in auth) return auth.error;
  const { existing, secretHash } = auth;

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
