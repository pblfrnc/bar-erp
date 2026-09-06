#!/bin/bash

# 1. Atualizar schema.prisma
sed -i '' -e '/kdsStatus/i\
  paidQuantity Int      @default(0)\
' server/prisma/schema.prisma

# 2. Adicionar Migration Runtime
sed -i '' -e '/ALTER TABLE "Order" ADD COLUMN "waiterId"/i\
  try { await prisma.$executeRawUnsafe(`ALTER TABLE "OrderItem" ADD COLUMN "paidQuantity" INTEGER NOT NULL DEFAULT 0;`); } catch(e) {}\
' server/src/runMigrations.ts

# 3. Atualizar Frontend Types
sed -i '' -e '/quantity: number;/a\
  paidQuantity?: number;\
' client/src/types/index.ts

# 4. Atualizar Backend PayOrder route
sed -i '' -e 's/const { payments, closeOrder, customerId } = req.body;/const { payments, closeOrder, customerId, paidItems } = req.body;/g' server/src/routes/orders.ts
sed -i '' -e '/addedPaidAmount += amt;/a\
\
        // Atualizar paidQuantity dos itens (Racha por Itens)\
        if (paidItems && Array.isArray(paidItems)) {\
          for (const pi of paidItems) {\
            if (pi.itemId && pi.quantity > 0) {\
              try {\
                await prisma.$executeRawUnsafe(`UPDATE "OrderItem" SET paidQuantity = paidQuantity + ? WHERE id = ?`, pi.quantity, pi.itemId);\
              } catch(e) { console.error("Erro paidQuantity:", e); }\
            }\
          }\
        }\
' server/src/routes/orders.ts

