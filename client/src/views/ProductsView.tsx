import React, { useState, useEffect } from 'react';
import { Product, Category, KdsStation } from '../types';
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
  Trash2, X
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
  const [formDescription, setFormDescription] = useState<string>('');
  const [formPrice, setFormPrice] = useState<string>('');
  const [formCostPrice, setFormCostPrice] = useState<string>('');
  const [formCategoryId, setFormCategoryId] = useState<string>('');
  const [formKdsStation, setFormKdsStation] = useState<KdsStation>('BAR');
  const [formStock, setFormStock] = useState<string>('100');
  const [formMinStock, setFormMinStock] = useState<string>('10');
  const [formComponents, setFormComponents] = useState<{ componentId: string; quantity: string }[]>([]);
  const [isComposed, setIsComposed] = useState<boolean>(false);


  // Modal Categoria
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatIcon, setNewCatIcon] = useState<string>('Beer');

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, cats] = await Promise.all([
        api.getProducts(),
        api.getCategories()
      ]);
      setProducts(prods);
      setCategories(cats);
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
    setFormDescription('');
    setFormPrice('');
    setFormCostPrice('');
    setFormKdsStation('BAR');
    setFormStock('100');
    setFormMinStock('10');
    setFormComponents([]);
    setIsComposed(false);
    if (categories.length > 0) setFormCategoryId(categories[0].id);
    setShowProductModal(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormDescription(p.description || '');
    setFormPrice(p.price.toString());
    setFormCostPrice(p.costPrice ? p.costPrice.toString() : '');
    setFormCategoryId(p.categoryId);
    setFormKdsStation(p.kdsStation);
    setFormStock(p.stock.toString());
    setFormMinStock(p.minStock.toString());
    if (p.components && p.components.length > 0) {
      setIsComposed(true);
      setFormComponents(p.components.map(c => ({ componentId: c.componentId, quantity: c.quantity.toString() })));
    } else {
      setIsComposed(false);
      setFormComponents([]);
    }
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(formPrice);
    if (isNaN(price) || price < 0 || !formName.trim() || !formCategoryId) {
      alert('Preencha os campos obrigatórios (Nome, Preço e Categoria)');
      return;
    }

    try {
      const payload: any = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        price,
        costPrice: formCostPrice ? parseFloat(formCostPrice) : null,
        categoryId: formCategoryId,
        kdsStation: formKdsStation,
        stock: parseInt(formStock) || 0,
        minStock: parseInt(formMinStock) || 5,
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
      await api.getCategories(); // check
      await fetch('/api/products/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim(), icon: newCatIcon })
      });
      setShowCategoryModal(false);
      setNewCatName('');
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
    const matchSearch =
      search.trim() === '' ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
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
              Controle de preços, insumos, ficha e baixa automática
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
            placeholder="Buscar por nome do produto..."
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
                      <div className="font-bold text-white text-sm">{p.name}</div>
                      {p.description && (
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">
                          {p.description}
                        </div>
                      )}
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

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label htmlFor="formNameInput" className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                  Nome do Item
                </label>
                <input
                  type="text"
                  required
                  id="formNameInput"
                  autoFocus
                  placeholder="Ex: Chope Pilsen 500ml"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="formNameInput" className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                  Descrição (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Refrescante, colarinho cremoso..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="formNameInput" className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                    Preço de Venda (R$)
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
                  <label htmlFor="formNameInput" className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                    Preço de Custo (R$)
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="formNameInput" className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
                    Categoria
                  </label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
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
                  <label htmlFor="formNameInput" className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
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
                  <label htmlFor="formNameInput" className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
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
                  <label htmlFor="formNameInput" className="block text-xs font-bold uppercase text-slate-400 mb-1 cursor-pointer">
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
                  Nome da Categoria
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Sobremesas, Vinhos"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-amber-500 focus:outline-none"
                  id="formNameInput"
                  autoFocus
                />
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
    </div>
  );
};
