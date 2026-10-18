import { createHash, randomBytes } from 'crypto';
import { prisma } from '../prisma.js';

// Cardápio digital por QR na mesa: o PC do bar monta o cardápio (só dados públicos: nome, descrição, preço,
// adicionais e promoções) e publica no site do Netlify (pasta menu/). O cliente abre <site>/m/<storeId>?mesa=N.
// Publica sozinho depois de alterações no cadastro e confere a cada 5 minutos (estoque/esgotados);
// só envia quando algo mudou, para não gastar a cota gratuita do Netlify.

export const DEFAULT_MENU_SITE_URL = 'https://cardapio-barerp.netlify.app';

const SCHEDULE_INTERVAL_MS = 5 * 60 * 1000;
const IMAGE_UPLOAD_TIMEOUT_MS = 30 * 1000;
const DEBOUNCE_MS = 8 * 1000;
const REQUEST_TIMEOUT_MS = 15 * 1000;
// https obrigatório; http só no próprio computador (testes)
const SITE_URL_RE = /^(https:\/\/[a-z0-9.-]+|http:\/\/(localhost|127\.0\.0\.1))(:\d+)?$/i;

export interface DigitalMenuStatus {
  enabled: boolean;
  siteUrl: string;
  customSiteUrl: string;
  storeId: string | null;
  menuUrl: string | null;
  title: string;
  defaultTitle: string;
  message: string;
  hiddenCategoryIds: string[];
  hideSoldOut: boolean;
  ignoreStock: boolean;
  lastPublishedAt: string | null;
  lastError: string | null;
  publishing: boolean;
}

let running: Promise<void> | null = null;
let runAgain = false;
let debounceTimer: NodeJS.Timeout | null = null;

const parseIds = (json: string | null | undefined): string[] => {
  try {
    const list = JSON.parse(json || '[]');
    return Array.isArray(list) ? list.map(String) : [];
  } catch {
    return [];
  }
};

async function getSettingsRow() {
  return prisma.digitalMenuSettings.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } });
}

type SettingsRow = Awaited<ReturnType<typeof getSettingsRow>>;

const effectiveSiteUrl = (row: SettingsRow) => (row.siteUrl || DEFAULT_MENU_SITE_URL).replace(/\/+$/, '');

async function defaultTitle() {
  const [fiscal, system] = await Promise.all([
    prisma.fiscalSettings.findUnique({ where: { id: 'default' }, select: { nomeFantasia: true } }).catch(() => null),
    prisma.systemSettings.findUnique({ where: { id: 'default' }, select: { restaurantName: true } }).catch(() => null)
  ]);
  return fiscal?.nomeFantasia?.trim() || system?.restaurantName?.trim() || 'Cardápio';
}

// Monta o cardápio publicado (mesmo formato de menu/src/types.ts). Nada de custo, estoque ou dados fiscais.
export async function buildMenu(row: SettingsRow) {
  const hidden = new Set(parseIds(row.hiddenCategoryIds));

  const [categories, products, promotions] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.product.findMany({
      where: { isActive: true, showInMenu: true, price: { gt: 0 } },
      orderBy: { name: 'asc' },
      include: {
        modifierGroups: {
          orderBy: { sortOrder: 'asc' },
          include: { group: { include: { options: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } } } }
        }
      }
    }),
    prisma.promotion.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
  ]);
  const images = await prisma.productImage.findMany({ select: { productId: true, hash: true } });
  const imageHashes = new Map(images.map((i) => [i.productId, i.hash]));

  const menuProducts = products
    .filter((p) => !hidden.has(p.categoryId))
    .map((p) => ({
      id: p.id,
      categoryId: p.categoryId,
      name: p.name,
      description: p.description?.trim() || null,
      price: p.price,
      // Comida da cozinha é feita na hora: estoque zerado não quer dizer que acabou
      soldOut: !row.ignoreStock && p.kdsStation !== 'KITCHEN' && p.trackStock && p.stock <= 0,
      image: imageHashes.has(p.id) ? `/api/menu/${row.storeId}/img/${imageHashes.get(p.id)}` : null,
      kitchen: p.kdsStation === 'KITCHEN',
      box: menuBox(p),
      groups: p.modifierGroups
        .map((link) => link.group)
        .filter((g) => g.isActive && g.options.length > 0)
        .map((g) => ({
          name: g.name,
          min: g.minSelect,
          max: g.maxSelect,
          options: g.options.map((o) => ({ name: o.name, price: o.price }))
        }))
    }))
    .filter((p) => !(row.hideSoldOut && p.soldOut));

  // Categoria é "comida" quando a maioria dos itens sai na cozinha; comidas vêm antes das bebidas no site
  const kitchenCount = new Map<string, { kitchen: number; total: number }>();
  for (const p of menuProducts) {
    const c = kitchenCount.get(p.categoryId) || { kitchen: 0, total: 0 };
    c.total++;
    if (p.kitchen) c.kitchen++;
    kitchenCount.set(p.categoryId, c);
  }
  const kindOf = (categoryId: string): 'food' | 'drink' => {
    const c = kitchenCount.get(categoryId);
    return c && c.kitchen * 2 > c.total ? 'food' : 'drink';
  };

  return {
    version: 1,
    store: {
      name: row.title?.trim() || (await defaultTitle()),
      message: row.message?.trim() || null,
      // O site calcula o horário das promoções no fuso do PC do bar
      timezoneOffset: new Date().getTimezoneOffset()
    },
    categories: categories
      .filter((c) => kitchenCount.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, icon: c.icon || null, kind: kindOf(c.id) }))
      // sort estável: mantém a ordem do cadastro dentro de cada grupo
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'food' ? -1 : 1)),
    products: menuProducts.map(({ kitchen, ...p }) => p),
    promotions: promotions.map((p) => ({
      id: p.id,
      name: p.name,
      isActive: p.isActive,
      daysOfWeek: p.daysOfWeek,
      startTime: p.startTime,
      endTime: p.endTime,
      discountType: p.discountType,
      value: p.value,
      productIds: p.productIds,
      categoryIds: p.categoryIds
    }))
  };
}

