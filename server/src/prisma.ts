import { createRequire } from 'node:module';
import type { PrismaClient as PrismaClientType } from '@prisma/client';

const require = createRequire(import.meta.url);
const prismaModule = require('@prisma/client');
const PrismaClientConstructor = (prismaModule.PrismaClient || prismaModule.default?.PrismaClient || prismaModule) as typeof PrismaClientType;

export const prisma = new PrismaClientConstructor({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./dev.db'
    }
  }
});

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
