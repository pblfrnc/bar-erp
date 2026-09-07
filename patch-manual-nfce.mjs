import fs from 'fs';
let f = fs.readFileSync('client/src/views/ManualNfceView.tsx', 'utf-8');

// Add state for paymentMethod
f = f.replace("const [customerCpf, setCustomerCpf] = useState('');", "const [customerCpf, setCustomerCpf] = useState('');\n  const [paymentMethod, setPaymentMethod] = useState('PIX');");

// Include paymentMethod in payload
f = f.replace(`const payload = {
        customerCpf,
        items: items.map(i => ({`, `const payload = {
        customerCpf,
        paymentMethod,
        items: items.map(i => ({`);

// Add the selector UI before the Emit button
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
  // Find where customerCpf is rendered and insert after
  f = f.replace(`          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">CPF na Nota (Opcional)</label>
            <input 
              type="text" 
              placeholder="000.000.000-00"
              value={customerCpf}
              onChange={e => setCustomerCpf(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition font-mono"
            />
          </div>`, `          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">CPF na Nota (Opcional)</label>
            <input 
              type="text" 
              placeholder="000.000.000-00"
              value={customerCpf}
              onChange={e => setCustomerCpf(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition font-mono"
            />
          </div>\n${uiSelector}`);
}

fs.writeFileSync('client/src/views/ManualNfceView.tsx', f);
