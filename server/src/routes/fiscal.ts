import { Router } from 'express';
import multer from 'multer';
import { XMLParser } from 'fast-xml-parser';
import { prisma } from '../prisma.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });


import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { getNextSequentialCode } from '../services/catalogService.js';
import { buildNfePayload, persistNfeRecord } from '../services/nfeService.js';
import { getPrinterSettingsSafe } from './settings.js';
import { encryptField, decryptField } from '../services/securityVault.js';

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

// Distinção estrita entre NFC-e (Modelo 65) e NF-e (Modelo 55)
function isNfce(n: { referencia?: string | null; chave?: string | null }): boolean {
  if (n.referencia?.startsWith('nfce_') || n.referencia?.startsWith('cupom_')) return true;
  if (n.chave && n.chave.length === 44 && n.chave.substring(20, 22) === '65') return true;
  return false;
}

function isNfe(n: { referencia?: string | null; chave?: string | null; serie?: string | null }): boolean {
  if (n.referencia?.startsWith('nfce_') || n.referencia?.startsWith('cupom_')) return false;
  if (n.chave && n.chave.length === 44 && n.chave.substring(20, 22) === '65') return false;
  if (n.referencia?.startsWith('nfe_')) return true;
  if (n.chave && n.chave.length === 44 && n.chave.substring(20, 22) === '55') return true;
  if (n.serie && String(n.serie) === '2') return true;
  // Se não é explicitamente NFC-e (modelo 65), considera NF-e
  return true;
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

    // Auto-migração resiliente para colunas novas de NF-e e NFC-e em FiscalSettings
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalSettings" ADD COLUMN "serieNfe" TEXT DEFAULT '1';`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalSettings" ADD COLUMN "proximoNumeroNfe" INTEGER DEFAULT 1;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalSettings" ADD COLUMN "serieNfce" TEXT DEFAULT '1';`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalSettings" ADD COLUMN "proximoNumeroNfce" INTEGER DEFAULT 1;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "targetMargin" REAL;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN "boxCostPrice" REAL;`); } catch (e) {}
    try { await prisma.$executeRawUnsafe(`ALTER TABLE "SystemSettings" ADD COLUMN "defaultProfitMargin" REAL DEFAULT 50.0;`); } catch (e) {}
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PriceHistory" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "productId" TEXT NOT NULL,
          "oldCostPrice" REAL,
          "newCostPrice" REAL,
          "oldPrice" REAL NOT NULL,
          "newPrice" REAL NOT NULL,
          "costDiff" REAL,
          "costPercent" REAL,
          "priceDiff" REAL NOT NULL,
          "pricePercent" REAL NOT NULL,
          "changedBy" TEXT NOT NULL DEFAULT 'Operador',
          "reason" TEXT NOT NULL,
          "nfeChave" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "PriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
    } catch (e) {}
  } catch (err) {
    console.error('Erro ao verificar/criar tabelas fiscais:', err);
  }
}

async function getFiscalSettingsSafe() {
  try {
    // 1. Garante que a tabela FiscalSettings existe com todas as colunas
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "FiscalSettings" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
        "apiToken" TEXT,
        "cnpj" TEXT,
        "ie" TEXT,
        "crt" TEXT,
        "cscId" TEXT,
        "cscSecret" TEXT,
        "addressInfo" TEXT,
        "environment" TEXT DEFAULT 'homologacao',
        "serieNfce" TEXT DEFAULT '1',
        "proximoNumeroNfce" INTEGER DEFAULT 1,
        "serieNfe" TEXT DEFAULT '1',
        "proximoNumeroNfe" INTEGER DEFAULT 1,
        "cep" TEXT,
        "logradouro" TEXT,
        "numero" TEXT,
        "bairro" TEXT,
        "municipio" TEXT,
        "uf" TEXT,
        "razaoSocial" TEXT,
        "nomeFantasia" TEXT,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Garante que as colunas existem mesmo se a tabela já existia
    const cols: any[] = await prisma.$queryRawUnsafe('PRAGMA table_info(FiscalSettings);');
    const colNames = (cols || []).map((c: any) => c.name);
    if (!colNames.includes('serieNfe')) {
      await prisma.$executeRawUnsafe('ALTER TABLE "FiscalSettings" ADD COLUMN "serieNfe" TEXT DEFAULT \'1\';');
    }
    if (!colNames.includes('proximoNumeroNfe')) {
      await prisma.$executeRawUnsafe('ALTER TABLE "FiscalSettings" ADD COLUMN "proximoNumeroNfe" INTEGER DEFAULT 1;');
    }
    if (!colNames.includes('serieNfce')) {
      await prisma.$executeRawUnsafe('ALTER TABLE "FiscalSettings" ADD COLUMN "serieNfce" TEXT DEFAULT \'1\';');
    }
    if (!colNames.includes('proximoNumeroNfce')) {
      await prisma.$executeRawUnsafe('ALTER TABLE "FiscalSettings" ADD COLUMN "proximoNumeroNfce" INTEGER DEFAULT 1;');
    }
  } catch (_) {}

  // 3. Consulta via SQL puro (nunca quebra por incompatibilidade de schema no Prisma ORM)
  try {
    const rows: any[] = await prisma.$queryRawUnsafe('SELECT * FROM "FiscalSettings" WHERE id = "default" LIMIT 1;');
    if (rows && rows.length > 0) {
      const s = rows[0];
      return {
        ...s,
        apiToken: decryptField(s.apiToken),
        cscSecret: decryptField(s.cscSecret)
      };
    }
  } catch (_) {}

  // 4. Fallback via Prisma
  try {
    const s = await (prisma as any).FiscalSettings.findUnique({ where: { id: 'default' } });
    if (s) {
      return {
        ...s,
        apiToken: decryptField(s.apiToken),
        cscSecret: decryptField(s.cscSecret)
      };
    }
  } catch (_) {
    return null;
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

      const chaveAcesso = (nfe['@_Id'] || '').replace('NFe', '').trim();
      const ide = nfe.ide;
      const numeroNf = ide?.nNF ? String(ide.nNF) : '';
      const serieNf = ide?.serie ? String(ide.serie) : '';
      const dataEmissao = ide?.dhEmi || ide?.dEmi || new Date().toISOString();
      const valorTotal = parseFloat(nfe.total?.ICMSTot?.vNF || '0');
      const now = new Date().toISOString();

      // Persistir na tabela NotaRecebida para o fechamento fiscal mensal e SPED
      if (chaveAcesso) {
        try {
          await prisma.$executeRawUnsafe(`
            INSERT OR REPLACE INTO "NotaRecebida"
              ("id", "chave", "emitente", "cnpjEmitente", "numero", "serie", "dataEmissao", "valorTotal", "status", "xmlContent", "createdAt")
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT "createdAt" FROM "NotaRecebida" WHERE "chave" = ?), ?))
          `,
            chaveAcesso,
            chaveAcesso,
            emitNome,
            emitCnpj,
            numeroNf,
            serieNf,
            dataEmissao,
            valorTotal,
            'recebida',
            xmlData,
            chaveAcesso,
            now
          );
        } catch (dbErr) {
          console.warn('[Fiscal] Erro ao salvar NotaRecebida na importação XML:', dbErr);
        }

        try {
          secureArchiveXML('ENTRADA', chaveAcesso, xmlData);
        } catch (archErr) {
          console.warn('[Fiscal] Erro ao arquivar XML de entrada no cofre:', archErr);
        }
      }

      res.json({
        vendor: {
          id: supplierRecord?.id,
          name: emitNome,
          tradeName: emitFant,
          cnpj: emitCnpj
        },
        items,
        accessKey: chaveAcesso,
        numero: numeroNf,
        serie: serieNf,
        dataEmissao,
        valorTotal
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
      const settings = await getFiscalSettingsSafe();

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

      const cleanToken = (settings.apiToken || '').trim();
      const authHeader = 'Basic ' + Buffer.from(cleanToken + ':').toString('base64');

      const cnpjLimpo = (settings.cnpj || '').replace(/\D/g, '');
      let empresaCadastrada: any = null;
      let total = 0;

      // 1. Tenta consultar diretamente pelo CNPJ configurado (/v2/empresas/:cnpj)
      if (cnpjLimpo) {
        try {
          const directRes = await fetch(`${baseURL}/v2/empresas/${cnpjLimpo}`, {
            headers: { 'Authorization': authHeader }
          });
          if (directRes.status === 401) {
            return res.json({
              ok: false,
              error: `Token não reconhecido pela Focus NFe (401 Não Autorizado).\n\nVerifique se o token é do ambiente de ${isProducao ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO'}. Se o token foi gerado no portal de ${isProducao ? 'Homologação' : 'Produção'}, ajuste o campo "Ambiente SEFAZ" para coincidir.`,
              status: 401,
              ambiente: isProducao ? 'Produção' : 'Homologação'
            });
          }
          if (directRes.ok) {
            empresaCadastrada = await directRes.json().catch(() => null);
          }
        } catch (e) {
          console.error('[validate-api] Erro ao consultar CNPJ direto:', e);
        }
      }

      // 2. Se não encontrou pelo CNPJ direto, tenta consultar a listagem geral (/v2/empresas)
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

      if (focusRes.ok) {
        const resData = await focusRes.json().catch(() => []);
        const empresasList = Array.isArray(resData) 
          ? resData 
          : Array.isArray((resData as any)?.empresas) 
            ? (resData as any).empresas 
            : [];
        total = empresasList.length;

        if (!empresaCadastrada && cnpjLimpo && total > 0) {
          empresaCadastrada = empresasList.find((e: any) => {
            const docRaw = (e.cnpj || e.cpf_cnpj || e.document || '').replace(/\D/g, '');
            return docRaw === cnpjLimpo;
          });
        }
      }

      const cnpjLocalizado = Boolean(empresaCadastrada);

      return res.json({
        ok: true,
        ambiente: isProducao ? '🟢 Produção (Notas Oficiais)' : '🟡 Homologação (Testes)',
        totalEmpresas: total > 0 ? total : (cnpjLocalizado ? 1 : 0),
        cnpjConfigurado: settings.cnpj || null,
        cnpjLocalizado,
        empresaCadastrada: cnpjLocalizado
          ? `✓ CNPJ encontrado na Focus NFe: ${empresaCadastrada.nome_fantasia || empresaCadastrada.nome || settings.cnpj}`
          : cnpjLimpo
          ? `⚠️ CNPJ ${settings.cnpj} ainda não localizado no ambiente ${isProducao ? 'Produção' : 'Homologação'} da Focus NFe. Preencha os dados da empresa e clique em "Cadastrar Dados da Empresa".`
          : 'ℹ️ Nenhum CNPJ configurado ainda.',
        mensagem: cnpjLocalizado
          ? `Empresa localizada com sucesso na Focus NFe (${isProducao ? 'Produção' : 'Homologação'})!`
          : `Conexão com a Focus NFe estabelecida com sucesso. Cadastre sua empresa para emitir NFC-e.`
      });

    } catch (err: any) {
      return res.json({
        ok: false,
        error: 'Não foi possível conectar à Focus NFe. Verifique sua conexão com a internet.',
        detalhe: err.message
      });
    }
  });

  // ============================================================
  // Diagnóstico RAW da Focus NFe (para debug de CNPJ não localizado)
  // ============================================================
  router.get('/diagnose-focus', async (req, res) => {
    try {
      const settings = await getFiscalSettingsSafe();
      if (!settings?.apiToken) {
        return res.status(400).json({ error: 'Token não configurado.' });
      }

      const isProducao = settings.environment === 'producao';
      const baseURL = isProducao ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
      const authHeader = 'Basic ' + Buffer.from(settings.apiToken + ':').toString('base64');
      const cnpjLimpo = (settings.cnpj || '').replace(/\D/g, '');

      // 1. Busca listagem /v2/empresas
      const listRes = await fetch(`${baseURL}/v2/empresas`, { headers: { 'Authorization': authHeader } });
      const listRaw = await listRes.text();
      let listJson: any;
      try { listJson = JSON.parse(listRaw); } catch { listJson = listRaw; }

      // 2. Busca direto pelo CNPJ /v2/empresas/:cnpj
      let directJson: any = null;
      let directStatus = 0;
      if (cnpjLimpo) {
        const directRes = await fetch(`${baseURL}/v2/empresas/${cnpjLimpo}`, { headers: { 'Authorization': authHeader } });
        directStatus = directRes.status;
        const directRaw = await directRes.text();
        try { directJson = JSON.parse(directRaw); } catch { directJson = directRaw; }
      }

      return res.json({
        ambiente: isProducao ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO',
        cnpjConfigurado: cnpjLimpo || null,
        listaEmpresasStatus: listRes.status,
        listaEmpresasResposta: listJson,
        buscaDiretaStatus: directStatus,
        buscaDiretaResposta: directJson
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
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
          // Buscar produto atual para histórico de preços e cálculos de margem/caixa
          const existingProd = await prisma.product.findUnique({
            where: { id: item.productId }
          });

          const newCost = item.xmlItem.unitCost;
          const oldCost = existingProd?.costPrice ?? null;
          const oldSale = existingProd?.price ?? 0;

          // Se veio preço de venda ajustado pelo frontend baseado na margem de lucro
          let newSale = oldSale;
          if (item.newSalePrice !== undefined && item.newSalePrice !== null && !isNaN(item.newSalePrice)) {
            newSale = Number(item.newSalePrice);
          } else if (existingProd?.targetMargin && existingProd.targetMargin > 0 && newCost > 0) {
            // Se não veio explícito, calcula com base na margem cadastrada do produto
            const margin = existingProd.targetMargin;
            newSale = margin < 100 ? Number((newCost / (1 - (margin / 100))).toFixed(2)) : Number((newCost * 2).toFixed(2));
          }

          const updateData: any = {
            stock: { increment: item.xmlItem.quantity },
            costPrice: newCost,
            price: newSale
          };

          // Atualizar preço e custo de caixa se solicitado
          if (item.updateBoxPrice && existingProd?.hasBoxPrice && existingProd.boxQuantity) {
            const bQty = existingProd.boxQuantity;
            // Se veio preço de caixa explícito
            if (item.newBoxPrice !== undefined && item.newBoxPrice !== null) {
              updateData.boxPrice = Number(item.newBoxPrice);
            } else if (oldSale > 0 && existingProd.boxPrice) {
              // Proporcional à alteração da unidade
              const unitRatio = newSale / oldSale;
              updateData.boxPrice = Number((existingProd.boxPrice * unitRatio).toFixed(2));
            } else {
              updateData.boxPrice = Number((newSale * bQty).toFixed(2));
            }
            updateData.boxCostPrice = Number((newCost * bQty).toFixed(2));
          }

          if (effectiveSupplierId) updateData.supplierId = effectiveSupplierId;
          if (effectiveSupplierName) updateData.supplier = effectiveSupplierName;
          if (item.xmlItem.ncm) updateData.ncm = item.xmlItem.ncm;
          if (item.xmlItem.cfop) updateData.cfop = item.xmlItem.cfop;
          if (item.xmlItem.ean) updateData.ean = item.xmlItem.ean;

          const updatedProd = await prisma.product.update({
            where: { id: item.productId },
            data: updateData
          });

          // Registrar no Histórico de Preços
          const costChanged = (oldCost ?? null) !== (newCost ?? null);
          const saleChanged = Math.abs(oldSale - newSale) > 0.001;
          if (costChanged || saleChanged) {
            try {
              const costDiff = (oldCost !== null) ? Number((newCost - oldCost).toFixed(2)) : newCost;
              const costPercent = (oldCost && oldCost > 0) ? Number((((newCost - oldCost) / oldCost) * 100).toFixed(2)) : null;
              const priceDiff = Number((newSale - oldSale).toFixed(2));
              const pricePercent = oldSale > 0 ? Number((((newSale - oldSale) / oldSale) * 100).toFixed(2)) : 0;

              await (prisma as any).priceHistory.create({
                data: {
                  productId: item.productId,
                  oldCostPrice: oldCost,
                  newCostPrice: newCost,
                  oldPrice: oldSale,
                  newPrice: newSale,
                  costDiff,
                  costPercent,
                  priceDiff,
                  pricePercent,
                  changedBy: (req.headers['x-user-name'] as string) || req.body?.userName || 'Operador',
                  reason: 'IMPORT_XML',
                  nfeChave: chaveAcesso || null
                }
              });
            } catch (hErr) {
              console.warn('[PriceHistory] Erro ao gravar histórico no apply-import:', hErr);
            }
          }

          results.updated++;
        } else if (item.action === 'NEW' && item.categoryId) {
          let finalCode = await getNextSequentialCode(item.categoryId);
          if (!finalCode && item.xmlItem.code) {
            finalCode = item.xmlItem.code;
          }

          // Preço de venda para produto novo: baseado na margem do item, padrão ou 50%
          const newCost = item.xmlItem.unitCost;
          let newSale = item.newSalePrice;
          let targetMargin = item.targetMargin ? Number(item.targetMargin) : 50.0;

          if (!newSale || isNaN(newSale)) {
            newSale = targetMargin < 100 ? Number((newCost / (1 - (targetMargin / 100))).toFixed(2)) : Number((newCost * 2).toFixed(2));
          }

          // Cria novo produto com dados fiscais e fornecedor herdados da nota
          const newProd = await prisma.product.create({
            data: {
              name: item.xmlItem.name,
              code: finalCode,
              ean: item.xmlItem.ean || null,
              supplier: effectiveSupplierName,
              supplierId: effectiveSupplierId,
              ncm: item.xmlItem.ncm || null,
              cfop: item.xmlItem.cfop || null,
              unit: item.xmlItem.unit || 'un',
              price: newSale,
              costPrice: newCost,
              targetMargin: targetMargin,
              stock: item.xmlItem.quantity,
              categoryId: item.categoryId
            }
          });

          // Histórico inicial
          try {
            await (prisma as any).priceHistory.create({
              data: {
                productId: newProd.id,
                oldCostPrice: null,
                newCostPrice: newCost,
                oldPrice: newSale,
                newPrice: newSale,
                costDiff: null,
                costPercent: null,
                priceDiff: 0,
                pricePercent: 0,
                changedBy: (req.headers['x-user-name'] as string) || req.body?.userName || 'Operador',
                reason: 'IMPORT_XML',
                nfeChave: chaveAcesso || null
              }
            });
          } catch (_) {}

          results.created++;
        }
      }

      // Se foi importada a partir de uma chave de acesso (2º bip ou upload direto), atualiza/cria na tabela NotaRecebida
      if (chaveAcesso) {
        const rawValor = req.body?.valorTotal;
        const valorNum = typeof rawValor === 'number' ? rawValor : parseFloat(rawValor || '0');
        const numeroNf = req.body?.numero ? String(req.body.numero) : null;
        const serieNf = req.body?.serie ? String(req.body.serie) : null;
        const dataEmissao = req.body?.dataEmissao ? String(req.body.dataEmissao) : null;
        const now = new Date().toISOString();

        try {
          // Atualiza registro existente
          const updateCount = await prisma.$executeRawUnsafe(
            `UPDATE "NotaRecebida"
             SET "status" = 'importada',
                 "valorTotal" = CASE WHEN ? > 0 THEN ? ELSE "valorTotal" END,
                 "emitente" = COALESCE(?, "emitente"),
                 "numero" = COALESCE(?, "numero"),
                 "serie" = COALESCE(?, "serie"),
                 "dataEmissao" = COALESCE(?, "dataEmissao")
             WHERE "chave" = ?`,
            valorNum, valorNum, vendorName || null, numeroNf, serieNf, dataEmissao, chaveAcesso
          );

          // Se a nota não existia ainda em NotaRecebida, insere para não perder no SPED/fechamento contábil
          if (updateCount === 0) {
            await prisma.$executeRawUnsafe(
              `INSERT INTO "NotaRecebida"
                ("id", "chave", "emitente", "cnpjEmitente", "numero", "serie", "dataEmissao", "valorTotal", "status", "xmlContent", "createdAt")
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'importada', NULL, ?)`,
              chaveAcesso,
              chaveAcesso,
              vendorName || 'Fornecedor',
              null,
              numeroNf || '',
              serieNf || '',
              dataEmissao || now,
              valorNum || 0,
              now
            );
          }
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
      let settings = await getFiscalSettingsSafe();
      if (!settings) {
        settings = await (prisma as any).FiscalSettings.create({ data: { id: 'default' } });
      }
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao buscar configurações fiscais.' });
    }
  });

  // ============================================================
  // Upload dedicado do Certificado Digital A1 para a Focus NFe
  // ============================================================
  router.post('/upload-cert', upload.single('certificado'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado. Selecione o arquivo .PFX do certificado.' });
      }

      const certPassword = req.body.certPassword;
      if (!certPassword || !certPassword.trim()) {
        return res.status(400).json({ error: 'Senha do certificado é obrigatória.' });
      }

      const settings = await getFiscalSettingsSafe();
      if (!settings?.apiToken) {
        return res.status(400).json({ error: 'Token da API não configurado. Salve as configurações primeiro.' });
      }
      if (!settings?.cnpj) {
        return res.status(400).json({ error: 'CNPJ não configurado. Salve as configurações da empresa primeiro.' });
      }

      const isProducao = settings.environment === 'producao';
      const baseURL = isProducao
        ? 'https://api.focusnfe.com.br/v2/empresas'
        : 'https://homologacao.focusnfe.com.br/v2/empresas';
      const cleanCnpj = settings.cnpj.replace(/\D/g, '');
      const authHeader = 'Basic ' + Buffer.from(settings.apiToken + ':').toString('base64');
      const certBase64 = req.file.buffer.toString('base64');

      console.log(`[Upload Cert] Enviando certificado para CNPJ ${cleanCnpj} no ambiente ${isProducao ? 'Produção' : 'Homologação'}...`);
      console.log(`[Upload Cert] Arquivo: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);

      // Envia o certificado via PUT /v2/empresas/:cnpj
      const focusRes = await fetch(`${baseURL}/${cleanCnpj}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          arquivo_certificado_base64: certBase64,
          senha_certificado: certPassword.trim()
        })
      });

      const focusData = await focusRes.json().catch(() => ({}));
      console.log(`[Upload Cert] Focus NFe respondeu ${focusRes.status}:`, focusData);

      if (!focusRes.ok) {
        let errMsg = '';
        if (focusRes.status === 401) {
          errMsg = 'Token inválido ou sem permissão para este ambiente.';
        } else if (focusRes.status === 404) {
          errMsg = 'Empresa não encontrada na Focus NFe. Cadastre a empresa no painel de app.focusnfe.com.br primeiro.';
        } else if (focusData.erros && Array.isArray(focusData.erros)) {
          errMsg = focusData.erros.map((e: any) => `${e.campo ? '[' + e.campo + '] ' : ''}${e.mensagem || e.codigo}`).join(' | ');
        } else {
          errMsg = focusData.mensagem || JSON.stringify(focusData);
        }
        return res.status(400).json({ error: `Focus NFe (${focusRes.status}): ${errMsg}` });
      }

      return res.json({
        ok: true,
        mensagem: `✅ Certificado enviado com sucesso para a Focus NFe (${isProducao ? 'Produção' : 'Homologação'})!`,
        arquivo: req.file.originalname,
        tamanho: `${(req.file.size / 1024).toFixed(1)} KB`
      });

    } catch (err: any) {
      console.error('[Upload Cert] Erro:', err);
      return res.status(500).json({ error: 'Erro ao enviar certificado: ' + err.message });
    }
  });

  router.put('/settings', upload.single('certificado'), async (req, res) => {
    try {
      const settingsStr = req.body.settings;
      if (!settingsStr) return res.status(400).json({ error: 'Dados não enviados.' });
      const data = JSON.parse(settingsStr);
      const certPassword = req.body.certPassword;
      
      // Cria ou Atualiza a empresa na Focus NFe (Software House Model)
      if (data.apiToken && data.cnpj) {
        data.apiToken = String(data.apiToken).trim();
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

        if (data.serieNfe) {
          empresaPayload.serie_nfe_producao = String(data.serieNfe).trim();
          empresaPayload.serie_nfe_homologacao = String(data.serieNfe).trim();
        }
        if (data.proximoNumeroNfe) {
          empresaPayload.proximo_numero_nfe_producao = String(data.proximoNumeroNfe).trim();
          empresaPayload.proximo_numero_nfe_homologacao = String(data.proximoNumeroNfe).trim();
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

      // Prepara os dados para salvar com criptografia militar AES-256 no banco local
      const dataToSave = {
        ...data,
        apiToken: data.apiToken ? encryptField(data.apiToken.trim()) : data.apiToken,
        cscSecret: data.cscSecret ? encryptField(data.cscSecret.trim()) : data.cscSecret
      };

      // Salva no banco local com garantia contra colunas faltantes
      let settings: any = null;
      try {
        settings = await (prisma as any).FiscalSettings.upsert({
          where: { id: 'default' },
          update: dataToSave,
          create: { id: 'default', ...dataToSave }
        });
      } catch (upsertErr: any) {
        try { await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalSettings" ADD COLUMN "serieNfe" TEXT DEFAULT '1';`); } catch (_) {}
        try { await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalSettings" ADD COLUMN "proximoNumeroNfe" INTEGER DEFAULT 1;`); } catch (_) {}
        try { await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalSettings" ADD COLUMN "serieNfce" TEXT DEFAULT '1';`); } catch (_) {}
        try { await prisma.$executeRawUnsafe(`ALTER TABLE "FiscalSettings" ADD COLUMN "proximoNumeroNfce" INTEGER DEFAULT 1;`); } catch (_) {}
        settings = await (prisma as any).FiscalSettings.upsert({
          where: { id: 'default' },
          update: dataToSave,
          create: { id: 'default', ...dataToSave }
        });
      }
      res.json({
        ...settings,
        apiToken: decryptField(settings.apiToken),
        cscSecret: decryptField(settings.cscSecret)
      });
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

      const settings = await getFiscalSettingsSafe();
      if (!settings?.apiToken) {
        return res.status(400).json({ error: 'Token da API não configurado.' });
      }

      const isProducao = settings.environment === 'producao';
      const baseURL = isProducao ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
      const authHeader = 'Basic ' + Buffer.from(settings.apiToken + ':').toString('base64');

      // Focus NFe exige a justificativa no BODY do DELETE (não na query string)
      const focusUrl = `${baseURL}/v2/nfce/${encodeURIComponent(referencia)}`;
      
      const focusRes = await fetch(focusUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ justificativa })
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
  // Listar Notas Disponíveis para Cancelamento NFC-e (Prazo 30 min)
  // ============================================================
  router.get('/cancelable-notes', async (req, res) => {
    try {
      const notas = await (prisma as any).notaEmitida.findMany({
        where: { status: 'autorizado' },
        orderBy: { createdAt: 'desc' },
        take: 100
      });

      const now = Date.now();
      const cancelable = notas
        .filter((n: any) => isNfce(n))
        .map((n: any) => {
          const createdAtMs = new Date(n.createdAt).getTime();
          const diffMinutes = Math.floor((now - createdAtMs) / 60000);
          const minutesRemaining = Math.max(0, 30 - diffMinutes);
          return {
            ...n,
            diffMinutes,
            minutesRemaining,
            isCancelable: minutesRemaining > 0
          };
        })
        .filter((n: any) => n.isCancelable);

      res.json(cancelable);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao listar notas para cancelamento.' });
    }
  });

    // ============================================================
    // Reimprimir NF-e por número, chave ou referência (GET - Modelo 55)
    // ============================================================
    router.get('/nfe/reprint/:numero', async (req, res) => {
      try {
        const { numero } = req.params;
        const cleanNum = String(numero || '').trim();
        if (!cleanNum) return res.status(400).json({ error: 'Número ou Referência da NF-e não informado.' });

        // Suporta formatos como "1", "1/2", "1-2", "1 serie 2" ou query param ?serie=2
        let targetNumero = cleanNum;
        let targetSerie = String(req.query.serie || '').trim();

        const combinedMatch = cleanNum.match(/^(\d+)(?:[\/\-\s]+(?:s[eé]rie\s*)?(\d+))?$/i);
        if (combinedMatch) {
          targetNumero = combinedMatch[1];
          if (combinedMatch[2] && !targetSerie) targetSerie = combinedMatch[2];
        }

        const numAsInt = parseInt(targetNumero, 10);
        const padded6 = !isNaN(numAsInt) ? String(numAsInt).padStart(6, '0') : null;
        const padded9 = !isNaN(numAsInt) ? String(numAsInt).padStart(9, '0') : null;

        const settings = await getFiscalSettingsSafe();
        const isProducao = settings?.environment === 'producao';
        const baseURL = isProducao ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
        const authHeader = settings?.apiToken ? ('Basic ' + Buffer.from(settings.apiToken.trim() + ':').toString('base64')) : null;

        // Se houver notas com status 'processando' ou sem número no banco local, sincroniza antes da busca
        if (authHeader) {
          try {
            const pendingNotas = await (prisma as any).notaEmitida.findMany({
              where: {
                OR: [
                  { status: 'processando' },
                  { numero: null }
                ]
              },
              take: 15
            });
            for (const pn of pendingNotas) {
              if (pn.referencia) {
                try {
                  const sRes = await fetch(`${baseURL}/v2/nfe/${encodeURIComponent(pn.referencia)}?completa=1`, {
                    headers: { 'Authorization': authHeader }
                  });
                  const sData: any = await sRes.json().catch(() => ({}));
                  if (sData.status === 'autorizado') {
                    await (prisma as any).notaEmitida.updateMany({
                      where: { referencia: pn.referencia },
                      data: {
                        status: 'autorizado',
                        chave: sData.chave_nfe || sData.chave || pn.chave,
                        numero: sData.numero ? String(sData.numero) : pn.numero,
                        serie: sData.serie ? String(sData.serie) : pn.serie,
                        pdfUrl: sData.caminho_danfe || pn.pdfUrl,
                        xmlUrl: sData.caminho_xml_nota_fiscal || pn.xmlUrl
                      }
                    });
                  }
                } catch {}
              }
            }
          } catch {}
        }

        // 1. Busca ampla no banco de dados local
        const candidatas = await (prisma as any).notaEmitida.findMany({
          where: {
            OR: [
              { numero: cleanNum },
              { numero: targetNumero },
              ...(isNaN(numAsInt) ? [] : [{ numero: String(numAsInt) }]),
              ...(padded6 ? [{ numero: padded6 }] : []),
              ...(padded9 ? [{ numero: padded9 }] : []),
              { referencia: cleanNum },
              { referencia: targetNumero },
              { referencia: `nfe_${cleanNum}` },
              { referencia: `nfe_${targetNumero}` },
              { chave: cleanNum },
              { id: cleanNum },
              { id: `nfe_${cleanNum}` }
            ]
          },
          orderBy: { createdAt: 'desc' }
        });

        let nota = candidatas.find((n: any) => {
          if (!isNfe(n)) return false;
          if (targetSerie) {
            const nSerie = String(n.serie || '').trim();
            if (nSerie && nSerie !== targetSerie) return false;
          }
          return true;
        });

        // Se não encontrou por correspondência exata, busca notas onde a chave de acesso contenha o número da NF-e
        if (!nota && !isNaN(numAsInt) && padded9) {
          const notasChave = await (prisma as any).notaEmitida.findMany({
            where: {
              chave: { contains: padded9 }
            },
            orderBy: { createdAt: 'desc' }
          });
          nota = notasChave.find((n: any) => {
            if (!isNfe(n)) return false;
            if (targetSerie && n.chave && n.chave.length === 44) {
              const serieFromKey = String(parseInt(n.chave.substring(22, 25), 10));
              if (serieFromKey !== targetSerie) return false;
            }
            return true;
          });
        }

        // Se a nota foi encontrada localmente mas estava processando ou sem número/chave, sincroniza com a Focus NFe
        if (nota && authHeader && (nota.status === 'processando' || !nota.numero || !nota.chave)) {
          try {
            const checkRes = await fetch(`${baseURL}/v2/nfe/${encodeURIComponent(nota.referencia)}?completa=1`, {
              headers: { 'Authorization': authHeader }
            });
            const checkData: any = await checkRes.json().catch(() => ({}));
            if (checkData.status === 'autorizado') {
              nota.status = 'autorizado';
              nota.chave = checkData.chave_nfe || checkData.chave || nota.chave;
              nota.numero = checkData.numero ? String(checkData.numero) : nota.numero;
              nota.serie = checkData.serie ? String(checkData.serie) : nota.serie;
              await (prisma as any).notaEmitida.updateMany({
                where: { referencia: nota.referencia },
                data: {
                  status: 'autorizado',
                  chave: nota.chave,
                  numero: nota.numero,
                  serie: nota.serie
                }
              });
            }
          } catch {}
        }

        // Se não encontrou no banco local, tenta consultar diretamente na Focus NFe caso seja uma referência ou chave
        if (!nota && authHeader && (cleanNum.startsWith('nfe_') || cleanNum.length === 44)) {
          try {
            const checkRes = await fetch(`${baseURL}/v2/nfe/${encodeURIComponent(cleanNum)}?completa=1`, {
              headers: { 'Authorization': authHeader }
            });
            const checkData: any = await checkRes.json().catch(() => ({}));
            if (checkRes.ok && (checkData.status === 'autorizado' || checkData.status === 'processando')) {
              const host = req.get('host');
              const protocol = req.protocol;
              const ref = checkData.ref || cleanNum;
              const danfeUrl = `${protocol}://${host}/api/fiscal/danfe/${encodeURIComponent(ref)}`;
              const xmlUrl = checkData.caminho_xml_nota_fiscal || `${baseURL}/v2/nfe/${ref}.xml`;
              
              await persistNfeRecord({
                referencia: ref,
                chave: checkData.chave_nfe || checkData.chave,
                numero: checkData.numero ? String(checkData.numero) : undefined,
                serie: checkData.serie ? String(checkData.serie) : String(settings?.serieNfe || '1'),
                pdfUrl: danfeUrl,
                xmlUrl: xmlUrl,
                status: checkData.status
              });

              return res.json({
                nota: {
                  referencia: ref,
                  chave: checkData.chave_nfe || checkData.chave,
                  numero: checkData.numero ? String(checkData.numero) : undefined,
                  serie: checkData.serie || '1',
                  status: checkData.status,
                  createdAt: new Date().toISOString()
                },
                status: checkData.status,
                caminhoDanfe: danfeUrl,
                chaveAcesso: checkData.chave_nfe || checkData.chave,
                success: true
              });
            }
          } catch {}
        }

        if (!nota) {
          const apenasNfce = candidatas.some((n: any) => isNfce(n));
          if (apenasNfce) {
            return res.status(404).json({ error: `A nota Nº ${cleanNum} foi emitida como NFC-e (Cupom Fiscal Modelo 65) e não NF-e. Consulte na tela de Reimprimir NFC-e.` });
          }
          return res.status(404).json({ error: `Nenhuma NF-e (Modelo 55) encontrada com o termo informado: ${cleanNum}.` });
        }

        const host = req.get('host');
        const protocol = req.protocol;
        const caminhoDanfe = `${protocol}://${host}/api/fiscal/danfe/${encodeURIComponent(nota.referencia)}`;

        return res.json({
          nota,
          status: nota.status,
          caminhoDanfe,
          chaveAcesso: nota.chave,
          success: true
        });
      } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar NF-e para reimpressão.' });
      }
    });

    // ============================================================
    // Lista notas recentes emitidas com filtro por tipo (GET)
    // ============================================================
    router.get('/recent-notes', async (req, res) => {
      try {
        const { tipo } = req.query;
        const notas = await (prisma as any).notaEmitida.findMany({
          orderBy: { createdAt: 'desc' },
          take: 100
        });

        let filtradas = notas;
        if (tipo === 'nfce') {
          filtradas = notas.filter((n: any) => isNfce(n));
        } else if (tipo === 'nfe') {
          filtradas = notas.filter((n: any) => isNfe(n));
        }

        // Se for NF-e e houver notas recentes com status 'processando' ou sem número, sincroniza com a Focus NFe
        if (tipo === 'nfe') {
          const settings = await getFiscalSettingsSafe();
          if (settings?.apiToken) {
            const isProducao = settings.environment === 'producao';
            const baseURL = isProducao ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
            const authHeader = 'Basic ' + Buffer.from(settings.apiToken.trim() + ':').toString('base64');

            for (const n of filtradas) {
              if ((n.status === 'processando' || !n.numero) && n.referencia) {
                try {
                  const checkRes = await fetch(`${baseURL}/v2/nfe/${encodeURIComponent(n.referencia)}?completa=1`, {
                    headers: { 'Authorization': authHeader }
                  });
                  const checkData: any = await checkRes.json().catch(() => ({}));
                  if (checkData.status === 'autorizado') {
                    n.status = 'autorizado';
                    n.chave = checkData.chave_nfe || checkData.chave || n.chave;
                    n.numero = checkData.numero ? String(checkData.numero) : n.numero;
                    n.serie = checkData.serie ? String(checkData.serie) : n.serie;
                    await (prisma as any).notaEmitida.updateMany({
                      where: { referencia: n.referencia },
                      data: {
                        status: 'autorizado',
                        chave: n.chave,
                        numero: n.numero,
                        serie: n.serie
                      }
                    });
                  }
                } catch {}
              }
            }
          }
        }

        res.json(filtradas.slice(0, 50));
      } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao listar notas recentes.' });
      }
    });

    // ============================================================
    // Reimprimir NFC-e por número (GET - Modelo 65)
    // ============================================================
    router.get('/reprint-by-number/:numero', async (req, res) => {
      try {
        const { numero } = req.params;
        const cleanNum = String(numero || '').trim();
        if (!cleanNum) return res.status(400).json({ error: 'Número da NFC-e não informado.' });

        const candidatas = await (prisma as any).notaEmitida.findMany({
          where: { numero: cleanNum },
          orderBy: { createdAt: 'desc' }
        });

        const nota = candidatas.find((n: any) => isNfce(n));

        if (!nota) {
          const apenasNfe = candidatas.some((n: any) => isNfe(n));
          if (apenasNfe) {
            return res.status(404).json({ error: `A nota Nº ${cleanNum} foi emitida como NF-e (DANFE Modelo 55) e não NFC-e. Consulte na tela de Reimprimir NF-e.` });
          }
          return res.status(404).json({ error: `Nenhuma NFC-e (Modelo 65) localizada no histórico com o número ${cleanNum}.` });
        }

        const host = req.get('host');
        const protocol = req.protocol;
        const caminhoDanfe = `${protocol}://${host}/api/fiscal/danfe/${encodeURIComponent(nota.referencia)}`;

        return res.json({
          nota,
          status: nota.status,
          caminhoDanfe,
          chaveAcesso: nota.chave,
          success: true
        });
      } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar NFC-e para reimpressão.' });
      }
    });

    // ============================================================
    // Visualizar / Baixar DANFE em PDF Oficial (Proxy Focus NFe)
    // ============================================================
    router.get('/danfe/:referencia', async (req, res) => {
      try {
        const { referencia } = req.params;
        if (!referencia) return res.status(400).send('Referência da nota não informada.');

        const settings = await getFiscalSettingsSafe();
        if (!settings?.apiToken) {
          return res.status(400).send('Token da Focus NFe não configurado nas Configurações Fiscais.');
        }

        const cleanToken = settings.apiToken.trim();
        const isProducao = settings.environment === 'producao';
        const baseURL = isProducao ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
        const authHeader = 'Basic ' + Buffer.from(cleanToken + ':').toString('base64');

        // Se a referência começa com 'nfe_' e não é cupom/nfce, consulta /v2/nfe, senão /v2/nfce
        const isNfe = referencia.startsWith('nfe_');
        const docTipo = isNfe ? 'nfe' : 'nfce';

        const consultUrl = `${baseURL}/v2/${docTipo}/${encodeURIComponent(referencia)}?completa=1`;
        console.log(`[DANFE Proxy] Consultando Focus NFe: ${consultUrl}`);

        const focusRes = await fetch(consultUrl, {
          headers: { 'Authorization': authHeader }
        });

        const data: any = await focusRes.json().catch(() => ({}));

        if (!focusRes.ok) {
          console.error('[DANFE Proxy] Focus NFe retornou erro:', focusRes.status, data);
          return res.status(focusRes.status).send(`Erro Focus NFe (${focusRes.status}): ${data.mensagem || data.erros || 'Nota não encontrada na SEFAZ.'}`);
        }

        const rawDanfePath = data.caminho_danfe || data.danfe_url || data.url_danfe;

        if (!rawDanfePath) {
          return res.status(404).send(`O DANFE/Cupom Fiscal ainda não está disponível na SEFAZ. Status atual da nota: ${data.status || 'desconhecido'}.`);
        }

        // Converte caminho relativo (ex: /notas_fiscais_consumidor/nfce_xxx.html) em URL absoluta
        const fullDanfeUrl = rawDanfePath.startsWith('http') 
          ? rawDanfePath 
          : `${baseURL}${rawDanfePath.startsWith('/') ? '' : '/'}${rawDanfePath}`;

        // Atualiza no banco local para manter cache
        try {
          await (prisma as any).notaEmitida.updateMany({
            where: { referencia },
            data: { pdfUrl: fullDanfeUrl, status: data.status || 'autorizado' }
          });
        } catch (dbErr) {
          // Não bloqueia
        }

        console.log(`[DANFE Proxy] Baixando documento fiscal de: ${fullDanfeUrl}`);
        const docRes = await fetch(fullDanfeUrl, {
          headers: {
            ...(fullDanfeUrl.includes('focusnfe.com.br') ? { 'Authorization': authHeader } : {})
          }
        });

        if (!docRes.ok) {
          console.warn(`[DANFE Proxy] Fetch direto retornou status ${docRes.status}, redirecionando para: ${fullDanfeUrl}`);
          return res.redirect(fullDanfeUrl);
        }

        const rawContentType = docRes.headers.get('content-type') || '';
        const isHtml = fullDanfeUrl.toLowerCase().includes('.html') || rawContentType.toLowerCase().includes('text/html');

        const buffer = Buffer.from(await docRes.arrayBuffer());

        if (isHtml) {
          let htmlString = buffer.toString('utf-8');

          const printerSettings = await getPrinterSettingsSafe();
          const paperWidth = printerSettings.paperWidth || 80;
          const marginTop = printerSettings.marginTop ?? 2;
          const marginBottom = printerSettings.marginBottom ?? 12;
          const marginLeft = printerSettings.marginLeft ?? 1;
          const marginRight = printerSettings.marginRight ?? 1;
          const qrSize = printerSettings.qrSize || 100;
          const fontScale = (printerSettings.fontScale || 100) / 100;

          // 0. Destaca o Nome Fantasia no topo do cabeçalho do cupom fiscal NFC-e se configurado
          if (settings?.nomeFantasia && settings.nomeFantasia.trim()) {
            const fantasia = settings.nomeFantasia.trim().toUpperCase();
            const razao = (settings.razaoSocial || '').trim();
            if (!htmlString.toUpperCase().includes(fantasia)) {
              htmlString = htmlString.replace(
                /<div class=['"]dados-da-empresa['"][^>]*>\s*<table[^>]*>\s*<tr>\s*<td>([^<]+)<\/td>/i,
                (match, razaoEncontrada) => {
                  return `<div class="dados-da-empresa">
      <table width="100%" border="0" cellpadding="2" cellspacing="0" style="font-size: 10px;">
        <tr>
          <td style="font-size: 13px; font-weight: 900; text-align: center; text-transform: uppercase; padding-bottom: 2px;">${fantasia}</td>
        </tr>
        <tr>
          <td style="font-size: 9px; text-align: center; color: #444;">${razaoEncontrada || razao}</td>`;
                }
              );
            }
          }

          // 1. Extrai a URL do QR Code da SEFAZ direto do script da Focus NFe e injeta <img> direto com tamanho configurado
          const qrMatch = htmlString.match(/text:\s*["']([^"']+)["']/);
          if (qrMatch && qrMatch[1]) {
            const qrTargetUrl = qrMatch[1];
            const directQrImg = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(qrTargetUrl)}&margin=1" alt="QR Code NFC-e SEFAZ" width="${qrSize}" height="${qrSize}" style="display:block;margin:0 auto;width:${qrSize}px;height:${qrSize}px;max-width:${qrSize}px;max-height:${qrSize}px;" />`;
            htmlString = htmlString.replace(/<div id=['"]qr-code0['"][^>]*>/i, `<div id="qr-code0" style="margin:4px auto;text-align:center;display:flex;justify-content:center;align-items:center;width:${qrSize}px;min-height:${qrSize}px;">${directQrImg}`);
          }

          // Neutraliza o script original da Focus NFe que instanciaria um canvas de 250px com margem de 36px
          htmlString = htmlString.replace(/var\s+qrcode\s*=\s*new\s+QRCode\([\s\S]*?\);?/gi, '/* QRCode inline desativado pelo BarERP */');
          htmlString = htmlString.replace(/document\.getElementById\(['"]qr-code\d*['"]\)\.style\.margin\s*=\s*["'][^"']+["'];?/gi, '/* Margem 36px neutralizada */');

          const customThermalStyle = `
<style type="text/css">
  @page {
    size: auto;
    margin: 0mm !important;
  }
  @media print, all {
    html, body {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      box-sizing: border-box !important;
      zoom: ${fontScale} !important;
    }
    .content {
      max-width: ${paperWidth}mm !important;
      width: 100% !important;
      margin: 0 !important;
      padding: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm !important;
      border: none !important;
      box-sizing: border-box !important;
    }
    .tabela-nfce, table {
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
    .qrcode {
      width: 100% !important;
      margin: 4px 0 !important;
      text-align: center !important;
      display: block !important;
    }
    #qr-code0, #qr-code1 {
      margin: 4px auto !important;
      text-align: center !important;
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      width: ${qrSize}px !important;
      height: ${qrSize}px !important;
      min-height: ${qrSize}px !important;
      max-width: 100% !important;
      overflow: hidden !important;
    }
    #qr-code0 img, #qr-code0 canvas, #qr-code0 svg, #qr-code1 img, #qr-code1 canvas, #qr-code1 svg {
      width: ${qrSize}px !important;
      height: ${qrSize}px !important;
      max-width: ${qrSize}px !important;
      max-height: ${qrSize}px !important;
      margin: 0 auto !important;
      display: block !important;
    }
  }
</style>
`;
          if (htmlString.includes('</head>')) {
            htmlString = htmlString.replace('</head>', `${customThermalStyle}</head>`);
          } else {
            htmlString = customThermalStyle + htmlString;
          }

          const finalBuffer = Buffer.from(htmlString, 'utf-8');
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Content-Length', finalBuffer.length.toString());
          return res.send(finalBuffer);
        } else {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `inline; filename="danfe-${referencia}.pdf"`);
          res.setHeader('Content-Length', buffer.length.toString());
          return res.send(buffer);
        }
      } catch (err: any) {
        console.error('[DANFE Proxy Error]', err);
        res.status(500).send('Erro interno ao carregar DANFE: ' + err.message);
      }
    });

    // ============================================================
    // Cancelar NF-e (Modelo 55 - Prazo de até 24 horas SEFAZ)
    // ============================================================
    router.post('/cancel-nfe', async (req, res) => {
      try {
        const { referencia, justificativa, numero, chave } = req.body;
        const searchTarget = String(referencia || chave || numero || '').trim();
        if (!searchTarget) {
          return res.status(400).json({ error: 'Referência, Chave ou Número da NF-e não informado.' });
        }
        if (!justificativa || justificativa.trim().length < 15) {
          return res.status(400).json({ error: 'A justificativa deve ter no mínimo 15 caracteres (Regra da SEFAZ).' });
        }

        // Tenta resolver a referência real no banco de dados local caso o usuário tenha passado o número ou chave
        let targetRef = searchTarget;
        try {
          const numInt = parseInt(searchTarget, 10);
          const padded9 = !isNaN(numInt) ? String(numInt).padStart(9, '0') : null;
          const localNota = await (prisma as any).notaEmitida.findFirst({
            where: {
              OR: [
                { referencia: searchTarget },
                { chave: searchTarget },
                { numero: searchTarget },
                ...(padded9 ? [{ numero: padded9 }, { chave: { contains: padded9 } }] : []),
                { id: searchTarget }
              ]
            }
          });
          if (localNota?.referencia) {
            targetRef = localNota.referencia;
          }
        } catch {}

        const settings = await getFiscalSettingsSafe();
        if (!settings?.apiToken) {
          return res.status(400).json({ error: 'Token da API não configurado.' });
        }
        const isProducao = settings.environment === 'producao';
        const baseURL = isProducao ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
        const authHeader = 'Basic ' + Buffer.from(settings.apiToken + ':').toString('base64');
        const focusUrl = `${baseURL}/v2/nfe/${encodeURIComponent(targetRef)}`;
        const focusRes = await fetch(focusUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ justificativa: justificativa.trim() })
        });
        const data = await focusRes.json().catch(() => ({}));
        if (!focusRes.ok) {
          console.error('[FocusNFe Cancel NFe Error]', focusRes.status, data);
          const erroMsg = data.mensagem || data.codigo || JSON.stringify(data);
          return res.status(focusRes.status).json({ error: `Erro ao cancelar NF-e: ${erroMsg}`, details: data });
        }
        await (prisma as any).notaEmitida.updateMany({
          where: {
            OR: [
              { referencia: targetRef },
              { referencia: searchTarget }
            ]
          },
          data: { status: 'cancelado' }
        });
        return res.json({ ok: true, mensagem: 'NF-e cancelada com sucesso!', data });
      } catch (err: any) {
        console.error('[FocusNFe Cancel NFe Exception]', err);
        return res.status(500).json({ error: 'Erro interno ao cancelar NF-e.', detail: err.message });
      }
    });

    // ============================================================
    // Carta de Correção Eletrônica (CC-e) de NF-e (Modelo 55)
    // ============================================================
    router.post('/nfe/carta-correcao', async (req, res) => {
      try {
        const { referencia, correcao } = req.body;
        if (!referencia || !correcao) {
          return res.status(400).json({ error: 'Referência da NF-e e texto da correção são obrigatórios.' });
        }
        if (String(correcao).trim().length < 15) {
          return res.status(400).json({ error: 'O texto da Carta de Correção deve conter no mínimo 15 caracteres.' });
        }
        const settings = await getFiscalSettingsSafe();
        if (!settings?.apiToken) {
          return res.status(400).json({ error: 'Token da API não configurado.' });
        }
        const isProducao = settings.environment === 'producao';
        const baseURL = isProducao ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
        const authHeader = 'Basic ' + Buffer.from(settings.apiToken + ':').toString('base64');
        const focusUrl = `${baseURL}/v2/nfe/${encodeURIComponent(referencia)}/carta_correcao`;
        const focusRes = await fetch(focusUrl, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ correcao: String(correcao).trim() })
        });
        const data = await focusRes.json().catch(() => ({}));
        if (!focusRes.ok) {
          const erroMsg = data.mensagem || data.codigo || JSON.stringify(data);
          return res.status(focusRes.status).json({ error: `Erro na Carta de Correção: ${erroMsg}`, details: data });
        }
        return res.json({ ok: true, mensagem: 'Carta de Correção registrada com sucesso!', data });
      } catch (err: any) {
        console.error('[FocusNFe CCe Exception]', err);
        return res.status(500).json({ error: 'Erro interno ao emitir Carta de Correção.', detail: err.message });
      }
    });
    // Listar NF-es Disponíveis para Cancelamento (Prazo 24h SEFAZ)
    // ============================================================
    router.get('/nfe/cancelable-notes', async (req, res) => {
      try {
        let notas = await (prisma as any).notaEmitida.findMany({
          where: {
            status: { in: ['autorizado', 'processando'] }
          },
          orderBy: { createdAt: 'desc' },
          take: 200
        });

        // Sincroniza qualquer nota que esteja como 'processando' ou sem número com a Focus NFe
        const settings = await getFiscalSettingsSafe();
        if (settings?.apiToken) {
          const isProducao = settings.environment === 'producao';
          const baseURL = isProducao ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
          const authHeader = 'Basic ' + Buffer.from(settings.apiToken.trim() + ':').toString('base64');

          for (const n of notas) {
            if ((n.status === 'processando' || !n.numero) && n.referencia && isNfe(n)) {
              try {
                const checkRes = await fetch(`${baseURL}/v2/nfe/${encodeURIComponent(n.referencia)}?completa=1`, {
                  headers: { 'Authorization': authHeader }
                });
                const checkData: any = await checkRes.json().catch(() => ({}));
                if (checkData.status === 'autorizado') {
                  n.status = 'autorizado';
                  n.chave = checkData.chave_nfe || checkData.chave || n.chave;
                  n.numero = checkData.numero ? String(checkData.numero) : n.numero;
                  n.serie = checkData.serie ? String(checkData.serie) : n.serie;
                  await (prisma as any).notaEmitida.updateMany({
                    where: { referencia: n.referencia },
                    data: {
                      status: 'autorizado',
                      chave: n.chave,
                      numero: n.numero,
                      serie: n.serie
                    }
                  });
                }
              } catch {}
            }
          }
        }

        const now = Date.now();
        const cancelable = notas
          .filter((n: any) => isNfe(n) && n.status === 'autorizado')
          .map((n: any) => {
            const createdAtMs = n.createdAt ? new Date(n.createdAt).getTime() : 0;
            const diffMinutes = Math.floor((now - createdAtMs) / 60000);
            const hoursRemaining = Math.max(0, 24 - Math.floor(diffMinutes / 60));
            const minutesInHour = Math.max(0, 60 - (diffMinutes % 60));
            return {
              ...n,
              diffMinutes,
              hoursRemaining,
              minutesInHour,
              isCancelable: diffMinutes <= (24 * 60)
            };
          })
          .filter((n: any) => n.isCancelable);

        res.json(cancelable);
      } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao listar NF-es para cancelamento.' });
      }
    });


  // Emitir NFC-e (Mock / Homologação Inicial)
  router.post('/emit-nfce', async (req, res) => {
    try {
      const { items, customerCpf, paymentMethod, orderId } = req.body;
      
      // Validações básicas
      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'Nenhum item adicionado para a nota.' });
      }

      const settings = await getFiscalSettingsSafe();
      if (!settings || !settings.apiToken) {
        return res.status(400).json({ error: 'Token da API Fiscal não configurado. Vá nas Configurações Fiscais.' });
      }

      if (!settings.cscSecret || !settings.cscId) {
        return res.status(400).json({ error: 'Para emitir NFC-e, preencha o Código CSC e o ID do Token nas Configurações Fiscais.' });
      }

      // Gera um ref único para esta nota (obrigatório pela Focus NFe)
      // Formato: nfce_<orderId ou timestamp>_<random>
      const ts = Date.now();
      const rnd = Math.floor(Math.random() * 9000) + 1000;
      const ref = orderId
        ? `nfce_${String(orderId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20)}_${rnd}`
        : `nfce_${ts}_${rnd}`;

      // Mapeamento para requisição na Focus NFe
      const baseURL = settings.environment === 'producao' 
        ? 'https://api.focusnfe.com.br/v2/nfce'
        : 'https://homologacao.focusnfe.com.br/v2/nfce';

      const cleanCnpj = (settings.cnpj || '').replace(/\D/g, '');

      // Formato oficial ISO 8601 com Timezone de Brasília (exigência estrita da SEFAZ e Focus NFe)
      const dataEmissao = (() => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        try {
          const spDateStr = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
          const spDate = new Date(spDateStr);
          const yyyy = spDate.getFullYear();
          const mm = pad(spDate.getMonth() + 1);
          const dd = pad(spDate.getDate());
          const hh = pad(spDate.getHours());
          const mi = pad(spDate.getMinutes());
          const ss = pad(spDate.getSeconds());
          return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}-03:00`;
        } catch {
          const yyyy = now.getUTCFullYear();
          const mm = pad(now.getUTCMonth() + 1);
          const dd = pad(now.getUTCDate());
          const hh = pad((now.getUTCHours() - 3 + 24) % 24);
          const mi = pad(now.getUTCMinutes());
          const ss = pad(now.getUTCSeconds());
          return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}-03:00`;
        }
      })();

      const cleanDestDoc = customerCpf ? String(customerCpf).replace(/\D/g, '') : '';
      const isCpfDest = cleanDestDoc.length === 11;
      const isCnpjDest = cleanDestDoc.length === 14;

      const totalItemsValue = items.reduce((acc: number, i: any) => acc + (Number(i.price || 0) * Number(i.quantity || 1)), 0);

      const focusPayload: any = {
        cnpj_emitente: cleanCnpj,
        data_emissao: dataEmissao,
        natureza_operacao: 'VENDA AO CONSUMIDOR',
        tipo_documento: '1', // 1 = Saída
        finalidade_emissao: '1', // 1 = Normal
        consumidor_final: '1', // 1 = Consumidor Final (Obrigatório em NFC-e)
        presenca_comprador: '1', // 1 = Operação Presencial
        modalidade_frete: '9', // 9 = Sem Ocorrência de Transporte
        local_destino: '1', // 1 = Operação Interna
        serie: String(settings.serieNfce || '1'),
        itens: items.map((i: any, index: number) => {
          const rawNcm = (i.ncm ? String(i.ncm).replace(/\D/g, '') : '');
          const cleanNcm = rawNcm.length >= 8 ? rawNcm.slice(0, 8) : (rawNcm ? rawNcm.padEnd(8, '0') : '21069090');
          const cleanCfop = (i.cfop ? String(i.cfop).replace(/\D/g, '') : '') || '5102';
          const qty = Number(i.quantity) || 1;
          const price = Number(i.price) || 0;
          const grossValue = (qty * price).toFixed(2);
          const unit = (i.unit || 'UN').toUpperCase().slice(0, 6);

          // codigo_produto: EAN > código interno > número sequencial (NUNCA o CUID do banco)
          const eanClean = String(i.ean || '').replace(/\D/g, '');
          const eanValido = eanClean.length >= 8 ? eanClean : '';
          const codigoInterno = String(i.code || '').trim();
          const codigoProduto = (eanValido || codigoInterno || String(index + 1)).slice(0, 60);

          return {
            numero_item: String(index + 1),
            codigo_produto: codigoProduto,
            ...(eanValido ? { codigo_barras: eanValido } : {}),
            descricao: String(i.name || 'Produto').trim().slice(0, 120),
            cfop: cleanCfop,
            codigo_ncm: cleanNcm,
            ncm: cleanNcm,
            unidade_comercial: unit,
            quantidade_comercial: qty.toFixed(4),
            valor_unitario_comercial: price.toFixed(2),
            valor_bruto: grossValue,
            unidade_tributavel: unit,
            quantidade_tributavel: qty.toFixed(4),
            valor_unitario_tributavel: price.toFixed(2),
            inclui_no_total: '1',
            icms_origem: '0',
            icms_situacao_tributaria: (settings.crt === '3') 
              ? (cleanCfop === '5405' ? '60' : '00')
              : (cleanCfop === '5405' ? '500' : '102'),
            pis_situacao_tributaria: '07',
            cofins_situacao_tributaria: '07'
          };
        }),
        formas_pagamento: [
          {
            forma_pagamento: (() => {
               const pm = (paymentMethod || '').toUpperCase();
               if (pm === 'PIX') return '17';
               if (pm === 'CREDITO' || pm === 'CARTÃO DE CRÉDITO') return '03';
               if (pm === 'DEBITO' || pm === 'CARTÃO DE DÉBITO') return '04';
               if (pm === 'DINHEIRO' || pm === 'CASH') return '01';
               return '01';
            })(),
            valor_pagamento: totalItemsValue.toFixed(2)
          }
        ]
      };

      // Identificação do Destinatário (apenas se informado)
      if (isCpfDest) {
        focusPayload.cpf_destinatario = cleanDestDoc;
      } else if (isCnpjDest) {
        focusPayload.cnpj_destinatario = cleanDestDoc;
      }
      const customerName = req.body.customerName;
      if (customerName && String(customerName).trim()) {
        focusPayload.nome_destinatario = String(customerName).trim().slice(0, 60);
      }

      // ref é obrigatório pela Focus NFe — identifica unicamente a nota
      const focusUrl = `${baseURL}?ref=${ref}&cnpj_emitente=${cleanCnpj}&dry_run=0`;
      console.log('[emit-nfce] Enviando para:', focusUrl);
      console.log('[emit-nfce] Payload:', JSON.stringify(focusPayload, null, 2));

      const cleanToken = (settings.apiToken || '').trim();
      const focusRes = await fetch(focusUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(cleanToken + ':').toString('base64')
        },
        body: JSON.stringify(focusPayload)
      });

      const data = await focusRes.json();
      
      if (!focusRes.ok) {
        console.error('[emit-nfce] Focus NFe recusou:', focusRes.status, JSON.stringify(data, null, 2));
        
        let errosFormatados = Array.isArray(data.erros)
          ? data.erros.map((e: any) => `${e.campo ? '[' + e.campo + '] ' : ''}${e.mensagem || e.codigo || JSON.stringify(e)}`).join('\n')
          : data.mensagem || JSON.stringify(data);

        if (focusRes.status === 403 || data.codigo === 'cnpj_nao_autorizado' || JSON.stringify(data).includes('não autorizado')) {
          errosFormatados = `CNPJ ${cleanCnpj} não autorizado pela Focus NFe para emissão de NFC-e.\n\n` +
            `Principais motivos e como resolver:\n` +
            `1. Token da Empresa: No modelo Software House, verifique se está usando o Token específico desta Empresa (encontrado em "Empresas > [Sua Empresa] > Tokens" no portal da Focus NFe) em vez do Token Master.\n` +
            `2. CSC da SEFAZ: O Código CSC e o ID do Token devem estar cadastrados na empresa (gerados no portal da SEFAZ do seu estado).\n` +
            `3. Credenciamento SEFAZ: Confirme com a contabilidade se o CNPJ já está credenciado na SEFAZ para emitir NFC-e (modelo 65) no ambiente ${settings.environment === 'producao' ? 'de Produção' : 'de Homologação'}.`;
        }

        return res.status(400).json({ error: `Focus NFe (${focusRes.status}): ${errosFormatados}` });
      }

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
          
          const xmlToSave = `<?xml version="1.0" encoding="UTF-8"?><NFe><infNFe Id="${focusDataRef}"><emit><CNPJ>${settings.cnpj.replace(/\D/g, '')}</CNPJ></emit></infNFe></NFe>`;
          secureArchiveXML('SAIDA', focusDataRef, xmlToSave);
          
          const host = req.get('host');
          const protocol = req.protocol;
          const danfeUrl = `${protocol}://${host}/api/fiscal/danfe/${encodeURIComponent(data.ref)}`;

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
                pdfUrl: danfeUrl
              }
            });
          }
        } catch (e) {
          console.error("Erro ao salvar NotaEmitida", e);
        }

        const host = req.get('host');
        const protocol = req.protocol;
        const danfeUrl = `${protocol}://${host}/api/fiscal/danfe/${encodeURIComponent(data.ref)}`;

        return res.json({
          success: true,
          status: data.status,
          referencia: data.ref,
          chaveAcesso: data.chave_nfe,
          caminhoDanfe: danfeUrl
        });
      }

      // Caso seja 'processando', aguardamos 2.5s e tentamos buscar 1x
      if (data.status === 'processando') {
        await new Promise(resolve => setTimeout(resolve, 2500));
        const checkRes = await fetch(baseURL + '/' + data.ref + '?cnpj_emitente=' + cleanCnpj, {
          headers: { 'Authorization': 'Basic ' + Buffer.from(cleanToken + ':').toString('base64') }
        });
        const checkData = await checkRes.json();

        if (checkData.status === 'autorizado') {
          const host = req.get('host');
          const protocol = req.protocol;
          const authorizedDanfeUrl = `${protocol}://${host}/api/fiscal/danfe/${encodeURIComponent(checkData.ref || data.ref)}`;
          try {
            const NotaEmitida = (prisma as any).notaEmitida;
            const xmlToSave = `<?xml version="1.0" encoding="UTF-8"?><NFe><infNFe Id="${focusDataRef}"><emit><CNPJ>${cleanCnpj}</CNPJ></emit></infNFe></NFe>`;
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
                  pdfUrl: authorizedDanfeUrl
                }
              });
            }
          } catch (e) {
            console.error("Erro ao salvar NotaEmitida", e);
          }

          return res.json({
            success: true,
            status: checkData.status,
            referencia: checkData.ref || data.ref,
            chaveAcesso: checkData.chave_nfe,
            caminhoDanfe: authorizedDanfeUrl
          });
        }
        
        if (checkData.status === 'erro_autorizacao') {
          const errMsg = Array.isArray(checkData.erros)
            ? checkData.erros.map((e: any) => `${e.campo ? '[' + e.campo + '] ' : ''}${e.mensagem || e.codigo}`).join('\n')
            : checkData.mensagem || JSON.stringify(checkData);
          console.error('[emit-nfce] erro_autorizacao:', JSON.stringify(checkData, null, 2));
          return res.status(400).json({ error: `SEFAZ recusou a nota: ${errMsg}` });
        }

        return res.json({
          success: true,
          status: checkData.status,
          mensagem: 'A nota está na fila da SEFAZ. Você poderá consultar depois.',
          referencia: data.ref,
          ref: data.ref
        });
      }

      res.json(data);
    } catch (err: any) {
      console.error('[emit-nfce] Exceção:', err);
      res.status(500).json({ error: err.message || 'Erro ao conectar com API Fiscal.' });
    }
  });

  // ============================================================
  // Emitir NF-e (Modelo 55 - Saída)
  // ============================================================
  router.post('/emit-nfe', async (req, res) => {
    try {
      const {
        items,
        customerCpf,
        customerName,
        paymentMethod,
        orderId,
        customerCep,
        customerLogradouro,
        customerNumero,
        customerComplemento,
        customerBairro,
        customerMunicipio,
        customerUf
      } = req.body;

      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'Nenhum item adicionado para a nota.' });
      }

      const settings = await getFiscalSettingsSafe();
      if (!settings || !settings.apiToken) {
        return res.status(400).json({ error: 'Token da API Fiscal não configurado. Vá nas Configurações Fiscais.' });
      }

      const { payload, ref } = await buildNfePayload({
        items,
        customerDoc: customerCpf,
        orderId,
        settings,
        paymentMethod,
        customerName,
        customerCep,
        customerLogradouro,
        customerNumero,
        customerComplemento,
        customerBairro,
        customerMunicipio,
        customerUf
      });

      const isProducao = settings.environment === 'producao';
      const baseURL = isProducao ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
      const focusUrl = `${baseURL}/v2/nfe?ref=${encodeURIComponent(ref)}&dry_run=0`;
      const cleanToken = settings.apiToken.trim();

      console.log('[emit-nfe] Enviando para:', focusUrl);
      const focusRes = await fetch(focusUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(cleanToken + ':').toString('base64')
        },
        body: JSON.stringify(payload)
      });

      const data: any = await focusRes.json().catch(() => ({}));

      if (!focusRes.ok) {
        console.error('[emit-nfe] Focus NFe recusou:', focusRes.status, data);
        let errosFormatados = Array.isArray(data.erros)
          ? data.erros.map((e: any) => `${e.campo ? '[' + e.campo + '] ' : ''}${e.mensagem || e.codigo || JSON.stringify(e)}`).join('\n')
          : data.mensagem || JSON.stringify(data);
        return res.status(400).json({ error: `Focus NFe (${focusRes.status}): ${errosFormatados}` });
      }

      const totalItemsValue = items.reduce((acc: number, i: any) => acc + (Number(i.price || 0) * Number(i.quantity || 1)), 0);
      const host = req.get('host');
      const protocol = req.protocol;
      const danfeUrl = `${protocol}://${host}/api/fiscal/danfe/${encodeURIComponent(ref)}`;
      const authHeader = 'Basic ' + Buffer.from(cleanToken + ':').toString('base64');

      let currentData = data;
      const startTime = Date.now();

      // Se a nota estiver em processamento assíncrono na SEFAZ, aguarda e consulta até 16s com ?completa=1
      if (currentData.status === 'processando') {
        while (currentData.status === 'processando' && (Date.now() - startTime) < 16000) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const checkRes = await fetch(`${baseURL}/v2/nfe/${encodeURIComponent(ref)}?completa=1`, {
            headers: { 'Authorization': authHeader }
          });
          const checkData: any = await checkRes.json().catch(() => ({}));
          if (checkData.status) {
            currentData = checkData;
          }
        }
      }

      if (currentData.status === 'autorizado') {
        const xmlUrl = currentData.caminho_xml_nota_fiscal || `${baseURL}/v2/nfe/${ref}.xml`;
        await persistNfeRecord({
          referencia: ref,
          chave: currentData.chave_nfe || currentData.chave,
          numero: currentData.numero ? String(currentData.numero) : undefined,
          serie: currentData.serie ? String(currentData.serie) : String(settings.serieNfe || '1'),
          pdfUrl: danfeUrl,
          xmlUrl: xmlUrl,
          valorTotal: totalItemsValue,
          status: 'autorizado'
        });

        return res.json({
          success: true,
          status: 'autorizado',
          referencia: ref,
          chaveAcesso: currentData.chave_nfe || currentData.chave,
          caminhoDanfe: danfeUrl,
          numero: currentData.numero,
          serie: currentData.serie || String(settings.serieNfe || '1')
        });
      }

      if (currentData.status === 'erro_autorizacao') {
        await persistNfeRecord({
          referencia: ref,
          valorTotal: totalItemsValue,
          status: 'erro_autorizacao'
        });
        const errMsg = Array.isArray(currentData.erros)
          ? currentData.erros.map((e: any) => `${e.campo ? '[' + e.campo + '] ' : ''}${e.mensagem || e.codigo}`).join('\n')
          : currentData.mensagem || JSON.stringify(currentData);
        return res.status(400).json({ error: `SEFAZ recusou a NF-e: ${errMsg}` });
      }

      // Se ainda estiver processando após timeout, persiste para que apareça no histórico e telas de consulta/cancelamento
      await persistNfeRecord({
        referencia: ref,
        chave: currentData.chave_nfe || currentData.chave,
        numero: currentData.numero ? String(currentData.numero) : undefined,
        serie: currentData.serie ? String(currentData.serie) : String(settings.serieNfe || '1'),
        pdfUrl: danfeUrl,
        xmlUrl: currentData.caminho_xml_nota_fiscal || `${baseURL}/v2/nfe/${ref}.xml`,
        valorTotal: totalItemsValue,
        status: currentData.status || 'processando'
      });

      return res.json({
        success: true,
        status: currentData.status || 'processando',
        mensagem: 'A NF-e está na fila de processamento da SEFAZ. O status será atualizado automaticamente.',
        referencia: ref,
        caminhoDanfe: danfeUrl,
        chaveAcesso: currentData.chave_nfe || currentData.chave,
        numero: currentData.numero,
        serie: currentData.serie || String(settings.serieNfe || '1')
      });
    } catch (err: any) {
      console.error('[emit-nfe] Exceção:', err);
      res.status(500).json({ error: err.message || 'Erro ao conectar com API Fiscal para emitir NF-e.' });
    }
  });

  // ============================================================
  // Encaminhar NFC-e por E-mail (via Focus NFe)
  // ============================================================
  router.post('/send-email', async (req, res) => {
    try {
      const { referencia, email } = req.body;
      if (!referencia || !email) {
        return res.status(400).json({ error: 'Referência da nota e e-mail são obrigatórios.' });
      }

      const settings = await getFiscalSettingsSafe();
      if (!settings?.apiToken) {
        return res.status(400).json({ error: 'Token fiscal não configurado.' });
      }

      const cleanToken = settings.apiToken.trim();
      const isProducao = settings.environment === 'producao';
      const baseURL = isProducao ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';

      const isNfe = referencia.startsWith('nfe_');
      const docTipo = isNfe ? 'nfe' : 'nfce';
      const focusUrl = `${baseURL}/v2/${docTipo}/${encodeURIComponent(referencia)}/email`;

      const focusRes = await fetch(focusUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(cleanToken + ':').toString('base64')
        },
        body: JSON.stringify({
          emails: [String(email).trim()]
        })
      });

      const data = await focusRes.json().catch(() => ({}));
      if (!focusRes.ok) {
        const erroMsg = data.mensagem || data.codigo || JSON.stringify(data);
        return res.status(400).json({ error: `Focus NFe: ${erroMsg}` });
      }

      return res.json({ success: true, message: 'Nota fiscal enviada por e-mail com sucesso!' });
    } catch (err: any) {
      console.error('[send-email] Erro:', err);
      return res.status(500).json({ error: 'Erro interno ao enviar e-mail.', detail: err.message });
    }
  });


  // ============================================================
  // MÓDULO: BIP DE CHAVE DE ACESSO (Recebimento de NF)
  // ============================================================

  // Extrai metadados fiscais da Chave de Acesso de 44 dígitos (Padrão Nacional SEFAZ)
  function parseChaveAcessoNfe(chave: string) {
    const clean = chave.replace(/\D/g, '');
    if (clean.length !== 44) return null;

    const ufCod = clean.substring(0, 2);
    const aamm = clean.substring(2, 6);
    const cnpjEmitente = clean.substring(6, 20);
    const modelo = clean.substring(20, 22);
    const serie = clean.substring(22, 25);
    const numero = clean.substring(25, 34);
    const tpEmis = clean.substring(34, 35);
    const cNF = clean.substring(35, 43);
    const cDV = clean.substring(43, 44);

    const cnpjFormatado = cnpjEmitente.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    const numLimpo = parseInt(numero, 10).toString();
    const serieLimpa = parseInt(serie, 10).toString();

    return {
      chave: clean,
      ufCod,
      anoMes: `20${aamm.substring(0, 2)}-${aamm.substring(2, 4)}`,
      cnpjEmitente,
      cnpjFormatado,
      modelo,
      serie: serieLimpa,
      numero: numLimpo,
      tpEmis
    };
  }

  // Busca o XML completo ou metadados de uma NF-e recebida na Focus NFe
  async function fetchNfeRecebidaXml(baseURL: string, authHeader: string, chaveClean: string): Promise<{ xmlText: string; xmlData?: any } | null> {
    console.log(`[fetchNfeRecebidaXml] Iniciando busca para chave ${chaveClean} em ${baseURL}...`);

    // 1. Tenta endpoint oficial direto .xml
    try {
      const resXml = await fetch(`${baseURL}/v2/nfes_recebidas/${chaveClean}.xml`, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/xml, text/xml, */*' },
        redirect: 'follow'
      });
      console.log(`[fetchNfeRecebidaXml] .xml status: ${resXml.status}`);
      if (resXml.ok) {
        const text = await resXml.text();
        if (text && (text.includes('<nfeProc') || text.includes('<NFe') || text.startsWith('<?xml'))) {
          console.log(`[fetchNfeRecebidaXml] ✓ XML obtido com sucesso via .xml direto (${text.length} bytes)`);
          return { xmlText: text };
        }
      }
    } catch (err) {
      console.warn('[fetchNfeRecebidaXml] Tentativa .xml falhou:', err);
    }

    // 2. Tenta endpoint .json para obter dados e caminho_xml_nota_fiscal
    try {
      const resJson = await fetch(`${baseURL}/v2/nfes_recebidas/${chaveClean}.json`, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
      });
      console.log(`[fetchNfeRecebidaXml] .json status: ${resJson.status}`);
      if (resJson.ok) {
        const json = await resJson.json();
        console.log(`[fetchNfeRecebidaXml] .json retornado:`, {
          status: json.status,
          manifesto: json.manifesto,
          caminho_xml: json.caminho_xml_nota_fiscal,
          caminho_danfe: json.caminho_danfe
        });

        if (json.caminho_xml_nota_fiscal) {
          const downloadUrl = json.caminho_xml_nota_fiscal.startsWith('http')
            ? json.caminho_xml_nota_fiscal
            : `${baseURL}${json.caminho_xml_nota_fiscal}`;
          console.log(`[fetchNfeRecebidaXml] Baixando XML de caminho_xml_nota_fiscal: ${downloadUrl}`);
          const fileRes = await fetch(downloadUrl, {
            headers: downloadUrl.includes('focusnfe.com.br') ? { 'Authorization': authHeader } : {},
            redirect: 'follow'
          });
          if (fileRes.ok) {
            const text = await fileRes.text();
            if (text && (text.includes('<nfeProc') || text.includes('<NFe') || text.startsWith('<?xml'))) {
              console.log(`[fetchNfeRecebidaXml] ✓ XML baixado com sucesso via URL do json (${text.length} bytes)`);
              return { xmlText: text, xmlData: json };
            }
          } else {
            console.warn(`[fetchNfeRecebidaXml] Falha ao baixar da URL do json, status: ${fileRes.status}`);
          }
        }
        return { xmlText: '', xmlData: json };
      }
    } catch (err) {
      console.warn('[fetchNfeRecebidaXml] Tentativa .json falhou:', err);
    }

    // 3. Fallback: endpoint legado /xml (com barra)
    try {
      const resLegacy = await fetch(`${baseURL}/v2/nfes_recebidas/${chaveClean}/xml`, {
        headers: { 'Authorization': authHeader },
        redirect: 'follow'
      });
      console.log(`[fetchNfeRecebidaXml] /xml legado status: ${resLegacy.status}`);
      if (resLegacy.ok) {
        const text = await resLegacy.text();
        if (text && (text.includes('<nfeProc') || text.includes('<NFe') || text.startsWith('<?xml'))) {
          console.log(`[fetchNfeRecebidaXml] ✓ XML obtido via endpoint legado /xml (${text.length} bytes)`);
          return { xmlText: text };
        }
      }
    } catch (err) {
      console.warn('[fetchNfeRecebidaXml] Tentativa legada /xml falhou:', err);
    }

    // 4. Fallback sem extensão: /v2/nfes_recebidas/:chave
    try {
      const resRaw = await fetch(`${baseURL}/v2/nfes_recebidas/${chaveClean}`, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/xml, text/xml, application/json, */*' },
        redirect: 'follow'
      });
      console.log(`[fetchNfeRecebidaXml] rota pura status: ${resRaw.status}`);
      if (resRaw.ok) {
        const text = await resRaw.text();
        if (text && (text.includes('<nfeProc') || text.includes('<NFe') || text.startsWith('<?xml'))) {
          return { xmlText: text };
        }
      }
    } catch (err) {
      console.warn('[fetchNfeRecebidaXml] Tentativa rota pura falhou:', err);
    }

    return null;
  }

  // 1º BIP: Recebimento de NF-e e Ciência da Operação na SEFAZ
  router.post('/bip-chave', async (req, res) => {
    try {
      const { chave } = req.body;
      const chaveClean = (chave || '').replace(/\D/g, '');
      if (chaveClean.length !== 44) {
        return res.status(400).json({ error: 'Chave de acesso inválida. Deve ter exatamente 44 dígitos numéricos.' });
      }

      const parsedKey = parseChaveAcessoNfe(chaveClean);
      if (!parsedKey) {
        return res.status(400).json({ error: 'Chave de acesso não possui formato de NF-e válido.' });
      }

      const settings = await getFiscalSettingsSafe();
      if (!settings?.apiToken) {
        return res.status(400).json({ error: 'Configure o Token da API Fiscal nas Configurações Fiscais antes de usar o bip.' });
      }

      const isProducao = settings.environment === 'producao';
      const baseURL = isProducao
        ? 'https://api.focusnfe.com.br'
        : 'https://homologacao.focusnfe.com.br';

      const authHeader = 'Basic ' + Buffer.from(settings.apiToken + ':').toString('base64');

      // Garantir existência da tabela no banco
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

      // PASSO 1: Registrar Ciência da Operação na SEFAZ (Focus NFe)
      let manifestoOk = false;
      let manifestoMsg = '';
      try {
        const manifestoRes = await fetch(`${baseURL}/v2/nfes_recebidas/${chaveClean}/manifesto`, {
          method: 'POST',
          headers: { 
            'Accept': 'application/json',
            'Content-Type': 'application/json', 
            'Authorization': authHeader 
          },
          body: JSON.stringify({ tipo: 'ciencia' })
        });
        const manifestoData = await manifestoRes.json().catch(() => ({}));
        manifestoOk = manifestoRes.ok || JSON.stringify(manifestoData).includes('ciencia') || manifestoData.status === 'ok';
        manifestoMsg = manifestoData.mensagem_sefaz || manifestoData.status || '';
        console.log('[Bip] Manifesto de ciência retornado:', manifestoRes.status, manifestoData);
      } catch (manErr: any) {
        console.warn('[Bip] Aviso no envio do manifesto:', manErr?.message);
      }

      // Aguarda 1.8 segundos para a Focus e SEFAZ registrarem o evento
      await new Promise(r => setTimeout(r, 1800));

      // PASSO 2: Buscar XML e detalhes da nota
      const nfeResult = await fetchNfeRecebidaXml(baseURL, authHeader, chaveClean);
      let xmlText = nfeResult?.xmlText || null;
      let xmlData = nfeResult?.xmlData || null;

      let emitenteNome = xmlData?.nome_emitente || '';
      let cnpjEmitente = (xmlData?.documento_emitente || xmlData?.cnpj_emitente || parsedKey.cnpjEmitente).replace(/\D/g, '');
      let numeroNf = xmlData?.numero || parsedKey.numero;
      let serieNf = xmlData?.serie || parsedKey.serie;
      let dataEmissao = xmlData?.data_emissao || new Date().toISOString();
      let valorTotal = parseFloat(xmlData?.valor_total || '0');

      // Se temos o XML completo, parsear dados oficiais
      if (xmlText) {
        try {
          const jsonObj = parser.parse(xmlText);
          const nfe = jsonObj.nfeProc?.NFe?.infNFe || jsonObj.NFe?.infNFe;
          if (nfe) {
            emitenteNome = nfe.emit?.xNome || emitenteNome;
            cnpjEmitente = (nfe.emit?.CNPJ || nfe.emit?.CPF || cnpjEmitente).replace(/\D/g, '');
            numeroNf = nfe.ide?.nNF || numeroNf;
            serieNf = nfe.ide?.serie || serieNf;
            dataEmissao = nfe.ide?.dhEmi || dataEmissao;
            valorTotal = parseFloat(nfe.total?.ICMSTot?.vNF || valorTotal.toString());
          }
        } catch (parseErr) {
          console.warn('[Bip] Erro ao parsear XML da nota:', parseErr);
        }
      }

      if (!emitenteNome) {
        emitenteNome = `Fornecedor CNPJ ${parsedKey.cnpjFormatado}`;
      }

      const now = new Date().toISOString();
      const statusFinal = xmlText ? 'recebida' : 'ciencia_registrada';

      // PASSO 3: Salvar registro local sem travar
      await prisma.$executeRawUnsafe(`
        INSERT OR REPLACE INTO "NotaRecebida"
          ("id", "chave", "emitente", "cnpjEmitente", "numero", "serie", "dataEmissao", "valorTotal", "status", "xmlContent", "createdAt")
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        chaveClean,
        chaveClean,
        emitenteNome,
        cnpjEmitente,
        numeroNf,
        serieNf,
        dataEmissao,
        valorTotal,
        statusFinal,
        xmlText || (xmlData ? JSON.stringify(xmlData) : null),
        now
      );

      // Sincroniza fornecedor se houver CNPJ
      if (cnpjEmitente) {
        try {
          await prisma.supplier.upsert({
            where: { document: cnpjEmitente },
            update: { name: emitenteNome },
            create: { name: emitenteNome, document: cnpjEmitente }
          });
        } catch (supErr) {
          console.warn('[Bip] Erro ao sincronizar fornecedor:', supErr);
        }
      }

      // Arquiva no cofre fiscal de 5 anos se tiver o XML
      if (xmlText) {
        try {
          secureArchiveXML('ENTRADA', chaveClean, xmlText);
        } catch (archErr) {
          console.warn('[Bip] Erro ao arquivar XML no cofre:', archErr);
        }
      }

      const msgRetorno = xmlText
        ? '✓ 1º Bip Concluído! Ciência registrada na SEFAZ e XML baixado com sucesso. A nota está pronta para o 2º Bip.'
        : '✓ 1º Bip Concluído! Ciência da Operação registrada na SEFAZ. O download do XML completo está sendo processado pelos servidores da SEFAZ (aguarde ~30s ou faça upload do XML direto).';

      res.json({
        success: true,
        chave: chaveClean,
        emitente: emitenteNome,
        cnpjEmitente,
        numero: numeroNf,
        serie: serieNf,
        dataEmissao,
        valorTotal,
        xmlDisponivel: Boolean(xmlText),
        status: statusFinal,
        manifestoRegistrado: manifestoOk,
        mensagem: msgRetorno
      });
    } catch (err: any) {
      console.error('[Bip] Erro:', err);
      res.status(500).json({ error: 'Erro ao processar a chave de acesso: ' + (err.message || err) });
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

  // Forçar sincronização/busca do XML de uma nota específica na SEFAZ
  router.post('/notas-recebidas/:chave/sync', async (req, res) => {
    try {
      const { chave } = req.params;
      const chaveClean = chave.replace(/\D/g, '');
      const settings = await getFiscalSettingsSafe();
      if (!settings?.apiToken) {
        return res.status(400).json({ error: 'Token da Focus NFe não configurado.' });
      }

      const isProducao = settings.environment === 'producao';
      const baseURL = isProducao
        ? 'https://api.focusnfe.com.br'
        : 'https://homologacao.focusnfe.com.br';
      const authHeader = 'Basic ' + Buffer.from(settings.apiToken + ':').toString('base64');

      // 1. Tenta re-enviar ciência caso não tenha sido processada
      try {
        await fetch(`${baseURL}/v2/nfes_recebidas/${chaveClean}/manifesto`, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': authHeader },
          body: JSON.stringify({ tipo: 'ciencia' })
        });
      } catch (_) {}

      // 2. Tenta buscar XML e status
      const nfeResult = await fetchNfeRecebidaXml(baseURL, authHeader, chaveClean);
      const xmlText = nfeResult?.xmlText;
      const xmlData = nfeResult?.xmlData;

      if (xmlText) {
        let emitenteNome = xmlData?.nome_emitente || '';
        let cnpjEmitente = (xmlData?.documento_emitente || xmlData?.cnpj_emitente || '').replace(/\D/g, '');
        let numeroNf = xmlData?.numero || '';
        let serieNf = xmlData?.serie || '';
        let dataEmissao = xmlData?.data_emissao || new Date().toISOString();
        let valorTotal = parseFloat(xmlData?.valor_total || '0');

        try {
          const jsonObj = parser.parse(xmlText);
          const nfe = jsonObj.nfeProc?.NFe?.infNFe || jsonObj.NFe?.infNFe;
          if (nfe) {
            emitenteNome = nfe.emit?.xNome || emitenteNome;
            cnpjEmitente = (nfe.emit?.CNPJ || nfe.emit?.CPF || cnpjEmitente).replace(/\D/g, '');
            numeroNf = nfe.ide?.nNF || numeroNf;
            serieNf = nfe.ide?.serie || serieNf;
            dataEmissao = nfe.ide?.dhEmi || dataEmissao;
            valorTotal = parseFloat(nfe.total?.ICMSTot?.vNF || valorTotal.toString());
          }
        } catch (_) {}

        await prisma.$executeRawUnsafe(`
          UPDATE "NotaRecebida"
          SET "xmlContent" = ?,
              "status" = 'recebida',
              "emitente" = COALESCE(NULLIF(?, ''), "emitente"),
              "cnpjEmitente" = COALESCE(NULLIF(?, ''), "cnpjEmitente"),
              "numero" = COALESCE(NULLIF(?, ''), "numero"),
              "serie" = COALESCE(NULLIF(?, ''), "serie"),
              "valorTotal" = CASE WHEN ? > 0 THEN ? ELSE "valorTotal" END
          WHERE "chave" = ?
        `, xmlText, emitenteNome, cnpjEmitente, numeroNf, serieNf, valorTotal, valorTotal, chaveClean);

        try { secureArchiveXML('ENTRADA', chaveClean, xmlText); } catch (_) {}

        return res.json({
          success: true,
          xmlDisponivel: true,
          message: '✓ XML sincronizado com sucesso da SEFAZ! A nota está pronta para o 2º Bip / Conferência.'
        });
      }

      // Se ainda não liberou o XML
      return res.json({
        success: false,
        xmlDisponivel: false,
        statusSefaz: xmlData?.status || xmlData?.manifesto || 'pendente',
        message: 'A SEFAZ ainda não liberou o download do XML para esta nota. Você pode aguardar mais um momento ou enviar o arquivo .xml manualmente.'
      });
    } catch (err: any) {
      console.error('[Sync Nota] Erro:', err);
      res.status(500).json({ error: 'Erro ao sincronizar nota: ' + (err.message || err) });
    }
  });

  // Baixar XML de uma nota recebida para importação de itens
  router.get('/notas-recebidas/:chave/xml', async (req, res) => {
    try {
      const { chave } = req.params;
      const chaveClean = chave.replace(/\D/g, '');
      const settings = await getFiscalSettingsSafe();
      if (!settings?.apiToken) {
        return res.status(400).json({ error: 'Token da API não configurado.' });
      }

      // 1. Tenta pegar do banco local primeiro
      try {
        const localNota: any = await prisma.$queryRawUnsafe(
          `SELECT "xmlContent" FROM "NotaRecebida" WHERE "chave" = ? LIMIT 1`,
          chaveClean
        );
        if (Array.isArray(localNota) && localNota.length > 0) {
          const content = localNota[0].xmlContent;
          if (content && (content.includes('<nfeProc') || content.includes('<NFe') || content.startsWith('<?xml'))) {
            res.setHeader('Content-Type', 'application/xml');
            return res.send(content);
          }
        }
      } catch (localErr) {}

      const isProducao = settings.environment === 'producao';
      const baseURL = isProducao
        ? 'https://api.focusnfe.com.br'
        : 'https://homologacao.focusnfe.com.br';

      const authHeader = 'Basic ' + Buffer.from(settings.apiToken + ':').toString('base64');

      const nfeResult = await fetchNfeRecebidaXml(baseURL, authHeader, chaveClean);
      if (!nfeResult?.xmlText) {
        return res.status(404).json({ error: 'XML não disponível na SEFAZ ainda. Aguarde alguns instantes ou faça upload do arquivo .xml recebido do fornecedor.' });
      }

      res.setHeader('Content-Type', 'application/xml');
      res.send(nfeResult.xmlText);
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao baixar XML: ' + (err.message || err) });
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
        const settings = await getFiscalSettingsSafe();
        if (!settings?.apiToken) {
          return res.status(400).json({ error: 'Token da API Fiscal não configurado. Verifique as configurações fiscais.' });
        }

        const isProducao = settings.environment === 'producao';
        const baseURL = isProducao
          ? 'https://api.focusnfe.com.br'
          : 'https://homologacao.focusnfe.com.br';

        const authHeader = 'Basic ' + Buffer.from(settings.apiToken + ':').toString('base64');

        // Tenta manifestar ciência se ainda não tiver feito
        fetch(`${baseURL}/v2/nfes_recebidas/${chaveClean}/manifesto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'Accept': 'application/json' },
          body: JSON.stringify({ tipo: 'ciencia' })
        }).catch(() => {});

        const nfeResult = await fetchNfeRecebidaXml(baseURL, authHeader, chaveClean);
        if (nfeResult?.xmlText) {
          xmlText = nfeResult.xmlText;
          // Salvar em cache local no NotaRecebida para os próximos bips
          try {
            await prisma.$executeRawUnsafe(
              `UPDATE "NotaRecebida" SET "xmlContent" = ?, "status" = 'recebida' WHERE "chave" = ?`,
              xmlText,
              chaveClean
            );
          } catch {}
        }
      }

      if (!xmlText) {
        return res.status(404).json({ 
          error: 'XML da nota ainda em processamento na SEFAZ. Como a Ciência da Operação foi registrada agora, a SEFAZ leva cerca de 30 a 60 segundos para liberar o arquivo completo. Você também pode importar o arquivo .xml diretamente.',
          xmlPending: true
        });
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
  // Sincronizar Notas Destinadas (Focus NFe) - Consulta de Lote Real
  // ============================================================
  router.get('/sync-nfe-recebidas', async (req, res) => {
    try {
      const settings = await getFiscalSettingsSafe();
      if (!settings || !settings.apiToken) {
        return res.status(400).json({ error: 'Configuração fiscal incompleta. Configure o token da Focus NFe.' });
      }

      const isProducao = settings.environment === 'producao';
      const baseURL = isProducao
        ? 'https://api.focusnfe.com.br'
        : 'https://homologacao.focusnfe.com.br';

      const authHeader = 'Basic ' + Buffer.from(settings.apiToken + ':').toString('base64');
      const cleanCnpj = (settings.cnpj || '').replace(/\D/g, '');

      let added = 0;
      try {
        const queryParams = cleanCnpj ? `?cnpj_destinatario=${cleanCnpj}` : '';
        const focusRes = await fetch(`${baseURL}/v2/nfes_recebidas${queryParams}`, {
          headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
        });

        if (focusRes.ok) {
          const notasFocus = await focusRes.json();
          if (Array.isArray(notasFocus)) {
            for (const item of notasFocus) {
              const chaveItem = item.chave_nfe || item.chave;
              if (!chaveItem) continue;

              const chaveClean = chaveItem.replace(/\D/g, '');
              const parsedKey = parseChaveAcessoNfe(chaveClean);
              const emitente = item.nome_emitente || (parsedKey ? `Fornecedor CNPJ ${parsedKey.cnpjFormatado}` : 'Fornecedor');
              const cnpjEmitente = (item.documento_emitente || item.cnpj_emitente || parsedKey?.cnpjEmitente || '').replace(/\D/g, '');
              const numero = item.numero || parsedKey?.numero || '';
              const serie = item.serie || parsedKey?.serie || '';
              const valorTotal = parseFloat(item.valor_total || '0');
              const dataEmissao = item.data_emissao || new Date().toISOString();

              await prisma.$executeRawUnsafe(`
                INSERT OR IGNORE INTO "NotaRecebida"
                  ("id", "chave", "emitente", "cnpjEmitente", "numero", "serie", "dataEmissao", "valorTotal", "status", "xmlContent", "createdAt")
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `,
                chaveClean,
                chaveClean,
                emitente,
                cnpjEmitente,
                numero,
                serie,
                dataEmissao,
                valorTotal,
                item.nfe_completa ? 'recebida' : 'ciencia_registrada',
                null,
                new Date().toISOString()
              );
              added++;
            }
          }
        }
      } catch (syncErr: any) {
        console.warn('[Sync NFe Recebidas] Falha ao consultar Focus NFe:', syncErr?.message);
      }

      res.json({ 
        success: true, 
        count: added, 
        message: added > 0 
          ? `${added} novas notas de fornecedores sincronizadas da SEFAZ com sucesso.`
          : 'Sincronização com a SEFAZ concluída. Nenhuma nova nota pendente no momento.'
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao sincronizar SEFAZ: ' + (err.message || err) });
    }
  });

  
  // ============================================================
  // Reimprimir NFC-e / Consultar Status
  // ============================================================
  router.get('/reprint/:ref', async (req, res) => {
    try {
      const { ref } = req.params;
      const settings = await getFiscalSettingsSafe();
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
         const host = req.get('host');
         const protocol = req.protocol;
         const caminhoDanfe = `${protocol}://${host}/api/fiscal/danfe/${encodeURIComponent(ref)}`;

         return res.json({
           success: true,
           status: data.status,
           chaveAcesso: data.chave_nfe,
           caminhoDanfe,
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
      const monthPrefix = `${yearStr}-${monthStr.padStart(2, '0')}`;
      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();
      const startTs = startDate.getTime();
      const endTs = endDate.getTime();

      // Consulta resiliente a SQLite: datas podem estar armazenadas como ISO strings ("2026-09-11...") ou Unix timestamps
      const emitidasRaw: any[] = await prisma.$queryRawUnsafe(`
        SELECT * FROM "NotaEmitida"
        WHERE ("createdAt" LIKE ? OR "dataEmissao" LIKE ?)
           OR ("createdAt" >= ? AND "createdAt" <= ?)
           OR (CAST("createdAt" AS INTEGER) >= ? AND CAST("createdAt" AS INTEGER) <= ?)
      `, `${monthPrefix}%`, `${monthPrefix}%`, startIso, endIso, startTs, endTs);

      const recebidasRaw: any[] = await prisma.$queryRawUnsafe(`
        SELECT * FROM "NotaRecebida"
        WHERE ("createdAt" LIKE ? OR "dataEmissao" LIKE ?)
           OR ("createdAt" >= ? AND "createdAt" <= ?)
           OR (CAST("createdAt" AS INTEGER) >= ? AND CAST("createdAt" AS INTEGER) <= ?)
      `, `${monthPrefix}%`, `${monthPrefix}%`, startIso, endIso, startTs, endTs);

      const emitidas = emitidasRaw || [];
      // Se a nota recebida estiver com valorTotal zerado mas tiver XML, reextrai dinamicamente
      const recebidas = (recebidasRaw || []).map((n: any) => {
        let val = Number(n.valorTotal) || 0;
        if (val === 0 && n.xmlContent && !n.xmlContent.startsWith('{')) {
          try {
            const parsed = parser.parse(n.xmlContent);
            const nfe = parsed.nfeProc?.NFe?.infNFe || parsed.NFe?.infNFe;
            const xmlVal = parseFloat(nfe?.total?.ICMSTot?.vNF || '0');
            if (xmlVal > 0) val = xmlVal;
          } catch (_) {}
        }
        return { ...n, valorTotal: val };
      });

      const emitidasTotal = emitidas.reduce((acc: number, n: any) => acc + (n.valorTotal || 0), 0);
      const recebidasTotal = recebidas.reduce((acc: number, n: any) => acc + (n.valorTotal || 0), 0);

      const nfceList = emitidas.filter((n: any) => isNfce(n));
      const nfeList = emitidas.filter((n: any) => isNfe(n));
      const nfceTotal = nfceList.reduce((acc: number, n: any) => acc + (n.valorTotal || 0), 0);
      const nfeTotal = nfeList.reduce((acc: number, n: any) => acc + (n.valorTotal || 0), 0);

      // Calcular Posição de Estoque e Lucro Previsto para o SPED / Contador
      let stockCostTotal = 0;
      let stockSaleTotal = 0;
      const categoriesStockMap = new Map<string, { name: string; itemsCount: number; cost: number; sale: number; profit: number }>();

      try {
        const allProds = await prisma.product.findMany({
          where: { isActive: true },
          include: { category: true }
        });
        for (const p of allProds) {
          const st = Math.max(0, p.stock || 0);
          const cst = (p.costPrice || 0) * st;
          const sl = (p.price || 0) * st;
          stockCostTotal += cst;
          stockSaleTotal += sl;

          const catName = p.category?.name || 'Geral';
          if (!categoriesStockMap.has(catName)) {
            categoriesStockMap.set(catName, { name: catName, itemsCount: 0, cost: 0, sale: 0, profit: 0 });
          }
          const c = categoriesStockMap.get(catName)!;
          c.itemsCount += 1;
          c.cost += cst;
          c.sale += sl;
          c.profit += (sl - cst);
        }
      } catch (_) {}

      const stockProfitTotal = Number((stockSaleTotal - stockCostTotal).toFixed(2));
      const categoriesStock = Array.from(categoriesStockMap.values()).map(c => ({
        name: c.name,
        category: c.name,
        itemsCount: c.itemsCount,
        cost: Number(c.cost.toFixed(2)),
        totalCost: Number(c.cost.toFixed(2)),
        sale: Number(c.sale.toFixed(2)),
        totalSale: Number(c.sale.toFixed(2)),
        profit: Number(c.profit.toFixed(2)),
        expectedProfit: Number(c.profit.toFixed(2)),
        margin: c.sale > 0 ? Number((((c.sale - c.cost) / c.sale) * 100).toFixed(1)) : 0,
        marginPercent: c.sale > 0 ? Number((((c.sale - c.cost) / c.sale) * 100).toFixed(1)) : 0
      }));

      res.json({
        month,
        emitidasCount: emitidas.length,
        emitidasTotal,
        nfceCount: nfceList.length,
        nfceTotal,
        nfeCount: nfeList.length,
        nfeTotal,
        recebidasCount: recebidas.length,
        recebidasTotal,
        stockCostTotal: Number(stockCostTotal.toFixed(2)),
        stockSaleTotal: Number(stockSaleTotal.toFixed(2)),
        stockProfitTotal,
        categoriesStock,
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
      const monthPrefix = `${yearStr}-${monthStr.padStart(2, '0')}`;
      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();
      const startTs = startDate.getTime();
      const endTs = endDate.getTime();

      const settings = await getFiscalSettingsSafe();

      const emitidasRaw: any[] = await prisma.$queryRawUnsafe(`
        SELECT * FROM "NotaEmitida"
        WHERE ("createdAt" LIKE ? OR "dataEmissao" LIKE ?)
           OR ("createdAt" >= ? AND "createdAt" <= ?)
           OR (CAST("createdAt" AS INTEGER) >= ? AND CAST("createdAt" AS INTEGER) <= ?)
        ORDER BY "createdAt" ASC
      `, `${monthPrefix}%`, `${monthPrefix}%`, startIso, endIso, startTs, endTs);

      const recebidasRaw: any[] = await prisma.$queryRawUnsafe(`
        SELECT * FROM "NotaRecebida"
        WHERE ("createdAt" LIKE ? OR "dataEmissao" LIKE ?)
           OR ("createdAt" >= ? AND "createdAt" <= ?)
           OR (CAST("createdAt" AS INTEGER) >= ? AND CAST("createdAt" AS INTEGER) <= ?)
        ORDER BY "createdAt" ASC
      `, `${monthPrefix}%`, `${monthPrefix}%`, startIso, endIso, startTs, endTs);

      const emitidas = emitidasRaw || [];
      const recebidas = (recebidasRaw || []).map((n: any) => {
        let val = Number(n.valorTotal) || 0;
        if (val === 0 && n.xmlContent && !n.xmlContent.startsWith('{')) {
          try {
            const parsed = parser.parse(n.xmlContent);
            const nfe = parsed.nfeProc?.NFe?.infNFe || parsed.NFe?.infNFe;
            const xmlVal = parseFloat(nfe?.total?.ICMSTot?.vNF || '0');
            if (xmlVal > 0) val = xmlVal;
          } catch (_) {}
        }
        return { ...n, valorTotal: val };
      });

      const zip = new AdmZip();

      // 1. Adicionar XMLs de Saída (Separados por NFC-e Mod 65 e NF-e Mod 55)
      const vaultSaidaPath = path.join(process.cwd(), 'xml_vault', yearStr, monthStr.padStart(2, '0'), 'SAIDA');
      const nfceEmitidas = emitidas.filter((n: any) => isNfce(n));
      const nfeEmitidas = emitidas.filter((n: any) => isNfe(n));

      const addEmittedXmlToZip = async (nota: any, folderName: string, prefix: string) => {
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

        const fileName = `${prefix}_${nota.numero || nota.referencia}_${nota.chave || 'sem_chave'}.xml`;
        zip.addFile(`${folderName}/${fileName}`, xmlBuffer);
      };

      for (const nota of nfceEmitidas) {
        await addEmittedXmlToZip(nota, 'NFCe_Emitidas', 'NFCe');
      }

      for (const nota of nfeEmitidas) {
        await addEmittedXmlToZip(nota, 'NFe_Emitidas', 'NFe');
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
      const totalSaidasNfce = nfceEmitidas.reduce((a: number, b: any) => a + (b.valorTotal || 0), 0);
      const totalSaidasNfe = nfeEmitidas.reduce((a: number, b: any) => a + (b.valorTotal || 0), 0);
      const totalEntradas = recebidas.reduce((a: number, b: any) => a + (b.valorTotal || 0), 0);
      csvContent += `Total de NFC-e Emitidas (Modelo 65):;${nfceEmitidas.length};R$ ${totalSaidasNfce.toFixed(2).replace('.', ',')}\n`;
      csvContent += `Total de NF-e Emitidas (Modelo 55):;${nfeEmitidas.length};R$ ${totalSaidasNfe.toFixed(2).replace('.', ',')}\n`;
      csvContent += `Total de NF-e Recebidas (Entradas/Compras):;${recebidas.length};R$ ${totalEntradas.toFixed(2).replace('.', ',')}\n\n`;

      csvContent += `--- NOTAS FISCAIS DO CONSUMIDOR (NFC-E - MOD. 65) ---\n`;
      csvContent += `Número;Série;Data/Hora;Chave de Acesso;Status;Valor (R$)\n`;
      for (const n of nfceEmitidas) {
        csvContent += `"${n.numero || ''}";"${n.serie || ''}";"${n.dataEmissao || n.createdAt.toISOString()}";"${n.chave || n.referencia}";"${n.status}";"${(n.valorTotal || 0).toFixed(2).replace('.', ',')}"\n`;
      }
      csvContent += `\n`;

      csvContent += `--- NOTAS FISCAIS ELETRÔNICAS (NF-E - MOD. 55) ---\n`;
      csvContent += `Número;Série;Data/Hora;Chave de Acesso;Status;Valor (R$)\n`;
      for (const n of nfeEmitidas) {
        csvContent += `"${n.numero || ''}";"${n.serie || ''}";"${n.dataEmissao || n.createdAt.toISOString()}";"${n.chave || n.referencia}";"${n.status}";"${(n.valorTotal || 0).toFixed(2).replace('.', ',')}"\n`;
      }
      csvContent += `\n`;

      csvContent += `--- NOTAS FISCAIS DE ENTRADA (COMPRAS / FORNECEDORES) ---\n`;
      csvContent += `Número;Série;Fornecedor;CNPJ Fornecedor;Data Emissão;Status;Valor (R$)\n`;
      for (const n of recebidas) {
        csvContent += `"${n.numero || ''}";"${n.serie || ''}";"${n.emitente || ''}";"${n.cnpjEmitente || ''}";"${n.dataEmissao || n.createdAt.toISOString()}";"${n.status}";"${(n.valorTotal || 0).toFixed(2).replace('.', ',')}"\n`;
      }
      csvContent += `\n`;

      // 4. Posição de Estoque e Lucro Previsto Atual (Inventário e Análise de Lucratividade para Contabilidade)
      const includeStock = req.query.includeStock === 'true';
      if (includeStock) {
        try {
          const allProds = await prisma.product.findMany({
            where: { isActive: true },
            include: { category: true }
          });

          let csvStockCost = 0;
          let csvStockSale = 0;
          const csvCatMap = new Map<string, { name: string; cost: number; sale: number }>();

          for (const p of allProds) {
            const st = Math.max(0, p.stock || 0);
            const cst = (p.costPrice || 0) * st;
            const sl = (p.price || 0) * st;
            csvStockCost += cst;
            csvStockSale += sl;

            const catName = p.category?.name || 'Geral';
            if (!csvCatMap.has(catName)) csvCatMap.set(catName, { name: catName, cost: 0, sale: 0 });
            const item = csvCatMap.get(catName)!;
            item.cost += cst;
            item.sale += sl;
          }

          const csvStockProfit = csvStockSale - csvStockCost;
          const csvStockMargin = csvStockSale > 0 ? ((csvStockProfit / csvStockSale) * 100) : 0;

          csvContent += `--- POSIÇÃO DO ESTOQUE E LUCRO PREVISTO (SPED FISCAL / INVENTÁRIO) ---\n`;
          csvContent += `Valor Total do Estoque a Preço de Custo:;R$ ${csvStockCost.toFixed(2).replace('.', ',')}\n`;
          csvContent += `Valor Total do Estoque a Preço de Venda:;R$ ${csvStockSale.toFixed(2).replace('.', ',')}\n`;
          csvContent += `Lucro Previsto Total do Estoque:;R$ ${csvStockProfit.toFixed(2).replace('.', ',')}\n`;
          csvContent += `Margem Média Prevista do Estoque:;${csvStockMargin.toFixed(1).replace('.', ',')}%\n\n`;

          csvContent += `--- LUCRO PREVISTO POR CATEGORIA DE PRODUTOS ---\n`;
          csvContent += `Categoria;Estoque a Custo (R$);Estoque a Venda (R$);Lucro Previsto (R$);Margem Média (%)\n`;
          for (const cat of csvCatMap.values()) {
            const catProfit = cat.sale - cat.cost;
            const catMargin = cat.sale > 0 ? ((catProfit / cat.sale) * 100) : 0;
            csvContent += `"${cat.name}";"${cat.cost.toFixed(2).replace('.', ',')}";"${cat.sale.toFixed(2).replace('.', ',')}";"${catProfit.toFixed(2).replace('.', ',')}";"${catMargin.toFixed(1).replace('.', ',')}%"\n`;
          }
          csvContent += `\n`;
        } catch (errStock) {
          console.warn('[Export Month] Erro ao calcular estoque no CSV:', errStock);
        }
      } else {
        csvContent += `--- POSIÇÃO DO ESTOQUE E LUCRO PREVISTO (SPED FISCAL / INVENTÁRIO) ---\n`;
        csvContent += `Posição de estoque desabilitada no fechamento deste mês (Aguardando conferência e correção física do inventário).\n\n`;
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

  // ============================================================
  // Backups Oficiais em Nuvem (Focus NFe)
  // ============================================================
  router.get('/focus-backups', async (req, res) => {
    try {
      const settings = await getFiscalSettingsSafe();
      const token = String(settings?.apiToken || '').trim();
      const cnpj = String(settings?.cnpj || '').replace(/\D/g, '');

      if (!token) return res.status(400).json({ error: 'Token da Focus NFe não configurado.' });
      if (!cnpj || cnpj.length !== 14) return res.status(400).json({ error: 'CNPJ da empresa não configurado ou inválido.' });

      const isProducao = settings?.environment === 'producao';
      const baseURL = isProducao ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
      const authHeader = 'Basic ' + Buffer.from(token + ':').toString('base64');

      const focusUrl = `${baseURL}/v2/backups/${cnpj}.json`;
      const focusRes = await fetch(focusUrl, {
        method: 'GET',
        headers: { 'Authorization': authHeader }
      });

      if (!focusRes.ok) {
        if (focusRes.status === 404) {
          return res.json({ ok: true, backups: [], mensagem: 'Nenhum backup em nuvem disponível para este CNPJ ainda.' });
        }
        const errData = await focusRes.json().catch(() => ({}));
        return res.status(focusRes.status).json({ error: errData.mensagem || 'Erro ao consultar backups na Focus NFe.' });
      }

      const data = await focusRes.json();
      res.json({ ok: true, backups: Array.isArray(data) ? data : (data?.backups || []) });
    } catch (err: any) {
      console.error('[FocusNFe Backups Error]', err);
      res.status(500).json({ error: 'Erro ao buscar backups na Focus NFe: ' + err.message });
    }
  });

  // ============================================================
  // Consulta de NCM (Focus NFe)
  // ============================================================
  router.get('/ncm/:code', async (req, res) => {
    try {
      const { code } = req.params;
      const cleanCode = String(code || '').replace(/\D/g, '');
      if (!cleanCode || cleanCode.length < 4) {
        return res.status(400).json({ error: 'Código NCM deve ter pelo menos 4 dígitos.' });
      }

      const settings = await getFiscalSettingsSafe();
      const token = String(settings?.apiToken || '').trim();
      const isProducao = settings?.environment === 'producao';
      const baseURL = isProducao ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';

      if (!token) {
        return res.json({
          ok: true,
          codigo: cleanCode,
          descricao: 'Código NCM salvo localmente (configure o token da Focus para validação oficial)',
          valido: true
        });
      }

      const authHeader = 'Basic ' + Buffer.from(token + ':').toString('base64');
      const focusUrl = `${baseURL}/v2/ncms/${cleanCode}`;

      const focusRes = await fetch(focusUrl, {
        method: 'GET',
        headers: { 'Authorization': authHeader }
      });

      if (!focusRes.ok) {
        if (focusRes.status === 404) {
          return res.status(404).json({ valido: false, error: 'Código NCM não encontrado na Receita Federal / Mercosul.' });
        }
        const errData = await focusRes.json().catch(() => ({}));
        return res.status(focusRes.status).json({ valido: false, error: errData.mensagem || 'Erro ao consultar NCM.' });
      }

      const data = await focusRes.json();
      res.json({
        ok: true,
        valido: true,
        codigo: data.codigo || cleanCode,
        descricao: data.descricao || '',
        dataInicio: data.data_inicio,
        dataFim: data.data_fim,
        aliquotaNacional: data.aliquota_nacional,
        aliquotaEstadual: data.aliquota_estadual,
        aliquotaImportado: data.aliquota_importado
      });
    } catch (err: any) {
      console.error('[FocusNFe NCM Error]', err);
      res.status(500).json({ error: 'Erro ao consultar NCM: ' + err.message });
    }
  });

  // ============================================================
  // Status em Tempo Real da SEFAZ (Focus NFe)
  // ============================================================
  router.get('/sefaz-status', async (req, res) => {
    try {
      const settings = await getFiscalSettingsSafe();
      const uf = String(req.query.uf || settings?.uf || 'PA').trim().toUpperCase() || 'PA';
      const token = String(settings?.apiToken || '').trim();
      const isProducao = settings?.environment === 'producao';
      const baseURL = isProducao ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
      const autorizadorNome = uf === 'PA' ? 'SEFAZ PA (SVRS)' : `SEFAZ ${uf}`;

      let focusDetail = '';

      // 1. Se possuir token da Focus NFe, tenta consulta oficial via Focus NFe com o estado
      if (token) {
        try {
          const authHeader = 'Basic ' + Buffer.from(token + ':').toString('base64');
          const focusUrl = `${baseURL}/v2/nfce/status?uf=${uf}`;

          const focusRes = await fetch(focusUrl, {
            method: 'GET',
            headers: { 'Authorization': authHeader },
            signal: AbortSignal.timeout(6000)
          });

          if (focusRes.ok) {
            const data = await focusRes.json().catch(() => ({}));
            const statusStr = String(data.status || '').toLowerCase();
            const isOnline = statusStr === 'online' || statusStr === 'ativo' || data.codigo_status === '107' || data.status === 'ok';

            return res.json({
              ok: true,
              online: isOnline,
              status: statusStr || (isOnline ? 'online' : 'offline'),
              codigoStatus: data.codigo_status || (isOnline ? '107' : '999'),
              motivoStatus: data.motivo_status || (isOnline ? 'Serviço em Operação' : 'Serviço com Instabilidade'),
              tempoMedio: data.tempo_medio || 0.18,
              uf: uf,
              autorizador: autorizadorNome
            });
          } else if (focusRes.status === 401) {
            focusDetail = `Token Focus NFe não autorizado para ${isProducao ? 'Produção' : 'Homologação'}`;
            console.warn('[FocusNFe Sefaz Status]', focusDetail);
          } else {
            focusDetail = `Focus NFe retornou status HTTP ${focusRes.status}`;
          }
        } catch (focusErr: any) {
          console.warn('[FocusNFe Sefaz Status Warning]', focusErr?.message || focusErr);
        }
      } else {
        focusDetail = 'Token fiscal não configurado neste computador';
      }

      // 2. Ping direto e em tempo real na infraestrutura oficial da SEFAZ para o Pará (SVRS) e fallbacks
      const startPing = Date.now();
      let isOnline = false;
      let latency = 0.18;
      const pingUrls = [
        'https://dfe-portal.svrs.rs.gov.br/Nfe/Disponibilidade',
        'https://app.sefa.pa.gov.br',
        'https://api.focusnfe.com.br'
      ];

      for (const pingUrl of pingUrls) {
        try {
          const pingRes = await fetch(pingUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(6000)
          });
          if (pingRes.status >= 200 && pingRes.status < 500) {
            latency = Number(((Date.now() - startPing) / 1000).toFixed(2));
            isOnline = true;
            break;
          }
        } catch (_) {}
      }

      const motivoStatus = isOnline 
        ? (focusDetail ? `SEFAZ Ativa (${focusDetail})` : 'Serviço em Operação')
        : (focusDetail ? `${focusDetail} e servidores SEFAZ sem resposta` : 'Servidores SEFAZ sem resposta');

      res.json({
        ok: true,
        online: isOnline,
        status: isOnline ? 'online' : 'offline',
        codigoStatus: isOnline ? '107' : '999',
        motivoStatus: motivoStatus,
        tempoMedio: latency,
        uf: uf,
        autorizador: autorizadorNome,
        detalheToken: focusDetail || undefined
      });
    } catch (err: any) {
      console.error('[SEFAZ Status Error]', err);
      res.status(500).json({ error: 'Erro ao consultar status da SEFAZ: ' + err.message, uf: 'PA' });
    }
  });

  // ============================================================
  // Inutilização de Faixa de Numeração (Focus NFe)
  // ============================================================
  router.post('/inutilizar-numeracao', async (req, res) => {
    try {
      const { serie, numeroInicial, numeroFinal, justificativa } = req.body;

      if (!serie || !numeroInicial || !numeroFinal) {
        return res.status(400).json({ error: 'Série, número inicial e número final são obrigatórios.' });
      }

      if (!justificativa || justificativa.trim().length < 15) {
        return res.status(400).json({ error: 'A justificativa de inutilização deve ter no mínimo 15 caracteres (Exigência SEFAZ).' });
      }

      const settings = await getFiscalSettingsSafe();
      const token = String(settings?.apiToken || '').trim();
      const cnpj = String(settings?.cnpj || '').replace(/\D/g, '');

      if (!token) return res.status(400).json({ error: 'Token da API fiscal não configurado.' });
      if (!cnpj) return res.status(400).json({ error: 'CNPJ da empresa não configurado.' });

      const isProducao = settings?.environment === 'producao';
      const baseURL = isProducao ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
      const authHeader = 'Basic ' + Buffer.from(token + ':').toString('base64');

      const focusUrl = `${baseURL}/v2/nfe/inutilizacao`;
      const payload = {
        cnpj,
        serie: String(serie),
        numero_inicial: Number(numeroInicial),
        numero_final: Number(numeroFinal),
        justificativa: justificativa.trim()
      };

      const focusRes = await fetch(focusUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await focusRes.json().catch(() => ({}));

      if (!focusRes.ok) {
        return res.status(focusRes.status).json({
          error: data.mensagem || data.erro || 'Erro ao homologar inutilização na SEFAZ.',
          details: data
        });
      }

      res.json({
        ok: true,
        mensagem: `Inutilização da faixa ${numeroInicial} a ${numeroFinal} (Série ${serie}) homologada com sucesso na SEFAZ!`,
        data
      });
    } catch (err: any) {
      console.error('[FocusNFe Inutilizacao Error]', err);
      res.status(500).json({ error: 'Erro interno ao processar inutilização: ' + err.message });
    }
  });

  // ============================================================
  // Inutilização de Faixa de Numeração — NFC-e
  // ============================================================
  router.post('/inutilizar-numeracao-nfce', async (req, res) => {
    try {
      const { serie, numeroInicial, numeroFinal, justificativa } = req.body;

      if (!serie || !numeroInicial || !numeroFinal) {
        return res.status(400).json({ error: 'Série, número inicial e número final são obrigatórios.' });
      }

      if (!justificativa || justificativa.trim().length < 15) {
        return res.status(400).json({ error: 'A justificativa de inutilização deve ter no mínimo 15 caracteres (Exigência SEFAZ).' });
      }

      const settings = await getFiscalSettingsSafe();
      const token = String(settings?.apiToken || '').trim();
      const cnpj = String(settings?.cnpj || '').replace(/\D/g, '');

      if (!token) return res.status(400).json({ error: 'Token da API fiscal não configurado.' });
      if (!cnpj) return res.status(400).json({ error: 'CNPJ da empresa não configurado.' });

      const isProducao = settings?.environment === 'producao';
      const baseURL = isProducao ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
      const authHeader = 'Basic ' + Buffer.from(token + ':').toString('base64');

      const focusUrl = `${baseURL}/v2/nfce/inutilizacao`;
      const payload = {
        cnpj,
        serie: String(serie),
        numero_inicial: Number(numeroInicial),
        numero_final: Number(numeroFinal),
        justificativa: justificativa.trim()
      };

      const focusRes = await fetch(focusUrl, {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await focusRes.json().catch(() => ({}));

      if (!focusRes.ok) {
        return res.status(focusRes.status).json({
          error: data.mensagem || data.erro || 'Erro ao homologar inutilização de NFC-e na SEFAZ.',
          details: data
        });
      }

      res.json({
        ok: true,
        mensagem: `Inutilização NFC-e da faixa ${numeroInicial} a ${numeroFinal} (Série ${serie}) homologada com sucesso na SEFAZ!`,
        data
      });
    } catch (err: any) {
      console.error('[FocusNFe Inutilizacao NFC-e Error]', err);
      res.status(500).json({ error: 'Erro interno ao processar inutilização de NFC-e: ' + err.message });
    }
  });

  // ============================================================
  // Consulta de Dados de CNPJ (Receita Federal / BrasilAPI)
  // ============================================================
  router.get('/consulta-cnpj/:cnpj', async (req, res) => {
    try {
      const cleanCnpj = req.params.cnpj.replace(/\D/g, '');
      if (cleanCnpj.length !== 14) {
        return res.status(400).json({ error: 'CNPJ deve conter 14 dígitos.' });
      }

      const bRes = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (!bRes.ok) {
        return res.status(bRes.status).json({ error: 'CNPJ não localizado na base pública da Receita Federal.' });
      }

      const data = await bRes.json();
      res.json({
        ok: true,
        cnpj: cleanCnpj,
        razaoSocial: data.razao_social || '',
        nomeFantasia: data.nome_fantasia || '',
        ie: '',
        cep: data.cep || '',
        logradouro: [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(' '),
        numero: data.numero || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        municipio: data.municipio || '',
        uf: data.uf || '',
        telefone: data.ddd_telefone_1 || data.ddd_telefone_2 || '',
        cnae: data.cnae_fiscal || ''
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao consultar CNPJ: ' + err.message });
    }
  });

  return router;
}

