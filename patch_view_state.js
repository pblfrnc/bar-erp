const fs = require('fs');
let code = fs.readFileSync('client/src/App.tsx', 'utf8');

code = code.replace(
  "const [view, setView] = useState<'tables' | 'kds' | 'cash' | 'products' | 'dashboard' | 'audit' | 'settings' | 'customers'>('tables');",
  "const [view, setView] = useState<'tables' | 'kds' | 'cash' | 'products' | 'dashboard' | 'audit' | 'settings' | 'customers' | 'fiscal' | 'fiscalSettings' | 'manualNfce'>('tables');"
);

fs.writeFileSync('client/src/App.tsx', code);
