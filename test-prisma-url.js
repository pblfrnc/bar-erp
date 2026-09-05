const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

async function main() {
  // Mock path with spaces and backslashes
  const dbPath = path.join(process.cwd(), 'test folder', 'test.db').replace(/\//g, '\\');
  fs.mkdirSync(path.join(process.cwd(), 'test folder'), { recursive: true });
  fs.copyFileSync('server/prisma/dev.db', dbPath);
  
  const url1 = `file:${dbPath}`;
  console.log('Testing URL:', url1);
  process.env.DATABASE_URL = url1;
  
  const prisma1 = new PrismaClient();
  try {
    const res = await prisma1.products.findMany({ take: 1 });
    console.log('Success with url1');
  } catch(e) {
    console.error('Failed with url1:', e.message);
  } finally {
    await prisma1.$disconnect();
  }
}
main();
