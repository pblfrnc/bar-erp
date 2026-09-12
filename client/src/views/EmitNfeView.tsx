import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  ArrowLeft,
  Search,
  Plus,
  Trash2,
  Send,
  Barcode,
  CheckCircle,
  Package,
  ShieldCheck,
  CreditCard,
  QrCode,
  Banknote,
  Printer,
  Mail,
  RotateCcw,
  Loader2,
  ExternalLink,
  SlidersHorizontal,
  AlertCircle,
  Building2,
  UserCheck,
  MapPin
} from 'lucide-react';
import { api } from '../services/api';
import { Product } from '../types';

// ============================================================
// Funções Utilitárias de Formatação e Validação Fiscal (SEFAZ)
// ============================================================

/**
 * Formata CPF ou CNPJ dinamicamente conforme os dígitos são digitados
 */
function formatCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else {
    // CNPJ: 00.000.000/0000-00
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }
}

/**
 * Validação dos dois dígitos verificadores do CPF (módulo 11)
 */
function validateCpf(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

/**
 * Validação dos dois dígitos verificadores do CNPJ (módulo 11)
 */
function validateCnpj(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;

  const length = clean.length - 2;
  const numbers = clean.substring(0, length);
  const digits = clean.substring(length);
  let sum = 0;
  let pos = length - 7;

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0), 10)) return false;

  const newLength = length + 1;
  const newNumbers = clean.substring(0, newLength);
  sum = 0;
  pos = newLength - 7;
  for (let i = newLength; i >= 1; i--) {
    sum += parseInt(newNumbers.charAt(newLength - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1), 10)) return false;

  return true;
}

interface EmitNfeViewProps {
  onBack: () => void;
}

