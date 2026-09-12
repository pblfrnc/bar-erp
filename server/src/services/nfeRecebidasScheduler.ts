import { prisma } from '../prisma.js';
import { XMLParser } from 'fast-xml-parser';
import fs from 'fs';
import path from 'path';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function secureArchiveXML(type: 'ENTRADA' | 'SAIDA', chave: string, xmlContent: string) {
  try {
    const date = new Date();
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const vaultPath = path.join(process.cwd(), 'xml_vault', year, month, type);
    if (!fs.existsSync(vaultPath)) {
      fs.mkdirSync(vaultPath, { recursive: true });
    }
    const filePath = path.join(vaultPath, `${chave}.xml`);
    fs.writeFileSync(filePath, xmlContent, 'utf-8');
  } catch (err) {
    console.error('[NfeRecebidasScheduler] Erro ao arquivar XML no cofre:', err);
  }
}

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

async function fetchNfeRecebidaXmlDirect(baseURL: string, authHeader: string, chaveClean: string): Promise<{ xmlText: string; xmlData?: any } | null> {
  // 1. .xml direto
  try {
    const resXml = await fetch(`${baseURL}/v2/nfes_recebidas/${chaveClean}.xml`, {
      headers: { 'Authorization': authHeader, 'Accept': 'application/xml, text/xml, */*' },
      redirect: 'follow'
    });
    if (resXml.ok) {
      const text = await resXml.text();
      if (text && (text.includes('<nfeProc') || text.includes('<NFe') || text.startsWith('<?xml'))) {
        return { xmlText: text };
      }
    }
  } catch (_) {}

  // 2. .json
  try {
    const resJson = await fetch(`${baseURL}/v2/nfes_recebidas/${chaveClean}.json`, {
      headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
    });
    if (resJson.ok) {
      const json = await resJson.json();
      if (json.caminho_xml_nota_fiscal) {
        const downloadUrl = json.caminho_xml_nota_fiscal.startsWith('http')
          ? json.caminho_xml_nota_fiscal
          : `${baseURL}${json.caminho_xml_nota_fiscal}`;
        const fileRes = await fetch(downloadUrl, {
          headers: downloadUrl.includes('focusnfe.com.br') ? { 'Authorization': authHeader } : {},
          redirect: 'follow'
        });
        if (fileRes.ok) {
          const text = await fileRes.text();
          if (text && (text.includes('<nfeProc') || text.includes('<NFe') || text.startsWith('<?xml'))) {
            return { xmlText: text, xmlData: json };
          }
        }
      }
      return { xmlText: '', xmlData: json };
    }
  } catch (_) {}

  return null;
}

