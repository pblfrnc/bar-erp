import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./dev.db'
    }
  }
});

// Otimizações de alta concorrência e auto-migração de colunas para SQLite
async function configureSqlite() {
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
    await prisma.$queryRawUnsafe('PRAGMA cache_size = 10000;');

    // Auto-migração resiliente para bases existentes no Windows (%APPDATA%/bar.db)
    // Se o usuário atualizar o app sem recriar o banco, essas colunas são injetadas automaticamente:
    const productCols: any[] = await prisma.$queryRawUnsafe('PRAGMA table_info(Product);');
    const colNames = productCols.map((c: any) => c.name);

    if (!colNames.includes('hasBoxPrice')) {
      await prisma.$queryRawUnsafe('ALTER TABLE "Product" ADD COLUMN "hasBoxPrice" BOOLEAN NOT NULL DEFAULT false;');
      console.log('✅ [Auto-Migrate] Coluna hasBoxPrice adicionada à tabela Product.');
    }
    if (!colNames.includes('boxQuantity')) {
      await prisma.$queryRawUnsafe('ALTER TABLE "Product" ADD COLUMN "boxQuantity" INTEGER DEFAULT 24;');
      console.log('✅ [Auto-Migrate] Coluna boxQuantity adicionada à tabela Product.');
    }
    if (!colNames.includes('boxPrice')) {
      await prisma.$queryRawUnsafe('ALTER TABLE "Product" ADD COLUMN "boxPrice" REAL;');
      console.log('✅ [Auto-Migrate] Coluna boxPrice adicionada à tabela Product.');
    }
    if (!colNames.includes('boxEan')) {
      await prisma.$queryRawUnsafe('ALTER TABLE "Product" ADD COLUMN "boxEan" TEXT;');
      console.log('✅ [Auto-Migrate] Coluna boxEan adicionada à tabela Product.');
    }

    // OrderItem: unitType
    const orderItemCols: any[] = await prisma.$queryRawUnsafe('PRAGMA table_info(OrderItem);');
    const orderItemColNames = orderItemCols.map((c: any) => c.name);
    if (!orderItemColNames.includes('unitType')) {
      await prisma.$queryRawUnsafe('ALTER TABLE "OrderItem" ADD COLUMN "unitType" TEXT DEFAULT "UNIT";');
      console.log('✅ [Auto-Migrate] Coluna unitType adicionada à tabela OrderItem.');
    }
  } catch (err) {
    console.error('Aviso ao inicializar SQLite / Auto-Migração:', err);
  }
}

configureSqlite();
