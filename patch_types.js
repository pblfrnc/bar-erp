const fs = require('fs');
let code = fs.readFileSync('client/src/types.ts', 'utf8');

code = code.replace(
  "categoryId: string;",
  "categoryId: string;\n  ncm?: string;\n  cfop?: string;"
);

fs.writeFileSync('client/src/types.ts', code);
