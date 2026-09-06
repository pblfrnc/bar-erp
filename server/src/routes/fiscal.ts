import { Router } from 'express';
import multer from 'multer';
import { XMLParser } from 'fast-xml-parser';
import { prisma } from '../prisma.js';

const upload = multer({ storage: multer.memoryStorage() });
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

export function createFiscalRouter() {
  const router = Router();

  // Recebe e processa o arquivo XML
  router.post('/import-xml', upload.single('xml'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
      
      const xmlData = req.file.buffer.toString('utf-8');
      const jsonObj = parser.parse(xmlData);

      // Verificar se é uma NFe válida
      const nfe = jsonObj.nfeProc?.NFe?.infNFe;
      if (!nfe) {
        return res.status(400).json({ error: 'O arquivo não parece ser um XML válido de NF-e.' });
      }

      const emit = nfe.emit;
      let det = nfe.det;
      if (!Array.isArray(det)) det = [det]; // Pode ser apenas 1 item

      const items = det.map((d: any, index: number) => {
        const prod = d.prod;
        return {
          id: `xml_item_${index}`,
          code: prod.cProd,
          name: prod.xProd,
          quantity: parseFloat(prod.qCom),
          unitCost: parseFloat(prod.vUnCom),
          ncm: prod.NCM,
          cfop: prod.CFOP,
          unit: prod.uCom
        };
      });

      res.json({
        vendor: {
          name: emit.xNome,
          cnpj: emit.CNPJ
        },
        items,
        accessKey: nfe['@_Id']?.replace('NFe', '')
      });
    } catch (err: any) {
      console.error('Erro ao importar XML:', err);
      res.status(500).json({ error: 'Erro ao processar arquivo XML.' });
    }
  });

  // Aplica as associações no banco de dados
  router.post('/apply-import', async (req, res) => {
    try {
      const { items } = req.body;
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Nenhum item para importar.' });
      }

      const results = { updated: 0, created: 0 };

      for (const item of items) {
        // item: { xmlItem: { name, quantity, unitCost }, action: 'LINK' | 'NEW', productId?: string, categoryId?: string }
        
        if (item.action === 'LINK' && item.productId) {
          // Atualiza produto existente
          await prisma.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.xmlItem.quantity },
              costPrice: item.xmlItem.unitCost
            }
          });
          results.updated++;
        } else if (item.action === 'NEW' && item.categoryId) {
          // Cria novo produto
          await prisma.product.create({
            data: {
              name: item.xmlItem.name,
              price: item.xmlItem.unitCost * 2, // Sugestão: markup de 100%
              costPrice: item.xmlItem.unitCost,
              stock: item.xmlItem.quantity,
              categoryId: item.categoryId
            }
          });
          results.created++;
        }
      }

      res.json({ success: true, results });
    } catch (err: any) {
      console.error('Erro ao aplicar XML:', err);
      res.status(500).json({ error: 'Erro ao aplicar importação.' });
    }
  });

  
  // Obter configurações fiscais
  router.get('/settings', async (req, res) => {
    try {
      let settings = await (prisma as any).fiscalSettings.findUnique({ where: { id: 'default' } });
      if (!settings) {
        settings = await (prisma as any).fiscalSettings.create({ data: { id: 'default' } });
      }
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao buscar configurações fiscais.' });
    }
  });

  // Salvar configurações fiscais
  router.put('/settings', async (req, res) => {
    try {
      const data = req.body;
      const settings = await (prisma as any).fiscalSettings.upsert({
        where: { id: 'default' },
        update: data,
        create: { id: 'default', ...data }
      });
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao salvar configurações fiscais.' });
    }
  });

  // Emitir NFC-e (Mock / Homologação Inicial)
  router.post('/emit-nfce', async (req, res) => {
    try {
      const { items, customerCpf } = req.body;
      
      // Validações básicas
      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'Nenhum item adicionado para a nota.' });
      }

      const settings = await (prisma as any).fiscalSettings.findUnique({ where: { id: 'default' } });
      if (!settings || !settings.apiToken) {
        return res.status(400).json({ error: 'Token da API Fiscal não configurado. Vá nas Configurações Fiscais.' });
      }

      // TODO: Aqui integraríamos o axios/fetch enviando para a URL da Focus NFe.
      // Para o momento, vamos simular que a SEFAZ autorizou com sucesso.
      
      console.log('Emitindo NFC-e com Focus NFe (Mock)...');
      console.log('Cliente CPF:', customerCpf || 'Não informado');
      console.log('Itens:', items);

      // Simular atraso da SEFAZ
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock da resposta
      res.json({
        success: true,
        status: 'autorizado',
        numero: Math.floor(Math.random() * 10000) + 1000,
        serie: '1',
        chaveAcesso: '352401' + settings.cnpj?.replace(/\D/g, '') + '650010000000011000000010',
        caminhoDanfe: 'https://cdn.focusnfe.com.br/danfe/demo-cupom.pdf'
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao conectar com API Fiscal.' });
    }
  });

  return router;
}
