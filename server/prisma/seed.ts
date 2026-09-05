import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Populando dados iniciais do Bar ERP...');

  // Limpar tabelas existentes
  await prisma.cashTransaction.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.cashShift.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.table.deleteMany();

  // 1. Criar Categorias
  const catChopes = await prisma.category.create({
    data: { name: 'Chopes & Cervejas', icon: 'Beer', sortOrder: 1 }
  });
  const catDrinks = await prisma.category.create({
    data: { name: 'Drinks & Coquetéis', icon: 'Wine', sortOrder: 2 }
  });
  const catDoses = await prisma.category.create({
    data: { name: 'Doses & Destilados', icon: 'Flame', sortOrder: 3 }
  });
  const catPorcoes = await prisma.category.create({
    data: { name: 'Petiscos & Porções', icon: 'UtensilsCrossed', sortOrder: 4 }
  });
  const catBurgers = await prisma.category.create({
    data: { name: 'Burgers da Casa', icon: 'Beef', sortOrder: 5 }
  });
  const catBebidas = await prisma.category.create({
    data: { name: 'Não Alcoólicos', icon: 'GlassWater', sortOrder: 6 }
  });

  // 2. Criar Produtos
  const pChopePilsen = await prisma.product.create({
    data: {
      name: 'Chope Pilsen 500ml',
      description: 'Chope artesanal leve, refrescante e cremoso',
      price: 14.0,
      costPrice: 4.5,
      categoryId: catChopes.id,
      kdsStation: 'BAR',
      stock: 120,
      minStock: 20
    }
  });

  const pChopeIPA = await prisma.product.create({
    data: {
      name: 'Chope IPA Artesanal 500ml',
      description: 'Cerveja aromática com lúpulos cítricos e amargor marcante',
      price: 22.0,
      costPrice: 8.0,
      categoryId: catChopes.id,
      kdsStation: 'BAR',
      stock: 80,
      minStock: 15
    }
  });

  const pHeineken = await prisma.product.create({
    data: {
      name: 'Heineken Long Neck 330ml',
      description: 'Lager puro malte ultra gelada',
      price: 16.0,
      costPrice: 7.0,
      categoryId: catChopes.id,
      kdsStation: 'BAR',
      stock: 96,
      minStock: 24
    }
  });

  const pCorona = await prisma.product.create({
    data: {
      name: 'Corona Extra c/ Limão 330ml',
      description: 'Acompanha rodela de limão no gargalo',
      price: 18.0,
      costPrice: 8.5,
      categoryId: catChopes.id,
      kdsStation: 'BAR',
      stock: 48,
      minStock: 12
    }
  });

  const pCaipirinha = await prisma.product.create({
    data: {
      name: 'Caipirinha de Limão Tradicional',
      description: 'Cachaça artesanal envelhecida, limão tahiti e açúcar',
      price: 24.0,
      costPrice: 6.0,
      categoryId: catDrinks.id,
      kdsStation: 'BAR',
      stock: 200,
      minStock: 30
    }
  });

  const pGinTonica = await prisma.product.create({
    data: {
      name: 'Gin Tônica Clássica',
      description: 'Gin premium, água tônica botânica, zimbro e fatia de limão siciliano',
      price: 32.0,
      costPrice: 10.0,
      categoryId: catDrinks.id,
      kdsStation: 'BAR',
      stock: 90,
      minStock: 20
    }
  });

  const pMoscowMule = await prisma.product.create({
    data: {
      name: 'Moscow Mule na Caneca',
      description: 'Vodka, xarope de gengibre artesanal, suco de limão e espuma cítrica cremosa',
      price: 34.0,
      costPrice: 11.0,
      categoryId: catDrinks.id,
      kdsStation: 'BAR',
      stock: 75,
      minStock: 15
    }
  });

  const pNegroni = await prisma.product.create({
    data: {
      name: 'Negroni Clássico',
      description: 'Gin, Campari, Vermute tinto e twist de laranja',
      price: 36.0,
      costPrice: 13.0,
      categoryId: catDrinks.id,
      kdsStation: 'BAR',
      stock: 60,
      minStock: 10
    }
  });

  const pWhisky = await prisma.product.create({
    data: {
      name: 'Dose Whisky Black Label 12a',
      description: 'Dose de 50ml com ou sem gelo de coco',
      price: 32.0,
      costPrice: 12.0,
      categoryId: catDoses.id,
      kdsStation: 'BAR',
      stock: 40,
      minStock: 8
    }
  });

  const pBatata = await prisma.product.create({
    data: {
      name: 'Batata Rústica c/ Cheddar & Bacon',
      description: 'Batatas crocantes temperadas com alecrim, molho cheddar cremoso e crispy de bacon',
      price: 42.0,
      costPrice: 12.0,
      categoryId: catPorcoes.id,
      kdsStation: 'KITCHEN',
      stock: 50,
      minStock: 10
    }
  });

  const pDadinho = await prisma.product.create({
    data: {
      name: 'Dadinhos de Tapioca (12 un)',
      description: 'Feitos com queijo coalho tostado, acompanhados de geleia de pimenta da casa',
      price: 38.0,
      costPrice: 10.0,
      categoryId: catPorcoes.id,
      kdsStation: 'KITCHEN',
      stock: 45,
      minStock: 10
    }
  });

  const pPicanha = await prisma.product.create({
    data: {
      name: 'Picanha na Chapa c/ Mandioca',
      description: '500g de picanha fatiada acebolada, mandioca na manteiga de garrafa e farofa crocante',
      price: 89.0,
      costPrice: 38.0,
      categoryId: catPorcoes.id,
      kdsStation: 'KITCHEN',
      stock: 25,
      minStock: 5
    }
  });

  const pBurger = await prisma.product.create({
    data: {
      name: 'Smash Burger Duplo do Bar',
      description: 'Dois blends de 90g ultra tostados, queijo prato duplo, maionese defumada no pão brioche',
      price: 38.0,
      costPrice: 14.0,
      categoryId: catBurgers.id,
      kdsStation: 'KITCHEN',
      stock: 35,
      minStock: 8
    }
  });

  const pAgua = await prisma.product.create({
    data: {
      name: 'Água Mineral 500ml',
      description: 'Com ou sem gás',
      price: 6.0,
      costPrice: 1.8,
      categoryId: catBebidas.id,
      kdsStation: 'BAR',
      stock: 150,
      minStock: 30
    }
  });

  const pRefri = await prisma.product.create({
    data: {
      name: 'Refrigerante Lata 350ml',
      description: 'Coca-Cola, Guaraná Antarctica ou Zero',
      price: 8.0,
      costPrice: 3.2,
      categoryId: catBebidas.id,
      kdsStation: 'BAR',
      stock: 120,
      minStock: 24
    }
  });

  // 3. Criar 50 Mesas organizadas por Ambientes/Locais
  const tablesData: { number: number; name: string; capacity: number; section: string }[] = [];

  // Salão Principal (1 a 15)
  for (let n = 1; n <= 15; n++) {
    const pad = n.toString().padStart(2, '0');
    tablesData.push({
      number: n,
      name: `Mesa ${pad}`,
      capacity: n % 5 === 0 ? 8 : n % 3 === 0 ? 6 : 4,
      section: 'Salão Principal'
    });
  }

  // Deck Externo (16 a 25)
  for (let n = 16; n <= 25; n++) {
    const pad = n.toString().padStart(2, '0');
    tablesData.push({
      number: n,
      name: `Mesa ${pad} (Deck)`,
      capacity: n % 2 === 0 ? 6 : 4,
      section: 'Deck Externo'
    });
  }

  // Varanda (26 a 35)
  for (let n = 26; n <= 35; n++) {
    const pad = n.toString().padStart(2, '0');
    tablesData.push({
      number: n,
      name: `Mesa ${pad} (Varanda)`,
      capacity: 4,
      section: 'Varanda'
    });
  }

  // Balcão (36 a 42)
  for (let n = 36; n <= 42; n++) {
    const pad = n.toString().padStart(2, '0');
    tablesData.push({
      number: n,
      name: `Balcão ${pad}`,
      capacity: 2,
      section: 'Balcão'
    });
  }

  // Lounge & Mezanino (43 a 50)
  for (let n = 43; n <= 50; n++) {
    const pad = n.toString().padStart(2, '0');
    tablesData.push({
      number: n,
      name: `Lounge ${pad}`,
      capacity: 8,
      section: 'Lounge & Mezanino'
    });
  }

  const createdTables: Record<number, any> = {};
  for (const t of tablesData) {
    createdTables[t.number] = await prisma.table.create({
      data: {
        number: t.number,
        name: t.name,
        capacity: t.capacity,
        section: t.section,
        status: 'AVAILABLE'
      }
    });
  }

  // 4. Abrir Turno de Caixa Inicial com R$ 250 de troco
  const cashShift = await prisma.cashShift.create({
    data: {
      openedAt: new Date(Date.now() - 3600000 * 3), // aberto há 3 horas
      openedBy: 'Carlos (Caixa Principal)',
      initialBalance: 250.0,
      status: 'OPEN',
      notes: 'Turno da Noite iniciado normalmente'
    }
  });

  // 5. Simular 2 Mesas Ativas com Consumo (com 10% desabilitado por padrão)
  // Mesa 2: 2 Chopes Pilsen + Dadinho de Tapioca
  const orderMesa2 = await prisma.order.create({
    data: {
      tableId: createdTables[2].id,
      customerName: 'Lucas & Amigos',
      waiterName: 'Rafael Garçom',
      subtotal: 66.0, // 2x 14 + 38 = 66
      serviceFee: 0.0,
      serviceFeeRate: 0.10,
      isServiceFeeActive: false,
      total: 66.0,
      status: 'OPEN',
      createdAt: new Date(Date.now() - 45 * 60000) // 45 min atrás
    }
  });

  await prisma.orderItem.create({
    data: {
      orderId: orderMesa2.id,
      productId: pChopePilsen.id,
      quantity: 2,
      unitPrice: 14.0,
      totalPrice: 28.0,
      notes: 'Colarinho alto',
      kdsStatus: 'READY',
      kdsStation: 'BAR'
    }
  });

  await prisma.orderItem.create({
    data: {
      orderId: orderMesa2.id,
      productId: pDadinho.id,
      quantity: 1,
      unitPrice: 38.0,
      totalPrice: 38.0,
      notes: 'Geleia extra se possível',
      kdsStatus: 'PREPARING',
      kdsStation: 'KITCHEN'
    }
  });

  await prisma.table.update({
    where: { id: createdTables[2].id },
    data: {
      status: 'OCCUPIED',
      currentOrderId: orderMesa2.id,
      openedAt: orderMesa2.createdAt,
      customerCount: 2,
      customerName: 'Lucas'
    }
  });

  // Mesa 8 (Deck): 1 Gin Tônica, 1 Moscow Mule e 1 Picanha na Chapa
  const orderMesa8 = await prisma.order.create({
    data: {
      tableId: createdTables[8].id,
      customerName: 'Mariana Silva',
      waiterName: 'Juliana Garçonete',
      subtotal: 155.0, // 32 + 34 + 89 = 155
      serviceFee: 0.0,
      serviceFeeRate: 0.10,
      isServiceFeeActive: false,
      total: 155.0,
      status: 'OPEN',
      createdAt: new Date(Date.now() - 25 * 60000) // 25 min atrás
    }
  });

  await prisma.orderItem.create({
    data: {
      orderId: orderMesa8.id,
      productId: pGinTonica.id,
      quantity: 1,
      unitPrice: 32.0,
      totalPrice: 32.0,
      notes: 'Bastante gelo',
      kdsStatus: 'READY',
      kdsStation: 'BAR'
    }
  });

  await prisma.orderItem.create({
    data: {
      orderId: orderMesa8.id,
      productId: pMoscowMule.id,
      quantity: 1,
      unitPrice: 34.0,
      totalPrice: 34.0,
      notes: 'Sem gelo extra na espuma',
      kdsStatus: 'READY',
      kdsStation: 'BAR'
    }
  });

  await prisma.orderItem.create({
    data: {
      orderId: orderMesa8.id,
      productId: pPicanha.id,
      quantity: 1,
      unitPrice: 89.0,
      totalPrice: 89.0,
      notes: 'Ponto da carne: Ao Ponto para Mal',
      kdsStatus: 'PREPARING',
      kdsStation: 'KITCHEN'
    }
  });

  await prisma.table.update({
    where: { id: createdTables[8].id },
    data: {
      status: 'OCCUPIED',
      currentOrderId: orderMesa8.id,
      openedAt: orderMesa8.createdAt,
      customerCount: 4,
      customerName: 'Mariana Silva'
    }
  });

  console.log('✅ Dados de teste gerados com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
