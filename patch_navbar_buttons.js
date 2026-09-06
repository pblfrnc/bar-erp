const fs = require('fs');
let code = fs.readFileSync('client/src/components/Navbar.tsx', 'utf8');

code = code.replace(
  "import {",
  "import { FileText, "
);

const navItemsOriginal = `
  const navItems = [
    { id: 'dashboard', icon: BarChart3, label: 'Métricas' },
    { id: 'tables', icon: LayoutGrid, label: 'Mesas' },
    { id: 'cash', icon: DollarSign, label: 'Caixa' },
    { id: 'kds', icon: ChefHat, label: 'Cozinha (KDS)', badge: kdsCount },
    { id: 'products', icon: Beer, label: 'Produtos' },
    { id: 'customers', icon: Users, label: 'Clientes' },
    { id: 'audit', icon: ShieldAlert, label: 'Auditoria' },
    { id: 'settings', icon: Settings, label: 'Ajustes' }
  ];
`;

const navItemsNew = `
  const navItems = [
    { id: 'dashboard', icon: BarChart3, label: 'Métricas' },
    { id: 'tables', icon: LayoutGrid, label: 'Mesas' },
    { id: 'cash', icon: DollarSign, label: 'Caixa' },
    { id: 'kds', icon: ChefHat, label: 'Cozinha (KDS)', badge: kdsCount },
    { id: 'products', icon: Beer, label: 'Produtos' },
    { id: 'customers', icon: Users, label: 'Clientes' },
    { id: 'fiscal', icon: Receipt, label: 'Módulo Fiscal' },
    { id: 'settings', icon: Settings, label: 'Ajustes' }
  ];
`;

code = code.replace(navItemsOriginal, navItemsNew);

fs.writeFileSync('client/src/components/Navbar.tsx', code);
