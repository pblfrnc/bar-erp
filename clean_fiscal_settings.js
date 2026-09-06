const fs = require('fs');
let code = fs.readFileSync('client/src/views/FiscalSettingsView.tsx', 'utf8');

// Remove the alert box completely
const alertRegex = /<div className="bg-indigo-500\/10 border border-indigo-500\/30 rounded-3xl p-5 mb-6 flex items-start gap-4">[\s\S]*?<\/div>\s*<\/div>/;
code = code.replace(alertRegex, "");

// Remove the term Software House from the save button
code = code.replace(
  "{isSaving ? 'Salvando...' : 'Cadastrar Empresa (Software House)'}",
  "{isSaving ? 'Salvando...' : 'Cadastrar Dados da Empresa'}"
);

// Remove 'Software House' from the Master Token title
code = code.replace(
  "<h3 className=\"text-lg font-bold text-white\">Token Master da Software House</h3>",
  "<h3 className=\"text-lg font-bold text-white\">Token da API de Emissão</h3>"
);

fs.writeFileSync('client/src/views/FiscalSettingsView.tsx', code);
