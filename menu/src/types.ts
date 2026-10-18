import type { Promotion } from '../../client/src/types';

// Formato publicado pelo BarERP (server/src/services/digitalMenu.ts monta o mesmo formato)
export interface MenuOption {
  name: string;
  price: number;
}

export interface MenuGroup {
  name: string;
  min: number;
  max: number; // 0 = sem limite
  options: MenuOption[];
}

export interface MenuProduct {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  soldOut: boolean;
  box: { quantity: number; price: number } | null;
  groups: MenuGroup[];
}

export interface MenuCategory {
  id: string;
  name: string;
  icon: string | null;
}

export interface PublishedMenu {
  version: number;
  updatedAt: string;
  store: { name: string; message: string | null; timezoneOffset: number };
  categories: MenuCategory[];
  products: MenuProduct[];
  promotions: Promotion[];
}
