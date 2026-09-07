import fs from 'fs';

let f = fs.readFileSync('client/src/views/NfReceivingView.tsx', 'utf-8');

const syncFunction = `
  const handleSyncSEFAZ = async () => {
    setIsLoading(true);
    setLastResult(null);
    try {
      const res = await fetch(\`\${api.getApiUrl()}/fiscal/sync-nfe-recebidas\`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Erro ao sincronizar');
      
      setLastResult({ success: true, message: data.message || 'Sincronização concluída!' });
      await loadNotas();
    } catch (err: any) {
      setLastResult({ success: false, error: err.message });
    } finally {
      setIsLoading(false);
    }
  };
`;

if (!f.includes('handleSyncSEFAZ')) {
  f = f.replace("const handleBip = async () => {", syncFunction + "\n  const handleBip = async () => {");
}

const syncButton = `
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={handleSyncSEFAZ}
            disabled={isLoading}
            className="w-full sm:w-auto px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition flex items-center justify-center gap-2"
          >
            <RefreshCw className={\`w-5 h-5 \${isLoading ? 'animate-spin' : ''}\`} />
            Sincronizar SEFAZ (Automático)
          </button>
        </div>
        
        <div className="flex items-center gap-4 my-6">
          <div className="h-px bg-slate-800 flex-1"></div>
          <span className="text-slate-500 text-xs font-bold uppercase">Ou faça manualmente por BIP</span>
          <div className="h-px bg-slate-800 flex-1"></div>
        </div>
`;

if (!f.includes('Sincronizar SEFAZ (Automático)')) {
  f = f.replace("{/* Card Principal de Bipagem */}", syncButton + "\n\n        {/* Card Principal de Bipagem */}");
}

// Add RefreshCw import
if (!f.includes('RefreshCw')) {
  f = f.replace("Scan, CheckCircle", "Scan, CheckCircle, RefreshCw");
}

fs.writeFileSync('client/src/views/NfReceivingView.tsx', f);
