import { prisma } from '../prisma.js';

/**
 * Build payload for NF‑e emission using Focus NFe API.
 * Mirrors the NFC‑e payload but omits CSC related fields (not required for NF‑e).
 * @param params Object containing required data.
 */
export async function buildNfePayload(params: {
  items: any[];
  customerDoc?: string; // CPF or CNPJ of the recipient
  orderId?: string | number;
  settings: any;
  paymentMethod?: string;
  customerName?: string;
  customerCep?: string;
  customerLogradouro?: string;
  customerNumero?: string;
  customerComplemento?: string;
  customerBairro?: string;
  customerMunicipio?: string;
  customerUf?: string;
}) {
  const { items, customerDoc, orderId, settings, paymentMethod } = params;

  // Generate a unique reference identifier (required by Focus)
  const ts = Date.now();
  const rnd = Math.floor(Math.random() * 9000) + 1000;
  const ref = orderId
    ? `nfe_${String(orderId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20)}_${rnd}`
    : `nfe_${ts}_${rnd}`;

  // Date in ISO‑8601 with São Paulo timezone (‑03:00)
  const dataEmissao = (() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    try {
      const spDateStr = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
      const spDate = new Date(spDateStr);
      const yyyy = spDate.getFullYear();
      const mm = pad(spDate.getMonth() + 1);
      const dd = pad(spDate.getDate());
      const hh = pad(spDate.getHours());
      const mi = pad(spDate.getMinutes());
      const ss = pad(spDate.getSeconds());
      return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}-03:00`;
    } catch {
      // Fallback using UTC adjusted to -03:00
      const yyyy = now.getUTCFullYear();
      const mm = pad(now.getUTCMonth() + 1);
      const dd = pad(now.getUTCDate());
      const hh = pad((now.getUTCHours() - 3 + 24) % 24);
      const mi = pad(now.getUTCMinutes());
      const ss = pad(now.getUTCSeconds());
      return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}-03:00`;
    }
  })();

  const cleanCnpj = (settings.cnpj || '').replace(/\D/g, '');

  const totalItemsValue = items.reduce((acc, i) => acc + (Number(i.price || 0) * Number(i.quantity || 1)), 0);

  const payload: any = {
    cnpj_emitente: cleanCnpj,
    data_emissao: dataEmissao,
    natureza_operacao: 'VENDA AO CONSUMIDOR',
    tipo_documento: '55', // NF‑e (55) – foco na nota fiscal eletrônica padrão
    finalidade_emissao: '1', // Normal
    consumidor_final: '1', // Consumidor final
    presenca_comprador: '1', // Presencial
    modalidade_frete: '9', // Sem transporte
    local_destino: '1', // Operação interna
    serie: String(settings.serieNfe || '1'),
    referencia: ref,
    itens: items.map((i, idx) => {
      const rawNcm = i.ncm ? String(i.ncm).replace(/\D/g, '') : '';
      const cleanNcm = rawNcm.length >= 8 ? rawNcm.slice(0, 8) : rawNcm.padEnd(8, '0');
      const cleanCfop = i.cfop ? String(i.cfop).replace(/\D/g, '') : '5102';
      const qty = Number(i.quantity) || 1;
      const price = Number(i.price) || 0;
      const eanClean = String(i.ean || '').replace(/\D/g, '');
      const eanValido = eanClean.length >= 8 ? eanClean : '';
      const codigoInterno = String(i.code || '').trim();
      const codigoProduto = (eanValido || codigoInterno || String(idx + 1)).slice(0, 60);
      return {
        numero_item: String(idx + 1),
        codigo_produto: codigoProduto,
        ...(eanValido ? { codigo_barras: eanValido } : {}),
        descricao: String(i.name || 'Produto').trim().slice(0, 120),
        cfop: cleanCfop,
        codigo_ncm: cleanNcm,
        ncm: cleanNcm,
        unidade_comercial: (i.unit || 'UN').toUpperCase().slice(0, 6),
        quantidade_comercial: qty.toFixed(4),
        valor_unitario_comercial: price.toFixed(2),
        valor_bruto: (qty * price).toFixed(2),
        unidade_tributavel: (i.unit || 'UN').toUpperCase().slice(0, 6),
        quantidade_tributavel: qty.toFixed(4),
        valor_unitario_tributavel: price.toFixed(2),
        inclui_no_total: '1',
        icms_origem: '0',
        icms_situacao_tributaria: (settings.crt === '3')
          ? (cleanCfop === '5405' ? '60' : '00')
          : (cleanCfop === '5405' ? '500' : '102'),
        pis_situacao_tributaria: '07',
        cofins_situacao_tributaria: '07',
        ...(i.cest ? { codigo_cest: String(i.cest).replace(/\D/g, '') } : {})
      } as any;
    }),
    formas_pagamento: [
      {
        forma_pagamento: (() => {
          const pm = ((params as any).paymentMethod || '').toUpperCase();
          if (pm === 'PIX') return '17';
          if (pm === 'CREDITO' || pm === 'CARD' || pm === 'CARTÃO DE CRÉDITO') return '03';
          if (pm === 'DEBITO' || pm === 'CARTÃO DE DÉBITO') return '04';
          if (pm === 'DINHEIRO' || pm === 'MONEY' || pm === 'CASH') return '01';
          return '01';
        })(),
        valor_pagamento: totalItemsValue.toFixed(2)
      }
    ]
  };

  if (customerDoc) {
    const cleanDoc = String(customerDoc).replace(/\D/g, '');
    if (cleanDoc.length === 11) {
      payload.cpf_destinatario = cleanDoc;
    } else if (cleanDoc.length === 14) {
      payload.cnpj_destinatario = cleanDoc;
    }
  }

  // Identificação e Endereço do Destinatário (Exigência estrita da SEFAZ e Focus NFe no Modelo 55)
  if (params.customerName && String(params.customerName).trim()) {
    payload.nome_destinatario = String(params.customerName).trim().slice(0, 60);
  }

  // Endereço do destinatário com fallback seguro nos dados da empresa emissora para evitar erro 422
  const logradouro = (params.customerLogradouro || '').trim() || (settings.logradouro || '').trim() || 'Rua Principal';
  const numero = (params.customerNumero || '').trim() || (settings.numero || '').trim() || 'S/N';
  const bairro = (params.customerBairro || '').trim() || (settings.bairro || '').trim() || 'Centro';
  const municipio = (params.customerMunicipio || '').trim() || (settings.municipio || '').trim() || 'São Paulo';
  const uf = (params.customerUf || '').trim() || (settings.uf || '').trim() || 'SP';
  const cepRaw = (params.customerCep || '').replace(/\D/g, '') || (settings.cep || '').replace(/\D/g, '') || '01001000';

  payload.logradouro_destinatario = logradouro.slice(0, 60);
  payload.numero_destinatario = numero.slice(0, 60);
  payload.bairro_destinatario = bairro.slice(0, 60);
  payload.municipio_destinatario = municipio.slice(0, 60);
  payload.uf_destinatario = uf.toUpperCase().slice(0, 2);
  payload.cep_destinatario = cepRaw.slice(0, 8);
  payload.indicador_inscricao_estadual_destinatario = '9'; // Não Contribuinte

  if (params.customerComplemento && String(params.customerComplemento).trim()) {
    payload.complemento_destinatario = String(params.customerComplemento).trim().slice(0, 60);
  }

  return { payload, ref };
}

/**
 * Persists an emitted NF‑e record.
 */
export async function persistNfeRecord(data: {
  referencia: string;
  chave?: string;
  numero?: string;
  serie?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  valorTotal?: number;
}) {
  const { referencia, chave, numero, serie, pdfUrl, xmlUrl, valorTotal } = data;
  const id = `nfe_${referencia}`;
  await prisma.$executeRawUnsafe(`
    INSERT OR REPLACE INTO "NotaEmitida" (
      "id", "referencia", "chave", "numero", "serie", "dataEmissao", "valorTotal", "status", "xmlUrl", "pdfUrl", "createdAt"
    ) VALUES (
      ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, 'autorizado', ?, ?, CURRENT_TIMESTAMP
    )
  `, [id, referencia, chave ?? null, numero ?? null, serie ?? null, valorTotal ?? 0, xmlUrl ?? null, pdfUrl ?? null]);
}
