import { Router } from 'express';
import { prisma } from '../prisma.js';

export function createProductsRouter() {
  const router = Router();

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
        whereClause.name = { contains: String(search) };
      }

      const products = await prisma.product.findMany({
        where: whereClause,
        include: { category: true },
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
      const { name, description, price, costPrice, categoryId, kdsStation, stock, minStock } = req.body;

      if (!name || price === undefined || !categoryId) {
        return res.status(400).json({ error: 'Nome, preço e categoria são obrigatórios' });
      }

      const product = await prisma.product.create({
        data: {
          name,
          description: description || null,
          price: Number(price),
          costPrice: costPrice ? Number(costPrice) : null,
          categoryId,
          kdsStation: kdsStation || 'BAR',
          stock: stock !== undefined ? Number(stock) : 100,
          minStock: minStock !== undefined ? Number(minStock) : 10
        },
        include: { category: true }
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
      const { name, description, price, costPrice, categoryId, kdsStation, stock, minStock, isActive } = req.body;

      const dataToUpdate: any = {};
      if (name !== undefined) dataToUpdate.name = name;
      if (description !== undefined) dataToUpdate.description = description;
      if (price !== undefined) dataToUpdate.price = Number(price);
      if (costPrice !== undefined) dataToUpdate.costPrice = Number(costPrice);
      if (categoryId !== undefined) dataToUpdate.categoryId = categoryId;
      if (kdsStation !== undefined) dataToUpdate.kdsStation = kdsStation;
      if (stock !== undefined) dataToUpdate.stock = Number(stock);
      if (minStock !== undefined) dataToUpdate.minStock = Number(minStock);
      if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive);

      const product = await prisma.product.update({
        where: { id },
        data: dataToUpdate,
        include: { category: true }
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
