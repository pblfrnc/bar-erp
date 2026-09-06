sed -i '' -e 's/await prisma.$executeRawUnsafe(`UPDATE "Order" SET customerId/try { await prisma.$executeRawUnsafe(`UPDATE "Order" SET customerId/g' server/src/routes/orders.ts
sed -i '' -e 's/customerId, order.id);/customerId, order.id); } catch(e:any) { console.error("FK error Order:", e.message); }/g' server/src/routes/orders.ts

sed -i '' -e 's/await prisma.$executeRawUnsafe(`UPDATE "Customer" SET creditTabBalance/try { await prisma.$executeRawUnsafe(`UPDATE "Customer" SET creditTabBalance/g' server/src/routes/orders.ts
sed -i '' -e 's/amt, customerId);/amt, customerId); } catch(e:any) { console.error("FK error Customer:", e.message); }/g' server/src/routes/orders.ts
