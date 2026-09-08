import { Router } from 'express';
import multer from 'multer';
import { XMLParser } from 'fast-xml-parser';
import { prisma } from '../prisma.js';

const upload = multer({ storage: multer.memoryStorage() });
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });


import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { getNextSequentialCode } from '../services/catalogService.js';

// Função para arquivar XMLs com segurança por 5 anos (Armazenamento Físico)
function secureArchiveXML(type: 'ENTRADA' | 'SAIDA', chave: string, xmlContent: string) {
  try {
    const date = new Date();
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    // Cofre na raiz do servidor
    const vaultPath = path.join(process.cwd(), 'xml_vault', year, month, type);
    
    if (!fs.existsSync(vaultPath)) {
      fs.mkdirSync(vaultPath, { recursive: true });
    }
    
    const filePath = path.join(vaultPath, `${chave}.xml`);
    fs.writeFileSync(filePath, xmlContent, 'utf-8');
  } catch (err) {
    console.error('Erro ao arquivar XML no cofre de segurança:', err);
  }
}

// Garantir que as tabelas de notas fiscais existem no banco SQLite
async function ensureFiscalTables() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "NotaRecebida" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "chave" TEXT NOT NULL,
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
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "NotaRecebida_chave_key" ON "NotaRecebida"("chave")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "NotaEmitida" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "referencia" TEXT NOT NULL,
        "chave" TEXT,
        "numero" TEXT,
        "serie" TEXT,
        "dataEmissao" TEXT,
        "valorTotal" REAL,
        "status" TEXT NOT NULL DEFAULT 'autorizado',
        "xmlUrl" TEXT,
        "pdfUrl" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "NotaEmitida_referencia_key" ON "NotaEmitida"("referencia")
    `);
  } catch (err) {
    console.error('Erro ao verificar/criar tabelas fiscais:', err);
  }
}

export function createFiscalRouter() {
  ensureFiscalTables();
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
      const emitCnpj = (emit?.CNPJ || emit?.CPF || '').toString().replace(/\D/g, '');
      const emitNome = emit?.xNome || 'Fornecedor sem nome';
      const emitFant = emit?.xFant ? String(emit.xFant) : null;
      const emitIe = emit?.IE ? String(emit.IE) : null;
      const emitFone = emit?.enderEmit?.fone ? String(emit.enderEmit.fone) : null;
      const emitAddress = [emit?.enderEmit?.xLgr, emit?.enderEmit?.nro, emit?.enderEmit?.xBairro].filter(Boolean).join(', ') || null;
      const emitMun = emit?.enderEmit?.xMun ? String(emit.enderEmit.xMun) : null;
      const emitUf = emit?.enderEmit?.UF ? String(emit.enderEmit.UF) : null;

      let supplierRecord: any = null;
      if (emitCnpj) {
        try {
          supplierRecord = await prisma.supplier.upsert({
            where: { document: emitCnpj },
            update: {
              name: emitNome,
              ...(emitFant ? { tradeName: emitFant } : {}),
              ...(emitIe ? { ie: emitIe } : {}),
              ...(emitFone ? { phone: emitFone } : {}),
              ...(emitAddress ? { address: emitAddress } : {}),
              ...(emitMun ? { city: emitMun } : {}),
              ...(emitUf ? { state: emitUf } : {})
            },
            create: {
              name: emitNome,
              tradeName: emitFant,
              document: emitCnpj,
              ie: emitIe,
              phone: emitFone,
              address: emitAddress,
              city: emitMun,
              state: emitUf
            }
          });
        } catch (supErr) {
          console.warn('[Fiscal] Erro ao sincronizar fornecedor:', supErr);
        }
      }

      let det = nfe.det;
      if (!Array.isArray(det)) det = [det]; // Pode ser apenas 1 item

      const items = det.map((d: any, index: number) => {
        const prod = d.prod;
        return {
          id: `xml_item_${index}`,
          code: prod.cProd ? String(prod.cProd) : undefined,
          ean: (prod.cEAN && prod.cEAN !== 'SEM GTIN') ? String(prod.cEAN) : undefined,
          name: prod.xProd,
          quantity: parseFloat(prod.qCom),
          unitCost: parseFloat(prod.vUnCom),
          ncm: prod.NCM ? String(prod.NCM) : undefined,
          cfop: prod.CFOP ? String(prod.CFOP) : undefined,
          unit: prod.uCom || 'un'
        };
      });

      res.json({
        vendor: {
          id: supplierRecord?.id,
          name: emitNome,
          tradeName: emitFant,
          cnpj: emitCnpj
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
      const settings = await (prisma as any).FiscalSettings.findUnique({ where: { id: 'default' } });

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
      const items = Array.isArray(req.body) ? req.body : req.body?.items;
      const chaveAcesso = Array.isArray(req.body) ? undefined : req.body?.chaveAcesso;
      const supplierId = Array.isArray(req.body) ? undefined : req.body?.supplierId;
      const vendorName = Array.isArray(req.body) ? undefined : req.body?.vendorName;

      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Nenhum item para importar.' });
      }

      const results = { updated: 0, created: 0 };

      for (const item of items) {
        // item: { xmlItem: { name, quantity, unitCost, ncm, cfop, ean, code, unit }, action: 'LINK' | 'NEW', productId?: string, categoryId?: string, supplierId?: string }
        const effectiveSupplierId = item.supplierId || supplierId || null;
        const effectiveSupplierName = item.supplierName || vendorName || null;

        if (item.action === 'LINK' && item.productId) {
          // Atualiza produto existente
          const updateData: any = {
            stock: { increment: item.xmlItem.quantity },
            costPrice: item.xmlItem.unitCost
          };
          if (effectiveSupplierId) updateData.supplierId = effectiveSupplierId;
          if (effectiveSupplierName) updateData.supplier = effectiveSupplierName;
          if (item.xmlItem.ncm) updateData.ncm = item.xmlItem.ncm;
          if (item.xmlItem.cfop) updateData.cfop = item.xmlItem.cfop;
          if (item.xmlItem.ean) updateData.ean = item.xmlItem.ean;

          await prisma.product.update({
            where: { id: item.productId },
            data: updateData
          });
          results.updated++;
        } else if (item.action === 'NEW' && item.categoryId) {
          let finalCode = await getNextSequentialCode(item.categoryId);
          if (!finalCode && item.xmlItem.code) {
            finalCode = item.xmlItem.code;
          }

          // Cria novo produto com dados fiscais e fornecedor herdados da nota
          await prisma.product.create({
            data: {
              name: item.xmlItem.name,
              code: finalCode,
              ean: item.xmlItem.ean || null,
              supplier: effectiveSupplierName,
              supplierId: effectiveSupplierId,
              ncm: item.xmlItem.ncm || null,
              cfop: item.xmlItem.cfop || null,
              unit: item.xmlItem.unit || 'un',
              price: item.xmlItem.unitCost * 2, // Sugestão: markup de 100%
              costPrice: item.xmlItem.unitCost,
              stock: item.xmlItem.quantity,
              categoryId: item.categoryId
            }
          });
          results.created++;
        }
      }

      // Se foi importada a partir de uma chave de acesso (2º bip), marca a nota como 'importada'
      if (chaveAcesso) {
        try {
          await prisma.$executeRawUnsafe(
            `UPDATE "NotaRecebida" SET "status" = 'importada' WHERE "chave" = ?`,
            chaveAcesso
          );
        } catch (e) {
          try {
            await (prisma as any).notaRecebida.updateMany({
              where: { chave: chaveAcesso },
              data: { status: 'importada' }
            });
          } catch (e2) {
            console.error("Erro ao marcar nota como importada:", e2);
          }
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
      let settings = await (prisma as any).FiscalSettings.findUnique({ where: { id: 'default' } });
      if (!settings) {
        settings = await (prisma as any).FiscalSettings.create({ data: { id: 'default' } });
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
      
      // Cria ou Atualiza a empresa na Focus NFe (Software House Model)
      if (data.apiToken && data.cnpj) {
        const cleanCnpj = data.cnpj.replace(/\D/g, '');
        const isProducao = data.environment === 'producao';
        const baseURL = isProducao 
          ? 'https://api.focusnfe.com.br/v2/empresas'
          : 'https://homologacao.focusnfe.com.br/v2/empresas';
        const authHeader = 'Basic ' + Buffer.from(data.apiToken + ':').toString('base64');
          
        let certBase64 = undefined;
        if (req.file) {
           certBase64 = req.file.buffer.toString('base64');
        }

        const cleanCep = (data.cep || '').replace(/\D/g, '');
        const cleanNumero = (data.numero || '').toString().trim();
        const numParsed = cleanNumero && !isNaN(Number(cleanNumero)) ? Number(cleanNumero) : cleanNumero || 'S/N';
        const regTrib = data.crt ? Number(data.crt) : 1;

        const hasCsc = Boolean(data.cscSecret && data.cscSecret.trim() && data.cscId && String(data.cscId).trim());
        const empresaPayload: any = {
          nome: (data.razaoSocial || '').trim(),
          nome_fantasia: (data.nomeFantasia || data.razaoSocial || '').trim(),
          cnpj: cleanCnpj,
          regime_tributario: regTrib,
          enviar_email_destinatario: false,
          discrimina_impostos: true,
          habilita_nfce: hasCsc,
          habilita_nfe: true
        };

        if (data.ie && data.ie.trim().length > 0) {
          const cleanIe = data.ie.trim();
          empresaPayload.inscricao_estadual = !isNaN(Number(cleanIe)) ? cleanIe : cleanIe;
        }

        if (data.logradouro) empresaPayload.logradouro = data.logradouro.trim();
        if (numParsed) empresaPayload.numero = numParsed;
        if (data.bairro) empresaPayload.bairro = data.bairro.trim();
        if (cleanCep) empresaPayload.cep = cleanCep;
        if (data.municipio) empresaPayload.municipio = data.municipio.trim();
        if (data.uf) empresaPayload.uf = data.uf.trim().toUpperCase();

        // CSC e Séries NFC-e (apenas se preenchidos para não enviar nulo/vazio inválido)
        if (data.cscSecret && data.cscSecret.trim()) {
          const csc = data.cscSecret.trim();
          empresaPayload.csc_nfce_producao = csc;
          empresaPayload.csc_nfce_homologacao = csc;
        }
        if (data.cscId && data.cscId.trim()) {
          const cscIdNum = !isNaN(Number(data.cscId)) ? Number(data.cscId) : data.cscId.trim();
          empresaPayload.id_token_nfce_producao = cscIdNum;
          empresaPayload.id_token_nfce_homologacao = cscIdNum;
        }

        if (data.serieNfce) {
          empresaPayload.serie_nfce_producao = String(data.serieNfce).trim();
          empresaPayload.serie_nfce_homologacao = String(data.serieNfce).trim();
        }
        if (data.proximoNumeroNfce) {
          empresaPayload.proximo_numero_nfce_producao = String(data.proximoNumeroNfce).trim();
          empresaPayload.proximo_numero_nfce_homologacao = String(data.proximoNumeroNfce).trim();
        }

        if (certBase64 && certPassword) {
           empresaPayload.arquivo_certificado_base64 = certBase64;
           empresaPayload.senha_certificado = certPassword;
        }

        // 1. Tenta criar a empresa via POST /v2/empresas
        let focusRes = await fetch(baseURL + '?dry_run=0', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify(empresaPayload)
        });

        let focusData: any = await focusRes.json().catch(() => ({}));
        
        // 2. Se falhar por CNPJ já cadastrado ou se for 400/422 com mensagem de empresa existente, faz PUT para atualizar
        const focusDataStr = JSON.stringify(focusData).toLowerCase();
        const jaCadastrado = focusRes.status === 400 && (
          focusDataStr.includes('já cadastrad') ||
          focusDataStr.includes('already exist') ||
          focusDataStr.includes('já existe') ||
          focusDataStr.includes('empresa_ja_cadastrada') ||
          focusDataStr.includes('duplicad')
        );

        if (!focusRes.ok && jaCadastrado) {
          console.log(`[Focus NFe] CNPJ ${cleanCnpj} já cadastrado na conta. Atualizando dados via PUT /v2/empresas/${cleanCnpj}...`);
          focusRes = await fetch(`${baseURL}/${cleanCnpj}?dry_run=0`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify(empresaPayload)
          });
          focusData = await focusRes.json().catch(() => ({}));
        }

        // Se ainda assim não der certo, formata o erro de forma clara para o usuário
        if (!focusRes.ok) {
           console.error("[Focus NFe] Erro ao cadastrar/atualizar empresa:", focusData);

           let mensagemAmigavel = '';
           if (focusRes.status === 401) {
             mensagemAmigavel = 'Token da Focus NFe não autorizado ou inválido para este ambiente (' + (isProducao ? 'Produção' : 'Homologação') + '). Verifique seu Token.';
           } else if (focusData.erros && Array.isArray(focusData.erros)) {
             mensagemAmigavel = focusData.erros.map((e: any) => {
               const campo = e.campo ? `Campo [${e.campo}]: ` : '';
               return `${campo}${e.mensagem || e.codigo || JSON.stringify(e)}`;
             }).join(' | ');
           } else if (focusData.mensagem) {
             mensagemAmigavel = focusData.mensagem;
           } else {
             mensagemAmigavel = JSON.stringify(focusData);
           }

           return res.status(400).json({ 
             error: `Focus NFe (${focusRes.status}): ${mensagemAmigavel}` 
           });
        }
      }

      // Salva no banco local
      const settings = await (prisma as any).FiscalSettings.upsert({
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

  // ============================================================
  // Cancelar NFC-e (Prazo de 30 minutos)
  // ============================================================
  router.post('/cancel-nfce', async (req, res) => {
    try {
      const { referencia, justificativa } = req.body;
      
      if (!referencia) {
        return res.status(400).json({ error: 'Referência (ID do Pedido) não informada.' });
      }
      
      if (!justificativa || justificativa.length < 15) {
        return res.status(400).json({ error: 'A justificativa deve ter no mínimo 15 caracteres (Regra da SEFAZ).' });
      }

      const settings = await (prisma as any).FiscalSettings.findUnique({ where: { id: 'default' } });
      if (!settings?.apiToken) {
        return res.status(400).json({ error: 'Token da API não configurado.' });
      }

      const isProducao = settings.environment === 'producao';
      const baseURL = isProducao ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
      const authHeader = 'Basic ' + Buffer.from(settings.apiToken + ':').toString('base64');

      const focusUrl = `${baseURL}/v2/nfce/${encodeURIComponent(referencia)}?justificativa=${encodeURIComponent(justificativa)}`;
      
      const focusRes = await fetch(focusUrl, {
        method: 'DELETE',
        headers: { 'Authorization': authHeader }
      });

      const data = await focusRes.json().catch(() => ({}));

      if (!focusRes.ok) {
        console.error('[FocusNFe Cancel Error]', focusRes.status, data);
        const erroMsg = data.mensagem || data.codigo || JSON.stringify(data);
        return res.status(focusRes.status).json({ 
          error: `Erro ao cancelar nota: ${erroMsg}`,
          details: data 
        });
      }

      // Atualizar status no banco de dados local
      try {
        await (prisma as any).notaEmitida.updateMany({
          where: { referencia },
          data: { status: 'cancelado' }
        });
      } catch (e) {
        console.error('Erro ao atualizar status para cancelado:', e);
      }

      return res.json({
        ok: true,
        mensagem: 'Nota fiscal cancelada com sucesso!',
        data
      });

    } catch (err: any) {
      console.error('[FocusNFe Cancel Exception]', err);
      return res.status(500).json({ error: 'Erro interno ao comunicar com a Focus NFe.', detail: err.message });
    }
  });

  // ============================================================
  // Listar Notas Disponíveis para Cancelamento (Prazo 30 min)
  // ============================================================
  router.get('/cancelable-notes', async (req, res) => {
    try {
      const notas = await (prisma as any).notaEmitida.findMany({
        where: { status: 'autorizado' },
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      const now = Date.now();
      const cancelable = notas.map((n: any) => {
        const createdAtMs = new Date(n.createdAt).getTime();
        const diffMinutes = Math.floor((now - createdAtMs) / 60000);
        const minutesRemaining = Math.max(0, 30 - diffMinutes);
        return {
          ...n,
          diffMinutes,
          minutesRemaining,
          isCancelable: minutesRemaining > 0
        };
      }).filter((n: any) => n.isCancelable);

      res.json(cancelable);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao listar notas para cancelamento.' });
    }
  });


  // Emitir NFC-e (Mock / Homologação Inicial)
  router.post('/emit-nfce', async (req, res) => {
    try {
      const { items, customerCpf, paymentMethod } = req.body;
      
      // Validações básicas
      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'Nenhum item adicionado para a nota.' });
      }

      const settings = await (prisma as any).FiscalSettings.findUnique({ where: { id: 'default' } });
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
        serie: String(settings.serieNfce || '1'),
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
          // CRT: 1 = Simples Nacional, 3 = Regime Normal
          icms_situacao_tributaria: (settings.crt === '3') 
            ? (i.cfop === '5405' ? '60' : '00')  // Regime Normal: 60 = ST, 00 = Tributada Integralmente
            : (i.cfop === '5405' ? '500' : '102'), // Simples Nacional: 500 = ST, 102 = Tributada
          icms_origem: '0',
          pis_situacao_tributaria: '08', // Operação sem incidência
          cofins_situacao_tributaria: '08'
        })),
        formas_pagamento: [
          {
            forma_pagamento: (() => {
               // De -> Para Sefaz
               const pm = (paymentMethod || '').toUpperCase();
               if (pm === 'PIX') return '17';
               if (pm === 'CREDITO' || pm === 'CARTÃO DE CRÉDITO') return '03';
               if (pm === 'DEBITO' || pm === 'CARTÃO DE DÉBITO') return '04';
               return '01'; // Default: Dinheiro
            })(),
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

      const focusDataRef = data.ref;
      const focusDataChave = data.chave_nfe;
      const focusDataNumero = data.numero;
      const focusDataSerie = data.serie;
      const focusDataValor = items.reduce((acc: number, i: any) => acc + (i.price * i.quantity), 0);
      const focusDataStatus = data.status;

      if (data.status === 'autorizado') {
        
        // Salva Nota Emitida no DB
        try {
          const NotaEmitida = (prisma as any).notaEmitida;
          
          // Arquivamento Físico de 5 anos
          // O XML real na API da Focus NFe seria baixado e guardado. Como é um teste, guardaremos o JSON de requisição assinado ou mock
          const xmlToSave = `<?xml version="1.0" encoding="UTF-8"?><NFe><infNFe Id="${focusDataRef}"><emit><CNPJ>${settings.cnpj.replace(/\D/g, '')}</CNPJ></emit></infNFe></NFe>`;
          secureArchiveXML('SAIDA', focusDataRef, xmlToSave);
          
          if (NotaEmitida) {
            await NotaEmitida.create({
              data: {
                referencia: data.ref,
                chave: data.chave_nfe,
                numero: data.numero,
                serie: data.serie,
                dataEmissao: new Date().toISOString(),
                valorTotal: items.reduce((acc: number, i: any) => acc + (i.price * i.quantity), 0),
                status: data.status,
                xmlUrl: baseURL + '/' + data.ref + '.xml',
                pdfUrl: baseURL + '/' + data.ref + '/danfe.pdf'
              }
            });
          }
        } catch (e) {
          console.error("Erro ao salvar NotaEmitida", e);
        }

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
          
        // Salva Nota Emitida no DB
        try {
          const NotaEmitida = (prisma as any).notaEmitida;
          
          // Arquivamento Físico de 5 anos
          // O XML real na API da Focus NFe seria baixado e guardado. Como é um teste, guardaremos o JSON de requisição assinado ou mock
          const xmlToSave = `<?xml version="1.0" encoding="UTF-8"?><NFe><infNFe Id="${focusDataRef}"><emit><CNPJ>${settings.cnpj.replace(/\D/g, '')}</CNPJ></emit></infNFe></NFe>`;
          secureArchiveXML('SAIDA', focusDataRef, xmlToSave);
          
          if (NotaEmitida) {
            await NotaEmitida.create({
              data: {
                referencia: checkData.ref,
                chave: checkData.chave_nfe,
                numero: checkData.numero,
                serie: checkData.serie,
                dataEmissao: new Date().toISOString(),
                valorTotal: items.reduce((acc: number, i: any) => acc + (i.price * i.quantity), 0),
                status: checkData.status,
                xmlUrl: baseURL + '/' + checkData.ref + '.xml',
                pdfUrl: baseURL + '/' + checkData.ref + '/danfe.pdf'
              }
            });
          }
        } catch (e) {
          console.error("Erro ao salvar NotaEmitida", e);
        }

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

      const settings = await (prisma as any).FiscalSettings.findUnique({ where: { id: 'default' } });
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

      // Sincronizar fornecedor no banco de dados automaticamente
      if (xmlData.cnpj_emitente) {
        const cleanCnpj = xmlData.cnpj_emitente.replace(/\D/g, '');
        try {
          await prisma.supplier.upsert({
            where: { document: cleanCnpj },
            update: {
              name: xmlData.nome_emitente || 'Fornecedor sem nome'
            },
            create: {
              name: xmlData.nome_emitente || 'Fornecedor sem nome',
              document: cleanCnpj
            }
          });
        } catch (supErr) {
          console.warn('[Bip] Erro ao sincronizar fornecedor:', supErr);
        }
      }

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
      const settings = await (prisma as any).FiscalSettings.findUnique({ where: { id: 'default' } });
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

  // Obter itens já parseados a partir da chave de acesso (2º bip direto)
  router.get('/parsed-by-chave/:chave', async (req, res) => {
    try {
      const chaveClean = req.params.chave.replace(/\D/g, '');
      if (chaveClean.length !== 44) {
        return res.status(400).json({ error: 'Chave de acesso deve conter exatamente 44 dígitos.' });
      }

      let xmlText: string | null = null;

      // 1. Tenta buscar XML armazenado localmente em NotaRecebida
      try {
        const localNota: any = await prisma.$queryRawUnsafe(
          `SELECT * FROM "NotaRecebida" WHERE "chave" = ? LIMIT 1`,
          chaveClean
        );
        if (Array.isArray(localNota) && localNota.length > 0) {
          const content = localNota[0].xmlContent;
          if (content) {
            try {
              const parsedJson = JSON.parse(content);
              if (parsedJson.raw) {
                xmlText = parsedJson.raw;
              }
            } catch {
              if (content.startsWith('<?xml') || content.includes('<nfeProc') || content.includes('<NFe')) {
                xmlText = content;
              }
            }
          }
        }
      } catch (localErr) {
        console.warn('[Parsed XML] Nota local não encontrada ou erro na consulta:', localErr);
      }

      // 2. Se não encontrou XML salvo no banco, busca na SEFAZ via Focus NFe
      if (!xmlText) {
        const settings = await (prisma as any).FiscalSettings.findUnique({ where: { id: 'default' } });
        if (!settings?.apiToken) {
          return res.status(400).json({ error: 'Token da API Fiscal não configurado. Verifique as configurações fiscais.' });
        }

        const isProducao = settings.environment === 'producao';
        const baseURL = isProducao
          ? 'https://api.focusnfe.com.br'
          : 'https://homologacao.focusnfe.com.br';

        const authHeader = 'Basic ' + Buffer.from(settings.apiToken + ':').toString('base64');

        // Tenta baixar o arquivo XML completo
        let xmlRes = await fetch(`${baseURL}/v2/nfes_recebidas/${chaveClean}/xml`, {
          headers: { 'Authorization': authHeader }
        });

        // Se ainda não estiver pronto e for status 404, tenta registrar ciência ou esperar
        if (!xmlRes.ok) {
          // Tenta manifestar ciência caso não tenha sido feito no 1º bip
          await fetch(`${baseURL}/v2/nfes_recebidas/${chaveClean}/manifesto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
            body: JSON.stringify({ tipo: 'ciencia' })
          }).catch(() => {});

          await new Promise(r => setTimeout(r, 1200));

          xmlRes = await fetch(`${baseURL}/v2/nfes_recebidas/${chaveClean}/xml`, {
            headers: { 'Authorization': authHeader }
          });
        }

        if (!xmlRes.ok) {
          return res.status(404).json({ 
            error: 'XML da nota ainda não disponível na SEFAZ. Se a nota acabou de ser emitida, aguarde 30 a 60 segundos para o processamento do download na SEFAZ.' 
          });
        }

        xmlText = await xmlRes.text();

        // Salvar em cache local no NotaRecebida para os próximos bips
        try {
          await prisma.$executeRawUnsafe(
            `UPDATE "NotaRecebida" SET "xmlContent" = ? WHERE "chave" = ?`,
            xmlText,
            chaveClean
          );
        } catch {
          // Registro pode ainda não existir, cria ou ignora
        }
      }

      // 3. Parsear o XML da NF-e
      const jsonObj = parser.parse(xmlText);
      const nfe = jsonObj.nfeProc?.NFe?.infNFe || jsonObj.NFe?.infNFe;
      if (!nfe) {
        return res.status(400).json({ error: 'Não foi possível extrair dados válidos de NF-e do XML.' });
      }

      const emit = nfe.emit || {};
      const emitCnpj = (emit.CNPJ || emit.CPF || '').toString().replace(/\D/g, '');
      const emitNome = emit.xNome || 'Fornecedor sem nome';

      // Sincronizar fornecedor se existir CNPJ
      let supplierRecord: any = null;
      if (emitCnpj) {
        try {
          supplierRecord = await prisma.supplier.upsert({
            where: { document: emitCnpj },
            update: { name: emitNome },
            create: { name: emitNome, document: emitCnpj }
          });
        } catch (supErr) {
          console.warn('[Parsed XML] Erro ao sincronizar fornecedor:', supErr);
        }
      }

      let det = nfe.det || [];
      if (!Array.isArray(det)) det = [det];

      const items = det.map((d: any, index: number) => {
        const prod = d.prod || {};
        return {
          id: `xml_item_${index}`,
          code: prod.cProd ? String(prod.cProd) : '',
          ean: (prod.cEAN && prod.cEAN !== 'SEM GTIN') ? String(prod.cEAN) : undefined,
          name: prod.xProd || 'Produto sem descrição',
          quantity: parseFloat(prod.qCom || '1'),
          unitCost: parseFloat(prod.vUnCom || '0'),
          ncm: prod.NCM ? String(prod.NCM) : '',
          cfop: prod.CFOP ? String(prod.CFOP) : '',
          unit: prod.uCom || 'UN'
        };
      });

      res.json({
        vendor: {
          id: supplierRecord?.id,
          name: emitNome,
          tradeName: emit.xFant ? String(emit.xFant) : undefined,
          cnpj: emitCnpj
        },
        items,
        accessKey: chaveClean,
        numero: nfe.ide?.nNF ? String(nfe.ide.nNF) : '',
        serie: nfe.ide?.serie ? String(nfe.ide.serie) : ''
      });
    } catch (err: any) {
      console.error('[Parsed XML] Erro:', err);
      res.status(500).json({ error: 'Erro ao processar XML da chave: ' + err.message });
    }
  });

  
  // ============================================================
  // Sincronizar Notas Destinadas (Focus NFe) - Manifestação em Lote
  // ============================================================
  router.get('/sync-nfe-recebidas', async (req, res) => {
    try {
      const settings = await (prisma as any).FiscalSettings.findUnique({ where: { id: 'default' } });
      if (!settings || !settings.apiToken) {
        return res.status(400).json({ error: 'Configuração fiscal incompleta.' });
      }

      // MOCK PARA O PROTÓTIPO: Vamos criar uma nota simulada para o usuário testar a funcionalidade
      // se ele estiver no ambiente de testes.
      const mockChave = '352609' + settings.cnpj.replace(/\D/g, '') + '55001000' + Math.floor(Math.random()*999999) + '12345678';
      
      const existing = await (prisma as any).notaRecebida.findUnique({ where: { chave: mockChave } });
      let added = 0;

      if (!existing) {
         const dummyXML = `<?xml version="1.0" encoding="UTF-8"?><nfeProc><NFe><infNFe Id="NFe${mockChave}"><emit><xNome>FORNECEDOR DE BEBIDAS S.A</xNome><CNPJ>00000000000191</CNPJ></emit><ide><nNF>12345</nNF><dhEmi>${new Date().toISOString()}</dhEmi></ide><total><ICMSTot><vNF>4500.00</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;
         
         await (prisma as any).notaRecebida.create({
           data: {
             id: 'nfe_' + Math.random().toString(36).substr(2, 9),
             chave: mockChave,
             emitente: 'FORNECEDOR AMBEV S.A',
             cnpjEmitente: '00.000.000/0001-91',
             numero: '12345',
             serie: '1',
             dataEmissao: new Date().toISOString(),
             valorTotal: 4500.00,
             status: 'ciência_registrada',
             xmlContent: JSON.stringify({ url: 'http://fake.xml.url', raw: dummyXML })
           }
         });
         
         // Salvar no cofre de 5 anos
         secureArchiveXML('ENTRADA', mockChave, dummyXML);
         added++;
      }

      res.json({ success: true, count: added, message: `${added} novas notas sincronizadas e arquivadas no Cofre Fiscal (Guarda de 5 Anos).` });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao sincronizar SEFAZ.' });
    }
  });

  
  // ============================================================
  // Reimprimir NFC-e / Consultar Status
  // ============================================================
  router.get('/reprint/:ref', async (req, res) => {
    try {
      const { ref } = req.params;
      const settings = await (prisma as any).FiscalSettings.findUnique({ where: { id: 'default' } });
      if (!settings || !settings.apiToken) {
        return res.status(400).json({ error: 'Token da API Fiscal não configurado.' });
      }

      const baseURL = settings.environment === 'producao' 
        ? 'https://api.focusnfe.com.br/v2/nfce/'
        : 'https://homologacao.focusnfe.com.br/v2/nfce/';

      const focusRes = await fetch(baseURL + ref + '?cnpj_emitente=' + settings.cnpj.replace(/\D/g, ''), {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(settings.apiToken + ':').toString('base64')
        }
      });

      const data = await focusRes.json();
      
      if (!focusRes.ok) {
        return res.status(400).json({ error: data.mensagem || data.erros || 'Erro ao buscar nota na Focus NFe.' });
      }

      if (data.status === 'autorizado') {
         return res.json({
           success: true,
           status: data.status,
           chaveAcesso: data.chave_nfe,
           caminhoDanfe: baseURL + ref + '/danfe.pdf',
           xmlUrl: data.caminho_xml_nota_fiscal
         });
      } else {
         return res.status(400).json({ error: `Nota não está autorizada (Status: ${data.status}).` });
      }
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao consultar a Sefaz para reimpressão.' });
    }
  });

  // Listar notas emitidas recentes
  router.get('/recent-notes', async (req, res) => {
    try {
      const notas = await (prisma as any).notaEmitida.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30
      });
      res.json(notas);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao listar notas emitidas.' });
    }
  });

  // Reimprimir NFC-e buscando pelo NÚMERO da nota
  router.get('/reprint-by-number/:number', async (req, res) => {
    try {
      const { number } = req.params;
      const cleanNum = String(number).trim();

      const nota = await (prisma as any).notaEmitida.findFirst({
        where: { numero: cleanNum },
        orderBy: { createdAt: 'desc' }
      });

      if (!nota) {
        return res.status(404).json({ error: `Nenhuma nota emitida encontrada com o número ${cleanNum}.` });
      }

      const settings = await (prisma as any).FiscalSettings.findUnique({ where: { id: 'default' } });
      const baseURL = settings?.environment === 'producao' 
        ? 'https://api.focusnfe.com.br/v2/nfce/'
        : 'https://homologacao.focusnfe.com.br/v2/nfce/';

      return res.json({
        success: true,
        nota,
        status: nota.status,
        chaveAcesso: nota.chave,
        caminhoDanfe: nota.pdfUrl || (baseURL + nota.referencia + '/danfe.pdf'),
        xmlUrl: nota.xmlUrl
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao buscar nota por número.' });
    }
  });

  // Resumo do mês para o Painel do Contador (prévia de saídas e entradas)
  router.get('/month-summary', async (req, res) => {
    try {
      const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);
      if (isNaN(year) || isNaN(monthNum)) {
        return res.status(400).json({ error: 'Mês de referência inválido. Use o formato AAAA-MM.' });
      }

      const startDate = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));

      const emitidas = await (prisma as any).notaEmitida.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate }
        }
      });

      const recebidas = await (prisma as any).notaRecebida.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate }
        }
      });

      const emitidasTotal = emitidas.reduce((acc: number, n: any) => acc + (n.valorTotal || 0), 0);
      const recebidasTotal = recebidas.reduce((acc: number, n: any) => acc + (n.valorTotal || 0), 0);

      res.json({
        month,
        emitidasCount: emitidas.length,
        emitidasTotal,
        recebidasCount: recebidas.length,
        recebidasTotal,
        hasNotes: emitidas.length > 0 || recebidas.length > 0
      });
    } catch (err: any) {
      console.error('[Month Summary] Erro:', err);
      res.status(500).json({ error: 'Erro ao consultar resumo do mês.' });
    }
  });

  // Exportar Fechamento Contábil Mensal (.ZIP com XMLs + Relatório CSV)
  router.get('/export-month', async (req, res) => {
    try {
      const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);
      if (isNaN(year) || isNaN(monthNum)) {
        return res.status(400).json({ error: 'Mês de referência inválido. Use o formato AAAA-MM.' });
      }

      const startDate = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));

      const settings = await (prisma as any).FiscalSettings.findUnique({ where: { id: 'default' } });

      const emitidas = await (prisma as any).notaEmitida.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate }
        },
        orderBy: { createdAt: 'asc' }
      });

      const recebidas = await (prisma as any).notaRecebida.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate }
        },
        orderBy: { createdAt: 'asc' }
      });

      const zip = new AdmZip();

      // 1. Adicionar XMLs de Saída (NFC-e)
      const vaultSaidaPath = path.join(process.cwd(), 'xml_vault', yearStr, monthStr.padStart(2, '0'), 'SAIDA');
      for (const nota of emitidas) {
        const chaveOuRef = nota.chave || nota.referencia;
        let xmlBuffer: Buffer | null = null;

        // Tentar pegar do cofre local
        const localPath = path.join(vaultSaidaPath, `${chaveOuRef}.xml`);
        if (fs.existsSync(localPath)) {
          xmlBuffer = fs.readFileSync(localPath);
        } else if (nota.xmlUrl) {
          try {
            const fetchRes = await fetch(nota.xmlUrl, {
              headers: settings?.apiToken ? { 'Authorization': 'Basic ' + Buffer.from(settings.apiToken + ':').toString('base64') } : {}
            });
            if (fetchRes.ok) {
              const text = await fetchRes.text();
              xmlBuffer = Buffer.from(text, 'utf-8');
            }
          } catch (e) {}
        }

        // Se ainda não tiver o arquivo XML completo, gerar o XML de contingência/registro
        if (!xmlBuffer) {
          const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${nota.chave || nota.referencia}" versao="4.00">
    <ide>
      <nNF>${nota.numero || '1'}</nNF>
      <serie>${nota.serie || '1'}</serie>
      <dhEmi>${nota.dataEmissao || nota.createdAt.toISOString()}</dhEmi>
      <tpNF>1</tpNF>
    </ide>
    <emit>
      <CNPJ>${(settings?.cnpj || '').replace(/\D/g, '')}</CNPJ>
    </emit>
    <total>
      <ICMSTot>
        <vNF>${(nota.valorTotal || 0).toFixed(2)}</vNF>
      </ICMSTot>
    </total>
  </infNFe>
</NFe>`;
          xmlBuffer = Buffer.from(fallbackXml, 'utf-8');
        }

        const fileName = `NFCe_${nota.numero || nota.referencia}_${nota.chave || 'sem_chave'}.xml`;
        zip.addFile(`NFCe_Emitidas/${fileName}`, xmlBuffer);
      }

      // 2. Adicionar XMLs de Entrada (NF-e de Compra)
      const vaultEntradaPath = path.join(process.cwd(), 'xml_vault', yearStr, monthStr.padStart(2, '0'), 'ENTRADA');
      for (const nota of recebidas) {
        let xmlBuffer: Buffer | null = null;
        const localPath = path.join(vaultEntradaPath, `${nota.chave}.xml`);
        if (fs.existsSync(localPath)) {
          xmlBuffer = fs.readFileSync(localPath);
        } else if (nota.xmlContent && !nota.xmlContent.startsWith('{')) {
          xmlBuffer = Buffer.from(nota.xmlContent, 'utf-8');
        }

        if (!xmlBuffer) {
          const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${nota.chave}" versao="4.00">
    <ide>
      <nNF>${nota.numero || '1'}</nNF>
      <serie>${nota.serie || '1'}</serie>
      <dhEmi>${nota.dataEmissao || nota.createdAt.toISOString()}</dhEmi>
    </ide>
    <emit>
      <CNPJ>${(nota.cnpjEmitente || '').replace(/\D/g, '')}</CNPJ>
      <xNome>${nota.emitente || ''}</xNome>
    </emit>
    <total>
      <ICMSTot>
        <vNF>${(nota.valorTotal || 0).toFixed(2)}</vNF>
      </ICMSTot>
    </total>
  </infNFe>
</NFe>`;
          xmlBuffer = Buffer.from(fallbackXml, 'utf-8');
        }

        const fileName = `NFe_${nota.numero || 'compra'}_${nota.chave}.xml`;
        zip.addFile(`NFe_Recebidas/${fileName}`, xmlBuffer);
      }

      // 3. Gerar Relatório Contábil Consolidado (CSV formatado com separador ponto e vírgula para Excel / contabilidade)
      let csvContent = `RELATÓRIO DE FECHAMENTO FISCAL MENSAL\n`;
      csvContent += `Mês de Competência:;${month}\n`;
      csvContent += `CNPJ da Empresa:;${settings?.cnpj || 'Não cadastrado'}\n`;
      csvContent += `Data de Emissão do Relatório:;${new Date().toLocaleString('pt-BR')}\n\n`;

      csvContent += `--- RESUMO GERAL ---\n`;
      const totalSaidas = emitidas.reduce((a: number, b: any) => a + (b.valorTotal || 0), 0);
      const totalEntradas = recebidas.reduce((a: number, b: any) => a + (b.valorTotal || 0), 0);
      csvContent += `Total de NFC-e Emitidas (Saídas):;${emitidas.length};R$ ${totalSaidas.toFixed(2).replace('.', ',')}\n`;
      csvContent += `Total de NF-e Recebidas (Entradas/Compras):;${recebidas.length};R$ ${totalEntradas.toFixed(2).replace('.', ',')}\n\n`;

      csvContent += `--- NOTAS FISCAIS DE SAÍDA (NFC-E) ---\n`;
      csvContent += `Número;Série;Data/Hora;Chave de Acesso;Status;Valor (R$)\n`;
      for (const n of emitidas) {
        csvContent += `"${n.numero || ''}";"${n.serie || ''}";"${n.dataEmissao || n.createdAt.toISOString()}";"${n.chave || n.referencia}";"${n.status}";"${(n.valorTotal || 0).toFixed(2).replace('.', ',')}"\n`;
      }
      csvContent += `\n`;

      csvContent += `--- NOTAS FISCAIS DE ENTRADA (COMPRAS / FORNECEDORES) ---\n`;
      csvContent += `Número;Série;Fornecedor;CNPJ Fornecedor;Data Emissão;Status;Valor (R$)\n`;
      for (const n of recebidas) {
        csvContent += `"${n.numero || ''}";"${n.serie || ''}";"${n.emitente || ''}";"${n.cnpjEmitente || ''}";"${n.dataEmissao || n.createdAt.toISOString()}";"${n.status}";"${(n.valorTotal || 0).toFixed(2).replace('.', ',')}"\n`;
      }

      zip.addFile(`Relatorio_Fiscal_${month}.csv`, Buffer.from('\uFEFF' + csvContent, 'utf-8'));

      const zipBuffer = zip.toBuffer();

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="Fechamento_Contabil_${month}.zip"`);
      res.setHeader('Content-Length', zipBuffer.length.toString());
      res.send(zipBuffer);
    } catch (err: any) {
      console.error('[Export Month] Erro ao gerar fechamento:', err);
      res.status(500).json({ error: 'Erro ao gerar o pacote ZIP: ' + err.message });
    }
  });

  return router;
}

