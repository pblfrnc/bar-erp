import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch'; // We might need global fetch or node-fetch

const prisma = new PrismaClient();

async function runTest() {
  console.log("1. Verificando Configurações Fiscais...");
  const settings = await prisma.fiscalSettings.findUnique({ where: { id: 'default' } });
  
  if (!settings) {
    console.log("❌ Configurações Fiscais não encontradas no banco.");
    // Criar uma config fake para teste
    await prisma.fiscalSettings.create({
      data: {
        id: 'default',
        environment: 'homologacao',
        cnpj: '00000000000191',
        apiToken: 'fake_token_for_test',
        crt: '1'
      }
    });
    console.log("✅ Configuração fake inserida para teste.");
  } else {
    console.log("✅ Configurações encontradas:", settings.cnpj, settings.environment);
  }

  console.log("\\n2. Iniciando servidor (ou simulando a lógica da rota)...");
  // Como o servidor pode não estar rodando, vamos testar a lógica exata da montagem do payload
  // que é onde a maioria dos erros fiscais acontece.
  
  const mockItems = [
    { productId: 'p1', name: 'Cerveja Heineken 600ml', quantity: 2, price: 15.00, cfop: '5405', ncm: '22030000' },
    { productId: 'p2', name: 'Batata Frita', quantity: 1, price: 25.00, cfop: '5102', ncm: '20041000' }
  ];
  const customerCpf = '123.456.789-00';
  
  const crt = settings?.crt || '1';
  
  const focusPayload = {
    natureza_operacao: 'VENDA DE MERCADORIA',
    presenca_comprador: '1',
    cpf_cnpj_destinatario: customerCpf ? customerCpf.replace(/\\D/g, '') : undefined,
    itens: mockItems.map((i, index) => ({
      numero_item: String(index + 1),
      codigo_produto: i.productId,
      descricao: i.name,
      cfop: i.cfop || '5102',
      ncm: i.ncm || '21069090', 
      unidade_comercial: 'UN',
      quantidade_comercial: String(i.quantity),
      valor_unitario_comercial: String(i.price),
      valor_bruto: String((i.quantity * i.price).toFixed(2)),
      icms_situacao_tributaria: (crt === '3') 
        ? (i.cfop === '5405' ? '60' : '00')  
        : (i.cfop === '5405' ? '500' : '102'), 
      icms_origem: '0',
      pis_situacao_tributaria: '08', 
      cofins_situacao_tributaria: '08'
    })),
    formas_pagamento: [
      {
        forma_pagamento: '01', 
        valor_pagamento: String(mockItems.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2))
      }
    ]
  };

  console.log("\\n3. Payload gerado para a Focus NFe:");
  console.log(JSON.stringify(focusPayload, null, 2));
  
  console.log("\\n4. O que falta validar?");
  console.log("- A forma de pagamento está sempre '01' (Dinheiro). Num PDV real, precisamos receber o tipo (PIX=17, Cartão=03/04).");
  console.log("- Não estamos calculando vTroco (se a pessoa deu R$ 100 para uma conta de 80, a Sefaz exige discriminar o troco).");
  
  process.exit(0);
}

runTest().catch(console.error);
