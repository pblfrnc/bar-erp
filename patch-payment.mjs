import fs from 'fs';
let f = fs.readFileSync('server/src/routes/fiscal.ts', 'utf-8');

// Update destructuring
f = f.replace("const { items, customerCpf } = req.body;", "const { items, customerCpf, paymentMethod } = req.body;");

// Update payload
const oldPaymentStr = `
        formas_pagamento: [
          {
            forma_pagamento: '01', // 01 = Dinheiro (padrão genérico pra simplificar)
            valor_pagamento: String(items.reduce((acc: number, i: any) => acc + (i.price * i.quantity), 0).toFixed(2))
          }
        ]
`;

const newPaymentStr = `
        formas_pagamento: [
          {
            forma_pagamento: (() => {
               // De -> Para Sefaz
               const pm = (paymentMethod || '').toUpperCase();
               if (pm === 'PIX') return '17';
               if (pm === 'CREDITO' || pm === 'CARTÃO DE CRÉDITO') return '03';
               if (pm === 'DEBITO' || pm === 'CARTÃO DE DÉBITO') return '04';
               return '01'; // Default: Dinheiro
            })(),
            valor_pagamento: String(items.reduce((acc: number, i: any) => acc + (i.price * i.quantity), 0).toFixed(2))
          }
        ]
`;

f = f.replace(oldPaymentStr.trim(), newPaymentStr.trim());

fs.writeFileSync('server/src/routes/fiscal.ts', f);
