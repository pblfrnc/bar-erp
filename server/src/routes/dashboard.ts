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

      // Vendas por hora
      const salesByHour = Array.from({ length: 24 }).map((_, i) => ({ hour: i, total: 0 }));
      todayPayments.forEach(p => {
        const h = p.receivedAt.getHours();
        salesByHour[h].total += p.amount;
      });
      // Filtrar apenas o intervalo com vendas para não mostrar um monte de zero inútil
      const activeHours = salesByHour.filter(s => s.total > 0).map(s => s.hour);
      let minHour = activeHours.length > 0 ? Math.min(...activeHours) - 1 : 17;
      let maxHour = activeHours.length > 0 ? Math.max(...activeHours) + 1 : 23;
      if (minHour < 0) minHour = 0;
      if (maxHour > 23) maxHour = 23;
      const filteredSalesByHour = salesByHour.slice(minHour, maxHour + 1).map(h => ({ hour: \`\${h}h\`, total: h.total }));

      // Performance dos Garçons
      const waiterPerformanceMap: Record<string, { name: string; total: number; count: number }> = {};
      closedOrdersToday.forEach(order => {
        const wName = order.waiterName || 'Sem Garçom';
        if (!waiterPerformanceMap[wName]) {
          waiterPerformanceMap[wName] = { name: wName, total: 0, count: 0 };
        }
        waiterPerformanceMap[wName].total += order.total;
        waiterPerformanceMap[wName].count += 1;
      });
      const waiterPerformance = Object.values(waiterPerformanceMap).sort((a, b) => b.total - a.total);

      // Alertas de Baixa Margem
      const allProducts = await prisma.product.findMany({ where: { isActive: true, components: { none: {} } } });
      const lowMarginProducts = allProducts
        .filter(p => p.costPrice && p.price > 0 && ((p.price - p.costPrice) / p.price) < 0.3)
        .map(p => ({
          id: p.id,
          name: p.name,
          margin: Math.round(((p.price - (p.costPrice || 0)) / p.price) * 100),
          price: p.price,
          cost: p.costPrice
        }))
        .sort((a, b) => a.margin - b.margin);

      res.json({
        todayRevenue,
        ordersCompletedToday: closedOrdersToday.length,
        occupiedTables,
        totalTables,
        occupancyRate: totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0,
        averageTicket,
        topProducts,
        paymentMethodsBreakdown,
        salesByHour: filteredSalesByHour,
        waiterPerformance,
        lowMarginProducts
      });
    } catch (error) {
      console.error('Erro ao gerar dados do dashboard:', error);
      res.status(500).json({ error: 'Erro ao gerar dados do dashboard' });
    }
  });

  return router;
}
