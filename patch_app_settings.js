const fs = require('fs');
let code = fs.readFileSync('client/src/App.tsx', 'utf8');

code = code.replace(/onOpenFiscal=\{\(\) => setCurrentView\('fiscal'\)\}/, "");
code = code.replace(/onOpenFiscalSettings=\{\(\) => setCurrentView\('fiscalSettings'\)\}/, "");
code = code.replace(/onOpenManualNfce=\{\(\) => setCurrentView\('manualNfce'\)\}/, "");

fs.writeFileSync('client/src/App.tsx', code);
