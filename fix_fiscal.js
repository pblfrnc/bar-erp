const fs = require('fs');
let code = fs.readFileSync('server/src/routes/fiscal.ts', 'utf8');

code = code.replace(
  "const focusRes = await fetch(baseURL + '?cnpj_emitente=' + settings.cnpj.replace(/\\D/g, '') + '&dry_run=0', {\n          method: 'POST',\n          headers: {\n            'Content-Type': 'application/json',\n            'Authorization': 'Basic ' + Buffer.from(data.apiToken + ':').toString('base64')",
  "const focusRes = await fetch(baseURL + '?dry_run=0', {\n          method: 'POST',\n          headers: {\n            'Content-Type': 'application/json',\n            'Authorization': 'Basic ' + Buffer.from(data.apiToken + ':').toString('base64')"
);

fs.writeFileSync('server/src/routes/fiscal.ts', code);
