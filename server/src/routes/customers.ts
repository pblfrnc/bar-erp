import { Router } from 'express';
import { prisma } from '../prisma.js';
import { encryptField, decryptField } from '../services/securityVault.js';

export function createCustomersRouter() {
  const router = Router();

  // Listar clientes (descriptografa campos confidenciais na memória com transparência)
  router.get('/', async (req, res) => {
    try {
      const customers: any[] = await prisma.$queryRaw`SELECT * FROM Customer ORDER BY name ASC`;
      const sanitized = customers.map(c => ({
        ...c,
        phone: decryptField(c.phone),
        document: decryptField(c.document),
        notes: decryptField(c.notes)
      }));
      res.json(sanitized);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao buscar clientes' });
    }
  });

  // Criar cliente (grava no banco com AES-256-GCM blindado)
  router.post('/', async (req, res) => {
    try {
      const { name, phone, document, notes } = req.body;
      const id = 'cust_' + Math.random().toString(36).substr(2, 9);
      
      const encPhone = phone ? encryptField(phone.trim()) : null;
      const encDoc = document ? encryptField(document.trim()) : null;
      const encNotes = notes ? encryptField(notes.trim()) : null;

      await prisma.$executeRawUnsafe(`
        INSERT INTO Customer (id, name, phone, document, notes, createdAt, updatedAt, creditTabBalance)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
      `, id, name.trim(), encPhone, encDoc, encNotes);
      
      const newCustomer: any[] = await prisma.$queryRaw`SELECT * FROM Customer WHERE id = ${id}`;
      const c = newCustomer[0];
      res.json({
        ...c,
        phone: decryptField(c.phone),
        document: decryptField(c.document),
        notes: decryptField(c.notes)
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao criar cliente' });
    }
  });

  return router;
}
