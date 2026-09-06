const fs = require('fs');
let code = fs.readFileSync('client/src/components/Navbar.tsx', 'utf8');

code = code.replace(
  "    {\n      id: 'audit' as const,\n      label: 'Auditoria Cega',\n      icon: ShieldAlert,\n      badge: null\n    },",
  "    {\n      id: 'fiscal' as const,\n      label: 'Módulo Fiscal',\n      icon: FileText,\n      badge: null\n    },"
);

code = code.replace(
  "import React from 'react';",
  "import React from 'react';\nimport { FileText } from 'lucide-react';"
);

fs.writeFileSync('client/src/components/Navbar.tsx', code);
