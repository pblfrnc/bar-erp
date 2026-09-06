const fs = require('fs');
let code = fs.readFileSync('client/src/views/DashboardView.tsx', 'utf8');

// We will add Tabs
code = code.replace(
  "import {",
  "import { AuditView } from './AuditView';\nimport {"
);

code = code.replace(
  "const [data, setData] = useState<DashboardData | null>(null);",
  "const [activeTab, setActiveTab] = useState<'overview' | 'audit'>('overview');\n  const [data, setData] = useState<DashboardData | null>(null);"
);

const newRender = `
  if (loading) {
    return <div className="p-8 text-center text-slate-400">Carregando métricas...</div>;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pt-4 pb-20">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-black text-white tracking-tight">Métricas & Auditoria</h2>
        <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800">
          <button 
            onClick={() => setActiveTab('overview')}
            className={\`px-4 py-2 rounded-lg text-sm font-bold transition \${activeTab === 'overview' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}\`}
          >
            Visão Geral
          </button>
          <button 
            onClick={() => setActiveTab('audit')}
            className={\`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 \${activeTab === 'audit' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400 hover:text-rose-400'}\`}
          >
            <ShieldAlert className="w-4 h-4" />
            Auditoria Cega
          </button>
        </div>
      </div>

      {activeTab === 'audit' ? (
         <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <AuditView />
         </div>
      ) : (
      <>
        {/* Gráficos originais do Dashboard */}
`;

code = code.replace(
  /if \(loading\) \{[\s\S]*?return \([\s\S]*?<div className="space-y-6 max-w-6xl mx-auto pt-4 pb-20">/,
  newRender
);

code = code.replace(
  /<\/div>\s*$/g,
  "      </>\n      )}\n    </div>\n  );\n};\n"
);

fs.writeFileSync('client/src/views/DashboardView.tsx', code);
