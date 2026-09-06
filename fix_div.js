const fs = require('fs');
let code = fs.readFileSync('client/src/views/SettingsView.tsx', 'utf8');
code = code.replace(
  "{/* Dispositivos Conectados */}",
  "</div>\n\n      {/* Dispositivos Conectados */}"
);
fs.writeFileSync('client/src/views/SettingsView.tsx', code);
