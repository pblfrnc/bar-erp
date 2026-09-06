const fs = require('fs');
let code = fs.readFileSync('client/src/views/FiscalSettingsView.tsx', 'utf8');

code = code.replace(
  "import api from '../services/api';",
  "import { api } from '../services/api';"
);
code = code.replace(
  "const handleChange = (field: string, value: string) => {\n    setSettings(prev => ({ ...prev, [field]: value }));\n  };",
  "const handleChange = (field: string, value: string) => {\n    setSettings((prev: any) => ({ ...prev, [field]: value }));\n  };"
);

fs.writeFileSync('client/src/views/FiscalSettingsView.tsx', code);
