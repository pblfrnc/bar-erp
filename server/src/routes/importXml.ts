import { Router } from 'express';
import multer from 'multer';
import { XMLParser } from 'fast-xml-parser';
import { prisma } from '../prisma.js';
import iconv from 'iconv-lite';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Funções de classificação inteligente Bar (ml) vs Cozinha
export function isBarProduct(name: string, description?: string | null, unit?: string | null): boolean {
  const text = `${name || ''} ${description || ''}`.toLowerCase();
  const u = String(unit || '').trim().toUpperCase();

  // 1. Volume explícito em ML (ex: 350ml, 350 ml, 500ML, 600 ml, 1000ml, 275ml, 330ml, etc)
  if (/\b\d+(?:[.,]\d+)?\s*(?:ml|m\.l\.)\b/i.test(text)) {
    return true;
  }

  // 2. Unidade de medida declarada como ML, L ou LT
  if (u === 'ML' || u === 'L' || u === 'LT' || u === 'LTS') {
    return true;
  }

  // 3. Volume em Litros (ex: 1L, 2L, 1.5L, 2 Litros, 1 Litro)
  if (/\b\d+(?:[.,]\d+)?\s*(?:l|lt|litro|litros)\b/i.test(text)) {
    return true;
  }

  // 4. Termos e marcas clássicas de bebidas de bar
  if (/cervej|chopp|chope|beer|refrigerante|coca[-\s]?cola|pepsi|guaran[aá]|fanta|sprite|schweppes|vodka|whisky|whiskey|gin\b|cacha[cç]a|pinga|rum\b|tequila|licor|vinho|espumante|champagne|suco|energ[eé]tico|red bull|monster|água|agua mineral|long neck|lat[aã]o|ice\b|campari|aperol|conhaque|sake|saqu[eê]|destilado|dose\b|coquetel|drink/i.test(text)) {
    return true;
  }

  return false;
}

export function isKitchenProduct(name: string, description?: string | null): boolean {
  const text = `${name || ''} ${description || ''}`.toLowerCase();
  return /hamb[uú]rguer|burger|lanche|sandu[ií]che|por[cç][aã]o|petisco|batata|mandioca|polenta|carne|picanha|frango|peixe|camar[aã]o|pastel|pizza|massa|espeto|prato|salada|almo[cç]o|jantar|tira[-\s]?gosto|sobremesa|caldo|sopa|molho|pastel[aã]o|torta/i.test(text);
}

