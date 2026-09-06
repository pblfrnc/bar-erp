const fs = require('fs');
let code = fs.readFileSync('client/src/views/DashboardView.tsx', 'utf8');
code = code.replace("ChefHat", "ChefHat,\n  ShieldAlert");
fs.writeFileSync('client/src/views/DashboardView.tsx', code);
