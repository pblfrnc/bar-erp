const fs = require('fs');
let code = fs.readFileSync('client/src/views/FiscalImportView.tsx', 'utf8');

code = code.replace(
  "const data = await api.uploadXml(file);",
  "const formData = new FormData();\n      formData.append('xml', file);\n      const data = await api.uploadXml(formData);"
);

fs.writeFileSync('client/src/views/FiscalImportView.tsx', code);
