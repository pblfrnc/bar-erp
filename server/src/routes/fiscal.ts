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

      // Mapeamento para requisição na Focus NFe
      const baseURL = settings.environment === 'producao' 
        ? 'https://api.focusnfe.com.br/v2/nfce'
        : 'https://homologacao.focusnfe.com.br/v2/nfce';

      const focusPayload = {
        natureza_operacao: 'VENDA DE MERCADORIA',
        presenca_comprador: '1',
        cpf_cnpj_destinatario: customerCpf ? customerCpf.replace(/\D/g, '') : undefined,
        itens: items.map((i: any, index: number) => ({
          numero_item: String(index + 1),
          codigo_produto: i.productId,
          descricao: i.name,
          cfop: i.cfop || '5102', // Fallback se o NCM for mágico
          ncm: i.ncm || '21069090', 
          unidade_comercial: 'UN',
          quantidade_comercial: String(i.quantity),
          valor_unitario_comercial: String(i.price),
          valor_bruto: String((i.quantity * i.price).toFixed(2)),
          icms_situacao_tributaria: (i.cfop === '5405') ? '500' : '102', // 500 = ICMS cobrado ant por ST. 102 = Simples Nacional sem permissão de crédito
          icms_origem: '0',
          pis_situacao_tributaria: '08', // Operação sem incidência
          cofins_situacao_tributaria: '08'
        })),
        formas_pagamento: [
          {
            forma_pagamento: '01', // 01 = Dinheiro (padrão genérico pra simplificar)
            valor_pagamento: String(items.reduce((acc: number, i: any) => acc + (i.price * i.quantity), 0).toFixed(2))
          }
        ]
      };

      console.log('Enviando NFC-e para:', baseURL);
      const focusRes = await fetch(baseURL + '?dry_run=0', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(settings.apiToken + ':').toString('base64')
        },
        body: JSON.stringify(focusPayload)
      });

      const data = await focusRes.json();
      
      if (!focusRes.ok) {
        throw new Error(JSON.stringify(data.erros || data.mensagem || data));
      }

      // Se a nota já voltar autorizada de cara
      if (data.status === 'autorizado') {
        return res.json({
          success: true,
          status: data.status,
          chaveAcesso: data.chave_nfe,
          caminhoDanfe: baseURL + '/' + data.ref + '/danfe.pdf'
        });
      }

      // Caso seja 'processando', aguardamos 2s e tentamos buscar 1x pra ver se autorizou rápido
      if (data.status === 'processando') {
        await new Promise(resolve => setTimeout(resolve, 2500));
        const checkRes = await fetch(baseURL + '/' + data.ref, {
          headers: { 'Authorization': 'Basic ' + Buffer.from(settings.apiToken + ':').toString('base64') }
        });
        const checkData = await checkRes.json();
        
        if (checkData.status === 'autorizado') {
          return res.json({
            success: true,
            status: checkData.status,
            chaveAcesso: checkData.chave_nfe,
            caminhoDanfe: baseURL + '/' + data.ref + '/danfe.pdf' // Note que o PDF real pode vir no json, usamos a URL direta da API Focus
          });
        }
        
        // Se ainda não estiver pronto, retorna o status para o usuário ver
        if (checkData.status === 'erro_autorizacao') {
           throw new Error(JSON.stringify(checkData.erros || checkData.mensagem));
        }

        return res.json({
          success: true,
          status: checkData.status,
          mensagem: 'A nota está na fila da SEFAZ. Você poderá consultar depois.',
          ref: data.ref
        });
      }

      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao conectar com API Fiscal.' });
    }
  });

  return router;
}
