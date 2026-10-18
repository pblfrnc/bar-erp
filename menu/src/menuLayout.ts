import { menuGroupOf, plainName as plain, sortByMenuGroup } from '../../client/src/utils/menuGroups';
import type { MenuProduct } from './types';

// Organização do cardápio no site: nomes legíveis, tamanhos agrupados (Pizza X P/M/G/F vira um item)
// e subgrupos automáticos nas categorias grandes (ex.: "Bar" com 200+ itens).

const SMALL_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'c/', 'em', 'na', 'no', 'para', 'sem', 'a', 'o']);

// "PIZZA DE CALABRESA" -> "Pizza de Calabresa"; nomes sem palavra em caixa alta ficam como estão
export function prettyName(name: string) {
  if (!/[A-ZÀ-Þ]{3,}/.test(name)) return name.replace(/\s+/g, ' ').trim();
  return name
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .map((w, i) => {
      if (i > 0 && SMALL_WORDS.has(w)) return w;
      if (/\d/.test(w)) return w; // 600ml, 3lt, 1l
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

// ---------- Tamanhos ----------

const SIZE_ORDER = ['BROTO', 'PP', 'P', 'M', 'MEDIA', 'G', 'GRANDE', 'GG', 'F', 'FAMILIA'];
const SIZE_RE = /^(.*?)\s+(?:TAMANHO\s+|TAM\.?\s+)?(BROTO|PP|P|M|MEDIA|G|GRANDE|GG|F|FAMILIA)$/;
const SIZE_LABEL: Record<string, string> = { MEDIA: 'Média', GRANDE: 'Grande', BROTO: 'Broto', FAMILIA: 'Família' };

export interface MenuItem {
  key: string;
  categoryId: string;
  name: string;
  description: string | null;
  image: string | null;
  soldOut: boolean;
  product: MenuProduct; // o próprio produto, ou o menor tamanho
  variants: { label: string; product: MenuProduct }[] | null;
}

// Junta os produtos que só mudam no tamanho final (mesma categoria, 2+ tamanhos)
export function groupVariants(products: MenuProduct[]): MenuItem[] {
  const groups = new Map<string, { base: string; entries: { size: string; product: MenuProduct }[] }>();
  const singles: MenuProduct[] = [];

  for (const p of products) {
    const match = plain(p.name.replace(/\s+/g, ' ').trim()).match(SIZE_RE);
    if (!match) {
      singles.push(p);
      continue;
    }
    const key = `${p.categoryId}|${match[1]}`;
    const group = groups.get(key) || { base: p.name.replace(/\s+/g, ' ').trim().slice(0, match[1].length), entries: [] };
    group.entries.push({ size: match[2], product: p });
    groups.set(key, group);
  }

  const items: MenuItem[] = [];
  for (const [key, group] of groups) {
    if (group.entries.length < 2) {
      singles.push(group.entries[0].product);
      continue;
    }
    const entries = [...group.entries].sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size));
    const first = entries[0].product;
    items.push({
      key,
      categoryId: first.categoryId,
      name: prettyName(group.base),
      description: entries.find((e) => e.product.description)?.product.description || null,
      image: entries.find((e) => e.product.image)?.product.image || null,
      soldOut: entries.every((e) => e.product.soldOut),
      product: first,
      variants: entries.map((e) => ({ label: SIZE_LABEL[e.size] || e.size, product: e.product }))
    });
  }
  for (const p of singles) {
    items.push({
      key: p.id,
      categoryId: p.categoryId,
      name: prettyName(p.name),
      description: p.description,
      image: p.image,
      soldOut: p.soldOut,
      product: p,
      variants: null
    });
  }
  return items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

// ---------- Subgrupos ----------

const SUBGROUP_MIN_ITEMS = 20;

// Divide uma categoria grande em subgrupos (regras em client/src/utils/menuGroups.ts, as mesmas da tela de
// itens do ERP); categorias pequenas (ou que não se dividem) ficam inteiras
export function splitIntoSubgroups(items: MenuItem[]): { name: string | null; items: MenuItem[] }[] {
  if (items.length < SUBGROUP_MIN_ITEMS) return [{ name: null, items }];
  const buckets = new Map<string, MenuItem[]>();
  for (const item of items) {
    const name = menuGroupOf(item.product.name);
    buckets.set(name, [...(buckets.get(name) || []), item]);
  }
  if (buckets.size < 2) return [{ name: null, items }];
  return sortByMenuGroup([...buckets.entries()]).map(([name, list]) => ({ name, items: list }));
}
