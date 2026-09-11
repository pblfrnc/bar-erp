import React from 'react';
import { Users, DollarSign, ShieldCheck, Clock, AlertTriangle, Ban } from 'lucide-react';
import { Metrics } from '../types';

interface Props {
  metrics: Metrics | null;
  loading: boolean;
}

export function MetricsOverview({ metrics, loading }: Props) {
  if (loading || !metrics) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-slate-900/60 border border-slate-800 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const cards = [
    {
      title: 'Faturamento Mensal Estimado',
      value: formatCurrency(metrics.estimatedMonthlyRevenue || 0),
      subtitle: `${metrics.totalClients} clientes cadastrados`,
      icon: DollarSign,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20',
      iconBg: 'bg-emerald-500/20',
    },
    {
      title: 'Licenças Ativas & Regulares',
      value: metrics.activeLicenses,
      subtitle: `${metrics.totalLicenses} máquinas no total`,
      icon: ShieldCheck,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10 border-indigo-500/20',
      iconBg: 'bg-indigo-500/20',
    },
    {
      title: 'Vencendo nos Próximos 7 Dias',
      value: metrics.expiringSoon,
      subtitle: 'Atenção para cobrança de mensalidade',
      icon: Clock,
      color: metrics.expiringSoon > 0 ? 'text-amber-400' : 'text-slate-400',
      bgColor: metrics.expiringSoon > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-900/60 border-slate-800',
      iconBg: metrics.expiringSoon > 0 ? 'bg-amber-500/20' : 'bg-slate-800',
    },
    {
      title: 'Expiradas ou Bloqueadas',
      value: metrics.expired + metrics.blocked,
      subtitle: `${metrics.expired} vencidas | ${metrics.blocked} bloqueadas`,
      icon: AlertTriangle,
      color: (metrics.expired + metrics.blocked) > 0 ? 'text-rose-400' : 'text-slate-400',
      bgColor: (metrics.expired + metrics.blocked) > 0 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-slate-900/60 border-slate-800',
      iconBg: (metrics.expired + metrics.blocked) > 0 ? 'bg-rose-500/20' : 'bg-slate-800',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`p-5 rounded-2xl border ${card.bgColor} backdrop-blur-sm transition-all duration-200 hover:scale-[1.01]`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {card.title}
              </span>
              <div className={`p-2.5 rounded-xl ${card.iconBg} ${card.color}`}>
                <Icon size={20} />
              </div>
            </div>
            <div className={`text-2xl font-bold tracking-tight mb-1 ${card.color}`}>
              {card.value}
            </div>
            <div className="text-xs text-slate-400 font-medium">
              {card.subtitle}
            </div>
          </div>
        );
      })}
    </div>
  );
}
