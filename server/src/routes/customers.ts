import { Router } from 'express';
import { prisma } from '../prisma.js';

export function createCustomersRouter() {
  const router = Router();

  // Listar clientes
  router.get('/', async (req, res) => {
    try {
      const customers = await prisma.$queryRaw`SELECT * FROM Customer ORDER BY name ASC`;
      res.json(customers);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao buscar clientes' });
    }
  });

  // Criar cliente
  router.post('/', async (req, res) => {
    try {
      const { name, phone, document, notes } = req.body;
      const id = 'cust_' + Math.random().toString(36).substr(2, 9);
      
      await prisma.$executeRawUnsafe(`
        INSERT INTO Customer (id, name, phone, document, notes, createdAt, updatedAt, creditTabBalance)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
      `, id, name, phone || null, document || null, notes || null);
      
      const newCustomer = await prisma.$queryRaw`SELECT * FROM Customer WHERE id = ${id}`;
      res.json((newCustomer as any[])[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao criar cliente' });
    }
  });

  return router;
}
