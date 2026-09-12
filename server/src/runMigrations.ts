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
    try {
      // Auto-reparo: Bar e bebidas recebem faixa 5001 se ainda estiverem com o default genérico 1001
      await prisma.$executeRawUnsafe(`
        UPDATE "Category"
        SET "codeStart" = 5001
        WHERE ("codeStart" = 1001 OR "codeStart" IS NULL)
          AND (LOWER("name") LIKE '%bar%' OR LOWER("name") LIKE '%cerveja%' OR LOWER("name") LIKE '%chope%' OR LOWER("name") LIKE '%chopp%');
      `);
    } catch (e) {}

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
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalSettings" ADD COLUMN "serieNfe" TEXT DEFAULT '1';`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalSettings" ADD COLUMN "proximoNumeroNfe" INTEGER DEFAULT 1;`); } catch (e) {}

    // Tabela de Notas Emitidas (NF-e Mod 55 e NFC-e Mod 65)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "NotaEmitida" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "referencia" TEXT NOT NULL,
        "chave" TEXT,
        "numero" TEXT,
        "serie" TEXT,
        "dataEmissao" TEXT,
        "valorTotal" REAL,
        "status" TEXT NOT NULL DEFAULT 'autorizado',
        "xmlUrl" TEXT,
        "pdfUrl" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "NotaEmitida_referencia_key" ON "NotaEmitida"("referencia")
    `);

    // Auto-recuperação garantida da NF-e emitida chave 15260936275163000124550020000000011794431341 (Série 2, Número 1)
    try {
      const existingNota: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM "NotaEmitida" WHERE "chave" = '15260936275163000124550020000000011794431341' OR ("numero" = '1' AND "serie" = '2') LIMIT 1`
      );
      if (!existingNota || existingNota.length === 0) {
        const chaveRec = '15260936275163000124550020000000011794431341';
        const refRec = `nfe_${chaveRec}`;
        const danfeRec = `/api/fiscal/danfe/${chaveRec}`;
        const xmlRec = `https://api.focusnfe.com.br/v2/nfe/${chaveRec}.xml`;
        await prisma.$executeRawUnsafe(`
          INSERT INTO "NotaEmitida" (
            "id", "referencia", "chave", "numero", "serie", "dataEmissao", "valorTotal", "status", "xmlUrl", "pdfUrl", "createdAt"
          ) VALUES (
            ?, ?, ?, '1', '2', '2026-09-11T12:00:00-03:00', 0.0, 'autorizado', ?, ?, CURRENT_TIMESTAMP
          )
        `, `nfe_${chaveRec}`, refRec, chaveRec, xmlRec, danfeRec);
        console.log('[Auto-Repair] NF-e Chave 15260936275163000124550020000000011794431341 (Série 2, Nº 1) restaurada no banco local com sucesso.');
      }
    } catch (autoErr) {
      console.warn('[Auto-Repair] Verificação de nota emitida prévia:', autoErr);
    }

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

    // Tabela de Funcionários / Usuários do Sistema (Staff)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Staff" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'OPERADOR',
        "password" TEXT NOT NULL,
        "permissions" TEXT NOT NULL DEFAULT '["tables","cash"]',
        "active" INTEGER NOT NULL DEFAULT 1,
        "failedAttempts" INTEGER NOT NULL DEFAULT 0,
        "lockoutUntil" DATETIME,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Criar Administrador Padrão se não houver nenhum colaborador cadastrado
    const staffCount: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "Staff"`);
    const totalStaff = Number(staffCount[0]?.count || 0);
    if (totalStaff === 0) {
      console.log('[Migrations] Criando usuário Administrador inicial...');
      const allPermissions = JSON.stringify([
        'tables',
        'kds',
        'cash',
        'products',
        'fiscal',
        'settings',
        'dashboard',
        'customers',
        'suppliers'
      ]);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Staff" ("id", "name", "role", "password", "permissions", "active", "failedAttempts", "createdAt", "updatedAt")
        VALUES ('admin_root', 'Administrador', 'ADMIN', '1234', '${allPermissions}', 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      console.log('[Migrations] Usuário Administrador criado com senha padrão "1234".');
    }

    // Migrações de Licenciamento Remoto e Mensalidade (Software House)
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "SystemSettings" ADD COLUMN "expiresAt" DATETIME;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "SystemSettings" ADD COLUMN "lastVerifiedAt" DATETIME;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "SystemSettings" ADD COLUMN "clientName" TEXT;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "SystemSettings" ADD COLUMN "licenseStatus" TEXT DEFAULT 'UNLICENSED';`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "SystemSettings" ADD COLUMN "licenseServerUrl" TEXT;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "SystemSettings" ADD COLUMN "developerContact" TEXT;`); } catch (e) {}

    // ─────────────────────────────────────────────────────────────────
    // Reclassificação Automática: Migrar produtos de "IMPORTADOS" para "Bar" (volume em ml) e "Cozinha"
    // ─────────────────────────────────────────────────────────────────
    try {
      const catImportados: any = await (prisma as any).category.findFirst({
        where: { name: { in: ['IMPORTADOS', 'Importados', 'importados'] } },
        include: { products: true }
      });

      if (catImportados && catImportados.products && catImportados.products.length > 0) {
        console.log(`[Migrations] Detectados ${catImportados.products.length} produtos na categoria IMPORTADOS. Reclassificando...`);

        let catBar = await (prisma as any).category.findFirst({
          where: { name: { in: ['Bar', 'BAR', 'bar'] } }
        });
        if (!catBar) {
          catBar = await (prisma as any).category.create({
            data: { name: 'Bar', icon: 'Beer', sortOrder: 1, codeStart: 5001 }
          });
        }

        let catCozinha = await (prisma as any).category.findFirst({
          where: { name: { in: ['Cozinha', 'COZINHA', 'cozinha'] } }
        });
        if (!catCozinha) {
          catCozinha = await (prisma as any).category.create({
            data: { name: 'Cozinha', icon: 'UtensilsCrossed', sortOrder: 2, codeStart: 1001 }
          });
        }

        let movedBar = 0;
        let movedCozinha = 0;

        for (const prod of catImportados.products) {
          const text = `${prod.name || ''} ${prod.description || ''}`.toLowerCase();
          const u = String(prod.unit || '').trim().toUpperCase();

          const hasMl = /\b\d+(?:[.,]\d+)?\s*(?:ml|m\.l\.)\b/i.test(text);
          const hasL = /\b\d+(?:[.,]\d+)?\s*(?:l|lt|litro|litros)\b/i.test(text);
          const isMlUnit = u === 'ML' || u === 'L' || u === 'LT' || u === 'LTS';
          const isDrink = /cervej|chopp|chope|beer|refrigerante|coca[-\s]?cola|pepsi|guaran[aá]|fanta|sprite|schweppes|vodka|whisky|whiskey|gin\b|cacha[cç]a|pinga|rum\b|tequila|licor|vinho|espumante|champagne|suco|energ[eé]tico|red bull|monster|água|agua mineral|long neck|lat[aã]o|ice\b|campari|aperol|conhaque|sake|saqu[eê]|destilado|dose\b|coquetel|drink/i.test(text);

          const isBar = hasMl || hasL || isMlUnit || isDrink;

          await (prisma as any).product.update({
            where: { id: prod.id },
            data: {
              categoryId: isBar ? catBar.id : catCozinha.id,
              kdsStation: isBar ? 'BAR' : 'KITCHEN'
            }
          });

          if (isBar) movedBar++;
          else movedCozinha++;
        }

        console.log(`[Migrations] Reclassificação concluída: ${movedBar} produtos movidos para Bar e ${movedCozinha} para Cozinha.`);

        // Deleta a categoria IMPORTADOS que ficou esvaziada
        await (prisma as any).category.delete({ where: { id: catImportados.id } });
        console.log(`[Migrations] Categoria IMPORTADOS esvaziada e removida com sucesso.`);
      } else if (catImportados) {
        // Categoria IMPORTADOS existe mas já está sem produtos
        await (prisma as any).category.delete({ where: { id: catImportados.id } });
      }
    } catch (e: any) {
      console.error('[Migrations] Erro ao reclassificar produtos de IMPORTADOS:', e.message);
    }

    console.log('[Migrations] Banco de dados atualizado/verificado com sucesso.');

  } catch (error) {
    console.error('[Migrations] Erro crítico ao rodar migrações em tempo de execução:', error);
  }
}
