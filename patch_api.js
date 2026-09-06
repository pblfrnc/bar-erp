const fs = require('fs');
let code = fs.readFileSync('client/src/services/api.ts', 'utf8');

const newMethods = `
  // Fiscal
  uploadXml: (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('xml', file);
    return fetchWithRetry(\`\${getApiUrl()}/fiscal/import-xml\`, {
      method: 'POST',
      body: formData
    }).then(r => r.json());
  },

  applyXmlImport: (items: any[]): Promise<any> =>
    fetchWithRetry(\`\${getApiUrl()}/fiscal/apply-import\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    }).then(r => r.json()),
`;

code = code.replace("  // Authentication", newMethods + "\n  // Authentication");
fs.writeFileSync('client/src/services/api.ts', code);
