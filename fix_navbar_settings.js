const fs = require('fs');
let navbar = fs.readFileSync('client/src/components/Navbar.tsx', 'utf8');
navbar = navbar.replace("import { FileText } from 'lucide-react';\n", "");
fs.writeFileSync('client/src/components/Navbar.tsx', navbar);

let settings = fs.readFileSync('client/src/views/SettingsView.tsx', 'utf8');
// Fix SettingsView by removing the onClick buttons completely
settings = settings.replace(/<button[^>]*?onClick=\{onOpenFiscalSettings\}[^>]*?>[\s\S]*?<\/button>/g, "");
settings = settings.replace(/<button[^>]*?onClick=\{onOpenManualNfce\}[^>]*?>[\s\S]*?<\/button>/g, "");
settings = settings.replace(/<button[^>]*?onClick=\{onOpenFiscal\}[^>]*?>[\s\S]*?<\/button>/g, "");

fs.writeFileSync('client/src/views/SettingsView.tsx', settings);
