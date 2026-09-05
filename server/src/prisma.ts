import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./dev.db'
    }
  }
});

// Otimizações de alta concorrência para SQLite no ambiente de Bar/Restaurante
async function configureSqlite() {
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
    await prisma.$queryRawUnsafe('PRAGMA cache_size = 10000;');
  } catch (err) {
    console.error('Aviso ao aplicar PRAGMA de alta performance no SQLite:', err);
  }
}

configureSqlite();
