sed -i '' -e '/const activeShift = await prisma.cashShift.findFirst({/,/});/c\
      const activeShift = await prisma.cashShift.findFirst({\
        where: { status: '"'"'OPEN'"'"' },\
        orderBy: { openedAt: '"'"'desc'"'"' }\
      });\
\
      if (!activeShift) {\
        return res.status(403).json({ error: '"'"'O Caixa (PDV) está fechado! Abra o turno do caixa antes de fechar pedidos ou receber pagamentos.'"'"' });\
      }\
' server/src/routes/orders.ts
