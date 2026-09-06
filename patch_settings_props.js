const fs = require('fs');
let code = fs.readFileSync('client/src/views/SettingsView.tsx', 'utf8');

code = code.replace(/onOpenFiscal:\s*\(\)\s*=>\s*void;/g, "");
code = code.replace(/onOpenFiscalSettings:\s*\(\)\s*=>\s*void;/g, "");
code = code.replace(/onOpenManualNfce:\s*\(\)\s*=>\s*void;/g, "");

code = code.replace(/onOpenFiscal,/g, "");
code = code.replace(/onOpenFiscalSettings,/g, "");
code = code.replace(/onOpenManualNfce,/g, "");

code = code.replace(/<button onClick=\{onOpenFiscalSettings\}[\s\S]*?<\/button>/g, "");
code = code.replace(/<button onClick=\{onOpenManualNfce\}[\s\S]*?<\/button>/g, "");
code = code.replace(/<button onClick=\{onOpenFiscal\}[\s\S]*?<\/button>/g, "");

fs.writeFileSync('client/src/views/SettingsView.tsx', code);
