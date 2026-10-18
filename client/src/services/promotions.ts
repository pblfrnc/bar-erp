import { useEffect, useState } from 'react';
import { Product, Promotion } from '../types';
import { api } from './api';
import { applyBestPromotion } from '../utils/pricing';

// Promoções do dia para as telas de lançamento. Usa o relógio e o fuso do PC (servidor), que é quem
// decide o preço cobrado, para o celular com hora/fuso errado não mostrar um preço diferente.
export function useActivePromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [clockOffsetMs, setClockOffsetMs] = useState<number>(0);
  const [, setTick] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api.getActivePromotions()
        .then(({ serverTime, serverTimezoneOffset, promotions }) => {
          if (cancelled) return;
          setPromotions(promotions);
          const server = Date.parse(serverTime);
          // Diferença de relógio + diferença de fuso: o horário "de parede" usado na regra fica igual ao do PC
          const tzShiftMs = typeof serverTimezoneOffset === 'number'
            ? (new Date().getTimezoneOffset() - serverTimezoneOffset) * 60 * 1000
            : 0;
          // Ex.: PC em Brasília (offset 180) e celular em UTC (0): desloca -3h, 23:00 UTC vira 20:00 como no PC
          if (!isNaN(server)) setClockOffsetMs(server - Date.now() + tzShiftMs);
        })
        .catch((err) => console.warn('[Promoções] Falha ao carregar:', err));

    load();
    const reload = setInterval(load, 5 * 60 * 1000);
    // Recalcula a cada minuto para a promoção começar/terminar na tela sem recarregar
    const tick = setInterval(() => setTick((t) => t + 1), 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(reload);
      clearInterval(tick);
    };
  }, []);

  const priceFor = (product: Product) => applyBestPromotion(product, promotions, new Date(Date.now() + clockOffsetMs));

  return { promotions, priceFor };
}
