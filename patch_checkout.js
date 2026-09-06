const fs = require('fs');
const path = 'client/src/components/CheckoutModal.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Injetar unpaidItems
code = code.replace(
  "  // Lógica de \"Racha Conta por Itens\"",
  `  // Itens que ainda não foram totalmente pagos
  const unpaidItems = React.useMemo(() => {
    return order.items.map(item => ({
      ...item,
      unpaidQty: item.quantity - (item.paidQuantity || 0)
    })).filter(i => i.unpaidQty > 0);
  }, [order.items]);

  // Lógica de \"Racha Conta por Itens\"`
);

// 2. Modificar Math.min(item.quantity) -> Math.min(unpaidQty)
code = code.replace(
  "const handleToggleItemQty = (item: OrderItem, delta: number) => {",
  `const handleToggleItemQty = (item: OrderItem & { unpaidQty?: number }, delta: number) => {`
);

code = code.replace(
  "const next = Math.max(0, Math.min(item.quantity, current + delta));",
  "const maxAllowed = item.unpaidQty !== undefined ? item.unpaidQty : item.quantity;\n      const next = Math.max(0, Math.min(maxAllowed, current + delta));"
);

// 3. Atualizar renderização da lista para usar unpaidItems e mostrar unpaidQty
code = code.replace(
  "{order.items.map(item => {",
  "{unpaidItems.map(item => {"
);
code = code.replace(
  "{item.quantity}x R$ {item.unitPrice.toFixed(2)}",
  "{item.unpaidQty}x R$ {item.unitPrice.toFixed(2)}"
);

// 4. Enviar paidItems no api.payOrder
code = code.replace(
  "customerId: finalCustomerId || undefined",
  "customerId: finalCustomerId || undefined,\n        paidItems: splitMode === 'items' ? Object.entries(selectedItems).filter(([_, q]) => q > 0).map(([id, q]) => ({ itemId: id, quantity: q })) : undefined"
);

// 5. Ajustar subtotal para usar apenas os itens não pagos caso estejam dividindo por itens
// Wait, actually the subtotal is the TOTAL ORDER subtotal. The user might want to see the remaining balance!
// I will not touch the main subtotal display, it's fine.

fs.writeFileSync(path, code);
console.log("Patched CheckoutModal.tsx");
