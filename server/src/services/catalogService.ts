import { prisma } from '../prisma.js';

export interface CatalogLookupResult {
  found: boolean;
  source?: 'LOCAL_PRODUCT' | 'NOTA_FISCAL_XML' | 'OPEN_FOOD_FACTS' | 'MANUAL';
  name?: string;
  code?: string | null;
  ean: string;
  brand?: string | null;
  supplier?: string | null;
  description?: string | null;
  price?: number | null;
  costPrice?: number | null;
  suggestedPrice?: number | null;
  categoryId?: string | null;
  suggestedCategoryId?: string | null;
  kdsStation?: 'BAR' | 'KITCHEN' | 'NONE';
  ncm?: string | null;
  cfop?: string | null;
  cest?: string | null;
  unit?: string;
  stock?: number;
  minStock?: number;
  message?: string;
}

interface TaxInference {
  ncm: string;
  cest: string | null;
  cfop: string;
  kdsStation: 'BAR' | 'KITCHEN' | 'NONE';
  categoryKeywords: string[];
  codePrefix: string;
}

function inferTaxAndClassification(name: string, brand?: string | null, categories?: string[]): TaxInference {
  const combined = `${name} ${brand || ''} ${(categories || []).join(' ')}`.toLowerCase();

  // 1. Refrigerantes (Checado antes de cervejas por causa de Guaraná Antarctica)
  if (/refrigerante|coca[-\s]?cola|pepsi|guaran[aá]|fanta|sprite|schweppes|soda|kuat|sukita|ituba[ií]na|dolly|gaseosa/.test(combined)) {
    return {
      ncm: '22021000',
      cest: '03.007.00',
      cfop: '5405',
      kdsStation: 'BAR',
      categoryKeywords: ['refrigerante', 'bebida', 'sem alcool'],
      codePrefix: 'REF'
    };
  }

  // 2. Cervejas e Chopes
  if (/cervej|chopp|chope|beer|pilsen|lager|ipa|puro malte|stout|weiss|heineken|brahma|skol|amstel|eisenbahn|corona|budweiser|spaten|stella|colorado|bohemia|antarctica/.test(combined)) {
    return {
      ncm: '22030000',
      cest: '03.001.00',
      cfop: '5405',
      kdsStation: 'BAR',
      categoryKeywords: ['cerveja', 'chope', 'chopp', 'bebida'],
      codePrefix: 'CERV'
    };
  }

  // 3. Águas Minerais e Gasosas
  if (/[aá]gua|mineral|crystal|bonafont|minalba|indaia|lindoya|perrier|san pellegrino/.test(combined)) {
    return {
      ncm: '22011000',
      cest: '03.002.00',
      cfop: '5405',
      kdsStation: 'BAR',
      categoryKeywords: ['agua', 'água', 'bebida'],
      codePrefix: 'AGUA'
    };
  }

  // 4. Energéticos e Isotônicos
  if (/energ[eé]tico|energy drink|red bull|monster|tnt|baly|burn|gatorade|powerade/.test(combined)) {
    return {
      ncm: '22029900',
      cest: '03.010.00',
      cfop: '5405',
      kdsStation: 'BAR',
      categoryKeywords: ['energetico', 'energético', 'bebida'],
      codePrefix: 'ENERG'
    };
  }

  // 5. Cachaças e Aguardentes
  if (/cacha[cç]a|aguardente|pinga|51|ypio[cç]a|velho barreiro|salinas|seleta|boazinha|sagadiba/.test(combined)) {
    return {
      ncm: '22084000',
      cest: '02.010.00',
      cfop: '5405',
      kdsStation: 'BAR',
      categoryKeywords: ['cachaça', 'destilado', 'dose', 'bebida'],
      codePrefix: 'CACH'
    };
  }

  // 6. Vodkas
  if (/vodka|smirnoff|absolut|c[iî]roc|ketel one|grey goose|stolichnaya|orloff/.test(combined)) {
    return {
      ncm: '22086000',
      cest: '02.012.00',
      cfop: '5405',
      kdsStation: 'BAR',
      categoryKeywords: ['vodka', 'destilado', 'dose', 'bebida'],
      codePrefix: 'VODK'
    };
  }

  // 7. Whiskies
  if (/whisky|whiskey|bourbon|red label|black label|jack daniel|chivas|ballantine|white horse|johnnie walker|old parr|grant/.test(combined)) {
    return {
      ncm: '22083020',
      cest: '02.008.00',
      cfop: '5405',
      kdsStation: 'BAR',
      categoryKeywords: ['whisky', 'destilado', 'dose', 'bebida'],
      codePrefix: 'WHIS'
    };
  }

  // 8. Gins
  if (/gin|tanqueray|beefeater|bombay|gordon|hendrick|bulldog/.test(combined)) {
    return {
      ncm: '22085000',
      cest: '02.011.00',
      cfop: '5405',
      kdsStation: 'BAR',
      categoryKeywords: ['gin', 'destilado', 'drinks', 'bebida'],
      codePrefix: 'GIN'
    };
  }

  // 9. Vinhos e Espumantes
  if (/vinho|espumante|champanhe|prosecco|cabernet|merlot|malbec|chardonnay|sauvignon|rose|tinto|branco/.test(combined)) {
    return {
      ncm: '22042100',
      cest: '02.024.00',
      cfop: '5405',
      kdsStation: 'BAR',
      categoryKeywords: ['vinho', 'espumante', 'bebida'],
      codePrefix: 'VINH'
    };
  }

  // 10. Sucos e Néctares
  if (/suco|n[eé]ctar|del valle|maguary|camp|ades|prats|tial/.test(combined)) {
    return {
      ncm: '20098990',
      cest: '03.012.00',
      cfop: '5405',
      kdsStation: 'BAR',
      categoryKeywords: ['suco', 'bebida', 'sem alcool'],
      codePrefix: 'SUCO'
    };
  }

  // 11. Salgadinhos, Batatas e Amendoins
  if (/snack|salgadinho|batata|ruffles|doritos|cheetos|fandangos|lays|pringles|amendoim|castanha|torcida/.test(combined)) {
    return {
      ncm: '19059090',
      cest: '17.031.00',
      cfop: '5102',
      kdsStation: 'BAR',
      categoryKeywords: ['petisco', 'snack', 'porção', 'porcao'],
      codePrefix: 'PETI'
    };
  }

  // 12. Doces e Chocolates
  if (/chocolate|bombom|barra|kitkat|bis|snickers|sonho de valsa|ouro branco|diamante negro|laka/.test(combined)) {
    return {
      ncm: '18063110',
      cest: '17.005.00',
      cfop: '5405',
      kdsStation: 'BAR',
      categoryKeywords: ['sobremesa', 'doce', 'chocolate'],
      codePrefix: 'DOCE'
    };
  }

  // 13. Cigarros e Tabacaria
  if (/cigarro|tabaco|marlboro|camel|chesterfield|derby|lucky strike|dunhill|rothmans|palha/.test(combined)) {
    return {
      ncm: '24022000',
      cest: '04.001.00',
      cfop: '5405',
      kdsStation: 'BAR',
      categoryKeywords: ['tabacaria', 'cigarro'],
      codePrefix: 'TABA'
    };
  }

  // 14. Pratos, Hambúrgueres e Cozinha
  if (/hamb[uú]rguer|burger|por[cç][aã]o|carne|frango|batata frita|pastel|pizza|massa|lanche|sandu[ií]che/.test(combined)) {
    return {
      ncm: '21069090',
      cest: null,
      cfop: '5102',
      kdsStation: 'KITCHEN',
      categoryKeywords: ['cozinha', 'lanche', 'porção', 'porcao', 'prato'],
      codePrefix: 'COZ'
    };
  }

  // Padrão Geral
  const isBeverage = /bebida|drink|dose|dose|garrafa|lata|long neck/.test(combined);
  return {
    ncm: isBeverage ? '22029900' : '21069090',
    cest: null,
    cfop: '5102',
    kdsStation: isBeverage ? 'BAR' : 'NONE',
    categoryKeywords: isBeverage ? ['bebida'] : ['geral'],
    codePrefix: 'PRD'
  };
}

