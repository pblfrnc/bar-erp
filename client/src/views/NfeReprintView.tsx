                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      nota.status === 'cancelado'
                        ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                        : 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                    }`}
                    >
                      {nota.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
                    <span>{new Date(nota.createdAt).toLocaleString('pt-BR')}</span>
                    {nota.valorTotal !== undefined && (
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        R$ {nota.valorTotal.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (nota.numero) {
                        setNumeroNota(nota.numero);
                        handleConsultByNumber(nota.numero);
                      }
                    }}
                    className="px-3.5 py-2 bg-sky-50 hover:bg-sky-500 dark:bg-sky-500/15 dark:hover:bg-sky-500 text-sky-700 hover:text-white dark:text-sky-300 dark:hover:text-white border border-sky-200 dark:border-sky-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" /> Reimprimir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
