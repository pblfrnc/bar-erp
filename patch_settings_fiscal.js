const fs = require('fs');
let code = fs.readFileSync('client/src/views/SettingsView.tsx', 'utf8');

code = code.replace(
  "import { Settings, Users, Smartphone, Printer, ChevronRight, ShieldCheck, MonitorSmartphone, Wifi } from 'lucide-react';",
  "import { Settings, Users, Smartphone, Printer, ChevronRight, ShieldCheck, MonitorSmartphone, Wifi, FileCode2 } from 'lucide-react';"
);

code = code.replace(
  "onOpenCustomers: () => void;",
  "onOpenCustomers: () => void;\n  onOpenFiscal: () => void;"
);

code = code.replace(
  "onOpenCustomers,",
  "onOpenCustomers,\n  onOpenFiscal,"
);

const fiscalButton = `
        {/* Importação XML */}
        <button
          onClick={onOpenFiscal}
          className="bg-slate-900 hover:bg-slate-800 transition border border-slate-800 rounded-3xl p-5 text-left flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <FileCode2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition">Entrada XML (NF-e)</h3>
              <p className="text-xs text-slate-400 mt-0.5">Importe XML de fornecedores p/ estoque</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 transition" />
        </button>
`;

// Insert the button before the "Clientes Fiado" button (which has <Users className="w-6 h-6" /> inside emerald bg... wait no, Customers is emerald, let's just insert it before "Clientes Fiado").
code = code.replace("{/* Clientes Fiado */}", fiscalButton + "\n        {/* Clientes Fiado */}");

fs.writeFileSync('client/src/views/SettingsView.tsx', code);
