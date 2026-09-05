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

      await prisma.orderItem.updateMany({
        where: whereClause,
        data: { kdsStatus: 'READY' }
      });

      io.emit('kds:batch_updated', { orderId, station, status: 'READY' });
      io.emit('order:updated', { orderId });

      res.json({ success: true, message: 'Todos os itens foram marcados como prontos' });
    } catch (error) {
      console.error('Erro ao atualizar lote KDS:', error);
      res.status(500).json({ error: 'Erro ao atualizar lote KDS' });
    }
  });

  return router;
}
