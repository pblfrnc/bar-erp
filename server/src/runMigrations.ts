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

    try { await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN "paidQuantity" INTEGER NOT NULL DEFAULT 0;`); } catch (e) {}

    // Tabelas Fiscais
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "FiscalSettings" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "apiToken" TEXT,
        "cnpj" TEXT,
        "ie" TEXT,
        "crt" TEXT,
        "cscId" TEXT,
        "cscSecret" TEXT,
        "addressInfo" TEXT,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try { await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "ncm" TEXT;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "cfop" TEXT;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "code" TEXT;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "ean" TEXT;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "supplier" TEXT;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "brand" TEXT;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "cest" TEXT;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "costPrice" REAL;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "Category" ADD COLUMN "codeStart" INTEGER DEFAULT 1001;`); } catch (e) {}

    try { await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalSettings" ADD COLUMN "environment" TEXT DEFAULT 'homologacao';`); } catch (e) {}

    try { await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalSettings" ADD COLUMN "cep" TEXT;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalSettings" ADD COLUMN "logradouro" TEXT;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalSettings" ADD COLUMN "numero" TEXT;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalSettings" ADD COLUMN "bairro" TEXT;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalSettings" ADD COLUMN "municipio" TEXT;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalSettings" ADD COLUMN "uf" TEXT;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalSettings" ADD COLUMN "razaoSocial" TEXT;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalSettings" ADD COLUMN "nomeFantasia" TEXT;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalSettings" ADD COLUMN "serieNfce" TEXT DEFAULT '1';`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalSettings" ADD COLUMN "proximoNumeroNfce" INTEGER DEFAULT 1;`); } catch (e) {}

    // Tabela de Notas Recebidas (Bip de Chave de Acesso)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "NotaRecebida" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "chave" TEXT NOT NULL UNIQUE,
        "emitente" TEXT,
        "cnpjEmitente" TEXT,
        "numero" TEXT,
        "serie" TEXT,
        "dataEmissao" TEXT,
        "valorTotal" REAL,
        "status" TEXT NOT NULL DEFAULT 'recebida',
        "xmlContent" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de Fornecedores (Módulo de Fornecedores)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Supplier" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "tradeName" TEXT,
        "document" TEXT,
        "ie" TEXT,
        "phone" TEXT,
        "email" TEXT,
        "city" TEXT,
        "state" TEXT,
        "address" TEXT,
        "contactName" TEXT,
        "notes" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    try {
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_document_key" ON "Supplier"("document")`);
    } catch (e) {}
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "supplierId" TEXT REFERENCES "Supplier"("id")`);
    } catch (e) {}

    console.log('[Migrations] Banco de dados atualizado/verificado com sucesso.');

  } catch (error) {
    console.error('[Migrations] Erro crítico ao rodar migrações em tempo de execução:', error);
  }
}
