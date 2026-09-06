const fs = require('fs');
let code = fs.readFileSync('server/src/runMigrations.ts', 'utf8');

const newMigrations = `
    try { await prisma.$executeRawUnsafe(\`ALTER TABLE "FiscalSettings" ADD COLUMN "cep" TEXT;\`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(\`ALTER TABLE "FiscalSettings" ADD COLUMN "logradouro" TEXT;\`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(\`ALTER TABLE "FiscalSettings" ADD COLUMN "numero" TEXT;\`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(\`ALTER TABLE "FiscalSettings" ADD COLUMN "bairro" TEXT;\`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(\`ALTER TABLE "FiscalSettings" ADD COLUMN "municipio" TEXT;\`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(\`ALTER TABLE "FiscalSettings" ADD COLUMN "uf" TEXT;\`); } catch (e) {}
`;

code = code.replace(
  "try { await prisma.$executeRawUnsafe(`ALTER TABLE \"FiscalSettings\" ADD COLUMN \"environment\" TEXT DEFAULT 'homologacao';`); } catch (e) {}",
  "try { await prisma.$executeRawUnsafe(`ALTER TABLE \"FiscalSettings\" ADD COLUMN \"environment\" TEXT DEFAULT 'homologacao';`); } catch (e) {}\n" + newMigrations
);

fs.writeFileSync('server/src/runMigrations.ts', code);
