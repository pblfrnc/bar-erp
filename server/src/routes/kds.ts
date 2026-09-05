import { Router } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../prisma.js';

export function createKdsRouter(io: SocketIOServer) {
  const router = Router();

  // Buscar itens ativos para as telas KDS do Bar e da Cozinha
  router.get('/', async (req, res) => {
    try {
      const { station } = req.query; // 'BAR' | 'KITCHEN' | 'ALL'

      const whereClause: any = {
        kdsStatus: { in: ['PENDING', 'PREPARING', 'READY'] },
        order: { status: 'OPEN' }
      };

      if (station && station !== 'ALL') {
        whereClause.kdsStation = String(station).toUpperCase();
      }

      const items = await prisma.orderItem.findMany({
        where: whereClause,
        include: {
          product: true,
          order: {
            include: {
              table: true
            }
          }
        },
        orderBy: { addedAt: 'asc' }
      });

      res.json(items);
    } catch (error) {
      console.error('Erro ao buscar itens KDS:', error);
      res.status(500).json({ error: 'Erro ao buscar itens KDS' });
    }
  });

  // Atualizar status de um item (PENDING -> PREPARING -> READY -> DELIVERED)
  router.put('/items/:itemId/status', async (req, res) => {
    try {
      const { itemId } = req.params;
      const { status } = req.body; // 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED'

      const validStatuses = ['PENDING', 'PREPARING', 'READY', 'DELIVERED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Status KDS inválido' });
      }

      const updatedItem = await prisma.orderItem.update({
        where: { id: itemId },
        data: { kdsStatus: status },
        include: {
          product: true,
          order: {
            include: { table: true }
          }
        }
      });

      io.emit('kds:item_updated', {
        itemId: updatedItem.id,
        status: updatedItem.kdsStatus,
        station: updatedItem.kdsStation,
        tableId: updatedItem.order.tableId,
        orderId: updatedItem.orderId
      });

      if (updatedItem.order.tableId) {
        io.emit('table:updated', { tableId: updatedItem.order.tableId, action: 'kds_status_changed' });
      }

      // Notificar os garçons quando o item ficar PRONTO para entrega
      if (status === 'READY') {
        io.emit('kds:item_ready', {
          itemId: updatedItem.id,
          orderId: updatedItem.orderId,
          orderNumber: updatedItem.order.orderNumber,
          tableName: updatedItem.order.table ? (updatedItem.order.table.name || `Mesa ${updatedItem.order.table.number}`) : 'Balcão',
          tableNumber: updatedItem.order.table?.number,
          waiterId: updatedItem.order.waiterId,
          waiterName: updatedItem.order.waiterName || 'Garçom',
          station: updatedItem.kdsStation,
          productName: updatedItem.product.name,
          quantity: updatedItem.quantity,
          notes: updatedItem.notes,
          readyAt: new Date().toISOString()
        });
      }

      res.json(updatedItem);
    } catch (error) {
      console.error('Erro ao atualizar status KDS:', error);
      res.status(500).json({ error: 'Erro ao atualizar status KDS' });
    }
  });

  // Marcar todos os itens de uma mesa/comanda como PRONTOS
  router.post('/orders/:orderId/ready-all', async (req, res) => {
    try {
      const { orderId } = req.params;
      const { station } = req.body;

      const whereClause: any = {
        orderId,
        kdsStatus: { in: ['PENDING', 'PREPARING'] }
      };

      if (station) {
        whereClause.kdsStation = station;
      }

      const orderBefore = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          table: true,
          items: {
            where: whereClause,
            include: { product: true }
          }
        }
      });

      await prisma.orderItem.updateMany({
        where: whereClause,
        data: { kdsStatus: 'READY' }
      });

      io.emit('kds:batch_updated', { orderId, station, status: 'READY' });
      io.emit('order:updated', { orderId });

      // Notificar os garçons com todos os itens prontos
      if (orderBefore && orderBefore.items.length > 0) {
        io.emit('kds:order_ready', {
          orderId,
          orderNumber: orderBefore.orderNumber,
          tableName: orderBefore.table ? (orderBefore.table.name || `Mesa ${orderBefore.table.number}`) : 'Balcão',
          tableNumber: orderBefore.table?.number,
          waiterId: orderBefore.waiterId,
          waiterName: orderBefore.waiterName || 'Garçom',
          station: station || 'COZINHA',
          items: orderBefore.items.map((i) => ({
            name: i.product.name,
            quantity: i.quantity,
            notes: i.notes
          })),
          readyAt: new Date().toISOString()
        });
      }

      res.json({ success: true, message: 'Todos os itens foram marcados como prontos' });
    } catch (error) {
      console.error('Erro ao atualizar lote KDS:', error);
      res.status(500).json({ error: 'Erro ao atualizar lote KDS' });
    }
  });

  // Atualizar status em lote de um pedido (ex: PREPARING ou READY)
  router.post('/orders/:orderId/batch-status', async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status, station } = req.body;

      const validStatuses = ['PENDING', 'PREPARING', 'READY', 'DELIVERED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Status KDS inválido' });
      }

      const whereClause: any = { orderId };
      if (station && station !== 'ALL') {
        whereClause.kdsStation = station;
      }

      const orderBefore = status === 'READY' ? await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          table: true,
          items: {
            where: whereClause,
            include: { product: true }
          }
        }
      }) : null;

      await prisma.orderItem.updateMany({
        where: whereClause,
        data: { kdsStatus: status }
      });

      io.emit('kds:batch_updated', { orderId, station, status });
      io.emit('order:updated', { orderId });

      if (status === 'READY' && orderBefore && orderBefore.items.length > 0) {
        io.emit('kds:order_ready', {
          orderId,
          orderNumber: orderBefore.orderNumber,
          tableName: orderBefore.table ? (orderBefore.table.name || `Mesa ${orderBefore.table.number}`) : 'Balcão',
          tableNumber: orderBefore.table?.number,
          waiterId: orderBefore.waiterId,
          waiterName: orderBefore.waiterName || 'Garçom',
          station: station || 'COZINHA',
          items: orderBefore.items.map((i) => ({
            name: i.product.name,
            quantity: i.quantity,
            notes: i.notes
          })),
          readyAt: new Date().toISOString()
        });
      }

      res.json({ success: true, message: `Itens atualizados para ${status}` });
    } catch (error) {
      console.error('Erro ao atualizar lote de pedido KDS:', error);
      res.status(500).json({ error: 'Erro ao atualizar lote KDS' });
    }
  });

  return router;
}
