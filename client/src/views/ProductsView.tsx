import React, { useState, useEffect } from 'react';
import { Product, Category, KdsStation, Supplier } from '../types';
import { api } from '../services/api';
import {
  UtensilsCrossed,
  Search,
  Plus,
  Edit2,
  Package,
  AlertTriangle,
  CheckCircle,
  Tag,
  Beer,
  ChefHat,
  Trash2,
  X,
  Barcode,
  Sparkles,
  Loader2,
  Copy,
  Truck,
  Building2,
  Phone,
  Mail,
  FileText
} from 'lucide-react';

export const ProductsView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Modal Produto
  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formEan, setFormEan] = useState<string>('');
  const [formBrand, setFormBrand] = useState<string>('');
  const [formSupplier, setFormSupplier] = useState<string>('');
  const [formSupplierId, setFormSupplierId] = useState<string>('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Modais de Fornecedores
  const [showSuppliersModal, setShowSuppliersModal] = useState<boolean>(false);
  const [supplierSearch, setSupplierSearch] = useState<string>('');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [showSupplierFormModal, setShowSupplierFormModal] = useState<boolean>(false);
  const [supplierFormName, setSupplierFormName] = useState<string>('');
  const [supplierFormTradeName, setSupplierFormTradeName] = useState<string>('');
  const [supplierFormDocument, setSupplierFormDocument] = useState<string>('');
  const [supplierFormIe, setSupplierFormIe] = useState<string>('');
  const [supplierFormPhone, setSupplierFormPhone] = useState<string>('');
  const [supplierFormEmail, setSupplierFormEmail] = useState<string>('');
  const [supplierFormCity, setSupplierFormCity] = useState<string>('');
  const [supplierFormState, setSupplierFormState] = useState<string>('');
  const [supplierFormAddress, setSupplierFormAddress] = useState<string>('');
  const [supplierFormContactName, setSupplierFormContactName] = useState<string>('');
  const [supplierFormNotes, setSupplierFormNotes] = useState<string>('');

  // Modal Rápido de Fornecedor (ao cadastrar produto)
  const [showQuickSupplierModal, setShowQuickSupplierModal] = useState<boolean>(false);
  const [quickSupplierName, setQuickSupplierName] = useState<string>('');
  const [quickSupplierTradeName, setQuickSupplierTradeName] = useState<string>('');
  const [quickSupplierDoc, setQuickSupplierDoc] = useState<string>('');
  const [quickSupplierPhone, setQuickSupplierPhone] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formPrice, setFormPrice] = useState<string>('');
  const [formCostPrice, setFormCostPrice] = useState<string>('');
  const [formCategoryId, setFormCategoryId] = useState<string>('');
  const [formKdsStation, setFormKdsStation] = useState<KdsStation>('BAR');
  const [formStock, setFormStock] = useState<string>('100');
  const [formMinStock, setFormMinStock] = useState<string>('10');
  const [formNcm, setFormNcm] = useState<string>('');
  const [formCfop, setFormCfop] = useState<string>('5102');
  const [formCest, setFormCest] = useState<string>('');
  const [formUnit, setFormUnit] = useState<string>('un');
  const [formComponents, setFormComponents] = useState<{ componentId: string; quantity: string }[]>([]);
  const [isComposed, setIsComposed] = useState<boolean>(false);

  // EAN Lookup API
  const [lookupLoading, setLookupLoading] = useState<boolean>(false);
  const [lookupFeedback, setLookupFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Modal Categoria
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatIcon, setNewCatIcon] = useState<string>('Beer');
  const [newCatCodeStart, setNewCatCodeStart] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, cats, sups] = await Promise.all([
        api.getProducts(undefined, undefined, true),
        api.getCategories(),
        api.getSuppliers()
      ]);
      setProducts(prods);
      setCategories(cats);
      setSuppliers(sups);
      if (cats.length > 0 && !formCategoryId) {
        setFormCategoryId(cats[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormCode('');
    setFormEan('');
    setFormBrand('');
    setFormSupplier('');
    setFormSupplierId('');
    setFormDescription('');
    setFormPrice('');
    setFormCostPrice('');
    setFormKdsStation('BAR');
    setFormStock('100');
    setFormMinStock('10');
    setFormNcm('');
    setFormCfop('5102');
    setFormCest('');
    setFormUnit('un');
    setLookupFeedback(null);
    setFormComponents([]);
    setIsComposed(false);
    const targetCat = selectedCategory !== 'ALL' ? selectedCategory : (categories[0]?.id || '');
    if (targetCat) {
      setFormCategoryId(targetCat);
      api.getNextProductCode(targetCat).then(res => {
        if (res?.nextCode) setFormCode(res.nextCode);
      }).catch(() => {});
    }
    setShowProductModal(true);
  };

  const handleDuplicateProduct = async (p: Product) => {
    setEditingProduct(null); // Criação de novo item!
    setFormName(`${p.name} (Cópia)`);
    setFormEan(''); // Limpa o EAN para o usuário bipar o código novo
    setFormBrand(p.brand || '');
    setFormSupplier(p.supplier || p.supplierRel?.tradeName || p.supplierRel?.name || '');
    setFormSupplierId(p.supplierId || '');
    setFormDescription(p.description || '');
    setFormPrice(p.price.toString());
    setFormCostPrice(p.costPrice ? p.costPrice.toString() : '');
    setFormCategoryId(p.categoryId);
    setFormKdsStation(p.kdsStation);
    setFormStock(p.stock.toString());
    setFormMinStock(p.minStock.toString());
    setFormNcm(p.ncm || '');
    setFormCest(p.cest || '');
    setFormCfop(p.cfop || '5102');
    setFormUnit(p.unit || 'un');
    if (p.components && p.components.length > 0) {
      setIsComposed(true);
      setFormComponents(p.components.map(c => ({ componentId: c.componentId, quantity: c.quantity.toString() })));
    } else {
      setIsComposed(false);
      setFormComponents([]);
    }

    // Gerar novo código sequencial imediatamente para a categoria
    try {
      const codeRes = await api.getNextProductCode(p.categoryId);
      if (codeRes?.nextCode) {
        setFormCode(codeRes.nextCode);
      } else {
        setFormCode('');
      }
    } catch {
      setFormCode('');
    }

    setLookupFeedback({
      type: 'info',
      message: `Item duplicado a partir de "${p.name}". Novo código interno sequencial gerado! Ajuste o nome e bipe o novo código de barras.`
    });

    setShowProductModal(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCode(p.code || '');
    setFormEan(p.ean || '');
    setFormBrand(p.brand || '');
    setFormSupplier(p.supplier || p.supplierRel?.tradeName || p.supplierRel?.name || '');
    setFormSupplierId(p.supplierId || '');
    setFormDescription(p.description || '');
    setFormPrice(p.price.toString());
    setFormCostPrice(p.costPrice ? p.costPrice.toString() : '');
    setFormCategoryId(p.categoryId);
    setFormKdsStation(p.kdsStation);
    setFormStock(p.stock.toString());
    setFormMinStock(p.minStock.toString());
    setFormNcm(p.ncm || '');
    setFormCfop(p.cfop || '5102');
    setFormCest(p.cest || '');
    setFormUnit(p.unit || 'un');
    setLookupFeedback(null);
    if (p.components && p.components.length > 0) {
      setIsComposed(true);
      setFormComponents(p.components.map(c => ({ componentId: c.componentId, quantity: c.quantity.toString() })));
    } else {
      setIsComposed(false);
      setFormComponents([]);
    }
    setShowProductModal(true);
  };

  const handleLookupEan = async (eanToSearch?: string) => {
    const targetEan = (eanToSearch || formEan || '').trim();
    if (!targetEan) {
      setLookupFeedback({ type: 'error', message: 'Digite ou bipe o Código de Barras (EAN).' });
      return;
    }

    try {
      setLookupLoading(true);
      setLookupFeedback(null);
      const res = await api.lookupProductByEan(targetEan);

      if (res.found) {
        if (res.name) setFormName(res.name);
        if (res.code && !formCode) setFormCode(res.code);
        if (res.ean) setFormEan(res.ean);
        if (res.brand) setFormBrand(res.brand);
        if (res.supplier) {
          setFormSupplier(res.supplier);
          const matchSup = suppliers.find(s =>
            s.name.toLowerCase().includes(res.supplier.toLowerCase()) ||
            (s.tradeName && s.tradeName.toLowerCase().includes(res.supplier.toLowerCase()))
          );
          if (matchSup) {
            setFormSupplierId(matchSup.id);
          }
        }
        if (res.ncm) setFormNcm(res.ncm);
        if (res.cest) setFormCest(res.cest);
        if (res.cfop) setFormCfop(res.cfop);
        if (res.unit) setFormUnit(res.unit);
        if (res.description && !formDescription) setFormDescription(res.description);
        if (res.kdsStation) setFormKdsStation(res.kdsStation);
        if (res.suggestedCategoryId) setFormCategoryId(res.suggestedCategoryId);
        if (res.costPrice !== undefined && res.costPrice !== null) {
          setFormCostPrice(String(res.costPrice));
        }
        if (res.suggestedPrice !== undefined && res.suggestedPrice !== null && !formPrice) {
          setFormPrice(String(res.suggestedPrice));
        }

        setLookupFeedback({
          type: 'success',
          message: res.message || `Produto "${res.name}" localizado com sucesso! Tributação e cadastro preenchidos.`
        });
      } else {
        if (res.code && !formCode) setFormCode(res.code);
        if (res.ncm && !formNcm) setFormNcm(res.ncm);
        if (res.cfop && !formCfop) setFormCfop(res.cfop);
        setLookupFeedback({
          type: 'info',
          message: res.message || 'Código válido. Complete os dados para cadastrar.'
        });
      }
    } catch (err: any) {
      setLookupFeedback({
        type: 'error',
        message: err.message || 'Falha ao consultar base tributária e de produtos.'
      });
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(formPrice);
    if (isNaN(price) || price < 0 || !formName.trim() || !formCategoryId) {
      alert('Preencha os campos obrigatórios (Nome, Preço e Categoria)');
      return;
    }

    try {
      let finalSupplier = formSupplier.trim() || null;
      let finalSupplierId = formSupplierId || null;
      if (!finalSupplier && finalSupplierId) {
        const sup = suppliers.find(s => s.id === finalSupplierId);
        if (sup) finalSupplier = sup.tradeName || sup.name;
      } else if (finalSupplier && !finalSupplierId) {
        const match = suppliers.find(s =>
          s.name.toLowerCase() === finalSupplier!.toLowerCase() ||
          (s.tradeName && s.tradeName.toLowerCase() === finalSupplier!.toLowerCase())
        );
        if (match) finalSupplierId = match.id;
      }

      const payload: any = {
        name: formName.trim(),
        code: formCode.trim() || null,
        ean: formEan.trim() || null,
        brand: formBrand.trim() || null,
        supplier: finalSupplier,
        supplierId: finalSupplierId,
        description: formDescription.trim() || null,
        price,
        costPrice: formCostPrice ? parseFloat(formCostPrice) : null,
        categoryId: formCategoryId,
        kdsStation: formKdsStation,
        stock: parseInt(formStock) || 0,
        minStock: parseInt(formMinStock) || 5,
        ncm: formNcm.trim() || null,
        cfop: formCfop.trim() || null,
        cest: formCest.trim() || null,
        unit: formUnit.trim() || 'un',
        components: isComposed ? formComponents.filter(c => c.componentId && parseFloat(c.quantity) > 0) : []
      };

      if (editingProduct) {
        await api.updateProduct(editingProduct.id, payload);
      } else {
        await api.createProduct(payload);
      }

      setShowProductModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar produto');
    }
  };

  const openCreateSupplierModal = () => {
    setEditingSupplier(null);
    setSupplierFormName('');
    setSupplierFormTradeName('');
    setSupplierFormDocument('');
    setSupplierFormIe('');
    setSupplierFormPhone('');
    setSupplierFormEmail('');
    setSupplierFormCity('');
    setSupplierFormState('');
    setSupplierFormAddress('');
    setSupplierFormContactName('');
    setSupplierFormNotes('');
    setShowSupplierFormModal(true);
  };

  const openEditSupplierModal = (s: Supplier) => {
    setEditingSupplier(s);
    setSupplierFormName(s.name || '');
    setSupplierFormTradeName(s.tradeName || '');
    setSupplierFormDocument(s.document || '');
    setSupplierFormIe(s.ie || '');
    setSupplierFormPhone(s.phone || '');
    setSupplierFormEmail(s.email || '');
    setSupplierFormCity(s.city || '');
    setSupplierFormState(s.state || '');
    setSupplierFormAddress(s.address || '');
    setSupplierFormContactName(s.contactName || '');
    setSupplierFormNotes(s.notes || '');
    setShowSupplierFormModal(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierFormName.trim()) {
      alert('Razão Social / Nome do fornecedor é obrigatório');
      return;
    }

    try {
      const payload: Partial<Supplier> = {
        name: supplierFormName.trim(),
        tradeName: supplierFormTradeName.trim() || null,
        document: supplierFormDocument.trim() || null,
        ie: supplierFormIe.trim() || null,
        phone: supplierFormPhone.trim() || null,
        email: supplierFormEmail.trim() || null,
        city: supplierFormCity.trim() || null,
        state: supplierFormState.trim() || null,
        address: supplierFormAddress.trim() || null,
        contactName: supplierFormContactName.trim() || null,
        notes: supplierFormNotes.trim() || null
      };

      if (editingSupplier) {
        await api.updateSupplier(editingSupplier.id, payload);
      } else {
        await api.createSupplier(payload);
      }

      setShowSupplierFormModal(false);
      const sups = await api.getSuppliers();
      setSuppliers(sups);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar fornecedor');
    }
  };

  const handleDeleteSupplier = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente excluir o fornecedor "${name}"?\nOs produtos continuarão no cardápio.`)) {
      return;
    }

    try {
      await api.deleteSupplier(id);
      const sups = await api.getSuppliers();
      setSuppliers(sups);
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir fornecedor');
    }
  };

  const handleSaveQuickSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSupplierName.trim()) {
      alert('Informe a Razão Social ou Nome do fornecedor');
      return;
    }

    try {
      const created = await api.createSupplier({
        name: quickSupplierName.trim(),
        tradeName: quickSupplierTradeName.trim() || null,
        document: quickSupplierDoc.trim() || null,
        phone: quickSupplierPhone.trim() || null
      });

      const sups = await api.getSuppliers();
      setSuppliers(sups);
      setFormSupplierId(created.id);
      setFormSupplier(created.tradeName || created.name);
      setShowQuickSupplierModal(false);
      setQuickSupplierName('');
      setQuickSupplierTradeName('');
      setQuickSupplierDoc('');
      setQuickSupplierPhone('');
    } catch (err: any) {
      alert(err.message || 'Erro ao cadastrar fornecedor rápido');
    }
  };

  const handleQuickStock = async (productId: string, adjustment: number) => {
    try {
      await api.adjustStock(productId, adjustment);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao ajustar estoque');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await fetch('/api/products/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCatName.trim(),
          icon: newCatIcon || 'Beer',
          codeStart: newCatCodeStart ? parseInt(newCatCodeStart, 10) : undefined
        })
      });
      setShowCategoryModal(false);
      setNewCatName('');
      setNewCatCodeStart('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao criar categoria');
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!window.confirm(`Deseja realmente EXCLUIR o produto "${productName}" do cardápio? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      setLoading(true);
      await api.deleteProduct(productId, true);
      setShowProductModal(false);
      setEditingProduct(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir produto');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (!window.confirm(`Deseja realmente EXCLUIR a categoria "${categoryName}"? Se houver produtos nesta categoria, confirme apenas se desejar apagá-los também.`)) {
      return;
    }

    try {
      setLoading(true);
      await api.deleteCategory(categoryId, true);
      if (selectedCategory === categoryId) setSelectedCategory('ALL');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir categoria');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === 'ALL' || p.categoryId === selectedCategory;
    const term = search.trim().toLowerCase();
    const matchSearch =
      term === '' ||
      p.name.toLowerCase().includes(term) ||
      (p.code && p.code.toLowerCase().includes(term)) ||
      (p.ean && p.ean.toLowerCase().includes(term)) ||
      (p.brand && p.brand.toLowerCase().includes(term)) ||
      (p.supplier && p.supplier.toLowerCase().includes(term)) ||
      (p.description && p.description.toLowerCase().includes(term));
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-4 pb-20 max-w-6xl mx-auto">
      {/* Cabeçalho */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Cardápio & Estoque</h2>
            <p className="text-xs text-slate-400">
              Controle de preços, códigos internos, EAN de barras e tributação fiscal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSuppliersModal(true)}
            className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700/50"
            title="Gerenciar Fornecedores Cadastrados"
          >
            <Truck className="w-4 h-4 text-emerald-400" />
            <span>Fornecedores</span>
            {suppliers.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-[10px] text-emerald-300 font-mono font-bold">
                {suppliers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowCategoryModal(true)}
            className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            <Tag className="w-4 h-4 text-purple-400" />
            <span>Nova Categoria</span>
          </button>

          <button
            onClick={openCreateModal}
            className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-amber-500/10 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Novo Produto</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, código interno (#BEB-01), EAN/barras, marca ou fornecedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedCategory === 'ALL'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            Todas ({products.length})
          </button>
          {categories.map((cat) => (
            <div
              key={cat.id}
              className={`inline-flex items-center gap-1 rounded-xl text-xs font-bold transition whitespace-nowrap pl-3 pr-1 py-1 ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <button
                onClick={() => setSelectedCategory(cat.id)}
                className="flex-1 text-left py-0.5"
              >
                {cat.name}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteCategory(cat.id, cat.name);
                }}
                className={`p-1 rounded-lg transition hover:bg-rose-600 hover:text-white ${
                  selectedCategory === cat.id ? 'text-slate-900/60 hover:text-white' : 'text-slate-400'
                }`}
                title={`Excluir categoria "${cat.name}"`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tabela / Lista de Produtos */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 uppercase text-[10px] tracking-wider text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Produto</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Destino KDS</th>
                <th className="py-3 px-4 text-right">Preço Venda</th>
                <th className="py-3 px-4 text-right">Custo</th>
                <th className="py-3 px-4 text-center">Estoque</th>
                <th className="py-3 px-4 text-right">Ajuste Rápido</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredProducts.map((p) => {
                const isLowStock = p.stock <= p.minStock;
                const margin = p.costPrice
                  ? Math.round(((p.price - p.costPrice) / p.price) * 100)
                  : null;

                return (
                  <tr key={p.id} className="hover:bg-slate-850/50 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white text-sm flex items-center gap-2 flex-wrap">
                        <span>{p.name}</span>
                        {p.code && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono" title="Código Interno">
                            #{p.code}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {p.brand && (
                          <span className="text-[11px] text-amber-400 font-medium">
                            {p.brand}
                          </span>
                        )}
                        {(p.supplierRel?.tradeName || p.supplierRel?.name || p.supplier) && (
                          <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/40" title="Fornecedor">
                            <Truck className="w-3 h-3 text-emerald-400" />
                            {p.supplierRel?.tradeName || p.supplierRel?.name || p.supplier}
                          </span>
                        )}
                        {p.ean && (
                          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 bg-slate-950/60 px-1.5 py-0.5 rounded border border-slate-800" title="Código de Barras EAN">
                            <Barcode className="w-3 h-3 text-slate-500" />
                            {p.ean}
                          </span>
                        )}
                        {p.description && (
                          <span className="text-[11px] text-slate-500 truncate max-w-xs">
                            • {p.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-[11px]">
                        {p.category?.name || 'Geral'}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          p.kdsStation === 'BAR'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        {p.kdsStation === 'BAR' ? <Beer className="w-3 h-3" /> : <ChefHat className="w-3 h-3" />}
                        {p.kdsStation === 'BAR' ? 'Bar' : 'Cozinha'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-400 text-sm whitespace-nowrap">
                      R$ {p.price.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400 whitespace-nowrap">
                      {p.costPrice ? `R$ ${p.costPrice.toFixed(2)}` : '-'}
                      {margin !== null && (
                        <span className="block text-[10px] text-emerald-400 font-sans">
                          {margin}% margem
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {p.components && p.components.length > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                          Composto (Ficha)
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                            isLowStock
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {isLowStock && <AlertTriangle className="w-3 h-3" />}
                          {p.stock} {p.unit}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {(!p.components || p.components.length === 0) && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleQuickStock(p.id, -1)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs"
                            title="-1 unidade"
                          >
                            -1
                          </button>
                          <button
                            onClick={() => handleQuickStock(p.id, 10)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 font-mono text-xs font-bold"
                            title="+10 unidades"
                          >
                            +10
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleDuplicateProduct(p)}
                          className="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg hover:bg-slate-800 transition"
                          title="Duplicar Produto (Gera novo código sequencial)"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                          title="Editar Produto"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id, p.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition"
                          title="Excluir Produto do Cardápio"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Criar/Editar Produto */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black text-white mb-4">
              {editingProduct ? 'Editar Produto' : 'Cadastrar Novo Produto'}
            </h3>

            {/* Bloco de Busca Inteligente por EAN / Código de Barras */}
            <div className="mb-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-900 border border-amber-500/30 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Preenchimento Automático por Código de Barras
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  EAN / GTIN / NF-e
                </span>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={formEan}
                    onChange={(e) => setFormEan(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleLookupEan();
                      }
                    }}
                    placeholder="Bipe ou digite o EAN (ex: 7894900010015)"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white font-mono text-xs focus:border-amber-500 focus:outline-none placeholder:text-slate-600"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleLookupEan()}
                  disabled={lookupLoading || !formEan.trim()}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:pointer-events-none text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition active:scale-95 whitespace-nowrap shadow-sm shadow-amber-500/20"
                >
                  {lookupLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>Puxar Dados</span>
                </button>
              </div>

              {lookupFeedback && (
                <div
                  className={`text-xs p-2.5 rounded-xl border flex items-start gap-2 ${
                    lookupFeedback.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : lookupFeedback.type === 'error'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  }`}
                >
                  <span className="text-xs leading-relaxed">{lookupFeedback.message}</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                    Nome do Item *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Cerveja Heineken Long Neck 330ml"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                    Código Interno
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: BEB-01"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm focus:border-amber-500 focus:outline-none uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                    Marca / Fabricante
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Heineken, Ambev, Coca-Cola"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold uppercase text-slate-400">
                      Fornecedor
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowQuickSupplierModal(true)}
                      className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 transition"
                    >
                      <Plus className="w-3 h-3" /> Novo
                    </button>
                  </div>
                  <select
                    value={formSupplierId}
                    onChange={(e) => {
                      const supId = e.target.value;
                      setFormSupplierId(supId);
                      const found = suppliers.find(s => s.id === supId);
                      if (found) {
                        setFormSupplier(found.tradeName || found.name);
                      } else if (!supId) {
                        setFormSupplier('');
                      }
                    }}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Selecione da lista cadastrada...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.tradeName ? `${s.tradeName} (${s.name})` : s.name} {s.document ? `• ${s.document}` : ''}
                      </option>
                    ))}
                  </select>
                  {!formSupplierId && (
                    <input
                      type="text"
                      placeholder="Ou digite o nome avulso..."
                      value={formSupplier}
                      onChange={(e) => setFormSupplier(e.target.value)}
                      className="w-full mt-1.5 px-3 py-1.5 bg-slate-950/70 border border-slate-800/80 rounded-lg text-slate-300 text-xs focus:border-amber-500 focus:outline-none placeholder:text-slate-600"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                  Descrição (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Refrescante, puro malte, colarinho cremoso..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                    Preço Venda (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="14.00"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                    Preço Custo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="4.50"
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                    Unidade
                  </label>
                  <input
                    type="text"
                    placeholder="un, lata, kg"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value.toLowerCase())}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none lowercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                    Categoria *
                  </label>
                  <select
                    value={formCategoryId}
                    onChange={async (e) => {
                      const newCatId = e.target.value;
                      setFormCategoryId(newCatId);
                      if (!editingProduct) {
                        try {
                          const res = await api.getNextProductCode(newCatId);
                          if (res?.nextCode) setFormCode(res.nextCode);
                        } catch {}
                      }
                    }}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                    Destino no KDS
                  </label>
                  <select
                    value={formKdsStation}
                    onChange={(e) => setFormKdsStation(e.target.value as KdsStation)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                  >
                    <option value="BAR">🍺 Barman (Bebidas)</option>
                    <option value="KITCHEN">🍳 Cozinha (Pratos/Petiscos)</option>
                    <option value="NONE">Nenhum (Direto)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                    Estoque Inicial
                  </label>
                  <input
                    type="number"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                    Estoque Mínimo (Alerta)
                  </label>
                  <input
                    type="number"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Dados Fiscais */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-300">
                    Dados Fiscais (NFC-e / Tributação)
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Preenchimento automático via API
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                      NCM
                    </label>
                    <input
                      type="text"
                      value={formNcm}
                      onChange={(e) => setFormNcm(e.target.value.replace(/\D/g, ''))}
                      placeholder="8 dígitos"
                      maxLength={8}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                      CEST
                    </label>
                    <input
                      type="text"
                      value={formCest}
                      onChange={(e) => setFormCest(e.target.value)}
                      placeholder="Ex: 03.001.00"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                      CFOP
                    </label>
                    <input
                      type="text"
                      value={formCfop}
                      onChange={(e) => setFormCfop(e.target.value.replace(/\D/g, ''))}
                      placeholder="5102 / 5405"
                      maxLength={4}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    checked={isComposed}
                    onChange={(e) => setIsComposed(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 focus:ring-amber-500 focus:ring-offset-slate-900"
                  />
                  <span className="text-sm font-bold text-slate-300">
                    Produto Composto (Ficha Técnica)
                  </span>
                </label>

                {isComposed && (
                  <div className="space-y-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                    <p className="text-xs text-slate-400">
                      Quando este item for vendido, o estoque dos componentes abaixo será descontado em vez do estoque deste produto.
                    </p>
                    
                    {formComponents.map((comp, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={comp.componentId}
                          onChange={(e) => {
                            const newComps = [...formComponents];
                            newComps[idx].componentId = e.target.value;
                            setFormComponents(newComps);
                          }}
                          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:border-amber-500 focus:outline-none"
                        >
                          <option value="">Selecione um ingrediente...</option>
                          {products.filter(p => p.id !== editingProduct?.id && !p.components?.length).map(p => (
                            <option key={p.id} value={p.id}>{p.name} (Estoque: {p.stock})</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Qtd"
                          value={comp.quantity}
                          onChange={(e) => {
                            const newComps = [...formComponents];
                            newComps[idx].quantity = e.target.value;
                            setFormComponents(newComps);
                          }}
                          className="w-20 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:border-amber-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newComps = [...formComponents];
                            newComps.splice(idx, 1);
                            setFormComponents(newComps);
                          }}
                          className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    
                    <button
                      type="button"
                      onClick={() => setFormComponents([...formComponents, { componentId: '', quantity: '1' }])}
                      className="w-full py-2 border border-dashed border-slate-700 text-slate-400 rounded-lg text-xs hover:bg-slate-800 hover:text-white transition"
                    >
                      + Adicionar Componente
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-3 flex gap-2">
                {editingProduct && (
                  <button
                    type="button"
                    onClick={() => handleDeleteProduct(editingProduct.id, editingProduct.name)}
                    className="py-3 px-4 rounded-xl font-bold text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition flex items-center gap-1.5 active:scale-95"
                    title="Excluir este produto"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Excluir</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 transition font-black active:scale-95"
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Criar Categoria */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-3">Nova Categoria</h3>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label htmlFor="formNameInput" className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                  Nome da Categoria *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Doces & Balas, Sobremesas"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                  id="formNameInput"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                  Faixa Numérica do Código (Opcional)
                </label>
                <input
                  type="number"
                  placeholder="Ex: 5001 para bebidas, 6001 para chicletes/balas"
                  value={newCatCodeStart}
                  onChange={(e) => setNewCatCodeStart(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm focus:border-amber-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Os produtos desta categoria receberão códigos sequenciais automáticos a partir deste número (ex: 6001, 6002...).
                </p>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-800 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 transition"
                >
                  Criar Categoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Gerenciar Fornecedores */}
      {showSuppliersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Cabeçalho */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Gestão de Fornecedores</h3>
                  <p className="text-xs text-slate-400">
                    Cadastre distribuidores, cervejarias e parceiros para vincular aos produtos e cruzar com NF-e
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={openCreateSupplierModal}
                  className="py-2 px-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-emerald-500/10 active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Novo Fornecedor</span>
                </button>
                <button
                  onClick={() => setShowSuppliersModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Barra de Busca de Fornecedores */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/50">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por Razão Social, Nome Fantasia, CNPJ, contato ou cidade..."
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Lista de Fornecedores */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(() => {
                const sTerm = supplierSearch.trim().toLowerCase();
                const filtered = suppliers.filter(s =>
                  sTerm === '' ||
                  s.name.toLowerCase().includes(sTerm) ||
                  (s.tradeName && s.tradeName.toLowerCase().includes(sTerm)) ||
                  (s.document && s.document.includes(sTerm)) ||
                  (s.city && s.city.toLowerCase().includes(sTerm)) ||
                  (s.contactName && s.contactName.toLowerCase().includes(sTerm))
                );

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-500">
                      <Truck className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
                      <p className="font-bold text-slate-400 text-sm">
                        {suppliers.length === 0 ? 'Nenhum fornecedor cadastrado ainda' : 'Nenhum fornecedor encontrado para esta busca'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        Fornecedores são cadastrados manualmente pelo botão acima ou importados automaticamente ao bipar XMLs de compra da SEFAZ.
                      </p>
                      {suppliers.length === 0 && (
                        <button
                          onClick={openCreateSupplierModal}
                          className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition"
                        >
                          + Cadastrar Primeiro Fornecedor
                        </button>
                      )}
                    </div>
                  );
                }

                return filtered.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 bg-slate-950 border border-slate-800 rounded-2xl hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-white text-sm">
                          {s.tradeName || s.name}
                        </span>
                        {s.tradeName && s.name && (
                          <span className="text-xs text-slate-400">
                            ({s.name})
                          </span>
                        )}
                        {s.document && (
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px] font-mono text-emerald-400">
                            {s.document.length === 14
                              ? s.document.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
                              : s.document}
                          </span>
                        )}
                        {s._count?.products !== undefined && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-bold">
                            {s._count.products} {s._count.products === 1 ? 'produto vinculado' : 'produtos vinculados'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                        {s.phone && (
                          <span className="flex items-center gap-1 text-slate-300">
                            <Phone className="w-3 h-3 text-emerald-400" />
                            {s.phone}
                          </span>
                        )}
                        {s.email && (
                          <span className="flex items-center gap-1 text-slate-300">
                            <Mail className="w-3 h-3 text-cyan-400" />
                            {s.email}
                          </span>
                        )}
                        {s.contactName && (
                          <span className="text-slate-400">
                            Contato: <strong className="text-slate-200">{s.contactName}</strong>
                          </span>
                        )}
                        {s.city && (
                          <span className="text-slate-400">
                            {s.city}{s.state ? ` - ${s.state}` : ''}
                          </span>
                        )}
                      </div>

                      {s.notes && (
                        <p className="text-[11px] text-slate-500 italic mt-0.5">
                          "{s.notes}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => openEditSupplierModal(s)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-xs font-bold flex items-center gap-1"
                        title="Editar Fornecedor"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                        <span className="hidden sm:inline">Editar</span>
                      </button>
                      <button
                        onClick={() => handleDeleteSupplier(s.id, s.tradeName || s.name)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition"
                        title="Excluir Fornecedor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal Formulário Completo de Fornecedor (Criar / Editar) */}
      {showSupplierFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-400" />
                <span>{editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}</span>
              </h3>
              <button
                onClick={() => setShowSupplierFormModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Razão Social / Nome Principal *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Cervejaria Ambev S.A. ou Distribuidora Modelo"
                  value={supplierFormName}
                  onChange={(e) => setSupplierFormName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Nome Fantasia
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Ambev Chopp"
                    value={supplierFormTradeName}
                    onChange={(e) => setSupplierFormTradeName(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    CNPJ ou CPF
                  </label>
                  <input
                    type="text"
                    placeholder="00.000.000/0000-00"
                    value={supplierFormDocument}
                    onChange={(e) => setSupplierFormDocument(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="(11) 98888-7777"
                    value={supplierFormPhone}
                    onChange={(e) => setSupplierFormPhone(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Inscrição Estadual (IE)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 123456789"
                    value={supplierFormIe}
                    onChange={(e) => setSupplierFormIe(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    placeholder="pedidos@fornecedor.com.br"
                    value={supplierFormEmail}
                    onChange={(e) => setSupplierFormEmail(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Contato / Vendedor
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Carlos Representante"
                    value={supplierFormContactName}
                    onChange={(e) => setSupplierFormContactName(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Cidade
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: São Paulo"
                    value={supplierFormCity}
                    onChange={(e) => setSupplierFormCity(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    UF
                  </label>
                  <input
                    type="text"
                    placeholder="SP"
                    maxLength={2}
                    value={supplierFormState}
                    onChange={(e) => setSupplierFormState(e.target.value.toUpperCase())}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Endereço
                </label>
                <input
                  type="text"
                  placeholder="Rua, número, bairro..."
                  value={supplierFormAddress}
                  onChange={(e) => setSupplierFormAddress(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Observações / Condições Comerciais
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Entrega às terças-feiras. Pedido mínimo R$ 500. Boleto 28 dias."
                  value={supplierFormNotes}
                  onChange={(e) => setSupplierFormNotes(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierFormModal(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/10"
                >
                  {editingSupplier ? 'Atualizar Fornecedor' : 'Salvar Fornecedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Rápido de Fornecedor (+ Novo direto do produto) */}
      {showQuickSupplierModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-black text-white mb-1 flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-400" />
              <span>Adicionar Fornecedor Rápido</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Cadastre e vincule este fornecedor imediatamente ao produto atual.
            </p>

            <form onSubmit={handleSaveQuickSupplier} className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Razão Social / Nome *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Cervejaria Heineken do Brasil"
                  value={quickSupplierName}
                  onChange={(e) => setQuickSupplierName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-amber-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Nome Fantasia
                </label>
                <input
                  type="text"
                  placeholder="Ex: Heineken"
                  value={quickSupplierTradeName}
                  onChange={(e) => setQuickSupplierTradeName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  CNPJ ou CPF (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="00.000.000/0000-00"
                  value={quickSupplierDoc}
                  onChange={(e) => setQuickSupplierDoc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Telefone / WhatsApp (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="(11) 99999-8888"
                  value={quickSupplierPhone}
                  onChange={(e) => setQuickSupplierPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickSupplierModal(false)}
                  className="flex-1 py-2 rounded-xl font-bold text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 transition"
                >
                  Vincular Agora
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
