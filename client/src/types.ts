export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'CLOSING' | 'RESERVED';
export type OrderStatus = 'OPEN' | 'PAID' | 'CANCELLED';
export type KdsStatus = 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED';
export type KdsStation = 'BAR' | 'KITCHEN' | 'NONE';
export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'VOUCHER';

export interface Category {
  id: string;
  name: string;
  icon?: string;
  sortOrder: number;
  _count?: { products: number };
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  costPrice?: number | null;
  categoryId: string;
  category?: Category;
  kdsStation: KdsStation;
  stock: number;
  trackStock: boolean;
  minStock: number;
  unit: string;
  isActive: boolean;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string | null;
  kdsStatus: KdsStatus;
  kdsStation: KdsStation;
  addedAt: string;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  notes?: string | null;
  receivedAt: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  tableId?: string | null;
  table?: Table | null;
  status: OrderStatus;
  customerName?: string | null;
  waiterName?: string | null;
  subtotal: number;
  serviceFeeRate: number;
  serviceFee: number;
  discount: number;
  total: number;
  paidAmount: number;
  isServiceFeeActive: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  items: OrderItem[];
  payments: Payment[];
}

export interface Table {
  id: string;
  number: number;
  name?: string | null;
  capacity: number;
  status: TableStatus;
  section: string;
  currentOrderId?: string | null;
  customerCount: number;
  customerName?: string | null;
  openedAt?: string | null;
  mergedIntoTableId?: string | null;
  activeOrder?: Order | null;
}

export interface CashTransaction {
  id: string;
  cashShiftId: string;
  type: 'SUPPLY' | 'WITHDRAWAL';
  amount: number;
  reason: string;
  createdAt: string;
}

export interface CashShift {
  id: string;
  openedAt: string;
  closedAt?: string | null;
  openedBy: string;
  closedBy?: string | null;
  initialBalance: number;
  finalBalance?: number | null;
  expectedBalance?: number | null;
  difference?: number | null;
  status: 'OPEN' | 'CLOSED';
  notes?: string | null;
  transactions: CashTransaction[];
  payments: (Payment & { order?: { table?: { number: number; name?: string } } })[];
}

export interface CashSummary {
  initialBalance: number;
  totalSupplies: number;
  totalWithdrawals: number;
  totalSales: number;
  paymentsByMethod: Record<PaymentMethod, number>;
  expectedCashInDrawer: number;
}

export interface DashboardData {
  todayRevenue: number;
  ordersCompletedToday: number;
  occupiedTables: number;
  totalTables: number;
  occupancyRate: number;
  averageTicket: number;
  topProducts: { name: string; quantity: number; total: number; station: string }[];
  paymentMethodsBreakdown: Record<string, number>;
}
