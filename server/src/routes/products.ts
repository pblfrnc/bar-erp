import { Router } from 'express';
import { prisma } from '../prisma.js';
import { lookupEanCatalog } from '../services/catalogService.js';

export function createProductsRouter() {
  const router = Router();

  // Buscar informações fiscais e cadastrais por Código de Barras (EAN / GTIN)
  router.get('/lookup-ean/:ean', async (req, res) => {
    try {
      const { ean } = req.params;
      const result = await lookupEanCatalog(ean);
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
          { supplier: { contains: s } }
        ];
      }

      const products = await prisma.product.findMany({
        where: whereClause,
        include: { category: true, components: { include: { component: true } } },
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

      const product = await prisma.product.create({
        data: {
          name: name.trim(),
          code: code ? String(code).trim() : null,
          ean: ean ? String(ean).trim() : null,
          supplier: supplier ? String(supplier).trim() : null,
          brand: brand ? String(brand).trim() : null,
          ncm: ncm ? String(ncm).trim() : null,
          cfop: cfop ? String(cfop).trim() : null,
          cest: cest ? String(cest).trim() : null,
          unit: unit ? String(unit).trim() : 'un',
          description: description || null,
          price: Number(price),
          costPrice: costPrice !== undefined && costPrice !== null && costPrice !== '' ? Number(costPrice) : null,
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
        include: { category: true, components: { include: { component: true } } }
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
      if (code !== undefined) dataToUpdate.code = code ? String(code).trim() : null;
      if (ean !== undefined) dataToUpdate.ean = ean ? String(ean).trim() : null;
      if (supplier !== undefined) dataToUpdate.supplier = supplier ? String(supplier).trim() : null;
      if (brand !== undefined) dataToUpdate.brand = brand ? String(brand).trim() : null;
      if (ncm !== undefined) dataToUpdate.ncm = ncm ? String(ncm).trim() : null;
      if (cfop !== undefined) dataToUpdate.cfop = cfop ? String(cfop).trim() : null;
      if (cest !== undefined) dataToUpdate.cest = cest ? String(cest).trim() : null;
      if (unit !== undefined) dataToUpdate.unit = unit ? String(unit).trim() : 'un';
      if (description !== undefined) dataToUpdate.description = description;
      if (price !== undefined) dataToUpdate.price = Number(price);
      if (costPrice !== undefined) dataToUpdate.costPrice = costPrice !== null && costPrice !== '' ? Number(costPrice) : null;
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
        include: { category: true, components: { include: { component: true } } }
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
      const { name, icon, sortOrder } = req.body;
      if (!name) return res.status(400).json({ error: 'Nome da categoria é obrigatório' });

      const category = await prisma.category.create({
        data: {
          name,
          icon: icon || 'Beer',
          sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0
        }
      });
      res.status(201).json(category);
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      res.status(500).json({ error: 'Erro ao criar categoria' });
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
