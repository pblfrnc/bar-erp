const fs = require('fs');
let code = fs.readFileSync('client/src/views/ProductsView.tsx', 'utf8');

// Add state for NCM and CFOP
code = code.replace(
  "const [costPrice, setCostPrice] = useState('');",
  "const [costPrice, setCostPrice] = useState('');\n  const [ncm, setNcm] = useState('');\n  const [cfop, setCfop] = useState('');"
);

// Reset state
code = code.replace(
  "setCostPrice('');",
  "setCostPrice('');\n    setNcm('');\n    setCfop('');"
);

// Edit state
code = code.replace(
  "setCostPrice(product.costPrice ? String(product.costPrice) : '');",
  "setCostPrice(product.costPrice ? String(product.costPrice) : '');\n    setNcm(product.ncm || '');\n    setCfop(product.cfop || '');"
);

// Save payload
code = code.replace(
  "costPrice: costPrice ? parseFloat(costPrice) : undefined",
  "costPrice: costPrice ? parseFloat(costPrice) : undefined,\n      ncm: ncm || undefined,\n      cfop: cfop || undefined"
);

// Auto-fill logic
const autoFillMagic = `
  const handleMagicFiscal = () => {
    const text = name.toLowerCase();
    let suggestedNcm = '';
    let suggestedCfop = '5102'; // Padrão: Venda mercadoria
    
    if (text.includes('cerveja') || text.includes('chopp') || text.includes('heineken') || text.includes('skol') || text.includes('spaten')) {
      suggestedNcm = '22030000';
      suggestedCfop = '5405'; // ST
    } else if (text.includes('agua') || text.includes('água')) {
      suggestedNcm = '22011000';
      suggestedCfop = '5405'; // ST
    } else if (text.includes('refri') || text.includes('coca') || text.includes('guarana') || text.includes('fanta')) {
      suggestedNcm = '22021000';
      suggestedCfop = '5405'; // ST
    } else if (text.includes('vodka') || text.includes('gin') || text.includes('whisky')) {
      suggestedNcm = '22089000';
      suggestedCfop = '5405';
    } else if (text.includes('porcao') || text.includes('porção') || text.includes('batata') || text.includes('frango') || text.includes('carne') || text.includes('lanche')) {
      suggestedNcm = '21069090'; // Preparação alimentícia genérica
      suggestedCfop = '5102'; 
    } else {
      alert("Não foi possível adivinhar o NCM pelo nome do produto. Consulte seu contador.");
      return;
    }
    
    setNcm(suggestedNcm);
    setCfop(suggestedCfop);
  };
`;

code = code.replace("const handleSave = async (e: React.FormEvent) => {", autoFillMagic + "\n  const handleSave = async (e: React.FormEvent) => {");

// Add Inputs to UI
const fiscalInputs = `
              <div className="pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-300">Dados Fiscais (NFC-e)</h3>
                  <button 
                    type="button"
                    onClick={handleMagicFiscal}
                    className="text-xs font-bold bg-indigo-500/10 text-indigo-400 px-3 py-1.5 rounded-lg hover:bg-indigo-500/20 transition"
                  >
                    ✨ Preencher Mágico
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">NCM</label>
                    <input
                      type="text"
                      value={ncm}
                      onChange={(e) => setNcm(e.target.value)}
                      placeholder="Ex: 22030000"
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:border-emerald-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">CFOP</label>
                    <input
                      type="text"
                      value={cfop}
                      onChange={(e) => setCfop(e.target.value)}
                      placeholder="Ex: 5102 ou 5405"
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:border-emerald-500 outline-none transition"
                    />
                  </div>
                </div>
              </div>
`;

code = code.replace(
  '<div className="flex justify-end gap-3 pt-6">',
  fiscalInputs + '\n              <div className="flex justify-end gap-3 pt-6">'
);

fs.writeFileSync('client/src/views/ProductsView.tsx', code);
