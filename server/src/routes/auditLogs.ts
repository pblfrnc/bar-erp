import { Router } from 'express';
import { prisma } from '../prisma.js';

export function createAuditLogsRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const logs = await prisma.$queryRaw`SELECT * FROM AuditLog ORDER BY createdAt DESC LIMIT 100`;
      res.json(logs);
    } catch (error) {
      console.error('Erro ao listar audit logs:', error);
      res.status(500).json({ error: 'Erro ao buscar logs de auditoria' });
    }
  });

  return router;
}
