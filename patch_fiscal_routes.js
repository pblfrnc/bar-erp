const fs = require('fs');
let code = fs.readFileSync('server/src/routes/fiscal.ts', 'utf8');

const newRoutes = `
  // Obter configurações fiscais
  router.get('/settings', async (req, res) => {
    try {
      let settings = await prisma.fiscalSettings.findUnique({ where: { id: 'default' } });
      if (!settings) {
        settings = await prisma.fiscalSettings.create({ data: { id: 'default' } });
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
      const settings = await prisma.fiscalSettings.upsert({
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

      const settings = await prisma.fiscalSettings.findUnique({ where: { id: 'default' } });
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
        chaveAcesso: '352401' + settings.cnpj?.replace(/\\D/g, '') + '650010000000011000000010',
        caminhoDanfe: 'https://cdn.focusnfe.com.br/danfe/demo-cupom.pdf'
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erro ao conectar com API Fiscal.' });
    }
  });
`;

code = code.replace("return router;", newRoutes + "\n  return router;");
fs.writeFileSync('server/src/routes/fiscal.ts', code);
