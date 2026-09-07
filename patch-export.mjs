import fs from 'fs';
let f = fs.readFileSync('server/src/routes/fiscal.ts', 'utf-8');

const exportRoute = `
  // ============================================================
  // Exportar XMLs do Mês (Painel do Contador)
  // ============================================================
  router.get('/export-month', async (req, res) => {
    try {
      const { month } = req.query; // Formato YYYY-MM
      if (!month || typeof month !== 'string' || !/^\\d{4}-\\d{2}$/.test(month)) {
         return res.status(400).json({ error: 'Mês inválido. Formato esperado: YYYY-MM' });
      }

      const [year, m] = month.split('-');
      
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip();
      
      // Buscar Notas Recebidas (Compras)
      let notasRecebidas = [];
      try {
         notasRecebidas = await (prisma as any).notaRecebida.findMany();
      } catch (e) {}

      // Buscar Notas Emitidas (Vendas NFC-e)
      let notasEmitidas = [];
      try {
         notasEmitidas = await (prisma as any).notaEmitida.findMany();
      } catch (e) {}

      // Filtrar por mês e ano
      const filterByMonth = (dateStr: string) => {
         if (!dateStr) return false;
         return dateStr.startsWith(month);
      };

      const recebidasNoMes = notasRecebidas.filter((n: any) => n.dataEmissao && filterByMonth(n.dataEmissao));
      const emitidasNoMes = notasEmitidas.filter((n: any) => n.dataEmissao && filterByMonth(n.dataEmissao));

      let hasFiles = false;

      // Adicionar XMLs de Compras (Recebidas)
      for (const nr of recebidasNoMes) {
         if (nr.xmlContent) {
           try {
             const parsed = JSON.parse(nr.xmlContent);
             if (parsed.url) {
               const xmlRes = await fetch(parsed.url);
               if (xmlRes.ok) {
                 const xmlBuffer = await xmlRes.arrayBuffer();
                 zip.addFile(\`COMPRAS_NF-e/\${nr.chave}-procNFe.xml\`, Buffer.from(xmlBuffer));
                 hasFiles = true;
               }
             }
           } catch (e) {
             console.error("Erro ao baixar XML recebida:", nr.chave);
           }
         }
      }

      // Adicionar XMLs de Vendas (Emitidas)
      const settings = await (prisma as any).FiscalSettings.findUnique({ where: { id: 'default' } });
      const authHeader = settings?.apiToken ? 'Basic ' + Buffer.from(settings.apiToken + ':').toString('base64') : null;

      for (const ne of emitidasNoMes) {
         if (ne.xmlUrl && authHeader) {
           try {
             // A Focus NFe precisa de autenticação para baixar o XML da NFC-e emitida?
             // A documentação diz que a URL do XML pode exigir autenticação básica.
             const xmlRes = await fetch(ne.xmlUrl, {
               headers: { 'Authorization': authHeader }
             });
             if (xmlRes.ok) {
               const xmlBuffer = await xmlRes.arrayBuffer();
               zip.addFile(\`VENDAS_NFC-e/\${ne.chave || ne.referencia}-procNFCe.xml\`, Buffer.from(xmlBuffer));
               hasFiles = true;
             }
           } catch (e) {
             console.error("Erro ao baixar XML emitida:", ne.referencia);
           }
         }
      }

      if (!hasFiles) {
         return res.status(404).json({ error: 'Nenhum XML encontrado para este mês.' });
      }

      // Gerar relatório CSV
      let csv = 'TIPO;CHAVE/REF;DATA;VALOR;STATUS\\n';
      recebidasNoMes.forEach((n: any) => {
         csv += \`COMPRA;\${n.chave};\${n.dataEmissao};\${n.valorTotal};\${n.status}\\n\`;
      });
      emitidasNoMes.forEach((n: any) => {
         csv += \`VENDA;\${n.chave || n.referencia};\${n.dataEmissao};\${n.valorTotal};\${n.status}\\n\`;
      });
      
      zip.addFile('Relatorio_Mensal.csv', Buffer.from(csv, 'utf8'));

      const zipBuffer = zip.toBuffer();
      
      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', \`attachment; filename=Fechamento_Contabil_\${month}.zip\`);
      res.send(zipBuffer);

    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao gerar fechamento contábil.' });
    }
  });
`;

if (!f.includes('/export-month')) {
   f = f.replace("export const fiscalRouter = router;", exportRoute + "\nexport const fiscalRouter = router;");
   fs.writeFileSync('server/src/routes/fiscal.ts', f);
}
