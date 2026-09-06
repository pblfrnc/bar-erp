const fs = require('fs');
let code = fs.readFileSync('server/src/routes/fiscal.ts', 'utf8');

// The second fetch in the file should be the one inside /emit-nfce
// Let's replace specifically in emit-nfce

code = code.replace(
  "      console.log('Enviando NFC-e para:', baseURL);\n      const focusRes = await fetch(baseURL + '?dry_run=0', {",
  "      console.log('Enviando NFC-e para:', baseURL);\n      const focusRes = await fetch(baseURL + '?cnpj_emitente=' + settings.cnpj.replace(/\\D/g, '') + '&dry_run=0', {"
);

fs.writeFileSync('server/src/routes/fiscal.ts', code);
