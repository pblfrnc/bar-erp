import { prisma } from '../prisma.js';

// Regras de preço do pedido: promoções do dia (happy hour) e adicionais/perguntas.
// A regra de promoção existe também em client/src/utils/pricing.ts (mostrar o preço na tela);
// manter as duas cópias em sincronia. O preço que vale é sempre o calculado aqui no servidor.

export interface PromotionRule {
  id: string;
  name: string;
  isActive: boolean;
  daysOfWeek: string;
  startTime: string;
  endTime: string;
  discountType: string;
  value: number;
  productIds: string;
  categoryIds: string;
}

export interface ModifierSnapshot {
  group: string;
  name: string;
  price: number;
}

export class PricingError extends Error {}

// Observação que a cozinha vê: opções escolhidas + observação digitada. Vai pronta do servidor no campo
// `notes` de tudo que é enviado para KDS/comanda (assim o APK antigo do KDS também mostra o "Mal passada").
export function kitchenNote(item: { modifiers?: string | null; notes?: string | null }): string | null {
  let mods = '';
  try {
    const list = JSON.parse(item.modifiers || '[]');
    if (Array.isArray(list)) mods = list.map((m: any) => m?.name).filter(Boolean).join(', ');
  } catch {
    mods = '';
  }
  const notes = (item.notes || '').trim();
  if (mods && notes) return `${mods} | ${notes}`;
  return mods || notes || null;
}

export const withKitchenNote = <T extends { modifiers?: string | null; notes?: string | null }>(item: T): T => ({
  ...item,
  notes: kitchenNote(item)
});

const round2 = (v: number) => Math.round(v * 100) / 100;

const toMinutes = (hhmm: string) => {
  const [h, m] = String(hhmm || '00:00').split(':').map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
};

const parseIdList = (json: string): string[] => {
  try {
    const list = JSON.parse(json || '[]');
    return Array.isArray(list) ? list.map(String) : [];
  } catch {
    return [];
  }
};

export function isPromotionActiveAt(promo: PromotionRule, now: Date): boolean {
  if (!promo.isActive) return false;
  const days = String(promo.daysOfWeek || '').split(',').map((d) => parseInt(d, 10)).filter((d) => !isNaN(d));
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(promo.startTime);
  const end = toMinutes(promo.endTime);

  if (start <= end) return days.includes(now.getDay()) && minutes >= start && minutes <= end;
  // Atravessa a meia-noite (ex: 18:00 às 02:00): a madrugada pertence ao dia em que a promoção começou
  if (minutes >= start) return days.includes(now.getDay());
  if (minutes <= end) return days.includes((now.getDay() + 6) % 7);
  return false;
}

export function promotionAppliesTo(promo: PromotionRule, productId: string, categoryId: string): boolean {
  return parseIdList(promo.productIds).includes(productId) || parseIdList(promo.categoryIds).includes(categoryId);
}

// Menor preço entre as promoções ativas para o produto (preço de unidade, nunca caixa fechada)
export function applyBestPromotion(
  basePrice: number,
  product: { id: string; categoryId: string },
  promotions: PromotionRule[],
  now: Date
): { price: number; promotion: PromotionRule | null } {
  let best = { price: basePrice, promotion: null as PromotionRule | null };
  for (const promo of promotions) {
    if (!isPromotionActiveAt(promo, now) || !promotionAppliesTo(promo, product.id, product.categoryId)) continue;
    const value = Number(promo.value) || 0;
    const price = promo.discountType === 'FIXED_PRICE'
      ? value
      : basePrice * (1 - Math.min(100, Math.max(0, value)) / 100);
    if (price >= 0 && price < best.price) best = { price: round2(price), promotion: promo };
  }
  return best;
}

export async function loadActivePromotions(): Promise<PromotionRule[]> {
  return prisma.promotion.findMany({ where: { isActive: true } });
}

// Valida as opções escolhidas contra os grupos do produto e devolve o acréscimo + o registro do que foi escolhido.
// optionIds === undefined significa app antigo (não sabe escolher opções).
export async function resolveModifiers(
  product: { id: string; name: string },
  optionIds: string[] | undefined
): Promise<{ extra: number; snapshot: ModifierSnapshot[] }> {
  const links = await prisma.productModifierGroup.findMany({
    where: { productId: product.id, group: { isActive: true } },
    include: { group: { include: { options: { where: { isActive: true } } } } },
    orderBy: { sortOrder: 'asc' }
  });

  const selected = Array.from(new Set((optionIds || []).map(String)));
  if (links.length === 0) {
    if (selected.length > 0) throw new PricingError(`"${product.name}" não tem adicionais cadastrados.`);
    return { extra: 0, snapshot: [] };
  }

  if (optionIds === undefined && links.some((l) => l.group.minSelect > 0)) {
    throw new PricingError(`"${product.name}" tem perguntas obrigatórias. Atualize o app do garçom para escolher as opções.`);
  }

  const snapshot: ModifierSnapshot[] = [];
  let extra = 0;
  const used = new Set<string>();

  for (const { group } of links) {
    const chosen = group.options.filter((o) => selected.includes(o.id));
    chosen.forEach((o) => used.add(o.id));
    if (chosen.length < group.minSelect) {
      throw new PricingError(
        group.minSelect === 1
          ? `Escolha "${group.name}" para ${product.name}.`
          : `Escolha pelo menos ${group.minSelect} opções em "${group.name}" para ${product.name}.`
      );
    }
    if (group.maxSelect > 0 && chosen.length > group.maxSelect) {
      throw new PricingError(`No máximo ${group.maxSelect} opção(ões) em "${group.name}" para ${product.name}.`);
    }
    for (const o of chosen) {
      snapshot.push({ group: group.name, name: o.name, price: o.price });
      extra += o.price;
    }
  }

  if (selected.some((id) => !used.has(id))) {
    throw new PricingError(`Uma das opções escolhidas para "${product.name}" não existe mais. Atualize o cardápio e tente de novo.`);
  }

  return { extra: round2(extra), snapshot };
}

// Preço final de uma linha do pedido. Caixa fechada não recebe promoção nem adicionais.
export async function priceOrderLine(
  product: { id: string; name: string; categoryId: string; price: number; boxPrice: number | null; hasBoxPrice: boolean },
  line: { unitType?: string; modifierOptionIds?: string[] },
  promotions: PromotionRule[],
  now: Date
) {
  const isBox = line.unitType === 'BOX' && product.hasBoxPrice && !!product.boxPrice;
  if (isBox) {
    return { isBox, unitPrice: Number(product.boxPrice), basePrice: null, promotionName: null, modifiers: null as string | null };
  }

  const { extra, snapshot } = await resolveModifiers(product, line.modifierOptionIds);
  const promo = applyBestPromotion(product.price, product, promotions, now);
  return {
    isBox,
    unitPrice: round2(promo.price + extra),
    basePrice: promo.promotion ? round2(product.price + extra) : null,
    promotionName: promo.promotion?.name || null,
    modifiers: snapshot.length > 0 ? JSON.stringify(snapshot) : null
  };
}
