const fs = require('fs');
let code = fs.readFileSync('server/src/routes/fiscal.ts', 'utf8');

code = code.replace(/prisma\.fiscalSettings/g, "(prisma as any).fiscalSettings");

fs.writeFileSync('server/src/routes/fiscal.ts', code);
