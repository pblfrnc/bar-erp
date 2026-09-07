import fs from 'fs';
let m = fs.readFileSync('server/src/runMigrations.ts', 'utf-8');

const tableStr = `    await prisma.$executeRawUnsafe(\`
      CREATE TABLE IF NOT EXISTS "NotaEmitida" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "referencia" TEXT NOT NULL UNIQUE,
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
    \`);`;

if (!m.includes('NotaEmitida')) {
  m = m.replace('console.log("Migrações concluídas com sucesso.");', tableStr + '\n\n    console.log("Migrações concluídas com sucesso.");');
  fs.writeFileSync('server/src/runMigrations.ts', m);
}
