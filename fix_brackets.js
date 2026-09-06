const fs = require('fs');
let code = fs.readFileSync('server/src/index.ts', 'utf8');
code = code.replace(/    io\.emit\('devices_updated', Array\.from\(activeDevices\.values\(\)\)\);\n\}\);\n\n  \}\);\n\n\/\/ Rotas da API/, "    io.emit('devices_updated', Array.from(activeDevices.values()));\n  });\n});\n\n// Rotas da API");
fs.writeFileSync('server/src/index.ts', code);
