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

  // ============================================================
  // Validar API Fiscal (Testar Token da Focus NFe)
  // ============================================================
  router.get('/validate-api', async (req, res) => {
    try {
      const settings = await (prisma as any).fiscalSettings.findUnique({ where: { id: 'default' } });

      if (!settings?.apiToken) {
        return res.status(400).json({
          ok: false,
          error: 'Token da API não configurado. Preencha o Token nas Configurações Fiscais.'
        });
      }

      const isProducao = settings.environment === 'producao';
      const baseURL = isProducao
        ? 'https://api.focusnfe.com.br'
        : 'https://homologacao.focusnfe.com.br';

      const authHeader = 'Basic ' + Buffer.from(settings.apiToken + ':').toString('base64');

      // Testa o token tentando listar as empresas vinculadas à conta
      const focusRes = await fetch(`${baseURL}/v2/empresas`, {
        headers: { 'Authorization': authHeader }
      });

      if (focusRes.status === 401) {
        return res.json({
          ok: false,
          error: 'Token inválido ou sem permissão. Verifique se o Token está correto e é de produção/homologação conforme o ambiente configurado.',
          status: 401,
          ambiente: isProducao ? 'Produção' : 'Homologação'
        });
      }

      if (!focusRes.ok) {
        const errData = await focusRes.json().catch(() => ({}));
        return res.json({
          ok: false,
          error: `Focus NFe retornou erro ${focusRes.status}: ${JSON.stringify(errData)}`,
          status: focusRes.status,
          ambiente: isProducao ? 'Produção' : 'Homologação'
        });
      }

      const empresas = await focusRes.json();
      const total = Array.isArray(empresas) ? empresas.length : 0;

      // Verificar se o CNPJ configurado já está cadastrado
      const cnpjLimpo = (settings.cnpj || '').replace(/\D/g, '');
      const empresaCadastrada = Array.isArray(empresas) && cnpjLimpo
        ? empresas.find((e: any) => (e.cnpj || '').replace(/\D/g, '') === cnpjLimpo)
        : null;

      return res.json({
        ok: true,
        ambiente: isProducao ? '🟢 Produção (Notas Válidas)' : '🟡 Homologação (Testes)',
        totalEmpresas: total,
        cnpjConfigurado: settings.cnpj || null,
        empresaCadastrada: empresaCadastrada
          ? `✓ CNPJ encontrado na Focus NFe: ${empresaCadastrada.nome_fantasia || empresaCadastrada.nome || settings.cnpj}`
          : cnpjLimpo
          ? '⚠️ CNPJ configurado ainda não registrado na Focus NFe. Salve as configurações para cadastrar.'
          : 'ℹ️ Nenhum CNPJ configurado ainda.',
        mensagem: `Conexão com a Focus NFe estabelecida. ${total} empresa(s) vinculada(s) nesta conta.`
      });

    } catch (err: any) {
      return res.json({
        ok: false,
        error: 'Não foi possível conectar à Focus NFe. Verifique sua conexão com a internet.',
        detalhe: err.message
      });
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

  
  // Salvar configurações fiscais (Agora suporta Onboarding de Software House)
  router.put('/settings', upload.single('certificado'), async (req, res) => {
    try {
      const settingsStr = req.body.settings;
      if (!settingsStr) return res.status(400).json({ error: 'Dados não enviados.' });
      const data = JSON.parse(settingsStr);
      const certPassword = req.body.certPassword;
      
      // Cria a empresa na Focus NFe (Software House Model)
      if (data.apiToken && data.cnpj && data.logradouro && data.cep) {
        const baseURL = data.environment === 'producao' 
          ? 'https://api.focusnfe.com.br/v2/empresas'
          : 'https://homologacao.focusnfe.com.br/v2/empresas';
          
        let certBase64 = undefined;
        if (req.file) {
           certBase64 = req.file.buffer.toString('base64');
        }

        const empresaPayload = {
          nome: data.razaoSocial || "Razao Social Nao Informada",
          nome_fantasia: data.nomeFantasia || data.razaoSocial || "Nome Fantasia Nao Informado",
          cnpj: data.cnpj.replace(/\D/g, ''),
          inscricao_estadual: data.ie,
          regime_tributario: data.crt || '1',
          logradouro: data.logradouro,
          numero: data.numero || 'S/N',
          bairro: data.bairro,
          cep: data.cep.replace(/\D/g, ''),
          municipio: data.municipio,
          uf: data.uf,
          enviar_email_destinatario: false,
          csc_nfce_producao: data.cscSecret,
          id_token_nfce_producao: data.cscId,
          csc_nfce_homologacao: data.cscSecret,
          id_token_nfce_homologacao: data.cscId,
        };

        if (certBase64 && certPassword) {
           (empresaPayload as any).arquivo_certificado_base64 = certBase64;
           (empresaPayload as any).senha_certificado = certPassword;
        }

        const focusRes = await fetch(baseURL + '?dry_run=0', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + Buffer.from(data.apiToken + ':').toString('base64')
          },
          body: JSON.stringify(empresaPayload)
        });

        const focusData = await focusRes.json();
        
        // Em homologação, se a empresa já existir, o endpoint de POST pode retornar erro,
        // mas para fins de protótipo de Software House, se retornar erro de CNPJ existente,
        // podemos tentar dar um PUT ou ignorar. Focus NFe retorna 400 se já existir.
        if (!focusRes.ok) {
           console.log("Erro da Focus NFe ao cadastrar empresa:", focusData);
           if (!JSON.stringify(focusData).includes('já cadastrado') && !JSON.stringify(focusData).includes('already exist')) {
              return res.status(400).json({ error: JSON.stringify(focusData.erros || focusData.mensagem || focusData) });
           }
        }
      }

      // Salva no banco local
      const settings = await (prisma as any).fiscalSettings.upsert({
        where: { id: 'default' },
        update: data,
        create: { id: 'default', ...data }
      });
      res.json(settings);
    } catch (err: any) {
      console.error(err);
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
      const focusRes = await fetch(baseURL + '?cnpj_emitente=' + settings.cnpj.replace(/\D/g, '') + '&dry_run=0', {
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
        const checkRes = await fetch(baseURL + '/' + data.ref + '?cnpj_emitente=' + settings.cnpj.replace(/\D/g, ''), {
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


  // ============================================================
  // MÓDULO: BIP DE CHAVE DE ACESSO (Recebimento de NF)
  // ============================================================

  // Bipa uma chave de acesso de 44 dígitos:
  // 1. Registra Ciência da Operação na SEFAZ (via Focus NFe)
  // 2. Baixa o XML completo
  // 3. Salva o registro local no banco
  router.post('/bip-chave', async (req, res) => {
    try {
      const { chave } = req.body;
      if (!chave || chave.replace(/\D/g, '').length !== 44) {
        return res.status(400).json({ error: 'Chave de acesso inválida. Deve ter 44 dígitos numéricos.' });
      }

      const chaveClean = chave.replace(/\D/g, '');

      const settings = await (prisma as any).fiscalSettings.findUnique({ where: { id: 'default' } });
      if (!settings?.apiToken || !settings?.cnpj) {
        return res.status(400).json({ error: 'Configure o Token da API e o CNPJ nas Configurações Fiscais antes de usar o bip.' });
      }

      const isProducao = settings.environment === 'producao';
      const baseURL = isProducao
        ? 'https://api.focusnfe.com.br'
        : 'https://homologacao.focusnfe.com.br';

      const authHeader = 'Basic ' + Buffer.from(settings.apiToken + ':').toString('base64');

      // PASSO 1: Registrar Ciência da Operação na SEFAZ
      const manifestoRes = await fetch(`${baseURL}/v2/nfes_recebidas/${chaveClean}/manifesto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
        body: JSON.stringify({ tipo: 'ciencia' })
      });

      const manifestoData = await manifestoRes.json();
      
      // Continua mesmo se a ciência já foi registrada antes (erro esperado)
      const manifestoOk = manifestoRes.ok || JSON.stringify(manifestoData).includes('ciencia');
      if (!manifestoOk) {
        console.warn('[Bip] Aviso na manifestação:', manifestoData);
      }

      // PASSO 2: Aguardar um momento e baixar o XML
      await new Promise(r => setTimeout(r, 1500));

      const xmlRes = await fetch(`${baseURL}/v2/nfes_recebidas/${chaveClean}`, {
        headers: { 'Authorization': authHeader }
      });

      const xmlData = await xmlRes.json();

      if (!xmlRes.ok) {
        return res.status(400).json({ error: 'Nota não encontrada na base da Focus NFe. Tente novamente em alguns segundos.' });
      }

      // PASSO 3: Salvar registro local
      const NotaRecebida = (prisma as any).notaRecebida;
      
      // Garantir que a tabela existe
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "NotaRecebida" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "chave" TEXT NOT NULL UNIQUE,
          "emitente" TEXT,
          "cnpjEmitente" TEXT,
          "numero" TEXT,
          "serie" TEXT,
          "dataEmissao" TEXT,
          "valorTotal" REAL,
          "status" TEXT NOT NULL DEFAULT 'recebida',
          "xmlContent" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const now = new Date().toISOString();
      await prisma.$executeRawUnsafe(`
        INSERT OR REPLACE INTO "NotaRecebida"
          ("id", "chave", "emitente", "cnpjEmitente", "numero", "serie", "dataEmissao", "valorTotal", "status", "xmlContent", "createdAt")
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        chaveClean,
        chaveClean,
        xmlData.nome_emitente || '',
        xmlData.cnpj_emitente || '',
        xmlData.numero || '',
        xmlData.serie || '',
        xmlData.data_emissao || '',
        parseFloat(xmlData.valor_total || '0'),
        'recebida',
        xmlData.caminho_xml_nota_fiscal ? JSON.stringify({ url: xmlData.caminho_xml_nota_fiscal }) : null,
        now
      );

      res.json({
        success: true,
        chave: chaveClean,
        emitente: xmlData.nome_emitente,
        cnpjEmitente: xmlData.cnpj_emitente,
        numero: xmlData.numero,
        serie: xmlData.serie,
        dataEmissao: xmlData.data_emissao,
        valorTotal: xmlData.valor_total,
        xmlUrl: xmlData.caminho_xml_nota_fiscal,
        mensagem: 'Nota registrada com Ciência da Operação e XML disponível para importação.'
      });
    } catch (err: any) {
      console.error('[Bip] Erro:', err);
      res.status(500).json({ error: 'Erro ao processar a chave de acesso.' });
    }
  });

  // Listar Notas Recebidas (registros locais)
  router.get('/notas-recebidas', async (req, res) => {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "NotaRecebida" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "chave" TEXT NOT NULL UNIQUE,
          "emitente" TEXT,
          "cnpjEmitente" TEXT,
          "numero" TEXT,
          "serie" TEXT,
          "dataEmissao" TEXT,
          "valorTotal" REAL,
          "status" TEXT NOT NULL DEFAULT 'recebida',
          "xmlContent" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      const notas = await prisma.$queryRawUnsafe(`
        SELECT * FROM "NotaRecebida" ORDER BY "createdAt" DESC LIMIT 50
      `);
      res.json(notas);
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao listar notas recebidas.' });
    }
  });

  // Baixar XML de uma nota recebida para importação de itens
  router.get('/notas-recebidas/:chave/xml', async (req, res) => {
    try {
      const { chave } = req.params;
      const settings = await (prisma as any).fiscalSettings.findUnique({ where: { id: 'default' } });
      if (!settings?.apiToken) {
        return res.status(400).json({ error: 'Token da API não configurado.' });
      }

      const isProducao = settings.environment === 'producao';
      const baseURL = isProducao
        ? 'https://api.focusnfe.com.br'
        : 'https://homologacao.focusnfe.com.br';

      const authHeader = 'Basic ' + Buffer.from(settings.apiToken + ':').toString('base64');

      const xmlRes = await fetch(`${baseURL}/v2/nfes_recebidas/${chave}/xml`, {
        headers: { 'Authorization': authHeader }
      });

      if (!xmlRes.ok) {
        return res.status(404).json({ error: 'XML não disponível ainda. Aguarde alguns segundos e tente novamente.' });
      }

      const xmlText = await xmlRes.text();
      res.setHeader('Content-Type', 'application/xml');
      res.send(xmlText);
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao baixar XML.' });
    }
  });

  return router;
}

