import fs from 'fs';
let f = fs.readFileSync('server/src/routes/orders.ts', 'utf-8');

const lossRoute = `
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
      const itemsTotal = order.items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
      const fee = order.isServiceFeeActive ? itemsTotal * 0.1 : 0;
      const discount = order.discountAmount || 0;
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
          data: { status: 'AVAILABLE', activeOrderId: null }
        });
      }

      // 3. Registrar a perda na Auditoria Cega
      if (lostAmount > 0) {
        const auditId = 'al_' + Math.random().toString(36).substr(2, 9);
        await prisma.$executeRawUnsafe(\`
          INSERT INTO AuditLog (id, action, description, createdAt) 
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        \`, auditId, 'LOSS_CALOTE', \`Perda (Calote/Evasão) de R$ \${lostAmount.toFixed(2)} na Comanda #\${order.orderNumber} (Mesa \${order.table?.number || 'Balcão'})\`);
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
`;

if (!f.includes('/loss')) {
  f = f.replace("const router = Router();", "const router = Router();\n" + lossRoute);
  fs.writeFileSync('server/src/routes/orders.ts', f);
}
