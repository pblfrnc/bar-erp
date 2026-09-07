import fs from 'fs';
let f = fs.readFileSync('client/src/views/DashboardView.tsx', 'utf-8');

const tabButtons = `
      {/* Abas */}
      <div className="flex items-center gap-2 mb-4 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={\`px-4 py-2 rounded-xl text-xs font-bold transition \${activeTab === 'overview' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}\`}
        >
          Visão Geral
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={\`px-4 py-2 flex items-center gap-2 rounded-xl text-xs font-bold transition \${activeTab === 'audit' ? 'bg-rose-500/20 text-rose-400' : 'text-slate-500 hover:text-rose-400/70'}\`}
        >
          <ShieldAlert className="w-4 h-4" /> Monitoramento Cego
        </button>
      </div>

      {activeTab === 'audit' ? (
        <AuditView />
      ) : (
        <>
`;

// Insert the tabs before {/* Cards de Métricas Principais */}
if (f.includes("{/* Cards de Métricas Principais */}")) {
  f = f.replace("{/* Cards de Métricas Principais */}", tabButtons + "\n      {/* Cards de Métricas Principais */}");
  // Close the <> fragment at the end of the return statement
  f = f.replace(/    <\/div>\n  \);\n};\n?$/, "        </>\n      )}\n    </div>\n  );\n};\n");
  fs.writeFileSync('client/src/views/DashboardView.tsx', f);
}
