const fs = require('fs');
let code = fs.readFileSync('server/src/runMigrations.ts', 'utf8');

const newMigration = `
    try { await prisma.$executeRawUnsafe(\`ALTER TABLE "FiscalSettings" ADD COLUMN "environment" TEXT DEFAULT 'homologacao';\`); } catch (e) {}
`;

code = code.replace(
  "try { await prisma.$executeRawUnsafe(`ALTER TABLE \"Product\" ADD COLUMN \"cfop\" TEXT;`); } catch (e) {}",
  "try { await prisma.$executeRawUnsafe(`ALTER TABLE \"Product\" ADD COLUMN \"cfop\" TEXT;`); } catch (e) {}\n" + newMigration
);

fs.writeFileSync('server/src/runMigrations.ts', code);
