const fs = require('fs');
let code = fs.readFileSync('client/src/views/FiscalSettingsView.tsx', 'utf8');

const envField = `
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Ambiente SEFAZ</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-white cursor-pointer">
                  <input
                    type="radio"
                    name="env"
                    value="homologacao"
                    checked={settings.environment === 'homologacao' || !settings.environment}
                    onChange={e => handleChange('environment', e.target.value)}
                    className="w-4 h-4 text-emerald-500 bg-slate-900 border-slate-700"
                  />
                  <span>Homologação (Sem Valor Fiscal - Testes)</span>
                </label>
                <label className="flex items-center gap-2 text-white cursor-pointer">
                  <input
                    type="radio"
                    name="env"
                    value="producao"
                    checked={settings.environment === 'producao'}
                    onChange={e => handleChange('environment', e.target.value)}
                    className="w-4 h-4 text-amber-500 bg-slate-900 border-slate-700"
                  />
                  <span>Produção (Valendo - Envia pra SEFAZ real)</span>
                </label>
              </div>
            </div>
`;

code = code.replace(
  '<div className="sm:col-span-2">\\n              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Código de Segurança',
  envField + '\\n            <div className="sm:col-span-2">\\n              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Código de Segurança'
);

// I will use normal replace for this since the raw string has indentations
code = code.replace(
  /<div className="sm:col-span-2">\s*<label className="block text-xs font-bold text-slate-400 uppercase mb-2">Código de Segurança/,
  envField + '\n            <div className="sm:col-span-2">\n              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Código de Segurança'
);

fs.writeFileSync('client/src/views/FiscalSettingsView.tsx', code);
