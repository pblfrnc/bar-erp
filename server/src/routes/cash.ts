import { Router } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../prisma.js';

export function createCashRouter(io: SocketIOServer) {
  const router = Router();

  // Buscar status e totais do turno de caixa atual
  router.get('/current', async (req, res) => {
    try {
      const shift = await prisma.cashShift.findFirst({
        where: { status: 'OPEN' },
        orderBy: { openedAt: 'desc' },
        include: {
          transactions: { orderBy: { createdAt: 'desc' } },
          payments: {
            orderBy: { receivedAt: 'desc' },
            include: { order: { include: { table: true } } }
          }
        }
      });

      if (!shift) {
        return res.json({ isOpen: false, shift: null });
      }

      // Calcular totais
      let totalSupplies = 0;
      let totalWithdrawals = 0;
      shift.transactions.forEach((tx) => {
        if (tx.type === 'SUPPLY') totalSupplies += tx.amount;
        if (tx.type === 'WITHDRAWAL') totalWithdrawals += tx.amount;
      });

      const paymentsByMethod: Record<string, number> = {
        CASH: 0,
        CREDIT_CARD: 0,
        DEBIT_CARD: 0,
        PIX: 0,
        VOUCHER: 0
      };

      let totalSales = 0;
      shift.payments.forEach((p) => {
        paymentsByMethod[p.method] = (paymentsByMethod[p.method] || 0) + p.amount;
        totalSales += p.amount;
      });

      // Calcular comissões / 10% dos garçons acumulados no turno
      const ordersMap = new Map<string, any>();
      shift.payments.forEach((p) => {
        if (p.order && !ordersMap.has(p.order.id)) {
          ordersMap.set(p.order.id, p.order);
        }
      });

      const waiterMap = new Map<string, {
        waiterId: string | null;
        waiterName: string;
        ordersCount: number;
        totalSales: number;
        serviceFeeTotal: number;
      }>();

      let totalServiceFeesShift = 0;

      ordersMap.forEach((order) => {
        const waiterKey = order.waiterName || 'Garçom Geral';
        const existing = waiterMap.get(waiterKey) || {
          waiterId: order.waiterId || null,
          waiterName: waiterKey,
          ordersCount: 0,
          totalSales: 0,
          serviceFeeTotal: 0
        };

        existing.ordersCount += 1;
        existing.totalSales += order.total || 0;
        const fee = order.isServiceFeeActive ? (order.serviceFee || 0) : 0;
        existing.serviceFeeTotal += fee;
        totalServiceFeesShift += fee;

        waiterMap.set(waiterKey, existing);
      });

      const waiterCommissions = Array.from(waiterMap.values()).sort((a, b) => b.serviceFeeTotal - a.serviceFeeTotal);

      res.json({
        isOpen: true,
        shift,
        summary: {
          initialBalance: shift.initialBalance,
          totalSupplies,
          totalWithdrawals,
          totalSales,
          paymentsByMethod,
          expectedCashInDrawer,
          totalServiceFeesShift,
          waiterCommissions
        }
      });
    } catch (error) {
      console.error('Erro ao consultar caixa atual:', error);
      res.status(500).json({ error: 'Erro ao consultar caixa atual' });
    }
  });

  // Abrir novo turno de caixa
  router.post('/open', async (req, res) => {
    try {
      const { initialBalance, openedBy, notes } = req.body;

      // Verificar se já existe caixa aberto
      const activeShift = await prisma.cashShift.findFirst({
        where: { status: 'OPEN' }
      });

      if (activeShift) {
        return res.status(400).json({ error: 'Já existe um turno de caixa aberto' });
      }

      const shift = await prisma.cashShift.create({
        data: {
          initialBalance: Number(initialBalance) || 0,
          openedBy: openedBy || 'Operador de Caixa',
          status: 'OPEN',
          notes: notes || null
        }
      });

      io.emit('cash:updated');
      res.status(201).json(shift);
    } catch (error) {
      console.error('Erro ao abrir caixa:', error);
      res.status(500).json({ error: 'Erro ao abrir caixa' });
    }
  });

  // Registrar movimentação avulsa (Sangria / Suprimento)
  router.post('/transaction', async (req, res) => {
    try {
      const { type, amount, reason } = req.body; // type: 'SUPPLY' | 'WITHDRAWAL'

      if (!type || !amount || !reason) {
        return res.status(400).json({ error: 'Tipo, valor e motivo são obrigatórios' });
      }

      const activeShift = await prisma.cashShift.findFirst({
        where: { status: 'OPEN' }
      });

      if (!activeShift) {
        return res.status(400).json({ error: 'Nenhum turno de caixa aberto' });
      }

      const transaction = await prisma.cashTransaction.create({
        data: {
          cashShiftId: activeShift.id,
          type,
          amount: Number(amount),
          reason
        }
      });

      io.emit('cash:updated');
      res.status(201).json(transaction);
    } catch (error) {
      console.error('Erro ao registrar movimentação de caixa:', error);
      res.status(500).json({ error: 'Erro ao registrar movimentação' });
    }
  });

  // Fechar turno de caixa
  router.post('/close', async (req, res) => {
    try {
      const { finalCashCount, closedBy, notes } = req.body;

      const shift = await prisma.cashShift.findFirst({
        where: { status: 'OPEN' },
        include: {
          transactions: true,
          payments: {
            include: { order: true }
          }
        }
      });

      if (!shift) {
        return res.status(400).json({ error: 'Nenhum turno aberto para fechar' });
      }

      // Calcular esperado em dinheiro
      let supplies = 0;
      let withdrawals = 0;
      shift.transactions.forEach((tx) => {
        if (tx.type === 'SUPPLY') supplies += tx.amount;
        if (tx.type === 'WITHDRAWAL') withdrawals += tx.amount;
      });

      let cashSales = 0;
      shift.payments.forEach((p) => {
        if (p.method === 'CASH') cashSales += p.amount;
      });

      const expectedCash = shift.initialBalance + supplies - withdrawals + cashSales;
      const finalBalance = Number(finalCashCount) || 0;
      const difference = finalBalance - expectedCash;

      // Calcular comissões / 10% dos garçons acumulados no turno
      const ordersMap = new Map<string, any>();
      shift.payments.forEach((p) => {
        if (p.order && !ordersMap.has(p.order.id)) {
          ordersMap.set(p.order.id, p.order);
        }
      });

      const waiterMap = new Map<string, {
        waiterId: string | null;
        waiterName: string;
        ordersCount: number;
        totalSales: number;
        serviceFeeTotal: number;
      }>();

      let totalServiceFeesShift = 0;

      ordersMap.forEach((order) => {
        const waiterKey = order.waiterName || 'Garçom Geral';
        const existing = waiterMap.get(waiterKey) || {
          waiterId: order.waiterId || null,
          waiterName: waiterKey,
          ordersCount: 0,
          totalSales: 0,
          serviceFeeTotal: 0
        };

        existing.ordersCount += 1;
        existing.totalSales += order.total || 0;
        const fee = order.isServiceFeeActive ? (order.serviceFee || 0) : 0;
        existing.serviceFeeTotal += fee;
        totalServiceFeesShift += fee;

        waiterMap.set(waiterKey, existing);
      });

      const waiterCommissions = Array.from(waiterMap.values()).sort((a, b) => b.serviceFeeTotal - a.serviceFeeTotal);

      const closedShift = await prisma.cashShift.update({
        where: { id: shift.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedBy: closedBy || 'Operador de Caixa',
          finalBalance,
          expectedBalance: expectedCash,
          difference,
          notes: notes || shift.notes
        }
      });

      io.emit('cash:updated');
      res.json({
        success: true,
        shift: closedShift,
        report: {
          expectedCash,
          countedCash: finalBalance,
          difference,
          totalServiceFeesShift,
          waiterCommissions
        }
      });
    } catch (error) {
      console.error('Erro ao fechar caixa:', error);
      res.status(500).json({ error: 'Erro ao fechar caixa' });
    }
  });

  // Histórico de turnos anteriores
  router.get('/history', async (req, res) => {
    try {
      const shifts = await prisma.cashShift.findMany({
        orderBy: { openedAt: 'desc' },
        take: 30,
        include: {
          transactions: true,
          payments: true
        }
      });
      res.json(shifts);
    } catch (error) {
      console.error('Erro ao buscar histórico de caixa:', error);
      res.status(500).json({ error: 'Erro ao buscar histórico' });
    }
  });

  return router;
}
