import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search, Edit2, Trash2, Phone, Mail, MapPin, FileText, UserCheck, AlertCircle, X, Building2, Package, UploadCloud } from 'lucide-react';
import { api } from '../services/api';
import { Supplier } from '../types';
import { ImportXmlModal } from '../components/ImportXmlModal';

export const SuppliersView: React.FC<{ isAdmin?: boolean }> = ({ isAdmin = false }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal de Criar / Editar
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [showImportXml, setShowImportXml] = useState(false);

  // Campos do Formulário
  const [formName, setFormName] = useState('');
  const [formTradeName, setFormTradeName] = useState('');
  const [formDocument, setFormDocument] = useState('');
  const [formIe, setFormIe] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formContactName, setFormContactName] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const data = await api.getSuppliers();
      setSuppliers(data);
    } catch (err) {
      console.error('Erro ao carregar fornecedores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const openCreateModal = () => {
    setEditingSupplier(null);
    setFormName('');
    setFormTradeName('');
    setFormDocument('');
    setFormIe('');
    setFormPhone('');
    setFormEmail('');
    setFormCity('');
    setFormState('');
    setFormAddress('');
    setFormContactName('');
    setFormNotes('');
    setShowModal(true);
  };

  const openEditModal = (s: Supplier) => {
    setEditingSupplier(s);
    setFormName(s.name || '');
    setFormTradeName(s.tradeName || '');
    setFormDocument(s.document || '');
    setFormIe(s.ie || '');
    setFormPhone(s.phone || '');
    setFormEmail(s.email || '');
    setFormCity(s.city || '');
    setFormState(s.state || '');
    setFormAddress(s.address || '');
    setFormContactName(s.contactName || '');
    setFormNotes(s.notes || '');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Razão Social / Nome do fornecedor é obrigatório');
      return;
    }

    try {
      const payload: Partial<Supplier> = {
        name: formName.trim(),
        tradeName: formTradeName.trim() || null,
        document: formDocument.trim() || null,
        ie: formIe.trim() || null,
        phone: formPhone.trim() || null,
        email: formEmail.trim() || null,
        city: formCity.trim() || null,
        state: formState.trim() || null,
        address: formAddress.trim() || null,
        contactName: formContactName.trim() || null,
        notes: formNotes.trim() || null
      };

      if (editingSupplier) {
        await api.updateSupplier(editingSupplier.id, payload);
      } else {
        await api.createSupplier(payload);
      }

      setShowModal(false);
      loadSuppliers();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar fornecedor');
    }
  };

  const handleDelete = async (s: Supplier) => {
    if (!confirm(`Deseja realmente excluir o fornecedor "${s.tradeName || s.name}"?\nOs produtos cadastrados continuarão no cardápio.`)) {
      return;
    }

    try {
      await api.deleteSupplier(s.id);
      loadSuppliers();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir fornecedor');
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      Boolean(s.name && s.name.toLowerCase().includes(term)) ||
      Boolean(s.tradeName && s.tradeName.toLowerCase().includes(term)) ||
      Boolean(s.document && s.document.includes(term)) ||
      Boolean(s.contactName && s.contactName.toLowerCase().includes(term)) ||
      Boolean(s.city && s.city.toLowerCase().includes(term)) ||
      Boolean(s.phone && s.phone.includes(term))
    );
  });

  const totalProductsLinked = suppliers.reduce((acc, s) => acc + (s._count?.products || 0), 0);

  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto">
      {/* Cabeçalho */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Módulo de Fornecedores</h2>
            <p className="text-xs text-slate-400">
              Controle de distribuidoras, cervejarias, contatos comerciais e cruzamento com notas da SEFAZ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={() => setShowImportXml(true)}
                className="py-2.5 px-4 bg-red-900/60 hover:bg-red-800/80 text-red-300 border border-red-700/60 rounded-xl text-xs font-bold transition flex items-center gap-2 active:scale-95 cursor-pointer"
                title="⚠️ USO EXCLUSIVO DO DESENVOLVEDOR — Importar fornecedores e produtos do sistema anterior"
              >
                <UploadCloud className="w-4 h-4 text-red-400" />
                <span>Importar XML</span>
              </button>
              <span className="text-[10px] text-red-500/80 font-medium leading-none pr-1">
                ⚠️ Apenas desenvolvedor
              </span>
            </div>
          )}
          <button
            onClick={openCreateModal}
            className="py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-2 shadow-lg shadow-emerald-500/15 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Cadastrar Fornecedor</span>
          </button>
        </div>
      </div>

      {showImportXml && (
        <ImportXmlModal
          onClose={() => setShowImportXml(false)}
          onSuccess={() => { loadSuppliers(); setShowImportXml(false); setTimeout(() => setShowImportXml(true), 50); }}
        />
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase font-bold text-slate-400">Total Cadastrados</span>
            <p className="text-2xl font-black text-white mt-0.5">{suppliers.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase font-bold text-slate-400">Com CNPJ Validado</span>
            <p className="text-2xl font-black text-emerald-400 mt-0.5">
              {suppliers.filter(s => s.document && s.document.length >= 11).length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase font-bold text-slate-400">Produtos Vinculados</span>
            <p className="text-2xl font-black text-amber-400 mt-0.5">{totalProductsLinked}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Package className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Pesquisa */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar por Razão Social, Nome Fantasia, CNPJ/CPF, cidade ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Lista / Grid de Fornecedores */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold">Carregando fornecedores...</p>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500">
          <Truck className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
          <h3 className="font-bold text-slate-300 text-sm">
            {suppliers.length === 0 ? 'Nenhum fornecedor cadastrado' : 'Nenhum fornecedor encontrado para esta busca'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Cadastre distribuidores de bebidas, hortifrúti ou carnes para vincular aos produtos ou importe direto ao bipar o XML das compras.
          </p>
          {suppliers.length === 0 && (
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              + Cadastrar Primeiro Fornecedor
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSuppliers.map((s) => {
            const hasCnpj = s.document && s.document.length >= 11;
            const formattedDoc = hasCnpj
              ? s.document!.length === 14
                ? s.document!.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
                : s.document!.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
              : null;

            return (
              <div
                key={s.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  {/* Topo do Card */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-base font-black text-white leading-tight">
                        {s.tradeName || s.name}
                      </h4>
                      {s.tradeName && s.name && (
                        <p className="text-xs text-slate-400 mt-0.5">{s.name}</p>
                      )}
                    </div>
                    {s._count?.products !== undefined && s._count.products > 0 ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 whitespace-nowrap">
                        {s._count.products} {s._count.products === 1 ? 'produto' : 'produtos'}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-slate-800 text-[10px] font-bold text-slate-400 whitespace-nowrap">
                        Sem itens
                      </span>
                    )}
                  </div>

                  {/* Informações Fiscais e Cadastrais */}
                  <div className="space-y-1.5 text-xs">
                    {formattedDoc && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-bold">CNPJ/CPF:</span>
                        <span className="font-mono text-emerald-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
                          {formattedDoc}
                        </span>
                        {s.ie && (
                          <span className="text-slate-400 text-[11px]">
                            • IE: <strong className="font-mono text-slate-300">{s.ie}</strong>
                          </span>
                        )}
                      </div>
                    )}

                    {s.contactName && (
                      <div className="flex items-center gap-2 text-slate-300">
                        <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Contato: <strong className="text-white">{s.contactName}</strong></span>
                      </div>
                    )}

                    {s.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <a
                          href={`https://wa.me/55${s.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:underline font-mono text-[11px]"
                          title="Abrir no WhatsApp"
                        >
                          {s.phone}
                        </a>
                      </div>
                    )}

                    {s.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <a
                          href={`mailto:${s.email}`}
                          className="text-cyan-400 hover:underline truncate"
                        >
                          {s.email}
                        </a>
                      </div>
                    )}

                    {(s.city || s.address) && (
                      <div className="flex items-start gap-2 text-slate-400 text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                        <span>
                          {s.address ? `${s.address} • ` : ''}
                          {s.city}{s.state ? ` - ${s.state}` : ''}
                        </span>
                      </div>
                    )}

                    {s.notes && (
                      <div className="mt-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 italic">
                        "{s.notes}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Ações do Card */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end gap-2">
                  <button
                    onClick={() => openEditModal(s)}
                    className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => handleDelete(s)}
                    className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 transition text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Formulário Completo de Fornecedor */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-400" />
                <span>{editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="sup-form-name" className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                  Razão Social / Nome Principal *
                </label>
                <input
                  id="sup-form-name"
                  type="text"
                  required
                  placeholder="Ex: Cervejaria Ambev S.A. ou Distribuidora Modelo"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none cursor-text"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sup-form-trade-name" className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                    Nome Fantasia
                  </label>
                  <input
                    id="sup-form-trade-name"
                    type="text"
                    placeholder="Ex: Ambev Chopp"
                    value={formTradeName}
                    onChange={(e) => setFormTradeName(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none cursor-text"
                  />
                </div>
                <div>
                  <label htmlFor="sup-form-doc" className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                    CNPJ ou CPF
                  </label>
                  <input
                    id="sup-form-doc"
                    type="text"
                    placeholder="00.000.000/0000-00"
                    value={formDocument}
                    onChange={(e) => setFormDocument(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm focus:border-emerald-500 focus:outline-none cursor-text"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sup-form-phone" className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                    Telefone / WhatsApp
                  </label>
                  <input
                    id="sup-form-phone"
                    type="text"
                    placeholder="(11) 98888-7777"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none cursor-text"
                  />
                </div>
                <div>
                  <label htmlFor="sup-form-ie" className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                    Inscrição Estadual (IE)
                  </label>
                  <input
                    id="sup-form-ie"
                    type="text"
                    placeholder="Ex: 123456789"
                    value={formIe}
                    onChange={(e) => setFormIe(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm focus:border-emerald-500 focus:outline-none cursor-text"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sup-form-email" className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                    E-mail
                  </label>
                  <input
                    id="sup-form-email"
                    type="email"
                    placeholder="pedidos@fornecedor.com.br"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none cursor-text"
                  />
                </div>
                <div>
                  <label htmlFor="sup-form-contact" className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                    Contato / Vendedor
                  </label>
                  <input
                    id="sup-form-contact"
                    type="text"
                    placeholder="Ex: Carlos Representante"
                    value={formContactName}
                    onChange={(e) => setFormContactName(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none cursor-text"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label htmlFor="sup-form-city" className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                    Cidade
                  </label>
                  <input
                    id="sup-form-city"
                    type="text"
                    placeholder="Ex: São Paulo"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none cursor-text"
                  />
                </div>
                <div>
                  <label htmlFor="sup-form-state" className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                    UF
                  </label>
                  <input
                    id="sup-form-state"
                    type="text"
                    placeholder="SP"
                    maxLength={2}
                    value={formState}
                    onChange={(e) => setFormState(e.target.value.toUpperCase())}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm focus:border-emerald-500 focus:outline-none cursor-text"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="sup-form-address" className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                  Endereço
                </label>
                <input
                  id="sup-form-address"
                  type="text"
                  placeholder="Rua, número, bairro..."
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none cursor-text"
                />
              </div>

              <div>
                <label htmlFor="sup-form-notes" className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                  Observações / Condições Comerciais
                </label>
                <textarea
                  id="sup-form-notes"
                  rows={2}
                  placeholder="Ex: Entrega às terças-feiras. Pedido mínimo R$ 500. Boleto 28 dias."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none resize-none cursor-text"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/10 cursor-pointer"
                >
                  {editingSupplier ? 'Atualizar Fornecedor' : 'Salvar Fornecedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
