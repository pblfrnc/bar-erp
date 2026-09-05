import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// Otimizações de alta concorrência para SQLite no ambiente de Bar/Restaurante
async function configureSqlite() {
  try {
    await prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$executeRawUnsafe('PRAGMA synchronous = NORMAL;');
    await prisma.$executeRawUnsafe('PRAGMA busy_timeout = 5000;');
    await prisma.$executeRawUnsafe('PRAGMA cache_size = 10000;');
  } catch (err) {
    console.error('Aviso ao aplicar PRAGMA de alta performance no SQLite:', err);
  }
}

configureSqlite();
