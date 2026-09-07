import fs from 'fs';
let f = fs.readFileSync('client/src/components/CheckoutModal.tsx', 'utf-8');

// Fix payAmount input
f = f.replace(`                <input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}`, `                <input
                  type="text"
                  inputMode="decimal"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value.replace(',', '.'))}
                  onFocus={(e) => e.target.select()}`);

// Fix cashTendered input
f = f.replace(`                <input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 100.00"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}`, `                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 100,00"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value.replace(',', '.'))}
                  onFocus={(e) => e.target.select()}`);

// Fix discountValue input (assuming it exists based on state)
f = f.replace(`                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}`, `                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value.replace(',', '.'))}
                  onFocus={(e) => e.target.select()}`);

fs.writeFileSync('client/src/components/CheckoutModal.tsx', f);
