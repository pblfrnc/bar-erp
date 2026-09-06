const fs = require('fs');
let code = fs.readFileSync('server/src/routes/orders.ts', 'utf8');
code = code.replace(
  `        // Atualizar paidQuantity dos itens (Racha por Itens)
        if (paidItems && Array.isArray(paidItems)) {
          for (const pi of paidItems) {
            if (pi.itemId && pi.quantity > 0) {
              try {
                await prisma.$executeRawUnsafe(\`UPDATE "OrderItem" SET paidQuantity = paidQuantity + ? WHERE id = ?\`, pi.quantity, pi.itemId);
              } catch(e) { console.error("Erro paidQuantity:", e); }
            }
          }
        }`,
  ""
);

code = code.replace(
  "addedPaidAmount += amt;\n      }",
  `addedPaidAmount += amt;\n      }\n\n      // Atualizar paidQuantity dos itens (Racha por Itens)\n      if (paidItems && Array.isArray(paidItems)) {\n        for (const pi of paidItems) {\n          if (pi.itemId && pi.quantity > 0) {\n            try {\n              await prisma.$executeRawUnsafe(\`UPDATE "OrderItem" SET paidQuantity = paidQuantity + ? WHERE id = ?\`, pi.quantity, pi.itemId);\n            } catch(e) { console.error("Erro paidQuantity:", e); }\n          }\n        }\n      }`
);

fs.writeFileSync('server/src/routes/orders.ts', code);