// Caixa fechada só aparece com preço acima do custo (preço de caixa igual ao custo é engano no cadastro/importação)
function menuBox(p: { hasBoxPrice: boolean; boxPrice: number | null; boxQuantity: number | null; boxCostPrice: number | null; costPrice: number | null }) {
  const quantity = p.boxQuantity || 0;
  const price = p.boxPrice || 0;
  if (!p.hasBoxPrice || price <= 0 || quantity <= 0) return null;
  const boxCost = p.boxCostPrice || (p.costPrice ? p.costPrice * quantity : 0);
  if (boxCost > 0 && price <= boxCost + 0.005) return null;
  return { quantity, price };
}

// Envia ao site as fotos que mudaram desde a última publicação. Devolve os produtos cuja foto não subiu.
async function syncImages(row: SettingsRow, productIds: string[]): Promise<Set<string>> {
  const failed = new Set<string>();
  const pending = await prisma.productImage.findMany({
    where: { productId: { in: productIds } },
    select: { productId: true, hash: true, publishedHash: true }
  });
  for (const img of pending.filter((i) => i.hash !== i.publishedHash)) {
    try {
      const full = await prisma.productImage.findUnique({ where: { productId: img.productId } });
      if (!full) continue;
      const res = await fetch(`${effectiveSiteUrl(row)}/api/menu/${row.storeId}/img/${img.hash}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${row.publishSecret}`, 'Content-Type': full.mimeType },
        body: Buffer.from(full.data),
        signal: AbortSignal.timeout(IMAGE_UPLOAD_TIMEOUT_MS)
      });
      if (!res.ok) {
        const data: any = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      await prisma.productImage.update({ where: { productId: img.productId }, data: { publishedHash: img.hash } });
      // A foto antiga não é mais usada (best effort)
      if (img.publishedHash) {
        fetch(`${effectiveSiteUrl(row)}/api/menu/${row.storeId}/img/${img.publishedHash}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${row.publishSecret}` },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        }).catch(() => {});
      }
    } catch (err: any) {
      console.warn(`[Cardápio digital] Foto do produto ${img.productId} não foi enviada:`, friendlyError(err));
      failed.add(img.productId);
    }
  }
  return failed;
}

async function callSite(row: SettingsRow, method: 'PUT' | 'DELETE', body?: string) {
  const res = await fetch(`${effectiveSiteUrl(row)}/api/menu/${row.storeId}`, {
    method,
    headers: { Authorization: `Bearer ${row.publishSecret}`, 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!res.ok) {
    const data: any = await res.json().catch(() => ({}));
    throw new Error(data?.error || `O site do cardápio respondeu HTTP ${res.status}.`);
  }
}

const friendlyError = (err: any) =>
  err?.name === 'TimeoutError' || err?.name === 'AbortError'
    ? 'O site do cardápio não respondeu. Verifique a internet do computador.'
    : err?.cause?.code === 'ENOTFOUND' || err?.cause?.code === 'EAI_AGAIN'
      ? 'Sem internet no computador: o cardápio será publicado quando a conexão voltar.'
      : err?.message === 'fetch failed'
        ? 'Não foi possível conectar ao site do cardápio. Será tentado de novo em alguns minutos.'
        : err?.message || 'Erro ao publicar o cardápio.';

async function doPublish(force: boolean) {
  let row = await getSettingsRow();
  if (!row.enabled) return;

  if (!row.storeId || !row.publishSecret) {
    row = await prisma.digitalMenuSettings.update({
      where: { id: 'default' },
      data: { storeId: randomBytes(10).toString('hex'), publishSecret: randomBytes(32).toString('hex'), lastHash: null }
    });
    // Loja nova: as fotos precisam subir de novo
    await prisma.productImage.updateMany({ data: { publishedHash: null } });
  }

  const menu = await buildMenu(row);
  const hash = createHash('sha256').update(JSON.stringify(menu)).digest('hex');
  if (!force && hash === row.lastHash) return;

  try {
    // Fotos antes do cardápio; a que falhar sai sem foto agora e o hash não é gravado, para tentar de novo
    const failedImages = await syncImages(row, menu.products.filter((p) => p.image).map((p) => p.id));
    const products = menu.products.map((p) => (failedImages.has(p.id) ? { ...p, image: null } : p));
    await callSite(row, 'PUT', JSON.stringify({ ...menu, products, updatedAt: new Date().toISOString() }));
    await prisma.digitalMenuSettings.update({
      where: { id: 'default' },
      data: { lastHash: failedImages.size > 0 ? null : hash, lastPublishedAt: new Date(), lastError: null }
    });
  } catch (err: any) {
    const message = friendlyError(err);
    await prisma.digitalMenuSettings.update({ where: { id: 'default' }, data: { lastError: message } });
    throw new Error(message);
  }
}

// Uma publicação por vez; pedidos durante o envio viram uma nova rodada no final
export async function publishMenu(force = false): Promise<void> {
  if (running) {
    runAgain = true;
    return running;
  }
  running = (async () => {
    try {
      await doPublish(force);
      while (runAgain) {
        runAgain = false;
        await doPublish(false);
      }
    } finally {
      running = null;
      runAgain = false;
    }
  })();
  return running;
}

// Chamado depois de mudanças no cadastro (produtos, categorias, adicionais, promoções)
export function scheduleMenuPublish() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    publishMenu().catch((err) => console.warn('[Cardápio digital]', err.message));
  }, DEBOUNCE_MS);
}

