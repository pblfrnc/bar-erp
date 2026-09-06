sed -i '' -e '/<\/div>$/!b' -e '/<\/div>/!b' -e '/<\/div>/!b' -e '463a\
\
          {/* Cliente Fiado */}\
          {paymentMethod === '"'CREDIT_TAB'"' && (\
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">\
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">\
                Vincular Cliente (Obrigatório / Recomendado)\
              </label>\
              <div className="flex flex-col gap-3">\
                <select\
                  value={customerId}\
                  onChange={(e) => { setCustomerId(e.target.value); setCustomerNameInput('"'"'"'"'); }}\
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"\
                >\
                  <option value="">-- Selecione ou digite um novo nome --</option>\
                  {customers.map((c: any) => (\
                    <option key={c.id} value={c.id}>{c.name} (Saldo Atual: R$ {c.creditTabBalance.toFixed(2)})</option>\
                  ))}\
                </select>\
                {!customerId && (\
                  <input\
                    type="text"\
                    value={customerNameInput}\
                    onChange={(e) => setCustomerNameInput(e.target.value)}\
                    placeholder="Ou digite o nome de um novo cliente"\
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 w-full placeholder-slate-600"\
                  />\
                )}\
              </div>\
            </div>\
          )}\
' client/src/components/CheckoutModal.tsx
