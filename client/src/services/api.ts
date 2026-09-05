import {
  Table,
  Order,
  Product,
  Category,
  OrderItem,
  CashShift,
  CashSummary,
  DashboardData,
  KdsStatus
} from '../types';

const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001/api' : '/api';

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
    fetch(`${API_URL}/tables`).then(handleResponse<Table[]>),

  createTable: (data: { number: number; name?: string; capacity: number; section: string }): Promise<Table> =>
    fetch(`${API_URL}/tables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(handleResponse<Table>),

  openTable: (id: string, data: { customerName?: string; waiterName?: string; customerCount: number }): Promise<{ table: Table; order: Order }> =>
    fetch(`${API_URL}/tables/${id}/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(handleResponse<{ table: Table; order: Order }>),

  requestTableClosing: (id: string): Promise<Table> =>
    fetch(`${API_URL}/tables/${id}/request-closing`, { method: 'POST' }).then(handleResponse<Table>),

  reopenTable: (id: string): Promise<Table> =>
    fetch(`${API_URL}/tables/${id}/reopen`, { method: 'POST' }).then(handleResponse<Table>),

  transferTable: (id: string, targetTableId: string): Promise<{ success: boolean; message: string }> =>
    fetch(`${API_URL}/tables/${id}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetTableId })
    }).then(handleResponse<{ success: boolean; message: string }>),

  mergeTables: (id: string, secondTableId: string): Promise<{ success: boolean; message: string }> =>
    fetch(`${API_URL}/tables/${id}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secondTableId })
    }).then(handleResponse<{ success: boolean; message: string }>),

  // Comandas / Pedidos
  getOrder: (id: string): Promise<Order> =>
    fetch(`${API_URL}/orders/${id}`).then(handleResponse<Order>),

  addOrderItems: (
    orderId: string,
    items: { productId: string; quantity: number; notes?: string }[]
  ): Promise<{ order: Order; addedItems: OrderItem[] }> =>
    fetch(`${API_URL}/orders/${orderId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    }).then(handleResponse<{ order: Order; addedItems: OrderItem[] }>),

  removeOrderItem: (orderId: string, itemId: string): Promise<Order> =>
    fetch(`${API_URL}/orders/${orderId}/items/${itemId}`, { method: 'DELETE' }).then(handleResponse<Order>),

  toggleServiceFee: (orderId: string, active?: boolean, rate?: number): Promise<Order> =>
    fetch(`${API_URL}/orders/${orderId}/service-fee`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active, rate })
    }).then(handleResponse<Order>),

  applyDiscount: (orderId: string, discount: number): Promise<Order> =>
    fetch(`${API_URL}/orders/${orderId}/discount`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discount })
    }).then(handleResponse<Order>),

  payOrder: (
    orderId: string,
    data: { payments: { amount: number; method: string; notes?: string }[]; closeOrder?: boolean }
  ): Promise<{ success: boolean; order: Order; isFullyPaid: boolean }> =>
    fetch(`${API_URL}/orders/${orderId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(handleResponse<{ success: boolean; order: Order; isFullyPaid: boolean }>),

  // KDS
  getKdsItems: (station?: string): Promise<OrderItem[]> => {
    const query = station && station !== 'ALL' ? `?station=${station}` : '';
    return fetch(`${API_URL}/kds${query}`).then(handleResponse<OrderItem[]>);
  },

  updateKdsItemStatus: (itemId: string, status: KdsStatus): Promise<OrderItem> =>
    fetch(`${API_URL}/kds/items/${itemId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    }).then(handleResponse<OrderItem>),

  markAllReady: (orderId: string, station?: string): Promise<{ success: boolean }> =>
    fetch(`${API_URL}/kds/orders/${orderId}/ready-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ station })
    }).then(handleResponse<{ success: boolean }>),

  // Produtos & Cardápio
  getProducts: (categoryId?: string, search?: string): Promise<Product[]> => {
    const params = new URLSearchParams();
    if (categoryId) params.append('categoryId', categoryId);
    if (search) params.append('search', search);
    return fetch(`${API_URL}/products?${params.toString()}`).then(handleResponse<Product[]>);
  },

  createProduct: (data: Partial<Product>): Promise<Product> =>
    fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(handleResponse<Product>),

  updateProduct: (id: string, data: Partial<Product>): Promise<Product> =>
    fetch(`${API_URL}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(handleResponse<Product>),

  adjustStock: (id: string, adjustment?: number, newStock?: number): Promise<Product> =>
    fetch(`${API_URL}/products/${id}/stock`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adjustment, newStock })
    }).then(handleResponse<Product>),

  getCategories: (): Promise<Category[]> =>
    fetch(`${API_URL}/products/categories/all`).then(handleResponse<Category[]>),

  // Caixa & PDV
  getCurrentCashShift: (): Promise<{ isOpen: boolean; shift: CashShift | null; summary?: CashSummary }> =>
    fetch(`${API_URL}/cash/current`).then(handleResponse<{ isOpen: boolean; shift: CashShift | null; summary?: CashSummary }>),

  openCashShift: (initialBalance: number, openedBy: string, notes?: string): Promise<CashShift> =>
    fetch(`${API_URL}/cash/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initialBalance, openedBy, notes })
    }).then(handleResponse<CashShift>),

  addCashTransaction: (type: 'SUPPLY' | 'WITHDRAWAL', amount: number, reason: string): Promise<any> =>
    fetch(`${API_URL}/cash/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, amount, reason })
    }).then(handleResponse<any>),

  closeCashShift: (finalCashCount: number, closedBy: string, notes?: string): Promise<any> =>
    fetch(`${API_URL}/cash/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finalCashCount, closedBy, notes })
    }).then(handleResponse<any>),

  // Dashboard
  getDashboardData: (): Promise<DashboardData> =>
    fetch(`${API_URL}/dashboard`).then(handleResponse<DashboardData>)
};
