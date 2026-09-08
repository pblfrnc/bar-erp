import { Router } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../prisma.js';

export function createOrdersRouter(io: SocketIOServer) {
  const router = Router();

  // ============================================================
  // Baixar Comanda como Perda (Calote)
  // ============================================================
  router.post('/:id/loss', async (req, res) => {
    try {
      const { id } = req.params;
      
      const order = await prisma.order.findUnique({
        where: { id },
        include: { table: true, payments: true, items: true }
      });

      if (!order) return res.status(404).json({ error: 'Comanda não encontrada' });
      if (order.status === 'CLOSED') return res.status(400).json({ error: 'Comanda já fechada.' });

      // Calcular o total e o saldo devedor
      const itemsTotal = order.items.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0);
      const fee = order.isServiceFeeActive ? itemsTotal * 0.1 : 0;
      const discount = order.discount || 0;
      const total = itemsTotal + fee - discount;
      
      const paidTotal = order.payments.reduce((acc, p) => acc + p.amount, 0);
      const lostAmount = total - paidTotal;

      // 1. Fechar a comanda sem pagamentos
      await prisma.order.update({
        where: { id },
        data: { status: 'CLOSED', closedAt: new Date() }
      });

      // 2. Liberar a mesa
      if (order.tableId) {
        await prisma.table.update({
          where: { id: order.tableId },
          data: { status: 'AVAILABLE', currentOrderId: null }
        });
      }

      // 3. Registrar a perda na Auditoria Cega
      if (lostAmount > 0) {
        const auditId = 'al_' + Math.random().toString(36).substr(2, 9);
        await prisma.$executeRawUnsafe(`
          INSERT INTO AuditLog (id, action, description, createdAt) 
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `, auditId, 'LOSS_CALOTE', `Perda (Calote/Evasão) de R$ ${lostAmount.toFixed(2)} na Comanda #${order.orderNumber} (Mesa ${order.table?.number || 'Balcão'})`);
      }

      io.emit('order:updated', { orderId: id, action: 'closed_loss' });
      if (order.tableId) {
        io.emit('table:updated', { tableId: order.tableId, action: 'table_freed' });
      }

      res.json({ success: true, message: 'Baixa de perda registrada com sucesso.', lostAmount });
    } catch (error) {
      console.error('Erro ao baixar como perda:', error);
      res.status(500).json({ error: 'Erro ao registrar baixa por calote.' });
    }
  });

  // ============================================================
  // Venda Rápida de Balcão (PDV Direto - Sem Mesa)
  // ============================================================
  router.post('/quick-sale', async (req, res) => {
    try {
      const { items, payment, customerName, discount } = req.body;
      // items: Array<{ productId: string, quantity: number, notes?: string }>
      // payment: { method: string, amount?: number, cashTendered?: number, notes?: string }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Nenhum item informado para a venda rápida' });
      }

      if (!payment || !payment.method) {
        return res.status(400).json({ error: 'Forma de pagamento não informada' });
      }

      // 1. Verificar turno de caixa aberto
      const activeShift = await prisma.cashShift.findFirst({
        where: { status: 'OPEN' },
        orderBy: { openedAt: 'desc' }
      });

      if (!activeShift) {
        return res.status(403).json({ error: 'O Caixa (PDV) está fechado! Abra o turno do caixa antes de realizar vendas.' });
      }

      // 2. Próximo número de comanda
      const lastOrder = await prisma.order.findFirst({ orderBy: { orderNumber: 'desc' } });
      const orderNumber = (lastOrder?.orderNumber || 100) + 1;

      // 3. Verificar produtos e calcular subtotal
      let subtotal = 0;
      const verifiedItems: any[] = [];

      for (const it of items) {
        const product = await prisma.product.findUnique({
          where: { id: it.productId },
          include: { components: true }
        });
        if (!product) continue;
        const qty = Math.max(1, Number(it.quantity) || 1);
        const isBox = it.unitType === 'BOX' && product.hasBoxPrice && product.boxPrice;
        const unitPrice = isBox ? Number(product.boxPrice) : product.price;
        const totalPrice = unitPrice * qty;
        subtotal += totalPrice;
        verifiedItems.push({
          product,
          quantity: qty,
          unitPrice,
          totalPrice,
          unitType: isBox ? 'BOX' : 'UNIT',
          notes: it.notes
        });
      }

      if (verifiedItems.length === 0) {
        return res.status(400).json({ error: 'Nenhum produto válido encontrado' });
      }

      const discountAmt = Math.min(Number(discount) || 0, subtotal);
      const finalTotal = Math.max(0, subtotal - discountAmt);

      // 4. Criar pedido já fechado (PAID) e sem mesa
      const order = await prisma.order.create({
        data: {
          tableId: null,
          orderNumber,
          customerName: customerName || 'Cliente Balcão',
          waiterName: 'Balcão / Caixa',
          subtotal,
          discount: discountAmt,
          serviceFee: 0,
          isServiceFeeActive: false,
          total: finalTotal,
          paidAmount: finalTotal,
          status: 'PAID',
          closedAt: new Date()
        }
      });

      // 5. Criar OrderItems e dar baixa de estoque
      const createdOrderItems: any[] = [];
      for (const vi of verifiedItems) {
        const orderItem = await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: vi.product.id,
            quantity: vi.quantity,
            unitPrice: vi.unitPrice,
            totalPrice: vi.totalPrice,
            unitType: vi.unitType,
            notes: vi.notes || (vi.unitType === 'BOX' ? `📦 Caixa Fechada (${vi.product.boxQuantity || 24} un)` : null),
            kdsStatus: vi.product.kdsStation === 'NONE' ? 'DELIVERED' : 'PENDING',
            kdsStation: vi.product.kdsStation,
            paidQuantity: vi.quantity
          },
          include: { product: true }
        });

        // Quantidade total de unidades avulsas a abater do estoque
        const unitsMultiplier = vi.unitType === 'BOX' ? (vi.product.boxQuantity || 24) : 1;
        const totalStockUnitsToDeduct = vi.quantity * unitsMultiplier;

        // Baixa no estoque
        if (vi.product.components && vi.product.components.length > 0) {
          for (const comp of vi.product.components) {
            await prisma.product.update({
              where: { id: comp.componentId },
              data: { stock: { decrement: comp.quantity * totalStockUnitsToDeduct } }
            });
          }
        } else if (vi.product.trackStock) {
          await prisma.product.update({
            where: { id: vi.product.id },
            data: { stock: { decrement: totalStockUnitsToDeduct } }
          });
        }

        createdOrderItems.push(orderItem);
      }

      // 6. Criar pagamento associado ao turno de caixa
      const paymentAmount = Number(payment.amount) || finalTotal;
      const cashTendered = Number(payment.cashTendered) || paymentAmount;
      const changeAmount = payment.method === 'CASH' && cashTendered > paymentAmount ? cashTendered - paymentAmount : 0;

      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: paymentAmount,
          method: payment.method,
          notes: changeAmount > 0 
            ? `Troco: R$ ${changeAmount.toFixed(2)} (Recebido: R$ ${cashTendered.toFixed(2)})` 
            : (payment.notes || null),
          cashShiftId: activeShift.id
        }
      });

      // 7. Notificar via WebSocket
      io.emit('order:updated', { orderId: order.id, action: 'quick_sale' });
      io.emit('cash:updated');

      const kdsItems = createdOrderItems.filter(i => i.kdsStation !== 'NONE');
      if (kdsItems.length > 0) {
        io.emit('kds:new_order', {
          items: kdsItems,
          orderNumber: order.orderNumber,
          tableName: 'Balcão',
          waiterName: 'Balcão / Caixa'
        });
      }

      const fullOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: {
          items: { include: { product: true } },
          payments: true
        }
      });

      res.status(201).json({
        success: true,
        order: fullOrder,
        change: changeAmount,
        message: 'Venda de balcão concluída com sucesso!'
      });
    } catch (error: any) {
      console.error('Erro na venda rápida:', error);
      res.status(500).json({ error: error.message || 'Erro ao processar venda rápida' });
    }
  });

  // ============================================================
  // Listar Comandas Finalizadas (Histórico de Vendas)
  // ============================================================
  router.get('/history', async (req, res) => {
    try {
      const { limit = 100, date } = req.query;

      const whereClause: any = {
        status: { in: ['PAID', 'CLOSED'] }
      };

      if (date && typeof date === 'string') {
        const startOfDay = new Date(date + 'T00:00:00.000Z');
        const endOfDay = new Date(date + 'T23:59:59.999Z');
        whereClause.closedAt = {
          gte: startOfDay,
          lte: endOfDay
        };
      }

      const orders = await prisma.order.findMany({
        where: whereClause,
        orderBy: { closedAt: 'desc' },
        take: Number(limit) || 100,
        include: {
          table: true,
          items: {
            include: { product: true }
          },
          payments: {
            orderBy: { receivedAt: 'desc' }
          }
        }
      });

      res.json(orders);
    } catch (error: any) {
      console.error('Erro ao buscar histórico de comandas:', error);
      res.status(500).json({ error: 'Erro ao buscar histórico de comandas' });
    }
  });

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
        const isBox = item.unitType === 'BOX' && product.hasBoxPrice && product.boxPrice;
        const unitPrice = isBox ? Number(product.boxPrice) : product.price;
        const totalPrice = unitPrice * qty;

        // Criar item do pedido
        const orderItem = await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: product.id,
            quantity: qty,
            unitPrice,
            totalPrice,
            unitType: isBox ? 'BOX' : 'UNIT',
            notes: item.notes || (isBox ? `📦 Caixa Fechada (${product.boxQuantity || 24} un)` : null),
            kdsStatus: 'PENDING',
            kdsStation: product.kdsStation
          },
          include: { product: true }
        });

        // Quantidade total de unidades avulsas a abater do estoque
        const unitsMultiplier = isBox ? (product.boxQuantity || 24) : 1;
        const totalStockUnitsToDeduct = qty * unitsMultiplier;

        // Dar baixa no estoque (Verifica Ficha Técnica / Componentes)
        if (product.components && product.components.length > 0) {
          for (const comp of product.components) {
            await prisma.product.update({
              where: { id: comp.componentId },
              data: { stock: { decrement: comp.quantity * totalStockUnitsToDeduct } }
            });
          }
        } else if (product.trackStock) {
          await prisma.product.update({
            where: { id: product.id },
            data: { stock: { decrement: totalStockUnitsToDeduct } }
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
        `, auditId, 'APPLY_DISCOUNT', `Desconto de R$ ${discountAmount.toFixed(2)} na Comanda #${order.orderNumber}`);
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
      const { payments, closeOrder, customerId, paidItems } = req.body;
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

      if (!activeShift) {
        return res.status(403).json({ error: 'O Caixa (PDV) está fechado! Abra o turno do caixa antes de fechar pedidos ou receber pagamentos.' });
      }


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


        // Atualizar saldo do fiado (usando query raw)
        if (p.method === 'CREDIT_TAB' && customerId) {
          try { await prisma.$executeRawUnsafe(`UPDATE "Customer" SET creditTabBalance = creditTabBalance + ? WHERE id = ?`, amt, customerId); } catch(e:any) { console.error("FK error Customer:", e.message); }
        }

        addedPaidAmount += amt;



      }

      // Atualizar paidQuantity dos itens (Racha por Itens)
      if (paidItems && Array.isArray(paidItems)) {
        for (const pi of paidItems) {
          if (pi.itemId && pi.quantity > 0) {
            try {
              await prisma.$executeRawUnsafe(`UPDATE "OrderItem" SET "paidQuantity" = "paidQuantity" + ? WHERE id = ?`, pi.quantity, pi.itemId);
            } catch(e) { console.error("Erro paidQuantity:", e); }
          }
        }
      }

      const newPaidTotal = (order.paidAmount || 0) + addedPaidAmount;
      const shouldClose = closeOrder !== undefined ? Boolean(closeOrder) : newPaidTotal >= order.total - 0.05;

      if (customerId) {
        try { await prisma.$executeRawUnsafe(`UPDATE "Order" SET customerId = ? WHERE id = ?`, customerId, order.id); } catch(e:any) { console.error("FK error Order:", e.message); }
      }

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
      res.status(500).json({ error: error instanceof Error ? error.message : 'Erro ao processar pagamento' });
    }
  });

  return router;
}
