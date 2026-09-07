import fs from 'fs';
let f = fs.readFileSync('server/src/routes/fiscal.ts', 'utf-8');

const saveNota = `
        // Salva Nota Emitida no DB
        try {
          const NotaEmitida = (prisma as any).notaEmitida;
          if (NotaEmitida) {
            await NotaEmitida.create({
              data: {
                referencia: focusDataRef,
                chave: focusDataChave,
                numero: focusDataNumero,
                serie: focusDataSerie,
                dataEmissao: new Date().toISOString(),
                valorTotal: focusDataValor,
                status: focusDataStatus,
                xmlUrl: baseURL + '/' + focusDataRef + '.xml',
                pdfUrl: baseURL + '/' + focusDataRef + '/danfe.pdf'
              }
            });
          }
        } catch (e) {
          console.error("Erro ao salvar NotaEmitida", e);
        }
`;

f = f.replace(`      if (data.status === 'autorizado') {
        return res.json({`, `
      const focusDataRef = data.ref;
      const focusDataChave = data.chave_nfe;
      const focusDataNumero = data.numero;
      const focusDataSerie = data.serie;
      const focusDataValor = items.reduce((acc: number, i: any) => acc + (i.price * i.quantity), 0);
      const focusDataStatus = data.status;

      if (data.status === 'autorizado') {
        ${saveNota.replace(/focusDataRef/g, 'data.ref').replace(/focusDataChave/g, 'data.chave_nfe').replace(/focusDataNumero/g, 'data.numero').replace(/focusDataSerie/g, 'data.serie').replace(/focusDataValor/g, 'items.reduce((acc: number, i: any) => acc + (i.price * i.quantity), 0)').replace(/focusDataStatus/g, 'data.status')}
        return res.json({`);

f = f.replace(`        if (checkData.status === 'autorizado') {
          return res.json({`, `
        if (checkData.status === 'autorizado') {
          ${saveNota.replace(/focusDataRef/g, 'checkData.ref').replace(/focusDataChave/g, 'checkData.chave_nfe').replace(/focusDataNumero/g, 'checkData.numero').replace(/focusDataSerie/g, 'checkData.serie').replace(/focusDataValor/g, 'items.reduce((acc: number, i: any) => acc + (i.price * i.quantity), 0)').replace(/focusDataStatus/g, 'checkData.status')}
          return res.json({`);

fs.writeFileSync('server/src/routes/fiscal.ts', f);
