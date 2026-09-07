import fs from 'fs';
let f = fs.readFileSync('server/src/routes/fiscal.ts', 'utf-8');

const dynamicTax = `
          // CRT: 1 = Simples Nacional, 3 = Regime Normal
          icms_situacao_tributaria: (settings.crt === '3') 
            ? (i.cfop === '5405' ? '60' : '00')  // Regime Normal: 60 = ST, 00 = Tributada Integralmente
            : (i.cfop === '5405' ? '500' : '102'), // Simples Nacional: 500 = ST, 102 = Tributada
`;

if (f.includes("icms_situacao_tributaria: (i.cfop === '5405') ? '500' : '102',")) {
  f = f.replace("icms_situacao_tributaria: (i.cfop === '5405') ? '500' : '102', // 500 = ICMS cobrado ant por ST. 102 = Simples Nacional sem permissão de crédito", dynamicTax.trim());
  fs.writeFileSync('server/src/routes/fiscal.ts', f);
}