export function setupDigitalMenuScheduler() {
  const tick = () => publishMenu().catch((err) => console.warn('[Cardápio digital]', err.message));
  setTimeout(tick, 20 * 1000);
  setInterval(tick, SCHEDULE_INTERVAL_MS);
}

export async function getDigitalMenuStatus(): Promise<DigitalMenuStatus> {
  const row = await getSettingsRow();
  const siteUrl = effectiveSiteUrl(row);
  return {
    enabled: row.enabled,
    siteUrl,
    customSiteUrl: row.siteUrl || '',
    storeId: row.storeId,
    menuUrl: row.storeId ? `${siteUrl}/m/${row.storeId}` : null,
    title: row.title || '',
    defaultTitle: await defaultTitle(),
    message: row.message || '',
    hiddenCategoryIds: parseIds(row.hiddenCategoryIds),
    hideSoldOut: row.hideSoldOut,
    ignoreStock: row.ignoreStock,
    lastPublishedAt: row.lastPublishedAt ? row.lastPublishedAt.toISOString() : null,
    lastError: row.lastError,
    publishing: Boolean(running)
  };
}

export async function saveDigitalMenuSettings(body: any) {
  const before = await getSettingsRow();
  const siteUrl = String(body?.siteUrl ?? before.siteUrl ?? '').trim().replace(/\/+$/, '');
  if (siteUrl && !SITE_URL_RE.test(siteUrl)) throw new Error('Endereço do site inválido. Use https://nome-do-site.netlify.app');

  const title = String(body?.title ?? before.title ?? '').trim().slice(0, 80);
  const message = String(body?.message ?? before.message ?? '').trim().slice(0, 300);
  const hiddenCategoryIds = Array.isArray(body?.hiddenCategoryIds)
    ? JSON.stringify(body.hiddenCategoryIds.map(String))
    : before.hiddenCategoryIds;
  const enabled = typeof body?.enabled === 'boolean' ? body.enabled : before.enabled;
  const hideSoldOut = typeof body?.hideSoldOut === 'boolean' ? body.hideSoldOut : before.hideSoldOut;
  const ignoreStock = typeof body?.ignoreStock === 'boolean' ? body.ignoreStock : before.ignoreStock;

  // Trocou de site: o cardápio antigo sai do ar antes (best effort) e o novo recebe tudo
  const siteChanged = (siteUrl || DEFAULT_MENU_SITE_URL) !== effectiveSiteUrl(before);
  if (before.enabled && before.storeId && before.publishSecret && (!enabled || siteChanged)) {
    await callSite(before, 'DELETE').catch((err) => console.warn('[Cardápio digital] Falha ao tirar do ar:', err.message));
  }
  // Site novo não tem as fotos
  if (siteChanged) await prisma.productImage.updateMany({ data: { publishedHash: null } });

  await prisma.digitalMenuSettings.update({
    where: { id: 'default' },
    data: {
      siteUrl: siteUrl || null,
      title: title || null,
      message: message || null,
      hiddenCategoryIds,
      enabled,
      hideSoldOut,
      ignoreStock,
      lastError: null,
      ...(siteChanged || !enabled ? { lastHash: null } : {})
    }
  });

  // Ligado: publica já com as configurações novas (o erro fica no status e aparece na tela)
  let publishError: string | null = null;
  if (enabled) {
    try {
      await publishMenu(true);
    } catch (err: any) {
      publishError = err.message;
    }
  }
  return { status: await getDigitalMenuStatus(), publishError };
}