export async function runNfeRecebidasSync(): Promise<{ added: number; updatedWithXml: number }> {
  let added = 0;
  let updatedWithXml = 0;

  try {
    // 1. Obter configurações fiscais
    const rows: any[] = await prisma.$queryRawUnsafe('SELECT * FROM "FiscalSettings" WHERE id = "default" LIMIT 1;').catch(() => []);
    const settings = rows?.[0];
    if (!settings || !settings.apiToken) {
      return { added: 0, updatedWithXml: 0 };
    }

    const isProducao = settings.environment === 'producao';
    const baseURL = isProducao ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
    const authHeader = 'Basic ' + Buffer.from(settings.apiToken + ':').toString('base64');
    const cleanCnpj = (settings.cnpj || '').replace(/\D/g, '');

    // 2. Garantir existência da tabela
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

    // 3. Consultar notas recebidas na Focus NFe
    const queryParams = cleanCnpj ? `?cnpj_destinatario=${cleanCnpj}` : '';
    const focusRes = await fetch(`${baseURL}/v2/nfes_recebidas${queryParams}`, {
      headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
    });

    if (!focusRes.ok) {
      return { added: 0, updatedWithXml: 0 };
    }

    const notasFocus = await focusRes.json().catch(() => null);
    if (!Array.isArray(notasFocus)) {
      return { added: 0, updatedWithXml: 0 };
    }

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

      // Verifica se a nota já existe no banco
      const existing: any[] = await prisma.$queryRawUnsafe(
        'SELECT "id", "status", "xmlContent", "valorTotal" FROM "NotaRecebida" WHERE "chave" = ? LIMIT 1',
        chaveClean
      ).catch(() => []);

      if (!existing || existing.length === 0) {
        // Tenta buscar o XML completo imediatamente
        let initialXml: string | null = null;
        let initialValor = valorTotal;
        let initialEmitente = emitente;
        let initialCnpj = cnpjEmitente;
        let initialNumero = numero;
        let initialSerie = serie;
        let initialDataEmissao = dataEmissao;

        const xmlResult = await fetchNfeRecebidaXmlDirect(baseURL, authHeader, chaveClean);
        if (xmlResult?.xmlText) {
          initialXml = xmlResult.xmlText;
          try {
            const jsonObj = parser.parse(xmlResult.xmlText);
            const nfe = jsonObj.nfeProc?.NFe?.infNFe || jsonObj.NFe?.infNFe;
            if (nfe) {
              if (nfe.emit?.xNome) initialEmitente = nfe.emit.xNome;
              if (nfe.emit?.CNPJ || nfe.emit?.CPF) initialCnpj = (nfe.emit.CNPJ || nfe.emit.CPF).replace(/\D/g, '');
              if (nfe.ide?.nNF) initialNumero = String(nfe.ide.nNF);
              if (nfe.ide?.serie) initialSerie = String(nfe.ide.serie);
              if (nfe.ide?.dhEmi) initialDataEmissao = String(nfe.ide.dhEmi);
              if (nfe.total?.ICMSTot?.vNF) initialValor = parseFloat(nfe.total.ICMSTot.vNF);
            }
          } catch (_) {}

          try { secureArchiveXML('ENTRADA', chaveClean, xmlResult.xmlText); } catch (_) {}
          updatedWithXml++;
        }

        // Nova nota encontrada na SEFAZ: status inicial é 'pendente' aguardando o 1º Bip
        await prisma.$executeRawUnsafe(`
          INSERT INTO "NotaRecebida"
            ("id", "chave", "emitente", "cnpjEmitente", "numero", "serie", "dataEmissao", "valorTotal", "status", "xmlContent", "createdAt")
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          chaveClean,
          chaveClean,
          initialEmitente,
          initialCnpj,
          initialNumero,
          initialSerie,
          initialDataEmissao,
          initialValor,
          'pendente',
          initialXml,
          new Date().toISOString()
        );
        added++;

        // Manifesta ciência automaticamente se ainda não tiver manifesto
        if (!item.manifesto) {
          fetch(`${baseURL}/v2/nfes_recebidas/${chaveClean}/manifesto`, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': authHeader },
            body: JSON.stringify({ tipo: 'ciencia' })
          }).catch(() => {});
        }
      } else {
        // Se a nota já estava cadastrada mas ainda sem XML completo
        const cur = existing[0];
        const hasFullXml = cur.xmlContent && (cur.xmlContent.includes('<nfeProc') || cur.xmlContent.includes('<NFe'));
        
        if (!hasFullXml) {
          // Tenta baixar o XML agora que a SEFAZ pode ter liberado
          const result = await fetchNfeRecebidaXmlDirect(baseURL, authHeader, chaveClean);
          if (result?.xmlText) {
            let parsedValor = valorTotal;
            let parsedEmitente = emitente;
            let parsedCnpj = cnpjEmitente;
            let parsedNumero = numero;
            let parsedSerie = serie;
            try {
              const jsonObj = parser.parse(result.xmlText);
              const nfe = jsonObj.nfeProc?.NFe?.infNFe || jsonObj.NFe?.infNFe;
              if (nfe) {
                if (nfe.emit?.xNome) parsedEmitente = nfe.emit.xNome;
                if (nfe.emit?.CNPJ || nfe.emit?.CPF) parsedCnpj = (nfe.emit.CNPJ || nfe.emit.CPF).replace(/\D/g, '');
                if (nfe.ide?.nNF) parsedNumero = String(nfe.ide.nNF);
                if (nfe.ide?.serie) parsedSerie = String(nfe.ide.serie);
                if (nfe.total?.ICMSTot?.vNF) parsedValor = parseFloat(nfe.total.ICMSTot.vNF);
              }
            } catch (_) {}

            // Preserva o status atual da nota (se 'pendente', continua 'pendente'; se 'recebida' ou 'finalizada', preserva)
            const currentStatus = cur.status || 'pendente';

            await prisma.$executeRawUnsafe(`
              UPDATE "NotaRecebida"
              SET "xmlContent" = ?,
                  "status" = ?,
                  "emitente" = COALESCE(NULLIF(?, ''), "emitente"),
                  "cnpjEmitente" = COALESCE(NULLIF(?, ''), "cnpjEmitente"),
                  "numero" = COALESCE(NULLIF(?, ''), "numero"),
                  "serie" = COALESCE(NULLIF(?, ''), "serie"),
                  "valorTotal" = CASE WHEN ? > 0 THEN ? ELSE "valorTotal" END
              WHERE "chave" = ?
            `, result.xmlText, currentStatus, parsedEmitente, parsedCnpj, parsedNumero, parsedSerie, parsedValor, parsedValor, chaveClean);

            try { secureArchiveXML('ENTRADA', chaveClean, result.xmlText); } catch (_) {}
            updatedWithXml++;
          }
        }
      }
    }

    if (added > 0 || updatedWithXml > 0) {
      console.log(`[NfeRecebidasScheduler] Sincronização SEFAZ concluída: +${added} novas notas, ${updatedWithXml} XMLs baixados.`);
    }

  } catch (err: any) {
    console.warn('[NfeRecebidasScheduler] Aviso no ciclo de sincronização:', err?.message);
  }

  return { added, updatedWithXml };
}

let syncTimer: NodeJS.Timeout | null = null;

export function setupNfeAutoSyncScheduler(intervalMinutes = 15) {
  if (syncTimer) {
    clearInterval(syncTimer);
  }

  // Executa uma primeira vez após 10 segundos do boot do servidor
  setTimeout(() => {
    runNfeRecebidasSync().catch(() => {});
  }, 10000);

  // Intervalo periódico contínuo (padrão a cada 15 minutos)
  const intervalMs = intervalMinutes * 60 * 1000;
  syncTimer = setInterval(() => {
    runNfeRecebidasSync().catch(() => {});
  }, intervalMs);

  console.log(`⏱️ [NfeRecebidasScheduler] Temporizador de captura automática de NF-e da SEFAZ ativo (a cada ${intervalMinutes} min).`);
}
