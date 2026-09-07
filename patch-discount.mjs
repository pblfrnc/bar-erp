import fs from 'fs';
let f = fs.readFileSync('client/src/components/CheckoutModal.tsx', 'utf-8');

f = f.replace(`                  <input
                    type="number"
                    placeholder="0.00"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}`, `                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value.replace(',', '.'))}
                    onFocus={(e) => e.target.select()}`);

fs.writeFileSync('client/src/components/CheckoutModal.tsx', f);
