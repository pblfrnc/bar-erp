import fs from 'fs';
let f = fs.readFileSync('client/src/components/TableDetailsModal.tsx', 'utf-8');

const lossFunc = `
  const handleMarkAsLoss = async () => {
    if (!window.confirm('ALERTA: Tem certeza que deseja dar baixa nesta mesa como PERDA/CALOTE? Isso não gera receita, mas debita o estoque e registra o prejuízo na Auditoria Cega.')) {
      return;
    }
    try {
      await api.markAsLoss(order.id);
      onClose();
    } catch (err: any) {
      alert(err.error || 'Erro ao registrar perda.');
    }
  };
`;

if (!f.includes('handleMarkAsLoss')) {
  f = f.replace("const handleRequestClosing = async () => {", lossFunc + "\n\n  const handleRequestClosing = async () => {");
}

const lossButton = `
          {isManager && (
            <button
              onClick={handleMarkAsLoss}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition whitespace-nowrap active:scale-95"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              Perda (Calote)
            </button>
          )}
`;

if (!f.includes('handleMarkAsLoss}')) {
  f = f.replace(`          <button
            onClick={() => { if ((window as any).electronAPI`, lossButton + `\n          <button
            onClick={() => { if ((window as any).electronAPI`);
}

fs.writeFileSync('client/src/components/TableDetailsModal.tsx', f);
