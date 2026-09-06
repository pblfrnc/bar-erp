const fs = require('fs');
let code = fs.readFileSync('server/src/runMigrations.ts', 'utf8');

const newMigrations = `
    // Tabelas Fiscais
    await prisma.$executeRawUnsafe(\`
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
    \`);

    try { await prisma.$executeRawUnsafe(\`ALTER TABLE "Product" ADD COLUMN "ncm" TEXT;\`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(\`ALTER TABLE "Product" ADD COLUMN "cfop" TEXT;\`); } catch (e) {}
`;

code = code.replace("try { await prisma.$executeRawUnsafe(`ALTER TABLE \"OrderItem\" ADD COLUMN \"paidQuantity\" INTEGER NOT NULL DEFAULT 0;`); } catch (e) {}", 
  "try { await prisma.$executeRawUnsafe(`ALTER TABLE \"OrderItem\" ADD COLUMN \"paidQuantity\" INTEGER NOT NULL DEFAULT 0;`); } catch (e) {}\n" + newMigrations);

fs.writeFileSync('server/src/runMigrations.ts', code);
