const fs = require('fs');
let code = fs.readFileSync('client/src/App.tsx', 'utf8');

code = code.replace(
  "import { FiscalImportView } from './views/FiscalImportView';",
  "import { FiscalHubView } from './views/FiscalHubView';"
);

code = code.replace(
  /\{currentView === 'audit' && \([\s\S]*?<AuditView \/>[\s\S]*?\)\}/,
  ""
);

code = code.replace(
  /\{currentView === 'fiscalSettings' && \([\s\S]*?<FiscalSettingsView onBack=\{\(\) => setCurrentView\('settings'\)\} \/>[\s\S]*?\)\}/,
  ""
);

code = code.replace(
  /\{currentView === 'manualNfce' && \([\s\S]*?<ManualNfceView onBack=\{\(\) => setCurrentView\('settings'\)\} \/>[\s\S]*?\)\}/,
  ""
);

code = code.replace(
  /\{currentView === 'fiscal' && \([\s\S]*?<FiscalImportView onBack=\{\(\) => setCurrentView\('settings'\)\} \/>[\s\S]*?\)\}/,
  "{currentView === 'fiscal' && (\n          <FiscalHubView />\n        )}"
);

fs.writeFileSync('client/src/App.tsx', code);
