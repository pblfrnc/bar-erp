const fs = require('fs');
let code = fs.readFileSync('client/src/App.tsx', 'utf8');

code = code.replace(
  "type ViewState = 'tables' | 'kds' | 'cash' | 'products' | 'dashboard' | 'audit' | 'settings' | 'customers';",
  "type ViewState = 'tables' | 'kds' | 'cash' | 'products' | 'dashboard' | 'audit' | 'settings' | 'customers' | 'fiscal' | 'fiscalSettings' | 'manualNfce';"
);

fs.writeFileSync('client/src/App.tsx', code);
