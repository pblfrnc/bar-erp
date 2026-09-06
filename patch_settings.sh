sed -i '' -e '/autoPrintKitchen: boolean;/i\
  onOpenCustomers: () => void;\
' client/src/views/SettingsView.tsx

sed -i '' -e 's/onOpenConnectMobile,/onOpenConnectMobile, onOpenCustomers,/' client/src/views/SettingsView.tsx

sed -i '' -e '/{/* Garçons */}/i\
        {/* Clientes Fiado */}\
        <button\
          onClick={onOpenCustomers}\
          className="bg-slate-900 hover:bg-slate-800 transition border border-slate-800 rounded-3xl p-5 text-left flex items-center justify-between group"\
        >\
          <div className="flex items-center gap-4">\
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">\
              <Users className="w-6 h-6" />\
            </div>\
            <div>\
              <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition">Clientes (Fiado)</h3>\
              <p className="text-xs text-slate-400 mt-0.5">Banco de dados e saldos devedores</p>\
            </div>\
          </div>\
          <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 transition" />\
        </button>\
' client/src/views/SettingsView.tsx
