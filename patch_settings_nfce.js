const fs = require('fs');
let code = fs.readFileSync('client/src/views/SettingsView.tsx', 'utf8');

code = code.replace(
  "import { Settings, Users, Smartphone, Printer, ChevronRight, ShieldCheck, MonitorSmartphone, Wifi, FileCode2 } from 'lucide-react';",
  "import { Settings, Users, Smartphone, Printer, ChevronRight, ShieldCheck, MonitorSmartphone, Wifi, FileCode2, Receipt, Building2 } from 'lucide-react';"
);

code = code.replace(
  "onOpenFiscal: () => void;",
  "onOpenFiscal: () => void;\n  onOpenFiscalSettings: () => void;\n  onOpenManualNfce: () => void;"
);

code = code.replace(
  "onOpenFiscal,",
  "onOpenFiscal,\n  onOpenFiscalSettings,\n  onOpenManualNfce,"
);

const nfceButtons = `
        {/* Configurações Fiscais */}
        <button
          onClick={onOpenFiscalSettings}
          className="bg-slate-900 hover:bg-slate-800 transition border border-slate-800 rounded-3xl p-5 text-left flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition">Configurações Fiscais</h3>
              <p className="text-xs text-slate-400 mt-0.5">CNPJ, Certificado e Token da API Fiscal</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 transition" />
        </button>

        {/* Emissor Manual */}
        <button
          onClick={onOpenManualNfce}
          className="bg-slate-900 hover:bg-slate-800 transition border border-slate-800 rounded-3xl p-5 text-left flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition">Emissor de Cupom Fiscal</h3>
              <p className="text-xs text-slate-400 mt-0.5">Emitir notas frias (NFC-e) manualmente</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 transition" />
        </button>
`;

// Insert the buttons right before {/* Importação XML */}
code = code.replace("{/* Importação XML */}", nfceButtons + "\n        {/* Importação XML */}");

fs.writeFileSync('client/src/views/SettingsView.tsx', code);
