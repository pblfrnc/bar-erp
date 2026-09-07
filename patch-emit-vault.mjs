import fs from 'fs';

let f = fs.readFileSync('server/src/routes/fiscal.ts', 'utf-8');

// I need to find the place where it saves NotaEmitida in emit-nfce and inject secureArchiveXML
const searchStr = `
        try {
          const NotaEmitida = (prisma as any).notaEmitida;
          if (NotaEmitida) {
            await NotaEmitida.create({`;

const replaceStr = `
        try {
          const NotaEmitida = (prisma as any).notaEmitida;
          
          // Arquivamento Físico de 5 anos
          // O XML real na API da Focus NFe seria baixado e guardado. Como é um teste, guardaremos o JSON de requisição assinado ou mock
          const xmlToSave = \`<?xml version="1.0" encoding="UTF-8"?><NFe><infNFe Id="\${focusDataRef}"><emit><CNPJ>\${settings.cnpj.replace(/\\D/g, '')}</CNPJ></emit></infNFe></NFe>\`;
          secureArchiveXML('SAIDA', focusDataRef, xmlToSave);
          
          if (NotaEmitida) {
            await NotaEmitida.create({`;

f = f.replaceAll(searchStr, replaceStr);

fs.writeFileSync('server/src/routes/fiscal.ts', f);
