import { PrismaClient } from '@prisma/client';

export async function runRuntimeMigrations(prisma: PrismaClient) {
  try {
    console.log('[Migrations] Verificando schema do banco de dados...');
    
    // Tentar criar a tabela AuditLog se não existir (da task anterior)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AuditLog" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "action" TEXT NOT NULL,
        "details" TEXT,
        "userName" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tentar criar a tabela Customer se não existir
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Customer" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "phone" TEXT,
        "document" TEXT,
        "notes" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "creditTabBalance" REAL NOT NULL DEFAULT 0
      )
    `);

    // Adicionar a coluna customerId na tabela Order se ela não existir
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Order" ADD COLUMN "customerId" TEXT REFERENCES "Customer"("id")
      `);
      console.log('[Migrations] Coluna customerId adicionada com sucesso.');
    } catch (e: any) {
      // Ignorar erro se a coluna já existir ("duplicate column name")
      if (!e.message.includes('duplicate column name')) {
        console.error('[Migrations] Erro ao adicionar customerId:', e.message);
      }
    }

    console.log('[Migrations] Banco de dados atualizado/verificado com sucesso.');
  } catch (error) {
    console.error('[Migrations] Erro crítico ao rodar migrações em tempo de execução:', error);
  }
}
