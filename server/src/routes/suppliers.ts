import { Router } from 'express';
import { prisma } from '../prisma.js';

export function createSuppliersRouter() {
  const router = Router();

  // Listar fornecedores com busca
  router.get('/', async (req, res) => {
    try {
      const { search } = req.query;
      const whereClause: any = {};

      if (search) {
        const s = String(search).trim();
        whereClause.OR = [
          { name: { contains: s } },
          { tradeName: { contains: s } },
          { document: { contains: s } },
          { contactName: { contains: s } },
          { city: { contains: s } },
          { phone: { contains: s } }
        ];
      }

      const suppliers = await prisma.supplier.findMany({
        where: whereClause,
        include: {
          _count: {
            select: { products: true }
          }
        },
        orderBy: [{ name: 'asc' }]
      });

      res.json(suppliers);
    } catch (error) {
      console.error('Erro ao listar fornecedores:', error);
      res.status(500).json({ error: 'Erro ao listar fornecedores' });
    }
  });

  // Obter detalhes de um fornecedor
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const supplier = await prisma.supplier.findUnique({
        where: { id },
        include: {
          products: {
            select: { id: true, name: true, code: true, price: true, stock: true }
          },
          _count: { select: { products: true } }
        }
      });

      if (!supplier) {
        return res.status(404).json({ error: 'Fornecedor não encontrado' });
      }

      res.json(supplier);
    } catch (error) {
      console.error('Erro ao buscar fornecedor:', error);
      res.status(500).json({ error: 'Erro ao buscar fornecedor' });
    }
  });

  // Cadastrar fornecedor
  router.post('/', async (req, res) => {
    try {
      const {
        name,
        tradeName,
        document,
        ie,
        phone,
        email,
        city,
        state,
        address,
        contactName,
        notes
      } = req.body;

      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Razão Social / Nome é obrigatório' });
      }

      const digitsOnly = document ? String(document).replace(/\D/g, '') : '';
      const cleanDoc = digitsOnly.length > 0 ? digitsOnly : null;

      if (cleanDoc) {
        const existing = await prisma.supplier.findUnique({
          where: { document: cleanDoc }
        });
        if (existing) {
          return res.status(400).json({ error: 'Já existe um fornecedor cadastrado com este CNPJ/CPF' });
        }
      }

      const supplier = await prisma.supplier.create({
        data: {
          name: String(name).trim(),
          tradeName: tradeName ? String(tradeName).trim() : null,
          document: cleanDoc,
          ie: ie ? String(ie).trim() : null,
          phone: phone ? String(phone).trim() : null,
          email: email ? String(email).trim() : null,
          city: city ? String(city).trim() : null,
          state: state ? String(state).trim() : null,
          address: address ? String(address).trim() : null,
          contactName: contactName ? String(contactName).trim() : null,
          notes: notes ? String(notes).trim() : null
        }
      });

      res.status(201).json(supplier);
    } catch (error: any) {
      console.error('Erro ao criar fornecedor:', error);
      res.status(500).json({ error: error.message || 'Erro ao criar fornecedor' });
    }
  });

  // Atualizar fornecedor
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        tradeName,
        document,
        ie,
        phone,
        email,
        city,
        state,
        address,
        contactName,
        notes
      } = req.body;

      let cleanDoc: string | null | undefined = undefined;
      if (document !== undefined) {
        if (document === null) {
          cleanDoc = null;
        } else {
          const digits = String(document).replace(/\D/g, '');
          cleanDoc = digits.length > 0 ? digits : null;
        }
      }

      if (cleanDoc) {
        const existing = await prisma.supplier.findUnique({
          where: { document: cleanDoc }
        });
        if (existing && existing.id !== id) {
          return res.status(400).json({ error: 'Outro fornecedor já utiliza este CNPJ/CPF' });
        }
      }

      const dataToUpdate: any = {};
      if (name !== undefined) dataToUpdate.name = String(name).trim();
      if (tradeName !== undefined) dataToUpdate.tradeName = tradeName ? String(tradeName).trim() : null;
      if (cleanDoc !== undefined) dataToUpdate.document = cleanDoc;
      if (ie !== undefined) dataToUpdate.ie = ie ? String(ie).trim() : null;
      if (phone !== undefined) dataToUpdate.phone = phone ? String(phone).trim() : null;
      if (email !== undefined) dataToUpdate.email = email ? String(email).trim() : null;
      if (city !== undefined) dataToUpdate.city = city ? String(city).trim() : null;
      if (state !== undefined) dataToUpdate.state = state ? String(state).trim() : null;
      if (address !== undefined) dataToUpdate.address = address ? String(address).trim() : null;
      if (contactName !== undefined) dataToUpdate.contactName = contactName ? String(contactName).trim() : null;
      if (notes !== undefined) dataToUpdate.notes = notes ? String(notes).trim() : null;

      const supplier = await prisma.supplier.update({
        where: { id },
        data: dataToUpdate
      });

      res.json(supplier);
    } catch (error: any) {
      console.error('Erro ao atualizar fornecedor:', error);
      res.status(500).json({ error: error.message || 'Erro ao atualizar fornecedor' });
    }
  });

  // Excluir fornecedor
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;

      // Desvincular produtos antes de deletar
      await prisma.product.updateMany({
        where: { supplierId: id },
        data: { supplierId: null }
      });

      await prisma.supplier.delete({
        where: { id }
      });

      res.json({ success: true, message: 'Fornecedor removido com sucesso' });
    } catch (error: any) {
      console.error('Erro ao excluir fornecedor:', error);
      res.status(500).json({ error: error.message || 'Erro ao excluir fornecedor' });
    }
  });

  return router;
}
