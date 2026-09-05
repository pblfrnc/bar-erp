import { useState, useEffect } from 'react';
import { Table, Order } from './types';
import { api } from './services/api';
import { socket } from './services/socket';
import { WaiterView } from './views/WaiterView';
import { ThermalReceipt } from './components/ThermalReceipt';

export function WaiterApp() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loadingTables, setLoadingTables] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);

  // Escala de Acessibilidade para Baixa Visão
  const [fontScale, setFontScale] = useState<'normal' | 'large' | 'xlarge'>(() => {
    return (localStorage.getItem('bar_font_scale') as any) || 'normal';
  });

  const handleFontScaleChange = (scale: 'normal' | 'large' | 'xlarge') => {
    setFontScale(scale);
    localStorage.setItem('bar_font_scale', scale);
    document.documentElement.className = `dark font-scale-${scale}`;
  };

  useEffect(() => {
    document.documentElement.className = `dark font-scale-${fontScale}`;
  }, [fontScale]);

  // Carregar Mesas do Salão
  const loadTables = async () => {
    try {
      setLoadingTables(true);
      const data = await api.getTables();
      setTables(data);

      if (printOrder) {
        const foundTable = data.find((t) => t.activeOrder?.id === printOrder.id);
        if (foundTable?.activeOrder) {
          setPrintOrder(foundTable.activeOrder);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar mesas:', err);
    } finally {
      setLoadingTables(false);
    }
  };

  useEffect(() => {
    loadTables();

    // Eventos de Conexão WebSocket
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    // Eventos de Atualização em Tempo Real relevantes para o Salão
    const onTableUpdated = () => {
      loadTables();
    };

    const onOrderUpdated = () => {
      loadTables();
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('table:updated', onTableUpdated);
    socket.on('order:updated', onOrderUpdated);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('table:updated', onTableUpdated);
      socket.off('order:updated', onOrderUpdated);
    };
  }, []);

  // Definir primeiro pedido ativo para impressão se houver
  useEffect(() => {
    const tableWithOrder = tables.find((t) => t.activeOrder);
    if (tableWithOrder?.activeOrder) {
      setPrintOrder(tableWithOrder.activeOrder);
    }
  }, [tables]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none">
      {/* Componente para Impressão Térmica de Pré-conta */}
      <ThermalReceipt order={printOrder} />

      {/* Interface 100% Exclusiva do Garçom: Mesas, Pedidos, Juntar, Fechar e Cobrar */}
      <WaiterView
        tables={tables}
        onRefresh={loadTables}
        loading={loadingTables}
        isConnected={isConnected}
        fontScale={fontScale}
        onChangeFontScale={handleFontScaleChange}
      />
    </div>
  );
}

export default WaiterApp;
