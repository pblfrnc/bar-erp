import React, { useState, useEffect } from 'react';
import { DashboardData } from '../types';
import { api } from '../services/api';
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Receipt,
  Award,
  RefreshCw,
  Beer,
  ChefHat
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboardData();
      setData(res);
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <div className="space-y-4 pb-20 max-w-6xl mx-auto">
      {/* Cabeçalho */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Dashboard & Indicadores</h2>
            <p className="text-xs text-slate-400">
              Desempenho operacional, faturamento e produtos líderes de vendas
            </p>
          </div>
        </div>

        <button
          onClick={loadDashboard}
          className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>Faturamento Hoje</span>
          </div>
          <div className="text-2xl font-black text-emerald-400">
            R$ {(data?.todayRevenue || 0).toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Pagamentos liquidados
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            <Receipt className="w-4 h-4 text-blue-400" />
            <span>Comandas Pagas</span>
          </div>
          <div className="text-2xl font-black text-white">
            {data?.ordersCompletedToday || 0}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Mesas finalizadas
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span>Ticket Médio</span>
          </div>
          <div className="text-2xl font-black text-amber-400">
            R$ {(data?.averageTicket || 0).toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Gasto médio por mesa
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            <Users className="w-4 h-4 text-purple-400" />
            <span>Taxa de Ocupação</span>
          </div>
          <div className="text-2xl font-black text-white">
            {data?.occupancyRate || 0}%
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {data?.occupiedTables || 0} de {data?.totalTables || 0} mesas ocupadas
          </span>
        </div>
      </div>

      {/* Seção 2: Top Produtos e Meios de Pagamento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top 5 Produtos Mais Vendidos */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-black text-white">Top 5 Produtos Mais Pedidos Hoje</h3>
          </div>

          <div className="space-y-3">
            {(!data?.topProducts || data.topProducts.length === 0) ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Nenhum pedido computado hoje ainda.
              </div>
            ) : (
              data.topProducts.map((p, idx) => {
                const maxQty = data.topProducts[0]?.quantity || 1;
                const pct = Math.round((p.quantity / maxQty) * 100);

                return (
                  <div key={p.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-bold flex items-center justify-center text-[10px]">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-white">{p.name}</span>
                        <span className="text-[10px] text-slate-500">
                          ({p.station === 'BAR' ? '🍺 Bar' : '🍳 Cozinha'})
                        </span>
                      </div>
                      <span className="font-mono font-bold text-amber-400">
                        {p.quantity} un • R$ {p.total.toFixed(2)}
                      </span>
                    </div>

                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Meios de Pagamento Recebidos */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
          <h3 className="text-base font-black text-white">Distribuição dos Pagamentos</h3>

          <div className="space-y-3 pt-2">
            {data?.paymentMethodsBreakdown && Object.keys(data.paymentMethodsBreakdown).length > 0 ? (
              Object.entries(data.paymentMethodsBreakdown).map(([method, amt]) => {
                const totalRev = data.todayRevenue || 1;
                const pct = Math.round((amt / totalRev) * 100);

                return (
                  <div key={method} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300">{method}</span>
                      <span className="font-mono font-bold text-emerald-400">
                        R$ {amt.toFixed(2)} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs">
                Nenhum pagamento liquidado no dia.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
