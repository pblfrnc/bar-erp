const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try { 
    await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN "paidQuantity" INTEGER NOT NULL DEFAULT 0;`); 
    console.log("Migration SUCCESS");
  } catch(e) {
    console.log("Migration FAILED:", e.message);
  }
}
main();
