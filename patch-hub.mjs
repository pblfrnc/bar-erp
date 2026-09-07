import fs from 'fs';
let f = fs.readFileSync('client/src/views/FiscalHubView.tsx', 'utf-8');

if (!f.includes('AccountantPanelView')) {
  f = f.replace("import { NfceCancelView } from './NfceCancelView';", "import { NfceCancelView } from './NfceCancelView';\nimport { AccountantPanelView } from './AccountantPanelView';");
  
  f = f.replace("useState<'hub' | 'receive' | 'import' | 'emit' | 'settings' | 'cancel'>('hub')", "useState<'hub' | 'receive' | 'import' | 'emit' | 'settings' | 'cancel' | 'accountant'>('hub')");
  
  f = f.replace("if (activeTab === 'cancel') {", "if (activeTab === 'accountant') {\n    return <AccountantPanelView onBack={() => setActiveTab('hub')} />;\n  }\n\n  if (activeTab === 'cancel') {");

  const newCard = `
        {/* Card: Painel do Contador */}
        <button
          onClick={() => setActiveTab('accountant')}
          className="md:col-span-2 bg-slate-900 border border-slate-800 hover:border-sky-500 hover:bg-slate-800/80 rounded-3xl p-8 text-left transition group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-sky-500/5 rounded-full blur-3xl group-hover:bg-sky-500/20 transition"></div>
          <div className="flex items-center gap-4 mb-3">
             <div className="w-10 h-10 text-sky-400 flex items-center justify-center bg-sky-500/10 rounded-xl border border-sky-500/20">
               <span className="font-bold">ZIP</span>
             </div>
             <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">Contabilidade</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Painel do Contador (SPED/XMLs)</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Fechamento do mês: Exporte todos os XMLs de notas de Entrada e Saída compactados em um único arquivo .ZIP com a planilha de resumo para enviar ao contador.
          </p>
        </button>
  `;

  f = f.replace("{/* Card: Configurações Fiscais */}", newCard + "\n        {/* Card: Configurações Fiscais */}");

  fs.writeFileSync('client/src/views/FiscalHubView.tsx', f);
}
