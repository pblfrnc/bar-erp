import fs from 'fs';
let f = fs.readFileSync('server/src/routes/fiscal.ts', 'utf-8');

const reprintRoute = `
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

      const focusRes = await fetch(baseURL + ref + '?cnpj_emitente=' + settings.cnpj.replace(/\\D/g, ''), {
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
         return res.status(400).json({ error: \`Nota não está autorizada (Status: \${data.status}).\` });
      }
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao consultar a Sefaz para reimpressão.' });
    }
  });
`;

if (!f.includes('/reprint/:ref')) {
  f = f.replace("export const fiscalRouter = router;", reprintRoute + "\nexport const fiscalRouter = router;");
  
  // For the case where I patched it to return router directly in the factory function earlier
  if (f.includes('return router;\n}')) {
     f = f.replace("return router;\n}", reprintRoute + "\n  return router;\n}");
  }
}

fs.writeFileSync('server/src/routes/fiscal.ts', f);
