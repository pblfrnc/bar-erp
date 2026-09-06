const fs = require('fs');
let code = fs.readFileSync('client/src/views/SettingsView.tsx', 'utf8');

// We will add FiscalSettingsView inside it
code = code.replace(
  "import {",
  "import { FiscalSettingsView } from './FiscalSettingsView';\nimport {"
);

code = code.replace(
  "const [activeTab, setActiveTab] = useState<'geral' | 'backup' | 'garcons'>('geral');",
  "const [activeTab, setActiveTab] = useState<'geral' | 'backup' | 'garcons' | 'fiscal'>('geral');"
);

// Add the tab button
code = code.replace(
  "</button>\n          <button",
  "</button>\n          <button\n            onClick={() => setActiveTab('fiscal')}\n            className={`px-4 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'fiscal' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-400 hover:text-white'}`}\n          >\n            Fiscal (NFC-e)\n          </button>\n          <button"
);

// Render the view when activeTab === 'fiscal'
const fiscalRender = `
        {activeTab === 'fiscal' && (
          <FiscalSettingsView onBack={() => setActiveTab('geral')} />
        )}
`;

code = code.replace(
  "{activeTab === 'backup' && (",
  fiscalRender + "\n        {activeTab === 'backup' && ("
);

fs.writeFileSync('client/src/views/SettingsView.tsx', code);
