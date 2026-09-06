const fs = require('fs');
let code = fs.readFileSync('server/src/routes/fiscal.ts', 'utf8');

const newLogic = `
      // Mapeamento para requisição na Focus NFe
      const baseURL = settings.environment === 'producao' 
        ? 'https://api.focusnfe.com.br/v2/nfce'
        : 'https://homologacao.focusnfe.com.br/v2/nfce';

      const focusPayload = {
        natureza_operacao: 'VENDA DE MERCADORIA',
        presenca_comprador: '1',
        cpf_cnpj_destinatario: customerCpf ? customerCpf.replace(/\\D/g, '') : undefined,
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
`;

const oldMockCode = `
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
        chaveAcesso: '352401' + settings.cnpj?.replace(/\\D/g, '') + '650010000000011000000010',
        caminhoDanfe: 'https://cdn.focusnfe.com.br/danfe/demo-cupom.pdf'
      });
`;

code = code.replace(oldMockCode, newLogic);
fs.writeFileSync('server/src/routes/fiscal.ts', code);
