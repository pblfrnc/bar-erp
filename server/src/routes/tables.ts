import { Router } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../prisma.js';

export function createTablesRouter(io: SocketIOServer) {
  const router = Router();

  // Listar todas as mesas com pedido ativo
  router.get('/', async (req, res) => {
    try {
      const tables = await prisma.table.findMany({
        orderBy: { number: 'asc' },
        include: {
          orders: {
            where: { status: 'OPEN' },
            include: {
              items: {
                include: { product: true },
                orderBy: { addedAt: 'desc' }
              },
              payments: true
            }
          }
        }
      });

      // Formatar mesas para incluir o pedido ativo facilmente
      const formatted = tables.map((table) => {
        const activeOrder = table.orders[0] || null;
        return {
          ...table,
          activeOrder
        };
      });

      res.json(formatted);
    } catch (error) {
      console.error('Erro ao buscar mesas:', error);
      res.status(500).json({ error: 'Erro ao buscar mesas' });
    }
  });

  // Criar nova mesa
  router.post('/', async (req, res) => {
    try {
      const { number, name, capacity, section } = req.body;
      const existing = await prisma.table.findUnique({ where: { number: Number(number) } });
      if (existing) {
        return res.status(400).json({ error: `Mesa ${number} já existe` });
      }

      const table = await prisma.table.create({
        data: {
          number: Number(number),
          name: name || `Mesa ${number}`,
          capacity: Number(capacity) || 4,
          section: section || 'Salão Principal',
          status: 'AVAILABLE'
        }
      });

      io.emit('table:updated', { tableId: table.id, action: 'created' });
      res.status(201).json(table);
    } catch (error) {
      console.error('Erro ao criar mesa:', error);
      res.status(500).json({ error: 'Erro ao criar mesa' });
    }
  });

  // Abrir mesa (iniciar atendimento)
  router.post('/:id/open', async (req, res) => {
    try {
      const { id } = req.params;
      const { customerName, waiterName, customerCount } = req.body;

      const table = await prisma.table.findUnique({ where: { id } });
      if (!table) {
        return res.status(404).json({ error: 'Mesa não encontrada' });
      }

      if (table.status === 'OCCUPIED') {
        return res.status(400).json({ error: 'Mesa já está ocupada' });
      }

      // Obter próximo número sequencial de comanda
      const lastOrder = await prisma.order.findFirst({ orderBy: { orderNumber: 'desc' } });
      const orderNumber = (lastOrder?.orderNumber || 100) + 1;

      // Criar nova comanda / pedido aberto
      const order = await prisma.order.create({
        data: {
          tableId: table.id,
          orderNumber,
          customerName: customerName || null,
          waiterName: waiterName || 'Garçom',
          subtotal: 0,
          serviceFee: 0,
          total: 0,
          status: 'OPEN'
        }
      });

      // Atualizar mesa
      const updatedTable = await prisma.table.update({
        where: { id: table.id },
        data: {
          status: 'OCCUPIED',
          currentOrderId: order.id,
          customerName: customerName || null,
          customerCount: Number(customerCount) || 1,
          openedAt: new Date()
        }
      });

      io.emit('table:updated', { tableId: updatedTable.id, action: 'opened' });
      res.json({ table: updatedTable, order });
    } catch (error) {
      console.error('Erro ao abrir mesa:', error);
      res.status(500).json({ error: 'Erro ao abrir mesa' });
    }
  });

  // Solicitar Fechamento (status 'CLOSING' - pré-conta impressa ou pedida)
  router.post('/:id/request-closing', async (req, res) => {
    try {
      const { id } = req.params;
      const table = await prisma.table.update({
        where: { id },
        data: { status: 'CLOSING' }
      });

      io.emit('table:updated', { tableId: table.id, action: 'closing' });
      res.json(table);
    } catch (error) {
      console.error('Erro ao solicitar fechamento:', error);
      res.status(500).json({ error: 'Erro ao solicitar fechamento' });
    }
  });

  // Reabrir mesa (voltar de CLOSING para OCCUPIED)
  router.post('/:id/reopen', async (req, res) => {
    try {
      const { id } = req.params;
      const table = await prisma.table.update({
        where: { id },
        data: { status: 'OCCUPIED' }
      });

      io.emit('table:updated', { tableId: table.id, action: 'reopened' });
      res.json(table);
    } catch (error) {
      console.error('Erro ao reabrir mesa:', error);
      res.status(500).json({ error: 'Erro ao reabrir mesa' });
    }
  });

  // Transferir comanda de mesa A para mesa B
  router.post('/:id/transfer', async (req, res) => {
    try {
      const { id: sourceTableId } = req.params;
      const { targetTableId } = req.body;

      if (sourceTableId === targetTableId) {
        return res.status(400).json({ error: 'Mesa de origem e destino devem ser diferentes' });
      }

      const sourceTable = await prisma.table.findUnique({
        where: { id: sourceTableId },
        include: { orders: { where: { status: 'OPEN' } } }
      });

      const targetTable = await prisma.table.findUnique({
        where: { id: targetTableId },
        include: { orders: { where: { status: 'OPEN' } } }
      });

      if (!sourceTable || !targetTable) {
        return res.status(404).json({ error: 'Mesa de origem ou destino não encontrada' });
      }

      const sourceOrder = sourceTable.orders[0];
      if (!sourceOrder) {
        return res.status(400).json({ error: 'Mesa de origem não possui pedido ativo' });
      }

      if (targetTable.status !== 'AVAILABLE') {
        return res.status(400).json({ error: 'Mesa de destino precisa estar livre para transferência total' });
      }

      // Transferir pedido para a mesa de destino
      await prisma.order.update({
        where: { id: sourceOrder.id },
        data: { tableId: targetTable.id }
      });

      // Atualizar mesa de destino para OCCUPIED com os dados de origem
      await prisma.table.update({
        where: { id: targetTable.id },
        data: {
          status: sourceTable.status,
          currentOrderId: sourceOrder.id,
          customerName: sourceTable.customerName,
          customerCount: sourceTable.customerCount,
          openedAt: sourceTable.openedAt
        }
      });

      // Liberar mesa de origem
      await prisma.table.update({
        where: { id: sourceTable.id },
        data: {
          status: 'AVAILABLE',
          currentOrderId: null,
          customerName: null,
          customerCount: 1,
          openedAt: null
        }
      });

      io.emit('table:updated', { tableId: sourceTable.id, action: 'transferred_from' });
      io.emit('table:updated', { tableId: targetTable.id, action: 'transferred_to' });

      res.json({ success: true, message: `Mesa ${sourceTable.number} transferida para Mesa ${targetTable.number}` });
    } catch (error) {
      console.error('Erro ao transferir mesa:', error);
      res.status(500).json({ error: 'Erro ao transferir mesa' });
    }
  });

  // Juntar mesas (Unir pedidos de mesa B na mesa A)
  router.post('/:id/merge', async (req, res) => {
    try {
      const { id: mainTableId } = req.params;
      const { secondTableId } = req.body;

      const mainTable = await prisma.table.findUnique({
        where: { id: mainTableId },
        include: { orders: { where: { status: 'OPEN' } } }
      });

      const secondTable = await prisma.table.findUnique({
        where: { id: secondTableId },
        include: { orders: { where: { status: 'OPEN' } } }
      });

      if (!mainTable || !secondTable) {
        return res.status(404).json({ error: 'Mesas não encontradas' });
      }

      const mainOrder = mainTable.orders[0];
      const secondOrder = secondTable.orders[0];

      if (!mainOrder) {
        return res.status(400).json({ error: 'Mesa principal não possui comanda ativa' });
      }

      if (secondOrder) {
        // Mover todos os itens da segunda mesa para o pedido da mesa principal
        await prisma.orderItem.updateMany({
          where: { orderId: secondOrder.id },
          data: { orderId: mainOrder.id }
        });

        // Cancelar pedido antigo da segunda mesa
        await prisma.order.update({
          where: { id: secondOrder.id },
          data: { status: 'CANCELLED' }
        });

        // Recalcular totais da mesa principal
        const allItems = await prisma.orderItem.findMany({
          where: { orderId: mainOrder.id }
        });

        const subtotal = allItems.reduce((acc, item) => acc + item.totalPrice, 0);
        const serviceFee = mainOrder.isServiceFeeActive ? subtotal * mainOrder.serviceFeeRate : 0;
        const total = subtotal + serviceFee - mainOrder.discount;

        await prisma.order.update({
          where: { id: mainOrder.id },
          data: { subtotal, serviceFee, total }
        });
      }

      // Marcar segunda mesa como agrupada e livre
      await prisma.table.update({
        where: { id: secondTable.id },
        data: {
          status: 'AVAILABLE',
          currentOrderId: null,
          mergedIntoTableId: mainTable.id,
          customerName: null,
          openedAt: null
        }
      });

      // Atualizar capacidade / contagem de pessoas na mesa principal
      await prisma.table.update({
        where: { id: mainTable.id },
        data: {
          customerCount: (mainTable.customerCount || 1) + (secondTable.customerCount || 1)
        }
      });

      io.emit('table:updated', { tableId: mainTable.id, action: 'merged' });
      io.emit('table:updated', { tableId: secondTable.id, action: 'merged' });

      res.json({ success: true, message: `Mesa ${secondTable.number} unida à Mesa ${mainTable.number}` });
    } catch (error) {
      console.error('Erro ao agrupar mesas:', error);
      res.status(500).json({ error: 'Erro ao agrupar mesas' });
    }
  });

  return router;
}
