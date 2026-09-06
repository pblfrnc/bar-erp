sed -i '' -e 's/const { payments, closeOrder } = req.body;/const { payments, closeOrder, customerId } = req.body;/g' server/src/routes/orders.ts
sed -i '' -e '/closedAt: shouldClose ? new Date() : null/i\
          ...(customerId ? { customerId } : {}),\
' server/src/routes/orders.ts
sed -i '' -e '/addedPaidAmount += amt;/i\
\
        // Atualizar saldo do fiado (usando query raw)\
        if (p.method === '"'CREDIT_TAB'"' && customerId) {\
          await prisma.$executeRawUnsafe(`UPDATE Customer SET creditTabBalance = creditTabBalance + ? WHERE id = ?`, amt, customerId);\
        }\
' server/src/routes/orders.ts
