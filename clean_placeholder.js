const fs = require('fs');
let code = fs.readFileSync('client/src/views/FiscalSettingsView.tsx', 'utf8');

code = code.replace(
  "placeholder=\"Obrigatório para abrir a empresa do cliente...\"",
  "placeholder=\"Cole o token da Focus NFe aqui...\""
);

code = code.replace(
  "Token da API Master (Focus NFe)",
  "Token da API (Focus NFe)"
);

fs.writeFileSync('client/src/views/FiscalSettingsView.tsx', code);
