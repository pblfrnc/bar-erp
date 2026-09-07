import fs from 'fs';
let f = fs.readFileSync('client/src/views/ManualNfceView.tsx', 'utf-8');

const uiSelector = `
          {/* Forma de Pagamento */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
              Forma de Pagamento Sefaz
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-amber-500 outline-none transition font-bold"
            >
              <option value="PIX">PIX</option>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="CREDITO">Cartão de Crédito</option>
              <option value="DEBITO">Cartão de Débito</option>
            </select>
          </div>
`;

if (!f.includes('Forma de Pagamento Sefaz')) {
  f = f.replace(`          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">CPF na Nota (Opcional)</label>`, `          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">CPF na Nota (Opcional)</label>`);
            
  // Let's just insert it right after the customerCpf input wrapper div
  const target = `            />
          </div>`;
          
  f = f.replace(target, target + "\n" + uiSelector);
}

fs.writeFileSync('client/src/views/ManualNfceView.tsx', f);
