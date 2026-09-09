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
  FileText,
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Layers,
  ShieldCheck,
  Check,
  HelpCircle,
  Calculator,
  Globe,
  UploadCloud
} from 'lucide-react';
import { ImportXmlModal } from '../components/ImportXmlModal';
import { NcmLookupModal } from '../components/NcmLookupModal';

export const ProductsView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [showImportXmlModal, setShowImportXmlModal] = useState<boolean>(false);
  const [organizingLoading, setOrganizingLoading] = useState<boolean>(false);
  const [isBackfilling, setIsBackfilling] = useState<boolean>(false);

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

  // Venda por Caixa / Fardo Fechado
  const [formHasBoxPrice, setFormHasBoxPrice] = useState<boolean>(false);
  const [formBoxQuantity, setFormBoxQuantity] = useState<string>('24');
  const [formBoxPrice, setFormBoxPrice] = useState<string>('');
  const [formBoxEan, setFormBoxEan] = useState<string>('');

  // EAN Lookup API
  const [lookupLoading, setLookupLoading] = useState<boolean>(false);
  const [lookupFeedback, setLookupFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Focus NFe NCM Lookup & Validation
  const [showNcmModal, setShowNcmModal] = useState<boolean>(false);
  const [ncmValidation, setNcmValidation] = useState<{ loading: boolean; valido?: boolean; descricao?: string; aliqNac?: number } | null>(null);

  useEffect(() => {
    const clean = formNcm.replace(/\D/g, '');
    if (clean.length === 8) {
      let active = true;
      setNcmValidation({ loading: true });
      fetch(`${api.getApiUrl()}/fiscal/ncm/${clean}`)
        .then(r => r.json())
        .then(d => {
          if (!active) return;
          if (d.valido) {
            setNcmValidation({ loading: false, valido: true, descricao: d.descricao, aliqNac: d.aliquotaNacional });
          } else {
            setNcmValidation({ loading: false, valido: false });
          }
        })
        .catch(() => {
          if (active) setNcmValidation(null);
        });
      return () => { active = false; };
    } else {
      setNcmValidation(null);
    }
  }, [formNcm]);

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

  const handleOrganizeBarKitchen = async () => {
    try {
      setOrganizingLoading(true);
      const res = await fetch(api.getApiUrl() + '/products/organize-bar-kitchen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        await loadData();
        alert(`✅ ${data.message || 'Produtos organizados com sucesso!'}`);
      } else {
        alert(`Erro: ${data.error || 'Falha ao organizar produtos'}`);
      }
    } catch (err: any) {
      alert(`Falha ao conectar com o servidor: ${err.message}`);
    } finally {
      setOrganizingLoading(false);
    }
  };

  const handleBackfillCodes = async () => {
    if (!confirm('Atribuir códigos internos sequenciais a todos os produtos que não têm código?\n\nEsta operação não altera produtos que já têm código.')) return;
    try {
      setIsBackfilling(true);
      const res = await fetch(api.getApiUrl() + '/products/backfill-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        await loadData();
        alert(data.mensagem || `✅ ${data.atualizados} produtos atualizados!`);
      } else {
        alert(`Erro: ${data.error || 'Falha ao gerar códigos'}`);
      }
    } catch (err: any) {
      alert(`Falha ao conectar com o servidor: ${err.message}`);
    } finally {
      setIsBackfilling(false);
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
    setFormHasBoxPrice(false);
    setFormBoxQuantity('24');
    setFormBoxPrice('');
    setFormBoxEan('');
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
    setFormHasBoxPrice(Boolean(p.hasBoxPrice));
    setFormBoxQuantity(p.boxQuantity ? String(p.boxQuantity) : '24');
    setFormBoxPrice(p.boxPrice ? String(p.boxPrice) : '');
    setFormBoxEan(p.boxEan || '');
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

  const [lookupLoadingMode, setLookupLoadingMode] = useState<'all' | 'xml' | 'global' | null>(null);

  const handleLookupEan = async (eanToSearch?: string, mode: 'all' | 'xml' | 'global' = 'all') => {
    const targetEan = (eanToSearch || formEan || '').trim();
    if (!targetEan) {
      setLookupFeedback({ type: 'error', message: 'Digite ou bipe o Código de Barras (EAN).' });
      return;
    }

    try {
      setLookupLoading(true);
      setLookupLoadingMode(mode);
      setLookupFeedback(null);
      const res = await api.lookupProductByEan(targetEan, mode);

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
      setLookupLoadingMode(null);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceStr = formPrice.replace(',', '.');
    const price = parseFloat(priceStr);
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

      const parsedCost = formCostPrice ? parseFloat(formCostPrice.replace(',', '.')) : null;
      const parsedStock = parseFloat(formStock.replace(',', '.')) || 0;
      const parsedMinStock = parseFloat(formMinStock.replace(',', '.')) || 5;

      const payload: any = {
        name: formName.trim(),
        code: formCode.trim() || null,
        ean: formEan.trim() || null,
        brand: formBrand.trim() || null,
        supplier: finalSupplier,
        supplierId: finalSupplierId,
        description: formDescription.trim() || null,
        price,
        costPrice: parsedCost,
        categoryId: formCategoryId,
        kdsStation: formKdsStation,
        stock: parsedStock,
        minStock: parsedMinStock,
        ncm: formNcm.trim() || null,
        cfop: formCfop.trim() || null,
        cest: formCest.trim() || null,
        unit: formUnit.trim() || 'un',
        hasBoxPrice: formHasBoxPrice,
        boxQuantity: formHasBoxPrice ? parseInt(formBoxQuantity || '24', 10) : null,
        boxPrice: formHasBoxPrice && formBoxPrice ? parseFloat(formBoxPrice.replace(',', '.')) : null,
        boxEan: formHasBoxPrice && formBoxEan.trim() ? formBoxEan.trim() : null,
        components: isComposed ? formComponents.filter(c => c.componentId && parseFloat((c.quantity || '0').replace(',', '.')) > 0).map(c => ({
          componentId: c.componentId,
          quantity: parseFloat(c.quantity.replace(',', '.'))
        })) : []
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
      Boolean(p.name && p.name.toLowerCase().includes(term)) ||
      Boolean(p.code && p.code.toLowerCase().includes(term)) ||
      Boolean(p.ean && p.ean.toLowerCase().includes(term)) ||
      Boolean(p.brand && p.brand.toLowerCase().includes(term)) ||
      Boolean(p.supplier && p.supplier.toLowerCase().includes(term)) ||
      Boolean(p.description && p.description.toLowerCase().includes(term));
    return matchCat && matchSearch;
  });

  // Rentabilidade em Tempo Real (Suporta tanto ponto quanto vírgula)
  const vPrice = parseFloat((formPrice || '0').replace(',', '.')) || 0;
  const cPrice = parseFloat((formCostPrice || '0').replace(',', '.')) || 0;
  const grossProfit = vPrice - cPrice;
  const profitMargin = vPrice > 0 ? ((vPrice - cPrice) / vPrice) * 100 : 0;
  const markup = cPrice > 0 ? ((vPrice - cPrice) / cPrice) * 100 : 0;

  // Custo Total Estimado da Ficha Técnica
  const recipeCost = formComponents.reduce((acc, comp) => {
    const prod = products.find(p => p.id === comp.componentId);
    const qty = parseFloat((comp.quantity || '0').replace(',', '.')) || 0;
    const unitCost = (prod?.costPrice && prod.costPrice > 0) ? prod.costPrice : (prod?.price || 0);
    return acc + (unitCost * qty);
  }, 0);

  return (
    <>
      {showProductModal ? (
        /* TELA INTEIRA DE CADASTRO / EDIÇÃO DE PRODUTO */
        <div className="space-y-6 pb-28 max-w-6xl w-full mx-auto animate-in fade-in duration-200">
          {/* Cabeçalho Superior */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-sm dark:shadow-xl">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-2xl transition border border-slate-200 dark:border-slate-700/60 active:scale-95 group cursor-pointer"
                title="Voltar para a Lista de Produtos"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
              </button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">
                    {editingProduct ? `Editar: ${editingProduct.name}` : 'Cadastrar Novo Produto'}
                  </h2>
                  {editingProduct ? (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 text-xs font-mono font-bold">
                      {editingProduct.code ? `#${editingProduct.code}` : 'SEM CÓDIGO'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 text-xs font-bold">
                      NOVO ITEM
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {editingProduct
                    ? 'Atualize preços, custos, estoque, fornecedor e regras tributárias'
                    : 'Preencha o cadastro completo com automação de código de barras, tributação e custos'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end">
              {editingProduct && (
                <button
                  type="button"
                  onClick={() => handleDeleteProduct(editingProduct.id, editingProduct.name)}
                  className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
                  title="Excluir este produto permanentemente"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Excluir</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveProduct}
                className="py-2.5 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Salvar Produto</span>
              </button>
            </div>
          </div>

          {/* Bloco de Busca Inteligente por EAN / Código de Barras */}
          <div className="bg-gradient-to-r from-amber-500/10 via-slate-50 to-white dark:from-amber-500/10 dark:via-slate-900 dark:to-slate-900 border border-amber-300/80 dark:border-amber-500/30 rounded-3xl p-6 shadow-sm dark:shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Preenchimento Automático por Código de Barras</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold font-mono">
                      EAN / GTIN / SEFAZ
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Bipe com leitor USB ou digite o EAN para cruzar com notas recebidas na SEFAZ e catálogo nacional (nome, marca, fornecedor, NCM, CEST e custo).
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-1">
              <div className="relative w-full">
                <Barcode className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="prod-form-ean"
                  type="text"
                  value={formEan}
                  onChange={(e) => setFormEan(e.target.value.trim())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleLookupEan(undefined, 'all');
                    }
                  }}
                  placeholder="Bipe com o leitor ou digite o código de barras EAN (ex: 7896045506040)..."
                  className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white font-mono text-sm focus:border-amber-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 cursor-text shadow-inner"
                />
              </div>

              <div className="flex flex-wrap sm:flex-nowrap gap-2.5">
                {/* Botão 1: Notas Fiscais Importadas (XML) */}
                <button
                  type="button"
                  onClick={() => handleLookupEan(undefined, 'xml')}
                  disabled={lookupLoading || !formEan.trim()}
                  title="Puxa nome, fornecedor, NCM, CEST e preço de custo real das notas XML já importadas no sistema"
                  className="flex-1 min-w-[200px] py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition active:scale-95 shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  {lookupLoading && lookupLoadingMode === 'xml' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <FileText className="w-4 h-4 text-emerald-200" />
                  )}
                  <span>Puxar das Notas (XML)</span>
                </button>

                {/* Botão 2: Catálogo Global / GTIN */}
                <button
                  type="button"
                  onClick={() => handleLookupEan(undefined, 'global')}
                  disabled={lookupLoading || !formEan.trim()}
                  title="Puxa nome de produto e infere tributação oficial (NCM, CEST, CFOP) do catálogo nacional e global"
                  className="flex-1 min-w-[200px] py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition active:scale-95 shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  {lookupLoading && lookupLoadingMode === 'global' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Globe className="w-4 h-4 text-blue-200" />
                  )}
                  <span>Puxar Catálogo Global</span>
                </button>

                {/* Botão 3: Busca Inteligente Combinada */}
                <button
                  type="button"
                  onClick={() => handleLookupEan(undefined, 'all')}
                  disabled={lookupLoading || !formEan.trim()}
                  title="Procura primeiro nas notas recebidas e, caso não encontre, recorre ao catálogo global"
                  className="px-4 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:pointer-events-none text-slate-950 font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md shadow-amber-500/20 whitespace-nowrap cursor-pointer"
                >
                  {lookupLoading && lookupLoadingMode === 'all' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>Busca Geral</span>
                </button>
              </div>
            </div>

            {lookupFeedback && (
              <div
                className={`text-xs p-3 rounded-xl border flex items-start gap-2.5 animate-in fade-in ${
                  lookupFeedback.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                    : lookupFeedback.type === 'error'
                    ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300'
                    : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300'
                }`}
              >
                <span className="text-xs leading-relaxed">{lookupFeedback.message}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSaveProduct} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* COLUNA ESQUERDA (7 colunas) */}
              <div className="lg:col-span-7 space-y-6">
                {/* Card 1: Identificação do Produto */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <Tag className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                    <h3 className="text-base font-black text-slate-900 dark:text-white">Identificação & Básico</h3>
                  </div>

                  <div>
                    <label htmlFor="prod-form-name" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5 cursor-pointer">
                      Nome do Item / Produto *
                    </label>
                    <input
                      id="prod-form-name"
                      type="text"
                      required
                      autoFocus
                      placeholder="Ex: Cerveja Heineken Long Neck 330ml"
                      value={formName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormName(val);
                        // Auto-direcionar para o Bar se o item contiver volume em ml ou litros
                        if (/\b\d+(?:[.,]\d+)?\s*(?:ml|m\.l\.)\b/i.test(val) || /\b\d+(?:[.,]\d+)?\s*(?:l|lt|litro|litros)\b/i.test(val)) {
                          setFormKdsStation('BAR');
                          const barCat = categories.find(c => c.name.toLowerCase() === 'bar');
                          if (barCat && (!formCategoryId || categories.find(c => c.id === formCategoryId)?.name.toLowerCase() === 'cozinha')) {
                            setFormCategoryId(barCat.id);
                          }
                        }
                      }}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-base font-bold focus:border-amber-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 cursor-text shadow-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="prod-form-code" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5 cursor-pointer">
                        Código Interno (#)
                      </label>
                      <input
                        id="prod-form-code"
                        type="text"
                        placeholder="Ex: 5001 ou BEB-01"
                        value={formCode}
                        onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-sm focus:border-amber-500 focus:outline-none uppercase placeholder:text-slate-400 dark:placeholder:text-slate-600 cursor-text shadow-xs"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Sequencial por categoria ou código de referência interno.
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="prod-form-category" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 cursor-pointer">
                          Categoria *
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowCategoryModal(true)}
                          className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> Nova
                        </button>
                      </div>
                      <select
                        id="prod-form-category"
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
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-amber-500 focus:outline-none cursor-pointer shadow-xs"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.codeStart ? `(Faixa #${c.codeStart})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="prod-form-brand" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5 cursor-pointer">
                        Marca / Fabricante
                      </label>
                      <input
                        id="prod-form-brand"
                        type="text"
                        placeholder="Ex: Heineken, Ambev, Coca-Cola"
                        value={formBrand}
                        onChange={(e) => setFormBrand(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-amber-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 cursor-text shadow-xs"
                      />
                    </div>

                    <div>
                      <label htmlFor="prod-form-unit" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5 cursor-pointer">
                        Unidade de Medida
                      </label>
                      <input
                        id="prod-form-unit"
                        type="text"
                        placeholder="un, lata, garrafa, dose..."
                        value={formUnit}
                        onChange={(e) => setFormUnit(e.target.value.toLowerCase())}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-amber-500 focus:outline-none lowercase placeholder:text-slate-400 dark:placeholder:text-slate-600 cursor-text shadow-xs"
                      />
                      <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-500 mr-0.5">Sugestões:</span>
                        {['un', 'lata', 'garrafa', 'dose', 'copo', 'torre', 'porção', 'kg', 'l'].map(u => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setFormUnit(u)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                              formUnit.toLowerCase() === u
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="prod-form-desc" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5 cursor-pointer">
                      Descrição / Ingredientes (Exibido no Cardápio)
                    </label>
                    <textarea
                      id="prod-form-desc"
                      rows={2}
                      placeholder="Ex: Chopp puro malte artesanal com lúpulos aromáticos. Teor alcoólico 5.0%..."
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-amber-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 resize-none cursor-text shadow-xs"
                    />
                  </div>
                </div>

                {/* Card 2: Formação de Preço & Custos */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <DollarSign className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                    <h3 className="text-base font-black text-slate-900 dark:text-white">Preços, Custos & Rentabilidade</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="prod-form-price" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5 cursor-pointer">
                        Preço de Venda (R$) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none select-none">
                          R$
                        </span>
                        <input
                          id="prod-form-price"
                          type="text"
                          inputMode="decimal"
                          required
                          placeholder="14,00"
                          value={formPrice}
                          onChange={(e) => setFormPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-lg font-bold focus:border-amber-500 focus:outline-none cursor-text shadow-xs"
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Valor cobrado do cliente na comanda / mesa.
                      </span>
                    </div>

                    <div>
                      <label htmlFor="prod-form-cost" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5 cursor-pointer">
                        Preço de Custo (R$)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none select-none">
                          R$
                        </span>
                        <input
                          id="prod-form-cost"
                          type="text"
                          inputMode="decimal"
                          placeholder="4,50"
                          value={formCostPrice}
                          onChange={(e) => setFormCostPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-lg font-bold focus:border-amber-500 focus:outline-none cursor-text shadow-xs"
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Valor pago ao distribuidor ou soma dos insumos.
                      </span>
                    </div>
                  </div>

                  {/* Widget de Rentabilidade em Tempo Real */}
                  <div className="bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                        Simulador de Margem Comercial em Tempo Real
                      </span>
                      {isComposed && recipeCost > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormCostPrice(recipeCost.toFixed(2))}
                          className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 flex items-center gap-1 transition cursor-pointer"
                          title="Copiar custo calculado dos ingredientes da receita para o campo Preço de Custo"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Usar Custo da Receita (R$ {recipeCost.toFixed(2)})
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 shadow-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                          Lucro Bruto
                        </span>
                        <span className={`text-base font-black font-mono ${grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          R$ {grossProfit.toFixed(2)}
                        </span>
                      </div>

                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 shadow-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                          Margem de Lucro
                        </span>
                        <span className={`text-base font-black font-mono ${
                          profitMargin >= 50 ? 'text-emerald-600 dark:text-emerald-400' : profitMargin >= 25 ? 'text-amber-600 dark:text-amber-400' : profitMargin > 0 ? 'text-orange-500 dark:text-orange-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {vPrice > 0 ? `${profitMargin.toFixed(1)}%` : '0.0%'}
                        </span>
                      </div>

                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 shadow-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                          Markup s/ Custo
                        </span>
                        <span className="text-base font-black font-mono text-slate-800 dark:text-slate-200">
                          {cPrice > 0 ? `+${markup.toFixed(1)}%` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Especial: Venda por Caixa / Fardo Fechado */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <Package className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                      <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white">Venda por Caixa / Fardo Fechado</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Permite alternar entre preço avulso e preço de caixa no Caixa (PDV) e Mesas</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formHasBoxPrice}
                        onChange={(e) => setFormHasBoxPrice(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>

                  {formHasBoxPrice && (
                    <div className="space-y-4 bg-slate-50 dark:bg-slate-950/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5 cursor-pointer">
                            Qtd de Unidades por Caixa *
                          </label>
                          <input
                            type="number"
                            min="2"
                            max="500"
                            placeholder="Ex: 6, 12, 15, 24"
                            value={formBoxQuantity}
                            onChange={(e) => setFormBoxQuantity(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-sm focus:border-amber-500 focus:outline-none cursor-text shadow-xs"
                          />
                          <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
                            <span className="text-[10px] uppercase font-bold text-slate-500 mr-0.5">Comuns:</span>
                            {['6', '12', '15', '24', '30'].map(q => (
                              <button
                                key={q}
                                type="button"
                                onClick={() => setFormBoxQuantity(q)}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                  formBoxQuantity === q
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                                }`}
                              >
                                {q} un
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5 cursor-pointer">
                            Preço Total da Caixa (R$) *
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none select-none">
                              R$
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="216,00"
                              value={formBoxPrice}
                              onChange={(e) => setFormBoxPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
                              className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-base font-bold focus:border-amber-500 focus:outline-none cursor-text shadow-xs"
                            />
                          </div>
                          {(() => {
                            const bQty = parseInt(formBoxQuantity, 10) || 0;
                            const bPr = parseFloat((formBoxPrice || '0').replace(',', '.')) || 0;
                            if (bQty > 0 && bPr > 0) {
                              const unitInBox = bPr / bQty;
                              const unitOriginal = parseFloat((formPrice || '0').replace(',', '.')) || 0;
                              const diff = unitOriginal - unitInBox;
                              return (
                                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 block">
                                  Sai a <strong>R$ {unitInBox.toFixed(2)}</strong> por unidade {diff > 0 ? `(Economia de R$ ${diff.toFixed(2)}/un)` : ''}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5 cursor-pointer">
                          Código de Barras da Caixa (DUN-14 / EAN da Caixa Fechada)
                        </label>
                        <div className="relative">
                          <Barcode className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            placeholder="Opcional: bipe a caixa fechada para adicionar no caixa direto como caixa"
                            value={formBoxEan}
                            onChange={(e) => setFormBoxEan(e.target.value.trim())}
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-xs focus:border-amber-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 cursor-text shadow-xs"
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Ao bipar este código no Caixa, o sistema seleciona automaticamente a Caixa Fechada e desconta as {formBoxQuantity || 24} unidades do estoque avulso.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card 3: Ficha Técnica & Produto Composto */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <Layers className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                      <h3 className="text-base font-black text-slate-900 dark:text-white">Ficha Técnica & Composição (Receita)</h3>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isComposed}
                        onChange={(e) => setIsComposed(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Ative caso este item seja produzido no estabelecimento (ex: <strong>Torre de Chopp</strong> descontando litros do barril, <strong>Cocktails & Drinks</strong> descontando doses, <strong>Pizzas, Pratos e Porções</strong> descontando insumos).
                  </p>

                  {isComposed && (
                    <div className="space-y-3 bg-slate-50 dark:bg-slate-950/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                          Ingredientes / Insumos que Compõem Este Item:
                        </span>
                        {recipeCost > 0 && (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                            Custo Somado: R$ {recipeCost.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {formComponents.map((comp, idx) => {
                        const selProd = products.find(p => p.id === comp.componentId);
                        const cCost = selProd?.costPrice || selProd?.price || 0;
                        const cQty = parseFloat((comp.quantity || '0').replace(',', '.')) || 0;
                        const subtotal = cCost * cQty;

                        return (
                          <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl shadow-xs">
                            <select
                              value={comp.componentId}
                              onChange={(e) => {
                                const newComps = [...formComponents];
                                newComps[idx].componentId = e.target.value;
                                setFormComponents(newComps);
                              }}
                              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none cursor-pointer"
                            >
                              <option value="">Selecione um insumo do estoque...</option>
                              {products.filter(p => p.id !== editingProduct?.id && !p.components?.length).map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (Estoque: {p.stock} {p.unit || 'un'}) {p.costPrice ? `• Custo R$ ${p.costPrice.toFixed(2)}` : ''}
                                </option>
                              ))}
                            </select>

                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700">
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold select-none">Qtd:</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="1.0"
                                  value={comp.quantity}
                                  onChange={(e) => {
                                    const newComps = [...formComponents];
                                    newComps[idx].quantity = e.target.value.replace(/[^0-9.,]/g, '');
                                    setFormComponents(newComps);
                                  }}
                                  className="w-16 bg-transparent text-slate-900 dark:text-white font-mono text-xs focus:outline-none text-right font-bold cursor-text"
                                />
                                <span className="text-[10px] text-slate-500 font-mono select-none">
                                  {selProd?.unit || 'un'}
                                </span>
                              </div>

                              {subtotal > 0 && (
                                <span className="text-[11px] text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap min-w-16 text-right">
                                  = R$ {subtotal.toFixed(2)}
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  const newComps = [...formComponents];
                                  newComps.splice(idx, 1);
                                  setFormComponents(newComps);
                                }}
                                className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                                title="Remover este insumo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => setFormComponents([...formComponents, { componentId: '', quantity: '1' }])}
                        className="w-full py-2.5 border border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500/50 text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-900 transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar Insumo / Ingrediente
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* COLUNA DIREITA (5 colunas) */}
              <div className="lg:col-span-5 space-y-6">
                {/* Card 4: Fornecedor & Distribuidora */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <Truck className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                      <h3 className="text-base font-black text-slate-900 dark:text-white">Fornecedor & Compras</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowQuickSupplierModal(true)}
                      className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Novo
                    </button>
                  </div>

                  <div>
                    <label htmlFor="prod-form-supplier-id" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5 cursor-pointer">
                      Selecionar Fornecedor Cadastrado
                    </label>
                    <select
                      id="prod-form-supplier-id"
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
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-amber-500 focus:outline-none cursor-pointer shadow-xs"
                    >
                      <option value="">Nenhum fornecedor vinculado</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.tradeName ? `${s.tradeName} (${s.name})` : s.name} {s.document ? `• ${s.document}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formSupplierId && (() => {
                    const sel = suppliers.find(s => s.id === formSupplierId);
                    if (!sel) return null;
                    return (
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 text-xs text-slate-600 dark:text-slate-400">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white text-xs">{sel.tradeName || sel.name}</span>
                          {sel.document && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400">
                              {sel.document}
                            </span>
                          )}
                        </div>
                        {sel.contactName && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">Contato: {sel.contactName}</p>
                        )}
                        {sel.phone && (
                          <a
                            href={`https://wa.me/55${sel.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 font-bold text-xs mt-1 cursor-pointer"
                          >
                            <Phone className="w-3.5 h-3.5" /> Falar no WhatsApp ({sel.phone})
                          </a>
                        )}
                      </div>
                    );
                  })()}

                  {!formSupplierId && (
                    <div>
                      <label htmlFor="prod-form-supplier-name" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1 cursor-pointer">
                        Ou Nome Avulso do Fornecedor
                      </label>
                      <input
                        id="prod-form-supplier-name"
                        type="text"
                        placeholder="Ex: Distribuidora Central, Padaria São Paulo..."
                        value={formSupplier}
                        onChange={(e) => setFormSupplier(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-300 text-xs focus:border-amber-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 cursor-text shadow-xs"
                      />
                    </div>
                  )}
                </div>

                {/* Card 5: Estoque & Destino no KDS */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <Package className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                    <h3 className="text-base font-black text-slate-900 dark:text-white">Estoque & Destino KDS</h3>
                  </div>

                  <div>
                    <label htmlFor="prod-form-kds" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5 cursor-pointer">
                      Destino da Comanda no KDS
                    </label>
                    <select
                      id="prod-form-kds"
                      value={formKdsStation}
                      onChange={(e) => setFormKdsStation(e.target.value as KdsStation)}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-amber-500 focus:outline-none cursor-pointer shadow-xs"
                    >
                      <option value="BAR">🍺 Barman / Balcão (Bebidas, Chopp, Doses)</option>
                      <option value="KITCHEN">🍳 Cozinha (Pratos, Petiscos, Pizzas, Lanches)</option>
                      <option value="NONE">📦 Direto / Sem KDS (Entrega imediata)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="prod-form-stock" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5 cursor-pointer">
                        Estoque Atual
                      </label>
                      <input
                        id="prod-form-stock"
                        type="text"
                        inputMode="decimal"
                        value={formStock}
                        onChange={(e) => setFormStock(e.target.value.replace(/[^0-9.,]/g, ''))}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-base font-bold focus:border-amber-500 focus:outline-none cursor-text shadow-xs"
                      />
                    </div>

                    <div>
                      <label htmlFor="prod-form-min-stock" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5 cursor-pointer">
                        Estoque Mínimo
                      </label>
                      <input
                        id="prod-form-min-stock"
                        type="text"
                        inputMode="decimal"
                        value={formMinStock}
                        onChange={(e) => setFormMinStock(e.target.value.replace(/[^0-9.,]/g, ''))}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-base font-bold focus:border-amber-500 focus:outline-none cursor-text shadow-xs"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Alerta de reposição.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 6: Dados Fiscais (NFC-e / SAT) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
                      <h3 className="text-base font-black text-slate-900 dark:text-white">Tributação Fiscal (NFC-e / SAT)</h3>
                    </div>
                    <span className="text-[10px] text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-500/20 font-bold">
                      SEFAZ
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Estes códigos fiscais são transmitidos à SEFAZ em cada venda na NFC-e para evitar bitributação e rejeições.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="prod-form-ncm" className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 cursor-pointer">
                          NCM (8 dígitos)
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowNcmModal(true)}
                          className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold underline cursor-pointer"
                        >
                          Buscar NCM
                        </button>
                      </div>
                      <input
                        id="prod-form-ncm"
                        type="text"
                        value={formNcm}
                        onChange={(e) => setFormNcm(e.target.value.replace(/\D/g, ''))}
                        placeholder="Ex: 22030000"
                        maxLength={8}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-xs focus:border-amber-500 focus:outline-none cursor-text shadow-xs"
                      />
                      {ncmValidation && (
                        <div className="mt-1">
                          {ncmValidation.loading ? (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Verificando na Receita...
                            </span>
                          ) : ncmValidation.valido ? (
                            <div className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded p-1">
                              <p className="font-semibold line-clamp-1">✓ {ncmValidation.descricao}</p>
                              {ncmValidation.aliqNac !== undefined && (
                                <p className="text-[9px] text-emerald-800/80 dark:text-emerald-300/80">IBPT: {ncmValidation.aliqNac}%</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" /> NCM não localizado
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label htmlFor="prod-form-cest" className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5 cursor-pointer">
                        CEST (Subst. Tributária)
                      </label>
                      <input
                        id="prod-form-cest"
                        type="text"
                        value={formCest}
                        onChange={(e) => setFormCest(e.target.value)}
                        placeholder="Ex: 03.001.00"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-xs focus:border-amber-500 focus:outline-none cursor-text shadow-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="prod-form-cfop" className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1.5 cursor-pointer">
                      CFOP
                    </label>
                    <input
                      id="prod-form-cfop"
                      type="text"
                      value={formCfop}
                      onChange={(e) => setFormCfop(e.target.value.replace(/\D/g, ''))}
                      placeholder="5102 / 5405 / 5101"
                      maxLength={4}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-xs focus:border-amber-500 focus:outline-none cursor-text shadow-xs"
                    />
                    <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-500 mr-0.5">Padrões:</span>
                      {[
                        { code: '5102', label: '5102 (Revenda Normal)' },
                        { code: '5405', label: '5405 (Subst. Tributária ST)' },
                        { code: '5101', label: '5101 (Produção Própria)' }
                      ].map(item => (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => setFormCfop(item.code)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                            formCfop === item.code
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rodapé Fixo de Ações (Sticky Bottom Bar) */}
            <div className="sticky bottom-4 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-xl dark:shadow-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 font-black">
                  R$
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900 dark:text-white truncate max-w-xs">
                      {formName || 'Novo Produto'}
                    </span>
                    {formCode && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                        #{formCode}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>Venda: <strong className="text-slate-900 dark:text-white">R$ {vPrice.toFixed(2)}</strong></span>
                    {cPrice > 0 && (
                      <span>Custo: <strong className="text-slate-700 dark:text-slate-300">R$ {cPrice.toFixed(2)}</strong></span>
                    )}
                    {vPrice > 0 && cPrice > 0 && (
                      <span className={profitMargin >= 50 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : profitMargin >= 20 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                        Margem: {profitMargin.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 justify-end">
                {editingProduct && (
                  <button
                    type="button"
                    onClick={() => handleDeleteProduct(editingProduct.id, editingProduct.name)}
                    className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Excluir</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-sm font-black transition flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-4 pb-20 max-w-6xl mx-auto">
      {/* Cabeçalho */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm dark:shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Cardápio & Estoque</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Controle de preços, códigos internos, EAN de barras e tributação fiscal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => setShowImportXmlModal(true)}
            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 dark:border-slate-700/50 cursor-pointer"
            title="Importar produtos, categorias e fornecedores de arquivo XML"
          >
            <UploadCloud className="w-4 h-4 text-sky-500 dark:text-sky-400" />
            <span>Importar XML</span>
          </button>

          <button
            onClick={handleOrganizeBarKitchen}
            disabled={organizingLoading}
            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 dark:border-slate-700/50 disabled:opacity-50 cursor-pointer"
            title="Classifica automaticamente produtos com volume em ml para o Bar e alimentos para a Cozinha"
          >
            {organizingLoading ? (
              <Loader2 className="w-4 h-4 text-amber-500 dark:text-amber-400 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            )}
            <span>Organizar Bar (ml) / Cozinha</span>
          </button>

          <button
            onClick={() => setShowSuppliersModal(true)}
            className="py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 dark:border-slate-700/50 cursor-pointer"
            title="Gerenciar Fornecedores Cadastrados"
          >
            <Truck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            <span>Fornecedores</span>
            {suppliers.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-md bg-emerald-500/10 dark:bg-emerald-500/20 text-[10px] text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                {suppliers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowCategoryModal(true)}
            className="py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Tag className="w-4 h-4 text-purple-500 dark:text-purple-400" />
            <span>Nova Categoria</span>
          </button>

          <button
            onClick={handleBackfillCodes}
            disabled={isBackfilling}
            title="Atribuir códigos internos sequenciais a todos os produtos sem código"
            className="py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isBackfilling
              ? <><span className="animate-spin">⟳</span> <span>Gerando...</span></>
              : <><span className="text-sky-500 dark:text-sky-400 font-mono text-sm">#</span> <span>Gerar Códigos</span></>
            }
          </button>

          <button
            onClick={openCreateModal}
            className="py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-amber-500/10 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Novo Produto</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-3 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, código interno (#BEB-01), EAN/barras, marca ou fornecedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent'
            }`}
          >
            Todas ({products.length})
          </button>
          {categories.map((cat) => (
            <div
              key={cat.id}
              className={`inline-flex items-center gap-1 rounded-xl text-xs font-bold transition whitespace-nowrap pl-3 pr-1 py-1 cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent'
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm dark:shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-950/80 uppercase text-[10px] tracking-wider text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
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
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {filteredProducts.map((p) => {
                const isLowStock = p.stock <= p.minStock;
                const margin = p.costPrice
                  ? Math.round(((p.price - p.costPrice) / p.price) * 100)
                  : null;

                return (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition">
                    <td className="py-3 px-4 cursor-pointer group" onClick={() => openEditModal(p)} title="Clique para abrir e editar este produto">
                      <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2 flex-wrap group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
                        <span>{p.name}</span>
                        {p.code && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-mono" title="Código Interno">
                            #{p.code}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {p.brand && (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                            {p.brand}
                          </span>
                        )}
                        {(p.supplierRel?.tradeName || p.supplierRel?.name || p.supplier) && (
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40" title="Fornecedor">
                            <Truck className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                            {p.supplierRel?.tradeName || p.supplierRel?.name || p.supplier}
                          </span>
                        )}
                        {p.ean && (
                          <span className="text-[10px] text-slate-600 dark:text-slate-400 font-mono flex items-center gap-1 bg-slate-100 dark:bg-slate-950/60 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800" title="Código de Barras EAN">
                            <Barcode className="w-3 h-3 text-slate-400 dark:text-slate-500" />
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
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]">
                        {p.category?.name || 'Geral'}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          p.kdsStation === 'BAR'
                            ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
                            : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                        }`}
                      >
                        {p.kdsStation === 'BAR' ? <Beer className="w-3 h-3" /> : <ChefHat className="w-3 h-3" />}
                        {p.kdsStation === 'BAR' ? 'Bar' : 'Cozinha'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-600 dark:text-amber-400 text-sm whitespace-nowrap">
                      <div>R$ {p.price.toFixed(2)}</div>
                      {p.hasBoxPrice && p.boxPrice && (
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans font-normal mt-0.5 flex items-center justify-end gap-1">
                          <Package className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                          <span>Cx {p.boxQuantity || 24}x: R$ {p.boxPrice.toFixed(2)}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {p.costPrice ? `R$ ${p.costPrice.toFixed(2)}` : '-'}
                      {margin !== null && (
                        <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-sans">
                          {margin}% margem
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {p.components && p.components.length > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30">
                          Composto (Ficha)
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                            isLowStock
                              ? 'bg-rose-50 dark:bg-red-500/20 text-rose-600 dark:text-red-400 border border-rose-200 dark:border-red-500/30'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
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
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-xs cursor-pointer"
                            title="-1 unidade"
                          >
                            -1
                          </button>
                          <button
                            onClick={() => handleQuickStock(p.id, 10)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 font-mono text-xs font-bold cursor-pointer"
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
                          className="p-1.5 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          title="Duplicar Produto (Gera novo código sequencial)"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          title="Editar Produto"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id, p.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition cursor-pointer"
                          title="Excluir Produto do Cardápio"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center text-slate-500 dark:text-slate-400">
                        {/^\d{7,14}$/.test(search.trim()) ? <Barcode className="w-6 h-6 text-amber-500 dark:text-amber-400" /> : <Search className="w-6 h-6" />}
                      </div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        Nenhum produto cadastrado encontrado {search.trim() ? `para "${search.trim()}"` : ''}
                      </p>
                      {/^\d{7,14}$/.test(search.trim()) ? (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                            Este código de barras ainda não está no cardápio. Deseja cadastrá-lo agora com preenchimento automático?
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              const scanned = search.trim();
                              openCreateModal();
                              setFormEan(scanned);
                              setTimeout(() => handleLookupEan(scanned), 250);
                            }}
                            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center gap-2 mx-auto cursor-pointer"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>Cadastrar Código {search.trim()}</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={openCreateModal}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 font-bold text-xs rounded-xl transition cursor-pointer"
                        >
                          + Cadastrar Novo Produto
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}



      {/* Modal Criar Categoria */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-3">Nova Categoria</h3>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label htmlFor="formNameInput" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1 cursor-pointer">
                  Nome da Categoria *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Doces & Balas, Sobremesas"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-amber-500 focus:outline-none shadow-xs"
                  id="formNameInput"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="cat-code-start" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1 cursor-pointer">
                  Faixa Numérica do Código (Opcional)
                </label>
                <input
                  id="cat-code-start"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: 5001 para bebidas, 6001 para chicletes/balas"
                  value={newCatCodeStart}
                  onChange={(e) => setNewCatCodeStart(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-sm focus:border-amber-500 focus:outline-none cursor-text shadow-xs"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Os produtos desta categoria receberão códigos sequenciais automáticos a partir deste número (ex: 6001, 6002...).
                </p>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer"
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Cabeçalho */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Gestão de Fornecedores</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cadastre distribuidores, cervejarias e parceiros para vincular aos produtos e cruzar com NF-e
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={openCreateSupplierModal}
                  className="py-2 px-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-emerald-500/10 active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Novo Fornecedor</span>
                </button>
                <button
                  onClick={() => setShowSuppliersModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Barra de Busca de Fornecedores */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por Razão Social, Nome Fantasia, CNPJ, contato ou cidade..."
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-500 shadow-xs"
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
                      <p className="font-bold text-slate-700 dark:text-slate-400 text-sm">
                        {suppliers.length === 0 ? 'Nenhum fornecedor cadastrado ainda' : 'Nenhum fornecedor encontrado para esta busca'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        Fornecedores são cadastrados manualmente pelo botão acima ou importados automaticamente ao bipar XMLs de compra da SEFAZ.
                      </p>
                      {suppliers.length === 0 && (
                        <button
                          onClick={openCreateSupplierModal}
                          className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer"
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
                    className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900 dark:text-white text-sm">
                          {s.tradeName || s.name}
                        </span>
                        {s.tradeName && s.name && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            ({s.name})
                          </span>
                        )}
                        {s.document && (
                          <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                            {s.document.length === 14
                              ? s.document.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
                              : s.document}
                          </span>
                        )}
                        {s._count?.products !== undefined && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-700 dark:text-slate-300 font-bold">
                            {s._count.products} {s._count.products === 1 ? 'produto vinculado' : 'produtos vinculados'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        {s.phone && (
                          <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                            <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            {s.phone}
                          </span>
                        )}
                        {s.email && (
                          <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                            <Mail className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                            {s.email}
                          </span>
                        )}
                        {s.contactName && (
                          <span className="text-slate-500 dark:text-slate-400">
                            Contato: <strong className="text-slate-800 dark:text-slate-200">{s.contactName}</strong>
                          </span>
                        )}
                        {s.city && (
                          <span className="text-slate-500 dark:text-slate-400">
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
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Editar Fornecedor"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                        <span className="hidden sm:inline">Editar</span>
                      </button>
                      <button
                        onClick={() => handleDeleteSupplier(s.id, s.tradeName || s.name)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-900/40 text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                <span>{editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}</span>
              </h3>
              <button
                onClick={() => setShowSupplierFormModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4">
              <div>
                <label htmlFor="pv-sup-name" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1 cursor-pointer">
                  Razão Social / Nome Principal *
                </label>
                <input
                  id="pv-sup-name"
                  type="text"
                  required
                  placeholder="Ex: Cervejaria Ambev S.A. ou Distribuidora Modelo"
                  value={supplierFormName}
                  onChange={(e) => setSupplierFormName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-emerald-500 focus:outline-none cursor-text shadow-xs"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pv-sup-trade" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1 cursor-pointer">
                    Nome Fantasia
                  </label>
                  <input
                    id="pv-sup-trade"
                    type="text"
                    placeholder="Ex: Ambev Chopp"
                    value={supplierFormTradeName}
                    onChange={(e) => setSupplierFormTradeName(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-emerald-500 focus:outline-none cursor-text shadow-xs"
                  />
                </div>
                <div>
                  <label htmlFor="pv-sup-doc" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1 cursor-pointer">
                    CNPJ ou CPF
                  </label>
                  <input
                    id="pv-sup-doc"
                    type="text"
                    placeholder="00.000.000/0000-00"
                    value={supplierFormDocument}
                    onChange={(e) => setSupplierFormDocument(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-sm focus:border-emerald-500 focus:outline-none cursor-text shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pv-sup-phone" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1 cursor-pointer">
                    Telefone / WhatsApp
                  </label>
                  <input
                    id="pv-sup-phone"
                    type="text"
                    placeholder="(11) 98888-7777"
                    value={supplierFormPhone}
                    onChange={(e) => setSupplierFormPhone(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-emerald-500 focus:outline-none cursor-text shadow-xs"
                  />
                </div>
                <div>
                  <label htmlFor="pv-sup-ie" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1 cursor-pointer">
                    Inscrição Estadual (IE)
                  </label>
                  <input
                    id="pv-sup-ie"
                    type="text"
                    placeholder="Ex: 123456789"
                    value={supplierFormIe}
                    onChange={(e) => setSupplierFormIe(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-sm focus:border-emerald-500 focus:outline-none cursor-text shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pv-sup-email" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1 cursor-pointer">
                    E-mail
                  </label>
                  <input
                    id="pv-sup-email"
                    type="email"
                    placeholder="pedidos@fornecedor.com.br"
                    value={supplierFormEmail}
                    onChange={(e) => setSupplierFormEmail(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-emerald-500 focus:outline-none cursor-text shadow-xs"
                  />
                </div>
                <div>
                  <label htmlFor="pv-sup-contact" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1 cursor-pointer">
                    Contato / Vendedor
                  </label>
                  <input
                    id="pv-sup-contact"
                    type="text"
                    placeholder="Ex: Carlos Representante"
                    value={supplierFormContactName}
                    onChange={(e) => setSupplierFormContactName(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-emerald-500 focus:outline-none cursor-text shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label htmlFor="pv-sup-city" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1 cursor-pointer">
                    Cidade
                  </label>
                  <input
                    id="pv-sup-city"
                    type="text"
                    placeholder="Ex: São Paulo"
                    value={supplierFormCity}
                    onChange={(e) => setSupplierFormCity(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-emerald-500 focus:outline-none cursor-text shadow-xs"
                  />
                </div>
                <div>
                  <label htmlFor="pv-sup-uf" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1 cursor-pointer">
                    UF
                  </label>
                  <input
                    id="pv-sup-uf"
                    type="text"
                    placeholder="SP"
                    maxLength={2}
                    value={supplierFormState}
                    onChange={(e) => setSupplierFormState(e.target.value.toUpperCase())}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-sm focus:border-emerald-500 focus:outline-none cursor-text shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="pv-sup-addr" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1 cursor-pointer">
                  Endereço
                </label>
                <input
                  id="pv-sup-addr"
                  type="text"
                  placeholder="Rua, número, bairro..."
                  value={supplierFormAddress}
                  onChange={(e) => setSupplierFormAddress(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-emerald-500 focus:outline-none cursor-text shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Observações / Condições Comerciais
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Entrega às terças-feiras. Pedido mínimo R$ 500. Boleto 28 dias."
                  value={supplierFormNotes}
                  onChange={(e) => setSupplierFormNotes(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-emerald-500 focus:outline-none resize-none shadow-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierFormModal(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
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

      {/* Modal Rápido de Fornecedor (+ Novo direto do produto) */}
      {showQuickSupplierModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-500 dark:text-amber-400" />
              <span>Adicionar Fornecedor Rápido</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Cadastre e vincule este fornecedor imediatamente ao produto atual.
            </p>

            <form onSubmit={handleSaveQuickSupplier} className="space-y-3">
              <div>
                <label htmlFor="quick-sup-name" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1 cursor-pointer">
                  Razão Social / Nome *
                </label>
                <input
                  id="quick-sup-name"
                  type="text"
                  required
                  placeholder="Ex: Cervejaria Heineken do Brasil"
                  value={quickSupplierName}
                  onChange={(e) => setQuickSupplierName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none cursor-text shadow-xs"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="quick-sup-trade" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1 cursor-pointer">
                  Nome Fantasia
                </label>
                <input
                  id="quick-sup-trade"
                  type="text"
                  placeholder="Ex: Heineken"
                  value={quickSupplierTradeName}
                  onChange={(e) => setQuickSupplierTradeName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none cursor-text shadow-xs"
                />
              </div>

              <div>
                <label htmlFor="quick-sup-doc" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1 cursor-pointer">
                  CNPJ ou CPF (Opcional)
                </label>
                <input
                  id="quick-sup-doc"
                  type="text"
                  placeholder="00.000.000/0000-00"
                  value={quickSupplierDoc}
                  onChange={(e) => setQuickSupplierDoc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-xs focus:border-amber-500 focus:outline-none cursor-text shadow-xs"
                />
              </div>

              <div>
                <label htmlFor="quick-sup-phone" className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-400 mb-1 cursor-pointer">
                  Telefone / WhatsApp (Opcional)
                </label>
                <input
                  id="quick-sup-phone"
                  type="text"
                  placeholder="(11) 99999-8888"
                  value={quickSupplierPhone}
                  onChange={(e) => setQuickSupplierPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none cursor-text shadow-xs"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickSupplierModal(false)}
                  className="flex-1 py-2 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer"
                >
                  Vincular Agora
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportXmlModal && (
        <ImportXmlModal
          onClose={() => setShowImportXmlModal(false)}
          onSuccess={() => {
            loadData();
            setShowImportXmlModal(false);
          }}
        />
      )}

      {showNcmModal && (
        <NcmLookupModal
          onClose={() => setShowNcmModal(false)}
          onSelectNcm={(ncm) => {
            setFormNcm(ncm);
            setShowNcmModal(false);
          }}
        />
      )}
    </>
  );
};
