import { Router } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../prisma.js';

export function createOrdersRouter(io: SocketIOServer) {
  const router = Router();

  // Buscar comanda por ID
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          table: true,
          items: {
            include: { product: true },
            orderBy: { addedAt: 'desc' }
          },
          payments: {
            orderBy: { receivedAt: 'desc' }
          }
        }
      });

      if (!order) {
        return res.status(404).json({ error: 'Comanda não encontrada' });
      }

      res.json(order);
    } catch (error) {
      console.error('Erro ao buscar comanda:', error);
      res.status(500).json({ error: 'Erro ao buscar comanda' });
    }
  });

  // Adicionar itens ao pedido
  router.post('/:id/items', async (req, res) => {
    try {
      const { id } = req.params;
      const { items } = req.body; // Array de { productId, quantity, notes }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Nenhum item informado' });
      }

      const order = await prisma.order.findUnique({
        where: { id },
        include: { table: true }
      });

      if (!order) {
        return res.status(404).json({ error: 'Comanda não encontrada' });
      }

      if (order.status !== 'OPEN') {
        return res.status(400).json({ error: 'Esta comanda já foi fechada ou cancelada' });
      }

      const createdItems = [];

      for (const item of items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          include: { components: true }
        });

        if (!product) continue;

        const qty = Number(item.quantity) || 1;
        const unitPrice = product.price;
        const totalPrice = unitPrice * qty;

        // Criar item do pedido
        const orderItem = await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: product.id,
            quantity: qty,
            unitPrice,
            totalPrice,
            notes: item.notes || null,
            kdsStatus: 'PENDING',
            kdsStation: product.kdsStation
          },
          include: { product: true }
        });

        // Dar baixa no estoque (Verifica Ficha Técnica / Componentes)
        if (product.components && product.components.length > 0) {
          for (const comp of product.components) {
            await prisma.product.update({
              where: { id: comp.componentId },
              data: { stock: { decrement: comp.quantity * qty } }
            });
          }
        } else if (product.trackStock) {
          await prisma.product.update({
            where: { id: product.id },
            data: { stock: { decrement: qty } }
          });
        }

        createdItems.push(orderItem);
      }

      // Recalcular totais da comanda
      const allItems = await prisma.orderItem.findMany({
        where: { orderId: order.id }
      });

      const subtotal = allItems.reduce((acc, item) => acc + item.totalPrice, 0);
      const serviceFee = order.isServiceFeeActive ? subtotal * order.serviceFeeRate : 0;
      const total = subtotal + serviceFee - order.discount;

      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: { subtotal, serviceFee, total },
        include: {
          table: true,
          items: { include: { product: true } },
          payments: true
        }
      });

      // Se a mesa estiver em CLOSING, volta para OCCUPIED pois novos itens foram adicionados
      if (order.tableId) {
        await prisma.table.update({
          where: { id: order.tableId },
          data: { status: 'OCCUPIED' }
        });
      }

      // Emitir eventos em tempo real
      io.emit('order:updated', { orderId: updatedOrder.id, itemsCount: createdItems.length });
      io.emit('kds:new_order', {
        items: createdItems,
        orderNumber: order.orderNumber,
        tableName: order.table?.name || (order.table ? `Mesa ${order.table.number}` : 'Balcão'),
        tableNumber: order.table?.number,
        waiterName: order.waiterName || 'Garçom'
      });
      if (order.tableId) {
        io.emit('table:updated', { tableId: order.tableId, action: 'items_added' });
      }

      res.status(201).json({ order: updatedOrder, addedItems: createdItems });
    } catch (error) {
      console.error('Erro ao adicionar itens:', error);
      res.status(500).json({ error: 'Erro ao adicionar itens' });
    }
  });

  // Cancelar / Excluir item do pedido
  router.delete('/:id/items/:itemId', async (req, res) => {
    try {
      const { id, itemId } = req.params;

      const item = await prisma.orderItem.findUnique({
        where: { id: itemId },
        include: { product: { include: { components: true } } }
      });

      if (!item || item.orderId !== id) {
        return res.status(404).json({ error: 'Item não encontrado no pedido' });
      }

      // Devolver estoque (Ficha Técnica ou Unidade)
      if (item.product) {
        if (item.product.components && item.product.components.length > 0) {
          for (const comp of item.product.components) {
            await prisma.product.update({
              where: { id: comp.componentId },
              data: { stock: { increment: comp.quantity * item.quantity } }
            });
          }
        } else if (item.product.trackStock) {
          await prisma.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } }
          });
        }
      }

      // Deletar o item
      await prisma.orderItem.delete({ where: { id: itemId } });

      // Registrar Auditoria
      const auditId = 'al_' + Math.random().toString(36).substr(2, 9);
      await prisma.$executeRawUnsafe(`
        INSERT INTO AuditLog (id, action, description, createdAt) 
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `, auditId, 'CANCEL_ITEM', `Cancelado ${item.quantity}x ${item.product.name} (Pedido #${id.slice(-4)})`);

      // Recalcular totais
      const order = await prisma.order.findUnique({ where: { id } });
      if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

      const allItems = await prisma.orderItem.findMany({ where: { orderId: id } });
      const subtotal = allItems.reduce((acc, it) => acc + it.totalPrice, 0);
      const serviceFee = order.isServiceFeeActive ? subtotal * order.serviceFeeRate : 0;
      const total = subtotal + serviceFee - order.discount;

      const updatedOrder = await prisma.order.update({
        where: { id },
        data: { subtotal, serviceFee, total },
        include: { items: { include: { product: true } }, table: true }
      });

      io.emit('order:updated', { orderId: id, action: 'item_removed' });
      if (updatedOrder.tableId) {
        io.emit('table:updated', { tableId: updatedOrder.tableId, action: 'item_removed' });
      }

      res.json(updatedOrder);
    } catch (error) {
      console.error('Erro ao remover item:', error);
      res.status(500).json({ error: 'Erro ao remover item' });
    }
  });

  // Alternar Taxa de Serviço (10%)
  router.put('/:id/service-fee', async (req, res) => {
    try {
      const { id } = req.params;
      const { active, rate } = req.body;

      const order = await prisma.order.findUnique({ where: { id } });
      if (!order) return res.status(404).json({ error: 'Comanda não encontrada' });

      const isServiceFeeActive = active !== undefined ? Boolean(active) : !order.isServiceFeeActive;
      const serviceFeeRate = rate !== undefined ? Number(rate) : order.serviceFeeRate;

      const serviceFee = isServiceFeeActive ? order.subtotal * serviceFeeRate : 0;
      const total = order.subtotal + serviceFee - order.discount;

      const updated = await prisma.order.update({
        where: { id },
        data: { isServiceFeeActive, serviceFeeRate, serviceFee, total },
        include: { items: { include: { product: true } }, payments: true, table: true }
      });

      io.emit('order:updated', { orderId: id });
      if (updated.tableId) {
        io.emit('table:updated', { tableId: updated.tableId });
      }

      res.json(updated);
    } catch (error) {
      console.error('Erro ao atualizar taxa de serviço:', error);
      res.status(500).json({ error: 'Erro ao atualizar taxa de serviço' });
    }
  });

  // Aplicar Desconto
  router.put('/:id/discount', async (req, res) => {
    try {
      const { id } = req.params;
      const { discount } = req.body;

      const order = await prisma.order.findUnique({ where: { id } });
      if (!order) return res.status(404).json({ error: 'Comanda não encontrada' });

      const discountAmount = Math.max(0, Number(discount) || 0);
      const total = Math.max(0, order.subtotal + order.serviceFee - discountAmount);

      const updated = await prisma.order.update({
        where: { id },
        data: { discount: discountAmount, total },
        include: { items: { include: { product: true } }, payments: true, table: true }
      });

      // Registrar Auditoria
      if (discountAmount > 0) {
        const auditId = 'al_' + Math.random().toString(36).substr(2, 9);
        await prisma.$executeRawUnsafe(`
          INSERT INTO AuditLog (id, action, description, createdAt) 
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `, auditId, 'APPLY_DISCOUNT', `Desconto de R$ \${discountAmount.toFixed(2)} na Comanda #\${id.slice(-4)}`);
      }

      io.emit('order:updated', { orderId: id });
      res.json(updated);
    } catch (error) {
      console.error('Erro ao aplicar desconto:', error);
      res.status(500).json({ error: 'Erro ao aplicar desconto' });
    }
  });

  // Realizar Pagamento e/ou Fechar Comanda
  router.post('/:id/pay', async (req, res) => {
    try {
      const { id } = req.params;
      const { payments, closeOrder } = req.body;
      // payments: Array<{ amount: number, method: string, notes?: string }>

      if (!payments || !Array.isArray(payments) || payments.length === 0) {
        return res.status(400).json({ error: 'Nenhum pagamento fornecido' });
      }

      const order = await prisma.order.findUnique({
        where: { id },
        include: { table: true, payments: true }
      });

      if (!order) return res.status(404).json({ error: 'Comanda não encontrada' });

      // Buscar turno de caixa aberto
      const activeShift = await prisma.cashShift.findFirst({
        where: { status: 'OPEN' },
        orderBy: { openedAt: 'desc' }
      });

      let addedPaidAmount = 0;
      for (const p of payments) {
        const amt = Number(p.amount) || 0;
        if (amt <= 0) continue;

        await prisma.payment.create({
          data: {
            orderId: order.id,
            amount: amt,
            method: p.method,
            notes: p.notes || null,
            cashShiftId: activeShift ? activeShift.id : null
          }
        });

        addedPaidAmount += amt;
      }

      const newPaidTotal = (order.paidAmount || 0) + addedPaidAmount;
      const shouldClose = closeOrder !== undefined ? Boolean(closeOrder) : newPaidTotal >= order.total - 0.05;

      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: {
          paidAmount: newPaidTotal,
          status: shouldClose ? 'PAID' : 'OPEN',
          closedAt: shouldClose ? new Date() : null
        },
        include: {
          table: true,
          items: { include: { product: true } },
          payments: true
        }
      });

      // Se a conta foi fechada, liberar a mesa
      if (shouldClose && order.tableId) {
        await prisma.table.update({
          where: { id: order.tableId },
          data: {
            status: 'AVAILABLE',
            currentOrderId: null,
            customerName: null,
            customerCount: 1,
            openedAt: null
          }
        });
        io.emit('table:updated', { tableId: order.tableId, action: 'closed' });
      }

      io.emit('order:updated', { orderId: order.id, action: 'paid' });
      io.emit('cash:updated');

      res.json({
        success: true,
        order: updatedOrder,
        isFullyPaid: updatedOrder.status === 'PAID'
      });
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      res.status(500).json({ error: 'Erro ao processar pagamento' });
    }
  });

  return router;
}
