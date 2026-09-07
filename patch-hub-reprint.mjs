import fs from 'fs';
let f = fs.readFileSync('client/src/views/FiscalHubView.tsx', 'utf-8');

if (!f.includes('NfceReprintView')) {
  f = f.replace("import { NfceCancelView } from './NfceCancelView';", "import { NfceCancelView } from './NfceCancelView';\nimport { NfceReprintView } from './NfceReprintView';");
  
  f = f.replace("useState<'hub' | 'receive' | 'import' | 'emit' | 'settings' | 'cancel' | 'accountant'>('hub')", "useState<'hub' | 'receive' | 'import' | 'emit' | 'settings' | 'cancel' | 'reprint' | 'accountant'>('hub')");
  
  f = f.replace("if (activeTab === 'cancel') {", "if (activeTab === 'reprint') {\n    return <NfceReprintView onBack={() => setActiveTab('hub')} />;\n  }\n\n  if (activeTab === 'cancel') {");

  const newCard = `
        {/* Card: Reimprimir Nota */}
        <button
          onClick={() => setActiveTab('reprint')}
          className="bg-slate-900 border border-slate-800 hover:border-sky-500 hover:bg-slate-800/80 rounded-3xl p-8 text-left transition group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-3xl group-hover:bg-sky-500/20 transition"></div>
          <div className="w-12 h-12 text-sky-400 mb-6 flex items-center justify-center bg-sky-500/10 rounded-2xl group-hover:scale-110 transition-transform border border-sky-500/20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Reimprimir NFC-e</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Busque o DANFE e o XML de uma nota já emitida na Sefaz usando o número de referência.
          </p>
        </button>
  `;

  // The user asked to put it next to "Cancelar Nota".
  f = f.replace("{/* Card: Cancelar Nota */}", newCard + "\n        {/* Card: Cancelar Nota */}");

  fs.writeFileSync('client/src/views/FiscalHubView.tsx', f);
}
