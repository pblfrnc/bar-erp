const fs = require('fs');
let code = fs.readFileSync('client/src/App.tsx', 'utf8');

code = code.replace(
  "import { FiscalImportView } from './views/FiscalImportView';",
  "import { FiscalImportView } from './views/FiscalImportView';\nimport { FiscalSettingsView } from './views/FiscalSettingsView';\nimport { ManualNfceView } from './views/ManualNfceView';"
);

code = code.replace(
  "'audit' | 'settings' | 'customers' | 'fiscal'>('tables')",
  "'audit' | 'settings' | 'customers' | 'fiscal' | 'fiscalSettings' | 'manualNfce'>('tables')"
);

const nfceRender = `
        {currentView === 'fiscalSettings' && (
          <FiscalSettingsView onBack={() => setCurrentView('settings')} />
        )}
        {currentView === 'manualNfce' && (
          <ManualNfceView onBack={() => setCurrentView('settings')} />
        )}
`;
code = code.replace("{currentView === 'fiscal' && (", nfceRender + "\n        {currentView === 'fiscal' && (");

code = code.replace(
  "onOpenFiscal={() => setCurrentView('fiscal')}",
  "onOpenFiscal={() => setCurrentView('fiscal')}\n            onOpenFiscalSettings={() => setCurrentView('fiscalSettings')}\n            onOpenManualNfce={() => setCurrentView('manualNfce')}"
);

fs.writeFileSync('client/src/App.tsx', code);
