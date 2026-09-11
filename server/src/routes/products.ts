import { Router } from 'express';
import { prisma } from '../prisma.js';
import { lookupEanCatalog, getNextSequentialCode } from '../services/catalogService.js';
import { isBarProduct } from './importXml.js';

export function createProductsRouter() {
  const router = Router();

  // Reorganizar produtos entre Bar (volume em ml) e Cozinha sob demanda
  router.post('/organize-bar-kitchen', async (_req, res) => {
    try {
      let catBar = await (prisma as any).category.findFirst({
        where: { name: { in: ['Bar', 'BAR', 'bar'] } }
      });
      if (!catBar) {
        catBar = await (prisma as any).category.create({
          data: { name: 'Bar', icon: 'Beer', sortOrder: 1, codeStart: 5001 }
        });
      }

      let catCozinha = await (prisma as any).category.findFirst({
        where: { name: { in: ['Cozinha', 'COZINHA', 'cozinha'] } }
      });
      if (!catCozinha) {
        catCozinha = await (prisma as any).category.create({
          data: { name: 'Cozinha', icon: 'UtensilsCrossed', sortOrder: 2, codeStart: 1001 }
        });
      }

      const allProducts = await (prisma as any).product.findMany({
        include: { category: true }
      });

      let barCount = 0;
      let cozinhaCount = 0;

      for (const prod of allProducts) {
        const catName = prod.category?.name || '';
        const isFromImportados = catName.toUpperCase().includes('IMPORTAD');
        const isBar = isBarProduct(prod.name, prod.description, prod.unit);

        if (isFromImportados || (isBar && (prod.categoryId === catCozinha.id || prod.kdsStation !== 'BAR'))) {
          await (prisma as any).product.update({
            where: { id: prod.id },
            data: {
              categoryId: isBar ? catBar.id : (isFromImportados ? catCozinha.id : prod.categoryId),
              kdsStation: isBar ? 'BAR' : (isFromImportados ? 'KITCHEN' : prod.kdsStation)
            }
          });
          if (isBar) barCount++;
          else if (isFromImportados) cozinhaCount++;
        }
      }

      // Deleta categoria IMPORTADOS se estiver vazia
      const catImportados = await (prisma as any).category.findFirst({
        where: { name: { in: ['IMPORTADOS', 'Importados', 'importados'] } },
        include: { _count: { select: { products: true } } }
      });
      if (catImportados && catImportados._count.products === 0) {
        await (prisma as any).category.delete({ where: { id: catImportados.id } });
      }

      res.json({
        ok: true,
        barCount,
        cozinhaCount,
        message: `Organização concluída: ${barCount} produtos no Bar e ${cozinhaCount} na Cozinha.`
      });
    } catch (error: any) {
      console.error('Erro ao organizar produtos:', error);
      res.status(500).json({ error: 'Erro ao reorganizar categorias de produtos' });
    }
  });

  // Obter próximo código numérico sequencial da categoria (ex: 5001 para bebidas, 6001 para chicletes)
  router.get('/categories/:id/next-code', async (req, res) => {
    try {
      const nextCode = await getNextSequentialCode(req.params.id);
      res.json({ categoryId: req.params.id, nextCode });
    } catch (error: any) {
      console.error('Erro ao gerar código sequencial:', error);
      res.status(500).json({ error: 'Erro ao gerar código sequencial' });
    }
  });

  // Atribuir códigos internos a todos os produtos sem código (retroativo)
  router.post('/backfill-codes', async (_req, res) => {
    try {
      // Busca todos os produtos sem código, agrupados por categoria
      const produtosSemCodigo = await (prisma as any).product.findMany({
        where: { OR: [{ code: null }, { code: '' }] },
        select: { id: true, categoryId: true, name: true },
        orderBy: { name: 'asc' }
      });

      if (produtosSemCodigo.length === 0) {
        return res.json({ ok: true, atualizados: 0, mensagem: 'Todos os produtos já possuem código interno.' });
      }

      // Agrupa por categoria para gerar códigos sequenciais sem conflito
      const porCategoria = new Map<string, string[]>();
      for (const p of produtosSemCodigo) {
        const list = porCategoria.get(p.categoryId) || [];
        list.push(p.id);
        porCategoria.set(p.categoryId, list);
      }

      let totalAtualizados = 0;

      for (const [categoryId, ids] of porCategoria) {
        for (const id of ids) {
          // Pega próximo código disponível (considera os já atribuídos nesta sessão)
          const nextCode = await getNextSequentialCode(categoryId);

          await (prisma as any).product.update({
            where: { id },
            data: { code: nextCode }
          });
          totalAtualizados++;
        }
      }

      return res.json({
        ok: true,
        atualizados: totalAtualizados,
        mensagem: `✅ ${totalAtualizados} produtos receberam código interno sequencial.`
      });
    } catch (error: any) {
      console.error('Erro no backfill de códigos:', error);
      res.status(500).json({ error: 'Erro ao atribuir códigos: ' + error.message });
    }
  });

  // Buscar informações fiscais e cadastrais por Código de Barras (EAN / GTIN)
  router.get('/lookup-ean/:ean', async (req, res) => {
    try {
      const { ean } = req.params;
      const mode = (req.query.mode as 'all' | 'xml' | 'global') || 'all';
      const result = await lookupEanCatalog(ean, mode);
      res.json(result);
    } catch (error: any) {
      console.error('Erro na consulta de EAN:', error);
      res.status(500).json({ error: error.message || 'Erro ao consultar código de barras' });
    }
  });

  // Listar produtos
  router.get('/', async (req, res) => {
    try {
      const { categoryId, search, activeOnly } = req.query;

      const whereClause: any = {};
      if (activeOnly !== 'false') {
        whereClause.isActive = true;
      }
      if (categoryId) {
        whereClause.categoryId = String(categoryId);
      }
      if (search) {
        const s = String(search).trim();
        whereClause.OR = [
          { name: { contains: s } },
          { code: { contains: s } },
          { ean: { contains: s } },
          { brand: { contains: s } },
          { supplier: { contains: s } },
          { supplierRel: { name: { contains: s } } },
          { supplierRel: { tradeName: { contains: s } } }
        ];
      }

      const products = await prisma.product.findMany({
        where: whereClause,
        include: { category: true, supplierRel: true, components: { include: { component: true } } },
        orderBy: [{ categoryId: 'asc' }, { name: 'asc' }]
      });

      res.json(products);
    } catch (error) {
      console.error('Erro ao listar produtos:', error);
      res.status(500).json({ error: 'Erro ao listar produtos' });
    }
  });

  // Criar produto
  router.post('/', async (req, res) => {
    try {
      const {
        name,
        code,
        ean,
        supplier,
        supplierId,
        brand,
        ncm,
        cfop,
        cest,
        unit,
        description,
        price,
        costPrice,
        categoryId,
        kdsStation,
        stock,
        minStock,
        components
      } = req.body;

      if (!name || price === undefined || !categoryId) {
        return res.status(400).json({ error: 'Nome, preço e categoria são obrigatórios' });
      }

      let finalCode = code ? String(code).trim() : null;
      if (finalCode) {
        const codeExists = await prisma.product.findFirst({
          where: { code: finalCode },
          select: { id: true }
        });
        if (codeExists && categoryId) {
          finalCode = await getNextSequentialCode(categoryId);
        }
      } else if (categoryId) {
        finalCode = await getNextSequentialCode(categoryId);
      }

      const product = await prisma.product.create({
        data: {
          name: name.trim(),
          code: finalCode,
          ean: ean ? String(ean).trim() : null,
          supplier: supplier ? String(supplier).trim() : null,
          supplierId: supplierId ? String(supplierId).trim() : null,
          brand: brand ? String(brand).trim() : null,
          ncm: ncm ? String(ncm).trim() : null,
          cfop: cfop ? String(cfop).trim() : null,
          cest: cest ? String(cest).trim() : null,
          unit: unit ? String(unit).trim() : 'un',
          description: description || null,
          price: Number(price),
          costPrice: costPrice !== undefined && costPrice !== null && costPrice !== '' ? Number(costPrice) : null,
          hasBoxPrice: Boolean(req.body.hasBoxPrice),
          boxQuantity: req.body.boxQuantity ? parseInt(req.body.boxQuantity, 10) : 24,
          boxPrice: req.body.boxPrice !== undefined && req.body.boxPrice !== null && req.body.boxPrice !== '' ? Number(req.body.boxPrice) : null,
          boxEan: req.body.boxEan ? String(req.body.boxEan).trim() : null,
          categoryId,
          kdsStation: kdsStation || 'BAR',
          stock: stock !== undefined ? Number(stock) : 100,
          minStock: minStock !== undefined ? Number(minStock) : 10,
          ...(components && Array.isArray(components) && components.length > 0 ? {
            components: {
              create: components.map((c: any) => ({
                componentId: c.componentId,
                quantity: Number(c.quantity)
              }))
            }
          } : {})
        },
        include: { category: true, supplierRel: true, components: { include: { component: true } } }
      });

      res.status(201).json(product);
    } catch (error) {
      console.error('Erro ao criar produto:', error);
      res.status(500).json({ error: 'Erro ao criar produto' });
    }
  });

  // Atualizar produto
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        code,
        ean,
        supplier,
        supplierId,
        brand,
        ncm,
        cfop,
        cest,
        unit,
        description,
        price,
        costPrice,
        categoryId,
        kdsStation,
        stock,
        minStock,
        isActive,
        components
      } = req.body;

      const dataToUpdate: any = {};
      if (name !== undefined) dataToUpdate.name = name.trim();
      if (code !== undefined) {
        const cleanCode = code ? String(code).trim() : null;
        if (cleanCode) {
          const codeExists = await prisma.product.findFirst({
            where: { code: cleanCode, id: { not: id } },
            select: { id: true, name: true }
          });
          if (codeExists) {
            return res.status(400).json({ error: `O código #${cleanCode} já está em uso pelo produto "${codeExists.name}".` });
          }
        }
        dataToUpdate.code = cleanCode;
      }
      if (ean !== undefined) dataToUpdate.ean = ean ? String(ean).trim() : null;
      if (supplier !== undefined) dataToUpdate.supplier = supplier ? String(supplier).trim() : null;
      if (supplierId !== undefined) dataToUpdate.supplierId = supplierId ? String(supplierId).trim() : null;
      if (brand !== undefined) dataToUpdate.brand = brand ? String(brand).trim() : null;
      if (ncm !== undefined) dataToUpdate.ncm = ncm ? String(ncm).trim() : null;
      if (cfop !== undefined) dataToUpdate.cfop = cfop ? String(cfop).trim() : null;
      if (cest !== undefined) dataToUpdate.cest = cest ? String(cest).trim() : null;
      if (unit !== undefined) dataToUpdate.unit = unit ? String(unit).trim() : 'un';
      if (description !== undefined) dataToUpdate.description = description;
      if (price !== undefined) dataToUpdate.price = Number(price);
      if (costPrice !== undefined) dataToUpdate.costPrice = costPrice !== null && costPrice !== '' ? Number(costPrice) : null;
      if (req.body.hasBoxPrice !== undefined) dataToUpdate.hasBoxPrice = Boolean(req.body.hasBoxPrice);
      if (req.body.boxQuantity !== undefined) dataToUpdate.boxQuantity = req.body.boxQuantity ? parseInt(req.body.boxQuantity, 10) : 24;
      if (req.body.boxPrice !== undefined) dataToUpdate.boxPrice = req.body.boxPrice !== null && req.body.boxPrice !== '' ? Number(req.body.boxPrice) : null;
      if (req.body.boxEan !== undefined) dataToUpdate.boxEan = req.body.boxEan ? String(req.body.boxEan).trim() : null;
      if (categoryId !== undefined) dataToUpdate.categoryId = categoryId;
      if (kdsStation !== undefined) dataToUpdate.kdsStation = kdsStation;
      if (stock !== undefined) dataToUpdate.stock = Number(stock);
      if (minStock !== undefined) dataToUpdate.minStock = Number(minStock);
      if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive);

      if (components && Array.isArray(components)) {
        dataToUpdate.components = {
          deleteMany: {}, // Limpa os antigos
          create: components.map((c: any) => ({
            componentId: c.componentId,
            quantity: Number(c.quantity)
          }))
        };
      }

      const product = await prisma.product.update({
        where: { id },
        data: dataToUpdate,
        include: { category: true, supplierRel: true, components: { include: { component: true } } }
      });

      res.json(product);
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
      res.status(500).json({ error: 'Erro ao atualizar produto' });
    }
  });

  // Ajuste rápido de estoque
  router.put('/:id/stock', async (req, res) => {
    try {
      const { id } = req.params;
      const { adjustment, newStock } = req.body;

      let product;
      if (newStock !== undefined) {
        product = await prisma.product.update({
          where: { id },
          data: { stock: Number(newStock) }
        });
      } else if (adjustment !== undefined) {
        product = await prisma.product.update({
          where: { id },
          data: { stock: { increment: Number(adjustment) } }
        });
      } else {
        return res.status(400).json({ error: 'Informe adjustment ou newStock' });
      }

      res.json(product);
    } catch (error) {
      console.error('Erro ao atualizar estoque:', error);
      res.status(500).json({ error: 'Erro ao atualizar estoque' });
    }
  });

  // Listar Categorias
  router.get('/categories/all', async (req, res) => {
    try {
      const categories = await prisma.category.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: {
            select: { products: true }
          }
        }
      });
      res.json(categories);
    } catch (error) {
      console.error('Erro ao listar categorias:', error);
      res.status(500).json({ error: 'Erro ao listar categorias' });
    }
  });

  // Criar Categoria
  router.post('/categories', async (req, res) => {
    try {
      const { name, icon, sortOrder, codeStart } = req.body;
      if (!name) return res.status(400).json({ error: 'Nome da categoria é obrigatório' });

      // Buscar faixas já utilizadas para não colidir
      const existingCategories = await prisma.category.findMany({
        select: { codeStart: true }
      });
      const usedStarts = new Set(existingCategories.map(c => c.codeStart).filter(Boolean));

      let finalCodeStart = codeStart ? Number(codeStart) : null;
      if (!finalCodeStart) {
        const lower = name.toLowerCase();
        let preferred = 1001;
        if (/bar|cerveja|chope|chopp|drink|dose|destilado|vinho|whisky|vodka|gin/.test(lower)) {
          preferred = 5001;
        } else if (/trident|chiclete|bala|doce|sobremesa|tabaco|cigarro|conveniencia|conveniência/.test(lower)) {
          preferred = 6001;
        } else if (/cozinha|prato|refeic|almoco|jantar/.test(lower)) {
          preferred = 1001;
        } else if (/porcao|porção|petisco|lanche|burger|hamburguer|pastel/.test(lower)) {
          preferred = 2001;
        } else if (/pizza|massa/.test(lower)) {
          preferred = 3001;
        } else if (/bebida|refrigerante|suco|agua|água|energetico|energético/.test(lower)) {
          preferred = 4001;
        } else if (/alimento|comida/.test(lower)) {
          preferred = 2001;
        } else {
          preferred = 1001;
        }

        if (usedStarts.has(preferred)) {
          let candidate = 1001;
          while (usedStarts.has(candidate)) {
            candidate += 1000;
          }
          finalCodeStart = candidate;
        } else {
          finalCodeStart = preferred;
        }
      }

      const category = await prisma.category.create({
        data: {
          name,
          icon: icon || 'Beer',
          sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
          codeStart: finalCodeStart
        }
      });
      res.status(201).json(category);
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      res.status(500).json({ error: 'Erro ao criar categoria' });
    }
  });

  // Atualizar Categoria
  router.put('/categories/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, icon, sortOrder, codeStart } = req.body;

      const dataToUpdate: any = {};
      if (name !== undefined) dataToUpdate.name = name;
      if (icon !== undefined) dataToUpdate.icon = icon;
      if (sortOrder !== undefined) dataToUpdate.sortOrder = Number(sortOrder);
      if (codeStart !== undefined) dataToUpdate.codeStart = Number(codeStart);

      const category = await prisma.category.update({
        where: { id },
        data: dataToUpdate
      });
      res.json(category);
    } catch (error) {
      console.error('Erro ao atualizar categoria:', error);
      res.status(500).json({ error: 'Erro ao atualizar categoria' });
    }
  });

  // Renumerar sequencialmente todos os produtos de uma categoria a partir de seu codeStart
  router.post('/categories/:id/resequence', async (req, res) => {
    try {
      const { id } = req.params;
      const category = await prisma.category.findUnique({
        where: { id },
        include: { products: { orderBy: { name: 'asc' } } }
      });

      if (!category) {
        return res.status(404).json({ error: 'Categoria não encontrada' });
      }

      const base = category.codeStart || 1001;

      // Buscar códigos de produtos de outras categorias para não conflitar
      const otherProducts = await prisma.product.findMany({
        where: { categoryId: { not: id } },
        select: { code: true }
      });
      const usedCodes = new Set<string>();
      for (const p of otherProducts) {
        if (p.code) usedCodes.add(p.code.trim());
      }

      let currentCode = base;
      let atualizados = 0;

      for (const prod of category.products) {
        while (usedCodes.has(String(currentCode))) {
          currentCode++;
        }
        const newCode = String(currentCode);
        usedCodes.add(newCode);

        await prisma.product.update({
          where: { id: prod.id },
          data: { code: newCode }
        });
        atualizados++;
        currentCode++;
      }

      res.json({
        ok: true,
        atualizados,
        mensagem: `✅ ${atualizados} produtos da categoria "${category.name}" renumerados sequencialmente a partir de #${base}.`
      });
    } catch (error: any) {
      console.error('Erro ao renumerar categoria:', error);
      res.status(500).json({ error: 'Erro ao renumerar produtos da categoria: ' + error.message });
    }
  });

  // Corrigir códigos duplicados ou em branco no catálogo
  router.post('/fix-duplicate-codes', async (req, res) => {
    try {
      const { mode } = req.body || {}; // 'duplicates_only' | 'resequence_all'

      if (mode === 'resequence_all') {
        const categories = await prisma.category.findMany({
          orderBy: { sortOrder: 'asc' },
          include: { products: { orderBy: { name: 'asc' } } }
        });

        const usedCodes = new Set<string>();
        let totalAtualizados = 0;

        for (const cat of categories) {
          let codeNum = cat.codeStart || 1001;
          for (const prod of cat.products) {
            while (usedCodes.has(String(codeNum))) {
              codeNum++;
            }
            const codeStr = String(codeNum);
            usedCodes.add(codeStr);

            await prisma.product.update({
              where: { id: prod.id },
              data: { code: codeStr }
            });
            totalAtualizados++;
            codeNum++;
          }
        }

        return res.json({
          ok: true,
          duplicadosEncontrados: 0,
          atualizados: totalAtualizados,
          mensagem: `✅ Todo o cardápio foi renumerado por categoria com códigos exclusivos (${totalAtualizados} produtos).`
        });
      }

      // Modo padrão: 'duplicates_only'
      const allProducts = await prisma.product.findMany({
        select: { id: true, name: true, code: true, categoryId: true },
        orderBy: [{ categoryId: 'asc' }, { name: 'asc' }]
      });

      const codeOccurrences = new Map<string, string[]>();
      const missingCodeIds: string[] = [];

      for (const p of allProducts) {
        if (!p.code || !p.code.trim()) {
          missingCodeIds.push(p.id);
        } else {
          const c = p.code.trim();
          const list = codeOccurrences.get(c) || [];
          list.push(p.id);
          codeOccurrences.set(c, list);
        }
      }

      const keptCodes = new Set<string>();
      const needsNewCode: { id: string; categoryId: string }[] = [];

      for (const [code, ids] of codeOccurrences) {
        keptCodes.add(code);
        // O primeiro produto fica com o código original; os seguintes recebem novo código
        for (let i = 1; i < ids.length; i++) {
          const prod = allProducts.find(p => p.id === ids[i]);
          if (prod) needsNewCode.push({ id: prod.id, categoryId: prod.categoryId });
        }
      }

      for (const id of missingCodeIds) {
        const prod = allProducts.find(p => p.id === id);
        if (prod) needsNewCode.push({ id: prod.id, categoryId: prod.categoryId });
      }

      if (needsNewCode.length === 0) {
        return res.json({
          ok: true,
          duplicadosEncontrados: 0,
          atualizados: 0,
          mensagem: 'Nenhum código duplicado ou em branco foi encontrado. O cardápio já está 100% íntegro!'
        });
      }

      const categories = await prisma.category.findMany();
      const catMap = new Map<string, number>();
      for (const c of categories) {
        catMap.set(c.id, c.codeStart || 1001);
      }

      let atualizados = 0;
      for (const item of needsNewCode) {
        const base = catMap.get(item.categoryId) || 1001;
        let candidate = base;
        while (keptCodes.has(String(candidate))) {
          candidate++;
        }
        const newCode = String(candidate);
        keptCodes.add(newCode);

        await prisma.product.update({
          where: { id: item.id },
          data: { code: newCode }
        });
        atualizados++;
      }

      res.json({
        ok: true,
        duplicadosEncontrados: needsNewCode.length,
        atualizados,
        mensagem: `✅ ${atualizados} produto(s) com numeração duplicada ou ausente foram corrigidos com códigos únicos!`
      });
    } catch (error: any) {
      console.error('Erro ao corrigir códigos duplicados:', error);
      res.status(500).json({ error: 'Erro ao corrigir duplicidades: ' + error.message });
    }
  });

  // Excluir Produto
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const product = await prisma.product.findUnique({
        where: { id }
      });

      if (!product) {
        return res.status(404).json({ error: 'Produto não encontrado' });
      }

      // Verificar se há itens em comandas abertas no momento
      const openItemsCount = await prisma.orderItem.count({
        where: {
          productId: id,
          order: { status: 'OPEN' }
        }
      });

      if (openItemsCount > 0) {
        return res.status(400).json({
          error: `Não é possível excluir o produto "${product.name}" pois ele está em ${openItemsCount} comanda(s) aberta(s) no momento. Feche o atendimento das mesas antes de excluir.`
        });
      }

      // Excluir pedidos históricos com este produto e o produto em si
      await prisma.orderItem.deleteMany({
        where: { productId: id }
      });

      await prisma.product.delete({
        where: { id }
      });

      res.json({ success: true, message: `Produto "${product.name}" excluído com sucesso!` });
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      res.status(500).json({ error: 'Erro ao excluir produto' });
    }
  });

  // Excluir Categoria
  router.delete('/categories/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { force } = req.query;

      const category = await prisma.category.findUnique({
        where: { id }
      });

      if (!category) {
        return res.status(404).json({ error: 'Categoria não encontrada' });
      }

      const productsCount = await prisma.product.count({
        where: { categoryId: id }
      });

      if (productsCount > 0 && force !== 'true') {
        return res.status(400).json({
          error: `Esta categoria possui ${productsCount} produto(s) associado(s). Exclua ou mova os produtos primeiro.`
        });
      }

      if (productsCount > 0 && force === 'true') {
        const prods = await prisma.product.findMany({
          where: { categoryId: id },
          select: { id: true }
        });
        const prodIds = prods.map((p) => p.id);
        await prisma.orderItem.deleteMany({
          where: { productId: { in: prodIds } }
        });
        await prisma.product.deleteMany({
          where: { categoryId: id }
        });
      }

      await prisma.category.delete({
        where: { id }
      });

      res.json({ success: true, message: `Categoria "${category.name}" excluída com sucesso!` });
    } catch (error) {
      console.error('Erro ao excluir categoria:', error);
      res.status(500).json({ error: 'Erro ao excluir categoria' });
    }
  });

  return router;
}
