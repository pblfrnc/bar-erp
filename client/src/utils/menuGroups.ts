// Grupos automáticos do cardápio digital, pelo nome do produto. Usado pelo site (menu/) para dividir
// categorias grandes e pela tela "Itens do Cardápio" do ERP para marcar/desmarcar grupos inteiros.

export const plainName = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

// Ordem de teste: o primeiro que bater leva o item. Itens de conveniência vêm antes para não caírem em comida
// ("SALG AMENDUPA PIZZA" é salgadinho, "PANELINHA SEARA CALDO VERDE" é mercearia, "TÁBUA ... AZEITONA" é porção).
const RULES: { name: string; re: RegExp }[] = [
  { name: 'Adicionais', re: /^ADICIONAL/ },
  { name: 'Tabacaria', re: /CIGARRO|^ROTHMANS|LUCKY? STRIKE|ISQUEIRO|ESQUEIRO|MARLBORO|DERBY|DUNHILL|PALHEIRO|\bSEDA\b|NARGUILE|ESSENCIA/ },
  {
    name: 'Conveniência e limpeza',
    re: /PRESERVATIVO|PAPEL (HIG|TOALHA)|SABAO|DETERG|DESINF|AGUA SANITARIA|SACO PLAST|SACOLA|ISOPOR|COPO DESC|GUARDANAPO|\bPILHA/
  },
  {
    name: 'Salgadinhos e doces',
    re: /^(SALG|AMENDOIM|PIRULITO|PIR\.|CHICLE|CHIC\.|BALAS?\b|CHOC\b|CHOCOLATE|KINDER|FERRERO|BISCOITO|VOTORIA|VITORIA SABOR|HALLS|TIC-TAC|TRIDENT|FINI\b|TUBES|DUCREM|COLORETI|GOMETS|MINTY|STICK|BIG ?BIG|CART X|MINI ENROLADO|PACOCA|PINGO DE LEITE|DOCE\b|MICOS|CHEETOS|DORITOS|RUFFLES|FANDANGOS|LAYS|CEBOLITOS|BACONZITOS|STIKSY|BATATA CRONY|PURURUCA|TORRESMO .*\d+ ?G\b|SEQUILHOS|PETISCO .*\d+ ?G\b|GELADINHO|GELO DE SABOR)/
  },
  { name: 'Pizzas', re: /\bPIZZA/ },
  { name: 'Porções e petiscos', re: /TABUA|FRIOS|SALAME/ },
  {
    name: 'Mercearia e insumos',
    re: /CONSERVA|COSERVA|\bVIDRO\b|EM CALDA|SEARA|NISSIN|ODERICH|BORDON|MAIONESE|MOLHO DE (TOMATE|PIMENTA)|MILHO VERDE|GELEIA|BAT(ATA)? PALHA|BATATA PALITO|PRE FRITA|\bCONG\b|\bPCT\b|\d+ ?KG\b|SACHE|HOT POCKET|^AZEITONA|CEBOLINHA|PEPINO|LINGUICA DEFUMADA|^SALSICHA|FLOCOS DE MILHO|CREME DE AVELA|BOLINHO DE CARNE .*\d+ ?G\b|ALMONDEGAS/
  },
  { name: 'Lanches', re: /BURG|HAMBURGUE|^X[- ]|SANDUICHE|LANCHE|HOT ?-?DOG|CACHORRO|\bMISTO\b/ },
  {
    name: 'Porções e petiscos',
    re: /PORCAO|PORCOES|PETISCO|ISCA|BATATA FRITA|FRITAS?\b|PASSARINHO|CALDO|ACEBOLAD|CARNE DE SOL|MACAXEIRA|PASTEL|PAO DE ALHO|^QUEIJO$|^PRESUNTO|^PALMITO$|EMPANAD/
  },
  { name: 'Pratos', re: /PRATO|EXECUTIVO|REFEICAO|PARMEGIANA|FEIJOADA/ },
  { name: 'Torres', re: /^TORRE\b/ },
  { name: 'Doses', re: /^DOSE\b|^DOZE\b/ },
  {
    name: 'Drinks prontos e ices',
    re: /\bICE\b|BEATS|BALLY|BORABEBE|COROTE|RUSTOFF|ETERNITY|KRISKOF|MANSAO|GIN READY|READY 275|CHUVA DE PRATA|GASEIFICADA|COPAO|CAIPIRINHA|CAIPIROSKA|DRINK/
  },
  {
    name: 'Cervejas',
    re: /^CERV|\bCERVEJA\b|\bSKOL\b|BRAHMA|HEINEKEN|STELLA|CORONA|BUD(W|U)EISER|AMSTEL|^ORIGINAL|KAISER|IMPERIO|CHOPP|LITRAO|LONG NECK/
  },
  { name: 'Vinhos', re: /VINHO|CASILLERO|AURORA|CONDE DE|SANTA HELENA|SANGRIA|ESPUMANTE|CHAMPANHE/ },
  {
    name: 'Whiskies',
    re: /WH?ISK|WISK|BUCHANAN|OLD PARR|BALL?ANTINES|BALLATINES|BLACK ?& ?WHITE|PASSAPORT|JOHNNIE|LABEL|BLAK STONE|OLDEN|RED GOLD|BLEND\b/
  },
  {
    name: 'Destilados e licores',
    re: /VODKA|VDKA|SMIRNOFF|ABSOLUT|SKYY|\bGIN\b|TANQUERAY|\bRUM\b|TEQUILA|CACHA|CACACHA|YPIOCA|SAGATIBA|VELHO BARREIRO|PRESIDENTE|DREHER|CAMPARI|LICOR|JACK|CUERVO|RAIZ|DOMUS|NOBILIS|MARGARITA|ROCK/
  },
  { name: 'Energéticos', re: /ENERG|RED BULL|MONSTER|ENGOV/ },
  {
    name: 'Refrigerantes, sucos e águas',
    re: /REFRI|COCA|GUARANA|FANTA|SUKITA|PEPSI|SODA|H2OH|AGUA MINERAL|AGUA COM|AGUA SEM|ACHOC|SUCO|TODDYNHO|\bCHA\b/
  },
  { name: 'Sobremesas', re: /SOBREMESA|PUDIM|SORVETE|\bACAI\b|\bBOLO\b|TORTA|PETIT/ }
];

// Ordem de exibição: comidas, bebidas (cerveja primeiro), depois o que normalmente nem vai ao cardápio
export const MENU_GROUP_ORDER = [
  'Pizzas',
  'Lanches',
  'Porções e petiscos',
  'Pratos',
  'Sobremesas',
  'Adicionais',
  'Cervejas',
  'Torres',
  'Doses',
  'Drinks prontos e ices',
  'Destilados e licores',
  'Whiskies',
  'Vinhos',
  'Refrigerantes, sucos e águas',
  'Energéticos',
  'Salgadinhos e doces',
  'Mercearia e insumos',
  'Tabacaria',
  'Conveniência e limpeza',
  'Outros'
];

// Grupos que a tela de itens sugere tirar do cardápio (estoque da loja, não do cardápio)
export const NOT_FOR_MENU_GROUPS = ['Mercearia e insumos', 'Conveniência e limpeza', 'Tabacaria'];

export const menuGroupOf = (productName: string) => RULES.find((r) => r.re.test(plainName(productName)))?.name || 'Outros';

export const sortByMenuGroup = <T>(entries: [string, T][]) =>
  entries.sort((a, b) => MENU_GROUP_ORDER.indexOf(a[0]) - MENU_GROUP_ORDER.indexOf(b[0]));
