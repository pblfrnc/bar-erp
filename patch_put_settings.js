const fs = require('fs');
let code = fs.readFileSync('server/src/routes/fiscal.ts', 'utf8');

const newPutSettings = `
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
          nome: "Empresa Cadastrada via ERP",
          nome_fantasia: "Nome Fantasia (Puxar via CNPJ em prod)",
          cnpj: data.cnpj.replace(/\\D/g, ''),
          inscricao_estadual: data.ie,
          regime_tributario: data.crt || '1',
          logradouro: data.logradouro,
          numero: data.numero || 'S/N',
          bairro: data.bairro,
          cep: data.cep.replace(/\\D/g, ''),
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
`;

code = code.replace(
  /\/\/ Salvar configurações fiscais[\s\S]*?\/\/ Emitir NFC-e \(Mock \/ Homologação Inicial\)/,
  newPutSettings + '\n\n  // Emitir NFC-e (Mock / Homologação Inicial)'
);

// We need to update `fetch(baseURL + '?dry_run=0'` to include `cnpj_emitente`
const oldEmitFetch = "const focusRes = await fetch(baseURL + '?dry_run=0', {";
const newEmitFetch = "const focusRes = await fetch(baseURL + '?cnpj_emitente=' + settings.cnpj.replace(/\\D/g, '') + '&dry_run=0', {";
code = code.replace(oldEmitFetch, newEmitFetch);

// Check if there are multiple occurrences (the polling part)
const oldCheckFetch = "const checkRes = await fetch(baseURL + '/' + data.ref, {";
const newCheckFetch = "const checkRes = await fetch(baseURL + '/' + data.ref + '?cnpj_emitente=' + settings.cnpj.replace(/\\D/g, ''), {";
code = code.replace(oldCheckFetch, newCheckFetch);

fs.writeFileSync('server/src/routes/fiscal.ts', code);