export function createImportXmlRouter() {
  const router = Router();

  router.post('/tabelas', upload.single('xml'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

      // Converte ISO-8859-1 → UTF-8 (encoding declarado no XML do programa antigo)
      const xmlText = iconv.decode(req.file.buffer, 'iso-8859-1');

      const parser = new XMLParser({
        ignoreAttributes: false,
        isArray: (name) => ['categoria', 'subcategoria', 'fabricante', 'fornecedor', 'ncm', 'produto'].includes(name),
        parseTagValue: true,
        trimValues: true,
      });

      const parsed = parser.parse(xmlText);
      const tabelas = parsed?.Tabelas || parsed?.tabelas || parsed;

      const resultado = {
        categorias: { importadas: 0, ignoradas: 0 },
        fornecedores: { importados: 0, ignorados: 0, duplicados: 0 },
        produtos: { importados: 0, ignorados: 0, atualizados: 0, bar: 0, cozinha: 0 },
        erros: [] as string[],
      };

      // ────────────────────────────────────────────────
      // 1. CATEGORIAS (Subcategorias têm prioridade — são as categorias de produtos)
      // ────────────────────────────────────────────────
      const categoriasXml: any[] = tabelas?.Subcategorias?.subcategoria || tabelas?.Categorias?.categoria || [];
      // Mapa legado id → Category do banco (para vincular produtos depois)
      const catIdMap = new Map<string, string>(); // xmlId → dbId

      for (const cat of categoriasXml) {
        try {
          const nome = String(cat.nome || '').trim().toUpperCase();
          if (!nome || nome === 'PADRAO' || nome === 'IMPORTADOS') { resultado.categorias.ignoradas++; continue; }

          // Tenta reaproveitar categoria existente pelo nome
          let existing = await (prisma as any).category.findFirst({ where: { name: nome } });
          if (!existing) {
            existing = await (prisma as any).category.create({
              data: { name: nome, icon: 'Package', sortOrder: 10 }
            });
            resultado.categorias.importadas++;
          }
          catIdMap.set(String(cat.id), existing.id);
        } catch (e: any) {
          resultado.erros.push(`Categoria "${cat.nome}": ${e.message}`);
        }
      }

      // Localiza ou cria a categoria padrão BAR (para tudo com volume em ml / bebidas)
      let catBar = await (prisma as any).category.findFirst({
        where: { name: { in: ['Bar', 'BAR', 'bar'] } }
      });
      if (!catBar) {
        catBar = await (prisma as any).category.create({
          data: { name: 'Bar', icon: 'Beer', sortOrder: 1, codeStart: 5001 }
        });
      }

      // Localiza ou cria a categoria padrão COZINHA (para alimentos e itens sem ml)
      let catCozinha = await (prisma as any).category.findFirst({
        where: { name: { in: ['Cozinha', 'COZINHA', 'cozinha'] } }
      });
      if (!catCozinha) {
        catCozinha = await (prisma as any).category.create({
          data: { name: 'Cozinha', icon: 'UtensilsCrossed', sortOrder: 2, codeStart: 1001 }
        });
      }

      // ────────────────────────────────────────────────
      // 2. FORNECEDORES
      // ────────────────────────────────────────────────
      const IGNORAR_FORNECEDORES = ['PADRAO', 'AJUSTE DE ESTOQUE'];
      const fornecedoresXml: any[] = tabelas?.Fornecedores?.fornecedor || [];
      const fornIdMap = new Map<string, string>(); // xmlId → dbId

      for (const f of fornecedoresXml) {
        try {
          const nome = String(f.nome || '').trim().toUpperCase();
          const razaoSocial = String(f.razao_social || f.nome || '').trim();
          if (!razaoSocial || IGNORAR_FORNECEDORES.includes(nome)) {
            resultado.fornecedores.ignorados++;
            continue;
          }

          const cnpjRaw = String(f.cnpj_cpf || '').replace(/\D/g, '');
          const cnpj = cnpjRaw === '00000000000000' || cnpjRaw.length < 11 ? null : cnpjRaw;
          const phone = String(f.fone || '').replace(/[^0-9()\- ]/g, '').trim();
          const address = [f.endereco, f.numero].filter(Boolean).join(', ').trim();
          const ie = String(f.ie || '').trim() || null;

          // Verifica duplicata por CNPJ ou nome
          let existing: any = null;
          if (cnpj) {
            existing = await prisma.supplier.findUnique({ where: { document: cnpj } }).catch(() => null);
          }
          if (!existing) {
            existing = await (prisma as any).supplier.findFirst({
              where: { name: { equals: razaoSocial } }
            });
          }

          if (existing) {
            fornIdMap.set(String(f.id), existing.id);
            resultado.fornecedores.duplicados++;
            continue;
          }

          const created = await prisma.supplier.create({
            data: {
              name: razaoSocial,
              tradeName: nome !== razaoSocial.toUpperCase() ? nome : undefined,
              document: cnpj || undefined,
              ie: ie || undefined,
              phone: phone && phone.replace(/\D/g, '').length >= 8 ? phone : undefined,
              address: address || undefined,
              city: String(f.cidade_codigocidade || '').trim() || undefined,
            }
          });
          fornIdMap.set(String(f.id), created.id);
          resultado.fornecedores.importados++;
        } catch (e: any) {
          resultado.erros.push(`Fornecedor "${f.nome}": ${e.message}`);
        }
      }

      // ────────────────────────────────────────────────
      // 3. PRODUTOS (se existir no XML)
      // ────────────────────────────────────────────────
      const produtosXml: any[] = tabelas?.Produtos?.produto || [];

      for (const p of produtosXml) {
        try {
          // Somente importa produtos ativos
          const ativo = String(p.ativo) === '1';
          if (!ativo) { resultado.produtos.ignorados++; continue; }

          // Somente produtos do tipo PRODUTO (não serviço, etc)
          const tipoProduto = String(p.tipo_produto || 'PRODUTO').trim().toUpperCase();
          if (tipoProduto !== 'PRODUTO') { resultado.produtos.ignorados++; continue; }

          const nome = String(p.nome || p.descricao || '').trim();
          if (!nome || nome.length < 2) { resultado.produtos.ignorados++; continue; }

          // Preços — usar preco_venda / preco_custo / preco_compra
          const precoVenda = parseFloat(String(p.preco_venda || '0').replace(',', '.')) || 0;
          const precoCusto = parseFloat(String(p.preco_custo || p.preco_compra || '0').replace(',', '.')) || 0;

          // Estoque: saldo é float no XML → converte para int
          const estoque = Math.round(parseFloat(String(p.saldo || '0').replace(',', '.')) || 0);

          // EAN / código de barras
          const ean = String(p.codigo_barras || '').trim().replace(/\D/g, '') || undefined;
          const eanValido = ean && ean.length >= 8 ? ean : undefined;

          // NCM — usar <ncmCodigo> (o <ncm> embutido costuma estar vazio)
          const ncmRaw = String(p.ncmCodigo || p.ncm?.codigo || '').replace(/\D/g, '');
          const ncm = ncmRaw && ncmRaw !== '00000000' && ncmRaw.length === 8 ? ncmRaw : undefined;

          // CEST
          const cestRaw = String(p.cestCodigo || '').replace(/\D/g, '');
          const cest = cestRaw && cestRaw !== '0000000' ? cestRaw : undefined;

          // Código interno
          const code = String(p.codigo || '').trim() || undefined;

          // Descrição secundária
          const descricao = String(p.observacoes || '').trim() || undefined;

          // Unidade do produto
          const unidadeXml = String(p.unidade || p.un || p.unid || '').trim();

          // Vincula fornecedor via id_fornecedor → fornIdMap
          const fornXmlId = String(p.id_fornecedor || '0');
          const supplierId = fornIdMap.get(fornXmlId) || undefined;

          // ── DIRECIONAMENTO INTELIGENTE BAR (VOLUME EM ML) vs COZINHA ──
          const isBar = isBarProduct(nome, descricao, unidadeXml);
          const isKitchen = isKitchenProduct(nome, descricao);

          let targetCategoryId: string;
          let targetKdsStation: 'BAR' | 'KITCHEN' | 'NONE';

          if (isBar) {
            // Regra Primária: Qualquer produto com volume em ML ou bebida vai para a categoria Bar
            targetCategoryId = catBar.id;
            targetKdsStation = 'BAR';
          } else {
            // Se não for Bar, verifica se o XML trouxe categoria mapeada válida
            const catXmlId = String(p.id_subcategoria || p.id_categoria || '0');
            const mappedCatId = catIdMap.get(catXmlId);
            if (mappedCatId) {
              targetCategoryId = mappedCatId;
              targetKdsStation = isKitchen ? 'KITCHEN' : 'NONE';
            } else {
              // Sem categoria mapeada → direciona para Cozinha
              targetCategoryId = catCozinha.id;
              targetKdsStation = 'KITCHEN';
            }
          }

          // Verifica duplicata por EAN ou por nome
          let existing: any = null;
          if (eanValido) {
            existing = await (prisma as any).product.findFirst({
              where: { ean: eanValido },
              include: { category: true }
            });
          }
          if (!existing) {
            existing = await (prisma as any).product.findFirst({
              where: { name: nome },
              include: { category: true }
            });
          }

          if (existing) {
            const existingCatName = existing.category?.name || '';
            const isOldImportCategory = existingCatName.toUpperCase().includes('IMPORTAD');

            await (prisma as any).product.update({
              where: { id: existing.id },
              data: {
                price:     precoVenda > 0 ? precoVenda : existing.price,
                costPrice: precoCusto > 0 ? precoCusto : existing.costPrice,
                stock:     estoque,
                ...(eanValido  ? { ean: eanValido }  : {}),
                ...(ncm        ? { ncm }              : {}),
                ...(cest       ? { cest }             : {}),
                ...(supplierId ? { supplierId }       : {}),
                // Se estava em IMPORTADOS ou era Bar com volume em ml, corrige a categoria e estação
                ...((isOldImportCategory || (isBar && existing.categoryId !== catBar.id)) ? {
                  categoryId: targetCategoryId,
                  kdsStation: targetKdsStation,
                } : {}),
              }
            });
            resultado.produtos.atualizados++;
          } else {
            await (prisma as any).product.create({
              data: {
                name:        nome,
                description: descricao,
                price:       precoVenda > 0 ? precoVenda : 0.01,
                costPrice:   precoCusto > 0 ? precoCusto : undefined,
                stock:       estoque,
                trackStock:  true,
                ean:         eanValido,
                ncm,
                cest,
                code,
                unit:        unidadeXml || 'un',
                categoryId:  targetCategoryId,
                supplierId,
                kdsStation:  targetKdsStation,
              }
            });
            resultado.produtos.importados++;
            if (isBar) {
              resultado.produtos.bar++;
            } else {
              resultado.produtos.cozinha++;
            }
          }
        } catch (e: any) {
          resultado.erros.push(`Produto "${p.nome || p.descricao}": ${e.message}`);
        }
      }

      // Esvazia e deleta a categoria IMPORTADOS se ela ainda existir e estiver sem produtos
      try {
        const oldImportCat = await (prisma as any).category.findFirst({
          where: { name: { in: ['IMPORTADOS', 'Importados', 'importados'] } },
          include: { _count: { select: { products: true } } }
        });
        if (oldImportCat && oldImportCat._count.products === 0) {
          await (prisma as any).category.delete({ where: { id: oldImportCat.id } });
        }
      } catch {}

      return res.json({
        ok: true,
        resumo: resultado,
        mensagem: [
          `✅ ${resultado.categorias.importadas} categorias importadas`,
          `✅ ${resultado.fornecedores.importados} fornecedores importados (${resultado.fornecedores.duplicados} já existiam)`,
          resultado.produtos.importados > 0  ? `✅ ${resultado.produtos.importados} produtos importados (${resultado.produtos.bar} no Bar e ${resultado.produtos.cozinha} na Cozinha)` : null,
          resultado.produtos.atualizados > 0 ? `🔄 ${resultado.produtos.atualizados} produtos atualizados` : null,
          resultado.erros.length > 0         ? `⚠️ ${resultado.erros.length} erros (veja detalhes)` : null,
        ].filter(Boolean).join('\n'),
      });

    } catch (err: any) {
      console.error('[import-xml]', err);
      return res.status(500).json({ error: 'Erro ao processar XML: ' + err.message });
    }
  });

  return router;
}
