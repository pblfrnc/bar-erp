import type { Config, Context } from '@netlify/functions';
import { STORE_ID_RE, authorize, json, menusStore, sha256, storeKey } from '../lib/store.mts';

// Fotos dos produtos do cardápio (Netlify Blobs). O endereço leva o hash da imagem, então nunca muda de conteúdo.
// GET    /api/menu/:storeId/img/:hash  -> foto (público, cache longo)
// PUT    /api/menu/:storeId/img/:hash  -> envia a foto (Authorization: Bearer <segredo da loja>; o corpo precisa bater com o hash)
// DELETE /api/menu/:storeId/img/:hash  -> apaga uma foto que não é mais usada

const HASH_RE = /^[a-f0-9]{32}$/;
const MAX_BYTES = 2 * 1024 * 1024;
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const imageKey = (storeId: string, hash: string) => `images/${storeId}/${hash}`;

export default async (req: Request, context: Context) => {
  const storeId = String(context.params.storeId || '').toLowerCase();
  const hash = String(context.params.hash || '').toLowerCase();
  if (!STORE_ID_RE.test(storeId) || !HASH_RE.test(hash)) return json(404, { error: 'Foto não encontrada.' });

  const store = menusStore();
  const key = imageKey(storeId, hash);

  if (req.method === 'GET') {
    const found = await store.getWithMetadata(key, { type: 'arrayBuffer' });
    if (!found) return json(404, { error: 'Foto não encontrada.' });
    const contentType = String(found.metadata?.contentType || 'image/jpeg');
    return new Response(found.data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Netlify-CDN-Cache-Control': 'public, durable, max-age=31536000, immutable'
      }
    });
  }

  if (req.method !== 'PUT' && req.method !== 'DELETE') return json(405, { error: 'Método não permitido.' });

  const auth = await authorize(req, storeId);
  if ('error' in auth) return auth.error;

  if (req.method === 'DELETE') {
    await store.delete(key);
    return json(200, { success: true });
  }

  const contentType = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!MIME_TYPES.has(contentType)) return json(415, { error: 'Use foto JPEG, PNG ou WebP.' });

  const body = await req.arrayBuffer();
  if (body.byteLength === 0) return json(400, { error: 'Foto vazia.' });
  if (body.byteLength > MAX_BYTES) return json(413, { error: 'Foto grande demais (máximo 2 MB).' });
  if ((await sha256(body)).slice(0, 32) !== hash) return json(400, { error: 'A foto não confere com o endereço enviado.' });

  // Loja ainda sem cardápio: reserva o storeId para esta chave (como no primeiro PUT do cardápio)
  if (!auth.existing) {
    await store.setJSON(storeKey(storeId), { secretHash: auth.secretHash, menu: null, updatedAt: new Date().toISOString() });
  }
  await store.set(key, body, { metadata: { contentType } });
  return json(200, { success: true });
};

export const config: Config = {
  path: '/api/menu/:storeId/img/:hash',
  method: ['GET', 'PUT', 'DELETE']
};
