import { Router } from 'express';
import { prisma } from '../prisma.js';

export function createWaitersRouter() {
  const router = Router();

  // Listar garçons
  router.get('/', async (req, res) => {
    try {
      const { all } = req.query;
      const whereClause = all === 'true' ? {} : { active: true };

      const waiters = await prisma.waiter.findMany({
        where: whereClause,
        orderBy: { name: 'asc' }
      });

      res.json(waiters);
    } catch (error) {
      console.error('Erro ao buscar garçons:', error);
      res.status(500).json({ error: 'Erro ao buscar garçons' });
    }
  });

  // Criar garçom
  router.post('/', async (req, res) => {
    try {
      const { name, code, commissionRate } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'O nome do garçom é obrigatório' });
      }

      const existing = await prisma.waiter.findUnique({
        where: { name: name.trim() }
      });

      if (existing) {
        return res.status(400).json({ error: 'Já existe um garçom cadastrado com este nome' });
      }

      const waiter = await prisma.waiter.create({
        data: {
          name: name.trim(),
          code: code ? code.trim() : null,
          commissionRate: commissionRate !== undefined ? Number(commissionRate) : 0.10,
          active: true
        }
      });

      res.status(201).json(waiter);
    } catch (error) {
      console.error('Erro ao cadastrar garçom:', error);
      res.status(500).json({ error: 'Erro ao cadastrar garçom' });
    }
  });

  // Atualizar garçom
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, code, commissionRate, active } = req.body;

      const existing = await prisma.waiter.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Garçom não encontrado' });
      }

      const updateData: any = {};
      if (name && name.trim()) updateData.name = name.trim();
      if (code !== undefined) updateData.code = code ? code.trim() : null;
      if (commissionRate !== undefined) updateData.commissionRate = Number(commissionRate);
      if (active !== undefined) updateData.active = Boolean(active);

      const updated = await prisma.waiter.update({
        where: { id },
        data: updateData
      });

      res.json(updated);
    } catch (error) {
      console.error('Erro ao atualizar garçom:', error);
      res.status(500).json({ error: 'Erro ao atualizar garçom' });
    }
  });

  // Desativar ou excluir garçom
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const waiter = await prisma.waiter.findUnique({
        where: { id },
        include: { orders: { select: { id: true }, take: 1 } }
      });

      if (!waiter) {
        return res.status(404).json({ error: 'Garçom não encontrado' });
      }

      // Se já tiver comandas associadas, apenas desativa para preservar o histórico financeiro
      if (waiter.orders && waiter.orders.length > 0) {
        const updated = await prisma.waiter.update({
          where: { id },
          data: { active: false }
        });
        return res.json({ success: true, message: 'Garçom desativado com sucesso', waiter: updated });
      }

      // Se nunca foi vinculado a um pedido, pode excluir permanentemente
      await prisma.waiter.delete({ where: { id } });
      res.json({ success: true, message: 'Garçom excluído com sucesso' });
    } catch (error) {
      console.error('Erro ao excluir garçom:', error);
      res.status(500).json({ error: 'Erro ao excluir garçom' });
    }
  });

  return router;
}
