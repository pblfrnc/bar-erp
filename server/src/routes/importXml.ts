import { Router } from 'express';
import multer from 'multer';
import { XMLParser } from 'fast-xml-parser';
import { prisma } from '../prisma.js';
import iconv from 'iconv-lite';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

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
        produtos: { importados: 0, ignorados: 0, atualizados: 0 },
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
          if (!nome || nome === 'PADRAO') { resultado.categorias.ignoradas++; continue; }

          // Tenta reaproveitar categoria existente pelo nome
          let existing = await (prisma as any).category.findFirst({ where: { name: nome } });
          if (!existing) {
            existing = await (prisma as any).category.create({
              data: { name: nome, icon: 'Package', sortOrder: 0 }
            });
            resultado.categorias.importadas++;
          }
          catIdMap.set(String(cat.id), existing.id);
        } catch (e: any) {
          resultado.erros.push(`Categoria "${cat.nome}": ${e.message}`);
        }
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

      // Garante que existe pelo menos uma categoria padrão para produtos sem categoria
      let defaultCategory = await (prisma as any).category.findFirst({ where: { name: 'IMPORTADOS' } });
      if (!defaultCategory && produtosXml.length > 0) {
        defaultCategory = await (prisma as any).category.create({
          data: { name: 'IMPORTADOS', icon: 'Package', sortOrder: 999 }
        });
      }

      for (const p of produtosXml) {
        try {
          const nome = String(p.nome || p.descricao || '').trim();
          if (!nome) { resultado.produtos.ignorados++; continue; }

          const ativo = String(p.ativo) === '1' || String(p.ativo).toLowerCase() === 'true';
          if (!ativo) { resultado.produtos.ignorados++; continue; }

          const precoPedidoRaw = parseFloat(String(p.preco_venda || p.valor_venda || p.preco || '0').replace(',', '.')) || 0;
          const precoCustoRaw  = parseFloat(String(p.custo     || p.preco_custo  || '0').replace(',', '.')) || 0;
          const estoque        = parseInt(String(p.estoque_atual || p.estoque || '0'), 10) || 0;
          const ean            = String(p.codigo_barras || p.ean || p.gtin || '').trim() || undefined;
          const ncm            = String(p.ncm || p.codigo_ncm || '').replace(/\D/g, '').slice(0, 8) || undefined;
          const code           = String(p.codigo || p.cod || '').trim() || undefined;

          // Vincula categoria
          const catXmlId = String(p.id_subcategoria || p.id_categoria || '');
          const categoryId = catIdMap.get(catXmlId) || defaultCategory?.id;
          if (!categoryId) { resultado.produtos.ignorados++; continue; }

          // Vincula fornecedor
          const fornXmlId = String(p.id_fornecedor || '');
          const supplierId = fornIdMap.get(fornXmlId) || undefined;

          // Verifica duplicata por EAN ou nome+categoria
          let existing: any = null;
          if (ean) {
            existing = await (prisma as any).product.findFirst({ where: { ean } });
          }
          if (!existing) {
            existing = await (prisma as any).product.findFirst({
              where: { name: nome, categoryId }
            });
          }

          if (existing) {
            // Atualiza preço e estoque se o produto já existe
            await (prisma as any).product.update({
              where: { id: existing.id },
              data: {
                price: precoPedidoRaw > 0 ? precoPedidoRaw : existing.price,
                costPrice: precoCustoRaw > 0 ? precoCustoRaw : existing.costPrice,
                stock: estoque,
                ...(ean ? { ean } : {}),
                ...(ncm ? { ncm } : {}),
                ...(supplierId ? { supplierId } : {}),
              }
            });
            resultado.produtos.atualizados++;
          } else {
            await (prisma as any).product.create({
              data: {
                name: nome,
                description: String(p.observacao || '').trim() || undefined,
                price: precoPedidoRaw > 0 ? precoPedidoRaw : 0.01,
                costPrice: precoCustoRaw > 0 ? precoCustoRaw : undefined,
                stock: estoque,
                trackStock: true,
                ean: ean || undefined,
                ncm: ncm || undefined,
                code: code || undefined,
                categoryId,
                supplierId,
                kdsStation: 'BAR',
              }
            });
            resultado.produtos.importados++;
          }
        } catch (e: any) {
          resultado.erros.push(`Produto "${p.nome || p.descricao}": ${e.message}`);
        }
      }

      return res.json({
        ok: true,
        resumo: resultado,
        mensagem: [
          `✅ ${resultado.categorias.importadas} categorias importadas`,
          `✅ ${resultado.fornecedores.importados} fornecedores importados (${resultado.fornecedores.duplicados} já existiam)`,
          resultado.produtos.importados > 0  ? `✅ ${resultado.produtos.importados} produtos importados`  : null,
          resultado.produtos.atualizados > 0 ? `🔄 ${resultado.produtos.atualizados} produtos atualizados` : null,
          resultado.erros.length > 0         ? `⚠️ ${resultado.erros.length} erros (veja detalhes)`       : null,
        ].filter(Boolean).join('\n'),
      });

    } catch (err: any) {
      console.error('[import-xml]', err);
      return res.status(500).json({ error: 'Erro ao processar XML: ' + err.message });
    }
  });

  return router;
}