// Função para calcular o próximo código numérico sequencial da categoria (ex: 5001 para bebidas, 6001 para doces/chicletes)
export async function getNextSequentialCode(categoryId: string): Promise<string> {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { products: { select: { code: true } } }
  });

  if (!category) return '1001';

  let base = category.codeStart;
  if (!base || base < 1) {
    const catLower = category.name.toLowerCase();
    if (/bebida|cerveja|chope|chopp|drink|dose|destilado|alco/.test(catLower)) {
      base = 5001;
    } else if (/trident|chiclete|bala|doce|sobremesa|tabaco|cigarro/.test(catLower)) {
      base = 6001;
    } else if (/cozinha|petisco|porcao|porção|lanche|burger|prato/.test(catLower)) {
      base = 1001;
    } else {
      base = ((category.sortOrder || 1) > 0 ? category.sortOrder : 1) * 1000 + 1;
    }
  }

  const rangeEnd = base + 999;
  const existingCodes = category.products
    .map((p) => {
      if (!p.code) return NaN;
      const match = p.code.match(/\d+/);
      return match ? parseInt(match[0], 10) : NaN;
    })
    .filter((n) => !isNaN(n) && n >= base && n <= rangeEnd);

  if (existingCodes.length === 0) {
    return String(base);
  }

  const maxCode = Math.max(...existingCodes);
  return String(maxCode + 1);
}

