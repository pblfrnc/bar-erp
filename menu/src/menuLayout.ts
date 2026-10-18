import type { MenuProduct } from './types';

// Organização do cardápio no site: nomes legíveis, tamanhos agrupados (Pizza X P/M/G/F vira um item)
// e subgrupos automáticos nas categorias grandes (ex.: "Bar" com 200+ itens).

const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();

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

// Ordem de teste: o primeiro que bater leva o item (ex.: "ICE DE VELHO BARREIRO" é drink pronto, não cachaça;
// "BALLY COCO E AÇAI" é drink, não sobremesa)
const SUBGROUP_RULES: { name: string; re: RegExp }[] = [
  { name: 'Tabacaria', re: /CIGARRO|LUCKY? STRIKE|ISQUEIRO|MARLBORO|DERBY|ROTHMANS|PALHEIRO|\bSEDA\b|NARGUILE|ESSENCIA/ },
  { name: 'Salgadinhos e doces', re: /^SALG|SALGADINHO|AMENDOIM|PIRULITO|CHICLETE|BALA\b|CHOCOLATE/ },
  { name: 'Pizzas', re: /\bPIZZA/ },
  { name: 'Lanches', re: /BURG|^X[- ]|SANDUICHE|LANCHE|HOT ?DOG|CACHORRO|MISTO/ },
  { name: 'Porções e petiscos', re: /PORCAO|PORCOES|PETISCO|ISCA|BATATA|FRITAS|PASSARINHO|TABUA|CALDO/ },
  { name: 'Pratos', re: /PRATO|EXECUTIVO|REFEICAO|PARMEGIANA|FEIJOADA/ },
  { name: 'Torres', re: /^TORRE\b/ },
  { name: 'Doses', re: /^DOSE\b|^DOZE\b/ },
  { name: 'Drinks prontos e ices', re: /\bICE\b|BEATS|BALLY|BORABEBE|COROTE|RUSTOFF|ETERNITY|KRISKOF|MANSAO|READY|CHUVA DE PRATA|GASEIFICADA|COPAO|CAIPIRINHA|CAIPIROSKA|DRINK/ },
  { name: 'Cervejas', re: /\bCERV|\bSKOL\b|BRAHMA|HEINEKEN|STELLA|CORONA|BUD(W|U)EISER|AMSTEL|\bORIGINAL\b|KAISER|IMPERIO|ANTARCTICA PILSEN|CHOPP|LITRAO|LONG NECK/ },
  { name: 'Vinhos', re: /VINHO|CASILLERO|AURORA|CONDE DE|SANTA HELENA|SANGRIA|ESPUMANTE/ },
  { name: 'Whiskies', re: /WH?ISK|WISK|BUCHANAN|OLD PARR|BALL?ANTINES|BALLATINES|BLACK ?& ?WHITE|PASSAPORT|JOHNNIE|LABEL|BLAK STONE|OLDEN|RED GOLD|BLEND\b/ },
  { name: 'Destilados e licores', re: /VODKA|VDKA|SMIRNOFF|ABSOLUT|SKYY|\bGIN\b|\bRUM\b|TEQUILA|CACHA|CACACHA|YPIOCA|SAGATIBA|VELHO BARREIRO|PRESIDENTE|DREHER|CAMPARI|LICOR|JACK|CUERVO|RAIZ|DOMUS|NOBILIS|MARGARITA|ROCK/ },
  { name: 'Energéticos', re: /ENERG|RED BULL|MONSTER|ENGOV/ },
  { name: 'Refrigerantes, sucos e águas', re: /REFRI|COCA|GUARANA|FANTA|SUKITA|PEPSI|SODA|H2OH|AGUA MINERAL|AGUA COM|AGUA SEM|ACHOC|SUCO|TODDYNHO|CHA\b/ },
  { name: 'Sobremesas', re: /SOBREMESA|PUDIM|SORVETE|ACAI|BOLO|TORTA|PETIT/ }
];

// Ordem de exibição: comidas, depois bebidas (cerveja primeiro), miudezas no fim
const SUBGROUP_ORDER = [
  'Pizzas',
  'Lanches',
  'Porções e petiscos',
  'Pratos',
  'Sobremesas',
  'Cervejas',
  'Torres',
  'Doses',
  'Drinks prontos e ices',
  'Destilados e licores',
  'Whiskies',
  'Vinhos',
  'Refrigerantes, sucos e águas',
  'Energéticos',
  'Salgadinhos e doces',
  'Tabacaria',
  'Outros'
];

const SUBGROUP_MIN_ITEMS = 20;

// Divide uma categoria grande em subgrupos; categorias pequenas (ou que não se dividem) ficam inteiras
export function splitIntoSubgroups(items: MenuItem[]): { name: string | null; items: MenuItem[] }[] {
  if (items.length < SUBGROUP_MIN_ITEMS) return [{ name: null, items }];
  const buckets = new Map<string, MenuItem[]>();
  for (const item of items) {
    const name = SUBGROUP_RULES.find((r) => r.re.test(plain(item.product.name)))?.name || 'Outros';
    buckets.set(name, [...(buckets.get(name) || []), item]);
  }
  if (buckets.size < 2) return [{ name: null, items }];
  return [...buckets.entries()]
    .sort((a, b) => SUBGROUP_ORDER.indexOf(a[0]) - SUBGROUP_ORDER.indexOf(b[0]))
    .map(([name, list]) => ({ name, items: list }));
}
