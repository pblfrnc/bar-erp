import { ModifierGroup, ModifierOption, ModifierSnapshot, Product, Promotion } from '../types';

// Regra de promoção do dia: cópia de server/src/services/pricing.ts (manter as duas em sincronia).
// Aqui serve só para mostrar o preço na tela; o valor cobrado é sempre o calculado no servidor.

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

export function isPromotionActiveAt(promo: Promotion, now: Date): boolean {
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

export function promotionAppliesTo(promo: Promotion, productId: string, categoryId: string): boolean {
  return parseIdList(promo.productIds).includes(productId) || parseIdList(promo.categoryIds).includes(categoryId);
}

export function applyBestPromotion(
  product: Pick<Product, 'id' | 'categoryId' | 'price'>,
  promotions: Promotion[],
  now: Date = new Date()
): { price: number; promotion: Promotion | null } {
  let best = { price: product.price, promotion: null as Promotion | null };
  for (const promo of promotions) {
    if (!isPromotionActiveAt(promo, now) || !promotionAppliesTo(promo, product.id, product.categoryId)) continue;
    const value = Number(promo.value) || 0;
    const price = promo.discountType === 'FIXED_PRICE'
      ? value
      : product.price * (1 - Math.min(100, Math.max(0, value)) / 100);
    if (price >= 0 && price < best.price) best = { price: round2(price), promotion: promo };
  }
  return best;
}

export const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function describePromotion(promo: Promotion): string {
  const dayList = String(promo.daysOfWeek || '').split(',').filter(Boolean);
  const days = dayList.length === 7 ? 'todos os dias' : dayList.map((d) => WEEKDAY_LABELS[Number(d)]).join(', ');
  const hours = promo.startTime === '00:00' && promo.endTime === '23:59' ? 'o dia todo' : `${promo.startTime}–${promo.endTime}`;
  const value = promo.discountType === 'FIXED_PRICE'
    ? `por R$ ${Number(promo.value).toFixed(2)}`
    : `${Number(promo.value).toLocaleString('pt-BR')}% off`;
  return `${value} · ${days} · ${hours}`;
}

// ---------- Adicionais ----------

export const productModifierGroups = (product: Product): ModifierGroup[] =>
  (product.modifierGroups || [])
    .map((link) => link.group)
    .filter((g) => g && g.isActive && g.options.some((o) => o.isActive));

export function selectionError(groups: ModifierGroup[], selected: ModifierOption[]): string | null {
  for (const g of groups) {
    const count = selected.filter((o) => o.groupId === g.id).length;
    if (count < g.minSelect) return g.minSelect === 1 ? `Escolha "${g.name}".` : `Escolha pelo menos ${g.minSelect} em "${g.name}".`;
    if (g.maxSelect > 0 && count > g.maxSelect) return `No máximo ${g.maxSelect} em "${g.name}".`;
  }
  return null;
}

export function parseModifiers(raw?: string | null): ModifierSnapshot[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// "Ao ponto · Bacon (+R$ 4,00)" para conferência e recibo
export function modifiersLabel(raw?: string | null): string {
  return parseModifiers(raw)
    .map((m) => (m.price > 0 ? `${m.name} (+R$ ${m.price.toFixed(2)})` : m.name))
    .join(' · ');
}

// Observação da cozinha (opções + obs) vem pronta do servidor no campo `notes` do KDS/comanda (kitchenNote em server/src/services/pricing.ts)