export async function lookupEanCatalog(
  rawEan: string,
  mode: 'all' | 'xml' | 'global' = 'all'
): Promise<CatalogLookupResult> {
  const cleanEan = (rawEan || '').replace(/\D/g, '').trim();

  if (!cleanEan || cleanEan.length < 7) {
    return {
      found: false,
      ean: cleanEan,
      message: 'Código de barras inválido. Deve conter pelo menos 7 dígitos.'
    };
  }

  // 1. Procurar produto já existente no ERP
  if (mode !== 'xml' && mode !== 'global') {
    const existingProduct = await prisma.product.findFirst({
      where: { ean: cleanEan },
      include: { category: true }
    });

    if (existingProduct) {
      return {
        found: true,
        source: 'LOCAL_PRODUCT',
        name: existingProduct.name,
        code: existingProduct.code,
        ean: existingProduct.ean || cleanEan,
        brand: existingProduct.brand,
        supplier: existingProduct.supplier,
        description: existingProduct.description,
        price: existingProduct.price,
        costPrice: existingProduct.costPrice,
        suggestedPrice: existingProduct.price,
        categoryId: existingProduct.categoryId,
        suggestedCategoryId: existingProduct.categoryId,
        kdsStation: existingProduct.kdsStation as any,
        ncm: existingProduct.ncm,
        cfop: existingProduct.cfop,
        cest: existingProduct.cest,
        unit: existingProduct.unit || 'un',
        stock: existingProduct.stock,
        minStock: existingProduct.minStock,
        message: 'Produto já cadastrado no seu banco de dados!'
      };
    }
  }

  // 2. Procurar em Notas Fiscais Recebidas (XML) no banco local
  if (mode === 'all' || mode === 'xml') {
    try {
      const invoices = await prisma.notaRecebida.findMany({
        where: { xmlContent: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 100
      });

      for (const inv of invoices) {
        if (!inv.xmlContent) continue;
        const xml = inv.xmlContent;
        if (xml.includes(cleanEan)) {
          // Encontra o bloco <det> que contém o EAN
          const detRegex = new RegExp(`<det[\\s\\S]*?<cEAN>${cleanEan}<\\/cEAN>[\\s\\S]*?<\\/det>|<det[\\s\\S]*?<cEANTrib>${cleanEan}<\\/cEANTrib>[\\s\\S]*?<\\/det>`, 'i');
          const detMatch = xml.match(detRegex);

          const targetXml = detMatch ? detMatch[0] : xml;

          const xProdMatch = targetXml.match(/<xProd>([^<]+)<\/xProd>/i);
          const cProdMatch = targetXml.match(/<cProd>([^<]+)<\/cProd>/i);
          const ncmMatch = targetXml.match(/<NCM>([^<]+)<\/NCM>/i);
          const cestMatch = targetXml.match(/<CEST>([^<]+)<\/CEST>/i);
          const cfopMatch = targetXml.match(/<CFOP>([^<]+)<\/CFOP>/i);
          const uComMatch = targetXml.match(/<uCom>([^<]+)<\/uCom>/i);
          const vUnComMatch = targetXml.match(/<vUnCom>([^<]+)<\/vUnCom>/i);
          const emitNomeMatch = xml.match(/<emit>[\s\S]*?<xNome>([^<]+)<\/xNome>/i);

          if (xProdMatch && xProdMatch[1]) {
            const rawName = xProdMatch[1].trim();
            const costPrice = vUnComMatch ? parseFloat(vUnComMatch[1]) : null;
            const ncm = ncmMatch ? ncmMatch[1].trim() : null;
            const cest = cestMatch ? cestMatch[1].trim() : null;
            let cfop = cfopMatch ? cfopMatch[1].trim() : '5102';
            if (cfop.startsWith('1') || cfop.startsWith('2')) {
              // Converte CFOP de entrada para saída: 1403/1405 -> 5405; 1102 -> 5102
              cfop = cest || (cfop.includes('403') || cfop.includes('405')) ? '5405' : '5102';
            }
            const unit = uComMatch ? uComMatch[1].trim().toLowerCase() : 'un';
            const supplier = emitNomeMatch ? emitNomeMatch[1].trim() : inv.emitente || null;
            const code = cProdMatch ? cProdMatch[1].trim() : `NF-${cleanEan.slice(-4)}`;

            const tax = inferTaxAndClassification(rawName);

            // Buscar categoria compatível no banco
            const allCategories = await prisma.category.findMany();
            const matchedCat = allCategories.find(c => 
              tax.categoryKeywords.some(kw => c.name.toLowerCase().includes(kw))
            );

            return {
              found: true,
              source: 'NOTA_FISCAL_XML',
              name: rawName,
              code,
              ean: cleanEan,
              brand: null,
              supplier,
              costPrice,
              suggestedPrice: costPrice ? Number((costPrice * 2.2).toFixed(2)) : null,
              suggestedCategoryId: matchedCat?.id || allCategories[0]?.id || null,
              kdsStation: tax.kdsStation,
              ncm: ncm || tax.ncm,
              cfop: cfop || tax.cfop,
              cest: cest || tax.cest,
              unit,
              stock: 100,
              minStock: 10,
              message: `[Nota Fiscal/SEFAZ] Produto localizado nas notas recebidas do fornecedor "${supplier || 'Distribuidora'}". Custo real: R$ ${costPrice?.toFixed(2) || '0.00'}.`
            };
          }
        }
      }

      if (mode === 'xml') {
        return {
          found: false,
          ean: cleanEan,
          source: 'NOTA_FISCAL_XML',
          message: `Código ${cleanEan} não foi encontrado em nenhuma Nota Fiscal de entrada importada no sistema.`
        };
      }
    } catch (err) {
      console.warn('Erro ao consultar notas fiscais locais por EAN:', err);
    }
  }

  // 3. Consultar Open Food Facts (v2 World e v0 BR)
  if (mode === 'all' || mode === 'global') {
    try {
      const urls = [
        `https://world.openfoodfacts.org/api/v2/product/${cleanEan}.json`,
        `https://br.openfoodfacts.org/api/v0/product/${cleanEan}.json`
      ];

      let foundProduct: any = null;

      for (const url of urls) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        try {
          const resp = await fetch(url, {
            headers: {
              'User-Agent': 'BarErpPro/1.0 (bar-erp-pro@local)'
            },
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (resp.ok) {
            const json = await resp.json();
            if (json.status === 1 && json.product) {
              foundProduct = json.product;
              break;
            }
          }
        } catch {
          clearTimeout(timeoutId);
        }
      }

      if (foundProduct) {
        const rawName =
          foundProduct.product_name_pt ||
          foundProduct.product_name ||
          foundProduct.product_name_en ||
          foundProduct.generic_name_pt ||
          foundProduct.generic_name ||
          '';

        const brand = foundProduct.brands || (foundProduct.brands_tags && foundProduct.brands_tags[0]) || null;
        let quantity = (foundProduct.quantity || '').trim();
        const categoriesTags = Array.isArray(foundProduct.categories_tags) ? foundProduct.categories_tags : [];
        const categoriesStr = foundProduct.categories || '';

        // Formatar quantidade inteligentemente (ex: '330' em cervejas vira '330ml')
        let cleanName = rawName.trim();
        if (quantity) {
          if (/^\d+$/.test(quantity)) {
            if (/cervej|refrig|bebida|água|agua|suco|chopp|chope|heineken|coca|pepsi|guaran/i.test(cleanName)) {
              quantity = quantity + 'ml';
            } else {
              quantity = quantity + 'g';
            }
          }
          if (!cleanName.toLowerCase().includes(quantity.toLowerCase())) {
            cleanName = `${cleanName} ${quantity}`;
          }
        }

        const fullName = cleanName || rawName;

        const tax = inferTaxAndClassification(fullName, brand, [categoriesStr, ...categoriesTags]);

        // Formatar CEST se 7 dígitos
        let formattedCest = tax.cest;
        if (formattedCest && formattedCest.length === 7 && !formattedCest.includes('.')) {
          formattedCest = `${formattedCest.slice(0, 2)}.${formattedCest.slice(2, 5)}.${formattedCest.slice(5)}`;
        }

        // Buscar categoria compatível no banco
        const allCategories = await prisma.category.findMany();
        const matchedCat = allCategories.find(c =>
          tax.categoryKeywords.some(kw => c.name.toLowerCase().includes(kw))
        );

        const targetCatId = matchedCat?.id || allCategories[0]?.id || null;
        const suggestedCode = targetCatId ? await getNextSequentialCode(targetCatId) : `${tax.codePrefix}-${cleanEan.slice(-4)}`;

        return {
          found: true,
          source: 'OPEN_FOOD_FACTS',
          name: fullName || name,
          code: suggestedCode,
          ean: cleanEan,
          brand: brand ? String(brand).split(',')[0].trim() : null,
          supplier: brand ? String(brand).split(',')[0].trim() : null,
          description: foundProduct.generic_name || (quantity ? `Embalagem ${quantity}` : null),
          costPrice: null,
          suggestedPrice: null,
          suggestedCategoryId: targetCatId,
          kdsStation: tax.kdsStation,
          ncm: tax.ncm,
          cfop: tax.cfop,
          cest: formattedCest,
          unit: 'un',
          stock: 100,
          minStock: 10,
          message: `[Catálogo Global] Produto localizado! Tributação oficial e NCM ${tax.ncm} preenchidos automaticamente.`
        };
      }

      if (mode === 'global') {
        return {
          found: false,
          ean: cleanEan,
          source: 'OPEN_FOOD_FACTS',
          message: `Código ${cleanEan} não foi encontrado no Catálogo Global/Nacional GTIN.`
        };
      }
    } catch (err) {
      console.warn('Erro ao consultar Open Food Facts:', err);
    }
  }

  // 4. Não encontrado em bases externas ou XML: Sugerir template com base no EAN
  const defaultCode = `PRD-${cleanEan.slice(-4)}`;
  return {
    found: false,
    ean: cleanEan,
    code: defaultCode,
    ncm: '22029900',
    cfop: '5102',
    unit: 'un',
    kdsStation: 'BAR',
    message: 'Produto não localizado nas bases consultadas. Preencha os dados para concluir o cadastro.'
  };
}
