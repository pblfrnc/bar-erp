const fs = require('fs');
let code = fs.readFileSync('client/src/App.tsx', 'utf8');

code = code.replace(
  "import { SettingsView } from './views/SettingsView';",
  "import { SettingsView } from './views/SettingsView';\nimport { FiscalImportView } from './views/FiscalImportView';"
);

code = code.replace(
  "useState<'tables' | 'kds' | 'cash' | 'products' | 'dashboard' | 'audit' | 'settings' | 'customers'>",
  "useState<'tables' | 'kds' | 'cash' | 'products' | 'dashboard' | 'audit' | 'settings' | 'customers' | 'fiscal'>"
);

const fiscalRender = `
        {currentView === 'fiscal' && (
          <FiscalImportView onBack={() => setCurrentView('settings')} />
        )}
`;
code = code.replace("{currentView === 'settings' && (", fiscalRender + "\n        {currentView === 'settings' && (");

code = code.replace(
  "onOpenCustomers={() => setCurrentView('customers')}",
  "onOpenCustomers={() => setCurrentView('customers')}\n            onOpenFiscal={() => setCurrentView('fiscal')}"
);

fs.writeFileSync('client/src/App.tsx', code);
