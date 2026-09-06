const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const item = await prisma.orderItem.findFirst();
  if(!item) { console.log("No items"); return; }
  console.log("Item before:", item);
  try {
    await prisma.$executeRawUnsafe(`UPDATE "OrderItem" SET "paidQuantity" = "paidQuantity" + ? WHERE id = ?`, 2, item.id);
    const updated = await prisma.orderItem.findFirst({ where: { id: item.id }});
    console.log("Item after:", updated);
  } catch(e) { console.error("ERR:", e.message); }
}
main();
