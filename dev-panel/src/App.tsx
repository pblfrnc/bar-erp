import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Search, 
  Plus, 
  Settings, 
  RefreshCw, 
  ShieldCheck, 
  Terminal, 
  CheckCircle2 
} from 'lucide-react';
import { ClientRecord, LicenseRecord, Metrics } from './types';
import { MetricsOverview } from './components/MetricsOverview';
import { ClientsList } from './components/ClientsList';
import { AddClientModal } from './components/AddClientModal';
import { RenewModal } from './components/RenewModal';
import { OfflineKeyModal } from './components/OfflineKeyModal';
import { SettingsModal } from './components/SettingsModal';

export function App() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modais
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [renewModalData, setRenewModalData] = useState<{ license: LicenseRecord; client: ClientRecord } | null>(null);
  const [offlineKeyData, setOfflineKeyData] = useState<{ license: LicenseRecord; client: ClientRecord; initialKey?: string } | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [clientsRes, metricsRes] = await Promise.all([
        fetch(`/api/admin/clients${search ? `?search=${encodeURIComponent(search)}` : ''}`),
        fetch('/api/admin/metrics'),
      ]);

      const clientsData = await clientsRes.json();
      const metricsData = await metricsRes.json();

      if (clientsData.success) {
        setClients(clientsData.clients || []);
      }
      if (metricsData.success) {
        setMetrics(metricsData);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do painel:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  // Ação rápida: Renovar +30 dias ao receber comprovante
  const handleQuickRenew = async (machineId: string, clientName: string) => {
    try {
      const res = await fetch('/api/admin/licenses/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineId,
          daysToAdd: 30,
          notes: 'Renovação rápida +30 dias após comprovante PIX',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`⚡ Licença de "${clientName}" renovada até ${new Date(data.newExpiresAt).toLocaleDateString('pt-BR')}!`);
        loadData();
      } else {
        alert(data.error || 'Erro ao renovar licença');
      }
    } catch (err) {
      alert('Erro de rede ao renovar licença');
    }
  };

  // Bloquear / Desbloquear máquina
  const handleToggleBlock = async (machineId: string) => {
    try {
      const res = await fetch('/api/admin/licenses/toggle-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Status da máquina alterado para: ${data.status}`);
        loadData();
      }
    } catch (err) {
      alert('Erro ao alterar status da máquina');
    }
  };

  // Excluir cliente
  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o cliente "${clientName}" e todas as suas licenças?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Cliente "${clientName}" excluído.`);
        loadData();
      }
    } catch (err) {
      alert('Erro ao excluir cliente');
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-4 sm:p-8">
      {/* Toast Flutuante */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-5 duration-200 font-semibold text-sm border border-emerald-400/30">
          <CheckCircle2 size={20} />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Navbar */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <ShieldCheck size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-white tracking-tight">
                  Painel do Desenvolvedor
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-mono">
                  Software House
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Gestão e ativação remota de licenças mensais por ID da Máquina
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => loadData()}
              title="Atualizar dados"
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin text-indigo-400' : ''} />
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-colors"
            >
              <Settings size={16} />
              Configurar Software House
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
            >
              <Plus size={18} />
              Novo Cliente / Ativação
            </button>
          </div>
        </header>

        {/* Métricas Principais */}
        <MetricsOverview metrics={metrics} loading={loading} />

        {/* Barra de Pesquisa */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome do estabelecimento, responsável, WhatsApp ou ID da Máquina..."
              className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Lista de Clientes */}
        <main>
          <ClientsList
            clients={clients}
            loading={loading}
            onQuickRenew={handleQuickRenew}
            onOpenRenewModal={(lic, cli) => setRenewModalData({ license: lic, client: cli })}
            onOpenOfflineKey={(lic, cli) => setOfflineKeyData({ license: lic, client: cli })}
            onToggleBlock={handleToggleBlock}
            onDeleteClient={handleDeleteClient}
            onAddMachine={(cliId) => setShowAddModal(true)}
          />
        </main>
      </div>

      {/* Modais */}
      <AddClientModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          showToast('Cliente cadastrado com sucesso!');
          loadData();
        }}
      />

      <RenewModal
        isOpen={!!renewModalData}
        license={renewModalData?.license || null}
        client={renewModalData?.client || null}
        onClose={() => setRenewModalData(null)}
        onSuccess={(data) => {
          showToast(`Licença renovada com sucesso!`);
          loadData();
          if (data.offlineKey && renewModalData) {
            setOfflineKeyData({
              license: renewModalData.license,
              client: renewModalData.client,
              initialKey: data.offlineKey,
            });
          }
        }}
      />

      <OfflineKeyModal
        isOpen={!!offlineKeyData}
        license={offlineKeyData?.license || null}
        client={offlineKeyData?.client || null}
        initialKey={offlineKeyData?.initialKey}
        onClose={() => setOfflineKeyData(null)}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSuccess={() => {
          showToast('Configurações salvas!');
          loadData();
        }}
      />
    </div>
  );
}
