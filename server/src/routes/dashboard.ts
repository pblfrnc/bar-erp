import { Router } from 'express';
import { prisma } from '../prisma.js';

export function createDashboardRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Pagamentos recebidos hoje
      const todayPayments = await prisma.payment.findMany({
        where: { receivedAt: { gte: todayStart } }
      });

      const todayRevenue = todayPayments.reduce((acc, p) => acc + p.amount, 0);

      // Comandas fechadas hoje
      const closedOrdersToday = await prisma.order.findMany({
        where: {
          status: 'PAID',
          closedAt: { gte: todayStart }
        }
      });

      const averageTicket = closedOrdersToday.length > 0
        ? todayRevenue / closedOrdersToday.length
        : 0;

      // Status das mesas agora
      const tables = await prisma.table.findMany();
      const occupiedTables = tables.filter((t) => t.status === 'OCCUPIED' || t.status === 'CLOSING').length;
      const totalTables = tables.length;

      // Top produtos vendidos
      const orderItems = await prisma.orderItem.findMany({
        where: {
          addedAt: { gte: todayStart }
        },
        include: { product: true }
      });

      const productSalesMap: Record<string, { name: string; quantity: number; total: number; station: string }> = {};
      orderItems.forEach((item) => {
        if (!productSalesMap[item.productId]) {
          productSalesMap[item.productId] = {
            name: item.product.name,
            quantity: 0,
            total: 0,
            station: item.product.kdsStation
          };
        }
        productSalesMap[item.productId].quantity += item.quantity;
        productSalesMap[item.productId].total += item.totalPrice;
      });

      const topProducts = Object.values(productSalesMap)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      // Vendas por método de pagamento hoje
      const paymentMethodsBreakdown: Record<string, number> = {};
      todayPayments.forEach((p) => {
        paymentMethodsBreakdown[p.method] = (paymentMethodsBreakdown[p.method] || 0) + p.amount;
      });

      res.json({
        todayRevenue,
        ordersCompletedToday: closedOrdersToday.length,
        occupiedTables,
        totalTables,
        occupancyRate: totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0,
        averageTicket,
        topProducts,
        paymentMethodsBreakdown
      });
    } catch (error) {
      console.error('Erro ao gerar dados do dashboard:', error);
      res.status(500).json({ error: 'Erro ao gerar dados do dashboard' });
    }
  });

  return router;
}