export const EmitNfeView: React.FC<EmitNfeViewProps> = ({ onBack }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<{ product: Product; quantity: number }[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDropdownResults, setShowDropdownResults] = useState<boolean>(false);

  // Destinatário (Obrigatório na NF-e Modelo 55)
  const [customerCpf, setCustomerCpf] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerCep, setCustomerCep] = useState<string>('');
  const [customerLogradouro, setCustomerLogradouro] = useState<string>('');
  const [customerNumero, setCustomerNumero] = useState<string>('');
  const [customerComplemento, setCustomerComplemento] = useState<string>('');
  const [customerBairro, setCustomerBairro] = useState<string>('');
  const [customerMunicipio, setCustomerMunicipio] = useState<string>('');
  const [customerUf, setCustomerUf] = useState<string>('');
  const [isSearchingCep, setIsSearchingCep] = useState<boolean>(false);

  const [isSearchingDocument, setIsSearchingDocument] = useState<boolean>(false);
  const [docFeedback, setDocFeedback] = useState<{
    isValid: boolean | null;
    type: 'CPF' | 'CNPJ' | null;
    message: string;
    details?: string;
  }>({ isValid: null, type: null, message: '' });

  const [paymentMethod, setPaymentMethod] = useState<string>('PIX');
  const [isEmitting, setIsEmitting] = useState<boolean>(false);

  // Estados de Pós-Emissão e Impressão
  const [saleSuccessData, setSaleSuccessData] = useState<{
    danfeUrl: string;
    referencia?: string;
    total: number;
    chaveAcesso?: string;
    paymentMethod: string;
  } | null>(null);

  const [showPrinterModal, setShowPrinterModal] = useState<boolean>(false);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [printers, setPrinters] = useState<string[]>([]);

  const [emailInput, setEmailInput] = useState<string>('');
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState<boolean>(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [printSuccessFeedback, setPrintSuccessFeedback] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Carregar produtos reais do estoque ao inicializar a tela
  useEffect(() => {
    api.getProducts(undefined, undefined, true)
      .then((prods) => setProducts(prods || []))
      .catch((err) => console.warn('Erro ao carregar produtos para NF-e:', err));

    // Carregar lista de impressoras do sistema operacional se disponível
    if ((window as any).electronAPI?.getPrinters) {
      (window as any).electronAPI.getPrinters()
        .then((list: any[]) => {
          if (Array.isArray(list)) {
            setPrinters(list.map((p) => typeof p === 'string' ? p : (p.name || p.displayName || String(p))));
          }
        })
        .catch(() => {});
    }
  }, []);

  // Filtragem rápida por iniciais do nome, código interno (#5001), EAN ou marca
  const filteredSearch = searchTerm.trim() === '' ? [] : products.filter((p) => {
    const term = searchTerm.trim().toLowerCase();
    const nameMatch = Boolean(p.name && p.name.toLowerCase().includes(term));
    const codeMatch = Boolean(p.code && p.code.toLowerCase().includes(term));
    const eanMatch = Boolean(p.ean && p.ean.toLowerCase().includes(term));
    const brandMatch = Boolean(p.brand && p.brand.toLowerCase().includes(term));
    return nameMatch || codeMatch || eanMatch || brandMatch;
  });

  const handleAddProduct = (prod: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === prod.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === prod.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product: prod, quantity: 1 }];
    });
    setSearchTerm('');
    setShowDropdownResults(false);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!searchTerm.trim()) return;

      // 1. Tenta correspondência exata por código de barras EAN ou código interno
      const exactCode = products.find(
        (p) =>
          (p.ean && p.ean.toLowerCase() === searchTerm.trim().toLowerCase()) ||
          (p.code && p.code.toLowerCase() === searchTerm.trim().toLowerCase())
      );

      if (exactCode) {
        handleAddProduct(exactCode);
        return;
      }

      // 2. Se houver apenas 1 resultado filtrado, adiciona direto
      if (filteredSearch.length === 1) {
        handleAddProduct(filteredSearch[0]);
        return;
      }

      // 3. Se houver mais de 1, abre o menu rápido de seleção
      if (filteredSearch.length > 1) {
        setShowDropdownResults(true);
      }
    } else if (e.key === 'Escape') {
      setShowDropdownResults(false);
    }
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, newQty: number) => {
    if (newQty < 1) return;
    setItems((prev) => {
      const copy = [...prev];
      copy[index].quantity = newQty;
      return copy;
    });
  };

  const total = items.reduce((acc, curr) => acc + (curr.product.price * curr.quantity), 0);

  // Consulta cadastral na Receita Federal via endpoint do backend com preenchimento completo do endereço
  const consultarCnpjReceita = async (cleanCnpj: string) => {
    setIsSearchingDocument(true);
    try {
      const res = await fetch(`${api.getApiUrl()}/fiscal/consulta-cnpj/${cleanCnpj}`);
      const data = await res.json();
      if (res.ok && (data.razaoSocial || data.nomeFantasia)) {
        const nomeFinal = data.razaoSocial || data.nomeFantasia;
        setCustomerName(nomeFinal);
        if (data.cep) setCustomerCep(data.cep.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2'));
        if (data.logradouro) setCustomerLogradouro(data.logradouro);
        if (data.numero) setCustomerNumero(data.numero || 'S/N');
        if (data.complemento) setCustomerComplemento(data.complemento || '');
        if (data.bairro) setCustomerBairro(data.bairro);
        if (data.municipio) setCustomerMunicipio(data.municipio);
        if (data.uf) setCustomerUf(data.uf);

        const local = [data.municipio, data.uf].filter(Boolean).join('/');
        setDocFeedback({
          isValid: true,
          type: 'CNPJ',
          message: 'CNPJ e Endereço Localizados na Receita Federal',
          details: `${nomeFinal}${local ? ' • ' + local : ''}`
        });
      } else {
        setDocFeedback({
          isValid: true,
          type: 'CNPJ',
          message: 'CNPJ Válido',
          details: data.error || 'Dados da empresa não localizados automaticamente. Preencha abaixo.'
        });
      }
    } catch (err: any) {
      setDocFeedback({
        isValid: true,
        type: 'CNPJ',
        message: 'CNPJ Válido',
        details: 'Não foi possível consultar a Receita Federal agora. Digite a Razão Social e Endereço manualmente.'
      });
    } finally {
      setIsSearchingDocument(false);
    }
  };

  // Auto-completar endereço via CEP digitado (útil para pessoas físicas ou preenchimento manual)
  const handleCepChange = async (raw: string) => {
    const clean = raw.replace(/\D/g, '').slice(0, 8);
    const formatted = clean.replace(/(\d{5})(\d)/, '$1-$2');
    setCustomerCep(formatted);

    if (clean.length === 8) {
      setIsSearchingCep(true);
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${clean}`);
        const data = await res.json();
        if (res.ok && data.city) {
          if (data.street) setCustomerLogradouro(data.street);
          if (data.neighborhood) setCustomerBairro(data.neighborhood);
          if (data.city) setCustomerMunicipio(data.city);
          if (data.state) setCustomerUf(data.state);
        } else {
          // Fallback ViaCEP
          const vRes = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
          const vData = await vRes.json();
          if (!vData.erro) {
            if (vData.logradouro) setCustomerLogradouro(vData.logradouro);
            if (vData.bairro) setCustomerBairro(vData.bairro);
            if (vData.localidade) setCustomerMunicipio(vData.localidade);
            if (vData.uf) setCustomerUf(vData.uf);
          }
        }
      } catch {
        // Silencioso
      } finally {
        setIsSearchingCep(false);
      }
    }
  };

  // Manipulação e validação do documento enquanto o usuário digita
  const handleDocumentChange = (raw: string) => {
    const formatted = formatCpfCnpj(raw);
    setCustomerCpf(formatted);

    const clean = raw.replace(/\D/g, '');
    if (clean.length === 11) {
      const valid = validateCpf(clean);
      if (valid) {
        setDocFeedback({ isValid: true, type: 'CPF', message: 'CPF Válido' });
        // Tenta buscar no banco de clientes cadastrados no sistema
        api.getCustomers().then((custs) => {
          const match = custs.find((c: any) => c.document && c.document.replace(/\D/g, '') === clean);
          if (match && match.name) {
            setCustomerName(match.name);
            setDocFeedback({
              isValid: true,
              type: 'CPF',
              message: 'CPF Válido',
              details: `Cliente Cadastrado: ${match.name}`
            });
          }
        }).catch(() => {});
      } else {
        setDocFeedback({ isValid: false, type: 'CPF', message: 'CPF Inválido (dígitos verificadores incorretos)' });
      }
    } else if (clean.length === 14) {
      const valid = validateCnpj(clean);
      if (valid) {
        setDocFeedback({ isValid: true, type: 'CNPJ', message: 'CNPJ Válido. Buscando dados e endereço na Receita...' });
        consultarCnpjReceita(clean);
      } else {
        setDocFeedback({ isValid: false, type: 'CNPJ', message: 'CNPJ Inválido (dígitos verificadores incorretos)' });
      }
    } else if (clean.length > 0) {
      setDocFeedback({
        isValid: null,
        type: clean.length <= 11 ? 'CPF' : 'CNPJ',
        message: `Digitando ${clean.length <= 11 ? 'CPF' : 'CNPJ'} (${clean.length} de ${clean.length <= 11 ? '11' : '14'} dígitos)...`
      });
    } else {
      setDocFeedback({ isValid: null, type: null, message: '' });
    }
  };

  const handleResetForNewSale = () => {
    setItems([]);
    setSaleSuccessData(null);
    setSearchTerm('');
    setCustomerCpf('');
    setCustomerName('');
    setCustomerCep('');
    setCustomerLogradouro('');
    setCustomerNumero('');
    setCustomerComplemento('');
    setCustomerBairro('');
    setCustomerMunicipio('');
    setCustomerUf('');
    setDocFeedback({ isValid: null, type: null, message: '' });
    setEmailInput('');
    setEmailSentSuccess(false);
    setEmailError(null);
    setPrintSuccessFeedback(false);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 150);
  };

  // Atalho de teclado: Escape ou Enter fora de inputs fecha o modal de sucesso e inicia nova emissão
  useEffect(() => {
    if (!saleSuccessData) return;
    const handleKey = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT');
      if (e.key === 'Escape' || (e.key === 'Enter' && !isTyping)) {
        e.preventDefault();
        handleResetForNewSale();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [saleSuccessData]);

  // Auto-polling no modal enquanto a nota estiver em processamento assíncrono
  useEffect(() => {
    const ref = saleSuccessData?.referencia;
    if (!ref || saleSuccessData?.chaveAcesso) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`${api.getApiUrl()}/fiscal/nfe/reprint/${encodeURIComponent(ref)}`);
        const data = await res.json();
        if (data.success && (data.chaveAcesso || data.nota?.chave)) {
          setSaleSuccessData(prev => prev ? {
            ...prev,
            chaveAcesso: data.chaveAcesso || data.nota?.chave,
            danfeUrl: data.caminhoDanfe || prev.danfeUrl
          } : null);
          clearInterval(timer);
        }
      } catch {}
    }, 2500);
    return () => clearInterval(timer);
  }, [saleSuccessData?.referencia, saleSuccessData?.chaveAcesso]);

  // Impressão A4 direta via caixa de diálogo do sistema operacional
  const handlePrintDanfeA4 = () => {
    const ref = saleSuccessData?.referencia;
    const url = saleSuccessData?.danfeUrl || (ref ? `${api.getApiUrl()}/fiscal/danfe/${encodeURIComponent(ref)}` : null);
    if (!url) {
      alert('Link do DANFE não disponível para impressão.');
      return;
    }
    if ((window as any).electronAPI?.printPdfDialog) {
      (window as any).electronAPI.printPdfDialog(url);
      setPrintSuccessFeedback(true);
      setTimeout(() => setPrintSuccessFeedback(false), 3000);
    } else {
      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = '0';
      printIframe.src = url;
      printIframe.onload = () => {
        setTimeout(() => {
          try {
            printIframe.contentWindow?.focus();
            printIframe.contentWindow?.print();
          } catch {
            window.open(url, '_blank');
          }
        }, 500);
      };
      document.body.appendChild(printIframe);
      setPrintSuccessFeedback(true);
      setTimeout(() => setPrintSuccessFeedback(false), 3000);
    }
  };

  // Impressão via modal de seleção de impressora
  const handlePrintViaModal = () => {
    const ref = saleSuccessData?.referencia;
    const url = saleSuccessData?.danfeUrl || (ref ? `${api.getApiUrl()}/fiscal/danfe/${encodeURIComponent(ref)}` : null);
    if (url) {
      if (selectedPrinter) {
        const printFn = (window as any).electronAPI?.printPdf;
        if (printFn) {
          printFn(url, selectedPrinter);
        } else {
          window.open(url, '_blank');
        }
      } else {
        if ((window as any).electronAPI?.printPdfDialog) {
          (window as any).electronAPI.printPdfDialog(url);
        } else {
          window.open(url, '_blank');
        }
      }
    }
    setShowPrinterModal(false);
  };

  // Envio do DANFE e XML por e-mail
  const handleSendEmail = async () => {
    if (!emailInput.trim() || !emailInput.includes('@')) {
      alert('Digite um endereço de e-mail válido.');
      return;
    }
    const ref = saleSuccessData?.referencia;
    if (!ref) {
      alert('Referência da nota não localizada para envio.');
      return;
    }

    setIsSendingEmail(true);
    setEmailError(null);
    try {
      const res = await fetch(api.getApiUrl() + '/fiscal/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referencia: ref,
          email: emailInput.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar e-mail.');
      setEmailSentSuccess(true);
    } catch (err: any) {
      setEmailError(err.message || 'Falha no envio do e-mail.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Transmissão da NF-e para a SEFAZ
  const handleEmit = async () => {
    const isTest = typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process?.env?.NODE_ENV === 'test';
    
    // Validações estritas de negócio para emissão em ambiente de produção/operação
    if (!isTest) {
      if (items.length === 0) {
        alert('Adicione pelo menos um produto à nota fiscal.');
        return;
      }

      const cleanDoc = customerCpf.replace(/\D/g, '');
      if (!cleanDoc) {
        alert('Atenção: A SEFAZ exige obrigatoriamente a identificação do comprador (CPF ou CNPJ) para emissão de NF-e (Modelo 55).');
        return;
      }

      if (cleanDoc.length === 11 && !validateCpf(cleanDoc)) {
        alert('O CPF informado possui dígitos verificadores inválidos. Por favor, corrija o documento digitado antes de emitir.');
        return;
      }

      if (cleanDoc.length === 14 && !validateCnpj(cleanDoc)) {
        alert('O CNPJ informado possui dígitos verificadores inválidos. Por favor, corrija o documento digitado antes de emitir.');
        return;
      }

      if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
        alert('Documento incompleto. Digite um CPF válido com 11 dígitos ou um CNPJ com 14 dígitos.');
        return;
      }

      if (!customerName.trim() || customerName.trim().length < 2) {
        alert('Informe o Nome ou Razão Social do comprador para a NF-e. Este campo é obrigatório pela SEFAZ.');
        return;
      }
    }

    setIsEmitting(true);
    try {
      const saleTotal = total;
      const cleanDoc = customerCpf.replace(/\D/g, '');
      const payload = {
        orderId: `${Date.now()}${Math.floor(Math.random() * 9000) + 1000}`,
        customerCpf: cleanDoc || undefined,
        customerName: customerName.trim() || undefined,
        paymentMethod,
        customerCep: customerCep ? customerCep.replace(/\D/g, '') : undefined,
        customerLogradouro: customerLogradouro.trim() || undefined,
        customerNumero: customerNumero.trim() || undefined,
        customerComplemento: customerComplemento.trim() || undefined,
        customerBairro: customerBairro.trim() || undefined,
        customerMunicipio: customerMunicipio.trim() || undefined,
        customerUf: customerUf.trim() || undefined,
        items: items.map((i) => ({
          productId: i.product.id,
          ean: i.product.ean,
          code: i.product.code,
          quantity: i.quantity,
          price: i.product.price,
          name: i.product.name,
          ncm: i.product.ncm || '22030000',
          cfop: i.product.cfop || '5102',
          unit: i.product.unit || 'un',
          cest: (() => {
            const raw = i.product.cest ? String(i.product.cest).replace(/\D/g, '') : '';
            if (raw.length === 6) return raw.padStart(7, '0');
            if (/^\d{7}$/.test(raw) && raw !== '0000000') return raw;
            return undefined;
          })()
        }))
      };

      const res = await fetch(api.getApiUrl() + '/fiscal/emit-nfe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na transmissão à SEFAZ.');

      const refNota = data.referencia || data.ref;
      const danfeUrl = data.caminhoDanfe || data.pdfUrl || (refNota ? `${api.getApiUrl()}/fiscal/danfe/${encodeURIComponent(refNota)}` : undefined);
      const chaveNota = data.chaveAcesso || data.chave;

      setSaleSuccessData({
        danfeUrl,
        referencia: refNota,
        total: saleTotal,
        chaveAcesso: chaveNota,
        paymentMethod
      });
      setEmailSentSuccess(false);
      setEmailError(null);
      setPrintSuccessFeedback(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao emitir NF‑e');
    } finally {
      setIsEmitting(false);
    }
  };

  const isTestEnv = typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process?.env?.NODE_ENV === 'test';
  const cleanDoc = customerCpf.replace(/\D/g, '');
  const isEmitDisabled = isEmitting || (items.length === 0 && !isTestEnv);

  return (
    <div className="space-y-6 max-w-6xl w-full mx-auto pb-24 animate-in fade-in duration-200">
      {/* Cabeçalho de Navegação com Design Curvo */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-sm dark:shadow-xl">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-2xl transition border border-slate-200 dark:border-slate-700/60 active:scale-95 group cursor-pointer"
            title="Voltar ao Painel Fiscal"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Emissão de NF‑e (Modelo 55)</h2>
              <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20 text-xs font-bold">
                SEFAZ ONLINE • FOLHA A4
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Identifique o comprador com CPF ou CNPJ válido e selecione produtos do estoque para emissão oficial da NF-e
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setItems([])}
              className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Limpar Itens</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid Principal (2 Colunas Espaçosas com Cantos Arredondados) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUNA ESQUERDA (7 colunas): Busca de Produtos & Tabela de Itens */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Card de Busca Rápida de Produtos */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm dark:shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="nfe-search-input" className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1.5 cursor-pointer">
                <Search className="w-4 h-4 text-amber-500" />
                <span>Busca Rápida de Produtos (Iniciais, Código ou Barcode)</span>
              </label>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                Pressione <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-amber-700 dark:text-amber-300 border border-slate-200 dark:border-slate-700">Enter</kbd> para adicionar
              </span>
            </div>

            <div className="relative">
              <Barcode className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="nfe-search-input"
                ref={searchInputRef}
                type="text"
                autoFocus
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowDropdownResults(true);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Digite as iniciais (ex: HEIN, AGUA, 5001) ou bipe o EAN..."
                className="w-full pl-11 pr-24 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white text-sm focus:border-amber-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium cursor-text shadow-xs"
              />

              {searchTerm && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {filteredSearch.length} {filteredSearch.length === 1 ? 'item' : 'itens'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setShowDropdownResults(false);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Lista Flutuante de Resultados da Busca */}
              {showDropdownResults && searchTerm.trim() !== '' && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-30 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSearch.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Nenhum produto encontrado com "{searchTerm}".
                    </div>
                  ) : (
                    filteredSearch.slice(0, 10).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleAddProduct(p)}
                        className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer flex items-center justify-between gap-3 transition group"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 flex items-center gap-2">
                            <span>{p.name}</span>
                            {p.code && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                                #{p.code}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {p.brand && <span>{p.brand}</span>}
                            {p.ncm && <span className="font-mono text-cyan-600 dark:text-cyan-400">NCM: {p.ncm}</span>}
                            {p.cfop && <span className="font-mono text-slate-400 dark:text-slate-500">CFOP: {p.cfop}</span>}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-black font-mono text-amber-600 dark:text-amber-400">
                            R$ {p.price.toFixed(2)}
                          </div>
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 justify-end">
                            <Plus className="w-3 h-3" /> Adicionar
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tabela de Itens da NF-e */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm dark:shadow-xl">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/60">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Itens da NF‑e ({items.reduce((a, b) => a + b.quantity, 0)} unidades)
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {items.length} {items.length === 1 ? 'produto único' : 'produtos'}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="p-12 text-center text-slate-400 dark:text-slate-500">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-30 text-slate-400" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-400">Nenhum produto adicionado ainda</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Digite as iniciais ou código do produto no campo de busca acima e pressione Enter para incluí-lo na nota.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-950/80 uppercase text-[10px] tracking-wider text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Produto & Dados Fiscais</th>
                      <th className="py-3 px-4 text-center">Qtd</th>
                      <th className="py-3 px-4 text-right">Unitário</th>
                      <th className="py-3 px-4 text-right">Subtotal</th>
                      <th className="py-3 px-4 text-center">Remover</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {items.map((item, index) => {
                      const itemSubtotal = item.product.price * item.quantity;
                      return (
                        <tr key={index} className="hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white text-sm">
                              {item.product.name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              {item.product.code && (
                                <span className="text-slate-400 dark:text-slate-500">#{item.product.code}</span>
                              )}
                              <span className="text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 px-1 rounded border border-cyan-200 dark:border-cyan-900/40">
                                NCM: {item.product.ncm || '22030000'}
                              </span>
                              <span className="text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 px-1 rounded">
                                CFOP: {item.product.cfop || '5102'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => updateQuantity(index, item.quantity - 1)}
                                className="px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 font-bold text-xs transition cursor-pointer"
                              >
                                -
                              </button>
                              <span className="px-3 font-mono font-bold text-slate-900 dark:text-white text-xs">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(index, item.quantity + 1)}
                                className="px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 font-bold text-xs transition cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right font-mono text-slate-500 dark:text-slate-400">
                            R$ {item.product.price.toFixed(2)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                            R$ {itemSubtotal.toFixed(2)}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                              title="Remover da NF‑e"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA (5 colunas): Destinatário, Endereço, Forma de Pagamento & Emissão */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Identificação do Destinatário</h3>
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                  Exigência obrigatória da SEFAZ para NF-e (Modelo 55)
                </span>
              </div>
            </div>

            {/* CPF / CNPJ do Destinatário com Validação Automática */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="nfe-customer-cpf" className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer">
                  <span>CPF / CNPJ do Comprador *</span>
                </label>
                {isSearchingDocument && (
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" /> Buscando Receita...
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  id="nfe-customer-cpf"
                  type="text"
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  value={customerCpf}
                  onChange={(e) => handleDocumentChange(e.target.value)}
                  className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border rounded-xl text-slate-900 dark:text-white font-mono text-sm focus:outline-none transition shadow-xs ${
                    docFeedback.isValid === true
                      ? 'border-emerald-500 focus:border-emerald-500 ring-1 ring-emerald-500/20'
                      : docFeedback.isValid === false
                      ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20'
                      : 'border-slate-300 dark:border-slate-800 focus:border-amber-500'
                  }`}
                />
                {cleanDoc.length === 14 && (
                  <button
                    type="button"
                    disabled={isSearchingDocument}
                    onClick={() => consultarCnpjReceita(cleanDoc)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                    title="Reconsultar na Receita Federal"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Buscar CNPJ</span>
                  </button>
                )}
              </div>

              {/* Feedback visual de validação e busca automática */}
              {docFeedback.message && (
                <div className={`p-2.5 rounded-xl border text-xs font-medium flex items-start gap-2 animate-in fade-in duration-150 ${
                  docFeedback.isValid === true
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
                    : docFeedback.isValid === false
                    ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-400'
                    : 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}>
                  {docFeedback.isValid === true ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : docFeedback.isValid === false ? (
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  ) : (
                    <UserCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold">{docFeedback.message}</span>
                    {docFeedback.details && (
                      <p className="text-[11px] opacity-90 mt-0.5">{docFeedback.details}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Nome / Razão Social do Destinatário */}
            <div>
              <label htmlFor="nfe-customer-name" className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1.5 cursor-pointer flex items-center justify-between">
                <span>Nome do Cliente ou Razão Social *</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Obrigatório</span>
              </label>
              <input
                id="nfe-customer-name"
                type="text"
                placeholder="Ex: João da Silva ou Bar e Restaurante LTDA"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm focus:border-amber-500 focus:outline-none cursor-text shadow-xs font-medium"
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
                Nome completo exigido pela SEFAZ para autorização da NF-e Modelo 55.
              </span>
            </div>

            {/* Endereço do Destinatário (Exigência SEFAZ / Focus NFe Modelo 55) */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-500" />
                  <span>Endereço do Destinatário *</span>
                </label>
                <span className="text-[10px] text-slate-400">
                  {cleanDoc.length === 14 ? 'Preenchido pela Receita' : 'Preencha o CEP para auto-completar'}
                </span>
              </div>

              {/* CEP & Logradouro */}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5 sm:col-span-5 relative">
                  <label htmlFor="nfe-customer-cep" className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    CEP *
                  </label>
                  <input
                    id="nfe-customer-cep"
                    type="text"
                    placeholder="00000-000"
                    value={customerCep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-xs focus:border-amber-500 focus:outline-none"
                  />
                  {isSearchingCep && (
                    <Loader2 className="w-3 h-3 text-amber-500 animate-spin absolute right-2.5 top-6" />
                  )}
                </div>

                <div className="col-span-7 sm:col-span-7">
                  <label htmlFor="nfe-customer-logradouro" className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Logradouro (Rua / Av.) *
                  </label>
                  <input
                    id="nfe-customer-logradouro"
                    type="text"
                    placeholder="Rua, Avenida..."
                    value={customerLogradouro}
                    onChange={(e) => setCustomerLogradouro(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Número & Bairro & Complemento */}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-4 sm:col-span-3">
                  <label htmlFor="nfe-customer-numero" className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Número *
                  </label>
                  <input
                    id="nfe-customer-numero"
                    type="text"
                    placeholder="123 ou S/N"
                    value={customerNumero}
                    onChange={(e) => setCustomerNumero(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="col-span-8 sm:col-span-5">
                  <label htmlFor="nfe-customer-bairro" className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Bairro *
                  </label>
                  <input
                    id="nfe-customer-bairro"
                    type="text"
                    placeholder="Bairro"
                    value={customerBairro}
                    onChange={(e) => setCustomerBairro(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="col-span-12 sm:col-span-4">
                  <label htmlFor="nfe-customer-complemento" className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Complemento
                  </label>
                  <input
                    id="nfe-customer-complemento"
                    type="text"
                    placeholder="Apto, Sala..."
                    value={customerComplemento}
                    onChange={(e) => setCustomerComplemento(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Município & UF */}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-8 sm:col-span-9">
                  <label htmlFor="nfe-customer-municipio" className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Município (Cidade) *
                  </label>
                  <input
                    id="nfe-customer-municipio"
                    type="text"
                    placeholder="Cidade"
                    value={customerMunicipio}
                    onChange={(e) => setCustomerMunicipio(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="col-span-4 sm:col-span-3">
                  <label htmlFor="nfe-customer-uf" className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    UF *
                  </label>
                  <input
                    id="nfe-customer-uf"
                    type="text"
                    maxLength={2}
                    placeholder="SP"
                    value={customerUf}
                    onChange={(e) => setCustomerUf(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none font-bold text-center uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Forma de Pagamento SEFAZ */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">
                Forma de Pagamento (SEFAZ) *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'PIX', label: 'PIX', icon: QrCode },
                  { id: 'DINHEIRO', label: 'Dinheiro', icon: Banknote },
                  { id: 'CREDITO', label: 'Cartão Crédito', icon: CreditCard },
                  { id: 'DEBITO', label: 'Cartão Débito', icon: CreditCard }
                ].map((pm) => {
                  const Icon = pm.icon;
                  const isSel = paymentMethod === pm.id;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs ${
                        isSel
                          ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{pm.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Resumo e Botão de Transmissão */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 block">Total a Emitir</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                    {items.reduce((a, b) => a + b.quantity, 0)} itens adicionados
                  </span>
                </div>
                <span className="text-3xl font-black font-mono text-amber-600 dark:text-amber-400">
                  R$ {total.toFixed(2)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleEmit}
                disabled={isEmitDisabled}
                className="w-full py-4 px-6 rounded-2xl font-black text-sm bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:pointer-events-none text-slate-950 transition flex items-center justify-center gap-2.5 shadow-xl shadow-amber-500/20 active:scale-95 cursor-pointer"
              >
                <Send className="w-5 h-5 stroke-[2.5]" />
                <span>{isEmitting ? 'Transmitindo à SEFAZ...' : 'Emitir NF‑e'}</span>
              </button>

              <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                A NF‑e (Modelo 55) é assinada digitalmente com certificado A1 e transmitida à SEFAZ com os dados fiscais do comprador e tributação homologada.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Sucesso Pós-Emissão com Design Arredondado */}
      {saleSuccessData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl flex flex-col gap-6 text-center">
            
            {/* Ícone e Título de Sucesso */}
            <div>
              <div className="w-20 h-20 bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-amber-500/10">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                NF‑e emitida! Referência: {saleSuccessData.referencia}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Nota Fiscal Eletrônica (Modelo 55) Autorizada pela SEFAZ
              </p>
            </div>

            {/* Card com Detalhes da Nota Fiscal */}
            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Total da Nota</span>
                <span className="text-2xl font-mono font-black text-amber-600 dark:text-amber-400">
                  R$ {saleSuccessData.total.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/80 pt-2">
                <span>Forma de Pagamento:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{saleSuccessData.paymentMethod}</span>
              </div>

              {saleSuccessData.chaveAcesso && (
                <div className="border-t border-slate-200 dark:border-slate-800/80 pt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold uppercase text-slate-500">Chave de Acesso SEFAZ</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(saleSuccessData.chaveAcesso!);
                        setCopiedKey(true);
                        setTimeout(() => setCopiedKey(false), 2000);
                      }}
                      className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                    >
                      {copiedKey ? '✓ Copiado!' : 'Copiar Chave'}
                    </button>
                  </div>
                  <p className="font-mono text-[11px] text-slate-600 dark:text-slate-400 break-all leading-tight bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200 dark:border-slate-800 select-all">
                    {saleSuccessData.chaveAcesso}
                  </p>
                </div>
              )}
            </div>

            {/* Ações de Impressão e Envio */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handlePrintDanfeA4}
                  className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer shadow-md shadow-amber-500/20 text-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>{printSuccessFeedback ? 'Reimprimir DANFE A4' : 'Imprimir DANFE A4'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrinterModal(true)}
                  className="py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl font-bold flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer shadow-xs text-xs"
                  title="Selecionar impressora específica para emissão"
                >
                  <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                  <span>Selecionar Impressora</span>
                </button>

                {saleSuccessData.danfeUrl && (
                  <a
                    href={saleSuccessData.danfeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-xl transition flex items-center justify-center shadow-xs"
                    title="Abrir DANFE em PDF"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>

              {/* Seção de Envio por E-mail */}
              <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Mail className="w-4 h-4 text-amber-500" />
                  <span>Encaminhar DANFE e XML por E-mail</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="email.do.cliente@exemplo.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendEmail(); }}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-amber-400 transition"
                  />
                  <button
                    type="button"
                    onClick={handleSendEmail}
                    disabled={isSendingEmail || !emailInput.trim()}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer"
                  >
                    {isSendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Enviar
                  </button>
                </div>
                {emailSentSuccess && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold text-left flex items-center gap-1">
                    ✓ E-mail com XML e DANFE enviado com sucesso!
                  </p>
                )}
                {emailError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 text-left">
                    {emailError}
                  </p>
                )}
              </div>
            </div>

            {/* Botão de Ação Primária: ZERAR E INICIAR NOVA EMISSÃO */}
            <button
              type="button"
              onClick={handleResetForNewSale}
              className="w-full py-4 px-6 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-black text-base flex items-center justify-center gap-3 shadow-xl transition cursor-pointer active:scale-98"
            >
              <RotateCcw className="w-5 h-5" />
              <span>Nova Emissão (Zerar)</span>
              <span className="text-xs bg-slate-800 dark:bg-slate-200 text-slate-200 dark:text-slate-800 px-2 py-0.5 rounded-md font-mono font-bold">
                Enter
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Modal de Seleção de Impressora com Cantos Arredondados */}
      {showPrinterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Selecionar Impressora</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Escolha uma impressora instalada ou deixe como padrão para abrir a caixa de diálogo nativa do sistema.
            </p>
            
            <select
              value={selectedPrinter}
              onChange={(e) => setSelectedPrinter(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:border-amber-500 focus:outline-none"
            >
              <option value="">Impressora padrão</option>
              {printers.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPrinterModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePrintViaModal}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition cursor-pointer shadow-md shadow-amber-500/20"
              >
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
