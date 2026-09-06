import {
  Table,
  Order,
  Product,
  Category,
  OrderItem,
  CashShift,
  CashSummary,
  DashboardData,
  KdsStatus,
  KdsItem,
  Waiter
} from '../types';

import { getServerBaseUrl } from './socket';

function getApiUrl(): string {
  return `${getServerBaseUrl()}/api`;
}

// Cache local em memória para resposta instantânea (0ms) no tablet/celular do garçom
let cachedCategories: Category[] | null = null;
let cachedProducts: Product[] | null = null;

async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 2): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos de timeout

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (retries > 0) {
      console.warn(`[Wi-Fi Resiliência] Falha de requisição em ${url}. Tentando novamente (${retries} restantes)...`);
      await new Promise((r) => setTimeout(r, 600));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw new Error('Falha de conexão com o servidor do bar. Verifique o sinal do Wi-Fi.');
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Mesas
  getTables: (): Promise<Table[]> =>
    fetchWithRetry(`${getApiUrl()}/tables`).then(handleResponse<Table[]>),

  createTable: (data: { number: number; name?: string; capacity: number; section: string }): Promise<Table> =>
    fetchWithRetry(`${getApiUrl()}/tables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(handleResponse<Table>),

  updateTable: (id: string, data: { number?: number; name?: string; capacity?: number; section?: string }): Promise<Table> =>
    fetchWithRetry(`${getApiUrl()}/tables/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(handleResponse<Table>),

  deleteTable: (id: string): Promise<{ success: boolean; message: string }> =>
    fetchWithRetry(`${getApiUrl()}/tables/${id}`, {
      method: 'DELETE'
    }).then(handleResponse<{ success: boolean; message: string }>),

  batchUpdateSection: (tableIds: string[], section: string): Promise<{ success: boolean; count: number }> =>
    fetchWithRetry(`${getApiUrl()}/tables/batch/section`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableIds, section })
    }).then(handleResponse<{ success: boolean; count: number }>),

  renameSection: (oldSection: string, newSection: string): Promise<{ success: boolean; count: number }> =>
    fetchWithRetry(`${getApiUrl()}/tables/sections/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldSection, newSection })
    }).then(handleResponse<{ success: boolean; count: number }>),

  openTable: (id: string, data: { customerName?: string; waiterName?: string; waiterId?: string; customerCount: number }): Promise<{ table: Table; order: Order }> =>
    fetchWithRetry(`${getApiUrl()}/tables/${id}/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(handleResponse<{ table: Table; order: Order }>),

  requestTableClosing: (id: string): Promise<Table> =>
    fetchWithRetry(`${getApiUrl()}/tables/${id}/request-closing`, { method: 'POST' }).then(handleResponse<Table>),

  reopenTable: (id: string): Promise<Table> =>
    fetchWithRetry(`${getApiUrl()}/tables/${id}/reopen`, { method: 'POST' }).then(handleResponse<Table>),

  transferTable: (id: string, targetTableId: string): Promise<{ success: boolean; message: string }> =>
    fetchWithRetry(`${getApiUrl()}/tables/${id}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetTableId })
    }).then(handleResponse<{ success: boolean; message: string }>),

  mergeTables: (id: string, secondTableId: string): Promise<{ success: boolean; message: string }> =>
    fetchWithRetry(`${getApiUrl()}/tables/${id}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secondTableId })
    }).then(handleResponse<{ success: boolean; message: string }>),

  // Comandas / Pedidos
  getOrder: (id: string): Promise<Order> =>
    fetchWithRetry(`${getApiUrl()}/orders/${id}`).then(handleResponse<Order>),

  addOrderItems: (
    orderId: string,
    items: { productId: string; quantity: number; notes?: string }[]
  ): Promise<{ order: Order; addedItems: OrderItem[] }> =>
    fetchWithRetry(`${getApiUrl()}/orders/${orderId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    }).then(handleResponse<{ order: Order; addedItems: OrderItem[] }>),

  removeOrderItem: (orderId: string, itemId: string): Promise<Order> =>
    fetchWithRetry(`${getApiUrl()}/orders/${orderId}/items/${itemId}`, { method: 'DELETE' }).then(handleResponse<Order>),

  toggleServiceFee: (orderId: string, active?: boolean, rate?: number): Promise<Order> =>
    fetchWithRetry(`${getApiUrl()}/orders/${orderId}/service-fee`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active, rate })
    }).then(handleResponse<Order>),

  applyDiscount: (orderId: string, discount: number): Promise<Order> =>
    fetchWithRetry(`${getApiUrl()}/orders/${orderId}/discount`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discount })
    }).then(handleResponse<Order>),

  payOrder: (
    orderId: string,
    data: { payments: { amount: number; method: string; notes?: string }[]; closeOrder?: boolean; customerId?: string }
  ): Promise<{ success: boolean; order: Order; isFullyPaid: boolean }> =>
    fetchWithRetry(`${getApiUrl()}/orders/${orderId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(handleResponse<{ success: boolean; order: Order; isFullyPaid: boolean }>),

  // KDS
  getKdsItems: (station?: string): Promise<KdsItem[]> => {
    const query = station && station !== 'ALL' ? `?station=${station}` : '';
    return fetchWithRetry(`${getApiUrl()}/kds${query}`).then(handleResponse<KdsItem[]>);
  },

  updateKdsItemStatus: (itemId: string, status: KdsStatus): Promise<OrderItem> =>
    fetchWithRetry(`${getApiUrl()}/kds/items/${itemId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    }).then(handleResponse<OrderItem>),

  markAllReady: (orderId: string, station?: string): Promise<{ success: boolean }> =>
    fetchWithRetry(`${getApiUrl()}/kds/orders/${orderId}/ready-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ station })
    }).then(handleResponse<{ success: boolean }>),

  batchUpdateKdsStatus: (orderId: string, status: KdsStatus, station?: string): Promise<{ success: boolean }> =>
    fetchWithRetry(`${getApiUrl()}/kds/orders/${orderId}/batch-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, station })
    }).then(handleResponse<{ success: boolean }>),

  // Produtos & Cardápio (com cache em memória para abertura instantânea do cardápio)
  getProducts: async (categoryId?: string, search?: string, forceRefresh = false): Promise<Product[]> => {
    if (!categoryId && !search && cachedProducts && !forceRefresh) {
      // Revalida em background sem travar a UI
      fetchWithRetry(`${getApiUrl()}/products`)
        .then(handleResponse<Product[]>)
        .then((p) => { cachedProducts = p; })
        .catch(() => {});
      return cachedProducts;
    }

    const params = new URLSearchParams();
    if (categoryId) params.append('categoryId', categoryId);
    if (search) params.append('search', search);
    const data = await fetchWithRetry(`${getApiUrl()}/products?${params.toString()}`).then(handleResponse<Product[]>);
    if (!categoryId && !search) cachedProducts = data;
    return data;
  },

  createProduct: async (data: Partial<Product>): Promise<Product> => {
    cachedProducts = null;
    return fetchWithRetry(`${getApiUrl()}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(handleResponse<Product>);
  },

  updateProduct: async (id: string, data: Partial<Product>): Promise<Product> => {
    cachedProducts = null;
    return fetchWithRetry(`${getApiUrl()}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(handleResponse<Product>);
  },

  adjustStock: async (id: string, adjustment?: number, newStock?: number): Promise<Product> => {
    cachedProducts = null;
    return fetchWithRetry(`${getApiUrl()}/products/${id}/stock`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adjustment, newStock })
    }).then(handleResponse<Product>);
  },

  deleteProduct: async (id: string, force = true): Promise<{ success: boolean; message: string }> => {
    cachedProducts = null;
    return fetchWithRetry(`${getApiUrl()}/products/${id}${force ? '?force=true' : ''}`, {
      method: 'DELETE'
    }).then(handleResponse<{ success: boolean; message: string }>);
  },

  deleteCategory: async (id: string, force = false): Promise<{ success: boolean; message: string }> => {
    cachedCategories = null;
    cachedProducts = null;
    return fetchWithRetry(`${getApiUrl()}/products/categories/${id}${force ? '?force=true' : ''}`, {
      method: 'DELETE'
    }).then(handleResponse<{ success: boolean; message: string }>);
  },

  getCategories: async (forceRefresh = false): Promise<Category[]> => {
    if (cachedCategories && !forceRefresh) {
      // Revalida em background
      fetchWithRetry(`${getApiUrl()}/products/categories/all`)
        .then(handleResponse<Category[]>)
        .then((c) => { cachedCategories = c; })
        .catch(() => {});
      return cachedCategories;
    }
    const cats = await fetchWithRetry(`${getApiUrl()}/products/categories/all`).then(handleResponse<Category[]>);
    cachedCategories = cats;
    return cats;
  },

  // Caixa & PDV
  getCurrentCashShift: (): Promise<{ isOpen: boolean; shift: CashShift | null; summary?: CashSummary }> =>
    fetchWithRetry(`${getApiUrl()}/cash/current`).then(handleResponse<{ isOpen: boolean; shift: CashShift | null; summary?: CashSummary }>),

  openCashShift: (initialBalance: number, openedBy: string, notes?: string): Promise<CashShift> =>
    fetchWithRetry(`${getApiUrl()}/cash/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initialBalance, openedBy, notes })
    }).then(handleResponse<CashShift>),

  addCashTransaction: (type: 'SUPPLY' | 'WITHDRAWAL', amount: number, reason: string): Promise<any> =>
    fetchWithRetry(`${getApiUrl()}/cash/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, amount, reason })
    }).then(handleResponse<any>),

  closeCashShift: (finalCashCount: number, closedBy: string, notes?: string): Promise<any> =>
    fetchWithRetry(`${getApiUrl()}/cash/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finalCashCount, closedBy, notes })
    }).then(handleResponse<any>),

  // Dashboard
  getAuditLogs: () => fetchWithRetry(`${getApiUrl()}/audit-logs`).then(handleResponse<any[]>),

  getDashboardData: (): Promise<DashboardData> =>
    fetchWithRetry(`${getApiUrl()}/dashboard`).then(handleResponse<DashboardData>),

  // Garçons & Comissões
  getCustomers: () => fetchWithRetry(`${getApiUrl()}/customers`).then(handleResponse<any[]>),
  createCustomer: (data: any) => fetchWithRetry(`${getApiUrl()}/customers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(handleResponse<any>),

  getWaiters: (all: boolean = false): Promise<Waiter[]> =>
    fetchWithRetry(`${getApiUrl()}/waiters?all=${all}`).then(handleResponse<Waiter[]>),

  createWaiter: (data: { name: string; code?: string; commissionRate?: number }): Promise<Waiter> =>
    fetchWithRetry(`${getApiUrl()}/waiters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(handleResponse<Waiter>),

  updateWaiter: (id: string, data: Partial<Waiter>): Promise<Waiter> =>
    fetchWithRetry(`${getApiUrl()}/waiters/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(handleResponse<Waiter>),

  deleteWaiter: (id: string): Promise<{ success: boolean; message?: string; waiter?: Waiter }> =>
    fetchWithRetry(`${getApiUrl()}/waiters/${id}`, {
      method: 'DELETE'
    }).then(handleResponse<{ success: boolean; message?: string; waiter?: Waiter }>)
};
