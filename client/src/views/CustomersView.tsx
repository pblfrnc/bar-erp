import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Banknote } from 'lucide-react';
import { api } from '../services/api';

export const CustomersView: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal de Novo Cliente
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [document, setDocument] = useState('');

  const loadCustomers = async () => {
    try {
      const data = await api.getCustomers();
      setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.createCustomer({ name, phone, document });
      setName('');
      setPhone('');
      setDocument('');
      setShowModal(false);
      loadCustomers();
    } catch (err) {
      alert('Erro ao criar cliente');
    }
  };

  const filtered = customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-4 pb-20 max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm dark:shadow-2xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-500">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Clientes (Fiado)</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Banco de dados de clientes e saldos devedores
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl transition cursor-pointer shadow-sm shadow-amber-500/20 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Cliente</span>
        </button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          placeholder="Buscar cliente por nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 shadow-xs"
        />
      </div>

      {/* Lista */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm dark:shadow-2xl">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Carregando clientes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">Nenhum cliente encontrado.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {filtered.map(c => (
              <div key={c.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200">{c.name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    {c.phone && <span className="text-[10px] text-slate-500">{c.phone}</span>}
                    {c.document && <span className="text-[10px] text-slate-500">Doc: {c.document}</span>}
                  </div>
                </div>
                <div className={`flex flex-col items-end ${c.creditTabBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider mb-0.5">Saldo Devedor</span>
                  <span className="text-sm font-black font-mono">
                    R$ {c.creditTabBalance.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">Cadastrar Cliente</h3>
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label htmlFor="cust-name" className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 block cursor-pointer">
                  Nome Completo *
                </label>
                <input
                  id="cust-name"
                  required
                  type="text"
                  autoFocus
                  placeholder="Ex: Carlos Eduardo"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-amber-500 focus:outline-none cursor-text transition shadow-xs"
                />
              </div>
              <div>
                <label htmlFor="cust-phone" className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 block cursor-pointer">
                  Telefone / WhatsApp
                </label>
                <input
                  id="cust-phone"
                  type="text"
                  placeholder="(11) 98888-7777"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-amber-500 focus:outline-none cursor-text transition shadow-xs"
                />
              </div>
              <div>
                <label htmlFor="cust-doc" className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 block cursor-pointer">
                  Documento CPF / CNPJ (Opcional)
                </label>
                <input
                  id="cust-doc"
                  type="text"
                  placeholder="000.000.000-00"
                  value={document}
                  onChange={e => setDocument(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-mono focus:border-amber-500 focus:outline-none cursor-text transition shadow-xs"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-black rounded-xl transition cursor-pointer shadow-sm shadow-amber-500/20 active:scale-95">Salvar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
