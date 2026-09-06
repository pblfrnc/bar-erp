sed -i '' -e 's/await prisma.payment.create({/try { await prisma.payment.create({/g' server/src/routes/orders.ts
sed -i '' -e '/cashShiftId: activeShift ? activeShift.id : null/a\
          }\
        });\
        } catch (e: any) { throw new Error("Erro FK no Payment: " + e.message); }\
' server/src/routes/orders.ts

sed -i '' -e 's/await prisma.$executeRawUnsafe(`UPDATE "Customer"/try { await prisma.$executeRawUnsafe(`UPDATE "Customer"/g' server/src/routes/orders.ts
sed -i '' -e 's/amt, customerId);/amt, customerId); } catch (e: any) { throw new Error("Erro FK no Customer: " + e.message); }/g' server/src/routes/orders.ts

sed -i '' -e 's/await prisma.$executeRawUnsafe(`UPDATE "Order" SET customerId/try { await prisma.$executeRawUnsafe(`UPDATE "Order" SET customerId/g' server/src/routes/orders.ts
sed -i '' -e 's/customerId, order.id);/customerId, order.id); } catch (e: any) { throw new Error("Erro FK no Order Raw: " + e.message); }/g' server/src/routes/orders.ts

sed -i '' -e 's/const updatedOrder = await prisma.order.update({/try { const updatedOrder = await prisma.order.update({/g' server/src/routes/orders.ts
sed -i '' -e '/payments: true/a\
        }\
      });\
' server/src/routes/orders.ts
