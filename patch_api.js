const fs = require('fs');
let code = fs.readFileSync('client/src/services/api.ts', 'utf8');

code = code.replace(
  "export const api = {",
  "export const api = {\n  getApiUrl: () => getApiUrl(),\n  uploadXml: (formData: FormData) => fetch(`${getApiUrl()}/fiscal/import-xml`, { method: 'POST', body: formData }).then(r => r.json()),\n  applyXmlImport: (data: any) => fetch(`${getApiUrl()}/fiscal/apply-import`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),"
);

fs.writeFileSync('client/src/services/api.ts', code);
