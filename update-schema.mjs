import fs from 'fs';
let schema = fs.readFileSync('server/prisma/schema.prisma', 'utf-8');

if (!schema.includes('model NotaRecebida')) {
  schema += `\nmodel NotaRecebida {
  id           String   @id
  chave        String   @unique
  emitente     String?
  cnpjEmitente String?
  numero       String?
  serie        String?
  dataEmissao  String?
  valorTotal   Float?
  status       String   @default("recebida")
  xmlContent   String?
  createdAt    DateTime @default(now())
}\n`;
}

if (!schema.includes('model NotaEmitida')) {
  schema += `\nmodel NotaEmitida {
  id           String   @id @default(cuid())
  referencia   String   @unique
  chave        String?
  numero       String?
  serie        String?
  dataEmissao  String?
  valorTotal   Float?
  status       String   @default("autorizado")
  xmlUrl       String?
  pdfUrl       String?
  createdAt    DateTime @default(now())
}\n`;
}

fs.writeFileSync('server/prisma/schema.prisma', schema);
