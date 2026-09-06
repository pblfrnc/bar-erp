sed -i '' -e '/<\/div>$/i\
      {/* ----------------- SEÇÃO ELITE ----------------- */}\
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">\
\
        {/* Vendas por Hora (Gráfico Nativo) */}\
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">\
          <h3 className="text-base font-black text-white">Vendas por Hora (Pico)</h3>\
          <div className="flex items-end gap-2 h-40 pt-4">\
            {data?.salesByHour?.map((sh) => {\
              const maxSales = Math.max(...data.salesByHour.map((s) => s.total), 1);\
              const heightPct = Math.round((sh.total / maxSales) * 100);\
              return (\
                <div key={sh.hour} className="flex-1 flex flex-col items-center gap-2 group">\
                  <div className="w-full bg-slate-950 rounded-t-lg relative flex-1 flex items-end justify-center">\
                    <div\
                      className="w-full bg-indigo-500 rounded-t-sm transition-all group-hover:bg-indigo-400"\
                      style={{ height: `${heightPct}%` }}\
                    />\
                    {/* Tooltip rudimentar */}\
                    <div className="absolute -top-6 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">\
                      R$ {sh.total.toFixed(0)}\
                    </div>\
                  </div>\
                  <span className="text-[10px] text-slate-500 font-bold">{sh.hour}</span>\
                </div>\
              );\
            })}\
          </div>\
        </div>\
\
        {/* Pódio de Garçons */}\
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">\
          <h3 className="text-base font-black text-white">Performance dos Garçons</h3>\
          <div className="space-y-3 pt-2">\
            {data?.waiterPerformance?.length ? (\
              data.waiterPerformance.map((w, idx) => (\
                <div key={w.name} className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/50 border border-slate-800/60">\
                  <div className="flex items-center gap-3">\
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${idx === 0 ? '"'bg-amber-500/20 text-amber-500'"' : idx === 1 ? '"'bg-slate-300/20 text-slate-300'"' : idx === 2 ? '"'bg-orange-600/20 text-orange-500'"' : '"'bg-slate-800 text-slate-500'"'}`}>\
                      {idx + 1}º\
                    </div>\
                    <div>\
                      <p className="text-sm font-bold text-slate-200">{w.name}</p>\
                      <p className="text-[10px] text-slate-500">{w.count} pedidos fechados</p>\
                    </div>\
                  </div>\
                  <span className="font-mono font-black text-emerald-400 text-sm">R$ {w.total.toFixed(2)}</span>\
                </div>\
              ))\
            ) : (\
              <div className="text-center py-8 text-slate-500 text-xs">Nenhum garçom registrou vendas hoje.</div>\
            )}\
          </div>\
        </div>\
\
        {/* Alertas de Baixa Margem */}\
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-3xl p-5 space-y-4">\
          <h3 className="text-base font-black text-rose-400 flex items-center gap-2">\
            Alerta de Lucratividade\
          </h3>\
          <p className="text-[11px] text-slate-400 leading-relaxed">\
            Produtos com margem de lucro inferior a 30%. Recomendado revisar preços ou trocar fornecedor.\
          </p>\
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">\
            {data?.lowMarginProducts?.length ? (\
              data.lowMarginProducts.map((p) => (\
                <div key={p.id} className="flex justify-between items-center p-2 rounded-xl bg-slate-900 border border-rose-500/20">\
                  <span className="text-xs font-bold text-slate-300 truncate pr-2">{p.name}</span>\
                  <span className="text-[10px] font-mono px-2 py-1 rounded bg-rose-500/10 text-rose-400 font-bold">\
                    {p.margin}% Lucro\
                  </span>\
                </div>\
              ))\
            ) : (\
              <div className="text-center py-4 text-emerald-500/70 text-xs font-bold">\
                Nenhum produto com margem perigosa!\
              </div>\
            )}\
          </div>\
        </div>\
\
      </div>\
' client/src/views/DashboardView.tsx
