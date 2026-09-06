const fs = require('fs');
let code = fs.readFileSync('client/src/components/Navbar.tsx', 'utf8');

code = code.replace(
  "currentView: 'tables' | 'kds' | 'cash' | 'products' | 'dashboard' | 'audit' | 'settings' | 'customers';",
  "currentView: 'tables' | 'kds' | 'cash' | 'products' | 'dashboard' | 'audit' | 'settings' | 'customers' | 'fiscal' | 'fiscalSettings' | 'manualNfce';"
);
code = code.replace(
  "onSelectView: (view: 'tables' | 'kds' | 'cash' | 'products' | 'dashboard' | 'audit' | 'settings' | 'customers') => void;",
  "onSelectView: (view: 'tables' | 'kds' | 'cash' | 'products' | 'dashboard' | 'audit' | 'settings' | 'customers' | 'fiscal' | 'fiscalSettings' | 'manualNfce') => void;"
);

fs.writeFileSync('client/src/components/Navbar.tsx', code);
