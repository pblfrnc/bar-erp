sed -i '' -e '/\.\.\.(customerId ? { customerId } : {}),/d' server/src/routes/orders.ts
sed -i '' -e '/const updatedOrder = await prisma.order.update({/i\
      if (customerId) {\
        await prisma.$executeRawUnsafe(`UPDATE "Order" SET customerId = ? WHERE id = ?`, customerId, order.id);\
      }\
' server/src/routes/orders.ts
